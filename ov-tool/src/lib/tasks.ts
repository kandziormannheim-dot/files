// Reine Hilfsfunktionen für Aufgaben (ohne DB), damit sie in UI, Jobs und Tests gleich rechnen.
import type { AssigneeGroup, TaskStatus } from "@prisma/client";
import { berlinDayDiff, formatDate } from "./dates";

type DueTask = { dueDate: Date | null; dueText?: string | null; status: TaskStatus };

/** Überfällig: Frist-Datum liegt vor dem heutigen Kalendertag (Berlin) und nicht erledigt. */
export function isOverdue(task: DueTask, now = new Date()): boolean {
  if (!task.dueDate || task.status === "ERLEDIGT") return false;
  return berlinDayDiff(task.dueDate, now) > 0;
}

/** Tage bis zur Frist (negativ = überfällig), null ohne Datum. */
export function daysUntilDue(task: DueTask, now = new Date()): number | null {
  if (!task.dueDate) return null;
  return berlinDayDiff(now, task.dueDate);
}

export function dueLabel(task: { dueDate: Date | null; dueText?: string | null }): string {
  if (task.dueDate) return formatDate(task.dueDate);
  return task.dueText?.trim() || "";
}

export const GROUP_LABEL: Record<AssigneeGroup, string> = { KEINE: "", VORSTAND: "Vorstand", ALLE: "alle" };

/** „Kelsch, Kandzior“ bzw. „Vorstand“ – Gruppe zuerst, dann Personen. */
export function assigneeLabel(task: { assigneeGroup: AssigneeGroup; assignees: { user: { name: string } }[] }): string {
  const parts = [GROUP_LABEL[task.assigneeGroup], ...task.assignees.map((a) => a.user.name)].filter(Boolean);
  return parts.join(", ");
}

/** Überfällige zuerst, dann nach Frist, ohne Frist zuletzt, Erledigte ganz unten. */
export function compareTasks(a: DueTask & { createdAt: Date }, b: DueTask & { createdAt: Date }, now = new Date()) {
  const done = Number(a.status === "ERLEDIGT") - Number(b.status === "ERLEDIGT");
  if (done) return done;
  const overdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
  if (overdue) return overdue;
  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OFFEN: "offen",
  IN_ARBEIT: "in Arbeit",
  ERLEDIGT: "erledigt",
};
