import "server-only";
import type { User } from "@prisma/client";
import { berlinDayDiff, parseDateTimeInput } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { electionPeriodStatus } from "./elections";
import { invitationDeadline } from "./invitations";

// Fristenradar (SPEC.md 3.17): Fristen aus allen Modulen plus externe Fristen in einer Liste.

type Actor = Pick<User, "id" | "role">;

export type RadarItem = { date: Date; title: string; source: string; href: string; daysLeft: number; level: "default" | "warning" | "destructive"; id?: string };

const HORIZON_DAYS = 60;

function level(daysLeft: number, warn = 7): RadarItem["level"] {
  return daysLeft < 0 ? "destructive" : daysLeft <= warn ? "warning" : "default";
}

export async function deadlineRadar(actor: Actor, now = new Date()): Promise<RadarItem[]> {
  assertCan(actor, "read");
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
  const [tasks, circulations, meetings, external, embargo, elections] = await Promise.all([
    db.task.findMany({ where: { status: { not: "ERLEDIGT" }, dueDate: { not: null, lte: horizon } }, select: { id: true, title: true, dueDate: true }, orderBy: { dueDate: "asc" }, take: 30 }),
    db.circulation.findMany({ where: { status: "LAUFEND" }, select: { id: true, number: true, subject: true, deadline: true } }),
    db.meeting.findMany({ where: { status: "GEPLANT", isRepeatAfterNoQuorum: false, startsAt: { gt: now, lte: horizon } } }),
    db.deadline.findMany({ where: { dueAt: { gte: new Date(now.getTime() - 7 * 86_400_000), lte: new Date(now.getTime() + 365 * 86_400_000) } }, orderBy: { dueAt: "asc" } }),
    db.pressRelease.findMany({ where: { status: { not: "ENTWURF" }, embargoUntil: { gt: now, lte: horizon } }, select: { id: true, title: true, embargoUntil: true } }),
    db.election.findMany({ where: { status: { not: "ABGESCHLOSSEN" }, date: { gt: now, lte: horizon } }, select: { id: true, title: true, date: true } }),
  ]);
  const items: RadarItem[] = [];
  const push = (date: Date, title: string, source: string, href: string, warn = 7, id?: string) => {
    const daysLeft = berlinDayDiff(now, date);
    items.push({ date, title, source, href, daysLeft, level: level(daysLeft, warn), id });
  };
  for (const t of tasks) push(t.dueDate!, t.title, "Aufgabe", `/tasks/${t.id}`, 3);
  for (const c of circulations) push(c.deadline, `Umlauf ${c.number}: ${c.subject}`, "Umlaufverfahren", `/circulations/${c.id}`, 2);
  for (const m of meetings) {
    const d = await invitationDeadline(m, now);
    push(d.latestDay, `Einladung ${meetingTitle(m)}`, "Ladungsfrist", `/meetings/${m.id}/invitation`, 3);
  }
  for (const e of elections) {
    // Einladung zur Mitgliederversammlung spätestens am 8. Tag vorher (LV § 50 Abs. 2)
    push(new Date(e.date.getTime() - 8 * 86_400_000), `Einladung ${e.title} (8 Tage)`, "Mitgliederversammlung", `/elections/${e.id}`, 7);
    push(e.date, e.title, "Wahl", `/elections/${e.id}`, 7);
  }
  for (const p of embargo) push(p.embargoUntil!, `Sperrfrist: ${p.title}`, "Presse", `/press/${p.id}`, 1);
  for (const x of external) {
    const daysLeft = berlinDayDiff(now, x.dueAt);
    if (daysLeft > x.warnDays && x.dueAt > horizon) continue;
    push(x.dueAt, x.title, "Externe Frist", "/deadlines", x.warnDays, x.id);
  }
  const period = await electionPeriodStatus(now);
  if (period?.warn) push(period.dueBy, "Vorstandswahl spätestens (Wahlperiode)", "Wahlperiode", "/elections", 120);
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function listDeadlines(actor: Actor) {
  assertCan(actor, "read");
  return db.deadline.findMany({ orderBy: { dueAt: "asc" } });
}

const deadlineSchema = z.object({
  title: requiredText(300),
  dueAt: z.string().transform((v, ctx) => {
    const d = parseDateTimeInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Bitte Datum und Uhrzeit angeben." });
    return d as Date;
  }),
  warnDays: z.coerce.number().int().min(0).max(365),
  note: optionalText(1000),
});

export async function createDeadline(actor: Actor, formData: FormData) {
  assertCan(actor, "deadline.manage");
  const input = deadlineSchema.parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    const d = await tx.deadline.create({ data: { ...input, note: input.note ?? "", createdById: actor.id } });
    await audit(tx, actor, "deadline.create", "Deadline", d.id, { title: d.title, dueAt: d.dueAt });
  });
}

export async function deleteDeadline(actor: Actor, id: string) {
  assertCan(actor, "deadline.manage");
  await db.$transaction(async (tx) => {
    const d = await tx.deadline.findUnique({ where: { id } });
    if (!d) throw new NotFoundError();
    await tx.deadline.delete({ where: { id } });
    await audit(tx, actor, "deadline.delete", "Deadline", id, { title: d.title });
  });
}

/** Kennzahlen des laufenden Jahres (SPEC.md 3.11). */
export async function yearFigures(actor: Actor, now = new Date()) {
  assertCan(actor, "read");
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [meetings, resolutions, tasksDone, tasksAll, releases, clippings, submissions, topicsOpen] = await Promise.all([
    db.meeting.count({ where: { startsAt: { gte: start, lte: now }, status: { in: ["DURCHGEFUEHRT", "EINGELADEN"] } } }),
    db.resolution.count({ where: { createdAt: { gte: start } } }),
    db.task.count({ where: { createdAt: { gte: start }, status: "ERLEDIGT" } }),
    db.task.count({ where: { createdAt: { gte: start } } }),
    db.pressRelease.count({ where: { publishedAt: { gte: start } } }),
    db.pressClipping.count({ where: { publishedOn: { gte: start } } }),
    can(actor.role, "landing.publish") ? db.landingSubmission.count({ where: { createdAt: { gte: start } } }) : Promise.resolve(null),
    db.topic.count({ where: { status: { notIn: ["ERLEDIGT", "ZURUECKGESTELLT"] } } }),
  ]);
  return { year: now.getUTCFullYear(), meetings, resolutions, taskRate: tasksAll ? Math.round((tasksDone / tasksAll) * 100) : null, releases, clippings, submissions, topicsOpen };
}


