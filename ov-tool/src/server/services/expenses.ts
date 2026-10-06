import "server-only";
import path from "node:path";
import { ExpensePayout, type Prisma, type User } from "@prisma/client";
import { sniffType } from "@/lib/file-types";
import { formatDate, parseDateInput } from "@/lib/dates";
import { formatEuro, formatIban, normalizeIban, parseEuro } from "@/lib/money";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { decrypt, encrypt, encryptionConfigured } from "@/server/crypto";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { deleteStoredFile, readStoredFile, saveFile } from "@/server/files";
import { normalizePhoto } from "@/server/images";
import { renderMail } from "@/server/mail/render";
import { sendMail } from "@/server/mail/transport";
import { appendAnnexes } from "@/server/pdf/annexes";
import { renderDocumentPdf, renderDocumentPreview } from "@/server/pdf/render";
import { getSettings } from "./settings";
import { senderContext } from "./template-context";

// Auslagenerstattung: Belege (Foto/PDF) erfassen, Erstattungsart wählen (Spendenbescheinigung, Überweisung, bar),
// Freigabe durch den Vorstand, Versand als PDF (Antrag + Belege) an die Kreisgeschäftsstelle.

type Actor = Pick<User, "id" | "role">;

export const PAYOUT_LABELS: Record<ExpensePayout, string> = {
  SPENDE: "Verzicht zugunsten einer Spendenbescheinigung (Aufwandsspende)",
  UEBERWEISUNG: "Überweisung",
  BAR: "Barauszahlung",
};

export const STATUS_LABELS = {
  ENTWURF: "Entwurf",
  EINGEREICHT: "zur Freigabe eingereicht",
  VERSENDET: "an die Kreisgeschäftsstelle gesendet",
  ERLEDIGT: "erledigt",
  ABGELEHNT: "abgelehnt",
} as const;

export type PersonalData = { accountHolder?: string; iban?: string; address?: string };

/** Bankverbindung und Anschrift werden nach dieser Frist (ab Versand) gelöscht. */
export const PERSONAL_DATA_MONTHS = 12;

const MAX_RECEIPT = 15 * 1024 * 1024;

function readPersonal(c: { personalData: string; personalEnc: boolean }): PersonalData {
  if (!c.personalData) return {};
  try {
    return JSON.parse(c.personalEnc ? decrypt(c.personalData) : c.personalData) as PersonalData;
  } catch {
    return {};
  }
}

function writePersonal(data: PersonalData) {
  const json = JSON.stringify(data);
  const enc = encryptionConfigured();
  return { personalData: enc ? encrypt(json) : json, personalEnc: enc };
}

function canSee(actor: Actor, claim: { claimantId: string }) {
  return claim.claimantId === actor.id || can(actor.role, "expense.approve");
}

export function listClaims(actor: Actor) {
  if (!can(actor.role, "expense.create") && !can(actor.role, "expense.approve")) throw new ForbiddenError();
  return db.expenseClaim.findMany({
    where: can(actor.role, "expense.approve") ? {} : { claimantId: actor.id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { amountCents: true } } },
  });
}

export async function getClaim(actor: Actor, id: string) {
  const claim = await db.expenseClaim.findUnique({ where: { id }, include: { items: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] } } });
  if (!claim) throw new NotFoundError();
  if (!canSee(actor, claim)) throw new ForbiddenError();
  return { ...claim, personal: readPersonal(claim), total: claim.items.reduce((s, i) => s + i.amountCents, 0) };
}
export type ClaimFull = Awaited<ReturnType<typeof getClaim>>;

