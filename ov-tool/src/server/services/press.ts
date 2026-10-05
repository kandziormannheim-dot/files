import "server-only";
import { randomBytes } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { PressRelease, User } from "@prisma/client";
import { z as z4 } from "zod/v4";
import { formatDate, parseDateInput, parseDateTimeInput } from "@/lib/dates";
import { checkbox, formToObject, optionalText, optionalUrl, requiredText, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { renderMail } from "@/server/mail/render";
import { sendMail } from "@/server/mail/transport";
import { appUrl, ovContext } from "@/server/ov";
import { aiConfigured, draftModel } from "./ai-draft";
import { hashToken } from "./landing";
import { getSettings } from "./settings";

// Presseportal (SPEC.md 3.16): PM-Editor mit Freigabe, Veröffentlichung unter /presse, Einzelversand an den
// Presseverteiler (ohne offene Empfängerliste, ohne Öffnungs-Tracking), Registrierung mit Double-Opt-in + Freigabe.

type Actor = Pick<User, "id" | "role">;

export function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "pressemitteilung"
  );
}

/** Öffentlich sichtbar: veröffentlicht und Sperrfrist abgelaufen. */
export function isPublic(pm: Pick<PressRelease, "status" | "embargoUntil">, now = new Date()) {
  return pm.status === "VEROEFFENTLICHT" && (!pm.embargoUntil || pm.embargoUntil <= now);
}

export function listReleases(actor: Actor) {
  assertCan(actor, "read");
  return db.pressRelease.findMany({ orderBy: [{ updatedAt: "desc" }], take: 200 });
}

export async function getRelease(actor: Actor, id: string) {
  assertCan(actor, "read");
  const pm = await db.pressRelease.findUnique({ where: { id }, include: { clippings: { orderBy: { publishedOn: "desc" } } } });
  if (!pm) throw new NotFoundError();
  return pm;
}

const releaseSchema = z.object({
  title: requiredText(200),
  subtitle: optionalText(300),
  body: optionalText(20000),
  quoteGiver: optionalText(200),
  embargoUntil: optionalText(30),
});

function releaseData(formData: FormData) {
  const input = releaseSchema.parse(formToObject(formData));
  const embargoUntil = input.embargoUntil ? parseDateTimeInput(input.embargoUntil) : null;
  if (input.embargoUntil && !embargoUntil) throw new UserError("Ungültige Sperrfrist.");
  return { title: input.title, subtitle: input.subtitle ?? "", body: input.body ?? "", quoteGiver: input.quoteGiver ?? "", embargoUntil };
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = base;
  for (let i = 2; await db.pressRelease.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } }); i++) slug = `${base}-${i}`;
  return slug;
}

export async function createRelease(actor: Actor, formData: FormData) {
  assertCan(actor, "press.create");
  const data = releaseData(formData);
  const useAi = checkbox.parse(formData.get("useAi"));
  if (useAi) {
    if (!aiConfigured()) throw new UserError("Für KI-Entwürfe ist kein ANTHROPIC_API_KEY hinterlegt. Ohne Häkchen wird der Text übernommen.");
    const draft = await draftPressRelease(data.title, data.body, data.quoteGiver);
    Object.assign(data, { title: draft.title, subtitle: draft.subtitle, body: draft.body });
  }
  const slug = await uniqueSlug(slugify(data.title));
  return db.$transaction(async (tx) => {
    const pm = await tx.pressRelease.create({ data: { ...data, slug, createdById: actor.id } });
    await audit(tx, actor, "press.create", "PressRelease", pm.id, { title: pm.title, ai: useAi });
    return pm;
  });
}

export async function updateRelease(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "press.create");
  const data = releaseData(formData);
  return db.$transaction(async (tx) => {
    const before = await tx.pressRelease.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    if (before.sentAt) throw new UserError("Bereits versendete Pressemitteilungen können nicht mehr geändert werden.");
    const resetApproval = before.status !== "ENTWURF" && !can(actor.role, "press.publish");
    if (before.status === "VEROEFFENTLICHT" && !can(actor.role, "press.publish")) throw new ForbiddenError();
    await tx.pressRelease.update({ where: { id }, data: { ...data, ...(resetApproval ? { status: "ENTWURF", approvedAt: null, approvedById: null } : {}) } });
    await audit(tx, actor, "press.update", "PressRelease", id, changes(before as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>));
  });
}

