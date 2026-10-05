import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { LandingKind, type LandingPage, type User } from "@prisma/client";
import { parseDateTimeInput } from "@/lib/dates";
import { checkbox, formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { decrypt, encrypt, encryptionConfigured } from "@/server/crypto";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { renderMail } from "@/server/mail/render";
import { sendMail } from "@/server/mail/transport";
import { appUrl } from "@/server/ov";
import { getSettings } from "./settings";

// Landing Pages (SPEC.md 3.15): öffentlich unter /p/<kurzname>, nur nach Freigabe, CDU-CI, ohne Tracker.
// Formulare: nur nötige Felder, Einwilligung Pflicht, Double-Opt-in für den Newsletter, automatische Löschung.

type Actor = Pick<User, "id" | "role">;

export const LANDING_KIND_LABELS: Record<LandingKind, string> = {
  VERANSTALTUNG: "Veranstaltung mit Anmeldung",
  KAMPAGNE: "Kampagne / Thema",
  UMFRAGE: "Umfrage / Bürgerbeteiligung",
  UNTERSTUETZER: "Unterstützerliste",
  PERSON: "Kandidat / Person",
  LINKS: "Linkseite",
};

const DEFAULT_CONSENT =
  "Ich willige ein, dass die CDU {ov} meine Angaben zur Bearbeitung dieses Anliegens speichert und mich dazu kontaktiert. Die Daten werden nach Abschluss, spätestens nach {tage} Tagen gelöscht. Ich kann die Einwilligung jederzeit widerrufen.";

const NEWSLETTER_CONFIRM_DAYS = 7;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type LandingLink = { label: string; url: string };
export type SubmissionData = { name: string; email: string; phone: string; message: string };

export function landingLinks(page: Pick<LandingPage, "links">): LandingLink[] {
  return Array.isArray(page.links) ? (page.links as unknown as LandingLink[]).filter((l) => l && typeof l.url === "string") : [];
}

export function isLive(page: Pick<LandingPage, "status" | "expiresAt">, now = new Date()) {
  return page.status === "FREIGEGEBEN" && (!page.expiresAt || page.expiresAt > now);
}

export function listPages(actor: Actor) {
  assertCan(actor, "read");
  return db.landingPage.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { submissions: true } } } });
}

export async function getPage(actor: Actor, id: string) {
  assertCan(actor, "read");
  const page = await db.landingPage.findUnique({ where: { id }, include: { _count: { select: { submissions: true } } } });
  if (!page) throw new NotFoundError();
  return page;
}

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/, { error: "Nur Kleinbuchstaben, Ziffern und Bindestriche (2–60 Zeichen)." });

function parseLinks(raw: string | undefined): LandingLink[] {
  if (!raw) return [];
  const links: LandingLink[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(.*?)\s*[|–-]\s*(https?:\/\/\S+)$/) ?? t.match(/^()(https?:\/\/\S+)$/);
    if (!m) throw new UserError(`Link nicht erkannt: „${t}“. Format: Beschriftung | https://…`);
    links.push({ label: m[1]?.trim() || m[2]!, url: m[2]! });
  }
  return links.slice(0, 30);
}

const pageSchema = z.object({
  title: requiredText(200),
  slug: slugField,
  kind: z.enum(LandingKind),
  subtitle: optionalText(300),
  body: optionalText(20000),
  eventAt: optionalText(30),
  eventLocation: optionalText(300),
  links: optionalText(5000),
  formEnabled: checkbox,
  formTitle: optionalText(200),
  askPhone: checkbox,
  askMessage: checkbox,
  messageLabel: optionalText(200),
  consentText: optionalText(2000),
  newsletterOption: checkbox,
  expiresAt: optionalText(30),
  retentionDays: z.coerce.number().int().min(7, { error: "Mindestens 7 Tage." }).max(730, { error: "Höchstens 730 Tage." }),
});

