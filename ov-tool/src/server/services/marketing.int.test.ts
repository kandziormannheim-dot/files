import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { approvePost, createPost, markPublished, sendToWordpress, updatePost } from "./marketing";

describe.skipIf(!hasTestDb)("Marketing (DB)", () => {
  beforeEach(resetDb);

  it("Vorstand legt Entwurf an, nur der Admin gibt frei; Änderung hebt Freigabe auf", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const admin = await makeUser({ role: "ADMIN" });
    const post = await createPost(v, form({ kind: "SOCIAL", brief: "Infostand am Samstag auf dem Rathausplatz", "channels[]": ["facebook"] }));
    expect(post.channels).toEqual(["facebook"]);
    await updatePost(v, post.id, form({ title: "Infostand", body: "Kommt vorbei!", hashtags: "#Seckenheim", "channels[]": ["facebook"] }));
    await expect(approvePost(v, post.id)).rejects.toBeInstanceOf(ForbiddenError);
    await approvePost(admin, post.id);
    await expect(updatePost(v, post.id, form({ title: "x", body: "y" }))).rejects.toBeInstanceOf(ForbiddenError);
    await updatePost(admin, post.id, form({ title: "Infostand", body: "Kommt alle vorbei!", "channels[]": ["facebook"] }));
    expect((await db.marketingPost.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("ENTWURF");
    await approvePost(admin, post.id);
    await markPublished(admin, post.id);
    expect((await db.marketingPost.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("VEROEFFENTLICHT");
  });

  it("übernimmt fertigen Titel und Text ohne KI (Vorbelegung über Link)", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const post = await createPost(
      v,
      form({ kind: "SOCIAL", brief: "Testthema Spielplatz am Beispielweg", "channels[]": ["instagram"], title: "Neuer Spielplatz", body: "Der Spielplatz am Beispielweg wird erneuert." }),
    );
    expect(post.title).toBe("Neuer Spielplatz");
    expect(post.body).toBe("Der Spielplatz am Beispielweg wird erneuert.");
    expect(post.status).toBe("ENTWURF");
  });

  it("blockiert Freigabe mit offenen Platzhaltern", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const post = await createPost(admin, form({ kind: "BLOG", brief: "Bericht von der Vorstandssitzung", site: "SF" }));
    await updatePost(admin, post.id, form({ title: "Bericht", body: "Am [Datum ergänzen] traf sich der Vorstand." }));
    await expect(approvePost(admin, post.id)).rejects.toBeInstanceOf(UserError);
  });

  it("sendet freigegebene Blogartikel per REST an WordPress", async () => {
    vi.stubEnv("WP_SF_URL", "https://wp.example.org/");
    vi.stubEnv("WP_SF_USER", "redaktion");
    vi.stubEnv("WP_SF_APP_PASSWORD", "abcd efgh");
    const admin = await makeUser({ role: "ADMIN" });
    const post = await createPost(admin, form({ kind: "BLOG", brief: "Bericht von der Vorstandssitzung", site: "SF" }));
    await updatePost(admin, post.id, form({ title: "Bericht", body: "Einleitung.\n\n## Ergebnisse\n\nText <b>fett</b>.", site: "SF" }));
    await approvePost(admin, post.id);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 42, link: "https://wp.example.org/?p=42", status: "draft" }), { status: 201 }));
    await sendToWordpress(admin, post.id, ["SF"], "draft", fetchMock as unknown as typeof fetch);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://wp.example.org/wp-json/wp/v2/posts");
    const body = JSON.parse(String(init.body));
    expect(body.status).toBe("draft");
    expect(body.content).toContain("<h2");
    expect(body.content).toContain("&lt;b&gt;");
    const saved = await db.marketingPost.findUniqueOrThrow({ where: { id: post.id }, include: { wordpress: true } });
    expect(saved.status).toBe("FREIGEGEBEN");
    expect(saved.wordpress).toMatchObject([{ site: "SF", wpPostId: 42, wpStatus: "draft" }]);
    vi.unstubAllEnvs();
  });
});
