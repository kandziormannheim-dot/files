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

export type OwnerType = "Action" | "Topic";

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

export async function addAttachment(actor: Pick<User, "id" | "role">, ownerType: OwnerType, ownerId: string, file: unknown) {
  assertCan(actor, ownerType === "Action" ? "action.create" : "topic.create");
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
      data: { ownerType, ownerId, filePath: rel, fileName: file.name.slice(0, 200), mimeType: mime, size: file.size, uploadedById: actor.id },
    });
    await audit(tx, actor, "attachment.add", ownerType, ownerId, { attachmentId: a.id, fileName: a.fileName });
    return a;
  });
}

export async function deleteAttachment(actor: Pick<User, "id" | "role">, id: string) {
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a) throw new NotFoundError("Anhang nicht gefunden.");
  const editAll = a.ownerType === "Action" ? "action.editAll" : "topic.editAll";
  if (a.uploadedById !== actor.id && !can(actor.role, editAll)) throw new ForbiddenError();
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