export async function approveRelease(actor: Actor, id: string) {
  assertCan(actor, "press.publish");
  await db.$transaction(async (tx) => {
    const pm = await tx.pressRelease.findUnique({ where: { id } });
    if (!pm) throw new NotFoundError();
    if (!pm.body.trim()) throw new UserError("Die Pressemitteilung hat noch keinen Text.");
    await tx.pressRelease.update({ where: { id }, data: { status: "FREIGEGEBEN", approvedAt: new Date(), approvedById: actor.id } });
    await audit(tx, actor, "press.approve", "PressRelease", id, { title: pm.title });
  });
}

export async function revokeRelease(actor: Actor, id: string) {
  assertCan(actor, "press.publish");
  await db.$transaction(async (tx) => {
    const pm = await tx.pressRelease.findUnique({ where: { id } });
    if (!pm) throw new NotFoundError();
    await tx.pressRelease.update({ where: { id }, data: { status: "ENTWURF", approvedAt: null, approvedById: null, publishedAt: null } });
    await audit(tx, actor, "press.revoke", "PressRelease", id, { title: pm.title });
  });
}

export async function deleteRelease(actor: Actor, id: string) {
  assertCan(actor, "press.publish");
  await db.$transaction(async (tx) => {
    const pm = await tx.pressRelease.findUnique({ where: { id } });
    if (!pm) throw new NotFoundError();
    if (pm.sentAt) throw new UserError("Versendete Pressemitteilungen bleiben zur Dokumentation erhalten.");
    await tx.pressRelease.delete({ where: { id } });
    await audit(tx, actor, "press.delete", "PressRelease", id, { title: pm.title });
  });
}

function releaseMailContext(pm: PressRelease, pressContact: string) {
  return {
    pm: {
      titel: pm.title,
      untertitel: pm.subtitle,
      datum: formatDate(pm.embargoUntil && pm.embargoUntil > new Date() ? pm.embargoUntil : new Date()),
      text: pm.body,
      link: `${appUrl()}/presse/${pm.slug}`,
    },
    pressekontakt: pressContact,
  };
}

/**
 * Veröffentlichen (Portal) und optional an den Verteiler senden – je Empfänger eine eigene Mail.
 * Bei Sperrfrist erscheint die PM im Portal erst ab diesem Zeitpunkt; der Versand erfolgt sofort mit Sperrfristvermerk.
 */
export async function publishRelease(actor: Actor, id: string, send: boolean) {
  assertCan(actor, "press.publish");
  const pm = await db.pressRelease.findUnique({ where: { id } });
  if (!pm) throw new NotFoundError();
  if (pm.status === "ENTWURF") throw new UserError("Bitte die Pressemitteilung zuerst freigeben.");
  if (send && pm.sentAt) throw new UserError("Diese Pressemitteilung wurde bereits versendet.");
  const now = new Date();
  let sent = 0;
  if (send) {
    const settings = await getSettings();
    const contacts = await db.pressContact.findMany({ where: { status: "AKTIV" } });
    if (contacts.length === 0) throw new UserError("Im Presseverteiler ist noch niemand aktiv.");
    const base = releaseMailContext(pm, settings.publicSite.pressContact);
    for (const c of contacts) {
      const ctx = { ...base, empfaenger: { name: c.name }, abmeldeLink: `${appUrl()}/presse/abmelden/${c.unsubscribeToken}` };
      if (pm.embargoUntil && pm.embargoUntil > now) ctx.pm.text = `SPERRFRIST: ${formatDate(pm.embargoUntil)} – nicht vorher veröffentlichen.\n\n${pm.body}`;
      const mail = await renderMail("presse.mitteilung", ctx);
      await sendMail({ to: c.email, subject: mail.subject, text: mail.text, html: mail.html });
      sent++;
    }
  }
  await db.$transaction(async (tx) => {
    await tx.pressRelease.update({
      where: { id },
      data: { status: "VEROEFFENTLICHT", publishedAt: pm.publishedAt ?? (pm.embargoUntil && pm.embargoUntil > now ? pm.embargoUntil : now), ...(send ? { sentAt: now, sentCount: sent } : {}) },
    });
    await audit(tx, actor, send ? "press.send" : "press.publish", "PressRelease", id, { title: pm.title, recipients: sent });
  });
  return { sent };
}

