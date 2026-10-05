import "server-only";
import { randomBytes } from "node:crypto";
import {
  AgendaItemStatus,
  MeetingFormat,
  MeetingType,
  RsvpResponse,
  type Meeting,
  type Prisma,
  type User,
} from "@prisma/client";
import { numberAgenda } from "@/lib/agenda";
import { addBerlinDays, formatDate, parseDateInput, parseDateTimeInput, startOfBerlinDay } from "@/lib/dates";
import { isOverdue, assigneeLabel, dueLabel } from "@/lib/tasks";
import { checkbox, formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit, changes, type DbClient } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { getTemplateSource } from "@/server/templates/store";
import { buildDefaultAgenda, parseStandardAgenda } from "./agenda-defaults";
import { getSettings } from "./settings";
import { meetingContext, senderContext } from "./template-context";

type Actor = Pick<User, "id" | "role">;

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export const meetingInclude = {
  agendaItems: { orderBy: { position: "asc" } },
  attendances: { include: { user: { select: { id: true, name: true, email: true, active: true, role: true } } } },
} satisfies Prisma.MeetingInclude;

export type MeetingWithAgenda = Prisma.MeetingGetPayload<{ include: typeof meetingInclude }>;

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const meetingSchema = z
  .object({
    type: z.enum(MeetingType),
    format: z.enum(MeetingFormat),
    title: optionalText(200),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, { error: "Bitte Datum und Uhrzeit angeben." }),
    endsAt: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).optional()),
    location: optionalText(300),
    onlineUrl: z.preprocess(emptyToUndefined, z.url({ protocol: /^https?$/ }).max(1000).optional()),
    responseDeadline: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    urgent: checkbox,
    urgencyReason: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.format !== "DIGITAL" && !v.location) ctx.addIssue({ code: "custom", path: ["location"], message: "Bitte einen Ort angeben." });
    if (v.format !== "PRAESENZ" && !v.onlineUrl)
      ctx.addIssue({ code: "custom", path: ["onlineUrl"], message: "Bitte den Online-Link angeben." });
    if (v.urgent && (v.urgencyReason ?? "").length < 10)
      ctx.addIssue({ code: "custom", path: ["urgencyReason"], message: "Bitte begründen, warum die Sitzung eilbedürftig ist." });
  });

async function parseMeetingForm(formData: FormData) {
  const v = meetingSchema.parse(formToObject(formData));
  const startsAt = parseDateTimeInput(v.startsAt)!;
  const settings = await getSettings();
  const responseDeadline = v.responseDeadline
    ? parseDateInput(v.responseDeadline)
    : startOfBerlinDay(addBerlinDays(startsAt, -settings.meeting.responseDaysBefore));
  return {
    type: v.type,
    format: v.format,
    title: v.title ?? "",
    startsAt,
    endsAt: v.endsAt ? parseDateTimeInput(v.endsAt) : null,
    location: v.format === "DIGITAL" ? "" : (v.location ?? ""),
    onlineUrl: v.format === "PRAESENZ" ? "" : (v.onlineUrl ?? ""),
    responseDeadline,
    urgent: v.urgent,
    urgencyReason: v.urgent ? (v.urgencyReason ?? "") : "",
  };
}

/** Teilnehmer: alle aktiven Nutzer (auch Gäste ohne Login) mit Stand ihrer Daten. */
export async function ensureAttendances(tx: DbClient, meetingId: string) {
  const [users, existing] = await Promise.all([
    tx.user.findMany({ where: { active: true } }),
    tx.attendance.findMany({ where: { meetingId }, select: { userId: true } }),
  ]);
  const have = new Set(existing.map((e) => e.userId));
  const missing = users.filter((u) => !have.has(u.id));
  if (missing.length) {
    await tx.attendance.createMany({
      data: missing.map((u) => ({
        meetingId,
        userId: u.id,
        responseToken: newToken(),
        nameSnapshot: u.name,
        functionSnapshot: u.functionTitle,
        votingSnapshot: u.votingRight,
        sortSnapshot: u.sortOrder,
      })),
    });
  }
  return missing.length;
}

/** Protokolle, die in der nächsten Sitzung zu genehmigen sind (versendet, Weg „Sitzung“, noch nicht in einer TO). */
async function minutesAwaitingApproval(tx: DbClient) {
  const minutes = await tx.minutes.findMany({
    where: {
      isCurrent: true,
      status: "VERSENDET",
      OR: [{ approvalMode: "SITZUNG" }, { approvalMode: null }],
      approvalItems: { none: { meeting: { status: { in: ["GEPLANT", "EINGELADEN"] } } } },
    },
    include: { meeting: { select: { startsAt: true } } },
    orderBy: { meeting: { startsAt: "asc" } },
  });
  return minutes.map((m) => ({ id: m.id, meetingDate: m.meeting.startsAt }));
}

