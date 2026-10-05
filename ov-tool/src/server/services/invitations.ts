import "server-only";
import type { User } from "@prisma/client";
import { berlinDayDiff, formatDate } from "@/lib/dates";
import { formToObject, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { readStoredFile } from "@/server/files";
import { renderDocumentPdf, renderDocumentPreview } from "@/server/pdf/render";
import { invitationAttachments } from "./attachments";

/** Obergrenze für Anhänge je Einladungsmail (viele Postfächer lehnen über ~20 MB ab). */
const MAX_MAIL_ATTACHMENT_BYTES = 12 * 1024 * 1024;
import { textToHtml } from "@/server/templates/engine";
import { ensureAttendances, getMeeting, isMeetingLocked, type MeetingWithAgenda } from "./meetings";
import { getSettings } from "./settings";
import { checkInvitation, latestInvitationDay } from "./statute";
import { agendaContext, meetingContext, senderContext } from "./template-context";

type Actor = Pick<User, "id" | "role">;

/** Platzhalter für den persönlichen Link; wird je Empfänger ersetzt. */
export const RSVP_MARKER = "[Zusage-Link]";

export function rsvpUrl(token: string) {
  return `${appUrl()}/rsvp/${token}`;
}

/** Klartext: Link zur Rückmeldeseite plus Direktlinks je Antwort. */
export function rsvpText(link: string, docs = 0) {
  return [
    link,
    `Zusage: ${link}?antwort=ja`,
    `Vielleicht: ${link}?antwort=vielleicht`,
    `Absage: ${link}?antwort=nein`,
    ...(docs ? [`Sitzungsunterlagen (${docs}) stehen dort ebenfalls zum Download bereit.`] : []),
  ].join("\n");
}

/** HTML-Mail: drei Knöpfe (Zusage/Vielleicht/Absage) im CDU-Design, darunter der Link für eine Nachricht. */
export function rsvpButtonsHtml(link: string, docs = 0) {
  const btn = (href: string, label: string, bg: string, fg: string) =>
    `<td style="padding:4px"><a href="${href}" style="display:inline-block;padding:12px 18px;border-radius:6px;background:${bg};color:${fg};font-weight:700;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:15px">${label}</a></td>`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 4px"><tr>${btn(`${link}?antwort=ja`, "✓ Ich komme", "#2d3c4b", "#ffffff")}${btn(`${link}?antwort=vielleicht`, "? Vielleicht", "#ffa600", "#1b191d")}${btn(`${link}?antwort=nein`, "✗ Ich kann nicht", "#ffffff;border:2px solid #2d3c4b", "#2d3c4b")}</tr></table><p style="margin:0 0 1em;font-size:13px;color:#2d3c4b">Rückmeldung mit Nachricht an den Vorstand${docs ? ` und Sitzungsunterlagen (${docs})` : ""}: <a href="${link}" style="color:#2d3c4b">${link}</a></p>`;
}

function mailKey(meeting: MeetingWithAgenda) {
  return meeting.isRepeatAfterNoQuorum ? "einladung.wiederholung" : "einladung.mail";
}

async function invitationContext(meeting: MeetingWithAgenda, opts: { withSignature: boolean; actorId: string }) {
  const previous = meeting.previousMeetingId
    ? await db.meeting.findUnique({ where: { id: meeting.previousMeetingId }, select: { startsAt: true } })
    : null;
  return {
    sitzung: { ...(await meetingContext(meeting)), zusageLink: RSVP_MARKER },
    tagesordnung: agendaContext(meeting.agendaItems),
    absender: await senderContext(opts.actorId, { withSignature: opts.withSignature }),
    vorherigeSitzung: previous ? { beginn: previous.startsAt } : undefined,
  };
}

/** Stand der Ladungsfrist für Anzeige und Erinnerung. */
export async function invitationDeadline(meeting: Pick<MeetingWithAgenda, "startsAt">, now = new Date()) {
  const s = await getSettings();
  const latestDay = latestInvitationDay(meeting.startsAt, s.meeting.noticeDays);
  return { noticeDays: s.meeting.noticeDays, latestDay, daysLeft: berlinDayDiff(now, latestDay) };
}

export async function invitationPreview(actor: Actor, meetingId: string) {
  assertCan(actor, "invitation.send");
  await ensureAttendances(db, meetingId);
  const meeting = await getMeeting(actor, meetingId);
  const settings = await getSettings();
  const activeAgenda = meeting.agendaItems.filter((i) => !i.parentId && i.status !== "ABGESETZT");
  const check = checkInvitation({
    now: new Date(),
    meetingStart: meeting.startsAt,
    noticeDays: settings.meeting.noticeDays,
    agendaItemCount: activeAgenda.length,
    urgent: meeting.urgent,
    urgencyReason: meeting.urgencyReason,
    isRepeatAfterNoQuorum: meeting.isRepeatAfterNoQuorum,
  });
  const ctx = await invitationContext(meeting, { withSignature: false, actorId: actor.id });
  const mail = await renderMail(mailKey(meeting), ctx);
  const recipients = meeting.attendances
    .filter((a) => a.user.active)
    .sort((a, b) => a.sortSnapshot - b.sortSnapshot || a.nameSnapshot.localeCompare(b.nameSnapshot))
    .map((a) => ({ id: a.id, name: a.nameSnapshot, email: a.user.email, invitedAt: a.invitedAt, role: a.user.role }));
  return {
    meeting,
    check,
    locked: isMeetingLocked(meeting),
    deadline: await invitationDeadline(meeting),
    subject: mail.subject,
    text: mail.text,
    recipients,
    sender: ctx.absender,
  };
}

export async function invitationPdf(actor: Pick<User, "id" | "role">, meetingId: string) {
  assertCan(actor, "read");
  const meeting = await getMeeting(actor, meetingId);
  const ctx = await invitationContext(meeting, { withSignature: true, actorId: actor.id });
  const { pdf, version } = await renderDocumentPdf("einladung.dokument", ctx, `Einladung ${formatDate(meeting.startsAt)}`);
  await audit(db, actor, "invitation.pdf", "Meeting", meetingId);
  return { pdf, version, filename: `Einladung-${meeting.startsAt.toISOString().slice(0, 10)}.pdf` };
}

/** Bildschirm-Vorschau der Einladung (gleiche Vorlage wie das PDF). */
export async function invitationPreviewHtml(actor: Pick<User, "id" | "role">, meetingId: string) {
  assertCan(actor, "read");
  const meeting = await getMeeting(actor, meetingId);
  const ctx = await invitationContext(meeting, { withSignature: true, actorId: actor.id });
  return renderDocumentPreview("einladung.dokument", ctx, "Einladung");
}

const sendSchema = z.object({
  subject: requiredText(300),
  text: z.string().trim().min(1).max(20_000),
  scope: z.enum(["all", "new"]).default("all"),
});

export async function sendInvitation(actor: Actor, meetingId: string, formData: FormData) {
  assertCan(actor, "invitation.send");
  const v = sendSchema.parse(formToObject(formData));
  if (!v.text.includes(RSVP_MARKER)) {
    throw new UserError(`Der Platzhalter ${RSVP_MARKER} fehlt im Text – dort wird der persönliche Zusage-Link eingesetzt.`);
  }
  const preview = await invitationPreview(actor, meetingId);
  if (preview.locked) throw new UserError("Die Sitzung ist abgesagt oder aufgehoben.");
  if (!preview.check.ok) throw new UserError(preview.check.reason);
  const recipients = preview.meeting.attendances.filter(
    (a) => a.user.active && (v.scope === "all" || !a.invitedAt),
  );
  if (!recipients.length) throw new UserError("Keine Empfänger.");

  const { pdf, version, filename } = await invitationPdf(actor, meetingId);
  // Unterlagen (z. B. letztes Protokoll) anhängen, solange die Mail klein genug bleibt; sonst nur über die Rückmeldeseite
  const docs = await invitationAttachments(meetingId);
  const docFiles: { filename: string; content: Buffer; contentType: string }[] = [];
  let total = pdf.length;
  for (const d of docs) {
    if (total + d.size > MAX_MAIL_ATTACHMENT_BYTES) break;
    docFiles.push({ filename: d.fileName, content: await readStoredFile(d.filePath), contentType: d.mimeType });
    total += d.size;
  }
  const now = new Date();
  const mailVersion = (await renderMail(mailKey(preview.meeting), {})).version;
  for (const a of recipients) {
    const link = rsvpUrl(a.responseToken);
    const text = v.text.replaceAll(RSVP_MARKER, rsvpText(link, docs.length));
    const html = textToHtml(v.text).replaceAll(RSVP_MARKER, `</p>${rsvpButtonsHtml(link, docs.length)}<p style="margin:0 0 1em">`).replace(/<p style="margin:0 0 1em">(<br>)*<\/p>/g, "");
    await queueMail({
      to: a.user.email,
      subject: v.subject,
      text,
      html,
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }, ...docFiles],
    });
  }
  await db.$transaction(async (tx) => {
    await tx.attendance.updateMany({ where: { id: { in: recipients.map((r) => r.id) } }, data: { invitedAt: now } });
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        status: preview.meeting.status === "GEPLANT" ? "EINGELADEN" : preview.meeting.status,
        // „Einladung vom …“ bleibt das Datum des ersten Versands
        invitationSentAt: preview.meeting.invitationSentAt ?? now,
        invitationTemplateVersion: version,
      },
    });
    await audit(tx, actor, "invitation.send", "Meeting", meetingId, {
      scope: v.scope,
      recipients: recipients.length,
      subject: v.subject,
      timely: preview.check.ok ? preview.check.timely : null,
      documentTemplateVersion: version,
      mailTemplateVersion: mailVersion,
      documents: docs.map((d) => d.fileName),
      documentsAttached: docFiles.length,
    });
  });
  return recipients.length;
}