// ---------------------------------------------------------------------------
// KI-Entwurf (optional)
// ---------------------------------------------------------------------------

const pmDraftSchema = z4.object({ title: z4.string(), subtitle: z4.string(), body: z4.string() });

export async function draftPressRelease(title: string, notes: string, quoteGiver: string, client = new Anthropic()) {
  const ov = await ovContext();
  const system = `Du schreibst Pressemitteilungen für die ${ov.nameLang}. Sachlich, nachrichtlich, umgekehrte Pyramide (Wichtigstes zuerst), Ortsmarke „Mannheim-Seckenheim.“ oder „Mannheim-Friedrichsfeld.“ am Anfang, 2500–3500 Zeichen, keine erfundenen Fakten, Zahlen oder Namen. Zitate nur, wenn ein Zitatgeber genannt ist, und dann als Vorschlag in Anführungszeichen. Absätze durch Leerzeilen trennen, keine Markdown-Überschriften. Antworte als JSON mit title, subtitle, body.`;
  const user = `<titel>${title}</titel>\n<stichpunkte>\n${notes}\n</stichpunkte>\n${quoteGiver ? `<zitatgeber>${quoteGiver}</zitatgeber>` : ""}`;
  const res = await client.beta.messages.parse(
    { model: draftModel(), max_tokens: 4000, system, messages: [{ role: "user", content: user }], output_config: { effort: "medium", format: betaZodOutputFormat(pmDraftSchema) } },
    { timeout: 3 * 60_000 },
  );
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new UserError("Die KI konnte keinen Entwurf erstellen. Bitte Stichpunkte anpassen.");
  return res.parsed_output;
}

// ---------------------------------------------------------------------------
// Presseverteiler
// ---------------------------------------------------------------------------

export function listContacts(actor: Actor) {
  assertCan(actor, "press.contacts");
  return db.pressContact.findMany({ orderBy: [{ status: "asc" }, { medium: "asc" }, { name: "asc" }] });
}

const contactSchema = z.object({
  name: requiredText(200),
  medium: requiredText(200),
  role: optionalText(200),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email({ error: "Bitte eine gültige E-Mail-Adresse angeben." }).max(200)),
  phone: optionalText(50),
  topics: optionalText(500),
});

/** Admin trägt Kontakt direkt ein (z. B. bekannte Lokalredaktion) – aktiv ohne Double-Opt-in, Einwilligung liegt beim OV. */
export async function addContact(actor: Actor, formData: FormData) {
  assertCan(actor, "press.contacts");
  const input = contactSchema.parse(formToObject(formData));
  if (await db.pressContact.findUnique({ where: { email: input.email } })) throw new UserError("Diese E-Mail-Adresse ist bereits im Verteiler.");
  await db.$transaction(async (tx) => {
    const c = await tx.pressContact.create({
      data: { ...input, role: input.role ?? "", phone: input.phone ?? "", topics: input.topics ?? "", status: "AKTIV", confirmedAt: new Date(), approvedAt: new Date() },
    });
    await audit(tx, actor, "press.contact.create", "PressContact", c.id, { medium: c.medium });
  });
}

export async function setContactStatus(actor: Actor, id: string, status: "AKTIV" | "ABGEMELDET") {
  assertCan(actor, "press.contacts");
  await db.$transaction(async (tx) => {
    const c = await tx.pressContact.findUnique({ where: { id } });
    if (!c) throw new NotFoundError();
    if (status === "AKTIV" && c.status === "UNBESTAETIGT") throw new UserError("Die E-Mail-Adresse ist noch nicht bestätigt (Double-Opt-in).");
    await tx.pressContact.update({ where: { id }, data: { status, ...(status === "AKTIV" ? { approvedAt: new Date() } : {}) } });
    await audit(tx, actor, status === "AKTIV" ? "press.contact.approve" : "press.contact.deactivate", "PressContact", id, { medium: c.medium });
  });
}

export async function deleteContact(actor: Actor, id: string) {
  assertCan(actor, "press.contacts");
  await db.$transaction(async (tx) => {
    const c = await tx.pressContact.delete({ where: { id } });
    await audit(tx, actor, "press.contact.delete", "PressContact", id, { medium: c.medium });
  });
}