async function overdueTasksForAgenda(tx: DbClient) {
  const tasks = await tx.task.findMany({
    where: { status: { not: "ERLEDIGT" }, dueDate: { not: null } },
    include: { assignees: { include: { user: { select: { name: true } } } } },
  });
  const now = new Date();
  return tasks
    .filter((t) => isOverdue(t, now))
    .map((t) => ({ title: t.title, responsible: assigneeLabel(t), due: dueLabel(t) }));
}

/** Legt die TOP-Struktur an. Gibt die Anzahl der TOPs zurück. */
async function insertAgenda(tx: DbClient, meetingId: string, items: ReturnType<typeof buildDefaultAgenda>) {
  let pos = 0;
  for (const item of items) {
    pos += 10;
    const created = await tx.agendaItem.create({
      data: {
        meetingId,
        position: pos,
        title: item.title,
        kind: item.kind,
        description: item.description ?? "",
        minutesToApproveId: item.minutesToApproveId,
        topicId: item.topicId,
      },
    });
    let cpos = 0;
    for (const child of item.children) {
      cpos += 10;
      await tx.agendaItem.create({ data: { meetingId, parentId: created.id, position: cpos, title: child.title } });
    }
  }
  return items.length;
}

export async function createMeeting(actor: Actor, formData: FormData, opts: { previousMeetingId?: string } = {}) {
  assertCan(actor, "meeting.manage");
  const data = await parseMeetingForm(formData);
  const { source } = await getTemplateSource("tagesordnung.standard");
  const def = parseStandardAgenda(source);
  return db.$transaction(async (tx) => {
    const topics = await tx.topic.findMany({ where: { forNextMeeting: true }, select: { id: true, title: true } });
    const meeting = await tx.meeting.create({
      data: {
        ...data,
        createdById: actor.id,
        isRepeatAfterNoQuorum: !!opts.previousMeetingId,
        previousMeetingId: opts.previousMeetingId ?? null,
      },
    });
    const items = buildDefaultAgenda(def, {
      minutesToApprove: await minutesAwaitingApproval(tx),
      overdueTasks: await overdueTasksForAgenda(tx),
      topics,
    });
    await insertAgenda(tx, meeting.id, items);
    if (topics.length) {
      // „für nächste Sitzung“ ist damit erledigt; der Verlauf des Themas vermerkt die Aufnahme
      await tx.topic.updateMany({ where: { id: { in: topics.map((t) => t.id) } }, data: { forNextMeeting: false } });
      await tx.topicEvent.createMany({
        data: topics.map((t) => ({
          topicId: t.id,
          type: "SITZUNG" as const,
          text: `In die Tagesordnung der Sitzung am ${formatDate(meeting.startsAt)} aufgenommen.`,
          date: new Date(),
          authorId: actor.id,
        })),
      });
    }
    await ensureAttendances(tx, meeting.id);
    await audit(tx, actor, "meeting.create", "Meeting", meeting.id, { ...data, agenda: items.map((i) => i.title) });
    return meeting;
  });
}

export async function getMeeting(actor: Pick<User, "role">, id: string) {
  assertCan(actor, "read");
  const meeting = await db.meeting.findUnique({ where: { id }, include: meetingInclude });
  if (!meeting) throw new NotFoundError("Sitzung nicht gefunden.");
  return meeting;
}

export function isMeetingLocked(m: Pick<Meeting, "status">) {
  return m.status === "ABGESAGT" || m.status === "AUFGEHOBEN";
}

export async function updateMeeting(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "meeting.manage");
  const before = await getMeeting(actor, id);
  if (isMeetingLocked(before)) throw new UserError("Eine abgesagte oder aufgehobene Sitzung kann nicht mehr geändert werden.");
  const data = await parseMeetingForm(formData);
  await db.$transaction(async (tx) => {
    await tx.meeting.update({ where: { id }, data });
    await audit(tx, actor, "meeting.update", "Meeting", id, changes(before, data));
  });
}

