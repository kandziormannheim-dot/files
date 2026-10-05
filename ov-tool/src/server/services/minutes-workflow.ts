import "server-only";
import { ApprovalMode, type User } from "@prisma/client";
import { formatDate, parseDateInput } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { formToObject, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { queueMail } from "@/server/mail/outbox";
import { readStoredFile } from "@/server/files";
import { minutesAttachments } from "./presentation";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { startCirculationRecord } from "./circulations";
import { assertCanSend, assertSendable, minutesMeetingInclude } from "./minutes";
import { circulationsToReport, minutesContext, renderMinutesPdf } from "./minutes-export";
import { getSettings } from "./settings";
import { meetingContext, senderContext } from "./template-context";

type Actor = Pick<User, "id" | "role" | "name">;

const sendSchema = z.object({
  approvalMode: z.enum(ApprovalMode),
  circulationDeadline: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Versand an Vorstand und Gäste (PDF). Danach ist der Inhalt gesperrt. Genehmigung in der Folgesitzung
 * (TOP wird automatisch aufgenommen) oder im Umlaufverfahren (startet sofort).
 */
export async function sendMinutes(actor: Actor, minutesId: string, formData: FormData) {
  assertCanSend(actor);
  const v = sendSchema.parse(formToObject(formData));
  const minutes = await db.minutes.findUnique({ where: { id: minutesId } });
  if (!minutes || !minutes.isCurrent) throw new NotFoundError("Protokoll nicht gefunden.");
  if (minutes.status !== "ENTWURF") throw new UserError("Das Protokoll wurde bereits versendet.");
  const meeting = await db.meeting.findUniqueOrThrow({ where: { id: minutes.meetingId }, include: minutesMeetingInclude });
  await assertSendable(minutes, meeting);
  if (v.approvalMode === "UMLAUF") assertCan(actor, "circulation.manage");

  const { pdf, version, filename } = await renderMinutesPdf(minutesId);
  const ctx = await minutesContext(minutes, meeting);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.minutes.update({
      where: { id: minutesId },
      data: { status: "VERSENDET", sentAt: now, approvalMode: v.approvalMode, templateVersion: version },
    });
    if (meeting.status === "GEPLANT" || meeting.status === "EINGELADEN") {
      await tx.meeting.update({ where: { id: meeting.id }, data: { status: "DURCHGEFUEHRT" } });
    }
    const reported = await circulationsToReport(meeting);
    if (reported.length) {
      await tx.circulation.updateMany({ where: { id: { in: reported.map((c) => c.id) } }, data: { reportedInMeetingId: meeting.id } });
    }
    await audit(tx, actor, "minutes.send", "Minutes", minutesId, { approvalMode: v.approvalMode, templateVersion: version });
  });

  const users = await db.user.findMany({ where: { active: true } });
  const mail = await renderMail("protokoll.versand", {
    sitzung: ctx.sitzung,
    protokoll: ctx.protokoll,
    aufgaben: ctx.aufgaben,
    absender: await senderContext(actor.id),
  });
  // Anlagen zum Protokoll (z. B. Sitzungspräsentation) mitschicken, solange die Mail klein genug bleibt
  const extra: { filename: string; content: Buffer; contentType: string }[] = [];
  let total = pdf.length;
  for (const a of await minutesAttachments(meeting.id)) {
    if (total + a.size > 12 * 1024 * 1024) break;
    extra.push({ filename: a.fileName, content: await readStoredFile(a.filePath), contentType: a.mimeType });
    total += a.size;
  }
  const attachments = [{ filename, content: pdf, contentType: "application/pdf" }, ...extra];
  for (const u of users) await queueMail({ to: u.email, subject: mail.subject, text: mail.text, html: mail.html, attachments });

  if (v.approvalMode === "UMLAUF") {
    const date = formatDate(meeting.startsAt);
    await startCirculationRecord(actor, {
      subject: `Genehmigung des Protokolls der ${ctx.sitzung.artGenitiv} vom ${date}`,
      text: `Der Vorstand genehmigt das Protokoll der ${ctx.sitzung.artGenitiv} vom ${date}${minutes.version > 1 ? ` (Version ${minutes.version})` : ""}.`,
      minutesId,
      deadline: v.circulationDeadline ? (parseDateInput(v.circulationDeadline) ?? undefined) : undefined,
      attachments,
    });
  }
  return users.length;
}

/** Übersendung der genehmigten Niederschrift an die Kreisgeschäftsstelle (LV-Satzung § 51 Abs. 3). */
export async function sendToOffice(actor: Actor, minutesId: string) {
  assertCanSend(actor);
  const settings = await getSettings();
  if (!settings.office.email) throw new UserError("Keine E-Mail-Adresse der Kreisgeschäftsstelle hinterlegt (Einstellungen).");
  const minutes = await db.minutes.findUnique({ where: { id: minutesId }, include: { meeting: true } });
  if (!minutes) throw new NotFoundError("Protokoll nicht gefunden.");
  if (minutes.status !== "GENEHMIGT") throw new UserError("Nur genehmigte Protokolle werden übersandt.");
  const { pdf, filename } = await renderMinutesPdf(minutesId);
  const mail = await renderMail("protokoll.geschaeftsstelle", {
    sitzung: await meetingContext(minutes.meeting),
    absender: await senderContext(actor.id),
  });
  await queueMail({
    to: settings.office.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
  });
  await db.$transaction(async (tx) => {
    await tx.minutes.update({ where: { id: minutesId }, data: { sentToOfficeAt: new Date() } });
    await audit(tx, actor, "minutes.sendToOffice", "Minutes", minutesId, { to: settings.office.email, meeting: meetingTitle(minutes.meeting) });
  });
}

/** Nach Genehmigung automatisch an die Geschäftsstelle, wenn so eingestellt. */
export async function autoSendToOffice(minutesId: string) {
  const settings = await getSettings();
  if (!settings.office.autoSend || !settings.office.email) return;
  const m = await db.minutes.findUnique({ where: { id: minutesId } });
  if (!m || m.status !== "GENEHMIGT" || m.sentToOfficeAt) return;
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (admin) await sendToOffice(admin, minutesId).catch((err) => console.error("[office] Übersendung fehlgeschlagen", err));
}

/** Genehmigte, noch nicht übersandte Protokolle automatisch übersenden (Einstellung „office.autoSend“). */
export async function autoSendPendingToOffice() {
  const settings = await getSettings();
  if (!settings.office.autoSend || !settings.office.email) return 0;
  const pending = await db.minutes.findMany({ where: { status: "GENEHMIGT", sentToOfficeAt: null, isCurrent: true } });
  for (const m of pending) await autoSendToOffice(m.id);
  return pending.length;
}

export function minutesLink(meetingId: string) {
  return `${appUrl()}/meetings/${meetingId}/minutes`;
}
