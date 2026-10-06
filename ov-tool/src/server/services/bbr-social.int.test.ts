import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { createTestConcern, deleteTestConcern, generateForConcern, regenerateConcern, runBbrSync, updateCreative } from "./bbr-social";
import { approvePost, updatePost } from "./marketing";

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

  it("erzeugt zu neuen Kurzfassungen Entwürfe für BBR- und OV-Kanal und überschreibt Bearbeitetes nie", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const fetch1 = deckFetch([card(11, KURZ), card(12, ""), card(13, KURZ, { archived: true })]);
    const r1 = await runBbrSync(fetch1);
    expect(r1).toMatchObject({ found: 1, created: 1, generated: 1 });

    const concern = await db.bbrConcern.findUniqueOrThrow({ where: { deckCardId: 11 }, include: { posts: true } });
    expect(concern).toMatchObject({ bezirk: "Seckenheim", genStatus: "FERTIG", stack: "Eingereicht" });
    expect(concern.kurzfassung).toBe(KURZ);
    expect(concern.posts.map((p) => p.account).sort()).toEqual(["BBR", "OV"]);
    for (const p of concern.posts) {
      expect(p.status).toBe("ENTWURF");
      expect(p.imagePath).toBeTruthy();
      expect(p.videoPath).toBeTruthy();
      // nie Hinweisgeber oder Erläuterung
      const all = JSON.stringify(p);
      expect(all).not.toContain("Erika");
      expect(all).not.toContain("Interne Erläuterung");
    }
    const sync = JSON.parse((await db.setting.findUniqueOrThrow({ where: { key: "bbr.lastSync" } })).value);
    expect(sync.ok).toBe(true);

    // unverändert → nichts Neues
    expect(await runBbrSync(fetch1)).toMatchObject({ created: 0, changed: 0, generated: 0 });

    // Kurzfassung geändert → unbearbeitete Entwürfe werden ersetzt (gleiche IDs)
    const ids = concern.posts.map((p) => p.id).sort();
    await runBbrSync(deckFetch([card(11, `${KURZ}\nNeue Zeile.`)]));
    const after = await db.marketingPost.findMany({ where: { bbrConcernId: concern.id } });
    expect(after.map((p) => p.id).sort()).toEqual(ids);
    expect(after.every((p) => p.body.includes("Neue Zeile"))).toBe(true);

    // OV-Entwurf von Hand bearbeiten → bleibt bei der nächsten Änderung erhalten
    const ov = after.find((p) => p.account === "OV")!;
    await updatePost(admin, ov.id, form({ title: ov.title, body: "Von Hand geschrieben.", hashtags: "", "channels[]": ["facebook"] }));
    await runBbrSync(deckFetch([card(11, "Ganz neue Kurzfassung mit drei Zeilen.\nZweite.\nDritte.")]));
    expect((await db.marketingPost.findUniqueOrThrow({ where: { id: ov.id } })).body).toBe("Von Hand geschrieben.");
    expect((await db.bbrConcern.findUniqueOrThrow({ where: { id: concern.id } })).genStatus).toBe("GEAENDERT");
    const bbr = await db.marketingPost.findFirstOrThrow({ where: { bbrConcernId: concern.id, account: "BBR" } });
    expect(bbr.body).toContain("Ganz neue Kurzfassung");

    // freigegeben + „Neu erstellen“ → zusätzlicher Entwurf, Freigegebenes bleibt
    await approvePost(admin, ov.id);
    await regenerateConcern(admin, concern.id);
    const ovPosts = await db.marketingPost.findMany({ where: { bbrConcernId: concern.id, account: "OV" }, orderBy: { createdAt: "asc" } });
    expect(ovPosts.map((p) => p.status)).toEqual(["FREIGEGEBEN", "ENTWURF"]);
  }, 60_000);

  it("meldet abgelehnte Zugangsdaten und erzeugt trotzdem offene Test-Anliegen", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const vorstand = await makeUser({ role: "VORSTAND" });
    const denied = vi.fn(async () => new Response("", { status: 401 })) as unknown as typeof fetch;
    await runBbrSync(denied);
    const sync = JSON.parse((await db.setting.findUniqueOrThrow({ where: { key: "bbr.lastSync" } })).value);
    expect(sync).toMatchObject({ ok: false });
    expect(sync.message).toMatch(/abgelehnt/);

    await expect(createTestConcern(vorstand, form({ title: "Testanliegen", bezirk: "Friedrichsfeld", kurzfassung: KURZ }))).rejects.toBeInstanceOf(ForbiddenError);
    const c = await createTestConcern(admin, form({ title: "Testanliegen Spielplatz", bezirk: "Friedrichsfeld", kurzfassung: KURZ }));
    expect(c.deckCardId).toBeLessThan(0);
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
    const parse = vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: { bbr: v("Sachlich"), ov: v("Politisch") } }));
    const client = { beta: { messages: { parse } } } as never;
    const r = await generateForConcern(c.id, { client });
    expect(r?.aiUsed).toBe(true);
    const sent = (parse.mock.calls[0] as unknown as [{ messages: { content: string }[] }])[0].messages[0]!.content;
    expect(sent).toContain("<kurzfassung>");
    const posts = await db.marketingPost.findMany({ where: { bbrConcernId: c.id } });
    expect(posts.find((p) => p.account === "BBR")!.body).toBe("Sachlich Facebook");
    expect(posts.find((p) => p.account === "OV")!.variants).toMatchObject({ x: "Politisch X" });
  });
});
