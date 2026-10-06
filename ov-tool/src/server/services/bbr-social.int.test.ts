import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { createTestConcern, deleteTestConcern, generateForConcern, startGeneration, syncNow, updateCreative } from "./bbr-social";
import { approvePost, sendToWordpress, updatePost } from "./marketing";

// Kachel und Video ohne Chromium/ffmpeg simulieren
vi.mock("@/server/media/social", () => ({
  renderSocialImage: vi.fn(async () => Buffer.from("png")),
  renderSocialVideo: vi.fn(async () => Buffer.from("mp4")),
}));

const KURZ = "Die Ampel an der Musterstraße schaltet sehr kurz.\nWir bitten um Prüfung der Grünphase.\nZiel ist ein sicherer Schulweg.";

function card(id: number, kurz: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Erfundenes Anliegen ${id}`,
    description: `**Bezirk:** Seckenheim\n**Hinweisgeber/Kontakt:** Erika Geheim, 0621 999\n\n**Kurzfassung**\n\n${kurz}\n\n**Erläuterung**\n\nInterne Erläuterung mit Details.`,
    lastModified: 1_790_000_000,
    ...extra,
  };
}

function deckFetch(cards: ReturnType<typeof card>[]) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/boards")) {
      return Response.json([
        { id: 7, title: "BBR Seckenheim" },
        { id: 8, title: "Privat" },
      ]);
    }
    if (u.endsWith("/boards/7/stacks")) return Response.json([{ id: 1, title: "Eingereicht", cards }]);
    if (u.endsWith("/boards/8/stacks")) throw new Error("fremdes Board darf nicht gelesen werden");
    return new Response("nicht gefunden", { status: 404 });
  }) as unknown as typeof fetch;
}

describe.skipIf(!hasTestDb)("BBR-Anliegen → Social Media (DB)", () => {
  beforeAll(() => {
    process.env.NEXTCLOUD_URL = "https://cloud.example.org";
    process.env.NEXTCLOUD_DECK_USER = "ov-tool";
    process.env.NEXTCLOUD_DECK_APP_PASSWORD = "test-nur-fuer-tests";
  });
  afterAll(() => {
    delete process.env.NEXTCLOUD_URL;
    delete process.env.NEXTCLOUD_DECK_USER;
    delete process.env.NEXTCLOUD_DECK_APP_PASSWORD;
  });
  beforeEach(resetDb);

  it("übernimmt Anliegen nur auf Knopfdruck und erstellt Social-Beiträge und Blogartikel erst auf Anforderung", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const vorstand = await makeUser({ role: "VORSTAND" });
    const fetch1 = deckFetch([card(11, KURZ), card(12, ""), card(13, KURZ, { archived: true })]);
    await expect(syncNow(vorstand, fetch1)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await syncNow(admin, fetch1)).toMatchObject({ found: 1, created: 1 });

    const concern = await db.bbrConcern.findUniqueOrThrow({ where: { deckCardId: 11 } });
    expect(concern).toMatchObject({ bezirk: "Seckenheim", genStatus: "NEU", stack: "Eingereicht", kurzfassung: KURZ });
    expect(await db.marketingPost.count()).toBe(0); // keine Automatik
    const sync = JSON.parse((await db.setting.findUniqueOrThrow({ where: { key: "bbr.lastSync" } })).value);
    expect(sync.ok).toBe(true);

    await expect(startGeneration(admin, concern.id, form({}))).rejects.toThrow();
    await startGeneration(admin, concern.id, form({ bbr: true, ov: true, blog: true, blogSite: "BBR" }));
    const posts = await db.marketingPost.findMany({ where: { bbrConcernId: concern.id } });
    expect(posts.map((p) => `${p.kind}:${p.account ?? p.site}`).sort()).toEqual(["BLOG:BBR", "SOCIAL:BBR", "SOCIAL:OV"]);
    const blog = posts.find((p) => p.kind === "BLOG")!;
    expect(blog.body).toContain("## ");
    expect(blog.imagePath).toBeTruthy();
    expect(blog.videoPath).toBeNull();
    for (const p of posts) {
      expect(p.status).toBe("ENTWURF");
      expect(p.createdById).toBe(admin.id);
      const all = JSON.stringify(p);
      expect(all).not.toContain("Erika");
      expect(all).not.toContain("Interne Erläuterung");
    }
    expect((await db.bbrConcern.findUniqueOrThrow({ where: { id: concern.id } })).genStatus).toBe("FERTIG");

    // Kurzfassung geändert → nur Hinweis, nichts wird automatisch neu erstellt
    await syncNow(admin, deckFetch([card(11, `${KURZ}\nNeue Zeile.`)]));
    expect((await db.bbrConcern.findUniqueOrThrow({ where: { id: concern.id } })).genStatus).toBe("GEAENDERT");
    expect((await db.marketingPost.findUniqueOrThrow({ where: { id: blog.id } })).body).not.toContain("Neue Zeile");

    // nur Blog neu, für cdu-sf.de: Entwurf wird ersetzt (gleiche ID), Social bleibt
    const ov = posts.find((p) => p.account === "OV")!;
    await updatePost(admin, ov.id, form({ title: ov.title, body: "Von Hand geschrieben.", hashtags: "", "channels[]": ["facebook"] }));
    await startGeneration(admin, concern.id, form({ blog: true, blogSite: "SF" }));
    const blog2 = await db.marketingPost.findUniqueOrThrow({ where: { id: blog.id } });
    expect(blog2.site).toBe("SF");
    expect(blog2.body).toContain("Neue Zeile");
    expect((await db.marketingPost.findUniqueOrThrow({ where: { id: ov.id } })).body).toBe("Von Hand geschrieben.");

    // freigegeben + neu erstellen → zusätzlicher Entwurf, Freigegebenes bleibt
    await approvePost(admin, ov.id);
    await startGeneration(admin, concern.id, form({ ov: true }));
    const ovPosts = await db.marketingPost.findMany({ where: { bbrConcernId: concern.id, account: "OV" }, orderBy: { createdAt: "asc" } });
    expect(ovPosts.map((p) => p.status)).toEqual(["FREIGEGEBEN", "ENTWURF"]);

    // Blog an WordPress: wahlweise cdu-sf.de, bbr.cdu-sf.de oder beide; Kachel als Beitragsbild je Seite
    for (const [k, v] of Object.entries({
      WP_SF_URL: "https://sf.example.org",
      WP_SF_USER: "redaktion",
      WP_SF_APP_PASSWORD: "nur-test",
      WP_BBR_URL: "https://bbr.example.org",
      WP_BBR_USER: "redaktion",
      WP_BBR_APP_PASSWORD: "nur-test",
    }))
      vi.stubEnv(k, v);
    try {
      await approvePost(admin, blog.id);
      let n = 0;
      const wp = vi.fn(async (url: string | URL | Request) => {
        const u = String(url);
        if (u.endsWith("/media")) return Response.json({ id: u.includes("bbr.") ? 66 : 55 });
        n++;
        const host = u.includes("bbr.") ? "bbr" : "sf";
        const id = u.match(/posts\/(\d+)/)?.[1] ?? String(100 + n);
        return Response.json({ id: Number(id), link: `https://${host}.example.org/?p=${id}`, status: u.includes("bbr.") ? "publish" : "draft" });
      });
      const res = await sendToWordpress(admin, blog.id, ["SF"], "draft", wp as unknown as typeof fetch);
      expect(res).toMatchObject([{ site: "SF", ok: true, status: "draft" }]);
      const [, postInit] = wp.mock.calls[1] as unknown as [string, RequestInit];
      expect(JSON.parse(String(postInit.body))).toMatchObject({ featured_media: 55, status: "draft" });

      // beide Seiten: SF wird aktualisiert (gleiche WP-ID, Bild nicht erneut), BBR neu angelegt
      const both = await sendToWordpress(admin, blog.id, ["SF", "BBR"], "publish", wp as unknown as typeof fetch);
      expect(both.map((r) => r.site)).toEqual(["SF", "BBR"]);
      const pubs = await db.wordpressPublication.findMany({ where: { postId: blog.id }, orderBy: { site: "asc" } });
      expect(pubs.map((p) => [p.site, p.wpMediaId])).toEqual([
        ["BBR", 66],
        ["SF", 55],
      ]);
      expect(wp.mock.calls.filter(([u]) => String(u).endsWith("/media"))).toHaveLength(2); // je Seite einmal
      expect(String(wp.mock.calls[2]![0])).toMatch(/sf\.example\.org\/wp-json\/wp\/v2\/posts\/101$/);
      expect((await db.marketingPost.findUniqueOrThrow({ where: { id: blog.id } })).status).toBe("VEROEFFENTLICHT");
      await expect(sendToWordpress(admin, blog.id, [], "draft", wp as unknown as typeof fetch)).rejects.toThrow(/mindestens/);

      // eine Seite scheitert → die andere läuft trotzdem, Fehler wird gemeldet
      const half = vi.fn(async (url: string | URL | Request) =>
        String(url).includes("bbr.") ? new Response("kaputt", { status: 500 }) : Response.json({ id: 101, link: "https://sf.example.org/?p=101", status: "publish" }),
      );
      const mixed = await sendToWordpress(admin, blog.id, ["SF", "BBR"], "publish", half as unknown as typeof fetch);
      expect(mixed).toMatchObject([{ site: "SF", ok: true }, { site: "BBR", ok: false }]);
    } finally {
      vi.unstubAllEnvs();
    }
  }, 60_000);

  it("meldet abgelehnte Zugangsdaten; Test-Anliegen lassen sich anlegen, bearbeiten und löschen", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const vorstand = await makeUser({ role: "VORSTAND" });
    const denied = vi.fn(async () => new Response("", { status: 401 })) as unknown as typeof fetch;
    await expect(syncNow(admin, denied)).rejects.toThrow(/abgelehnt/);
    const sync = JSON.parse((await db.setting.findUniqueOrThrow({ where: { key: "bbr.lastSync" } })).value);
    expect(sync).toMatchObject({ ok: false });

    await expect(createTestConcern(vorstand, form({ title: "Testanliegen", bezirk: "Friedrichsfeld", kurzfassung: KURZ }))).rejects.toBeInstanceOf(ForbiddenError);
    const c = await createTestConcern(admin, form({ title: "Testanliegen Spielplatz", bezirk: "Friedrichsfeld", kurzfassung: KURZ }));
    expect(c.deckCardId).toBeLessThan(0);
    expect(await db.marketingPost.count()).toBe(0);
    await startGeneration(admin, c.id, form({ bbr: true, ov: true }));
    const posts = await db.marketingPost.findMany({ where: { bbrConcernId: c.id } });
    expect(posts).toHaveLength(2);
    expect(posts.find((p) => p.account === "BBR")!.title).toContain("BBR");

    // Schlagzeile ändern → Kachel/Video neu
    const p = posts[0]!;
    await updateCreative(admin, p.id, form({ headline: "Neue Schlagzeile", subline: "", scenes: "Eins\nZwei", outro: "Schluss" }));
    const updated = await db.marketingPost.findUniqueOrThrow({ where: { id: p.id } });
    expect((updated.creative as { headline: string; scenes: string[] }).scenes).toEqual(["Eins", "Zwei"]);
    expect(updated.imagePath).not.toBe(p.imagePath);
    await expect(updateCreative(admin, p.id, form({ headline: "Neu", subline: "", scenes: "", outro: "" }))).rejects.toBeInstanceOf(UserError);

    await deleteTestConcern(admin, c.id);
    expect(await db.marketingPost.count()).toBe(0);
  }, 60_000);

  it("nutzt die KI-Antwort für beide Kanäle mit unterschiedlichem Text", async () => {
    const c = await db.bbrConcern.create({
      data: { deckCardId: 99, title: "Erfundenes Anliegen", bezirk: "Seckenheim", kurzfassung: KURZ, sourceKey: "k" },
    });
    const v = (t: string) => ({
      title: t,
      facebook: `${t} Facebook`,
      instagram: `${t} Instagram`,
      x: `${t} X`,
      tiktok: `${t} TikTok`,
      headline: `${t} Schlagzeile`,
      subline: "Unterzeile",
      scenes: ["A", "B", "C"],
      outro: "Ende",
      hashtags: "#Seckenheim",
    });
    const parse = vi.fn(async () => ({
      stop_reason: "end_turn",
      parsed_output: { bbr: v("Sachlich"), ov: v("Politisch"), blog: { title: "Blogtitel", body: "Einleitung.\n\n## Worum es geht\n\nText." } },
    }));
    const client = { beta: { messages: { parse } } } as never;
    const r = await generateForConcern(c.id, { client, targets: { bbr: true, ov: true, blog: "SF" } });
    expect(r?.aiUsed).toBe(true);
    const sent = (parse.mock.calls[0] as unknown as [{ messages: { content: string }[] }])[0].messages[0]!.content;
    expect(sent).toContain("<kurzfassung>");
    expect(sent).toContain("cdu-sf.de (CDU-Ortsverband)");
    const posts = await db.marketingPost.findMany({ where: { bbrConcernId: c.id } });
    expect(posts.find((p) => p.account === "BBR")!.body).toBe("Sachlich Facebook");
    expect(posts.find((p) => p.account === "OV")!.variants).toMatchObject({ x: "Politisch X" });
    expect(posts.find((p) => p.kind === "BLOG")).toMatchObject({ title: "Blogtitel", site: "SF" });
  });
});
