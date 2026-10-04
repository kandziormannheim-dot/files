import "server-only";
import { ActionStatus, ActionType, type Prisma, type User } from "@prisma/client";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { parseDateTimeInput, toDateInput } from "@/lib/dates";
import { assertCan, canEditOwned } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { senderContext } from "./template-context";

// Aktionen und Termine mit Helferschichten (SPEC.md 3.7)

type Actor = Pick<User, "id" | "role" | "name">;

export const actionInclude = {
  shifts: { orderBy: { startsAt: "asc" }, include: { signups: { include: { user: { select: { id: true, name: true } } } } } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ActionInclude;

export type ActionWithShifts = Prisma.ActionGetPayload<{ include: typeof actionInclude }>;

const dt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, { error: "Bitte Datum und Uhrzeit angeben." });

const actionSchema = z.object({
  type: z.enum(ActionType),
  title: requiredText(200),
  startsAt: dt,
  endsAt: z.preprocess((v) => (v === "" ? undefined : v), dt.optional()),
  location: optionalText(300),
  description: optionalText(5000),
  partners: optionalText(500),
  status: z.enum(ActionStatus).default("GEPLANT"),
});

function parseAction(formData: FormData) {
  const v = actionSchema.parse(formToObject(formData));
  const startsAt = parseDateTimeInput(v.startsAt)!;
  const endsAt = v.endsAt ? parseDateTimeInput(v.endsAt) : null;
  if (endsAt && endsAt <= startsAt) throw new UserError("Das Ende muss nach dem Beginn liegen.");
  return {
    type: v.type,
    title: v.title,
    startsAt,
    endsAt,
    location: v.location ?? "",
    description: v.description ?? "",
    partners: v.partners ?? "",
    status: v.status,
  };
}

export function canEditAction(actor: Pick<User, "id" | "role">, action: { createdById: string | null }) {
  return canEditOwned(actor.role, "action.editAll", actor.id, [action.createdById]);
}

export async function listActions(actor: Pick<User, "role">) {
  assertCan(actor, "read");
  const all = await db.action.findMany({ orderBy: { startsAt: "asc" }, include: actionInclude });
  const cutoff = Date.now() - 12 * 3600_000;
  return {
    upcoming: all.filter((a) => (a.endsAt ?? a.startsAt).getTime() >= cutoff && a.status !== "ABGESAGT"),
    past: all.filter((a) => !((a.endsAt ?? a.startsAt).getTime() >= cutoff && a.status !== "ABGESAGT")).reverse(),
  };
}

export async function getAction(actor: Pick<User, "role">, id: string) {
  assertCan(actor, "read");
  const a = await db.action.findUnique({ where: { id }, include: actionInclude });
  if (!a) throw new NotFoundError("Aktion nicht gefunden.");
  return a;
}

export async function createAction(actor: Actor, formData: FormData) {
  assertCan(actor, "action.create");
  const data = parseAction(formData);
  return db.$transaction(async (tx) => {
    const a = await tx.action.create({ data: { ...data, createdById: actor.id } });
    await audit(tx, actor, "action.create", "Action", a.id, data);
    return a;
  });
}

export async function updateAction(actor: Actor, id: string, formData: FormData) {
  const before = await getAction(actor, id);
  if (!canEditAction(actor, before)) throw new ForbiddenError();
  const data = parseAction(formData);
  await db.$transaction(async (tx) => {
    await tx.action.update({ where: { id }, data });
    await audit(tx, actor, "action.update", "Action", id, changes(before, data));
  });
}

export async function saveFollowUp(actor: Actor, id: string, formData: FormData) {
  const before = await getAction(actor, id);
  if (!canEditAction(actor, before)) throw new ForbiddenError();
  const { followUpNote } = z.object({ followUpNote: optionalText(10_000) }).parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    await tx.action.update({ where: { id }, data: { followUpNote: followUpNote ?? "" } });
    await audit(tx, actor, "action.followUp", "Action", id);
  });
}

export async function deleteAction(actor: Actor, id: string) {
  const before = await getAction(actor, id);
  if (!canEditAction(actor, before)) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.action.delete({ where: { id } });
    await tx.attachment.deleteMany({ where: { ownerType: "Action", ownerId: id } });
    await audit(tx, actor, "action.delete", "Action", id, { title: before.title });
  });
}

// ---------------------------------------------------------------------------
// Schichten
// ---------------------------------------------------------------------------

const shiftSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, { error: "Uhrzeit HH:MM" }),
  end: z.string().regex(/^\d{2}:\d{2}$/, { error: "Uhrzeit HH:MM" }),
  needed: z.coerce.number().int().min(1).max(50),
  note: optionalText(300),
});

export async function addShift(actor: Actor, actionId: string, formData: FormData) {
  const action = await getAction(actor, actionId);
  if (!canEditAction(actor, action)) throw new ForbiddenError();
  const v = shiftSchema.parse(formToObject(formData));
  const localDay = toDateInput(action.startsAt);
  const startsAt = parseDateTimeInput(`${localDay}T${v.start}`)!;
  const endsAt = parseDateTimeInput(`${localDay}T${v.end}`)!;
  if (endsAt <= startsAt) throw new UserError("Das Schichtende muss nach dem Beginn liegen.");
  await db.$transaction(async (tx) => {
    const s = await tx.shift.create({ data: { actionId, startsAt, endsAt, needed: v.needed, note: v.note ?? "" } });
    await audit(tx, actor, "shift.add", "Action", actionId, { shiftId: s.id, start: v.start, end: v.end, needed: v.needed });
  });
}

export async function deleteShift(actor: Actor, shiftId: string) {
  const shift = await db.shift.findUnique({ where: { id: shiftId }, include: { action: true } });
  if (!shift) throw new NotFoundError("Schicht nicht gefunden.");
  if (!canEditAction(actor, shift.action)) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.shift.delete({ where: { id: shiftId } });
    await audit(tx, actor, "shift.delete", "Action", shift.actionId, { shiftId });
  });
}

/** Eintragen/Austragen in eine Helferschicht (nur für sich selbst). */
export async function toggleShiftSignup(actor: Actor, shiftId: string) {
  assertCan(actor, "shift.signup");
  const shift = await db.shift.findUnique({ where: { id: shiftId }, include: { signups: true, action: true } });
  if (!shift) throw new NotFoundError("Schicht nicht gefunden.");
  if (shift.action.status === "ABGESAGT" || shift.action.status === "DURCHGEFUEHRT") throw new UserError("Für diese Aktion sind keine Eintragungen mehr möglich.");
  const mine = shift.signups.find((s) => s.userId === actor.id);
  await db.$transaction(async (tx) => {
    if (mine) {
      await tx.shiftSignup.delete({ where: { id: mine.id } });
    } else {
      // Kapazität in der Transaktion prüfen, damit nicht zwei gleichzeitig den letzten Platz bekommen
      const count = await tx.shiftSignup.count({ where: { shiftId } });
      if (count >= shift.needed) throw new UserError("Diese Schicht ist bereits voll besetzt.");
      await tx.shiftSignup.create({ data: { shiftId, userId: actor.id } });
    }
    await audit(tx, actor, mine ? "shift.signout" : "shift.signup", "Action", shift.actionId, { shiftId });
  });
  return !mine;
}

/** Helferaufruf an alle aktiven Nutzer (Vorlage aktion.helferaufruf). */
export async function sendHelpCall(actor: Actor, id: string) {
  const action = await getAction(actor, id);
  if (!canEditAction(actor, action)) throw new ForbiddenError();
  if (!action.shifts.length) throw new UserError("Bitte zuerst Schichten anlegen.");
  const users = await db.user.findMany({ where: { active: true, role: { in: ["ADMIN", "SCHRIFTFUEHRER", "VORSTAND"] } } });
  const mail = await renderMail("aktion.helferaufruf", {
    absender: await senderContext(actor.id),
    aktion: {
      titel: action.title,
      beginn: action.startsAt,
      ort: action.location,
      beschreibung: action.description,
      link: `${appUrl()}/actions/${action.id}`,
    },
    schichten: action.shifts.map((s) => ({
      beginn: s.startsAt,
      ende: s.endsAt,
      benoetigt: s.needed,
      offen: Math.max(0, s.needed - s.signups.length),
    })),
  });
  for (const u of users) await queueMail({ to: u.email, subject: mail.subject, text: mail.text, html: mail.html });
  await db.$transaction(async (tx) => {
    await tx.action.update({ where: { id }, data: { helpCallSentAt: new Date() } });
    await audit(tx, actor, "action.helpCall", "Action", id, { recipients: users.length });
  });
  return users.length;
}

export function openSlots(action: ActionWithShifts) {
  return action.shifts.reduce((n, s) => n + Math.max(0, s.needed - s.signups.length), 0);
}
