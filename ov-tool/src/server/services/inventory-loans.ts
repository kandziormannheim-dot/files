import "server-only";
import type { InventoryLoan, InventoryLoanPhoto, LoanPhase, User } from "@prisma/client";
import sharp from "sharp";
import { formatDate, parseDateInput, startOfBerlinDay, toDateInput } from "@/lib/dates";
import { email as emailSchema, formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { decrypt, encrypt } from "@/server/crypto";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { readStoredFile, saveFile } from "@/server/files";
import { normalizePhoto } from "@/server/images";
import { renderMail } from "@/server/mail/render";
import { sendMail } from "@/server/mail/transport";
import { renderDocumentPdf } from "@/server/pdf/render";
import { CONDITIONS, getItem } from "./inventory";
import { getSettings } from "./settings";

// Leihprotokoll: Ausgabe und Rückgabe mit Angaben, Fotodokumentation, PDF im Briefbogen und Mail an alle Beteiligten.

type Actor = Pick<User, "id" | "role">;

const MAX_PHOTOS = 10;
/** E-Mail der ausleihenden Person wird 12 Monate nach der Rückgabe gelöscht (Retention-Job). */
export const BORROWER_EMAIL_RETENTION_DAYS = 365;

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const lendSchema = z.object({
  pickupAt: optionalText(20),
  handedOverById: optionalText(50),
  borrowerName: requiredText(200),
  organization: optionalText(200),
  borrowerEmail: z.preprocess(emptyToUndefined, emailSchema.optional()),
  accessories: optionalText(1000),
  conditionOut: z.enum(CONDITIONS),
  dueAt: optionalText(20),
  note: optionalText(1000),
});

const returnSchema = z.object({
  returnedAt: optionalText(20),
  returnedByName: optionalText(200),
  receivedById: optionalText(50),
  conditionIn: z.enum(CONDITIONS),
  accessoriesComplete: z.preprocess((v) => (v === "ja" ? true : v === "nein" ? false : undefined), z.boolean().optional()),
  returnNote: optionalText(1000),
});

/** Anzeige „Name (Organisation)“ für Verlauf, Übersicht und Suche. */
export function borrowerLabel(name: string, organization?: string | null) {
  return organization ? `${name} (${organization})` : name;
}

function photosFrom(formData: FormData) {
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_PHOTOS) throw new UserError(`Bitte höchstens ${MAX_PHOTOS} Fotos auf einmal hochladen.`);
  return files;
}

/** Datum aus dem Formular; heute = jetzt (mit Uhrzeit), sonst Berliner Mitternacht. Keine Daten in der Zukunft. */
function pastDate(value: string | undefined, label: string): Date {
  const now = new Date();
  if (!value) return now;
  const d = parseDateInput(value);
  if (!d) throw new UserError(`Bitte ein gültiges Datum für „${label}“ angeben.`);
  if (d.getTime() === startOfBerlinDay(now).getTime()) return now;
  if (d > now) throw new UserError(`„${label}“ liegt in der Zukunft.`);
  return d;
}

async function activeUser(id: string | undefined, fallback: string) {
  const user = await db.user.findFirst({ where: { id: id || fallback, active: true }, select: { id: true, name: true, email: true } });
  if (!user) throw new UserError("Die gewählte Person hat keinen aktiven Zugang.");
  return user;
}

async function storePhotos(tx: Pick<typeof db, "inventoryLoanPhoto">, actor: Actor, loanId: string, phase: LoanPhase, buffers: Buffer[]) {
  const stamp = Date.now();
  for (const [i, buf] of buffers.entries()) {
    const path = await saveFile(`inventory/loans/${loanId}`, `${phase.toLowerCase()}-${stamp}-${i + 1}.webp`, buf);
    await tx.inventoryLoanPhoto.create({ data: { loanId, phase, path, createdById: actor.id } });
  }
}

export type MailResult = { sent: boolean; recipients: string[]; error?: string };

