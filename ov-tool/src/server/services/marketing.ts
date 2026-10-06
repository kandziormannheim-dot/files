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
import { ovContext } from "@/server/ov";
import { renderText } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";
import { aiConfigured, draftModel } from "./ai-draft";
import { blogToHtml, wordpressSite, wordpressSites, type WordpressSiteKey } from "./wordpress";

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
});

export async function createPost(actor: Actor, formData: FormData) {
  assertCan(actor, "marketing.create");
  const input = createSchema.parse(formToObject(formData));
  const channels = input.kind === "SOCIAL" ? input["channels[]"] : [];
  let draft: MarketingDraft = { title: (input.brief.split("\n")[0] ?? "").slice(0, 80), body: "", hashtags: "" };
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

/** Blogartikel über die WordPress-REST-API übertragen – als Entwurf oder direkt veröffentlicht. */
export async function sendToWordpress(actor: Actor, id: string, mode: "draft" | "publish", fetchImpl: typeof fetch = fetch) {
  assertCan(actor, "marketing.publish");
  const post = await getPost(actor, id);
  if (post.kind !== "BLOG") throw new UserError("Nur Blogartikel können an WordPress gesendet werden.");
  if (post.status !== "FREIGEGEBEN") throw new UserError("Bitte den Artikel zuerst freigeben.");
  const site = wordpressSite((post.site ?? "SF") as WordpressSiteKey);
  if (!site) throw new UserError("Für diese Webseite sind keine WordPress-Zugangsdaten hinterlegt (Umgebungsvariablen WP_…).");
  const endpoint = post.wpPostId ? `${site.url}/wp-json/wp/v2/posts/${post.wpPostId}` : `${site.url}/wp-json/wp/v2/posts`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${site.user}:${site.appPassword}`).toString("base64")}` },
    body: JSON.stringify({ title: post.title, content: blogToHtml(post.body), status: mode }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UserError(`WordPress hat die Übertragung abgelehnt (HTTP ${res.status}). ${detail.slice(0, 200)}`);
  }
  const wp = (await res.json()) as { id: number; link: string; status: string };
  await db.$transaction(async (tx) => {
    await tx.marketingPost.update({
      where: { id },
      data: {
        wpPostId: wp.id,
        wpLink: wp.link,
        wpStatus: wp.status,
        ...(wp.status === "publish" ? { status: "VEROEFFENTLICHT" as const, publishedAt: new Date() } : {}),
      },
    });
    await audit(tx, actor, "marketing.wordpress", "MarketingPost", id, { site: site.key, wpId: wp.id, status: wp.status });
  });
  return wp;
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
