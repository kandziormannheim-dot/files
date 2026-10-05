import "server-only";
import type { Prisma, User } from "@prisma/client";
import { formatInventoryCode, MAX_INVENTORY_NUMBER, parseInventoryCode } from "@/lib/inventory-code";
import { parseDateInput } from "@/lib/dates";
import { formToObject, optionalInt, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { deleteStoredFile, saveFile } from "@/server/files";
import { normalizePhoto } from "@/server/images";

type Actor = Pick<User, "id" | "role">;

export const CONDITIONS = ["neu", "gut", "gebraucht", "reparaturbedürftig", "defekt"] as const;

export type InventoryFilter = { q?: string; status?: "all" | "lager" | "verliehen" | "ausgemustert"; location?: string };

export function listItems(actor: Actor, filter: InventoryFilter = {}) {
  assertCan(actor, "read");
  const q = filter.q?.trim();
  const where: Prisma.InventoryItemWhereInput = {
    ...(filter.status === "ausgemustert" ? { retiredAt: { not: null } } : filter.status === "all" ? {} : { retiredAt: null }),
    ...(filter.status === "verliehen" ? { lentTo: { not: null } } : filter.status === "lager" ? { lentTo: null } : {}),
    ...(filter.location ? { location: filter.location } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q.toUpperCase() } },
            { location: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { lentTo: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.inventoryItem.findMany({ where, orderBy: [{ name: "asc" }, { number: "asc" }] });
}

export async function inventoryFacets(actor: Actor) {
  assertCan(actor, "read");
  const [locations, categories, stats] = await Promise.all([
    db.inventoryItem.findMany({ where: { location: { not: "" } }, distinct: ["location"], select: { location: true }, orderBy: { location: "asc" } }),
    db.inventoryItem.findMany({ where: { category: { not: "" } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    db.inventoryItem.groupBy({ by: ["retiredAt"], _count: true, where: { retiredAt: null } }),
  ]);
  const lent = await db.inventoryItem.count({ where: { retiredAt: null, lentTo: { not: null } } });
  const overdue = await db.inventoryItem.count({ where: { retiredAt: null, lentTo: { not: null }, lentDueAt: { lt: new Date() } } });
  return {
    locations: locations.map((l) => l.location),
    categories: categories.map((c) => c.category),
    total: stats.reduce((n, s) => n + s._count, 0),
    lent,
    overdue,
  };
}

export async function getItem(actor: Actor, id: string) {
  assertCan(actor, "read");
  const item = await db.inventoryItem.findUnique({
    where: { id },
    include: { loans: { orderBy: { lentAt: "desc" }, take: 50, include: { createdBy: { select: { name: true } } } }, createdBy: { select: { name: true } } },
  });
  if (!item) throw new NotFoundError("Gegenstand nicht gefunden.");
  return item;
}

export async function findByCode(actor: Actor, input: string) {
  assertCan(actor, "read");
  const parsed = parseInventoryCode(input);
  if (!parsed) return null;
  return db.inventoryItem.findUnique({ where: { code: parsed.code } });
}

export async function nextFreeNumber(): Promise<number> {
  const max = await db.inventoryItem.aggregate({ _max: { number: true } });
  return (max._max.number ?? 0) + 1;
}

const currentYear = () => new Date().getFullYear();

const itemSchema = z.object({
  name: requiredText(150),
  description: optionalText(2000),
  category: optionalText(80),
  location: optionalText(150),
  quantity: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(1).max(10_000)),
  condition: z.enum(CONDITIONS),
  notes: optionalText(2000),
});

const createSchema = itemSchema.extend({
  number: optionalInt.pipe(z.number().int().min(1).max(MAX_INVENTORY_NUMBER).optional()),
  acquiredYear: z.coerce.number().int().min(1950, { error: "Bitte das Anschaffungsjahr vierstellig angeben." }).max(2100),
});

function photoFrom(formData: FormData) {
  const f = formData.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
}

async function storePhoto(itemId: string, file: File) {
  return saveFile(`inventory/${itemId}`, "foto.webp", await normalizePhoto(file));
}

export async function createItem(actor: Actor, formData: FormData) {
  assertCan(actor, "inventory.edit");
  const input = createSchema.parse(formToObject(formData));
  if (input.acquiredYear > currentYear()) throw new UserError("Das Anschaffungsjahr liegt in der Zukunft.");
  const photo = photoFrom(formData);
  const photoBuf = photo ? await normalizePhoto(photo) : null; // vor dem Anlegen prüfen
  const number = input.number ?? (await nextFreeNumber());
  if (await db.inventoryItem.findUnique({ where: { number } })) {
    throw new UserError(`Die Nummer ${String(number).padStart(5, "0")} ist bereits vergeben. Nächste freie Nummer: ${await nextFreeNumber()}.`);
  }
  const code = formatInventoryCode(number, input.acquiredYear);
  const item = await db.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        number,
        acquiredYear: input.acquiredYear,
        code,
        name: input.name,
        description: input.description ?? "",
        category: input.category ?? "",
        location: input.location ?? "",
        quantity: input.quantity,
        condition: input.condition,
        notes: input.notes ?? "",
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "inventory.create", "InventoryItem", created.id, { code, name: created.name });
    return created;
  });
  if (photoBuf) {
    const rel = await saveFile(`inventory/${item.id}`, "foto.webp", photoBuf);
    await db.inventoryItem.update({ where: { id: item.id }, data: { photoPath: rel } });
  }
  return item;
}

/** Nummer und Anschaffungsjahr (und damit der Code) bleiben fest – sonst passen gedruckte Etiketten nicht mehr. */
export async function updateItem(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "inventory.edit");
  const before = await getItem(actor, id);
  const input = itemSchema.parse(formToObject(formData));
  const data = {
    name: input.name,
    description: input.description ?? "",
    category: input.category ?? "",
    location: input.location ?? "",
    quantity: input.quantity,
    condition: input.condition,
    notes: input.notes ?? "",
  };
  const photo = photoFrom(formData);
  const newPhoto = photo ? await storePhoto(id, photo) : null;
  await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id }, data: { ...data, ...(newPhoto ? { photoPath: newPhoto } : {}) } });
    await audit(tx, actor, "inventory.update", "InventoryItem", id, { ...changes(before, data), ...(newPhoto ? { photo: "ersetzt" } : {}) });
  });
  if (newPhoto) await deleteStoredFile(before.photoPath);
}

