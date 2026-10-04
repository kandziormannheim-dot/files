import "server-only";
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

const profileSchema = z.object({ name: requiredText(120) });

/** Eigene Stammdaten; Rolle, Funktion und Stimmrecht pflegt nur der Admin. */
export async function updateOwnProfile(actor: User, formData: FormData) {
  const input = profileSchema.parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: input });
    await audit(tx, actor, "user.profile", "User", actor.id, changes(actor, input));
  });
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
