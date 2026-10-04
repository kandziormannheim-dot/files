import "server-only";
import { Prisma, type Role, type User } from "@prisma/client";
import { berlinDayDiff } from "@/lib/dates";
import { daysUntilDue, isOverdue } from "@/lib/tasks";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { deleteStoredFile } from "@/server/files";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { tally } from "@/server/services/circulations";
import { rsvpUrl } from "@/server/services/invitations";
import { autoSendPendingToOffice } from "@/server/services/minutes-workflow";
import { getSettingsUncached } from "@/server/services/settings";
import { latestInvitationDay } from "@/server/services/statute";
import { meetingContext, senderContext } from "@/server/services/template-context";
import { originText, taskInclude } from "@/server/services/tasks";

// Hintergrundaufgaben (Paket 2.1). Jede Funktion ist idempotent (Merker in der DB) und bekommt „jetzt“ übergeben,
// damit sie testbar ist.

const BOARD_ROLES: Role[] = ["ADMIN", "SCHRIFTFUEHRER", "VORSTAND"];

async function groupRecipients(group: "VORSTAND" | "ALLE"): Promise<Pick<User, "id" | "name" | "email">[]> {
  return db.user.findMany({
    where: { active: true, ...(group === "VORSTAND" ? { role: { in: BOARD_ROLES } } : {}) },
    select: { id: true, name: true, email: true },
  });
}

/** Aufgaben-Erinnerung: X Tage vor Frist und bei Überfälligkeit (SPEC.md 3.5, nur bei Datum). */
export async function sendTaskReminders(now = new Date()) {
  const s = await getSettingsUncached();
  const tasks = await db.task.findMany({
    where: { status: { not: "ERLEDIGT" }, dueDate: { not: null } },
    include: taskInclude,
  });
  let sent = 0;
  for (const task of tasks) {
    const days = daysUntilDue(task, now);
    const overdue = isOverdue(task, now);
    const before = !overdue && days !== null && days >= 0 && days <= s.task.reminderDaysBefore && !task.remindedBeforeAt;
    const late = overdue && s.task.overdueReminder && !task.remindedOverdueAt;
    if (!before && !late) continue;
    const people = new Map<string, Pick<User, "id" | "name" | "email">>();
    for (const a of task.assignees) if (a.user.active) people.set(a.user.id, a.user);
    if (task.assigneeGroup !== "KEINE") for (const u of await groupRecipients(task.assigneeGroup)) people.set(u.id, u);
    for (const u of people.values()) {
      const mail = await renderMail("aufgabe.erinnerung", {
        empfaenger: { name: u.name },
        aufgabe: {
          titel: task.title,
          frist: task.dueDate,
          ueberfaellig: overdue,
          herkunft: originText(task),
          link: `${appUrl()}/tasks/${task.id}`,
        },
      });
      await queueMail({ to: u.email, subject: mail.subject, text: mail.text, html: mail.html });
      sent += 1;
    }
    await db.task.update({ where: { id: task.id }, data: overdue ? { remindedOverdueAt: now } : { remindedBeforeAt: now } });
  }
  return sent;
}

/** Erinnerung Zu-/Absage an alle ohne Rückmeldung, X Tage vor der Sitzung. */
export async function sendRsvpReminders(now = new Date()) {
  const s = await getSettingsUncached();
  const meetings = await db.meeting.findMany({
    where: { status: "EINGELADEN", startsAt: { gt: now }, rsvpReminderSentAt: null },
    include: { attendances: { where: { response: "OFFEN" }, include: { user: true } } },
  });
  let sent = 0;
  for (const m of meetings) {
    if (berlinDayDiff(now, m.startsAt) > s.meeting.rsvpReminderDaysBefore) continue;
    const base = { sitzung: await meetingContext(m), absender: await senderContext() };
    for (const a of m.attendances.filter((x) => x.user.active)) {
      const mail = await renderMail("erinnerung.zusage", {
        ...base,
        empfaenger: { name: a.user.name },
        sitzung: { ...base.sitzung, zusageLink: rsvpUrl(a.responseToken) },
      });
      await queueMail({ to: a.user.email, subject: mail.subject, text: mail.text, html: mail.html });
      sent += 1;
    }
    await db.meeting.update({ where: { id: m.id }, data: { rsvpReminderSentAt: now } });
    await audit(db, null, "meeting.rsvpReminder", "Meeting", m.id, { recipients: m.attendances.length });
  }
  return sent;
}