export async function removePhoto(actor: Actor, id: string) {
  assertCan(actor, "inventory.edit");
  const item = await getItem(actor, id);
  await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id }, data: { photoPath: null } });
    await audit(tx, actor, "inventory.update", "InventoryItem", id, { photo: "entfernt" });
  });
  await deleteStoredFile(item.photoPath);
}

const lendSchema = z.object({
  borrower: requiredText(200),
  dueAt: optionalText(20),
  note: optionalText(1000),
});

export async function lendItem(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "inventory.edit");
  const item = await getItem(actor, id);
  if (item.retiredAt) throw new UserError("Ausgemusterte Gegenstände können nicht verliehen werden.");
  if (item.lentTo) throw new UserError(`Bereits verliehen an ${item.lentTo}. Bitte zuerst die Rückgabe buchen.`);
  const input = lendSchema.parse(formToObject(formData));
  const dueAt = input.dueAt ? parseDateInput(input.dueAt) : null;
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id }, data: { lentTo: input.borrower, lentAt: now, lentDueAt: dueAt } });
    await tx.inventoryLoan.create({ data: { itemId: id, borrower: input.borrower, lentAt: now, dueAt, note: input.note ?? "", createdById: actor.id } });
    await audit(tx, actor, "inventory.lend", "InventoryItem", id, { borrower: input.borrower, dueAt });
  });
}

export async function returnItem(actor: Actor, id: string, formData?: FormData) {
  assertCan(actor, "inventory.edit");
  const item = await getItem(actor, id);
  if (!item.lentTo) throw new UserError("Der Gegenstand ist nicht verliehen.");
  const note = formData ? optionalText(1000).parse(formData.get("returnNote") ?? undefined) : undefined;
  const open = item.loans.find((l) => !l.returnedAt);
  await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id }, data: { lentTo: null, lentAt: null, lentDueAt: null } });
    if (open) {
      await tx.inventoryLoan.update({
        where: { id: open.id },
        data: { returnedAt: new Date(), ...(note ? { note: [open.note, `Rückgabe: ${note}`].filter(Boolean).join("\n") } : {}) },
      });
    }
    await audit(tx, actor, "inventory.return", "InventoryItem", id, { borrower: item.lentTo, note });
  });
}

export async function retireItem(actor: Actor, id: string, retire: boolean) {
  assertCan(actor, "inventory.manage");
  const item = await getItem(actor, id);
  if (retire && item.lentTo) throw new UserError("Bitte zuerst die Rückgabe buchen.");
  await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id }, data: { retiredAt: retire ? new Date() : null } });
    await audit(tx, actor, retire ? "inventory.retire" : "inventory.reactivate", "InventoryItem", id, { code: item.code });
  });
}

export async function itemsForLabels(actor: Actor, ids: string[]) {
  assertCan(actor, "read");
  if (ids.length === 0) return db.inventoryItem.findMany({ where: { retiredAt: null }, orderBy: { number: "asc" } });
  return db.inventoryItem.findMany({ where: { id: { in: ids.slice(0, 200) } }, orderBy: { number: "asc" } });
}

export { currentYear };
