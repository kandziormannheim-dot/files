import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { planDuration, type VideoPlan } from "@/lib/video-plan";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { storedFileExists } from "@/server/files";
import { createProject, outputsOf, planOf, processProject, requestRevision, resumeInterruptedJobs, savePlan, toMarketingPost, updateLogo, uploadChunk } from "./video";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const base = {
  title: "Schulweg",
  topic: "An der Kreuzung queren täglich viele Schulkinder ohne Zebrastreifen.",
  message: "Sichere Schulwege",
  callToAction: "Mehr auf cdu-sf.de",
  account: "OV",
  "formats[]": ["9:16", "1:1"],
  maxSeconds: "20",
  subtitles: "on",
  consent: "on",
};

describe.skipIf(!hasTestDb || !hasFfmpeg)("Videoschnitt (DB, ffmpeg)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ov-video-int-"));
  let whisper: Server;
  let clipFile: string;
  let mutedFile: string;

  beforeAll(async () => {
    clipFile = path.join(dir, "interview.mp4");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=25:d=7", "-f", "lavfi", "-i", "sine=f=330:d=7", "-shortest", "-c:v", "libx264", "-c:a", "aac", clipFile]);
    mutedFile = path.join(dir, "kreuzung.mov");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=360x640:r=30:d=5", "-c:v", "libx264", mutedFile]);
    // Whisper-Attrappe mit Wort-Zeitstempeln
    whisper = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            segments: [
              { start: 0.4, end: 2.6, text: " Hier ist es gefährlich.", words: [{ start: 0.4, end: 0.8, word: " Hier" }, { start: 0.8, end: 1.0, word: " ist" }, { start: 1.0, end: 1.3, word: " es" }, { start: 1.3, end: 2.5, word: " gefährlich." }] },
              { start: 3.0, end: 5.5, text: " Wir brauchen einen Zebrastreifen.", words: [{ start: 3.0, end: 3.3, word: " Wir" }, { start: 3.3, end: 3.9, word: " brauchen" }, { start: 3.9, end: 4.2, word: " einen" }, { start: 4.2, end: 5.4, word: " Zebrastreifen." }] },
            ],
          }),
        );
      });
    });
    await new Promise<void>((r) => whisper.listen(0, "127.0.0.1", () => r()));
    const addr = whisper.address() as { port: number };
    process.env.WHISPER_URL = `http://127.0.0.1:${addr.port}`;
    process.env.ANTHROPIC_API_KEY = "test";
  });
  afterAll(() => {
    whisper?.close();
    delete process.env.WHISPER_URL;
    delete process.env.ANTHROPIC_API_KEY;
    rmSync(dir, { recursive: true, force: true });
  });
  beforeEach(resetDb);

  async function upload(user: { id: string; role: never }, projectId: string, file: string, name: string, parts = 2) {
    const data = readFileSync(file);
    const size = Math.ceil(data.length / parts);
    let result: Awaited<ReturnType<typeof uploadChunk>> = { done: false };
    for (let i = 0; i < parts; i++) {
      const chunk = data.subarray(i * size, Math.min(data.length, (i + 1) * size));
      const meta = { uploadId: `up${name.toLowerCase().replace(/[^a-z0-9]/g, "")}abc`, index: i, total: parts, offset: i * size, fileName: name, fileSize: data.length };
      result = await uploadChunk(user, projectId, meta, chunk);
      if (i === 0 && parts > 1) expect(await uploadChunk(user, projectId, meta, chunk)).toEqual({ done: false }); // Wiederholung wird nicht doppelt angehängt
    }
    return result;
  }

  it("lädt in Stücken hoch, plant mit Claude, rendert alle Formate und übernimmt das Video als Beitrag", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const r = await makeUser({ role: "LESEZUGRIFF" });
    await expect(createProject(v, form({ ...base, consent: undefined }))).rejects.toBeInstanceOf(UserError);
    await expect(createProject(r, form(base))).rejects.toBeInstanceOf(ForbiddenError);
    const project = await createProject(v, form(base));
    expect(project.formats).toEqual(["9:16", "1:1"]);

    const a = await upload(v as never, project.id, clipFile, "Interview Anwohnerin.mp4");
    const b = await upload(v as never, project.id, mutedFile, "Kreuzung.mov", 1);
    expect(a.done && b.done).toBe(true);
    await expect(uploadChunk(v, project.id, { uploadId: "badfile123", index: 0, total: 1, offset: 0, fileName: "x.exe", fileSize: 3 }, Buffer.from("abc"))).rejects.toBeInstanceOf(UserError);
    const clips = await db.videoClip.findMany({ where: { projectId: project.id }, orderBy: { sortOrder: "asc" } });
    expect(clips.map((c) => [c.hasAudio, c.width, c.height])).toEqual([
      [true, 640, 360],
      [false, 360, 640],
    ]);

    // Claude-Attrappe: prüft, dass Standbilder und Transkript ankommen, und liefert einen Plan mit C1/C2
    let seen = "";
    let images = 0;
    const plan: VideoPlan = {
      titel: "Gefährlicher Schulweg?",
      unterzeile: "",
      shots: [
        { clipId: "C1", start: 0.6, end: 2.4, ton: "original", einblendung: "", untertitel: true, untertitelText: "" }, // wird an Wortgrenzen gelegt
        { clipId: "C2", start: 0.5, end: 3.5, ton: "original", einblendung: "300 Kinder täglich", untertitel: true, untertitelText: "" }, // ohne Ton → stumm
        { clipId: "C1", start: 3.0, end: 5.5, ton: "original", einblendung: "", untertitel: true, untertitelText: "" },
      ],
      abschluss: "Sichere Schulwege",
      aufruf: "Mehr auf cdu-sf.de",
      beitragstext: "Wir setzen uns für einen Zebrastreifen ein.",
      hashtags: "#Seckenheim #Schulweg",
      begruendung: "O-Ton, Bild, O-Ton",
    };
    const client = {
      beta: {
        messages: {
          parse: async (req: { messages: { content: { type: string; text?: string }[] }[] }) => {
            const content = req.messages[0]!.content;
            images = content.filter((c) => c.type === "image").length;
            seen = content.map((c) => c.text ?? "").join("\n");
            return { stop_reason: "end_turn", parsed_output: plan };
          },
        },
      },
    } as unknown as Anthropic;
    await db.videoProject.update({ where: { id: project.id }, data: { status: "ANALYSE" } });
    await processProject(project.id, "full", v.id, client);

    expect(images).toBe(6);
    expect(seen).toContain('<clip id="C1"');
    expect(seen).toContain("Wir brauchen einen Zebrastreifen.");
    const done = await db.videoProject.findUniqueOrThrow({ where: { id: project.id } });
    expect(done.error).toBe("");
    expect(done.status).toBe("FERTIG");
    const saved = planOf(done)!;
    expect(saved.shots.map((s) => s.clipId)).toEqual([clips[0]!.id, clips[1]!.id, clips[0]!.id]);
    expect(saved.shots[0]).toMatchObject({ start: 0.28, end: 2.7 });
    expect(saved.shots[1]).toMatchObject({ ton: "stumm", untertitel: false, untertitelText: "" });
    expect(planDuration(saved)).toBeLessThanOrEqual(20);
    const files = outputsOf(done).files;
    expect(Object.keys(files).sort()).toEqual(["1:1", "9:16"]);
    expect(await storedFileExists(files["9:16"])).toBe(true);
    const clipAfter = await db.videoClip.findUniqueOrThrow({ where: { id: clips[0]!.id } });
    expect(Array.isArray(clipAfter.transcript)).toBe(true);

    // von Hand ändern → neu rendern
    const edited = { ...saved, titel: "Neuer Titel", shots: saved.shots.slice(0, 2) };
    await savePlan(v, project.id, form({ plan: JSON.stringify(edited) }));
    await processProject(project.id, "render", v.id);
    const again = await db.videoProject.findUniqueOrThrow({ where: { id: project.id } });
    expect(again).toMatchObject({ status: "FERTIG", planSource: "bearbeitet" });
    expect(planOf(again)!.titel).toBe("Neuer Titel");
    expect(await storedFileExists(files["9:16"])).toBe(false); // alte Fassung gelöscht

    const postId = await toMarketingPost(v, project.id);
    const post = await db.marketingPost.findUniqueOrThrow({ where: { id: postId } });
    expect(post).toMatchObject({ kind: "SOCIAL", status: "ENTWURF", body: "Wir setzen uns für einen Zebrastreifen ein.", hashtags: "#Seckenheim #Schulweg", account: "OV" });
    expect(await storedFileExists(post.videoPath)).toBe(true);
  }, 240_000);

  it("übernimmt Logo-Einstellungen und bessert den Schnitt per Regieanweisung nach, ohne Handanpassungen zu verlieren", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const project = await createProject(v, form({ ...base, "formats[]": ["16:9"], maxSeconds: "300" }));
    expect(project.maxSeconds).toBe(300);
    await upload(v as never, project.id, mutedFile, "kreuzung.mov", 1);

    // Logo: nur Bilder, SVG ohne Skripte
    const bad = form({ logoPosition: "unten-rechts", logoSize: "gross" });
    bad.set("logo", new File(["<svg onload=alert(1)></svg>"], "x.svg", { type: "image/svg+xml" }));
    await expect(updateLogo(v, project.id, bad)).rejects.toBeInstanceOf(UserError);
    const good = form({ logoPosition: "unten-rechts", logoSize: "gross", logoChip: "on" });
    good.set("logo", new File(['<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="200" height="60" fill="#2d3c4b"/></svg>'], "logo.svg", { type: "image/svg+xml" }));
    await updateLogo(v, project.id, good);
    const withLogo = await db.videoProject.findUniqueOrThrow({ where: { id: project.id } });
    expect(withLogo).toMatchObject({ logoPosition: "unten-rechts", logoSize: "gross", logoChip: true, logoName: "logo.svg" });
    expect(await storedFileExists(withLogo.logoPath)).toBe(true);

    const first: VideoPlan = {
      titel: "Titel",
      unterzeile: "",
      shots: [
        { clipId: "C1", start: 0, end: 3, ton: "stumm", einblendung: "Fakt eins", untertitel: false, untertitelText: "" },
        { clipId: "C1", start: 3, end: 5, ton: "stumm", einblendung: "Fakt zwei", untertitel: false, untertitelText: "" },
      ],
      abschluss: "A",
      aufruf: "B",
      beitragstext: "",
      hashtags: "",
      begruendung: "",
    };
    let prompt = "";
    const client = (reply: VideoPlan) =>
      ({
        beta: {
          messages: {
            parse: async (req: { messages: { content: { type: string; text?: string }[] }[] }) => {
              prompt = req.messages[0]!.content.map((c) => c.text ?? "").join("\n");
              return { stop_reason: "end_turn", parsed_output: reply };
            },
          },
        },
      }) as unknown as Anthropic;
    process.env.ANTHROPIC_API_KEY = "test";
    await processProject(project.id, "full", v.id, client(first));
    const cut = planOf(await db.videoProject.findUniqueOrThrow({ where: { id: project.id } }))!;
    // Hand: Titel und Einblendung verschoben
    await savePlan(v, project.id, form({ plan: JSON.stringify({ ...cut, titelPos: { x: 20, y: 30 }, shots: cut.shots.map((s, i) => (i === 1 ? { ...s, einblendungPos: { x: 50, y: 10 } } : s)) }) }));
    await processProject(project.id, "render", v.id);

    await expect(requestRevision(v, project.id, form({ anweisung: "kurz" }))).rejects.toThrow();
    // über die Job-Warteschlange (in Tests sofort): Auftrag muss als Nachbesserung ankommen, nicht als Neuschnitt
    const { jobHandlers } = await import("@/server/jobs/queue");
    await import("@/server/jobs/definitions");
    const calls: unknown[] = [];
    const vid = await import("./video");
    const handler = jobHandlers().get("video-process")!;
    const spy = vi.spyOn(vid, "processProject").mockImplementation(async (...a) => void calls.push(a));
    await handler({ projectId: project.id, mode: "revise", actorId: v.id, token: "t" });
    expect((calls[0] as unknown[])[1]).toBe("revise");
    spy.mockRestore();
    await requestRevision(v, project.id, form({ anweisung: "Fakt eins weglassen, Fakt zwei länger zeigen." }));
    // Claude-Antwort: erster Ausschnitt entfällt, zweiter länger – Einblendung gleich
    await processProject(project.id, "revise", v.id, client({ ...first, shots: [{ clipId: "C1", start: 2.8, end: 5, ton: "stumm", einblendung: "Fakt zwei", untertitel: false, untertitelText: "" }], begruendung: "Fakt eins entfernt." }));
    expect(prompt).toContain("<nachbesserung>Fakt eins weglassen, Fakt zwei länger zeigen.</nachbesserung>");
    expect(prompt).toContain("<aktueller_schnitt>");
    expect(prompt).toContain('"einblendung": "Fakt eins"');
    const after = await db.videoProject.findUniqueOrThrow({ where: { id: project.id } });
    expect(after).toMatchObject({ status: "FERTIG", planSource: "nachgebessert", revisionNotes: ["Fakt eins weglassen, Fakt zwei länger zeigen."] });
    const revised = planOf(after)!;
    expect(revised.shots).toHaveLength(1);
    expect(revised.shots[0]).toMatchObject({ einblendung: "Fakt zwei", einblendungPos: { x: 50, y: 10 }, start: 2.8, end: 5 });
    expect(revised.titelPos).toEqual({ x: 20, y: 30 });
  }, 240_000);

  it("überspringt überholte Aufträge und setzt unterbrochene nach einem Neustart fort", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const project = await createProject(v, form({ ...base, "formats[]": ["1:1"] }));
    await upload(v as never, project.id, mutedFile, "k.mov", 1);
    delete process.env.ANTHROPIC_API_KEY;
    await db.videoProject.update({ where: { id: project.id }, data: { status: "SCHNITT", jobToken: "neu", jobMode: "full" } });
    await processProject(project.id, "full", v.id, undefined, "alt"); // überholt → nichts passiert
    expect((await db.videoProject.findUniqueOrThrow({ where: { id: project.id } })).status).toBe("SCHNITT");
    // Neustart: Auftrag läuft erneut (in Tests sofort) und wird fertig
    expect(await resumeInterruptedJobs()).toBe(1);
    const done = await db.videoProject.findUniqueOrThrow({ where: { id: project.id } });
    expect(done).toMatchObject({ status: "FERTIG", jobToken: null, jobMode: null });
    // Standbilder für kurze Clips: drei
    const clip = await db.videoClip.findFirstOrThrow({ where: { projectId: project.id } });
    expect((clip.stills as unknown[]).length).toBe(3);
  }, 120_000);

  it("geht ohne Whisper ohne Untertitel weiter und meldet das", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const project = await createProject(v, form({ ...base, "formats[]": ["16:9"] }));
    await upload(v as never, project.id, clipFile, "a.mp4", 1);
    process.env.WHISPER_URL = "http://127.0.0.1:1";
    delete process.env.ANTHROPIC_API_KEY; // einfacher Schnitt ohne KI
    await processProject(project.id, "full", v.id);
    const done = await db.videoProject.findUniqueOrThrow({ where: { id: project.id } });
    expect(done.status).toBe("FERTIG");
    expect(done.planSource).toBe("einfach");
    expect(outputsOf(done).warnings.join(" ")).toContain("Whisper");
    expect(planOf(done)!.shots[0]!.untertitel).toBe(false);
  }, 120_000);
});