async function toData(formData: FormData) {
  const input = pageSchema.parse(formToObject(formData));
  const eventAt = input.eventAt ? parseDateTimeInput(input.eventAt) : null;
  const expiresAt = input.expiresAt ? parseDateTimeInput(input.expiresAt) : null;
  if (input.eventAt && !eventAt) throw new UserError("Ungültiger Termin.");
  if (input.expiresAt && !expiresAt) throw new UserError("Ungültiges Ablaufdatum.");
  const settings = await getSettings();
  return {
    title: input.title,
    slug: input.slug,
    kind: input.kind,
    subtitle: input.subtitle ?? "",
    body: input.body ?? "",
    eventAt,
    eventLocation: input.eventLocation ?? "",
    links: parseLinks(input.links) as unknown as object,
    formEnabled: input.formEnabled,
    formTitle: input.formTitle ?? "",
    askPhone: input.askPhone,
    askMessage: input.askMessage,
    messageLabel: input.messageLabel ?? "",
    consentText: input.consentText?.trim() || DEFAULT_CONSENT.replace("{ov}", settings.ov.name).replace("{tage}", String(input.retentionDays)),
    newsletterOption: input.newsletterOption,
    expiresAt,
    retentionDays: input.retentionDays,
  };
}

export async function createPage(actor: Actor, formData: FormData) {
  assertCan(actor, "landing.edit");
  const data = await toData(formData);
  if (await db.landingPage.findUnique({ where: { slug: data.slug } })) throw new UserError("Dieser Kurzname ist schon vergeben.");
  return db.$transaction(async (tx) => {
    const page = await tx.landingPage.create({ data: { ...data, createdById: actor.id } });
    await audit(tx, actor, "landing.create", "LandingPage", page.id, { slug: page.slug, title: page.title });
    return page;
  });
}

export async function updatePage(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "landing.edit");
  const data = await toData(formData);
  return db.$transaction(async (tx) => {
    const before = await tx.landingPage.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    if (data.slug !== before.slug && (await tx.landingPage.findUnique({ where: { slug: data.slug } }))) throw new UserError("Dieser Kurzname ist schon vergeben.");
    // Änderungen ohne Freigaberecht nehmen die Freigabe zurück (Freigabe vor Veröffentlichung, SPEC 3.15)
    const resetApproval = before.status === "FREIGEGEBEN" && !can(actor.role, "landing.publish");
    await tx.landingPage.update({
      where: { id },
      data: { ...data, ...(resetApproval ? { status: "ENTWURF", approvedAt: null, approvedById: null } : {}) },
    });
    await audit(tx, actor, "landing.update", "LandingPage", id, { ...changes(before as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>), ...(resetApproval ? { freigabe: "zurückgenommen" } : {}) });
    return { resetApproval };
  });
}

export async function setPageStatus(actor: Actor, id: string, status: "ENTWURF" | "FREIGEGEBEN" | "ARCHIVIERT") {
  assertCan(actor, "landing.publish");
  await db.$transaction(async (tx) => {
    const page = await tx.landingPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundError();
    await tx.landingPage.update({
      where: { id },
      data: { status, ...(status === "FREIGEGEBEN" ? { approvedAt: new Date(), approvedById: actor.id } : {}) },
    });
    await audit(tx, actor, `landing.${status === "FREIGEGEBEN" ? "approve" : status === "ARCHIVIERT" ? "archive" : "unpublish"}`, "LandingPage", id, { slug: page.slug });
  });
}

export async function deletePage(actor: Actor, id: string) {
  assertCan(actor, "landing.publish");
  await db.$transaction(async (tx) => {
    const page = await tx.landingPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundError();
    await tx.landingPage.delete({ where: { id } });
    await audit(tx, actor, "landing.delete", "LandingPage", id, { slug: page.slug });
  });
}

// ---------------------------------------------------------------------------
// Einträge
// ---------------------------------------------------------------------------

function readPayload(s: { payload: string; encrypted: boolean }): SubmissionData {
  try {
    return JSON.parse(s.encrypted ? decrypt(s.payload) : s.payload) as SubmissionData;
  } catch {
    return { name: "(nicht lesbar)", email: "", phone: "", message: "" };
  }
}

export async function listSubmissions(actor: Actor, pageId: string) {
  assertCan(actor, "landing.publish");
  const rows = await db.landingSubmission.findMany({ where: { pageId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, newsletter: r.newsletter, confirmedAt: r.confirmedAt, ...readPayload(r) }));
}