/** Hinweis an Admins, wenn die Ladungsfrist naht und die Einladung noch nicht raus ist (SPEC.md 3.2 Punkt 4). */
export async function sendInvitationDeadlineWarnings(now = new Date()) {
  const s = await getSettingsUncached();
  const meetings = await db.meeting.findMany({
    where: { status: "GEPLANT", invitationSentAt: null, invitationWarningSentAt: null, isRepeatAfterNoQuorum: false, startsAt: { gt: now } },
  });
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true } });
  let sent = 0;
  for (const m of meetings) {
    const lastDay = latestInvitationDay(m.startsAt, s.meeting.noticeDays);
    if (berlinDayDiff(now, lastDay) > s.meeting.invitationWarnDays) continue;
    const mail = await renderMail("ladungsfrist.hinweis", {
      sitzung: await meetingContext(m),
      frist: { letzterTag: lastDay, link: `${appUrl()}/meetings/${m.id}/invitation` },
    });
    for (const a of admins) {
      await queueMail({ to: a.email, subject: mail.subject, text: mail.text, html: mail.html });
      sent += 1;
    }
    await db.meeting.update({ where: { id: m.id }, data: { invitationWarningSentAt: now } });
  }
  return sent;
}

/** Nach Fristablauf eines Umlaufverfahrens die Admins auffordern, das Ergebnis festzustellen. */
export async function sendCirculationDeadlineNotices(now = new Date()) {
  const list = await db.circulation.findMany({
    where: { status: "LAUFEND", deadline: { lt: now }, deadlineNotifiedAt: null },
    include: { votes: true },
  });
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true } });
  for (const c of list) {
    const t = tally(c, c.votes);
    const mail = await renderMail("umlauf.frist", {
      umlauf: {
        nummer: c.number,
        betreff: c.subject,
        frist: c.deadline,
        link: `${appUrl()}/circulations/${c.id}`,
        ja: t.yes,
        nein: t.no,
        enthaltung: t.abstain,
        widerspruch: t.objections,
        ohneRueckmeldung: t.eligible - t.yes - t.no - t.abstain - t.objections,
      },
    });
    for (const a of admins) await queueMail({ to: a.email, subject: mail.subject, text: mail.text, html: mail.html });
    await db.circulation.update({ where: { id: c.id }, data: { deadlineNotifiedAt: now } });
  }
  return list.length;
}

/**
 * Löschfristen (CLAUDE.md Regel 6, SPEC.md 3.4/3.8): Audio nach Transkription, Transkripttext nach Genehmigung
 * des Protokolls bzw. spätestens nach X Tagen, Bürgerkontaktdaten X Monate nach Erledigung.
 */
export async function enforceRetention(now = new Date()) {
  const s = await getSettingsUncached();
  let audio = 0;
  let texts = 0;
  let contacts = 0;

  // Audio, das nicht mehr gebraucht wird (transkribiert, oder Fehler älter als 7 Tage)
  const withAudio = await db.transcript.findMany({ where: { filePath: { not: null } } });
  for (const t of withAudio) {
    const done = t.text !== null && t.status !== "HOCHGELADEN" && t.status !== "TRANSKRIPTION";
    const staleError = t.status === "FEHLER" && now.getTime() - t.createdAt.getTime() > 7 * 86_400_000;
    if (!done && !staleError) continue;
    await deleteStoredFile(t.filePath);
    await db.transcript.update({ where: { id: t.id }, data: { filePath: null, audioDeletedAt: now } });
    audio += 1;
  }

  const withText = await db.transcript.findMany({
    where: { textDeletedAt: null, OR: [{ text: { not: null } }, { draft: { not: Prisma.DbNull } }] },
    include: { meeting: { include: { minutes: { where: { isCurrent: true }, select: { status: true } } } } },
  });
  for (const t of withText) {
    const approved = t.meeting.minutes.some((m) => m.status === "GENEHMIGT");
    const expired = now.getTime() - t.createdAt.getTime() > s.retention.transcriptDays * 86_400_000;
    if (!approved && !expired) continue;
    await db.transcript.update({ where: { id: t.id }, data: { text: null, draft: Prisma.DbNull, textDeletedAt: now } });
    await audit(db, null, "transcript.retention", "Transcript", t.id, { reason: approved ? "Protokoll genehmigt" : "Frist abgelaufen" });
    texts += 1;
  }

  const topics = await db.topic.findMany({
    where: { citizenContact: { not: null }, contactDeleteAfter: { lt: now } },
    select: { id: true },
  });
  for (const t of topics) {
    await db.topic.update({ where: { id: t.id }, data: { citizenContact: null, contactDeletedAt: now } });
    await audit(db, null, "topic.contactRetention", "Topic", t.id);
    contacts += 1;
  }
  return { audio, texts, contacts };
}

export async function runOfficeAutoSend() {
  return autoSendPendingToOffice();
}
