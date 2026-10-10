import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MarketingKind, type MarketingPost, type User } from "@prisma/client";
import { z as z4 } from "zod/v4";
import { checkbox, formToObject, optionalText, z } from "@/lib/validation";
import { parseDateTimeInput } from "@/lib/dates";
import { assertCan, can } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { readStoredFile, storedFileExists } from "@/server/files";
import { ovContext } from "@/server/ov";
import { renderText } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";
import { aiConfigured, draftModel } from "./ai-draft";
import { blogToHtml, SITE_LABELS, wordpressSite, wordpressSites, type WordpressSiteKey } from "./wordpress";

type Actor = Pick<User, "id" | "role">;

export const CHANNELS = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", x: "X", whatsapp: "WhatsApp-Kanal", newsletter: "Newsletter" } as const;
export type Channel = keyof typeof CHANNELS;

export function listPosts(actor: Actor) {
  assertCan(actor, "read");
  return db.marketingPost.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
    take: 200,
  });
}

export async function getPost(actor: Actor, id: string) {
  assertCan(actor, "read");
  const post = await db.marketingPost.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      bbrConcern: { select: { id: true, title: true, bezirk: true, kurzfassung: true, sourceKey: true } },
      publications: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      wordpress: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!post) throw new NotFoundError("Beitrag nicht gefunden.");
  return post;
}

export function canEditPost(actor: Actor, post: Pick<MarketingPost, "createdById" | "status">) {
  if (post.status === "VEROEFFENTLICHT") return false;
  if (can(actor.role, "marketing.publish")) return true;
  return can(actor.role, "marketing.create") && post.createdById === actor.id && post.status === "ENTWURF";
}

// ---------------------------------------------------------------------------
// KI-Entwurf
// ---------------------------------------------------------------------------

export const marketingDraftSchema = z4.object({
  title: z4.string(),
  body: z4.string(),
  hashtags: z4.string(),
});
export type MarketingDraft = z4.infer<typeof marketingDraftSchema>;

export function buildMarketingMessage(kind: MarketingKind, brief: string, channels: string[], tone: string) {
  return [
    `<art>${kind}</art>`,
    kind === "SOCIAL" ? `<kanaele>${channels.map((c) => CHANNELS[c as Channel] ?? c).join(", ") || "Facebook"}</kanaele>` : "",
    tone ? `<tonalitaet>${tone}</tonalitaet>` : "",
    "<stichpunkte>",
    brief,
    "</stichpunkte>",
    "",
    "Erstelle den Entwurf nach den Vorgaben als JSON mit den Feldern title, body, hashtags.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateMarketingDraft(
  kind: MarketingKind,
  brief: string,
  channels: string[],
  tone: string,
  client = new Anthropic(),
): Promise<MarketingDraft> {
  const { source } = await getTemplateSource("prompt.marketing");
  const system = renderText(source, { ov: await ovContext() });
  const response = await client.beta.messages.parse(
    {
      model: draftModel(),
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: buildMarketingMessage(kind, brief, channels, tone) }],
      output_config: { effort: "medium", format: betaZodOutputFormat(marketingDraftSchema) },
    },
    { timeout: 3 * 60_000 },
  );
  if (response.stop_reason === "refusal") throw new UserError("Die KI hat den Entwurf abgelehnt. Bitte Stichpunkte anpassen.");
  if (!response.parsed_output) throw new Error("Die Antwort der KI konnte nicht gelesen werden.");
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Anlegen / Bearbeiten
// ---------------------------------------------------------------------------

const channelList = z.preprocess(
  (v) => (Array.isArray(v) ? v : v ? [v] : []),
  z.array(z.enum(Object.keys(CHANNELS) as [Channel, ...Channel[]])),
);
const siteKey = z.preprocess((v) => (v === "" ? undefined : v), z.enum(["SF", "BBR"]).optional());

const createSchema = z.object({
  kind: z.enum(MarketingKind),
  brief: z.string().trim().min(10, { error: "Bitte ein paar Stichpunkte angeben (mind. 10 Zeichen)." }).max(8000),
  "channels[]": channelList,
  tone: optionalText(200),
  site: siteKey,
  useAi: checkbox,
  /** fertiger Text, z. B. aus dem Kandzior Studio übernommen; wird ohne KI-Entwurf als Beitragstext gesetzt */
  title: optionalText(200),
  body: optionalText(40000),
});

