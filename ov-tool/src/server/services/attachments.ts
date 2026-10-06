import "server-only";
import path from "node:path";
import type { User } from "@prisma/client";
import { sniffType } from "@/lib/file-types";
import { assertCan, can } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { deleteStoredFile, readStoredFile, saveFile } from "@/server/files";

// Anhänge (Fotos, Schreiben, Presseartikel) an Aktionen und Themen (SPEC.md 3.7/3.8).

export type OwnerType = "Action" | "Topic" | "Meeting";

const UPLOAD_CAP: Record<OwnerType, "action.create" | "topic.create" | "meeting.manage"> = {
  Action: "action.create",
  Topic: "topic.create",
  Meeting: "meeting.manage",
};
const EDIT_ALL: Record<OwnerType, "action.editAll" | "topic.editAll" | "meeting.manage"> = {
  Action: "action.editAll",
  Topic: "topic.editAll",
  Meeting: "meeting.manage",
};

/** Sitzungsunterlagen dürfen hochladen: Sitzungsverwaltung, Einladungsversand oder Protokollführung. */
function canManageMeetingFiles(actor: Pick<User, "role">) {
  return can(actor.role, "meeting.manage") || can(actor.role, "invitation.send") || can(actor.role, "minutes.edit");
}

const MAX_BYTES = 20 * 1024 * 1024;
const OFFICE: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
};

export function listAttachments(ownerType: OwnerType, ownerId: string) {
  return db.attachment.findMany({
    where: { ownerType, ownerId },
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { name: true } } },
  });
}

export async function addAttachment(
  actor: Pick<User, "id" | "role">,
  ownerType: OwnerType,
  ownerId: string,
  file: unknown,
  opts: { inInvitation?: boolean } = {},
) {
  if (ownerType === "Meeting") {
    if (!canManageMeetingFiles(actor)) throw new ForbiddenError();
  } else assertCan(actor, UPLOAD_CAP[ownerType]);
  if (!(file instanceof File) || file.size === 0) throw new UserError("Bitte eine Datei auswählen.");
  if (file.size > MAX_BYTES) throw new UserError("Die Datei ist größer als 20 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase();
  const sniffed = sniffType(data);
  const mime = sniffed ?? OFFICE[ext];
  if (!mime) throw new UserError("Erlaubt sind Bilder (PNG, JPEG, WebP), PDF sowie Word-, Excel-, PowerPoint- und Textdateien.");
  const rel = await saveFile(`attachments/${ownerType.toLowerCase()}/${ownerId}`, file.name, data);
  return db.$transaction(async (tx) => {
    const a = await tx.attachment.create({
      data: {
        ownerType,
        ownerId,
        filePath: rel,
        fileName: file.name.slice(0, 200),
        mimeType: mime,
        size: file.size,
        uploadedById: actor.id,
        inInvitation: ownerType === "Meeting" ? (opts.inInvitation ?? true) : false,
      },
    });
    await audit(tx, actor, "attachment.add", ownerType, ownerId, { attachmentId: a.id, fileName: a.fileName });
    return a;
  });
}

export async function deleteAttachment(actor: Pick<User, "id" | "role">, id: string) {
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a) throw new NotFoundError("Anhang nicht gefunden.");
  const type = a.ownerType as OwnerType;
  const allowed = type === "Meeting" ? canManageMeetingFiles(actor) : a.uploadedById === actor.id || can(actor.role, EDIT_ALL[type] ?? "topic.editAll");
  if (!allowed) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id } });
    await audit(tx, actor, "attachment.delete", a.ownerType, a.ownerId, { attachmentId: id, fileName: a.fileName });
  });
  await deleteStoredFile(a.filePath);
}

export async function readAttachment(actor: Pick<User, "id" | "role">, id: string) {
  assertCan(actor, "read");
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a) throw new NotFoundError("Anhang nicht gefunden.");
  return { attachment: a, data: await readStoredFile(a.filePath) };
}

// ---------------------------------------------------------------------------
// Sitzungsunterlagen (Einladung, letztes Protokoll, Vorlagen)
// ---------------------------------------------------------------------------

export { canManageMeetingFiles };

