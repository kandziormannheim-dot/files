import "server-only";
import { randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { meetingTitle } from "@/lib/meetings";
import { ACTION_TYPE_LABELS } from "@/lib/labels";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { appUrl } from "@/server/ov";

// Persönlicher ICS-Feed: Sitzungen, Aktionen und eigene Schichten (SPEC.md 3.7). Token in der URL, widerrufbar.

export function icsUrl(token: string) {
  return `${appUrl()}/api/ics/${token}`;
}

export async function calendarForToken(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const user = await db.user.findUnique({ where: { icsToken: token } });
  if (!user || !user.active) return null;
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [meetings, actions, shifts] = await Promise.all([
    db.meeting.findMany({ where: { startsAt: { gte: since } }, orderBy: { startsAt: "asc" } }),
    db.action.findMany({ where: { startsAt: { gte: since } }, orderBy: { startsAt: "asc" } }),
    db.shiftSignup.findMany({ where: { userId: user.id, shift: { startsAt: { gte: since } } }, include: { shift: { include: { action: true } } } }),
  ]);
  const host = new URL(appUrl()).host;
  const events: IcsEvent[] = [
    ...meetings.map((m) => ({
      uid: `meeting-${m.id}@${host}`,
      start: m.startsAt,
      end: m.endsAt ?? new Date(m.startsAt.getTime() + 2 * 3600_000),
      summary: meetingTitle(m).replace(/ am \d\d\.\d\d\.\d{4}$/, ""),
      location: [m.location, m.onlineUrl].filter(Boolean).join(" · "),
      url: `${appUrl()}/meetings/${m.id}`,
      cancelled: m.status === "ABGESAGT" || m.status === "AUFGEHOBEN",
      updated: m.updatedAt,
    })),
    ...actions.map((a) => ({
      uid: `action-${a.id}@${host}`,
      start: a.startsAt,
      end: a.endsAt ?? new Date(a.startsAt.getTime() + 2 * 3600_000),
      summary: `${ACTION_TYPE_LABELS[a.type]}: ${a.title}`,
      location: a.location,
      url: `${appUrl()}/actions/${a.id}`,
      cancelled: a.status === "ABGESAGT",
      updated: a.updatedAt,
    })),
    ...shifts.map((s) => ({
      uid: `shift-${s.id}@${host}`,
      start: s.shift.startsAt,
      end: s.shift.endsAt,
      summary: `Meine Schicht: ${s.shift.action.title}`,
      location: s.shift.action.location,
      url: `${appUrl()}/actions/${s.shift.actionId}`,
      cancelled: s.shift.action.status === "ABGESAGT",
    })),
  ];
  return buildIcs("CDU Seckenheim-Friedrichsfeld", events);
}

/** Neuer Token – der alte Link funktioniert danach nicht mehr. */
export async function renewIcsToken(actor: Pick<User, "id">) {
  const token = randomBytes(24).toString("base64url");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { icsToken: token } });
    await audit(tx, actor, "user.icsRenew", "User", actor.id);
  });
  return token;
}