export async function createPost(actor: Actor, formData: FormData) {
  assertCan(actor, "marketing.create");
  const input = createSchema.parse(formToObject(formData));
  const channels = input.kind === "SOCIAL" ? input["channels[]"] : [];
  let draft: MarketingDraft = { title: input.title || (input.brief.split("\n")[0] ?? "").slice(0, 80), body: input.body ?? "", hashtags: "" };
  let aiUsed = false;
  if (input.useAi) {
    if (!aiConfigured()) throw new UserError("Für KI-Entwürfe ist kein ANTHROPIC_API_KEY hinterlegt. Ohne Häkchen wird ein leerer Entwurf angelegt.");
    draft = await generateMarketingDraft(input.kind, input.brief, channels, input.tone ?? "");
    aiUsed = true;
  }
  return db.$transaction(async (tx) => {
    const post = await tx.marketingPost.create({
      data: {
        kind: input.kind,
        brief: input.brief,
        channels,
        site: input.kind === "BLOG" ? (input.site ?? "SF") : null,
        title: draft.title.slice(0, 200),
        body: draft.body,
        hashtags: draft.hashtags,
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "marketing.create", "MarketingPost", post.id, { kind: post.kind, aiUsed });
    return post;
  });
}

const updateSchema = z.object({
  title: z.string().trim().max(200),
  body: z.string().max(40000),
  hashtags: optionalText(500),
  "channels[]": channelList,
  site: siteKey,
  plannedFor: optionalText(40),
});

export async function updatePost(actor: Actor, id: string, formData: FormData) {
  const before = await getPost(actor, id);
  if (!canEditPost(actor, before)) throw new ForbiddenError();
  const input = updateSchema.parse(formToObject(formData));
  const data = {
    title: input.title,
    body: input.body,
    hashtags: input.hashtags ?? "",
    channels: before.kind === "SOCIAL" ? input["channels[]"] : [],
    site: before.kind === "BLOG" ? (input.site ?? before.site ?? "SF") : null,
    plannedFor: input.plannedFor ? parseDateTimeInput(input.plannedFor) : null,
    // von Hand gespeichert → wird nicht mehr automatisch neu erzeugt (bbr-social.ts untouched)
    generatedAt: null,
    // Jede inhaltliche Änderung nach der Freigabe hebt die Freigabe auf
    ...(before.status === "FREIGEGEBEN" && (input.title !== before.title || input.body !== before.body)
      ? { status: "ENTWURF" as const, approvedAt: null, approvedById: null }
      : {}),
  };
  return db.$transaction(async (tx) => {
    const post = await tx.marketingPost.update({ where: { id }, data });
    await audit(tx, actor, "marketing.update", "MarketingPost", id, changes(before, data));
    return post;
  });
}

export async function approvePost(actor: Actor, id: string) {
  assertCan(actor, "marketing.publish");
  const post = await getPost(actor, id);
  if (post.status !== "ENTWURF") throw new UserError("Nur Entwürfe können freigegeben werden.");
  if (!post.title.trim() || !post.body.trim()) throw new UserError("Titel und Text dürfen nicht leer sein.");
  if (/\[[^\]]*ergänzen[^\]]*\]/i.test(post.body)) throw new UserError("Der Text enthält noch Platzhalter wie [… ergänzen].");
  await db.$transaction(async (tx) => {
    await tx.marketingPost.update({ where: { id }, data: { status: "FREIGEGEBEN", approvedAt: new Date(), approvedById: actor.id } });
    await audit(tx, actor, "marketing.approve", "MarketingPost", id);
  });
}

export async function revokeApproval(actor: Actor, id: string) {
  assertCan(actor, "marketing.publish");
  const post = await getPost(actor, id);
  if (post.status !== "FREIGEGEBEN") throw new UserError("Der Beitrag ist nicht freigegeben.");
  await db.$transaction(async (tx) => {
    await tx.marketingPost.update({ where: { id }, data: { status: "ENTWURF", approvedAt: null, approvedById: null } });
    await audit(tx, actor, "marketing.revoke", "MarketingPost", id);
  });
}

/** Social-Beitrag manuell gepostet (Teilen/Kopieren) → als veröffentlicht vermerken. */
export async function markPublished(actor: Actor, id: string) {
  assertCan(actor, "marketing.publish");
  const post = await getPost(actor, id);
  if (post.status !== "FREIGEGEBEN") throw new UserError("Bitte den Beitrag zuerst freigeben.");
  await db.$transaction(async (tx) => {
    await tx.marketingPost.update({ where: { id }, data: { status: "VEROEFFENTLICHT", publishedAt: new Date() } });
    await audit(tx, actor, "marketing.published", "MarketingPost", id, { manual: true });
  });
}