/** Mehrere Dateien auf einmal zu einer Sitzung hochladen. */
export async function addMeetingFiles(actor: Pick<User, "id" | "role">, meetingId: string, formData: FormData) {
  if (!canManageMeetingFiles(actor)) throw new ForbiddenError();
  if (!(await db.meeting.findUnique({ where: { id: meetingId }, select: { id: true } }))) throw new NotFoundError("Sitzung nicht gefunden.");
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new UserError("Bitte mindestens eine Datei auswählen.");
  if (files.length > 10) throw new UserError("Höchstens 10 Dateien auf einmal.");
  const inInvitation = formData.get("inInvitation") === "on";
  for (const f of files) await addAttachment(actor, "Meeting", meetingId, f, { inInvitation });
  return files.length;
}

export async function setInInvitation(actor: Pick<User, "id" | "role">, id: string, value: boolean) {
  if (!canManageMeetingFiles(actor)) throw new ForbiddenError();
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a || a.ownerType !== "Meeting") throw new NotFoundError("Unterlage nicht gefunden.");
  await db.$transaction(async (tx) => {
    await tx.attachment.update({ where: { id }, data: { inInvitation: value } });
    await audit(tx, actor, "attachment.invitation", "Meeting", a.ownerId, { attachmentId: id, inInvitation: value });
  });
}

/** Unterlagen, die mit der Einladung verschickt bzw. auf der Rückmeldeseite angeboten werden. */
export function invitationAttachments(meetingId: string) {
  return db.attachment.findMany({ where: { ownerType: "Meeting", ownerId: meetingId, inInvitation: true }, orderBy: { createdAt: "asc" } });
}

/** Download über den persönlichen Rückmelde-Link (Gäste ohne Login); nur für Unterlagen dieser Sitzung mit Freigabe. */
export async function readAttachmentByResponseToken(token: string, id: string) {
  if (!token || token.length < 20) return null;
  const att = await db.attendance.findUnique({ where: { responseToken: token }, select: { meetingId: true } });
  if (!att) return null;
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a || a.ownerType !== "Meeting" || a.ownerId !== att.meetingId || !a.inInvitation) return null;
  return { attachment: a, data: await readStoredFile(a.filePath) };
}

/** Das Protokoll der vorherigen Sitzung finden (aktuelle Version; bevorzugt versendet/genehmigt). */
export async function previousMinutesFor(meetingId: string) {
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, select: { startsAt: true } });
  if (!meeting) return null;
  return db.minutes.findFirst({
    where: { isCurrent: true, meeting: { startsAt: { lt: meeting.startsAt } } },
    orderBy: [{ meeting: { startsAt: "desc" } }],
    include: { meeting: { select: { startsAt: true } } },
  });
}

/** „Letztes Protokoll beifügen“: erzeugt das PDF des vorherigen Protokolls und legt es als Unterlage ab. */
export async function attachPreviousMinutes(actor: Pick<User, "id" | "role">, meetingId: string) {
  if (!canManageMeetingFiles(actor)) throw new ForbiddenError();
  const prev = await previousMinutesFor(meetingId);
  if (!prev) throw new UserError("Es gibt noch kein Protokoll einer früheren Sitzung im Tool. Bitte die Datei hochladen.");
  const { renderMinutesPdf } = await import("./minutes-export");
  const { pdf, filename } = await renderMinutesPdf(prev.id);
  const existing = await db.attachment.findFirst({ where: { ownerType: "Meeting", ownerId: meetingId, fileName: filename } });
  if (existing) throw new UserError(`„${filename}“ ist bereits beigefügt.`);
  const rel = await saveFile(`attachments/meeting/${meetingId}`, filename, pdf);
  return db.$transaction(async (tx) => {
    const a = await tx.attachment.create({
      data: { ownerType: "Meeting", ownerId: meetingId, filePath: rel, fileName: filename, mimeType: "application/pdf", size: pdf.length, uploadedById: actor.id, inInvitation: true },
    });
    await audit(tx, actor, "attachment.previousMinutes", "Meeting", meetingId, { attachmentId: a.id, minutesId: prev.id, status: prev.status });
    return { attachment: a, status: prev.status };
  });
}

