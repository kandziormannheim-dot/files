import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";
import sharp from "sharp";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { readStoredFile } from "@/server/files";
import { appUrl } from "@/server/ov";

// Direkte Veröffentlichung auf Facebook-Seiten und Instagram (Meta Graph API).
// Zugangsdaten nur als Umgebungsvariablen (CLAUDE.md Regel 8/12), je Kanal:
//   META_OV_PAGE_ID, META_OV_PAGE_TOKEN, META_OV_IG_ID      (Ortsverband)
//   META_BBR_PAGE_ID, META_BBR_PAGE_TOKEN, META_BBR_IG_ID   (BBR-Gruppe)
// Seiten-Token aus einem langlebigen Nutzer-Token laufen nicht ab. Veröffentlicht wird nur freigegebenes
// Material (marketing.publish), jeder Vorgang landet im Audit-Log und als SocialPublication.

type Actor = Pick<User, "id" | "role">;
export type MetaAccount = "OV" | "BBR";
export type MetaNetwork = "facebook" | "instagram";
export type MetaFormat = "image" | "video";

const GRAPH = "https://graph.facebook.com";
const GRAPH_VIDEO = "https://graph-video.facebook.com";

export function graphVersion() {
  return process.env.META_GRAPH_VERSION?.trim() || "v23.0";
}

export function metaConfig(account: MetaAccount) {
  const pageId = process.env[`META_${account}_PAGE_ID`]?.trim();
  const token = process.env[`META_${account}_PAGE_TOKEN`]?.trim();
  const igId = process.env[`META_${account}_IG_ID`]?.trim();
  return { facebook: !!(pageId && token), instagram: !!(igId && token), pageId, token, igId };
}

export function metaStatus() {
  return (["OV", "BBR"] as const).map((a) => {
    const c = metaConfig(a);
    return { account: a, facebook: c.facebook, instagram: c.instagram };
  });
}

// ---------------------------------------------------------------------------
// Öffentlicher, signierter Kurzzeit-Link für Instagram (lädt Bild/Video selbst herunter)
// ---------------------------------------------------------------------------

function mediaSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET fehlt.");
  return s;
}

export function signMediaToken(postId: string, kind: MetaFormat, ttlSeconds = 3600, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const payload = `${postId}.${kind}.${exp}`;
  const sig = createHmac("sha256", mediaSecret()).update(`public-media:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyMediaToken(token: string, now = Date.now()): { postId: string; kind: MetaFormat } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [postId, kind, exp, sig] = parts as [string, string, string, string];
  if (kind !== "image" && kind !== "video") return null;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null;
  const expected = createHmac("sha256", mediaSecret()).update(`public-media:${postId}.${kind}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { postId, kind };
}

/** Datei für den öffentlichen Link: Kachel als JPEG (Instagram verlangt JPEG), Video als MP4. */
export async function readPublicMedia(postId: string, kind: MetaFormat) {
  const post = await db.marketingPost.findUnique({ where: { id: postId }, select: { imagePath: true, videoPath: true, status: true } });
  const rel = kind === "image" ? post?.imagePath : post?.videoPath;
  if (!post || !rel || post.status === "ENTWURF") return null;
  const data = await readStoredFile(rel);
  if (kind === "image") return { data: await sharp(data).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer(), mime: "image/jpeg" };
  return { data, mime: "video/mp4" };
}

// ---------------------------------------------------------------------------
// Veröffentlichen
// ---------------------------------------------------------------------------

type GraphError = { error?: { message?: string; code?: number; error_user_msg?: string } };

async function graphJson<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    const msg = json.error?.error_user_msg || json.error?.message || `HTTP ${res.status}`;
    throw new UserError(`Meta hat die Veröffentlichung abgelehnt: ${msg}`.slice(0, 400));
  }
  return json;
}

export type PublishDeps = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; pollAttempts?: number };

async function publishFacebook(cfg: ReturnType<typeof metaConfig>, format: MetaFormat, text: string, file: Buffer, deps: Required<PublishDeps>) {
  const form = new FormData();
  form.set("access_token", cfg.token!);
  if (format === "image") {
    form.set("message", text);
    form.set("source", new Blob([new Uint8Array(file)], { type: "image/png" }), "kachel.png");
    const r = await graphJson<{ id: string; post_id?: string }>(await deps.fetchImpl(`${GRAPH}/${graphVersion()}/${cfg.pageId}/photos`, { method: "POST", body: form }));
    const id = r.post_id ?? r.id;
    return { externalId: id, permalink: `https://www.facebook.com/${id}` };
  }
  form.set("description", text);
  form.set("source", new Blob([new Uint8Array(file)], { type: "video/mp4" }), "video.mp4");
  const r = await graphJson<{ id: string }>(await deps.fetchImpl(`${GRAPH_VIDEO}/${graphVersion()}/${cfg.pageId}/videos`, { method: "POST", body: form }));
  return { externalId: r.id, permalink: `https://www.facebook.com/${cfg.pageId}/videos/${r.id}` };
}