export type WordpressResult = { site: WordpressSiteKey; ok: true; status: string; link: string } | { site: WordpressSiteKey; ok: false; error: string };

/** Blogartikel an eine Webseite übertragen (neu oder Aktualisierung desselben WordPress-Beitrags). */
async function sendToSite(
  actor: Actor,
  post: { id: string; title: string; body: string; imagePath: string | null },
  siteKey: WordpressSiteKey,
  mode: "draft" | "publish",
  fetchImpl: typeof fetch,
): Promise<WordpressResult> {
  const site = wordpressSite(siteKey);
  if (!site) return { site: siteKey, ok: false, error: "keine WordPress-Zugangsdaten hinterlegt" };
  const authorization = `Basic ${Buffer.from(`${site.user}:${site.appPassword}`).toString("base64")}`;
  const existing = await db.wordpressPublication.findUnique({ where: { postId_site: { postId: post.id, site: siteKey } } });
  // Beitragsbild: Kachel einmal je Seite in die Mediathek laden (bei erneutem Senden wiederverwenden)
  let mediaId = existing?.wpMediaId ?? null;
  if (!mediaId && post.imagePath && (await storedFileExists(post.imagePath))) {
    const img = await readStoredFile(post.imagePath);
    const slug = post.title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "beitrag";
    const up = await fetchImpl(`${site.url}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${slug}.png"` },
      body: new Uint8Array(img),
    });
    if (!up.ok) return { site: siteKey, ok: false, error: `Beitragsbild abgelehnt (HTTP ${up.status})` };
    mediaId = ((await up.json()) as { id: number }).id;
  }
  const endpoint = existing ? `${site.url}/wp-json/wp/v2/posts/${existing.wpPostId}` : `${site.url}/wp-json/wp/v2/posts`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ title: post.title, content: blogToHtml(post.body), status: mode, ...(mediaId ? { featured_media: mediaId } : {}) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { site: siteKey, ok: false, error: `HTTP ${res.status} ${detail.slice(0, 150)}`.trim() };
  }
  const wp = (await res.json()) as { id: number; link: string; status: string };
  await db.$transaction(async (tx) => {
    const data = { wpPostId: wp.id, wpLink: wp.link, wpStatus: wp.status, wpMediaId: mediaId };
    await tx.wordpressPublication.upsert({
      where: { postId_site: { postId: post.id, site: siteKey } },
      create: { postId: post.id, site: siteKey, ...data },
      update: data,
    });
    await audit(tx, actor, "marketing.wordpress", "MarketingPost", post.id, { site: siteKey, wpId: wp.id, status: wp.status, mediaId });
  });
  return { site: siteKey, ok: true, status: wp.status, link: wp.link };
}

/**
 * Blogartikel über die WordPress-REST-API auf eine oder beide Webseiten übertragen – als Entwurf oder direkt
 * veröffentlicht. Ein Fehler auf einer Seite hält die andere nicht auf.
 */
export async function sendToWordpress(
  actor: Actor,
  id: string,
  sites: WordpressSiteKey[],
  mode: "draft" | "publish",
  fetchImpl: typeof fetch = fetch,
): Promise<WordpressResult[]> {
  assertCan(actor, "marketing.publish");
  const post = await getPost(actor, id);
  if (post.kind !== "BLOG") throw new UserError("Nur Blogartikel können an WordPress gesendet werden.");
  if (post.status === "ENTWURF") throw new UserError("Bitte den Artikel zuerst freigeben.");
  const unique = [...new Set(sites)].filter((k): k is WordpressSiteKey => k === "SF" || k === "BBR");
  if (unique.length === 0) throw new UserError("Bitte mindestens eine Webseite auswählen.");
  const results: WordpressResult[] = [];
  for (const site of unique) results.push(await sendToSite(actor, post, site, mode, fetchImpl));
  if (results.some((r) => r.ok && r.status === "publish") && post.status !== "VEROEFFENTLICHT") {
    await db.marketingPost.update({ where: { id }, data: { status: "VEROEFFENTLICHT", publishedAt: new Date() } });
  }
  if (results.every((r) => !r.ok)) {
    throw new UserError(`WordPress hat die Übertragung abgelehnt: ${results.map((r) => `${SITE_LABELS[r.site]} – ${r.ok ? "" : r.error}`).join("; ")}`);
  }
  return results;
}

export async function deletePost(actor: Actor, id: string) {
  const post = await getPost(actor, id);
  if (!canEditPost(actor, post)) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.marketingPost.delete({ where: { id } });
    await audit(tx, actor, "marketing.delete", "MarketingPost", id, { title: post.title });
  });
}

export { wordpressSites };