// ---------------------------------------------------------------------------
// Notizen und Anhänge zu einzelnen TOPs – erscheinen im Protokoll, Anhänge als Anlage am Ende
// ---------------------------------------------------------------------------

/** Nach dem Versand ist das Protokoll gesperrt (CLAUDE.md Regel 9) – Änderungen nur über eine neue Version. */
async function assertMinutesOpen(meetingId: string) {
  const locked = await db.minutes.findFirst({ where: { meetingId, isCurrent: true, status: { in: ["VERSENDET", "GENEHMIGT"] } }, select: { id: true } });
  if (locked) throw new UserError("Das Protokoll ist bereits versendet. Notizen und Anlagen bitte über eine neue Protokollversion ändern.");
}

function canEditTopExtras(actor: Pick<User, "role">) {
  return canManageMeetingFiles(actor);
}

async function loadAgendaItem(agendaItemId: string) {
  const item = await db.agendaItem.findUnique({ where: { id: agendaItemId }, select: { id: true, meetingId: true, title: true } });
  if (!item) throw new NotFoundError("Tagesordnungspunkt nicht gefunden.");
  return item;
}

export async function saveAgendaItemNote(actor: Pick<User, "id" | "role">, agendaItemId: string, note: string) {
  if (!canEditTopExtras(actor)) throw new ForbiddenError();
  const text = note.replace(/\r\n/g, "\n").trim();
  if (text.length > 5000) throw new UserError("Die Notiz ist zu lang (höchstens 5000 Zeichen).");
  const item = await loadAgendaItem(agendaItemId);
  await assertMinutesOpen(item.meetingId);
  await db.$transaction(async (tx) => {
    const before = await tx.agendaItem.findUniqueOrThrow({ where: { id: agendaItemId }, select: { minutesNote: true } });
    if (before.minutesNote === text) return;
    await tx.agendaItem.update({ where: { id: agendaItemId }, data: { minutesNote: text } });
    await audit(tx, actor, "agendaItem.note", "AgendaItem", agendaItemId, { minutesNote: [before.minutesNote, text] });
  });
  return item;
}

/** Dateien zu einem TOP: Anlage zum Protokoll; optional auch mit der Einladung versenden. */
export async function addAgendaItemFiles(actor: Pick<User, "id" | "role">, agendaItemId: string, formData: FormData) {
  if (!canEditTopExtras(actor)) throw new ForbiddenError();
  const item = await loadAgendaItem(agendaItemId);
  await assertMinutesOpen(item.meetingId);
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new UserError("Bitte mindestens eine Datei auswählen.");
  if (files.length > 10) throw new UserError("Höchstens 10 Dateien auf einmal.");
  const inInvitation = formData.get("inInvitation") === "on";
  for (const f of files) {
    const a = await addAttachment(actor, "Meeting", item.meetingId, f, { inInvitation });
    await db.attachment.update({ where: { id: a.id }, data: { agendaItemId, inMinutes: true } });
  }
  return { count: files.length, meetingId: item.meetingId };
}

export async function deleteAgendaItemFile(actor: Pick<User, "id" | "role">, id: string) {
  const a = await db.attachment.findUnique({ where: { id }, select: { ownerId: true, agendaItemId: true } });
  if (!a?.agendaItemId) throw new NotFoundError("Anlage nicht gefunden.");
  await assertMinutesOpen(a.ownerId);
  await deleteAttachment(actor, id);
  return a.ownerId;
}

/** Notizen und Anlagen je TOP einer Sitzung. */
export async function agendaItemExtras(meetingId: string) {
  const [items, files] = await Promise.all([
    db.agendaItem.findMany({ where: { meetingId }, select: { id: true, minutesNote: true } }),
    db.attachment.findMany({ where: { ownerType: "Meeting", ownerId: meetingId, agendaItemId: { not: null } }, orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, size: true, inInvitation: true, agendaItemId: true } }),
  ]);
  const map: Record<string, { note: string; files: typeof files }> = {};
  for (const i of items) map[i.id] = { note: i.minutesNote, files: [] };
  for (const f of files) map[f.agendaItemId!]?.files.push(f);
  return map;
}