export async function deleteSubmission(actor: Actor, id: string) {
  assertCan(actor, "landing.publish");
  await db.$transaction(async (tx) => {
    const s = await tx.landingSubmission.delete({ where: { id } });
    await audit(tx, actor, "landing.submission.delete", "LandingSubmission", id, { pageId: s.pageId });
  });
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;

export async function submissionsCsv(actor: Actor, pageId: string) {
  const rows = await listSubmissions(actor, pageId);
  await audit(db, actor, "landing.submission.export", "LandingPage", pageId, { count: rows.length });
  const header = ["Eingang", "Name", "E-Mail", "Telefon", "Nachricht", "Newsletter bestätigt"];
  const lines = rows.map((r) =>
    [r.createdAt.toISOString(), r.name, r.email, r.phone, r.message, r.newsletter && r.confirmedAt ? "ja" : "nein"].map((v) => csvCell(String(v))).join(";"),
  );
  return "﻿" + [header.map(csvCell).join(";"), ...lines].join("\r\n");
}

// ---------------------------------------------------------------------------
// Öffentlicher Teil
// ---------------------------------------------------------------------------

export async function getPublicPage(slug: string) {
  const page = await db.landingPage.findUnique({ where: { slug } });
  if (!page || !isLive(page)) return null;
  return page;
}

/** Aufrufe serverseitig zählen – ohne Cookies, ohne IP-Speicherung. */
export async function countView(id: string) {
  await db.landingPage.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => undefined);
}

const submitSchema = z.object({
  name: requiredText(200),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email({ error: "Bitte eine gültige E-Mail-Adresse angeben." }).max(200)),
  phone: optionalText(50),
  message: optionalText(3000),
  consent: checkbox.refine((v) => v, { error: "Bitte der Verarbeitung Ihrer Angaben zustimmen." }),
  newsletter: checkbox,
  website: optionalText(200), // Honigtopf gegen Spam-Bots
});

export async function submitLanding(slug: string, formData: FormData) {
  const page = await getPublicPage(slug);
  if (!page || !page.formEnabled) throw new UserError("Diese Seite nimmt keine Einträge (mehr) an.");
  const input = submitSchema.parse(formToObject(formData));
  if (input.website) return { newsletter: false }; // Bot: still erfolgreich wirken
  const data: SubmissionData = {
    name: input.name,
    email: input.email,
    phone: page.askPhone ? input.phone ?? "" : "",
    message: page.askMessage ? input.message ?? "" : "",
  };
  const json = JSON.stringify(data);
  const enc = encryptionConfigured();
  const newsletter = page.newsletterOption && input.newsletter;
  const token = newsletter ? randomBytes(32).toString("base64url") : null;
  await db.landingSubmission.create({
    data: { pageId: page.id, payload: enc ? encrypt(json) : json, encrypted: enc, newsletter, confirmHash: token ? hashToken(token) : null },
  });
  if (token) {
    const settings = await getSettings();
    const mail = await renderMail("landing.bestaetigung", {
      empfaenger: { name: data.name },
      seite: { titel: page.title, link: `${appUrl()}/p/${page.slug}` },
      bestaetigung: { link: `${appUrl()}/p/${page.slug}/bestaetigen/${token}`, loeschfristTage: page.retentionDays, datenschutz: settings.publicSite.privacyUrl },
    });
    await sendMail({ to: data.email, subject: mail.subject, text: mail.text, html: mail.html });
  }
  return { newsletter };
}

export async function confirmNewsletter(token: string) {
  const s = await db.landingSubmission.findUnique({ where: { confirmHash: hashToken(token) } });
  if (!s) return false;
  await db.landingSubmission.update({ where: { id: s.id }, data: { confirmedAt: new Date(), confirmHash: null } });
  return true;
}

/** Löschfristen: Einträge nach retentionDays, unbestätigte Newsletter-Häkchen nach 7 Tagen. */
export async function enforceLandingRetention(now = new Date()) {
  let deleted = 0;
  const pages = await db.landingPage.findMany({ select: { id: true, retentionDays: true } });
  for (const p of pages) {
    const r = await db.landingSubmission.deleteMany({ where: { pageId: p.id, createdAt: { lt: new Date(now.getTime() - p.retentionDays * 86_400_000) } } });
    deleted += r.count;
  }
  const unconfirmed = await db.landingSubmission.updateMany({
    where: { newsletter: true, confirmedAt: null, createdAt: { lt: new Date(now.getTime() - NEWSLETTER_CONFIRM_DAYS * 86_400_000) } },
    data: { newsletter: false, confirmHash: null },
  });
  if (deleted || unconfirmed.count) await audit(db, null, "landing.retention", "LandingSubmission", null, { deleted, newsletterRevoked: unconfirmed.count });
  return { deleted, newsletterRevoked: unconfirmed.count };
}
