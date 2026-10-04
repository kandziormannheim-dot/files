import "server-only";
import { AssigneeGroup, TaskPriority, TaskStatus, type Prisma, type User } from "@prisma/client";
import { formatDate, parseDateInput } from "@/lib/dates";
import { assigneeLabel, compareTasks, dueLabel, isOverdue } from "@/lib/tasks";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit, changes, type DbClient } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";

type Actor = Pick<User, "id" | "role" | "name">;

export const taskInclude = {
  assignees: { include: { user: { select: { id: true, name: true, email: true, active: true } } } },
  meeting: { select: { id: true, startsAt: true, type: true } },
  agendaItem: { select: { id: true, title: true } },
  resolution: { select: { id: true, number: true, subject: true } },
  action: { select: { id: true, title: true, startsAt: true } },
  topic: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/** „Sitzung vom 26.02.2026 · TOP Planung Infostand“, „Beschluss 2026-07“, „Aktion …“, „Thema …“ */
export function originText(task: TaskWithRelations): string {
  const parts: string[] = [];
  if (task.meeting) parts.push(`Sitzung vom ${formatDate(task.meeting.startsAt)}`);
  if (task.agendaItem) parts.push(`TOP „${task.agendaItem.title}“`);
  if (task.resolution) parts.push(`Beschluss ${task.resolution.number}`);
  if (task.action) parts.push(`Aktion „${task.action.title}“`);
  if (task.topic) parts.push(`Thema „${task.topic.title}“`);
  return parts.join(" · ");
}

/** Eigene Aufgaben: zugewiesen, angelegt oder Gruppenaufgabe. Fremde nur mit task.editAll. */
export function canEditTask(actor: Pick<User, "id" | "role">, task: TaskWithRelations): boolean {
  if (can(actor.role, "task.editAll")) return true;
  if (!can(actor.role, "task.create")) return false;
  return (
    task.createdById === actor.id ||
    task.assigneeGroup !== "KEINE" ||
    task.assignees.some((a) => a.userId === actor.id)
  );
}

export function canDeleteTask(actor: Pick<User, "id" | "role">, task: TaskWithRelations): boolean {
  return can(actor.role, "task.editAll") || (can(actor.role, "task.create") && task.createdById === actor.id);
}

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalId = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const taskSchema = z.object({
  title: requiredText(300),
  description: optionalText(5000),
  assigneeGroup: z.enum(AssigneeGroup).default("KEINE"),
  "assigneeIds[]": z.array(z.string().min(1)).default([]),
  dueDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  dueText: optionalText(200),
  priority: z.preprocess(emptyToUndefined, z.enum(TaskPriority).optional()),
  status: z.enum(TaskStatus).default("OFFEN"),
  meetingId: optionalId,
  agendaItemId: optionalId,
  resolutionId: optionalId,
  actionId: optionalId,
  topicId: optionalId,
});

export type TaskInput = {
  title: string;
  description?: string;
  assigneeGroup?: AssigneeGroup;
  assigneeIds?: string[];
  dueDate?: Date | null;
  dueText?: string;
  priority?: TaskPriority | null;
  status?: TaskStatus;
  meetingId?: string | null;
  agendaItemId?: string | null;
  resolutionId?: string | null;
  actionId?: string | null;
  topicId?: string | null;
};

function parseTaskForm(formData: FormData): TaskInput {
  const raw = taskSchema.parse(formToObject(formData));
  const dueDate = raw.dueDate ? parseDateInput(raw.dueDate) : null;
  return {
    title: raw.title,
    description: raw.description ?? "",
    assigneeGroup: raw.assigneeGroup,
    assigneeIds: [...new Set(raw["assigneeIds[]"].filter(Boolean))],
    dueDate,
    // Datum oder Freitext – ein Datum hat Vorrang (nur dann gibt es Erinnerungen)
    dueText: dueDate ? "" : (raw.dueText ?? ""),
    priority: raw.priority ?? null,
    status: raw.status,
    meetingId: raw.meetingId ?? null,
    agendaItemId: raw.agendaItemId ?? null,
    resolutionId: raw.resolutionId ?? null,
    actionId: raw.actionId ?? null,
    topicId: raw.topicId ?? null,
  };
}

async function validateRefs(tx: DbClient, input: TaskInput) {
  if (input.assigneeIds?.length) {
    const found = await tx.user.count({ where: { id: { in: input.assigneeIds }, active: true } });
    if (found !== input.assigneeIds.length) throw new UserError("Mindestens eine verantwortliche Person ist nicht (mehr) aktiv.");
  }
  if (input.agendaItemId) {
    const item = await tx.agendaItem.findUnique({ where: { id: input.agendaItemId } });
    if (!item) throw new UserError("TOP nicht gefunden.");
    input.meetingId ??= item.meetingId;
  }
}

/**
 * Legt eine Aufgabe an (auch aus Beschlüssen, Aktionen, Themen oder dem KI-Entwurf) und benachrichtigt
 * neu Verantwortliche. Rechteprüfung durch den Aufrufer bzw. createTask.
 */
export async function createTaskRecord(tx: DbClient, actor: Actor, input: TaskInput) {
  await validateRefs(tx, input);
  const task = await tx.task.create({
    data: {
      title: input.title,
      description: input.description ?? "",
      assigneeGroup: input.assigneeGroup ?? "KEINE",
      dueDate: input.dueDate ?? null,
      dueText: input.dueText ?? "",
      priority: input.priority ?? null,
      status: input.status ?? "OFFEN",
      completedAt: input.status === "ERLEDIGT" ? new Date() : null,
      meetingId: input.meetingId ?? null,
      agendaItemId: input.agendaItemId ?? null,
      resolutionId: input.resolutionId ?? null,
      actionId: input.actionId ?? null,
      topicId: input.topicId ?? null,
      createdById: actor.id,
      assignees: { create: (input.assigneeIds ?? []).map((userId) => ({ userId })) },
    },
    include: taskInclude,
  });
  await audit(tx, actor, "task.create", "Task", task.id, {
    title: task.title,
    assignees: input.assigneeIds,
    group: task.assigneeGroup,
    due: dueLabel(task),
  });
  return task;
}

/** Mail „Neue Aufgabe zugewiesen“ (SPEC.md Abschnitt 7) – nicht an sich selbst. */
export async function notifyAssignees(actor: Actor, task: TaskWithRelations, userIds: string[]) {
  for (const a of task.assignees) {
    if (!userIds.includes(a.userId) || a.userId === actor.id || !a.user.active) continue;
    const mail = await renderMail("aufgabe.zugewiesen", {
      empfaenger: { name: a.user.name },
      aufgabe: {
        titel: task.title,
        frist: dueLabel(task),
        herkunft: originText(task),
        von: actor.name,
        link: `${appUrl()}/tasks/${task.id}`,
      },
    });
    await queueMail({ to: a.user.email, subject: mail.subject, text: mail.text, html: mail.html });
  }
}

export async function createTask(actor: Actor, formData: FormData) {
  assertCan(actor, "task.create");
  const input = parseTaskForm(formData);
  const task = await db.$transaction((tx) => createTaskRecord(tx, actor, input));
  await notifyAssignees(actor, task, input.assigneeIds ?? []);
  return task;
}

export async function getTask(actor: Pick<User, "role">, id: string) {
  assertCan(actor, "read");
  const task = await db.task.findUnique({
    where: { id },
    include: {
      ...taskInclude,
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!task) throw new NotFoundError("Aufgabe nicht gefunden.");
  return task;
}

export async function updateTask(actor: Actor, id: string, formData: FormData) {
  const before = await getTask(actor, id);
  if (!canEditTask(actor, before)) throw new ForbiddenError();
  const input = parseTaskForm(formData);
  const oldIds = before.assignees.map((a) => a.userId);
  const newIds = input.assigneeIds ?? [];
  const task = await db.$transaction(async (tx) => {
    await validateRefs(tx, input);
    const data = {
      title: input.title,
      description: input.description ?? "",
      assigneeGroup: input.assigneeGroup ?? "KEINE",
      dueDate: input.dueDate ?? null,
      dueText: input.dueText ?? "",
      priority: input.priority ?? null,
      status: input.status ?? before.status,
    };
    const dueChanged = before.dueDate?.getTime() !== data.dueDate?.getTime();
    await tx.taskAssignee.deleteMany({ where: { taskId: id, userId: { notIn: newIds } } });
    await tx.taskAssignee.createMany({
      data: newIds.filter((u) => !oldIds.includes(u)).map((userId) => ({ taskId: id, userId })),
    });
    const updated = await tx.task.update({
      where: { id },
      data: {
        ...data,
        completedAt: data.status === "ERLEDIGT" ? (before.completedAt ?? new Date()) : null,
        // neue Frist → Erinnerungen erneut erlauben
        ...(dueChanged ? { remindedBeforeAt: null, remindedOverdueAt: null } : {}),
      },
      include: taskInclude,
    });
    await audit(tx, actor, "task.update", "Task", id, {
      ...changes(before, data),
      ...(JSON.stringify([...oldIds].sort()) !== JSON.stringify([...newIds].sort()) ? { assignees: [oldIds, newIds] } : {}),
    });
    return updated;
  });
  await notifyAssignees(actor, task, newIds.filter((u) => !oldIds.includes(u)));
  return task;
}

export async function setTaskStatus(actor: Actor, id: string, status: TaskStatus) {
  const before = await getTask(actor, id);
  if (!canEditTask(actor, before)) throw new ForbiddenError();
  const parsed = z.enum(TaskStatus).parse(status);
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id },
      data: { status: parsed, completedAt: parsed === "ERLEDIGT" ? new Date() : null },
    });
    await audit(tx, actor, "task.status", "Task", id, { status: [before.status, parsed] });
  });
}