async function nextNumber(tx: Prisma.TransactionClient, year: number) {
  const prefix = `A-${year}-`;
  const last = await tx.expenseClaim.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

const claimSchema = z.object({
  title: requiredText(200),
  occasion: optionalText(1000),
  payout: z.enum(ExpensePayout),
  accountHolder: optionalText(200),
  iban: optionalText(50),
  address: optionalText(500),
  note: optionalText(2000),
});

function personalFromInput(input: z.infer<typeof claimSchema>, claimantName: string): PersonalData {
  if (input.payout === "UEBERWEISUNG") {
    const iban = normalizeIban(input.iban ?? "");
    if (!iban) throw new UserError("Bitte eine gültige IBAN angeben (Prüfziffer stimmt nicht).");
    return { accountHolder: input.accountHolder || claimantName, iban };
  }
  if (input.payout === "SPENDE") {
    if (!input.address || input.address.trim().length < 8) throw new UserError("Für die Spendenbescheinigung wird die vollständige Anschrift benötigt.");
    return { address: input.address.trim() };
  }
  return {};
}

export async function createClaim(actor: Actor & { name: string }, formData: FormData) {
  assertCan(actor, "expense.create");
  const input = claimSchema.parse(formToObject(formData));
  const personal = personalFromInput(input, actor.name);
  return db.$transaction(async (tx) => {
    const claim = await tx.expenseClaim.create({
      data: {
        number: await nextNumber(tx, new Date().getFullYear()),
        claimantId: actor.id,
        claimantName: actor.name,
        title: input.title,
        occasion: input.occasion ?? "",
        payout: input.payout,
        note: input.note ?? "",
        ...writePersonal(personal),
      },
    });
    // Bankdaten nie ins Audit-Log
    await audit(tx, actor, "expense.create", "ExpenseClaim", claim.id, { number: claim.number, payout: claim.payout });
    return claim;
  });
}

async function loadEditable(actor: Actor, id: string) {
  const claim = await db.expenseClaim.findUnique({ where: { id } });
  if (!claim) throw new NotFoundError();
  const own = claim.claimantId === actor.id;
  if (!own && !can(actor.role, "expense.approve")) throw new ForbiddenError();
  if (claim.status !== "ENTWURF" && claim.status !== "EINGEREICHT") throw new UserError("Der Antrag ist bereits versendet und kann nicht mehr geändert werden.");
  if (claim.status === "EINGEREICHT" && !can(actor.role, "expense.approve")) throw new UserError("Der Antrag liegt zur Freigabe vor. Für Änderungen bitte zurückziehen.");
  return claim;
}

export async function updateClaim(actor: Actor, id: string, formData: FormData) {
  const claim = await loadEditable(actor, id);
  const input = claimSchema.parse(formToObject(formData));
  // leere IBAN bei bestehender Überweisung = unverändert lassen
  const old = readPersonal(claim);
  const keepIban = input.payout === "UEBERWEISUNG" && !input.iban && old.iban;
  const personal = keepIban ? { accountHolder: input.accountHolder || old.accountHolder, iban: old.iban } : personalFromInput(input, claim.claimantName);
  await db.$transaction(async (tx) => {
    await tx.expenseClaim.update({
      where: { id },
      data: { title: input.title, occasion: input.occasion ?? "", payout: input.payout, note: input.note ?? "", ...writePersonal(personal) },
    });
    await audit(tx, actor, "expense.update", "ExpenseClaim", id, { payout: input.payout });
  });
}

const itemSchema = z.object({
  date: z.string().transform((v, ctx) => {
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Bitte das Belegdatum angeben." });
    return d as Date;
  }),
  description: requiredText(300),
  amount: z.string().transform((v, ctx) => {
    const c = parseEuro(v);
    if (c === null || c <= 0) ctx.addIssue({ code: "custom", message: "Bitte einen Betrag wie 12,50 angeben." });
    if (c !== null && c > 1_000_000) ctx.addIssue({ code: "custom", message: "Betrag zu hoch (max. 10.000 €)." });
    return c ?? 0;
  }),
});

async function storeReceipt(claimId: string, file: File) {
  if (file.size > MAX_RECEIPT) throw new UserError("Der Beleg ist größer als 15 MB.");
  const raw = Buffer.from(await file.arrayBuffer());
  const type = sniffType(raw);
  if (type === "application/pdf") {
    return { receiptPath: await saveFile(`expenses/${claimId}`, file.name, raw), receiptName: file.name.slice(0, 200), receiptMime: "application/pdf" };
  }
  if (type?.startsWith("image/")) {
    const webp = await normalizePhoto(file); // dreht nach EXIF, verkleinert, entfernt Metadaten (GPS)
    const name = `${path.parse(file.name).name}.webp`;
    return { receiptPath: await saveFile(`expenses/${claimId}`, name, webp), receiptName: name.slice(0, 200), receiptMime: "image/webp" };
  }
  throw new UserError("Belege bitte als Foto (JPEG, PNG, WebP) oder PDF hochladen.");
}

export async function addItem(actor: Actor, claimId: string, formData: FormData) {
  const claim = await loadEditable(actor, claimId);
  const input = itemSchema.parse(formToObject(formData));
  const file = formData.get("receipt");
  const receipt = file instanceof File && file.size > 0 ? await storeReceipt(claim.id, file) : null;
  await db.$transaction(async (tx) => {
    const item = await tx.expenseItem.create({ data: { claimId, date: input.date, description: input.description, amountCents: input.amount, ...(receipt ?? {}) } });
    await audit(tx, actor, "expense.item.add", "ExpenseClaim", claimId, { itemId: item.id, amount: input.amount, receipt: !!receipt });
  });
}

export async function deleteItem(actor: Actor, itemId: string) {
  const item = await db.expenseItem.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFoundError();
  await loadEditable(actor, item.claimId);
  await db.$transaction(async (tx) => {
    await tx.expenseItem.delete({ where: { id: itemId } });
    await audit(tx, actor, "expense.item.delete", "ExpenseClaim", item.claimId, { itemId, amount: item.amountCents });
  });
  await deleteStoredFile(item.receiptPath);
  return item.claimId;
}

export async function readReceipt(actor: Actor, itemId: string) {
  const item = await db.expenseItem.findUnique({ where: { id: itemId }, include: { claim: { select: { claimantId: true } } } });
  if (!item?.receiptPath) throw new NotFoundError();
  if (!canSee(actor, item.claim)) throw new ForbiddenError();
  return { data: await readStoredFile(item.receiptPath), name: item.receiptName, mime: item.receiptMime };
}

function assertComplete(claim: ClaimFull) {
  if (claim.items.length === 0) throw new UserError("Bitte mindestens eine Position mit Beleg erfassen.");
  const missing = claim.items.filter((i) => !i.receiptPath);
  if (missing.length) throw new UserError(`Zu ${missing.length === 1 ? "einer Position fehlt" : `${missing.length} Positionen fehlen`} der Beleg.`);
  if (claim.payout === "UEBERWEISUNG" && !claim.personal.iban) throw new UserError("Für die Überweisung fehlt die IBAN.");
  if (claim.payout === "SPENDE" && !claim.personal.address) throw new UserError("Für die Spendenbescheinigung fehlt die Anschrift.");
}

/** Antragsteller reicht zur Freigabe ein. */
export async function submitClaim(actor: Actor, id: string) {
  const claim = await getClaim(actor, id);
  if (claim.claimantId !== actor.id) throw new ForbiddenError();
  if (claim.status !== "ENTWURF") throw new UserError("Der Antrag ist bereits eingereicht.");
  assertComplete(claim);
  await db.$transaction(async (tx) => {
    await tx.expenseClaim.update({ where: { id }, data: { status: "EINGEREICHT", submittedAt: new Date() } });
    await audit(tx, actor, "expense.submit", "ExpenseClaim", id, { total: claim.total });
  });
}

export async function withdrawClaim(actor: Actor, id: string) {
  const claim = await getClaim(actor, id);
  if (claim.status !== "EINGEREICHT") throw new UserError("Nur eingereichte Anträge können zurückgezogen werden.");
  if (claim.claimantId !== actor.id && !can(actor.role, "expense.approve")) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.expenseClaim.update({ where: { id }, data: { status: "ENTWURF", submittedAt: null } });
    await audit(tx, actor, "expense.withdraw", "ExpenseClaim", id, {});
  });
}

