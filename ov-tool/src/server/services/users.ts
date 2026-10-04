import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Role, VotingRight, type User } from "@prisma/client";
import { checkbox, email, formToObject, optionalInt, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { sendMail } from "@/server/mail/transport";
import { IMAGE_EXT, sniffType } from "@/lib/file-types";
import { deleteStoredFile, saveFile } from "@/server/files";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { rateLimit } from "@/server/rate-limit";

type Actor = Pick<User, "id" | "role">;

const userSchema = z.object({
  name: requiredText(120),
  email,
  role: z.enum(Role),
  functionTitle: optionalText(120),
  votingRight: z.enum(VotingRight),
  sortOrder: optionalInt,
  loginEnabled: checkbox,
  active: checkbox,
});

/** Aktive Personen in der Reihenfolge der Anwesenheitslisten. */
export function listActiveUsers() {
  return db.user.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export function listAllUsers(actor: Actor) {
  assertCan(actor, "read");
  return db.user.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function getUser(actor: Actor, id: string) {
  assertCan(actor, "users.manage");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Nutzer nicht gefunden.");
  return user;
}

async function sendAccessMail(user: Pick<User, "name" | "email">) {
  const { subject, text, html } = await renderMail("zugang.einladung", {
    empfaenger: { name: user.name },
    zugang: { link: `${appUrl()}/login` },
  });
  await sendMail({ to: user.email, subject, text, html });
}

export async function createUser(actor: Actor, formData: FormData) {
  assertCan(actor, "users.manage");
  const input = userSchema.parse({ ...formToObject(formData), active: "on" });
  const sendInvite = formData.get("sendInvite") === "on";
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw new UserError("Diese E-Mail-Adresse ist bereits vergeben.");
  }
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        ...input,
        functionTitle: input.functionTitle ?? "",
        sortOrder: input.sortOrder ?? 100,
      },
    });
    await audit(tx, actor, "user.create", "User", created.id, {
      name: created.name,
      email: created.email,
      role: created.role,
      votingRight: created.votingRight,
    });
    return created;
  });
  if (sendInvite && user.loginEnabled) await sendAccessMail(user);
  return user;
}

export async function updateUser(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "users.manage");
  const input = userSchema.parse(formToObject(formData));
  const before = await db.user.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Nutzer nicht gefunden.");
  if (input.email !== before.email && (await db.user.findUnique({ where: { email: input.email } }))) {
    throw new UserError("Diese E-Mail-Adresse ist bereits vergeben.");
  }
  const losesAdmin = before.role === "ADMIN" && (input.role !== "ADMIN" || !input.active || !input.loginEnabled);
  if (losesAdmin) {
    if (id === actor.id) throw new UserError("Sie können sich die Admin-Rechte nicht selbst entziehen.");
    const admins = await db.user.count({ where: { role: "ADMIN", active: true, loginEnabled: true } });
    if (admins <= 1) throw new UserError("Es muss mindestens ein aktiver Admin bleiben.");
  }
  const data = { ...input, functionTitle: input.functionTitle ?? "", sortOrder: input.sortOrder ?? before.sortOrder };
  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data });
    // Deaktivierte Personen verlieren sofort alle Sitzungen; sie bleiben in alten Protokollen erhalten.
    if (!updated.active || !updated.loginEnabled) await tx.session.deleteMany({ where: { userId: id } });
    await audit(tx, actor, "user.update", "User", id, changes(before, data));
    return updated;
  });
}

export async function resendAccessMail(actor: Actor, id: string) {
  assertCan(actor, "users.manage");
  const user = await getUser(actor, id);
  if (!user.active || !user.loginEnabled) throw new UserError("Für diese Person ist kein Login freigeschaltet.");
  await sendAccessMail(user);
  await audit(db, actor, "user.accessMail", "User", id);
}

const phone = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .max(40)
    .regex(/^[+0-9 ()/-]{5,40}$/, { error: "Bitte eine gültige Telefonnummer angeben." })
    .optional(),
);

const profileSchema = z.object({ name: requiredText(120), phone, showPhoneInBoard: checkbox });

/** Eigene Stammdaten; Rolle, Funktion und Stimmrecht pflegt nur der Admin. */
export async function updateOwnProfile(actor: User, formData: FormData) {
  const parsed = profileSchema.parse(formToObject(formData));
  const input = { name: parsed.name, phone: parsed.phone ?? null, showPhoneInBoard: parsed.phone ? parsed.showPhoneInBoard : false };
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: input });
    await audit(tx, actor, "user.profile", "User", actor.id, changes(actor, input));
  });
}

// ---------------------------------------------------------------------------
// Eigene E-Mail-Adresse ändern (mit Bestätigung über die neue Adresse)
// ---------------------------------------------------------------------------

