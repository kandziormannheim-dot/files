import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { saveFile } from "@/server/files";
import { approvePost } from "./marketing";
import { publishToMeta, readPublicMedia, signMediaToken, verifyMediaToken } from "./meta";

const ENV = {
  META_OV_PAGE_ID: "111",
  META_OV_PAGE_TOKEN: "nur-test-token",
  META_OV_IG_ID: "222",
  AUTH_SECRET: process.env.AUTH_SECRET || "test-secret-nur-fuer-tests",
};

async function socialPost(adminId: string, account = "OV") {
  const png = await sharp({ create: { width: 108, height: 135, channels: 3, background: "#52b7c1" } }).png().toBuffer();
  const concern = await db.bbrConcern.create({
    data: { deckCardId: 5, title: "Erfundenes Anliegen", bezirk: "Seckenheim", kurzfassung: "Zeile eins.", sourceKey: "k" },
  });
  return db.marketingPost.create({
    data: {
      kind: "SOCIAL",
      account,
      bbrConcernId: concern.id,
      title: "OV: Test",
      body: "Unsere Vertreter bleiben dran.",
      hashtags: "#Seckenheim",
      variants: { instagram: "Instagram-Text" },
      imagePath: await saveFile("social", "kachel.png", png),
      videoPath: await saveFile("social", "video.mp4", Buffer.from("mp4")),
      createdById: adminId,
    },
  });
}

describe("signierter Medien-Link", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET ||= ENV.AUTH_SECRET;
  });
  it("prüft Signatur und Ablauf", () => {
    const now = Date.now();
    const t = signMediaToken("abc", "image", 60, now);
    expect(verifyMediaToken(t, now)).toEqual({ postId: "abc", kind: "image" });
    expect(verifyMediaToken(t, now + 61_000)).toBeNull();
    expect(verifyMediaToken(t.replace(".image.", ".video."), now)).toBeNull();
    expect(verifyMediaToken(`${t}x`, now)).toBeNull();
    expect(verifyMediaToken("unsinn", now)).toBeNull();
  });
});

describe.skipIf(!hasTestDb)("Facebook/Instagram veröffentlichen (DB)", () => {
  beforeAll(() => Object.assign(process.env, ENV));
  afterAll(() => {
    for (const k of ["META_OV_PAGE_ID", "META_OV_PAGE_TOKEN", "META_OV_IG_ID"]) delete process.env[k];
  });
  beforeEach(resetDb);

  it("postet freigegebene Beiträge auf Facebook und Instagram, mit Blog-Link und ohne Doppelungen", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const vorstand = await makeUser({ role: "VORSTAND" });
    const post = await socialPost(admin.id);
    await db.marketingPost.create({
      data: {
        kind: "BLOG",
        site: "SF",
        bbrConcernId: post.bbrConcernId,
        title: "Blog",
        body: "x",
        status: "VEROEFFENTLICHT",
        publishedAt: new Date(),
        wordpress: {
          create: [
            { site: "BBR", wpPostId: 2, wpLink: "https://bbr.cdu-sf.de/blog-1", wpStatus: "publish" },
            { site: "SF", wpPostId: 1, wpLink: "https://cdu-sf.de/blog-1", wpStatus: "publish" },
          ],
        },
      },
    });

    const fb = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/111/photos")) {
        const body = init!.body as FormData;
        expect(body.get("message")).toContain("Mehr dazu: https://cdu-sf.de/blog-1");
        expect(body.get("message")).toContain("#Seckenheim");
        expect(body.get("source")).toBeInstanceOf(Blob);
        return Response.json({ id: "photo1", post_id: "111_999" });
      }
      return Response.json({ error: { message: "unerwartet " + u } }, { status: 400 });
    });

    await expect(publishToMeta(admin, post.id, "facebook", "image", {}, { fetchImpl: fb as never })).rejects.toThrow(/freigeben/);
    await approvePost(admin, post.id);
    await expect(publishToMeta(vorstand, post.id, "facebook", "image", {}, { fetchImpl: fb as never })).rejects.toBeInstanceOf(ForbiddenError);
    const pub = await publishToMeta(admin, post.id, "facebook", "image", { withBlogLink: true }, { fetchImpl: fb as never });
    expect(pub).toMatchObject({ network: "facebook", externalId: "111_999", permalink: "https://www.facebook.com/111_999" });
    expect((await db.marketingPost.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("VEROEFFENTLICHT");
    await expect(publishToMeta(admin, post.id, "facebook", "image", {}, { fetchImpl: fb as never })).rejects.toThrow(/bereits/);

    // Instagram: Container → Status abfragen → veröffentlichen
    let mediaUrl = "";
    const calls: string[] = [];
    let polls = 0;
    const ig = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push(u.replace(/access_token=[^&]+/, "access_token=…"));
      if (u.endsWith("/222/media")) {
        const p = new URLSearchParams(String(init!.body));
        expect(p.get("media_type")).toBe("REELS");
        expect(p.get("caption")).toContain("Instagram-Text");
        mediaUrl = p.get("video_url")!;
        return Response.json({ id: "cont1" });
      }
      if (u.includes("/cont1?")) return Response.json({ status_code: ++polls < 2 ? "IN_PROGRESS" : "FINISHED" });
      if (u.endsWith("/222/media_publish")) return Response.json({ id: "igmedia1" });
      if (u.includes("/igmedia1?")) return Response.json({ permalink: "https://www.instagram.com/reel/abc/" });
      return Response.json({ error: { message: "unerwartet" } }, { status: 400 });
    });
    const reel = await publishToMeta(admin, post.id, "instagram", "video", {}, { fetchImpl: ig as never, sleep: async () => {} });
    expect(reel.permalink).toBe("https://www.instagram.com/reel/abc/");
    expect(polls).toBe(2);
    expect(calls.every((c) => !c.includes("nur-test-token"))).toBe(true);

    // öffentlicher Link liefert das Video, nur mit gültiger Signatur
    const token = mediaUrl.split("/api/public-media/")[1]!;
    const v = verifyMediaToken(token)!;
    expect(v).toEqual({ postId: post.id, kind: "video" });
    expect((await readPublicMedia(v.postId, "video"))!.mime).toBe("video/mp4");
    expect((await readPublicMedia(v.postId, "image"))!.mime).toBe("image/jpeg");

    expect(await db.auditLog.count({ where: { action: "marketing.meta" } })).toBe(2);
  }, 30_000);

  it("meldet fehlende Zugänge, Fehler von Meta und lässt Entwürfe nicht nach außen", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const bbr = await socialPost(admin.id, "BBR");
    await approvePost(admin, bbr.id);
    await expect(publishToMeta(admin, bbr.id, "facebook", "image")).rejects.toThrow(/keine Zugangsdaten/);

    await db.marketingPost.update({ where: { id: bbr.id }, data: { account: "OV" } });
    const err = vi.fn(async () => Response.json({ error: { message: "Invalid OAuth access token" } }, { status: 400 }));
    await expect(publishToMeta(admin, bbr.id, "facebook", "video", {}, { fetchImpl: err as never })).rejects.toBeInstanceOf(UserError);
    expect(await db.socialPublication.count()).toBe(0);

    const draft = await db.marketingPost.create({ data: { kind: "SOCIAL", account: "OV", title: "x", body: "y", imagePath: bbr.imagePath } });
    expect(await readPublicMedia(draft.id, "image")).toBeNull();
  });
});