// ---------------------------------------------------------------------------
// PDF und Versand
// ---------------------------------------------------------------------------

async function claimContext(claim: ClaimFull, approver: { name: string } | null) {
  const p = claim.personal;
  return {
    auslage: {
      nummer: claim.number,
      titel: claim.title,
      anlass: claim.occasion,
      antragsteller: claim.claimantName,
      erstellt: claim.createdAt,
      erstattungsart: PAYOUT_LABELS[claim.payout],
      spende: claim.payout === "SPENDE",
      ueberweisung: claim.payout === "UEBERWEISUNG",
      bar: claim.payout === "BAR",
      kontoinhaber: p.accountHolder ?? "",
      iban: p.iban ? formatIban(p.iban) : "",
      anschrift: p.address ?? "",
      bemerkung: claim.note,
      summe: formatEuro(claim.total),
      positionen: claim.items.map((i, idx) => ({ nr: idx + 1, belegdatum: formatDate(i.date), beschreibung: i.description, betrag: formatEuro(i.amountCents), beleg: i.receiptPath ? `Beleg ${idx + 1}` : "–" })),
      freigabeDurch: approver?.name ?? "",
      freigabeAm: claim.approvedAt ? formatDate(claim.approvedAt) : "",
    },
  };
}

export async function claimPdf(actor: Actor, id: string) {
  const claim = await getClaim(actor, id);
  const approver = claim.approvedById ? await db.user.findUnique({ where: { id: claim.approvedById }, select: { name: true } }) : null;
  const ctx = { ...(await claimContext(claim, approver)), absender: await senderContext(actor.id) };
  const { pdf: base } = await renderDocumentPdf("auslagen.dokument", ctx, `Auslagenerstattung ${claim.number}`);
  const annexes = claim.items
    .map((i, idx) => ({ i, nummer: idx + 1 }))
    .filter(({ i }) => i.receiptPath)
    .map(({ i, nummer }) => ({ nummer, name: `Beleg ${nummer} – ${i.description}`, mimeType: i.receiptMime, filePath: i.receiptPath! }));
  const { pdf } = await appendAnnexes(base, annexes);
  return { pdf, fileName: `Auslagenerstattung-${claim.number}.pdf`, claim };
}