const EMAIL_CHANGE_HOURS = 24;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestEmailChange(actor: User, formData: FormData) {
  const { newEmail } = z.object({ newEmail: email }).parse(formToObject(formData));
  if (newEmail === actor.email) throw new UserError("Das ist bereits Ihre aktuelle Adresse.");
  if (!rateLimit(`email-change:${actor.id}`, 3, 60 * 60 * 1000)) {
    throw new UserError("Zu viele Versuche. Bitte später erneut versuchen.");
  }
  if (await db.user.findUnique({ where: { email: newEmail } })) {
    throw new UserError("Diese E-Mail-Adresse ist bereits vergeben.");
  }
  const token = randomBytes(32).toString("base64url");
  await db.$transaction(async (tx) => {
    // Nur der jeweils letzte Antrag gilt
    await tx.emailChangeToken.deleteMany({ where: { userId: actor.id, usedAt: null } });
    await tx.emailChangeToken.create({
      data: {
        userId: actor.id,
        newEmail,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_HOURS * 3600 * 1000),
      },
    });
    await audit(tx, actor, "user.emailChangeRequested", "User", actor.id, { newEmail });
  });
  const { subject, text, html } = await renderMail("email.bestaetigung", {
    empfaenger: { name: actor.name },
    emailAenderung: {
      neueAdresse: newEmail,
      alteAdresse: actor.email,
      link: `${appUrl()}/email-confirm/${token}`,
      gueltigStunden: EMAIL_CHANGE_HOURS,
    },
  });
  await sendMail({ to: newEmail, subject, text, html });
  return newEmail;
}

/** Löst den Bestätigungslink ein. Gibt die neue Adresse zurück oder null, wenn der Link ungültig ist. */
export async function confirmEmailChange(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const rec = await db.emailChangeToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date() || !rec.user.active) return null;
  const oldEmail = rec.user.email;
  try {
    await db.$transaction(async (tx) => {
      await tx.emailChangeToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
      await tx.user.update({ where: { id: rec.userId }, data: { email: rec.newEmail, emailVerified: new Date() } });
      await audit(tx, rec.user, "user.emailChanged", "User", rec.userId, { email: { from: oldEmail, to: rec.newEmail } });
    });
  } catch {
    // z. B. Adresse inzwischen anderweitig vergeben (Unique-Constraint)
    return null;
  }
  try {
    const { subject, text, html } = await renderMail("email.geaendert", {
      empfaenger: { name: rec.user.name },
      emailAenderung: { neueAdresse: rec.newEmail, alteAdresse: oldEmail, link: `${appUrl()}/profile`, gueltigStunden: EMAIL_CHANGE_HOURS },
    });
    await sendMail({ to: oldEmail, subject, text, html });
  } catch {
    /* Hinweis an die alte Adresse ist best effort */
  }
  return rec.newEmail;
}

export function pendingEmailChange(userId: string) {
  return db.emailChangeToken.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { newEmail: true, expiresAt: true },
  });
}

/** Vorstandsliste: aktive Personen ohne Gäste; Telefonnummer nur mit Zustimmung. */
export async function listBoard(actor: Actor) {
  assertCan(actor, "read");
  const users = await db.user.findMany({
    where: { active: true, role: { not: "GAST" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, functionTitle: true, votingRight: true, role: true, phone: true, showPhoneInBoard: true },
  });
  return users.map(({ phone, showPhoneInBoard, ...u }) => ({ ...u, phone: showPhoneInBoard ? phone : null }));
}

export async function listAuditLog(actor: Actor, filter: { entityType?: string; take?: number }) {
  assertCan(actor, "audit.read");
  return db.auditLog.findMany({
    where: filter.entityType ? { entityType: filter.entityType } : {},
    orderBy: { createdAt: "desc" },
    take: filter.take ?? 200,
    include: { user: { select: { name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Unterschriftsbild (nur für sich selbst, SPEC.md 3.6)
// ---------------------------------------------------------------------------

const MAX_SIGNATURE_BYTES = 1_000_000;

export async function uploadSignature(actor: User, formData: FormData) {
  const file = formData.get("signature");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Bitte eine Bilddatei auswählen.");
  if (file.size > MAX_SIGNATURE_BYTES) throw new UserError("Das Bild ist größer als 1 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniffType(data);
  if (!type || !IMAGE_EXT[type]) throw new UserError("Nur PNG-, JPEG- oder WebP-Bilder sind erlaubt.");
  const rel = await saveFile(`signatures/${actor.id}`, `unterschrift${IMAGE_EXT[type]}`, data);
  const old = actor.signatureImagePath;
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { signatureImagePath: rel } });
    await audit(tx, actor, "user.signature", "User", actor.id, { uploaded: true });
  });
  await deleteStoredFile(old);
}

export async function removeSignature(actor: User) {
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { signatureImagePath: null } });
    await audit(tx, actor, "user.signature", "User", actor.id, { removed: true });
  });
  await deleteStoredFile(actor.signatureImagePath);
}
