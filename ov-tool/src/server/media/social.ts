import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { readStoredFile, storedFileExists } from "@/server/files";
import { fontFaceCss, htmlToPng } from "@/server/pdf/render";

// Bildkachel (1080×1350, 4:5 für Facebook/Instagram) und Kurzvideo (1080×1920, 9:16 für Reels/TikTok/Shorts)
// im CDU-Corporate-Design 2023: Cadenabbia-Türkis als Fläche, Rhöndorf-Blau für Text, Logo nur auf weißem Grund.
// Gerendert mit dem vorhandenen Chromium (keine externen Verbindungen), Video mit ffmpeg aus Texttafeln.

const execFileAsync = promisify(execFile);

export const IMAGE_SIZE = { width: 1080, height: 1350 } as const;
export const VIDEO_SIZE = { width: 1080, height: 1920 } as const;

const TUERKIS = "#52b7c1";
const RHOENDORF = "#2d3c4b";
const GOLD = "#ffa600";

export type Creative = { headline: string; subline: string; scenes: string[]; outro: string };

export type Branding = {
  /** Kanalname im Fuß, z. B. „CDU-Gruppe im BBR Seckenheim“ */
  accountName: string;
  /** kleine Marke oben, z. B. „Bezirksbeirat Seckenheim“ */
  kicker: string;
  /** eigenes Logo (Dateiablage), sonst das CDU-Logo */
  logoPath?: string | null;
  /** Zeilen der Kurzfassung für die Kachel */
  lines: string[];
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MIME: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function logoDataUri(logoPath?: string | null): Promise<string> {
  if (logoPath && (await storedFileExists(logoPath))) {
    const mime = MIME[path.extname(logoPath).toLowerCase()] ?? "image/png";
    return `data:${mime};base64,${(await readStoredFile(logoPath)).toString("base64")}`;
  }
  const svg = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", "cdu-logo.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/** Schriftgröße so wählen, dass ein Text ungefähr in die Fläche passt (grobe Zeichenbreite Inter Extrabold ≈ 0,58 em). */
export function fitFontSize(text: string, boxWidth: number, maxLines: number, max: number, min: number): number {
  const len = Math.max(1, text.length);
  for (let size = max; size > min; size -= 2) {
    const perLine = Math.floor(boxWidth / (size * 0.58));
    if (Math.ceil(len / Math.max(1, perLine)) <= maxLines) return size;
  }
  return min;
}

async function page(width: number, height: number, body: string, extraCss = ""): Promise<string> {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${await fontFaceCss()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden}
body{font-family:Inter,"DejaVu Sans",sans-serif;color:${RHOENDORF};-webkit-font-smoothing:antialiased;hyphens:auto;-webkit-hyphens:auto}
.kicker{display:inline-block;background:#fff;color:${RHOENDORF};font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-radius:6px}
.logo-chip{background:#fff;display:flex;align-items:center}
.logo-chip img{display:block}
${extraCss}</style></head><body>${body}</body></html>`;
}

// ---------------------------------------------------------------------------
// Bildkachel 1080×1350
// ---------------------------------------------------------------------------

export async function imageHtml(c: Creative, b: Branding): Promise<string> {
  const { width, height } = IMAGE_SIZE;
  const logo = await logoDataUri(b.logoPath);
  const hSize = fitFontSize(c.headline, width - 160, 4, 92, 56);
  const lines = b.lines.slice(0, 4);
  const lineSize = fitFontSize(lines.join(" "), width - 160, 7, 34, 24);
  const body = `
<div style="display:flex;flex-direction:column;height:${height}px">
  <div style="flex:1 1 auto;min-height:${Math.round(height * 0.5)}px;background:${TUERKIS};padding:72px 80px 64px;display:flex;flex-direction:column;position:relative">
    <span class="kicker" style="align-self:flex-start;font-size:26px;padding:10px 18px">${esc(b.kicker)}</span>
    <h1 lang="de" style="margin-top:auto;padding-top:40px;color:#fff;font-weight:900;font-size:${hSize}px;line-height:1.04;letter-spacing:-.01em">${esc(c.headline)}</h1>
    ${c.subline ? `<p style="margin-top:28px;color:${RHOENDORF};font-weight:600;font-size:36px;line-height:1.25">${esc(c.subline)}</p>` : ""}
    <div style="position:absolute;left:80px;bottom:-8px;width:160px;height:16px;background:${GOLD}"></div>
  </div>
  <div style="flex:none;background:#fff;padding:56px 80px 48px">
    <ul style="list-style:none;display:flex;flex-direction:column;gap:18px">
      ${lines.map((l) => `<li style="display:flex;gap:20px;font-size:${lineSize}px;line-height:1.3;font-weight:500"><span style="flex:none;width:10px;margin-top:${Math.round(lineSize * 0.3)}px;height:${Math.round(lineSize * 0.75)}px;background:${TUERKIS}"></span><span>${esc(l)}</span></li>`).join("")}
    </ul>
  </div>
  <div style="flex:none;height:150px;padding:0 80px;display:flex;align-items:center;justify-content:space-between;background:#fff;border-top:2px solid #e3e8ea">
    <div class="logo-chip"><img src="${logo}" alt="" style="height:78px;max-width:330px;object-fit:contain"></div>
    <p style="font-weight:800;font-size:28px;text-align:right;max-width:560px;line-height:1.2">${esc(b.accountName)}</p>
  </div>
</div>`;
  return page(width, height, body);
}

export async function renderSocialImage(c: Creative, b: Branding): Promise<Buffer> {
  return htmlToPng(await imageHtml(c, b), IMAGE_SIZE.width, IMAGE_SIZE.height);
}

// ---------------------------------------------------------------------------
// Kurzvideo 1080×1920: Titeltafel → Szenen → Abschluss, weiche Übergänge, stille Tonspur
// ---------------------------------------------------------------------------

export async function videoFramesHtml(c: Creative, b: Branding): Promise<string[]> {
  const { width, height } = VIDEO_SIZE;
  const logo = await logoDataUri(b.logoPath);
  const footer = (bg: string, color: string) => `
<div style="position:absolute;left:0;right:0;bottom:0;height:230px;background:${bg};display:flex;align-items:center;justify-content:space-between;padding:0 80px">
  <div class="logo-chip" style="padding:14px 18px;border-radius:8px"><img src="${logo}" alt="" style="height:84px;max-width:330px;object-fit:contain"></div>
  <p style="color:${color};font-weight:800;font-size:32px;line-height:1.2;text-align:right;max-width:520px">${esc(b.accountName)}</p>
</div>`;

  const title = `
<div style="position:absolute;inset:0;background:${TUERKIS};padding:220px 80px 0">
  <span class="kicker" style="font-size:34px;padding:12px 22px">${esc(b.kicker)}</span>
  <h1 lang="de" style="margin-top:70px;color:#fff;font-weight:900;font-size:${fitFontSize(c.headline, width - 160, 5, 120, 72)}px;line-height:1.03;letter-spacing:-.01em">${esc(c.headline)}</h1>
  <div style="margin-top:60px;width:200px;height:20px;background:${GOLD}"></div>
</div>${footer("#fff", RHOENDORF)}`;

  const scenes = c.scenes.slice(0, 4).map(
    (s, i, all) => `
<div style="position:absolute;inset:0;background:#fff;padding:260px 80px 0">
  <p style="font-weight:900;font-size:56px;color:${TUERKIS}">${i + 1}<span style="color:#b8c4c9">/${all.length}</span></p>
  <div style="margin-top:50px;display:flex;gap:36px">
    <span style="flex:none;width:18px;background:${TUERKIS}"></span>
    <p lang="de" style="font-weight:800;font-size:${fitFontSize(s, width - 214, 7, 84, 52)}px;line-height:1.15">${esc(s)}</p>
  </div>
</div>${footer(TUERKIS, "#fff")}`,
  );

  const outro = `
<div style="position:absolute;inset:0;background:${RHOENDORF};padding:420px 80px 0;text-align:center">
  <p lang="de" style="color:#fff;font-weight:900;font-size:${fitFontSize(c.outro || b.accountName, width - 160, 4, 96, 60)}px;line-height:1.08">${esc(c.outro || b.accountName)}</p>
  <div style="margin:60px auto 0;width:200px;height:20px;background:${TUERKIS}"></div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:520px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px">
  <img src="${logo}" alt="" style="height:150px;max-width:640px;object-fit:contain">
  <p style="font-weight:800;font-size:40px;text-align:center;padding:0 80px">${esc(b.accountName)}</p>
</div>`;

  return Promise.all([title, ...scenes, outro].map((body) => page(width, height, body)));
}

/** Dauer je Tafel (Sekunden) und Überblendung. */
export function videoTimeline(sceneCount: number) {
  const fade = 0.5;
  const durations = [3, ...Array.from({ length: sceneCount }, () => 4), 3.5];
  const offsets: number[] = [];
  let t = 0;
  for (let i = 1; i < durations.length; i++) {
    t += durations[i - 1]! - fade;
    offsets.push(Number(t.toFixed(2)));
  }
  const total = durations.reduce((a, b) => a + b, 0) - fade * (durations.length - 1);
  return { fade, durations, offsets, total: Number(total.toFixed(2)) };
}

export function ffmpegArgs(framePaths: string[], out: string) {
  const { fade, durations, offsets, total } = videoTimeline(framePaths.length - 2);
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  framePaths.forEach((p, i) => args.push("-loop", "1", "-t", String(durations[i]), "-i", p));
  args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo");
  const parts = framePaths.map((_, i) => `[${i}:v]fps=30,format=yuv420p,setsar=1[v${i}]`);
  let last = "v0";
  for (let i = 1; i < framePaths.length; i++) {
    const transition = i === framePaths.length - 1 ? "fade" : "slideleft";
    parts.push(`[${last}][v${i}]xfade=transition=${transition}:duration=${fade}:offset=${offsets[i - 1]}[x${i}]`);
    last = `x${i}`;
  }
  args.push(
    "-filter_complex",
    parts.join(";"),
    "-map",
    `[${last}]`,
    "-map",
    `${framePaths.length}:a`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-shortest",
    "-movflags",
    "+faststart",
    out,
  );
  return args;
}

export async function renderSocialVideo(c: Creative, b: Branding): Promise<Buffer> {
  const frames = await videoFramesHtml(c, b);
  const dir = await mkdtemp(path.join(tmpdir(), "ov-video-"));
  try {
    const paths: string[] = [];
    for (const [i, html] of frames.entries()) {
      const p = path.join(dir, `f${i}.png`);
      await writeFile(p, await htmlToPng(html, VIDEO_SIZE.width, VIDEO_SIZE.height));
      paths.push(p);
    }
    const out = path.join(dir, "video.mp4");
    await execFileAsync(process.env.FFMPEG_PATH || "ffmpeg", ffmpegArgs(paths, out), { timeout: 180_000 });
    return await readFile(out);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new Error("ffmpeg ist nicht installiert – Video kann nicht erzeugt werden.");
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
