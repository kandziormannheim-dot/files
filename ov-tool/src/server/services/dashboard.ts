import "server-only";
import type { User } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { evaluate } from "./circulations";
import { invitationDeadline } from "./invitations";
import { meetingRhythmData, rsvpCounts } from "./meetings";
import { getSettings } from "./settings";
import { CONVENE_REQUEST_SUPPORTERS, meetingRhythm } from "./statute";
import { listTasks } from "./tasks";

export type Notice = { level: "warning" | "destructive" | "default"; text: string; href: string };

/** Alles für die Übersicht (SPEC.md 3.1) in einem Aufruf. */
export async function dashboardData(user: Pick<User, "id" | "role">) {
  const now = new Date();
  const [tasks, rhythmData, nextMeetings, actions, topics, links, myVotes, settings] = await Promise.all([
    listTasks(user, { view: "mine" }),
    meetingRhythmData(),
    db.meeting.findMany({
      where: { status: { in: ["GEPLANT", "EINGELADEN"] }, startsAt: { gt: new Date(now.getTime() - 6 * 3600_000) } },
      orderBy: { startsAt: "asc" },
      take: 2,
      include: { attendances: { select: { userId: true, response: true } }, _count: { select: { agendaItems: true } } },
    }),
    db.action.findMany({
      where: { startsAt: { gte: new Date(now.getTime() - 12 * 3600_000) }, status: { not: "ABGESAGT" } },
      orderBy: { startsAt: "asc" },
      take: 4,
      include: { shifts: { include: { signups: { select: { userId: true } } } } },
    }),
    db.topic.findMany({ orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, status: true, updatedAt: true, forNextMeeting: true } }),
    db.link.findMany({ orderBy: [{ category: "asc" }, { position: "asc" }], take: 8 }),
    db.circulationVote.findMany({
      where: { userId: user.id, vote: null, circulation: { status: "LAUFEND", deadline: { gt: now } } },
      include: { circulation: { select: { id: true, number: true, subject: true, deadline: true } } },
    }),
    getSettings(),
  ]);

  const notices: Notice[] = [];
  const nextMeeting = nextMeetings[0] ?? null;
  const myAttendance = nextMeeting?.attendances.find((a) => a.userId === user.id);
  if (nextMeeting && myAttendance?.response === "OFFEN" && nextMeeting.status === "EINGELADEN") {
    notices.push({ level: "default", text: `Bitte zu- oder absagen: ${meetingTitle(nextMeeting)}`, href: `/meetings/${nextMeeting.id}` });
  }
  for (const v of myVotes) {
    notices.push({
      level: "warning",
      text: `Ihre Stimme fehlt: Umlaufverfahren ${v.circulation.number} „${v.circulation.subject}“ (bis ${formatDate(v.circulation.deadline)})`,
      href: `/circulations/${v.circulation.id}`,
    });
  }

  if (can(user.role, "meeting.manage")) {
    const rhythm = meetingRhythm(rhythmData.last?.startsAt ?? null, !!rhythmData.next, now);
    if (rhythm?.warn) {
      notices.push({
        level: rhythm.overdue ? "destructive" : "warning",
        text: `Nächste Vorstandssitzung planen – spätestens bis ${formatDate(rhythm.dueBy)} (mindestens alle zwei Monate).`,
        href: "/meetings/new",
      });
    }
    for (const m of nextMeetings.filter((x) => x.status === "GEPLANT" && !x.isRepeatAfterNoQuorum)) {
      const d = await invitationDeadline(m, now);
      if (d.daysLeft <= settings.meeting.invitationWarnDays + 3) {
        notices.push({
          level: d.daysLeft < 0 ? "destructive" : "warning",
          text:
            d.daysLeft < 0
              ? `Ladungsfrist für ${meetingTitle(m)} abgelaufen – Versand nur noch als eilbedürftig.`
              : `Einladung zu ${meetingTitle(m)} bis ${formatDate(d.latestDay)} versenden.`,
          href: `/meetings/${m.id}/invitation`,
        });
      }
    }
    const conveneRequests = await db.agendaProposal.findMany({
      where: { status: "OFFEN", isConveneRequest: true },
      include: { _count: { select: { supporters: true } } },
    });
    for (const p of conveneRequests.filter((x) => x._count.supporters + 1 >= CONVENE_REQUEST_SUPPORTERS)) {
      notices.push({ level: "destructive", text: `Antrag auf Einberufung einer Sitzung: „${p.title}“`, href: "/meetings/proposals" });
    }
  }
  if (can(user.role, "circulation.manage")) {
    const running = await db.circulation.findMany({ where: { status: "LAUFEND" }, include: { votes: true } });
    for (const c of running) {
      const ev = evaluate(c, c.votes, now);
      if (ev.final) notices.push({ level: "warning", text: `Umlaufverfahren ${c.number}: Ergebnis feststellen.`, href: `/circulations/${c.id}` });
    }
  }
  if (can(user.role, "minutes.edit")) {
    const missing = await db.meeting.findMany({
      where: { startsAt: { lt: now }, status: { in: ["EINGELADEN", "DURCHGEFUEHRT"] }, minutes: { none: { status: { in: ["VERSENDET", "GENEHMIGT"] } } } },
      orderBy: { startsAt: "desc" },
      take: 3,
    });
    for (const m of missing) {
      notices.push({ level: "default", text: `Protokoll noch nicht versendet: ${meetingTitle(m)}`, href: `/meetings/${m.id}/minutes` });
    }
  }

  return {
    notices,
    tasks: tasks.slice(0, 8),
    taskCount: tasks.length,
    nextMeeting: nextMeeting
      ? { ...nextMeeting, myResponse: myAttendance?.response ?? null, counts: rsvpCounts(nextMeeting) }
      : null,
    actions: actions.map((a) => ({
      ...a,
      open: a.shifts.reduce((n, s) => n + Math.max(0, s.needed - s.signups.length), 0),
      mine: a.shifts.some((s) => s.signups.some((x) => x.userId === user.id)),
    })),
    topics,
    links,
  };
}