export async function listMeetings(actor: Pick<User, "id" | "role">) {
  assertCan(actor, "read");
  const meetings = await db.meeting.findMany({
    orderBy: { startsAt: "desc" },
    include: {
      attendances: { where: { userId: actor.id }, select: { response: true } },
      _count: { select: { agendaItems: true } },
      minutes: { where: { isCurrent: true }, select: { status: true } },
    },
  });
  const now = Date.now();
  return {
    upcoming: meetings.filter((m) => m.startsAt.getTime() >= now - 6 * 3600_000 && !isMeetingLocked(m)).reverse(),
    past: meetings.filter((m) => !(m.startsAt.getTime() >= now - 6 * 3600_000 && !isMeetingLocked(m))),
  };
}

/** Letzte durchgeführte und nächste geplante Sitzung (Rhythmus-Warnung, Dashboard). */
export async function meetingRhythmData() {
  const [last, next] = await Promise.all([
    db.meeting.findFirst({
      where: { status: { in: ["DURCHGEFUEHRT", "EINGELADEN", "GEPLANT"] }, startsAt: { lte: new Date() } },
      orderBy: { startsAt: "desc" },
    }),
    db.meeting.findFirst({
      where: { status: { in: ["GEPLANT", "EINGELADEN"] }, startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  return { last, next };
}

// ---------------------------------------------------------------------------
// Tagesordnung
// ---------------------------------------------------------------------------

export function numberedAgenda(meeting: Pick<MeetingWithAgenda, "agendaItems">) {
  return numberAgenda(meeting.agendaItems);
}

async function assertAgendaEditable(actor: Actor, meetingId: string) {
  assertCan(actor, "meeting.manage");
  const m = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!m) throw new NotFoundError("Sitzung nicht gefunden.");
  if (isMeetingLocked(m)) throw new UserError("Die Tagesordnung dieser Sitzung ist gesperrt.");
  return m;
}

/** Position für einen neuen TOP vor „Termine“/„Sonstiges“ (bzw. am Ende). */
async function insertPosition(tx: DbClient, meetingId: string, parentId: string | null) {
  const siblings = await tx.agendaItem.findMany({ where: { meetingId, parentId }, orderBy: { position: "asc" } });
  if (!parentId) {
    const endIdx = siblings.findIndex((s) => s.kind === "TERMINE" || s.kind === "SONSTIGES");
    if (endIdx >= 0) {
      // Platz schaffen: alle ab endIdx um 10 nach hinten
      const insertAt = siblings[endIdx]!.position;
      for (const s of siblings.slice(endIdx)) await tx.agendaItem.update({ where: { id: s.id }, data: { position: s.position + 10 } });
      return insertAt;
    }
  }
  return (siblings.at(-1)?.position ?? 0) + 10;
}

const agendaItemSchema = z.object({
  title: requiredText(300),
  description: optionalText(5000),
  parentId: z.preprocess(emptyToUndefined, z.string().optional()),
});

export async function addAgendaItem(
  actor: Actor,
  meetingId: string,
  input: { title: string; description?: string; parentId?: string; topicId?: string; proposalId?: string; carriedOverFromId?: string },
  tx: DbClient = db,
) {
  await assertAgendaEditable(actor, meetingId);
  const v = agendaItemSchema.parse(input);
  if (v.parentId) {
    const parent = await tx.agendaItem.findUnique({ where: { id: v.parentId } });
    if (!parent || parent.meetingId !== meetingId || parent.parentId) throw new UserError("Unterpunkte nur unter einem TOP.");
  }
  const run = async (t: DbClient) => {
    const position = await insertPosition(t, meetingId, v.parentId ?? null);
    const item = await t.agendaItem.create({
      data: {
        meetingId,
        parentId: v.parentId ?? null,
        position,
        title: v.title,
        description: v.description ?? "",
        topicId: input.topicId,
        proposalId: input.proposalId,
        carriedOverFromId: input.carriedOverFromId,
      },
    });
    await audit(t, actor, "agenda.add", "Meeting", meetingId, { item: item.id, title: item.title });
    return item;
  };
  return tx === db ? db.$transaction(run) : run(tx);
}

export async function addAgendaItemFromForm(actor: Actor, meetingId: string, formData: FormData) {
  const raw = formToObject(formData);
  return addAgendaItem(actor, meetingId, {
    title: String(raw.title ?? ""),
    description: raw.description ? String(raw.description) : undefined,
    parentId: raw.parentId ? String(raw.parentId) : undefined,
  });
}

const updateItemSchema = z.object({
  title: requiredText(300),
  description: optionalText(5000),
  status: z.enum(AgendaItemStatus),
});

export async function updateAgendaItem(actor: Actor, itemId: string, formData: FormData) {
  const item = await db.agendaItem.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFoundError("TOP nicht gefunden.");
  await assertAgendaEditable(actor, item.meetingId);
  const v = updateItemSchema.parse(formToObject(formData));
  const data = { title: v.title, description: v.description ?? "", status: v.status };
  await db.$transaction(async (tx) => {
    await tx.agendaItem.update({ where: { id: itemId }, data });
    await audit(tx, actor, "agenda.update", "Meeting", item.meetingId, { item: itemId, ...changes(item, data) });
  });
}

/** Status eines TOPs (auch aus dem Live-Protokoll durch den Schriftführer). */
export async function setAgendaItemStatus(actor: Actor, itemId: string, status: AgendaItemStatus) {
  const item = await db.agendaItem.findUnique({ where: { id: itemId }, include: { meeting: true } });
  if (!item) throw new NotFoundError("TOP nicht gefunden.");
  // Admin oder Protokollführung
  if (!["ADMIN", "SCHRIFTFUEHRER"].includes(actor.role)) assertCan(actor, "meeting.manage");
  if (isMeetingLocked(item.meeting)) throw new UserError("Die Tagesordnung dieser Sitzung ist gesperrt.");
  const parsed = z.enum(AgendaItemStatus).parse(status);
  await db.$transaction(async (tx) => {
    await tx.agendaItem.update({ where: { id: itemId }, data: { status: parsed } });
    await audit(tx, actor, "agenda.status", "Meeting", item.meetingId, { item: itemId, status: [item.status, parsed] });
  });
}

export async function deleteAgendaItem(actor: Actor, itemId: string) {
  const item = await db.agendaItem.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFoundError("TOP nicht gefunden.");
  const meeting = await assertAgendaEditable(actor, item.meetingId);
  if (meeting.status !== "GEPLANT") {
    throw new UserError("Nach dem Versand der Einladung TOPs bitte absetzen statt löschen.");
  }
  await db.$transaction(async (tx) => {
    if (item.proposalId) await tx.agendaProposal.update({ where: { id: item.proposalId }, data: { status: "OFFEN" } });
    await tx.agendaItem.delete({ where: { id: itemId } });
    await audit(tx, actor, "agenda.delete", "Meeting", item.meetingId, { item: itemId, title: item.title });
  });
}

/** Neue Reihenfolge einer Ebene (TOPs oder Unterpunkte eines TOPs). */
export async function reorderAgenda(actor: Actor, meetingId: string, parentId: string | null, orderedIds: string[]) {
  await assertAgendaEditable(actor, meetingId);
  const ids = z.array(z.string()).max(200).parse(orderedIds);
  const siblings = await db.agendaItem.findMany({ where: { meetingId, parentId }, select: { id: true } });
  const known = new Set(siblings.map((s) => s.id));
  if (ids.length !== known.size || ids.some((i) => !known.has(i))) {
    throw new UserError("Die Tagesordnung hat sich inzwischen geändert. Bitte Seite neu laden.");
  }
  await db.$transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.agendaItem.update({ where: { id }, data: { position: (i + 1) * 10 } });
    await audit(tx, actor, "agenda.reorder", "Meeting", meetingId, { parentId, order: ids });
  });
}

/** Vorschläge für die TO: offene TO-Vorschläge und abgesetzte/vertagte TOPs früherer Sitzungen. */
export async function agendaSuggestions(meetingId: string) {
  const meeting = await db.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  const [proposals, carryOvers] = await Promise.all([
    db.agendaProposal.findMany({
      where: { status: "OFFEN", OR: [{ meetingId: null }, { meetingId }] },
      include: { proposedBy: { select: { name: true } }, _count: { select: { supporters: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.agendaItem.findMany({
      where: {
        status: { in: ["ABGESETZT", "VERTAGT"] },
        carryOverDismissed: false,
        carriedOverTo: { none: {} },
        meetingId: { not: meetingId },
        meeting: { startsAt: { lt: meeting.startsAt } },
      },
      include: { meeting: { select: { startsAt: true } } },
      orderBy: { meeting: { startsAt: "desc" } },
    }),
  ]);
  return { proposals, carryOvers };
}

export async function takeOverCarryOver(actor: Actor, meetingId: string, itemId: string) {
  const old = await db.agendaItem.findUnique({ where: { id: itemId } });
  if (!old) throw new NotFoundError("TOP nicht gefunden.");
  await addAgendaItem(actor, meetingId, {
    title: old.title,
    description: old.description,
    topicId: old.topicId ?? undefined,
    carriedOverFromId: old.id,
  });
}

export async function dismissCarryOver(actor: Actor, meetingId: string, itemId: string) {
  assertCan(actor, "meeting.manage");
  await db.$transaction(async (tx) => {
    await tx.agendaItem.update({ where: { id: itemId }, data: { carryOverDismissed: true } });
    await audit(tx, actor, "agenda.carryOverDismissed", "Meeting", meetingId, { item: itemId });
  });
}

// ---------------------------------------------------------------------------
// Zu-/Absagen
// ---------------------------------------------------------------------------

const rsvpSchema = z.object({ response: z.enum(["ZUGESAGT", "VIELLEICHT", "ABGESAGT"]), note: optionalText(1000) });

function assertCanRespond(meeting: Meeting) {
  if (isMeetingLocked(meeting)) throw new UserError("Diese Sitzung findet nicht statt.");
  if (meeting.startsAt.getTime() < Date.now()) throw new UserError("Die Sitzung hat bereits begonnen.");
}

export async function respondToMeeting(actor: Pick<User, "id" | "role">, meetingId: string, formData: FormData) {
  assertCan(actor, "meeting.respond");
  const v = rsvpSchema.parse(formToObject(formData));
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError("Sitzung nicht gefunden.");
  assertCanRespond(meeting);
  await db.$transaction(async (tx) => {
    await ensureAttendances(tx, meetingId);
    const att = await tx.attendance.update({
      where: { meetingId_userId: { meetingId, userId: actor.id } },
      data: { response: v.response, respondedAt: new Date(), note: v.note ?? "" },
    });
    await audit(tx, actor, "meeting.respond", "Meeting", meetingId, { attendance: att.id, response: v.response });
  });
}

export async function getAttendanceByToken(token: string) {
  if (!token || token.length < 20) return null;
  return db.attendance.findUnique({
    where: { responseToken: token },
    include: { meeting: { include: { agendaItems: { orderBy: { position: "asc" } } } }, user: { select: { name: true } } },
  });
}

/** Zu-/Absage über den persönlichen Link ohne Login (SPEC.md 3.2 Punkt 5). */
export async function respondByToken(token: string, formData: FormData) {
  const v = rsvpSchema.parse(formToObject(formData));
  const att = await getAttendanceByToken(token);
  if (!att) throw new UserError("Der Link ist ungültig.");
  assertCanRespond(att.meeting);
  await db.$transaction(async (tx) => {
    await tx.attendance.update({
      where: { id: att.id },
      data: { response: v.response, respondedAt: new Date(), note: v.note ?? "" },
    });
    await audit(tx, null, "meeting.respondByLink", "Meeting", att.meetingId, { attendance: att.id, response: v.response, note: v.note ? "ja" : "nein" });
  });
}

// ---------------------------------------------------------------------------
// Absage
// ---------------------------------------------------------------------------

export async function cancelMeeting(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "meeting.manage");
  const meeting = await getMeeting(actor, id);
  if (isMeetingLocked(meeting) || meeting.status === "DURCHGEFUEHRT") throw new UserError("Diese Sitzung kann nicht abgesagt werden.");
  const v = z.object({ cancelReason: optionalText(1000), notify: checkbox }).parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id },
      data: { status: "ABGESAGT", cancelReason: v.cancelReason ?? "", cancelledAt: new Date() },
    });
    await audit(tx, actor, "meeting.cancel", "Meeting", id, { reason: v.cancelReason, notify: v.notify });
  });
  // Absage nur an Eingeladene, sonst wusste niemand von der Sitzung
  if (v.notify && meeting.invitationSentAt) {
    const fresh = await getMeeting(actor, id);
    const ctx = { sitzung: await meetingContext(fresh), absender: await senderContext(actor.id) };
    const mail = await renderMail("sitzung.absage", ctx);
    const recipients = fresh.attendances.filter((a) => a.user.active).map((a) => a.user.email);
    for (const to of recipients) await queueMail({ to, subject: mail.subject, text: mail.text, html: mail.html });
  }
}

export function rsvpCounts(meeting: { attendances: { response: RsvpResponse }[] }) {
  const counts: Record<RsvpResponse, number> = { OFFEN: 0, ZUGESAGT: 0, VIELLEICHT: 0, ABGESAGT: 0 };
  for (const a of meeting.attendances) counts[a.response] += 1;
  return counts;
}