export async function claimPreview(actor: Actor, id: string) {
  const claim = await getClaim(actor, id);
  return renderDocumentPreview("auslagen.dokument", await claimContext(claim, null), `Auslagenerstattung ${claim.number}`);
}

/** Freigabe (sachlich und rechnerisch richtig) und Versand an die Kreisgeschäftsstelle. */
export async function approveAndSend(actor: Actor & { name: string; email: string }, id: string) {
  assertCan(actor, "expense.approve");
  const settings = await getSettings();
  if (!settings.office.email) throw new UserError("Keine E-Mail-Adresse der Kreisgeschäftsstelle hinterlegt (Einstellungen → Allgemein).");
  const before = await getClaim(actor, id);
  if (before.status !== "ENTWURF" && before.status !== "EINGEREICHT") throw new UserError("Der Antrag wurde bereits versendet.");
  assertComplete(before);
  await db.expenseClaim.update({ where: { id }, data: { approvedById: actor.id, approvedAt: new Date() } });
  const { pdf, fileName, claim } = await claimPdf(actor, id);
  const claimant = await db.user.findUnique({ where: { id: claim.claimantId }, select: { email: true } });
  const mail = await renderMail("auslagen.versand", { ...(await claimContext(claim, { name: actor.name })), absender: await senderContext(actor.id) });
  const cc = [...new Set([claimant?.email, actor.email].filter((x): x is string => !!x && x !== settings.office.email))];
  await sendMail({
    to: settings.office.email,
    ...(cc.length ? { cc: cc.join(", ") } : {}),
    replyTo: actor.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
  });
  await db.$transaction(async (tx) => {
    await tx.expenseClaim.update({ where: { id }, data: { status: "VERSENDET", sentAt: new Date(), sentTo: settings.office.email } });
    await audit(tx, actor, "expense.send", "ExpenseClaim", id, { to: settings.office.email, total: claim.total, payout: claim.payout });
  });
  return { to: settings.office.email, total: claim.total };
}

export async function setClaimOutcome(actor: Actor, id: string, outcome: "ERLEDIGT" | "ABGELEHNT", note?: string) {
  assertCan(actor, "expense.approve");
  const claim = await db.expenseClaim.findUnique({ where: { id } });
  if (!claim) throw new NotFoundError();
  if (outcome === "ERLEDIGT" && claim.status !== "VERSENDET") throw new UserError("Erledigt kann erst nach dem Versand markiert werden.");
  await db.$transaction(async (tx) => {
    await tx.expenseClaim.update({ where: { id }, data: { status: outcome, doneAt: new Date(), ...(note ? { note: `${claim.note}${claim.note ? "\n" : ""}${note}` } : {}) } });
    await audit(tx, actor, outcome === "ERLEDIGT" ? "expense.done" : "expense.reject", "ExpenseClaim", id, note ? { note } : {});
  });
}

export async function deleteClaim(actor: Actor, id: string) {
  const claim = await db.expenseClaim.findUnique({ where: { id }, include: { items: true } });
  if (!claim) throw new NotFoundError();
  if (claim.claimantId !== actor.id && !can(actor.role, "expense.approve")) throw new ForbiddenError();
  if (claim.status !== "ENTWURF") throw new UserError("Nur Entwürfe können gelöscht werden.");
  await db.$transaction(async (tx) => {
    await tx.expenseClaim.delete({ where: { id } });
    await audit(tx, actor, "expense.delete", "ExpenseClaim", id, { number: claim.number });
  });
  for (const i of claim.items) await deleteStoredFile(i.receiptPath);
}

/** Löschfrist: Bankverbindung und Anschrift 12 Monate nach Versand entfernen (Belege bleiben für die Buchhaltung). */
export async function enforceExpenseRetention(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - PERSONAL_DATA_MONTHS);
  const r = await db.expenseClaim.updateMany({ where: { sentAt: { lt: cutoff }, personalData: { not: "" } }, data: { personalData: "", personalEnc: false } });
  if (r.count) await audit(db, null, "expense.retention", "ExpenseClaim", null, { cleared: r.count });
  return r.count;
}