async function publishInstagram(cfg: ReturnType<typeof metaConfig>, format: MetaFormat, caption: string, mediaUrl: string, deps: Required<PublishDeps>) {
  const base = `${GRAPH}/${graphVersion()}`;
  const params = new URLSearchParams({ access_token: cfg.token!, caption });
  if (format === "image") params.set("image_url", mediaUrl);
  else {
    params.set("media_type", "REELS");
    params.set("video_url", mediaUrl);
  }
  const container = await graphJson<{ id: string }>(await deps.fetchImpl(`${base}/${cfg.igId}/media`, { method: "POST", body: params }));
  // Instagram verarbeitet die Datei asynchron (bei Reels bis zu einigen Minuten)
  for (let i = 0; ; i++) {
    const s = await graphJson<{ status_code?: string; status?: string }>(
      await deps.fetchImpl(`${base}/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(cfg.token!)}`),
    );
    if (s.status_code === "FINISHED" || (!s.status_code && format === "image")) break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new UserError(`Instagram konnte die Datei nicht verarbeiten (${s.status ?? s.status_code}).`);
    if (i >= deps.pollAttempts) throw new UserError("Instagram verarbeitet das Video noch. Bitte in ein paar Minuten erneut versuchen.");
    await deps.sleep(5000);
  }
  const published = await graphJson<{ id: string }>(
    await deps.fetchImpl(`${base}/${cfg.igId}/media_publish`, { method: "POST", body: new URLSearchParams({ access_token: cfg.token!, creation_id: container.id }) }),
  );
  const info = await deps
    .fetchImpl(`${base}/${published.id}?fields=permalink&access_token=${encodeURIComponent(cfg.token!)}`)
    .then((r) => r.json() as Promise<{ permalink?: string }>)
    .catch(() => ({}) as { permalink?: string });
  return { externalId: published.id, permalink: info.permalink ?? null };
}

/** Freigegebenen Social-Beitrag auf Facebook oder Instagram veröffentlichen. */
export async function publishToMeta(
  actor: Actor,
  postId: string,
  network: MetaNetwork,
  format: MetaFormat,
  opts: { withBlogLink?: boolean } = {},
  deps: PublishDeps = {},
) {
  assertCan(actor, "marketing.publish");
  const d: Required<PublishDeps> = {
    fetchImpl: deps.fetchImpl ?? fetch,
    sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    pollAttempts: deps.pollAttempts ?? 36,
  };
  const post = await db.marketingPost.findUnique({ where: { id: postId }, include: { publications: true } });
  if (!post) throw new NotFoundError("Beitrag nicht gefunden.");
  if (post.kind !== "SOCIAL" || (post.account !== "OV" && post.account !== "BBR")) throw new UserError("Nur Social-Beiträge des OV- oder BBR-Kanals können direkt veröffentlicht werden.");
  if (post.status === "ENTWURF") throw new UserError("Bitte den Beitrag zuerst freigeben.");
  const account = post.account as MetaAccount;
  const cfg = metaConfig(account);
  if (!cfg[network]) throw new UserError(`Für ${network === "facebook" ? "Facebook" : "Instagram"} (${account === "OV" ? "OV" : "BBR"}) sind keine Zugangsdaten hinterlegt.`);
  if (post.publications.some((p) => p.network === network && p.format === format))
    throw new UserError("Dieser Beitrag wurde in diesem Format dort bereits veröffentlicht.");
  const rel = format === "image" ? post.imagePath : post.videoPath;
  if (!rel) throw new UserError(format === "image" ? "Es gibt keine Kachel zu diesem Beitrag." : "Es gibt kein Video zu diesem Beitrag.");

  // Text: Facebook-Text bzw. Instagram-Variante, Hashtags darunter; optional Link zum veröffentlichten Blogartikel
  const variants = (post.variants ?? {}) as { instagram?: string };
  let text = network === "instagram" ? variants.instagram?.trim() || post.body.trim() : post.body.trim();
  if (opts.withBlogLink && network === "facebook" && post.bbrConcernId) {
    const blog = await db.marketingPost.findFirst({
      where: { bbrConcernId: post.bbrConcernId, kind: "BLOG", wpStatus: "publish", wpLink: { not: null } },
      orderBy: { publishedAt: "desc" },
    });
    if (blog?.wpLink) text += `\n\nMehr dazu: ${blog.wpLink}`;
  }
  if (post.hashtags.trim()) text += `\n\n${post.hashtags.trim()}`;

  const result =
    network === "facebook"
      ? await publishFacebook(cfg, format, text, await readStoredFile(rel), d)
      : await publishInstagram(cfg, format, text.slice(0, 2200), `${appUrl()}/api/public-media/${signMediaToken(post.id, format)}`, d);

  return db.$transaction(async (tx) => {
    const pub = await tx.socialPublication.create({
      data: { postId: post.id, network, format, externalId: result.externalId, permalink: result.permalink, createdById: actor.id },
    });
    if (post.status !== "VEROEFFENTLICHT") await tx.marketingPost.update({ where: { id: post.id }, data: { status: "VEROEFFENTLICHT", publishedAt: new Date() } });
    await audit(tx, actor, "marketing.meta", "MarketingPost", post.id, { network, format, account, externalId: result.externalId });
    return pub;
  });
}

/** Ob zum Anliegen ein veröffentlichter Blogartikel existiert (für die Option „Link anhängen“). */
export async function publishedBlogLink(bbrConcernId: string | null) {
  if (!bbrConcernId) return null;
  const blog = await db.marketingPost.findFirst({
    where: { bbrConcernId, kind: "BLOG", wpStatus: "publish", wpLink: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { wpLink: true },
  });
  return blog?.wpLink ?? null;
}
