import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { planDuration, type VideoPlan } from "@/lib/video-plan";
import { finalArgs, parseProbe, probe, renderPlan, shotArgs } from "./video-edit";

describe("Videoschnitt – ffmpeg-Argumente", () => {
  it("schneidet füllend zu, blendet zeitgesteuert ein und ersetzt fehlenden Ton durch Stille", () => {
    const a = shotArgs({ input: "c.mp4", start: 1.5, duration: 4, format: "9:16", tone: "stumm", hasAudio: true, overlays: [{ path: "d.png" }, { path: "t.png", from: 0, to: 3 }], out: "o.mp4" });
    const fc = a[a.indexOf("-filter_complex") + 1]!;
    expect(fc).toContain("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920");
    expect(fc).toContain("enable='between(t,0.00,3.00)'");
    expect(a).toContain("anullsrc=r=48000:cl=stereo");
    expect(a.slice(0, 10)).toEqual(["-y", "-hide_banner", "-loglevel", "error", "-ss", "1.50", "-t", "4.00", "-i", "c.mp4"]);
    const b = shotArgs({ input: "c.mp4", start: 0, duration: 3, format: "16:9", tone: "leise", hasAudio: true, overlays: [], out: "o.mp4" });
    expect(b[b.indexOf("-filter_complex") + 1]).toContain("volume=0.22");
  });

  it("legt Musik geduckt unter die Sprache", () => {
    const f = finalArgs({ joined: "j.mp4", total: 20, music: "m.mp3", musicVolume: 15, out: "o.mp4" });
    const fc = f[f.indexOf("-filter_complex") + 1]!;
    expect(fc).toContain("sidechaincompress");
    expect(fc).toContain("volume=0.15");
    expect(f).toContain("-stream_loop");
  });

  it("liest Hochkant-Videos vom Handy richtig", () => {
    const p = parseProbe({ format: { duration: "12.345" }, streams: [{ codec_type: "video", width: 1920, height: 1080, side_data_list: [{ rotation: -90 }] }, { codec_type: "audio" }] });
    expect(p).toEqual({ duration: 12.35, width: 1080, height: 1920, rotation: 90, hasAudio: true, hasVideo: true });
  });
});

// Echtes Rendern dauert etwa eine halbe Minute: VIDEO_RENDER_TEST=1 npx vitest run src/server/media/video-edit.test.ts
describe.skipIf(!process.env.VIDEO_RENDER_TEST)("Videoschnitt – Rendern", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ov-video-test-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const make = (name: string, args: string[]) => {
    const out = path.join(dir, name);
    execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args, out]);
    return out;
  };

  it("rendert Hoch- und Querformat mit Titel, Einblendung, Untertiteln und Abschlusstafel", async () => {
    const quer = make("quer.mp4", ["-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=8", "-f", "lavfi", "-i", "sine=f=440:d=8", "-shortest", "-c:v", "libx264", "-c:a", "aac"]);
    const hoch = make("hoch.mp4", ["-f", "lavfi", "-i", "testsrc=s=720x1280:r=25:d=6", "-c:v", "libx264"]);
    const musik = make("musik.mp3", ["-f", "lavfi", "-i", "sine=f=220:d=4"]);
    const words = [
      { start: 0.5, end: 1.0, word: "Hier" },
      { start: 1.0, end: 1.4, word: "fehlt" },
      { start: 1.4, end: 1.6, word: "ein" },
      { start: 1.6, end: 2.4, word: "Zebrastreifen." },
    ];
    const plan: VideoPlan = {
      titel: "Sicherer Schulweg?",
      unterzeile: "Kreuzung Hauptstraße",
      shots: [
        { clipId: "q", start: 0.3, end: 3.0, ton: "original", einblendung: "", untertitel: true, untertitelText: "" },
        { clipId: "h", start: 1, end: 4, ton: "stumm", einblendung: "Täglich 300 Kinder", untertitel: false, untertitelText: "" },
      ],
      abschluss: "Gemeinsam für sichere Schulwege",
      aufruf: "Mehr auf cdu-sf.de",
      beitragstext: "",
      hashtags: "",
      begruendung: "",
    };
    const clips = [
      { id: "q", file: quer, hasAudio: true, transcript: [{ start: 0.5, end: 2.4, text: "Hier fehlt ein Zebrastreifen.", words }] },
      { id: "h", file: hoch, hasAudio: false, transcript: null },
    ];
    for (const format of ["9:16", "16:9"] as const) {
      const out = await renderPlan({ plan, clips, format, branding: { accountName: "CDU Seckenheim-Friedrichsfeld", defaultLogo: "logo-ov.png" }, music: musik, musicVolume: 15, workDir: dir });
      const p = await probe(out);
      expect(p.hasAudio).toBe(true);
      expect(p.width).toBe(format === "9:16" ? 1080 : 1920);
      expect(Math.abs(p.duration - planDuration(plan))).toBeLessThan(0.25);
      if (process.env.VIDEO_RENDER_KEEP) execFileSync("cp", [out, path.join(process.env.VIDEO_RENDER_KEEP, `test-${format.replace(":", "x")}.mp4`)]);
    }
  }, 180_000);
});