export async function lendItem(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "inventory.edit");
  const item = await getItem(actor, id);
  if (item.retiredAt) throw new UserError("Ausgemusterte Gegenstände können nicht verliehen werden.");
  if (item.lentTo) throw new UserError(`Bereits verliehen an ${item.lentTo}. Bitte zuerst die Rückgabe buchen.`);
  const input = lendSchema.parse(formToObject(formData));
  const lentAt = pastDate(input.pickupAt, "Abholung");
  const dueAt = input.dueAt ? parseDateInput(input.dueAt) : null;
  if (input.dueAt && !dueAt) throw new UserError("Bitte ein gültiges Rückgabedatum angeben.");
  if (dueAt && dueAt < startOfBerlinDay(lentAt)) throw new UserError("Das Rückgabedatum liegt vor der Abholung.");
  const handedOver = await activeUser(input.handedOverById, actor.id);
  const photos = await Promise.all(photosFrom(formData).map(normalizePhoto)); // vor dem Buchen prüfen
  const borrower = borrowerLabel(input.borrowerName, input.organization);

  const loan = await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id }, data: { lentTo: borrower, lentAt, lentDueAt: dueAt } });
    const created = await tx.inventoryLoan.create({
      data: {
        itemId: id,
        borrower,
        borrowerName: input.borrowerName,
        organization: input.organization ?? "",
        borrowerEmail: input.borrowerEmail ? encrypt(input.borrowerEmail) : null,
        handedOverById: handedOver.id,
        handedOverBy: handedOver.name,
        accessories: input.accessories ?? "",
        conditionOut: input.conditionOut,
        lentAt,
        dueAt,
        note: input.note ?? "",
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "inventory.lend", "InventoryItem", id, {
      loanId: created.id,
      borrower,
      handedOverBy: handedOver.name,
      conditionOut: input.conditionOut,
      dueAt,
      photos: photos.length,
      email: !!input.borrowerEmail,
    });
    return created;
  });
  if (photos.length) await storePhotos(db, actor, loan.id, "AUSGABE", photos);
  const mail = await sendLoanProtocol(actor, loan.id, "AUSGABE");
  return { loan, mail };
}

export async function returnItem(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "inventory.edit");
  const item = await getItem(actor, id);
  if (!item.lentTo) throw new UserError("Der Gegenstand ist nicht verliehen.");
  const input = returnSchema.parse(formToObject(formData));
  const open = item.loans.find((l) => !l.returnedAt);
  const returnedAt = pastDate(input.returnedAt, "Rückgabe");
  if (open && returnedAt < startOfBerlinDay(open.lentAt)) throw new UserError("Die Rückgabe liegt vor der Abholung.");
  const received = await activeUser(input.receivedById, actor.id);
  const photos = await Promise.all(photosFrom(formData).map(normalizePhoto));
  // Der Zustand bei Rückgabe wird zum aktuellen Zustand im Inventar
  const conditionChanged = input.conditionIn !== item.condition;

  const loanId = await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id },
      data: { lentTo: null, lentAt: null, lentDueAt: null, ...(conditionChanged ? { condition: input.conditionIn } : {}) },
    });
    // Altbestand ohne Leihvorgang: nachträglich anlegen, damit es ein Protokoll gibt
    const loan =
      open ??
      (await tx.inventoryLoan.create({
        data: { itemId: id, borrower: item.lentTo!, borrowerName: item.lentTo!, lentAt: item.lentAt ?? returnedAt, dueAt: item.lentDueAt, createdById: actor.id },
      }));
    await tx.inventoryLoan.update({
      where: { id: loan.id },
      data: {
        returnedAt,
        returnedByName: input.returnedByName ?? loan.borrowerName,
        receivedById: received.id,
        receivedBy: received.name,
        conditionIn: input.conditionIn,
        accessoriesComplete: loan.accessories ? (input.accessoriesComplete ?? null) : null,
        returnNote: input.returnNote ?? "",
      },
    });
    await audit(tx, actor, "inventory.return", "InventoryItem", id, {
      loanId: loan.id,
      borrower: item.lentTo,
      receivedBy: received.name,
      conditionIn: input.conditionIn,
      ...(conditionChanged ? { condition: { from: item.condition, to: input.conditionIn } } : {}),
      photos: photos.length,
    });
    return loan.id;
  });
  if (photos.length) await storePhotos(db, actor, loanId, "RUECKGABE", photos);
  const mail = await sendLoanProtocol(actor, loanId, "RUECKGABE");
  return { loanId, mail };
}

