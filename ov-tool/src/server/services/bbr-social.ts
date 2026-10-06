import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BbrConcern, MarketingPost, Prisma, User } from "@prisma/client";
import { z as z4 } from "zod/v4";
import { bbrAccountName, BEZIRKE, kurzfassungKey, kurzfassungLines } from "@/lib/bbr-card";
import { checkbox, formToObject, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { deleteStoredFile, readStoredFile, saveFile } from "@/server/files";
import { enqueue } from "@/server/jobs/queue";
import { renderSocialImage, renderSocialVideo, type Branding, type Creative } from "@/server/media/social";
import { ovContext } from "@/server/ov";
import { renderText } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";
import { aiConfigured, draftModel } from "./ai-draft";
import { deckConfigured, fetchDeckCards, type DeckCard } from "./deck";
import { getSettingsUncached } from "./settings";

// BBR-Anliegen → Social Media und Blog (auf Knopfdruck, keine Automatik):
// 1. „Anliegen abrufen“ liest die Karten der Deck-Boards „BBR Seckenheim“ und „BBR Friedrichsfeld“ (nur Überschrift, Bezirk, Kurzfassung).
// 2. „Beiträge erstellen“ erzeugt zu einem Anliegen die gewählten Entwürfe: BBR-Kanal (sachlich), OV-Kanal
//    (politisch) – je Texte für Facebook, Instagram, X, TikTok mit Bildkachel und Kurzvideo im CDU-CI – und
//    einen Blogartikel für cdu-sf.de oder bbr.cdu-sf.de.
// 3. Veröffentlicht wird erst nach Freigabe im Tool (CLAUDE.md Regel 12). Freigegebene oder veröffentlichte
//    Beiträge werden nie überschrieben; dann entsteht ein zusätzlicher Entwurf.

type Actor = Pick<User, "id" | "role">;
export type SocialAccount = "BBR" | "OV";
export const SOCIAL_ACCOUNTS: SocialAccount[] = ["BBR", "OV"];

export const GEN_STATUS: Record<string, string> = {
  NEU: "noch keine Beiträge",
  LAEUFT: "wird erstellt",
  FERTIG: "Entwürfe erstellt",
  GEAENDERT: "Kurzfassung geändert",
  FEHLER: "Fehler",
};

// ---------------------------------------------------------------------------
// KI-Entwurf (beide Kanäle in einem Aufruf)
// ---------------------------------------------------------------------------

const variantSchema = z4.object({
  title: z4.string(),
  facebook: z4.string(),
  instagram: z4.string(),
  x: z4.string(),
  tiktok: z4.string(),
  headline: z4.string(),
  subline: z4.string(),
  scenes: z4.array(z4.string()),
  outro: z4.string(),
  hashtags: z4.string(),
});
const blogSchema = z4.object({ title: z4.string(), body: z4.string() });
export const socialDraftSchema = z4.object({ bbr: variantSchema, ov: variantSchema, blog: blogSchema });
export type SocialVariant = z4.infer<typeof variantSchema>;
export type SocialDraft = z4.infer<typeof socialDraftSchema>;

type ConcernInput = Pick<BbrConcern, "title" | "bezirk" | "kurzfassung">;

export type BlogSite = "SF" | "BBR";
export type GenerateTargets = { bbr: boolean; ov: boolean; blog: BlogSite | null };
export const ALL_TARGETS: GenerateTargets = { bbr: true, ov: true, blog: "BBR" };

export function buildSocialMessage(c: ConcernInput, blogSite: BlogSite = "BBR") {
  return [
    `<bezirk>${c.bezirk ?? "Seckenheim/Friedrichsfeld"}</bezirk>`,
    `<blogseite>${blogSite === "BBR" ? "bbr.cdu-sf.de (CDU-Gruppe im Bezirksbeirat)" : "cdu-sf.de (CDU-Ortsverband)"}</blogseite>`,
    `<ueberschrift>${c.title}</ueberschrift>`,
    "<kurzfassung>",
    c.kurzfassung,
    "</kurzfassung>",
    "",
    "Erstelle die Entwürfe für beide Kanäle (bbr, ov) und den Blogartikel (blog) nach den Vorgaben als JSON.",
  ].join("\n");
}

export async function generateSocialDraft(c: ConcernInput, blogSite: BlogSite, client = new Anthropic()): Promise<SocialDraft> {
  const { source } = await getTemplateSource("prompt.bbr-social");
  const system = renderText(source, { ov: await ovContext() });
  const response = await client.beta.messages.parse(
    {
      model: draftModel(),
      max_tokens: 10000,
      system,
      messages: [{ role: "user", content: buildSocialMessage(c, blogSite) }],
      output_config: { effort: "medium", format: betaZodOutputFormat(socialDraftSchema) },
    },
    { timeout: 3 * 60_000 },
  );
  if (response.stop_reason === "refusal") throw new UserError("Die KI hat den Entwurf abgelehnt.");
  if (!response.parsed_output) throw new Error("Die Antwort der KI konnte nicht gelesen werden.");
  return response.parsed_output;
}

/** Entwurf ohne KI (kein ANTHROPIC_API_KEY): Kurzfassung als Text, Zeilen als Videotafeln. */
export function fallbackDraft(c: ConcernInput, blogSite: BlogSite = "BBR"): SocialDraft {
  const lines = kurzfassungLines(c.kurzfassung);
  const ort = c.bezirk ?? "Seckenheim/Friedrichsfeld";
  const tags = `#${(c.bezirk ?? "Seckenheim").replace(/[^A-Za-zÄÖÜäöüß]/g, "")} #Bezirksbeirat #CDUMannheim`;
  const base = { title: c.title.slice(0, 80), headline: c.title.slice(0, 70), scenes: lines.slice(0, 4), hashtags: tags };
  return {
    bbr: {
      ...base,
      facebook: `${c.title}\n\n${c.kurzfassung}\n\nHinweise und Anregungen aus ${ort} nehmen wir gerne auf – schreiben Sie uns!`,
      instagram: `${c.title}\n\n${c.kurzfassung}`,
      x: `${c.title} – unser Anliegen im Bezirksbeirat ${ort}. #Bezirksbeirat`.slice(0, 260),
      tiktok: `${c.title} – aus dem Bezirksbeirat ${ort}`.slice(0, 150),
      subline: `Unser Anliegen im Bezirksbeirat ${ort}`,
      outro: "Ihre Hinweise sind uns wichtig!",
    },
    ov: {
      ...base,
      facebook: `Unsere Vertreter im Bezirksbeirat ${ort} bleiben dran: ${c.title}\n\n${c.kurzfassung}\n\nWas meinen Sie? Schreiben Sie uns!`,
      instagram: `Wir kümmern uns vor Ort: ${c.title}\n\n${c.kurzfassung}`,
      x: `Wir bleiben dran: ${c.title} #CDUMannheim`.slice(0, 260),
      tiktok: `Wir kümmern uns: ${c.title}`.slice(0, 150),
      subline: "Wir kümmern uns vor Ort",
      outro: "Gemeinsam für unseren Stadtteil",
    },
    blog: {
      title: c.title.slice(0, 90),
      body: [
        blogSite === "BBR"
          ? `Die CDU-Gruppe im Bezirksbeirat ${ort} hat ein Anliegen eingebracht: ${c.title}.`
          : `Unsere Vertreter im Bezirksbeirat ${ort} haben ein Anliegen eingebracht: ${c.title}.`,
        "## Worum es geht",
        ...lines,
        "## Ihre Meinung",
        `Hinweise und Anregungen aus ${ort} nehmen wir gerne auf.`,
      ].join("\n\n"),
    },
  };
}

function clampCreative(v: SocialVariant, fallbackLines: string[]): Creative {
  const scenes = v.scenes.map((s) => s.trim()).filter(Boolean);
  return {
    headline: v.headline.trim().slice(0, 80),
    subline: v.subline.trim().slice(0, 120),
    scenes: (scenes.length ? scenes : fallbackLines).slice(0, 4).map((s) => s.slice(0, 140)),
    outro: v.outro.trim().slice(0, 70),
  };
}

export async function branding(account: SocialAccount, bezirk: string | null): Promise<Omit<Branding, "lines">> {
  const s = await getSettingsUncached();
  const ort = bezirk ?? "Seckenheim/Friedrichsfeld";
  return account === "BBR"
    ? { accountName: bbrAccountName(bezirk), kicker: `Bezirksbeirat ${ort}`, logoPath: s.social.logoBbr || null, defaultLogo: "logo-bbr.png" }
    : { accountName: `CDU ${s.ov.name}`, kicker: `CDU vor Ort · ${ort}`, logoPath: s.social.logoOv || null, defaultLogo: "logo-ov.png" };
}

/** Bildkachel und Video rendern und ablegen; Fehler werden zurückgegeben, nicht geworfen. */
export async function renderMedia(creative: Creative, brand: Branding, opts: { video?: boolean } = {}) {
  const result: { imagePath: string | null; videoPath: string | null; mediaError: string | null } = { imagePath: null, videoPath: null, mediaError: null };
  const errors: string[] = [];
  try {
    result.imagePath = await saveFile("social", "kachel.png", await renderSocialImage(creative, brand));
  } catch (err) {
    console.error("[bbr-social] Kachel:", err);
    errors.push(`Kachel: ${(err as Error).message}`.slice(0, 300));
  }
  try {
    if (opts.video !== false) result.videoPath = await saveFile("social", "video.mp4", await renderSocialVideo(creative, brand));
  } catch (err) {
    console.error("[bbr-social] Video:", err);
    errors.push(`Video: ${(err as Error).message}`.slice(0, 300));
  }
  result.mediaError = errors.length ? errors.join(" · ") : null;
  return result;
}

/** Bestehenden Entwurf ersetzen; freigegebene/veröffentlichte Beiträge bleiben, dann neuer Entwurf. */
function replaceable(p: MarketingPost | undefined) {
  return p && p.status === "ENTWURF" ? p : null;
}

async function savePost(
  concern: BbrConcern,
  existing: MarketingPost | undefined,
  data: Prisma.MarketingPostUncheckedCreateInput,
  actor: Actor | null,
  meta: Record<string, unknown>,
) {
  const replace = replaceable(existing);
  const post = await db.$transaction(async (tx) => {
    const p = replace
      ? await tx.marketingPost.update({ where: { id: replace.id }, data })
      : await tx.marketingPost.create({ data: { ...data, createdById: actor?.id ?? null } });
    await audit(tx, actor, replace ? "marketing.regenerate" : "marketing.create", "MarketingPost", p.id, { source: "bbr", concern: concern.id, ...meta });
    return p;
  });
  if (replace) {
    if (replace.imagePath !== post.imagePath) await deleteStoredFile(replace.imagePath);
    if (replace.videoPath !== post.videoPath) await deleteStoredFile(replace.videoPath);
  }
  return post;
}

/**
 * Entwürfe zu einem Anliegen erzeugen (nur auf Knopfdruck). Vorhandene Entwürfe der gewählten Ziele werden ersetzt,
 * freigegebene oder veröffentlichte Beiträge bleiben unangetastet – dann entsteht ein zusätzlicher Entwurf.
 */
export async function generateForConcern(
  concernId: string,
  opts: { targets?: GenerateTargets; actor?: Actor | null; client?: Anthropic } = {},
) {
  const targets = opts.targets ?? ALL_TARGETS;
  const actor = opts.actor ?? null;
  const concern = await db.bbrConcern.findUnique({ where: { id: concernId }, include: { posts: { orderBy: { createdAt: "desc" } } } });
  if (!concern) return null;
  try {
    const aiUsed = aiConfigured() || !!opts.client;
    const blogSite = targets.blog ?? "BBR";
    const draft = aiUsed ? await generateSocialDraft(concern, blogSite, opts.client) : fallbackDraft(concern, blogSite);
    const lines = kurzfassungLines(concern.kurzfassung);
    const brief = `${concern.title}\n\n${concern.kurzfassung}`;
    const postIds: string[] = [];

    for (const account of SOCIAL_ACCOUNTS) {
      if (account === "BBR" ? !targets.bbr : !targets.ov) continue;
      const v = account === "BBR" ? draft.bbr : draft.ov;
      const existing = concern.posts.find((p) => p.kind === "SOCIAL" && p.account === account);
      const creative = clampCreative(v, lines);
      const media = await renderMedia(creative, { ...(await branding(account, concern.bezirk)), lines });
      const post = await savePost(
        concern,
        existing,
        {
          kind: "SOCIAL",
          account,
          bbrConcernId: concern.id,
          title: `${account}: ${v.title}`.slice(0, 200),
          body: v.facebook.trim(),
          hashtags: v.hashtags.trim(),
          brief,
          channels: ["facebook"],
          variants: { instagram: v.instagram.trim(), x: v.x.trim(), tiktok: v.tiktok.trim() },
          creative: creative as unknown as Prisma.InputJsonValue,
          sourceKey: concern.sourceKey,
          generatedAt: new Date(),
          ...media,
        },
        actor,
        { account, aiUsed },
      );
      postIds.push(post.id);
    }

    if (targets.blog) {
      const existing = concern.posts.find((p) => p.kind === "BLOG");
      // Beitragsbild: Kachel im Design des Kanals, der zur Webseite gehört
      const account: SocialAccount = targets.blog === "BBR" ? "BBR" : "OV";
      const creative = clampCreative(account === "BBR" ? draft.bbr : draft.ov, lines);
      const media = await renderMedia(creative, { ...(await branding(account, concern.bezirk)), lines }, { video: false });
      const post = await savePost(
        concern,
        existing,
        {
          kind: "BLOG",
          site: targets.blog,
          account: null,
          bbrConcernId: concern.id,
          title: draft.blog.title.trim().slice(0, 200),
          body: draft.blog.body.trim(),
          hashtags: "",
          brief,
          channels: [],
          creative: creative as unknown as Prisma.InputJsonValue,
          sourceKey: concern.sourceKey,
          generatedAt: new Date(),
          imagePath: media.imagePath,
          videoPath: null,
          mediaError: media.mediaError,
          ...(existing && replaceable(existing) ? {} : { wpPostId: null, wpLink: null, wpStatus: null, wpMediaId: null }),
        },
        actor,
        { blog: targets.blog, aiUsed },
      );
      postIds.push(post.id);
    }

    await db.bbrConcern.update({ where: { id: concern.id }, data: { genStatus: "FERTIG", genError: null, generatedAt: new Date() } });
    return { postIds, aiUsed };
  } catch (err) {
    console.error("[bbr-social] Erzeugung fehlgeschlagen:", err);
    await db.bbrConcern.update({ where: { id: concern.id }, data: { genStatus: "FEHLER", genError: String((err as Error).message).slice(0, 500) } });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Abgleich mit dem Deck-Board
// ---------------------------------------------------------------------------

/** Karten übernehmen; geänderte Kurzfassungen mit vorhandenen Beiträgen werden markiert. */
export async function upsertConcerns(cards: DeckCard[]) {
  let created = 0;
  let changed = 0;
  for (const card of cards) {
    const sourceKey = kurzfassungKey(card.title, card.kurzfassung, card.bezirk);
    const before = await db.bbrConcern.findUnique({ where: { deckCardId: card.cardId }, include: { _count: { select: { posts: true } } } });
    const base = {
      boardId: card.boardId,
      stack: card.stack,
      title: card.title,
      bezirk: card.bezirk,
      kurzfassung: card.kurzfassung,
      sourceKey,
      cardUrl: card.url,
      cardModifiedAt: card.modifiedAt,
    };
    if (!before) {
      await db.bbrConcern.create({ data: { deckCardId: card.cardId, ...base, genStatus: "NEU" } });
      created++;
    } else if (before.sourceKey !== sourceKey) {
      await db.bbrConcern.update({ where: { id: before.id }, data: { ...base, genStatus: before._count.posts ? "GEAENDERT" : "NEU", genError: null } });
      changed++;
    } else if (before.stack !== card.stack || before.cardUrl !== card.url) {
      await db.bbrConcern.update({ where: { id: before.id }, data: { stack: card.stack, cardUrl: card.url } });
    }
  }
  return { created, changed };
}

async function writeLastSync(info: { at: string; ok: boolean; message: string }) {
  const value = JSON.stringify(info);
  await db.setting.upsert({ where: { key: "bbr.lastSync" }, create: { key: "bbr.lastSync", value }, update: { value } });
}

export function parseLastSync(raw: string): { at: string; ok: boolean; message: string } | null {
  try {
    const v = JSON.parse(raw) as { at?: unknown; ok?: unknown; message?: unknown };
    return typeof v.at === "string" ? { at: v.at, ok: v.ok === true, message: String(v.message ?? "") } : null;
  } catch {
    return null;
  }
}

/** Deck lesen und Anliegen übernehmen (ohne Beiträge zu erzeugen). */
export async function importFromDeck(fetchImpl: typeof fetch = fetch) {
  const s = await getSettingsUncached();
  try {
    const cards = await fetchDeckCards(s.social.deckBoards, fetchImpl);
    const result = { found: cards.length, ...(await upsertConcerns(cards)) };
    await writeLastSync({ at: new Date().toISOString(), ok: true, message: `${cards.length} Anliegen mit Kurzfassung, ${result.created} neu, ${result.changed} geändert` });
    return result;
  } catch (err) {
    const message = String((err as Error).message).slice(0, 300);
    await writeLastSync({ at: new Date().toISOString(), ok: false, message });
    throw new UserError(message);
  }
}

// ---------------------------------------------------------------------------
// Bedienung im Tool
// ---------------------------------------------------------------------------

export function listConcerns(actor: Actor) {
  assertCan(actor, "read");
  return db.bbrConcern.findMany({
    orderBy: [{ ignored: "asc" }, { createdAt: "desc" }],
    include: {
      posts: {
        select: { id: true, kind: true, account: true, site: true, status: true, wpLink: true, mediaError: true, sourceKey: true },
        orderBy: { createdAt: "asc" },
      },
    },
    take: 200,
  });
}

/** „Anliegen abrufen“ */
export async function syncNow(actor: Actor, fetchImpl: typeof fetch = fetch) {
  assertCan(actor, "marketing.publish");
  if (!deckConfigured()) throw new UserError("Der Nextcloud-Zugang ist noch nicht eingerichtet (Umgebungsvariablen NEXTCLOUD_…).");
  const result = await importFromDeck(fetchImpl);
  await audit(db, actor, "bbr.sync", "BbrConcern", null, result);
  return result;
}

const targetsSchema = z
  .object({ bbr: checkbox, ov: checkbox, blog: checkbox, blogSite: z.enum(["SF", "BBR"]).default("BBR") })
  .refine((t) => t.bbr || t.ov || t.blog, { error: "Bitte mindestens einen Beitrag auswählen.", path: ["bbr"] });

/** „Beiträge erstellen“: läuft im Hintergrund (KI, Kachel, Video – etwa eine Minute). */
export async function startGeneration(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "marketing.publish");
  const t = targetsSchema.parse(formToObject(formData));
  const c = await db.bbrConcern.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Anliegen nicht gefunden.");
  if (c.genStatus === "LAEUFT" && c.updatedAt.getTime() > Date.now() - 10 * 60_000) throw new UserError("Die Beiträge werden gerade erstellt.");
  const targets: GenerateTargets = { bbr: t.bbr, ov: t.ov, blog: t.blog ? t.blogSite : null };
  await db.$transaction(async (tx) => {
    await tx.bbrConcern.update({ where: { id }, data: { genStatus: "LAEUFT", genError: null, ignored: false } });
    await audit(tx, actor, "bbr.generate", "BbrConcern", id, targets);
  });
  await enqueue("bbr-generate", { concernId: id, targets, actorId: actor.id });
}

export async function setConcernIgnored(actor: Actor, id: string, ignored: boolean) {
  assertCan(actor, "marketing.publish");
  await db.$transaction(async (tx) => {
    await tx.bbrConcern.update({ where: { id }, data: { ignored } });
    await audit(tx, actor, ignored ? "bbr.ignore" : "bbr.unignore", "BbrConcern", id);
  });
}

const testSchema = z.object({
  title: z.string().trim().min(5, { error: "Bitte eine Überschrift angeben." }).max(300),
  bezirk: z.enum(BEZIRKE),
  kurzfassung: z.string().trim().min(20, { error: "Bitte eine Kurzfassung angeben (mind. 20 Zeichen)." }).max(2000),
});

/** Test-Anliegen ohne Deck (zum Ausprobieren, solange der Nextcloud-Zugang fehlt). */
export async function createTestConcern(actor: Actor, formData: FormData) {
  assertCan(actor, "marketing.publish");
  const input = testSchema.parse(formToObject(formData));
  const lowest = await db.bbrConcern.findFirst({ orderBy: { deckCardId: "asc" }, select: { deckCardId: true } });
  const deckCardId = Math.min(-1, (lowest?.deckCardId ?? 0) - 1);
  const concern = await db.$transaction(async (tx) => {
    const c = await tx.bbrConcern.create({
      data: {
        deckCardId,
        title: input.title,
        bezirk: input.bezirk,
        kurzfassung: input.kurzfassung,
        sourceKey: kurzfassungKey(input.title, input.kurzfassung, input.bezirk),
        stack: "Test",
        test: true,
        genStatus: "NEU",
      },
    });
    await audit(tx, actor, "bbr.test", "BbrConcern", c.id, { title: c.title });
    return c;
  });
  return concern;
}

/** Test-Anliegen samt Entwürfen löschen. */
export async function deleteTestConcern(actor: Actor, id: string) {
  assertCan(actor, "marketing.publish");
  const c = await db.bbrConcern.findUnique({ where: { id }, include: { posts: true } });
  if (!c) throw new NotFoundError("Anliegen nicht gefunden.");
  if (!c.test) throw new UserError("Nur Test-Anliegen können gelöscht werden.");
  const drafts = c.posts.filter((p) => p.status === "ENTWURF");
  await db.$transaction(async (tx) => {
    await tx.marketingPost.deleteMany({ where: { id: { in: drafts.map((p) => p.id) } } });
    await tx.bbrConcern.delete({ where: { id } });
    await audit(tx, actor, "bbr.delete", "BbrConcern", id, { title: c.title });
  });
  for (const p of drafts) {
    await deleteStoredFile(p.imagePath);
    await deleteStoredFile(p.videoPath);
  }
}

// ---------------------------------------------------------------------------
// Kachel/Video zu einem Beitrag neu erzeugen (nach Änderung von Schlagzeile/Tafeln)
// ---------------------------------------------------------------------------

const creativeSchema = z.object({
  headline: z.string().trim().min(3).max(80),
  subline: z.string().trim().max(120),
  scenes: z.string().max(800),
  outro: z.string().trim().max(70),
});

export async function updateCreative(actor: Actor, postId: string, formData: FormData) {
  assertCan(actor, "marketing.create");
  const post = await db.marketingPost.findUnique({ where: { id: postId }, include: { bbrConcern: true } });
  if (!post) throw new NotFoundError("Beitrag nicht gefunden.");
  if (post.status === "VEROEFFENTLICHT") throw new UserError("Veröffentlichte Beiträge sind gesperrt.");
  const input = creativeSchema.parse(formToObject(formData));
  const creative: Creative = {
    headline: input.headline,
    subline: input.subline,
    scenes: input.scenes
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4),
    outro: input.outro,
  };
  if (creative.scenes.length === 0) throw new UserError("Bitte mindestens eine Videotafel angeben.");
  const account: SocialAccount = post.account === "OV" || (post.kind === "BLOG" && post.site === "SF") ? "OV" : "BBR";
  const bezirk = post.bbrConcern?.bezirk ?? null;
  const lines = post.bbrConcern ? kurzfassungLines(post.bbrConcern.kurzfassung) : creative.scenes;
  const media = await renderMedia(creative, { ...(await branding(account, bezirk)), lines }, { video: post.kind === "SOCIAL" });
  await db.$transaction(async (tx) => {
    await tx.marketingPost.update({
      where: { id: postId },
      data: {
        creative: creative as unknown as Prisma.InputJsonValue,
        ...media,
        generatedAt: null,
        wpMediaId: null,
        ...(post.status === "FREIGEGEBEN" ? { status: "ENTWURF" as const, approvedAt: null, approvedById: null } : {}),
      },
    });
    await audit(tx, actor, "marketing.media", "MarketingPost", postId, { headline: creative.headline });
  });
  await deleteStoredFile(post.imagePath);
  await deleteStoredFile(post.videoPath);
  return media;
}

export async function uploadSocialLogo(actor: Actor, account: SocialAccount, formData: FormData) {
  assertCan(actor, "marketing.publish");
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Bitte eine Logodatei (SVG oder PNG) auswählen.");
  if (file.size > 3_000_000) throw new UserError("Die Datei ist größer als 3 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const head = data.subarray(0, 512).toString("utf8");
  const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isSvg = /<svg[\s>]/i.test(data.subarray(0, 4096).toString("utf8")) || head.trimStart().startsWith("<?xml");
  if (!isPng && !isSvg) throw new UserError("Bitte ein SVG- oder PNG-Logo hochladen.");
  if (isSvg && /<script|on\w+\s*=|javascript:/i.test(data.toString("utf8"))) throw new UserError("Das SVG enthält Skripte und wird nicht übernommen.");
  const key = account === "OV" ? "social.logoOv" : "social.logoBbr";
  const rel = await saveFile("social-logos", isPng ? "logo.png" : "logo.svg", data);
  const before = await db.setting.findUnique({ where: { key } });
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, create: { key, value: rel }, update: { value: rel } });
    await audit(tx, actor, "settings.update", "Setting", key, { [key]: rel });
  });
  await deleteStoredFile(before?.value);
}

export async function resetSocialLogo(actor: Actor, account: SocialAccount) {
  assertCan(actor, "marketing.publish");
  const key = account === "OV" ? "social.logoOv" : "social.logoBbr";
  const before = await db.setting.findUnique({ where: { key } });
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, create: { key, value: "" }, update: { value: "" } });
    await audit(tx, actor, "settings.update", "Setting", key, { [key]: "" });
  });
  await deleteStoredFile(before?.value);
}

/** Kachel (PNG) oder Video (MP4) eines Beitrags lesen. */
export async function readPostMedia(actor: Actor, postId: string, kind: "image" | "video") {
  assertCan(actor, "read");
  const post = await db.marketingPost.findUnique({ where: { id: postId }, select: { imagePath: true, videoPath: true, title: true } });
  const rel = kind === "image" ? post?.imagePath : post?.videoPath;
  if (!post || !rel) throw new NotFoundError("Datei nicht gefunden.");
  const slug = post.title.replace(/[^A-Za-z0-9ÄÖÜäöüß-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "beitrag";
  return {
    data: await readStoredFile(rel),
    mime: kind === "image" ? "image/png" : "video/mp4",
    name: `${slug}.${kind === "image" ? "png" : "mp4"}`,
  };
}
