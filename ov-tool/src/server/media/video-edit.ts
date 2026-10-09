import "server-only";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { OUTRO_SECONDS, planDuration, subtitleCues, TITLE_SECONDS, VIDEO_FORMATS, type Segment, type ShotTone, type VideoFormat, type VideoPlan } from "@/lib/video-plan";
import { fontFaceCss, htmlToPng } from "@/server/pdf/render";
import { logoDataUri, type Branding } from "./social";

// Videoschnitt aus hochgeladenen Clips: Analyse (ffprobe, Standbilder, Tonspur für Whisper) und Rendern eines Schnittplans
// je Format mit Titelzeile, Texteinblendungen, Untertiteln, Logo, Abschlusstafel und optionaler Musik (geduckt unter O-Tönen).
// Texte und Logo werden mit Chromium als transparente PNGs gesetzt (Inter, CDU-Farben) und mit ffmpeg eingeblendet.

const execFileAsync = promisify(execFile);
const ffmpegBin = () => process.env.FFMPEG_PATH || "ffmpeg";
const ffprobeBin = () => process.env.FFPROBE_PATH || (process.env.FFMPEG_PATH ? path.join(path.dirname(process.env.FFMPEG_PATH), "ffprobe") : "ffprobe");

const TUERKIS = "#52b7c1";
const RHOENDORF = "#2d3c4b";
const GOLD = "#ffa600";