/** Öffentliche Registrierung (Double-Opt-in, danach Freigabe durch den OV). */
export async function registerContact(formData: FormData) {
  const raw = formToObject(formData);
  if (raw.website) return; // Honigtopf
  const consent = checkbox.parse(raw.consent);
  if (!consent) throw new UserError("Bitte in die Aufnahme in den Presseverteiler einwilligen.");
  const input = contactSchema.parse(raw);
  const existing = await db.pressContact.findUnique({ where: { email: input.email } });
  if (existing && existing.status !== "ABGEMELDET" && existing.status !== "UNBESTAETIGT") return; // keine Auskunft, ob Adresse existiert
  const token = randomBytes(32).toString("base64url");
  const data = { ...input, role: input.role ?? "", phone: input.phone ?? "", topics: input.topics ?? "", status: "UNBESTAETIGT" as const, confirmHash: hashToken(token), confirmedAt: null, approvedAt: null };
  const c = existing ? await db.pressContact.update({ where: { id: existing.id }, data }) : await db.pressContact.create({ data });
  await audit(db, null, "press.contact.register", "PressContact", c.id, { medium: c.medium });
  const settings = await getSettings();
  const mail = await renderMail("presse.bestaetigung", {
    empfaenger: { name: input.name },
    bestaetigung: { link: `${appUrl()}/presse/bestaetigen/${token}`, loeschfristTage: 30, datenschutz: settings.publicSite.privacyUrl },
  });
  await sendMail({ to: input.email, subject: mail.subject, text: mail.text, html: mail.html });
}

export async function confirmContact(token: string) {
  const c = await db.pressContact.findUnique({ where: { confirmHash: hashToken(token) } });
  if (!c) return false;
  await db.pressContact.update({ where: { id: c.id }, data: { status: "WARTET", confirmedAt: new Date(), confirmHash: null } });
  await audit(db, null, "press.contact.confirm", "PressContact", c.id, { medium: c.medium });
  return true;
}

export async function unsubscribeContact(token: string) {
  const c = await db.pressContact.findUnique({ where: { unsubscribeToken: token } });
  if (!c) return false;
  if (c.status !== "ABGEMELDET") {
    await db.pressContact.update({ where: { id: c.id }, data: { status: "ABGEMELDET" } });
    await audit(db, null, "press.contact.unsubscribe", "PressContact", c.id, { medium: c.medium });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Pressespiegel
// ---------------------------------------------------------------------------

const clippingSchema = z.object({
  title: requiredText(300),
  medium: requiredText(200),
  publishedOn: z.string().transform((v, ctx) => {
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Bitte ein Datum angeben." });
    return d as Date;
  }),
  url: optionalUrl,
  note: optionalText(1000),
  releaseId: optionalText(50),
});

export function listClippings(actor: Actor) {
  assertCan(actor, "read");
  return db.pressClipping.findMany({ orderBy: { publishedOn: "desc" }, take: 200, include: { release: { select: { id: true, title: true } } } });
}

export async function addClipping(actor: Actor, formData: FormData) {
  assertCan(actor, "press.create");
  const input = clippingSchema.parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    const c = await tx.pressClipping.create({
      data: { title: input.title, medium: input.medium, publishedOn: input.publishedOn, url: input.url ?? "", note: input.note ?? "", releaseId: input.releaseId || null, createdById: actor.id },
    });
    await audit(tx, actor, "press.clipping.create", "PressClipping", c.id, { title: c.title, medium: c.medium });
  });
}

export async function deleteClipping(actor: Actor, id: string) {
  assertCan(actor, "press.create");
  await db.$transaction(async (tx) => {
    const c = await tx.pressClipping.delete({ where: { id } });
    await audit(tx, actor, "press.clipping.delete", "PressClipping", id, { title: c.title });
  });
}

// ---------------------------------------------------------------------------
// Öffentlich
// ---------------------------------------------------------------------------

export async function publicReleases(q?: string) {
  const now = new Date();
  const term = q?.trim();
  return db.pressRelease.findMany({
    where: {
      status: "VEROEFFENTLICHT",
      OR: [{ embargoUntil: null }, { embargoUntil: { lte: now } }],
      ...(term ? { AND: [{ OR: [{ title: { contains: term, mode: "insensitive" } }, { body: { contains: term, mode: "insensitive" } }] }] } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });
}

export async function publicRelease(slug: string) {
  const pm = await db.pressRelease.findUnique({ where: { slug } });
  return pm && isPublic(pm) ? pm : null;
}