export async function deleteTask(actor: Actor, id: string) {
  const before = await getTask(actor, id);
  if (!canDeleteTask(actor, before)) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id } });
    await audit(tx, actor, "task.delete", "Task", id, { title: before.title });
  });
}

export async function addTaskComment(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "task.create");
  await getTask(actor, id);
  const { text } = z.object({ text: requiredText(5000) }).parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    const c = await tx.taskComment.create({ data: { taskId: id, authorId: actor.id, text } });
    await audit(tx, actor, "task.comment", "Task", id, { commentId: c.id });
  });
}

export type TaskView = "mine" | "all" | "overdue";
export type TaskFilter = {
  view: TaskView;
  status?: TaskStatus | "AKTIV";
  assigneeId?: string;
  origin?: "meeting" | "action" | "topic" | "resolution" | "none";
};

export async function listTasks(actor: Pick<User, "id" | "role">, filter: TaskFilter) {
  assertCan(actor, "read");
  const where: Prisma.TaskWhereInput = {};
  const and: Prisma.TaskWhereInput[] = [];
  if (filter.view === "mine") {
    and.push({ OR: [{ assignees: { some: { userId: actor.id } } }, { assigneeGroup: { in: ["VORSTAND", "ALLE"] } }] });
  }
  if (filter.assigneeId) and.push({ assignees: { some: { userId: filter.assigneeId } } });
  const status = filter.view === "overdue" ? "AKTIV" : (filter.status ?? (filter.view === "mine" ? "AKTIV" : undefined));
  if (status === "AKTIV") and.push({ status: { not: "ERLEDIGT" } });
  else if (status) and.push({ status });
  if (filter.view === "overdue") and.push({ dueDate: { not: null } });
  switch (filter.origin) {
    case "meeting":
      and.push({ meetingId: { not: null } });
      break;
    case "action":
      and.push({ actionId: { not: null } });
      break;
    case "topic":
      and.push({ topicId: { not: null } });
      break;
    case "resolution":
      and.push({ resolutionId: { not: null } });
      break;
    case "none":
      and.push({ meetingId: null, actionId: null, topicId: null, resolutionId: null });
      break;
  }
  if (and.length) where.AND = and;
  const tasks = await db.task.findMany({ where, include: taskInclude, take: 500 });
  const now = new Date();
  return tasks
    .filter((t) => filter.view !== "overdue" || isOverdue(t, now))
    .sort((a, b) => compareTasks(a, b, now));
}

export function taskSummary(task: TaskWithRelations) {
  return { assignees: assigneeLabel(task), due: dueLabel(task), origin: originText(task) };
}