/** Weitere Fotos zu einem Leihvorgang nachreichen (z. B. Schaden erst später bemerkt). */
export async function addLoanPhotos(actor: Actor, loanId: string, phase: LoanPhase, formData: FormData) {
  assertCan(actor, "inventory.edit");
  const loan = await db.inventoryLoan.findUnique({ where: { id: loanId }, include: { photos: true } });
  if (!loan) throw new NotFoundError("Leihvorgang nicht gefunden.");
  if (phase === "RUECKGABE" && !loan.returnedAt) throw new UserError("Die Rückgabe ist noch nicht gebucht.");
  const files = photosFrom(formData);
  if (files.length === 0) throw new UserError("Bitte mindestens ein Foto auswählen.");
  if (loan.photos.filter((p) => p.phase === phase).length + files.length > 30) throw new UserError("Höchstens 30 Fotos je Ausgabe bzw. Rückgabe.");
  const photos = await Promise.all(files.map(normalizePhoto));
  await storePhotos(db, actor, loanId, phase, photos);
  await audit(db, actor, "inventory.loan_photos", "InventoryItem", loan.itemId, { loanId, phase, photos: photos.length });
}

async function loadLoan(loanId: string) {
  const loan = await db.inventoryLoan.findUnique({
    where: { id: loanId },
    include: { item: true, photos: { orderBy: { createdAt: "asc" } }, createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!loan) throw new NotFoundError("Leihvorgang nicht gefunden.");
  return loan;
}

function borrowerEmailOf(loan: Pick<InventoryLoan, "borrowerEmail">): string | null {
  if (!loan.borrowerEmail) return null;
  try {
    return decrypt(loan.borrowerEmail);
  } catch {
    return null;
  }
}

async function photoDataUris(photos: InventoryLoanPhoto[], phase: LoanPhase) {
  const out: { nr: number; bild: string }[] = [];
  for (const p of photos.filter((x) => x.phase === phase)) {
    try {
      const jpg = await sharp(await readStoredFile(p.path)).resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
      out.push({ nr: out.length + 1, bild: `data:image/jpeg;base64,${jpg.toString("base64")}` });
    } catch {
      // fehlende Datei überspringen – das Protokoll soll trotzdem entstehen
    }
  }
  return out;
}

const yesNo = (v: boolean | null) => (v === true ? "ja" : v === false ? "nein" : "");

/** Kontext für Vorlage inventar.leihprotokoll und die beiden Mails (Platzhalter leihe.*). */
export async function loanContext(loan: Awaited<ReturnType<typeof loadLoan>>, phase: LoanPhase, opts: { photos?: boolean } = {}) {
  const email = borrowerEmailOf(loan);
  const withPhotos = opts.photos !== false;
  return {
    leihe: {
      art: phase === "AUSGABE" ? "Ausgabe" : "Rückgabe",
      rueckgabe: phase === "RUECKGABE",
      code: loan.item.code,
      gegenstand: loan.item.name,
      kategorie: loan.item.category,
      beschreibung: loan.item.description,
      menge: loan.item.quantity,
      abholung: formatDate(loan.lentAt),
      uebergebenVon: loan.handedOverBy,
      ausleiher: loan.borrowerName || loan.borrower,
      organisation: loan.organization,
      email: email ?? "",
      zubehoer: loan.accessories,
      zustandAusgabe: loan.conditionOut,
      rueckgabeBis: loan.dueAt ? formatDate(loan.dueAt) : "",
      notiz: loan.note,
      rueckgabeAm: loan.returnedAt ? formatDate(loan.returnedAt) : "",
      zurueckgegebenVon: loan.returnedByName,
      angenommenVon: loan.receivedBy,
      zustandRueckgabe: loan.conditionIn,
      zustandGeaendert: !!loan.returnedAt && !!loan.conditionOut && loan.conditionIn !== loan.conditionOut,
      zubehoerVollstaendig: yesNo(loan.accessoriesComplete),
      bemerkungRueckgabe: loan.returnNote,
      fotosAusgabe: withPhotos ? await photoDataUris(loan.photos, "AUSGABE") : [],
      fotosRueckgabe: withPhotos && phase === "RUECKGABE" ? await photoDataUris(loan.photos, "RUECKGABE") : [],
      anzahlFotos: loan.photos.filter((p) => phase === "RUECKGABE" || p.phase === "AUSGABE").length,
      erstellt: formatDate(new Date()),
    },
  };
}

function protocolFileName(loan: { lentAt: Date; returnedAt: Date | null; item: { code: string } }, phase: LoanPhase) {
  const date = toDateInput(phase === "AUSGABE" ? loan.lentAt : (loan.returnedAt ?? new Date()));
  return `Leihprotokoll-${phase === "AUSGABE" ? "Ausgabe" : "Rueckgabe"}-${loan.item.code}-${date}.pdf`;
}

export async function loanProtocolPdf(actor: Actor, loanId: string, phase: LoanPhase) {
  assertCan(actor, "read");
  const loan = await loadLoan(loanId);
  if (phase === "RUECKGABE" && !loan.returnedAt) throw new UserError("Die Rückgabe ist noch nicht gebucht.");
  const { pdf } = await renderDocumentPdf("inventar.leihprotokoll", await loanContext(loan, phase), `Leihprotokoll ${loan.item.name}`);
  return { pdf, fileName: protocolFileName(loan, phase) };
}

/** Empfänger: übergebende/annehmende Person, wer gebucht hat, die ausleihende Person (falls E-Mail) und der Verteiler aus den Einstellungen. */
async function protocolRecipients(actor: Actor, loan: Awaited<ReturnType<typeof loadLoan>>, phase: LoanPhase) {
  const ids = [actor.id, loan.handedOverById, loan.createdById, phase === "RUECKGABE" ? loan.receivedById : null].filter((x): x is string => !!x);
  const users = await db.user.findMany({ where: { id: { in: ids }, active: true }, select: { email: true } });
  const settings = await getSettings();
  const borrower = borrowerEmailOf(loan);
  const all = [...(borrower ? [borrower] : []), ...users.map((u) => u.email), ...settings.inventory.notifyEmails].map((e) => e.trim().toLowerCase()).filter(Boolean);
  return [...new Set(all)];
}

/** Protokoll als PDF erzeugen und per Mail verschicken. Fehler beim Versand brechen die Buchung nicht ab. */
export async function sendLoanProtocol(actor: Actor, loanId: string, phase: LoanPhase): Promise<MailResult> {
  assertCan(actor, "inventory.edit");
  const loan = await loadLoan(loanId);
  if (phase === "RUECKGABE" && !loan.returnedAt) throw new UserError("Die Rückgabe ist noch nicht gebucht.");
  const recipients = await protocolRecipients(actor, loan, phase);
  if (recipients.length === 0) return { sent: false, recipients, error: "Keine Empfänger mit E-Mail-Adresse." };
  try {
    const ctx = await loanContext(loan, phase);
    const { pdf } = await renderDocumentPdf("inventar.leihprotokoll", ctx, `Leihprotokoll ${loan.item.name}`);
    const mail = await renderMail(phase === "AUSGABE" ? "inventar.ausgabe" : "inventar.rueckgabe", { leihe: { ...ctx.leihe, fotosAusgabe: [], fotosRueckgabe: [] } });
    await sendMail({
      to: recipients.join(", "),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: [{ filename: protocolFileName(loan, phase), content: pdf, contentType: "application/pdf" }],
    });
    await db.$transaction(async (tx) => {
      await tx.inventoryLoan.update({ where: { id: loanId }, data: phase === "AUSGABE" ? { outMailSentAt: new Date() } : { returnMailSentAt: new Date() } });
      await audit(tx, actor, "inventory.loan_protocol", "InventoryItem", loan.itemId, { loanId, phase, recipients: recipients.length });
    });
    return { sent: true, recipients };
  } catch (err) {
    if (err instanceof UserError) return { sent: false, recipients, error: err.message };
    console.error("[inventar] Leihprotokoll nicht versendet", err);
    return { sent: false, recipients, error: "Das Protokoll konnte nicht versendet werden." };
  }
}

/** Lesbare Zusammenfassung für die Erfolgsmeldung im Formular. */
export function mailSummary(r: MailResult) {
  if (r.sent) return `Protokoll per Mail an ${r.recipients.length} Empfänger gesendet.`;
  return `Protokoll nicht versendet: ${r.error ?? "unbekannter Fehler"} Es lässt sich im Verlauf als PDF öffnen und erneut senden.`;
}

/** Löschfrist: E-Mail der ausleihenden Person 12 Monate nach der Rückgabe entfernen. */
export async function purgeBorrowerEmails(now = new Date()) {
  const cutoff = new Date(now.getTime() - BORROWER_EMAIL_RETENTION_DAYS * 86_400_000);
  const res = await db.inventoryLoan.updateMany({ where: { borrowerEmail: { not: null }, returnedAt: { lt: cutoff } }, data: { borrowerEmail: null } });
  if (res.count) await audit(db, null, "inventory.retention", "InventoryLoan", null, { emailsDeleted: res.count });
  return res.count;
}

/** Fotodatei für die Anzeige (nur angemeldete Nutzer, geprüft in der Route). */
export async function loanPhotoFile(photoId: string) {
  const photo = await db.inventoryLoanPhoto.findUnique({ where: { id: photoId } });
  return photo ? readStoredFile(photo.path) : null;
}