async function run(bin: string, args: string[], timeout = 600_000) {
  try {
    return await execFileAsync(bin, args, { timeout, maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`${path.basename(bin)} ist nicht installiert – Video kann nicht bearbeitet werden.`);
    const stderr = String((err as { stderr?: string }).stderr ?? "").trim().split("\n").slice(-3).join(" ");
    throw new Error(`${path.basename(bin)} fehlgeschlagen${stderr ? `: ${stderr}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

export type ProbeResult = { duration: number; width: number; height: number; rotation: number; hasAudio: boolean; hasVideo: boolean };

export function parseProbe(json: unknown): ProbeResult {
  const data = json as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number; duration?: string; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[];
  };
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const rotation = Math.abs(Number(video?.tags?.rotate ?? video?.side_data_list?.find((d) => d.rotation != null)?.rotation ?? 0)) % 360;
  const rotated = rotation === 90 || rotation === 270;
  const duration = Number(data.format?.duration ?? video?.duration ?? 0);
  return {
    duration: Number.isFinite(duration) ? Math.round(duration * 100) / 100 : 0,
    width: (rotated ? video?.height : video?.width) ?? 0,
    height: (rotated ? video?.width : video?.height) ?? 0,
    rotation,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hasVideo: !!video,
  };
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await run(ffprobeBin(), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], 60_000);
  return parseProbe(JSON.parse(stdout));
}

/** Standbilder (JPEG, 768 px breit) für Vorschau und KI bei 10 %, 50 % und 85 % der Länge. */
export async function extractStills(file: string, duration: number): Promise<{ t: number; data: Buffer }[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "ov-stills-"));
  try {
    const out: { t: number; data: Buffer }[] = [];
    for (const [i, f] of [0.1, 0.5, 0.85].entries()) {
      const t = Math.round(Math.max(0, Math.min(duration - 0.1, duration * f)) * 10) / 10;
      const p = path.join(dir, `s${i}.jpg`);
      await run(ffmpegBin(), ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=768:-2", "-q:v", "4", p], 60_000);
      out.push({ t, data: await readFile(p) });
    }
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Tonspur als WAV (16 kHz mono) für Whisper. */
export async function extractAudio(file: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "ov-audio-"));
  try {
    const p = path.join(dir, "ton.wav");
    await run(ffmpegBin(), ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", p], 300_000);
    return await readFile(p);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Grafiken (transparente PNGs in Formatgröße)
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Layout = {
  logo: { top: number; left: number; height: number };
  title: { top: number; side: number; size: number; sub: number; maxWidth?: number };
  lower: { bottom: number; side: number; size: number; align: "left" | "center" };
  subs: { bottom: number; size: number; maxWidth: number };
  outro: { band: number; text: number; cta: number; logo: number };
};

/** Positionen je Format mit Abstand zu den Bedienelementen von Instagram/TikTok (oben, unten, rechts). */
export function layoutFor(format: VideoFormat): Layout {
  if (format === "9:16")
    return {
      logo: { top: 110, left: 60, height: 96 },
      title: { top: 300, side: 60, size: 86, sub: 42 },
      lower: { bottom: 700, side: 60, size: 54, align: "left" },
      subs: { bottom: 470, size: 52, maxWidth: 900 },
      outro: { band: 600, text: 92, cta: 50, logo: 300 },
    };
  if (format === "1:1")
    return {
      logo: { top: 50, left: 50, height: 80 },
      title: { top: 170, side: 50, size: 72, sub: 36 },
      lower: { bottom: 250, side: 50, size: 46, align: "left" },
      subs: { bottom: 80, size: 44, maxWidth: 960 },
      outro: { band: 340, text: 76, cta: 42, logo: 200 },
    };
  return {
    logo: { top: 50, left: 60, height: 90 },
    title: { top: 170, side: 80, size: 80, sub: 40, maxWidth: 1200 },
    lower: { bottom: 210, side: 80, size: 50, align: "left" },
    subs: { bottom: 70, size: 48, maxWidth: 1500 },
    outro: { band: 330, text: 80, cta: 44, logo: 210 },
  };
}

async function page(width: number, height: number, body: string, transparent: boolean) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${await fontFaceCss()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden;background:${transparent ? "transparent" : "#fff"}}
body{position:relative;font-family:Inter,"DejaVu Sans",sans-serif;color:${RHOENDORF};-webkit-font-smoothing:antialiased;hyphens:auto;-webkit-hyphens:auto}
.box{display:inline;box-decoration-break:clone;-webkit-box-decoration-break:clone}
</style></head><body>${body}</body></html>`;
}

type Logo = { uri: string; named: boolean };

function logoChip(l: Layout, logo: Logo) {
  // Logo laut CD nur auf weißem Grund
  return `<div style="position:absolute;top:${l.logo.top}px;left:${l.logo.left}px;background:#fff;border-radius:10px;padding:${Math.round(l.logo.height * 0.14)}px ${Math.round(l.logo.height * 0.2)}px;box-shadow:0 4px 18px rgba(0,0,0,.18)">
  <img src="${logo.uri}" alt="" style="display:block;height:${l.logo.height}px;max-width:${l.logo.height * 4}px;object-fit:contain"></div>`;
}

export async function decoHtml(format: VideoFormat, logo: Logo, einblendung: string) {
  const { width, height } = VIDEO_FORMATS[format];
  const l = layoutFor(format);
  const lower = einblendung
    ? `<div style="position:absolute;left:${l.lower.side}px;right:${l.lower.side}px;bottom:${l.lower.bottom}px;text-align:${l.lower.align}">
  <p lang="de" style="font-weight:800;font-size:${l.lower.size}px;line-height:1.32;color:#fff"><span class="box" style="background:${TUERKIS};padding:.12em .35em">${esc(einblendung)}</span></p>
  <div style="margin-top:14px;width:${Math.round(l.lower.size * 2.4)}px;height:${Math.round(l.lower.size * 0.22)}px;background:${GOLD};${l.lower.align === "center" ? "margin-left:auto;margin-right:auto" : ""}"></div>
</div>`
    : "";
  return page(width, height, `${logoChip(l, logo)}${lower}`, true);
}

export async function titleHtml(format: VideoFormat, titel: string, unterzeile: string) {
  const { width, height } = VIDEO_FORMATS[format];
  const l = layoutFor(format);
  return page(
    width,
    height,
    `<div style="position:absolute;top:${l.title.top}px;left:${l.title.side}px;right:${l.title.side}px;${l.title.maxWidth ? `max-width:${l.title.maxWidth}px` : ""}">
  <h1 lang="de" style="font-weight:900;font-size:${l.title.size}px;line-height:1.18;color:#fff;letter-spacing:-.01em"><span class="box" style="background:${TUERKIS};padding:.06em .3em">${esc(titel)}</span></h1>
  ${unterzeile ? `<p lang="de" style="margin-top:22px;font-weight:700;font-size:${l.title.sub}px;line-height:1.35;color:${RHOENDORF}"><span class="box" style="background:#fff;padding:.12em .4em">${esc(unterzeile)}</span></p>` : ""}
</div>`,
    true,
  );
}

export async function cueHtml(format: VideoFormat, text: string) {
  const { width, height } = VIDEO_FORMATS[format];
  const l = layoutFor(format);
  return page(
    width,
    height,
    `<div style="position:absolute;left:0;right:0;bottom:${l.subs.bottom}px;display:flex;justify-content:center">
  <p lang="de" style="max-width:${l.subs.maxWidth}px;text-align:center;font-weight:800;font-size:${l.subs.size}px;line-height:1.34;color:#fff"><span class="box" style="background:rgba(45,60,75,.86);padding:.1em .35em;border-radius:8px">${esc(text)}</span></p>
</div>`,
    true,
  );
}

export async function outroHtml(format: VideoFormat, logo: Logo, abschluss: string, aufruf: string, accountName: string) {
  const { width, height } = VIDEO_FORMATS[format];
  const l = layoutFor(format);
  const pad = format === "16:9" ? 120 : 80;
  return page(
    width,
    height,
    `<div style="position:absolute;left:0;right:0;top:0;bottom:${l.outro.band}px;background:${TUERKIS};display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 ${pad}px;text-align:center">
  <p lang="de" style="color:#fff;font-weight:900;font-size:${l.outro.text}px;line-height:1.1">${esc(abschluss || accountName)}</p>
  <div style="margin:${Math.round(l.outro.text * 0.45)}px auto 0;width:180px;height:18px;background:${GOLD}"></div>
  ${aufruf ? `<p lang="de" style="margin-top:${Math.round(l.outro.text * 0.45)}px;color:${RHOENDORF};font-weight:800;font-size:${l.outro.cta}px;line-height:1.25"><span class="box" style="background:#fff;padding:.12em .4em;border-radius:6px">${esc(aufruf)}</span></p>` : ""}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:${l.outro.band}px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px">
  <img src="${logo.uri}" alt="" style="height:${logo.named ? l.outro.logo : Math.round(l.outro.logo * 0.5)}px;max-width:${width - 160}px;object-fit:contain">
  ${logo.named ? "" : `<p style="font-weight:800;font-size:${Math.round(l.outro.cta * 0.85)}px">${esc(accountName)}</p>`}
</div>`,
    false,
  );
}

// ---------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------

export type Overlay = { path: string; from?: number; to?: number };

const TONE_VOLUME: Record<ShotTone, number> = { original: 1, leise: 0.22, stumm: 0 };
const ENCODE = ["-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-video_track_timescale", "15360", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"];

/** ffmpeg-Argumente für einen Ausschnitt: zuschneiden (füllend), Overlays zeitgesteuert, Ton je nach Einstellung. */
export function shotArgs(o: { input: string; start: number; duration: number; format: VideoFormat; tone: ShotTone; hasAudio: boolean; overlays: Overlay[]; out: string; fadeIn?: boolean }) {
  const { width: w, height: h } = VIDEO_FORMATS[o.format];
  const d = o.duration.toFixed(2);
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-ss", o.start.toFixed(2), "-t", d, "-i", o.input];
  o.overlays.forEach((ov) => args.push("-loop", "1", "-t", d, "-i", ov.path));
  const withAudio = o.hasAudio && TONE_VOLUME[o.tone] > 0;
  if (!withAudio) args.push("-f", "lavfi", "-t", d, "-i", "anullsrc=r=48000:cl=stereo");
  const parts = [`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p[b0]`];
  o.overlays.forEach((ov, i) => {
    const enable = ov.from != null || ov.to != null ? `:enable='between(t,${(ov.from ?? 0).toFixed(2)},${(ov.to ?? o.duration).toFixed(2)})'` : "";
    parts.push(`[b${i}][${i + 1}:v]overlay=0:0:format=auto${enable}[b${i + 1}]`);
  });
  const last = `b${o.overlays.length}`;
  parts.push(`[${last}]format=yuv420p${o.fadeIn ? ",fade=t=in:st=0:d=0.3" : ""}[v]`);
  if (withAudio) {
    const fadeOut = Math.max(0, o.duration - 0.06).toFixed(2);
    parts.push(`[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=${TONE_VOLUME[o.tone]},afade=t=in:d=0.05,afade=t=out:st=${fadeOut}:d=0.06[a]`);
  }
  args.push("-filter_complex", parts.join(";"), "-map", "[v]", "-map", withAudio ? "[a]" : `${o.overlays.length + 1}:a`, ...ENCODE, "-t", d, "-movflags", "+faststart", o.out);
  return args;
}

export function outroArgs(png: string, out: string) {
  const d = OUTRO_SECONDS.toFixed(2);
  return [
    "-y", "-hide_banner", "-loglevel", "error",
    "-loop", "1", "-t", d, "-i", png,
    "-f", "lavfi", "-t", d, "-i", "anullsrc=r=48000:cl=stereo",
    "-filter_complex", "[0:v]fps=30,format=yuv420p,setsar=1,fade=t=in:st=0:d=0.35[v]",
    "-map", "[v]", "-map", "1:a", ...ENCODE, "-t", d, "-movflags", "+faststart", out,
  ];
}

/** Lautheit angleichen (EBU R128) und optional Musik unterlegen, die unter Sprache automatisch leiser wird. */
export function finalArgs(o: { joined: string; total: number; music?: string | null; musicVolume: number; out: string }) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", o.joined];
  const voice = "[0:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000";
  if (o.music) {
    const v = Math.max(0, Math.min(100, o.musicVolume)) / 100;
    const fadeOut = Math.max(0, o.total - 1.5).toFixed(2);
    args.push("-stream_loop", "-1", "-i", o.music);
    args.push(
      "-filter_complex",
      [
        `${voice},asplit=2[voice][sc]`,
        `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${v.toFixed(2)},atrim=0:${o.total.toFixed(2)},afade=t=in:d=0.5,afade=t=out:st=${fadeOut}:d=1.5[m]`,
        `[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[duck]`,
        `[voice][duck]amix=inputs=2:duration=first:normalize=0[a]`,
      ].join(";"),
      "-map", "0:v", "-map", "[a]",
    );
  } else {
    args.push("-filter_complex", `${voice}[a]`, "-map", "0:v", "-map", "[a]");
  }
  args.push("-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", o.total.toFixed(2), "-movflags", "+faststart", o.out);
  return args;
}

export type RenderClip = { id: string; file: string; hasAudio: boolean; transcript?: Segment[] | null };

/** Rendert den Schnittplan in einem Format und liefert den Pfad der fertigen MP4 (im übergebenen Arbeitsordner). */
export async function renderPlan(o: {
  plan: VideoPlan;
  clips: RenderClip[];
  format: VideoFormat;
  branding: Pick<Branding, "logoPath" | "defaultLogo" | "accountName">;
  music?: string | null;
  musicVolume: number;
  workDir: string;
  onProgress?: (fraction: number) => Promise<void> | void;
}): Promise<string> {
  const { width, height } = VIDEO_FORMATS[o.format];
  const dir = path.join(o.workDir, o.format.replace(":", "x"));
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const logo = await logoDataUri(o.branding);
  const byId = new Map(o.clips.map((c) => [c.id, c]));
  const png = async (name: string, html: string, transparent = true) => {
    const p = path.join(dir, name);
    await writeFile(p, await htmlToPng(html, width, height, { transparent }));
    return p;
  };
  const segments: string[] = [];
  const steps = o.plan.shots.length + 2;
  for (const [i, shot] of o.plan.shots.entries()) {
    const clip = byId.get(shot.clipId);
    if (!clip) continue;
    const duration = shot.end - shot.start;
    const overlays: Overlay[] = [{ path: await png(`deko${i}.png`, await decoHtml(o.format, logo, shot.einblendung)) }];
    if (i === 0 && o.plan.titel) overlays.push({ path: await png("titel.png", await titleHtml(o.format, o.plan.titel, o.plan.unterzeile)), from: 0, to: Math.min(TITLE_SECONDS, duration) });
    if (shot.untertitel) {
      for (const [k, cue] of subtitleCues(shot, clip.transcript).entries()) {
        overlays.push({ path: await png(`cue${i}-${k}.png`, await cueHtml(o.format, cue.text)), from: cue.from, to: cue.to });
      }
    }
    const out = path.join(dir, `seg${String(i).padStart(2, "0")}.mp4`);
    await run(ffmpegBin(), shotArgs({ input: clip.file, start: shot.start, duration, format: o.format, tone: shot.ton, hasAudio: clip.hasAudio, overlays, out, fadeIn: i === 0 }));
    segments.push(out);
    await o.onProgress?.((i + 1) / steps);
  }
  if (!segments.length) throw new Error("Der Schnittplan enthält keine verwendbaren Ausschnitte.");
  const outroPng = await png("abschluss.png", await outroHtml(o.format, logo, o.plan.abschluss, o.plan.aufruf, o.branding.accountName), false);
  const outro = path.join(dir, "seg99.mp4");
  await run(ffmpegBin(), outroArgs(outroPng, outro));
  segments.push(outro);
  const list = path.join(dir, "liste.txt");
  await writeFile(list, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join("\n"));
  const joined = path.join(dir, "joined.mp4");
  await run(ffmpegBin(), ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  await o.onProgress?.((steps - 1) / steps);
  const final = path.join(dir, "video.mp4");
  await run(ffmpegBin(), finalArgs({ joined, total: planDuration(o.plan), music: o.music, musicVolume: o.musicVolume, out: final }));
  return final;
}
