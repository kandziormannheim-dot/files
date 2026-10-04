import "server-only";
import { LinkCategory, type User } from "@prisma/client";
import { looksLikeCredential, urlContainsCredentials } from "@/lib/credentials";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan, canEditOwned } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";

type Actor = Pick<User, "id" | "role">;

const linkSchema = z.object({
  title: requiredText(200),
  url: z.preprocess(
    (v) => (typeof v === "string" && v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
    z.url({ protocol: /^https?$/, error: "Bitte eine gültige Adresse angeben." }).max(2000),
  ),
  category: z.enum(LinkCategory),
  description: optionalText(1000),
  accessNote: optionalText(500),
  editorialNote: optionalText(1000),
});

function parseLink(formData: FormData) {
  const input = linkSchema.parse(formToObject(formData));
  if (urlContainsCredentials(input.url)) {
    throw new UserError("Die Adresse enthält Zugangsdaten. Bitte nur die Adresse ohne Benutzername/Passwort/Token speichern.");
  }
  for (const text of [input.description, input.accessNote, input.editorialNote]) {
    if (looksLikeCredential(text)) {
      throw new UserError("Bitte keine Passwörter oder Zugangsdaten speichern – nur, über wen der Zugang läuft.");
    }
  }
  return {
    ...input,
    description: input.description ?? "",
    accessNote: input.accessNote ?? "",
    editorialNote: input.editorialNote ?? "",
  };
}

export function listLinks(actor: Actor) {
  assertCan(actor, "read");
  return db.link.findMany({ orderBy: [{ category: "asc" }, { position: "asc" }, { title: "asc" }] });
}

export async function getLink(actor: Actor, id: string) {
  assertCan(actor, "read");
  const link = await db.link.findUnique({ where: { id } });
  if (!link) throw new NotFoundError("Link nicht gefunden.");
  return link;
}

export function canEditLink(actor: Actor, link: { createdById: string | null }) {
  return canEditOwned(actor.role, "link.manage", actor.id, [link.createdById]);
}

export async function createLink(actor: Actor, formData: FormData) {
  assertCan(actor, "link.create");
  const data = parseLink(formData);
  const last = await db.link.aggregate({ where: { category: data.category }, _max: { position: true } });
  return db.$transaction(async (tx) => {
    const link = await tx.link.create({
      data: { ...data, position: (last._max.position ?? 0) + 1, createdById: actor.id },
    });
    await audit(tx, actor, "link.create", "Link", link.id, data);
    return link;
  });
}

export async function updateLink(actor: Actor, id: string, formData: FormData) {
  const before = await getLink(actor, id);
  if (!canEditLink(actor, before)) throw new ForbiddenError();
  const data = parseLink(formData);
  return db.$transaction(async (tx) => {
    const link = await tx.link.update({ where: { id }, data });
    await audit(tx, actor, "link.update", "Link", id, changes(before, data));
    return link;
  });
}

export async function deleteLink(actor: Actor, id: string) {
  const before = await getLink(actor, id);
  if (!canEditLink(actor, before)) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.link.delete({ where: { id } });
    await audit(tx, actor, "link.delete", "Link", id, { title: before.title, url: before.url });
  });
}

/** Neue Reihenfolge innerhalb einer Kategorie (Drag & Drop, nur Admin). */
export async function reorderLinks(actor: Actor, category: LinkCategory, orderedIds: string[]) {
  assertCan(actor, "link.manage");
  const ids = z.array(z.string().min(1)).max(500).parse(orderedIds);
  const existing = await db.link.findMany({ where: { category }, select: { id: true } });
  const known = new Set(existing.map((l) => l.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new UserError("Die Liste hat sich inzwischen geändert. Bitte Seite neu laden.");
  }
  await db.$transaction(async (tx) => {
    for (const [index, id] of ids.entries()) await tx.link.update({ where: { id }, data: { position: index + 1 } });
    await audit(tx, actor, "link.reorder", "Link", null, { category, order: ids });
  });
}
