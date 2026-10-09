import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Prisma, User, VideoClip, VideoProject, VideoStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { appendFile, mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  cutBudget,
  fallbackPlan,
  FORMAT_KEYS,
  isVideoFormat,
  aiPlanSchema,
  logoOptions,
  MAX_SECONDS,
  MIN_SECONDS,
  normalizePlan,
  parseWhisperJson,
  pickStills,
  stillTimes,
  type Shot,
  planSchema,
  shotText,
  type ClipInfo,
  type Segment,
  type VideoFormat,
  type VideoPlan,
} from "@/lib/video-plan";
import { checkbox, formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { absoluteStoredPath, deleteStoredFile, readStoredFile, saveFile } from "@/server/files";
import { sniffType } from "@/lib/file-types";
import { enqueue } from "@/server/jobs/queue";
import { extractAudio, extractStills, probe, renderPlan } from "@/server/media/video-edit";
import { ovContext } from "@/server/ov";
import { renderText } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";
import { aiConfigured, draftModel } from "./ai-draft";
import { branding, type SocialAccount } from "./bbr-social";

// Automatischer Videoschnitt (Marketing): Clips hochladen, Claude schlägt nach Regievorgaben einen Schnitt vor,
// ffmpeg rendert ihn in den gewählten Formaten. Der Schnittplan ist ein Vorschlag und bleibt bearbeitbar (CLAUDE.md Regel 7).

type Actor = Pick<User, "id" | "role">;

export const MAX_CLIPS = 12;
export const MAX_CLIP_BYTES = 2 * 1024 ** 3;
export const MAX_CLIP_SECONDS = 15 * 60;
export const CHUNK_BYTES = 32 * 1024 * 1024; // unter dem Upload-Limit des Webservers (128 MB je Anfrage)
const MAX_MUSIC_BYTES = 30 * 1024 * 1024;
const BUSY: VideoStatus[] = ["ANALYSE", "SCHNITT", "RENDERN"];

export type VideoOutputs = { files: Partial<Record<VideoFormat, string>>; warnings: string[] };
export type Still = { t: number; path: string };

const dirOf = (projectId: string) => path.join("video", projectId);

/** In Bearbeitung – nach zwei Stunden ohne Fortschritt (z. B. Neustart des Servers) gilt der Lauf als abgebrochen. */
export function isBusy(p: Pick<VideoProject, "status" | "updatedAt">) {
  return BUSY.includes(p.status) && Date.now() - p.updatedAt.getTime() < 2 * 3600_000;
}

export function outputsOf(p: Pick<VideoProject, "outputs">): VideoOutputs {
  const o = (p.outputs ?? {}) as Partial<VideoOutputs>;
  return { files: o.files ?? {}, warnings: o.warnings ?? [] };
}

export function planOf(p: Pick<VideoProject, "plan">): VideoPlan | null {
  const r = planSchema.safeParse(p.plan);
  return r.success ? r.data : null;
}

export function stillsOf(c: Pick<VideoClip, "stills">): Still[] {
  return Array.isArray(c.stills) ? (c.stills as Still[]) : [];
}

export function transcriptOf(c: Pick<VideoClip, "transcript">): Segment[] | null {
  return Array.isArray(c.transcript) ? (c.transcript as Segment[]) : null;
}

// ---------------------------------------------------------------------------
// Projekte
// ---------------------------------------------------------------------------

export function listProjects(actor: Actor) {
  assertCan(actor, "marketing.create");
  return db.videoProject.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } }, _count: { select: { clips: true } } },
  });
}

export async function getProject(actor: Actor, id: string) {
  assertCan(actor, "marketing.create");
  const p = await db.videoProject.findUnique({
    where: { id },
    include: { clips: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }, createdBy: { select: { name: true } }, marketingPost: { select: { id: true, status: true, title: true } } },
  });
  if (!p) throw new NotFoundError("Videoprojekt nicht gefunden.");
  return p;
}

function assertOwnerOrPublisher(actor: Actor, p: Pick<VideoProject, "createdById">) {
  if (p.createdById !== actor.id && !can(actor.role, "marketing.publish")) throw new ForbiddenError("Nur die Person, die das Video angelegt hat, oder wer Beiträge freigeben darf.");
}

const formatList = z.preprocess(
  (v) => (Array.isArray(v) ? v : v ? [v] : []),
  z.array(z.enum(FORMAT_KEYS as [VideoFormat, ...VideoFormat[]])).min(1, { error: "Bitte mindestens ein Format wählen." }),
);

const projectSchema = z.object({
  title: requiredText(150),
  topic: z.string().trim().min(10, { error: "Bitte kurz beschreiben, worum es geht (mind. 10 Zeichen)." }).max(3000),
  message: optionalText(300),
  callToAction: optionalText(120),
  direction: optionalText(3000),
  account: z.enum(["OV", "BBR"]),
  "formats[]": formatList,
  maxSeconds: z.coerce.number().int().min(MIN_SECONDS).max(MAX_SECONDS),
  subtitles: checkbox,
  musicVolume: z.coerce.number().int().min(0).max(60).optional(),
});

export async function createProject(actor: Actor, formData: FormData) {
  assertCan(actor, "marketing.create");
  const input = projectSchema.extend({ consent: checkbox }).parse(formToObject(formData));
  if (!input.consent) throw new UserError("Bitte bestätigen, dass die gezeigten und zu hörenden Personen mit der Veröffentlichung einverstanden sind.");
  return db.$transaction(async (tx) => {
    const p = await tx.videoProject.create({
      data: {
        title: input.title,
        topic: input.topic,
        message: input.message ?? "",
        callToAction: input.callToAction ?? "",
        direction: input.direction ?? "",
        account: input.account,
        formats: input["formats[]"],
        maxSeconds: input.maxSeconds,
        subtitles: input.subtitles,
        musicVolume: input.musicVolume ?? 15,
        consentConfirmedAt: new Date(),
        consentConfirmedById: actor.id,
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "video.create", "VideoProject", p.id, { title: p.title, formats: p.formats, consent: true });
    return p;
  });
}

export async function updateProject(actor: Actor, id: string, formData: FormData) {
  const before = await getProject(actor, id);
  assertOwnerOrPublisher(actor, before);
  if (isBusy(before)) throw new UserError("Das Video wird gerade bearbeitet. Bitte kurz warten.");
  const input = projectSchema.parse(formToObject(formData));
  const data = {
    title: input.title,
    topic: input.topic,
    message: input.message ?? "",
    callToAction: input.callToAction ?? "",
    direction: input.direction ?? "",
    account: input.account,
    formats: input["formats[]"],
    maxSeconds: input.maxSeconds,
    subtitles: input.subtitles,
    musicVolume: input.musicVolume ?? before.musicVolume,
  };
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data });
    await audit(tx, actor, "video.update", "VideoProject", id, changes(before, data));
  });
}

export async function deleteProject(actor: Actor, id: string) {
  const p = await getProject(actor, id);
  assertOwnerOrPublisher(actor, p);
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet. Bitte warten, bis es fertig ist.");
  await db.$transaction(async (tx) => {
    await tx.videoProject.delete({ where: { id } });
    await audit(tx, actor, "video.delete", "VideoProject", id, { title: p.title, clips: p.clips.length });
  });
  await rm(absoluteStoredPath(dirOf(id)), { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Upload in Stücken (der Webserver lässt je Anfrage nur 128 MB durch)
// ---------------------------------------------------------------------------

const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".3gp", ".mts"]);

export type ChunkMeta = { uploadId: string; index: number; total: number; offset: number; fileName: string; fileSize: number };

export async function uploadChunk(actor: Actor, projectId: string, meta: ChunkMeta, chunk: Buffer) {
  assertCan(actor, "marketing.create");
  const p = await db.videoProject.findUnique({ where: { id: projectId }, include: { _count: { select: { clips: true } } } });
  if (!p) throw new NotFoundError("Videoprojekt nicht gefunden.");
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet. Bitte warten, bis es fertig ist.");
  if (!p.consentConfirmedAt) throw new UserError("Das Einverständnis der gezeigten Personen ist nicht bestätigt.");
  if (p._count.clips >= MAX_CLIPS) throw new UserError(`Höchstens ${MAX_CLIPS} Clips je Video.`);
  if (!/^[a-z0-9]{8,40}$/.test(meta.uploadId)) throw new UserError("Ungültige Upload-Kennung.");
  const ext = path.extname(meta.fileName).toLowerCase();
  if (!VIDEO_EXT.has(ext)) throw new UserError("Bitte Videodateien hochladen (MP4, MOV, WebM …).");
  if (meta.fileSize > MAX_CLIP_BYTES) throw new UserError("Ein Clip darf höchstens 2 GB groß sein.");
  if (!(meta.index >= 0 && meta.index < meta.total && meta.total <= Math.ceil(MAX_CLIP_BYTES / CHUNK_BYTES) + 1)) throw new UserError("Ungültiger Upload-Abschnitt.");
  if (chunk.length > CHUNK_BYTES + 1024) throw new UserError("Upload-Abschnitt zu groß.");

  const tmpRel = path.join(dirOf(projectId), "tmp", `${meta.uploadId}${ext}`);
  const tmp = absoluteStoredPath(tmpRel);
  await mkdir(path.dirname(tmp), { recursive: true });
  let size = await stat(tmp).then((s) => s.size).catch(() => 0);
  if (meta.index === 0 && size > 0 && size !== chunk.length) {
    await rm(tmp, { force: true });
    size = 0;
  }
  // Wiederholung nach Verbindungsabbruch: Abschnitt ist schon angekommen → nicht doppelt anhängen
  if (size === meta.offset) await appendFile(tmp, chunk);
  else if (size !== meta.offset + chunk.length) throw new UserError("Upload unterbrochen – bitte die Datei erneut auswählen.");
  if (meta.index < meta.total - 1) return { done: false as const };

  // letzter Abschnitt: prüfen und als Clip ablegen
  const finalSize = (await stat(tmp)).size;
  try {
    if (finalSize !== meta.fileSize) throw new UserError("Die Datei ist unvollständig angekommen. Bitte erneut hochladen.");
    const info = await probe(tmp).catch(() => null);
    if (!info?.hasVideo || info.duration <= 0) throw new UserError(`„${meta.fileName}“ ist kein lesbares Video.`);
    if (info.duration > MAX_CLIP_SECONDS) throw new UserError("Ein Clip darf höchstens 15 Minuten lang sein.");
    const rel = path.join(dirOf(projectId), "clips", `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`);
    await mkdir(path.dirname(absoluteStoredPath(rel)), { recursive: true });
    await rename(tmp, absoluteStoredPath(rel));
    const clip = await db.$transaction(async (tx) => {
      const c = await tx.videoClip.create({
        data: {
          projectId,
          path: rel,
          originalName: meta.fileName.slice(0, 200),
          size: finalSize,
          duration: info.duration,
          width: info.width,
          height: info.height,
          rotation: info.rotation,
          hasAudio: info.hasAudio,
          sortOrder: p._count.clips,
        },
      });
      await audit(tx, actor, "video.clip_upload", "VideoProject", projectId, { clipId: c.id, name: c.originalName, seconds: info.duration, bytes: finalSize });
      return c;
    });
    return { done: true as const, clipId: clip.id };
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

export async function removeClip(actor: Actor, clipId: string) {
  assertCan(actor, "marketing.create");
  const clip = await db.videoClip.findUnique({ where: { id: clipId }, include: { project: true } });
  if (!clip) throw new NotFoundError("Clip nicht gefunden.");
  if (isBusy(clip.project)) throw new UserError("Das Video wird gerade bearbeitet.");
  await db.$transaction(async (tx) => {
    await tx.videoClip.delete({ where: { id: clipId } });
    await audit(tx, actor, "video.clip_delete", "VideoProject", clip.projectId, { clipId, name: clip.originalName });
  });
  await deleteStoredFile(clip.path);
  for (const s of stillsOf(clip)) await deleteStoredFile(s.path);
}

const MUSIC_TYPES: Record<string, string> = { "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/aac": ".aac", "audio/ogg": ".ogg" };

export async function setMusic(actor: Actor, id: string, formData: FormData) {
  const p = await getProject(actor, id);
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet.");
  const file = formData.get("music");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Bitte eine Musikdatei auswählen.");
  if (file.size > MAX_MUSIC_BYTES) throw new UserError("Die Musikdatei darf höchstens 30 MB groß sein.");
  const ext = path.extname(file.name).toLowerCase();
  if (!Object.values(MUSIC_TYPES).includes(ext) && !MUSIC_TYPES[file.type]) throw new UserError("Bitte MP3, M4A, AAC, OGG oder WAV hochladen.");
  if (!checkbox.parse(formData.get("rights"))) throw new UserError("Bitte bestätigen, dass ihr die Musik verwenden dürft (z. B. GEMA-frei, lizenziert).");
  const rel = await saveFile(path.join(dirOf(id), "musik"), file.name, Buffer.from(await file.arrayBuffer()));
  const info = await probe(absoluteStoredPath(rel)).catch(() => null);
  if (!info?.hasAudio) {
    await deleteStoredFile(rel);
    throw new UserError("Die Datei enthält keine lesbare Tonspur.");
  }
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data: { musicPath: rel, musicName: file.name.slice(0, 200) } });
    await audit(tx, actor, "video.music", "VideoProject", id, { name: file.name, rights: true });
  });
  await deleteStoredFile(p.musicPath);
}

export async function removeMusic(actor: Actor, id: string) {
  const p = await getProject(actor, id);
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet.");
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data: { musicPath: null, musicName: null } });
    await audit(tx, actor, "video.music", "VideoProject", id, { removed: true });
  });
  await deleteStoredFile(p.musicPath);
}

// ---------------------------------------------------------------------------
// Ablauf: Analyse → Schnittplan (KI) → Rendern
// ---------------------------------------------------------------------------

/**
 * Auftrag einstellen. Die Kennung am Projekt verhindert doppelte Läufe (z. B. wenn die Warteschlange einen
 * abgebrochenen Job später wiederholt); die Art erlaubt das Fortsetzen nach einem Neustart des Servers.
 */
async function queueJob(id: string, mode: ProcessMode, actorId: string | null) {
  const token = randomBytes(8).toString("hex");
  await db.videoProject.update({ where: { id }, data: { jobToken: token, jobMode: mode } });
  await enqueue("video-process", { projectId: id, mode, actorId, token });
}

/** Nach einem Neustart: unterbrochene Aufträge fortsetzen (läuft beim Serverstart). */
export async function resumeInterruptedJobs() {
  const stuck = await db.videoProject.findMany({ where: { status: { in: BUSY } }, select: { id: true, jobMode: true, plan: true } });
  for (const p of stuck) {
    const mode = p.jobMode ? toProcessMode(p.jobMode) : await lastRequestedMode(p.id, !!planOf(p));
    await audit(db, null, "video.resume", "VideoProject", p.id, { mode });
    await queueJob(p.id, mode, null);
  }
  return stuck.length;
}

/** Für Aufträge ohne gespeicherte Art (vor Einführung von jobMode): letzte Anforderung aus dem Audit-Log. */
async function lastRequestedMode(id: string, hasPlan: boolean): Promise<ProcessMode> {
  const last = await db.auditLog.findFirst({
    where: { entityType: "VideoProject", entityId: id, action: { in: ["video.process", "video.revise", "video.plan_edit"] } },
    orderBy: { createdAt: "desc" },
  });
  if (last?.action === "video.revise") return "revise";
  if (last?.action === "video.plan_edit") return "render";
  const m = (last?.diff as { mode?: string } | null)?.mode;
  return m === "plan" || m === "render" || m === "full" ? m : hasPlan ? "render" : "full";
}

/** Hängt ein Auftrag (15 Minuten ohne Fortschritt), lässt er sich von Hand neu starten. */
export function isStalled(p: Pick<VideoProject, "status" | "updatedAt">) {
  return BUSY.includes(p.status) && Date.now() - p.updatedAt.getTime() > 15 * 60_000;
}

export async function restartProcessing(actor: Actor, id: string) {
  const p = await getProject(actor, id);
  if (!isStalled(p)) throw new UserError("Das Video wird gerade bearbeitet – bitte noch etwas warten.");
  const mode = p.jobMode ? toProcessMode(p.jobMode) : planOf(p) ? "render" : "full";
  await db.videoProject.update({ where: { id }, data: { progress: 1, error: "" } });
  await audit(db, actor, "video.restart", "VideoProject", id, { mode });
  await queueJob(id, mode, actor.id);
}

export type ProcessMode = "full" | "plan" | "render" | "revise";
export const PROCESS_MODES: ProcessMode[] = ["full", "plan", "render", "revise"];
export const toProcessMode = (v: unknown): ProcessMode => PROCESS_MODES.find((m) => m === v) ?? "full";

export async function startProcessing(actor: Actor, id: string, mode: ProcessMode) {
  const p = await getProject(actor, id);
  if (isBusy(p)) throw new UserError("Das Video wird bereits bearbeitet.");
  if (!p.clips.length) throw new UserError("Bitte zuerst mindestens einen Clip hochladen.");
  if ((mode === "render" || mode === "revise") && !planOf(p)) throw new UserError("Es gibt noch keinen Schnittplan.");
  if (mode === "revise" && !aiConfigured()) throw new UserError("Nachbessern braucht die Claude API (ANTHROPIC_API_KEY).");
  await db.videoProject.update({ where: { id }, data: { status: mode === "render" ? "RENDERN" : "ANALYSE", progress: 1, error: "" } });
  await audit(db, actor, "video.process", "VideoProject", id, { mode });
  await queueJob(id, mode, actor.id);
}

const editSchema = z.object({ plan: z.string().max(100_000) });

/** Von Hand bearbeiteten Schnittplan speichern und neu rendern. */
export async function savePlan(actor: Actor, id: string, formData: FormData) {
  const p = await getProject(actor, id);
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet.");
  const { plan: raw } = editSchema.parse(formToObject(formData));
  let parsed: VideoPlan;
  try {
    parsed = planSchema.parse(JSON.parse(raw));
  } catch {
    throw new UserError("Der Schnittplan ist unvollständig. Bitte die Seite neu laden.");
  }
  const { plan, warnings } = normalizePlan(parsed, clipInfos(p.clips, p.subtitles), p.maxSeconds);
  if (!plan.shots.length) throw new UserError("Bitte mindestens einen Ausschnitt behalten.");
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data: { plan: plan as unknown as Prisma.InputJsonValue, planSource: "bearbeitet", status: "RENDERN", progress: 1, error: "" } });
    await audit(tx, actor, "video.plan_edit", "VideoProject", id, { shots: plan.shots.length, warnings: warnings.length });
  });
  await queueJob(id, "render", actor.id);
  return warnings;
}

function clipInfos(clips: VideoClip[], subtitles = true): ClipInfo[] {
  return clips.map((c) => ({ id: c.id, duration: c.duration ?? 0, hasAudio: c.hasAudio, transcript: subtitles ? transcriptOf(c) : null }));
}

async function setStatus(id: string, status: VideoStatus, progress: number) {
  await db.videoProject.update({ where: { id }, data: { status, progress: Math.max(1, Math.min(99, Math.round(progress))) } });
}

/** Whisper (eigener Server) mit Wort-Zeitstempeln; ohne Whisper geht es ohne Untertitel weiter. */
async function transcribeClip(file: string): Promise<Segment[]> {
  const url = (process.env.WHISPER_URL || "http://whisper:9000").replace(/\/$/, "");
  const audio = await extractAudio(file);
  const body = new FormData();
  body.append("audio_file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "ton.wav");
  const res = await fetch(`${url}/asr?task=transcribe&language=de&output=json&word_timestamps=true&encode=true`, { method: "POST", body, signal: AbortSignal.timeout(30 * 60_000) });
  if (!res.ok) throw new Error(`Whisper antwortet mit ${res.status}`);
  return parseWhisperJson(await res.json());
}

async function analyze(project: Awaited<ReturnType<typeof loadForJob>>, warnings: string[]) {
  // neue Clips vollständig; ältere Clips nur mit zu wenigen Standbildern (lange Clips bekommen mehr Bilder)
  const todo = project.clips.filter((c) => !c.analyzedAt || stillsOf(c).length < stillTimes(c.duration ?? 1).length);
  for (const [i, clip] of todo.entries()) {
    const file = absoluteStoredPath(clip.path);
    const stills: Still[] = [];
    for (const [k, s] of (await extractStills(file, clip.duration ?? 1)).entries()) {
      stills.push({ t: s.t, path: await saveFile(path.join(dirOf(project.id), "stills"), `${clip.id}-${k}.jpg`, s.data) });
    }
    for (const old of stillsOf(clip)) await deleteStoredFile(old.path);
    let transcript: Segment[] | null = null;
    if (clip.hasAudio && project.subtitles && !transcriptOf(clip)) {
      try {
        transcript = await transcribeClip(file);
      } catch (err) {
        console.error("[video] Whisper", err);
        warnings.push(`Ton von „${clip.originalName}“ konnte nicht abgeschrieben werden (Whisper nicht erreichbar) – ohne Untertitel.`);
      }
    }
    await db.videoClip.update({
      where: { id: clip.id },
      data: { stills: stills as unknown as Prisma.InputJsonValue, ...(transcript ? { transcript: transcript as unknown as Prisma.InputJsonValue } : {}), analyzedAt: new Date() },
    });
    await setStatus(project.id, "ANALYSE", 5 + (35 * (i + 1)) / todo.length);
  }
}

/** Nachbessern per Regieanweisung: Claude überarbeitet den bestehenden Schnitt; die Anweisung bleibt im Verlauf. */
export async function requestRevision(actor: Actor, id: string, formData: FormData) {
  const p = await getProject(actor, id);
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet.");
  const { anweisung } = z.object({ anweisung: z.string().trim().min(5, { error: "Bitte beschreiben, was geändert werden soll." }).max(2000) }).parse(formToObject(formData));
  if (!planOf(p)) throw new UserError("Es gibt noch keinen Schnittplan.");
  if (!aiConfigured()) throw new UserError("Nachbessern braucht die Claude API (ANTHROPIC_API_KEY).");
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data: { revisionNotes: [...p.revisionNotes, anweisung].slice(-30), status: "SCHNITT", progress: 1, error: "" } });
    await audit(tx, actor, "video.revise", "VideoProject", id, { anweisung });
  });
  await queueJob(id, "revise", actor.id);
}

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const logoSettingsSchema = z.object({
  logoPosition: z.enum(["oben-links", "oben-rechts", "unten-links", "unten-rechts"]),
  logoSize: z.enum(["klein", "mittel", "gross", "aus"]),
  logoChip: checkbox,
});

/** Logo-Einstellungen des Videos; optional eigenes Logo (PNG, JPG, WebP oder SVG, max. 5 MB). */
export async function updateLogo(actor: Actor, id: string, formData: FormData) {
  const p = await getProject(actor, id);
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet.");
  const input = logoSettingsSchema.parse(formToObject(formData));
  const file = formData.get("logo");
  let upload: { path: string; name: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) throw new UserError("Das Logo darf höchstens 5 MB groß sein.");
    const data = Buffer.from(await file.arrayBuffer());
    const type = sniffType(data);
    const isSvg = !type && /\.svg$/i.test(file.name) && /<svg[\s>]/i.test(data.subarray(0, 2048).toString("utf8")) && !/<script|on\w+=/i.test(data.toString("utf8"));
    if (!(type && LOGO_TYPES.has(type)) && !isSvg) throw new UserError("Bitte das Logo als PNG, JPG, WebP oder SVG hochladen.");
    const ext = isSvg ? ".svg" : type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
    upload = { path: await saveFile(path.join(dirOf(id), "logo"), `logo${ext}`, data), name: file.name.slice(0, 200) };
  }
  const data = { ...input, ...(upload ? { logoPath: upload.path, logoName: upload.name } : {}) };
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data });
    await audit(tx, actor, "video.logo", "VideoProject", id, { ...input, upload: upload?.name ?? null });
  });
  if (upload) await deleteStoredFile(p.logoPath);
}

export async function removeLogo(actor: Actor, id: string) {
  const p = await getProject(actor, id);
  if (isBusy(p)) throw new UserError("Das Video wird gerade bearbeitet.");
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data: { logoPath: null, logoName: null } });
    await audit(tx, actor, "video.logo", "VideoProject", id, { removed: true });
  });
  await deleteStoredFile(p.logoPath);
}

// --- Schnittplan von Claude ---------------------------------------------------

/** Kurzkennungen C1, C2 … statt Datenbank-IDs, damit die KI sich nicht vertut. */
export function clipAliases(clips: Pick<VideoClip, "id">[]) {
  return new Map(clips.map((c, i) => [`C${i + 1}`, c.id]));
}

export function buildPlanText(project: Pick<VideoProject, "title" | "topic" | "message" | "callToAction" | "direction" | "maxSeconds" | "formats" | "musicPath">, clips: { alias: string; clip: VideoClip }[]) {
  const lines = [
    `<titel>${project.title}</titel>`,
    `<worum_es_geht>${project.topic}</worum_es_geht>`,
    project.message ? `<kernbotschaft>${project.message}</kernbotschaft>` : "",
    project.callToAction ? `<handlungsaufruf>${project.callToAction}</handlungsaufruf>` : "",
    project.direction ? `<regievorgaben>${project.direction}</regievorgaben>` : "",
    `<formate>${project.formats.join(", ")} (Bild wird füllend zugeschnitten – wichtige Motive in der Bildmitte)</formate>`,
    `<laenge>höchstens ${cutBudget(project.maxSeconds)} Sekunden Schnitt + Abschlusstafel</laenge>`,
    `<musik>${project.musicPath ? "ja – Bild-Ausschnitte dürfen stumm sein" : "nein – Bild-Ausschnitte mit leisem Originalton (ton: leise), nie stumm"}</musik>`,
    "<clips>",
  ];
  for (const { alias, clip } of clips) {
    const t = transcriptOf(clip);
    lines.push(
      `<clip id="${alias}" laenge="${(clip.duration ?? 0).toFixed(1)}" ton="${clip.hasAudio ? "ja" : "nein"}" bild="${clip.width}x${clip.height}" datei="${clip.originalName}">`,
      t?.length ? t.map((s) => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`).join("\n") : clip.hasAudio ? "(kein Transkript)" : "(ohne Ton)",
      "</clip>",
    );
  }
  lines.push("</clips>", "", "Erstelle den Schnittplan als JSON. clipId ist die Kennung C1, C2 …; start und end in Sekunden innerhalb des Clips.");
  return lines.filter(Boolean).join("\n");
}

export class PlanRefusedError extends Error {}

/** Aktueller Schnitt in Kurzform (Kennungen C1, C2 …) für die Nachbesserung. */
export function planForRevision(plan: VideoPlan, clips: Pick<VideoClip, "id">[]) {
  const alias = new Map([...clipAliases(clips).entries()].map(([a, id]) => [id, a]));
  return JSON.stringify(
    {
      titel: plan.titel,
      unterzeile: plan.unterzeile,
      shots: plan.shots.map((s) => ({ clipId: alias.get(s.clipId) ?? s.clipId, start: s.start, end: s.end, ton: s.ton, einblendung: s.einblendung, untertitel: s.untertitel, untertitelText: s.untertitelText })),
      abschluss: plan.abschluss,
      aufruf: plan.aufruf,
      beitragstext: plan.beitragstext,
      hashtags: plan.hashtags,
    },
    null,
    1,
  );
}

async function generatePlan(project: Awaited<ReturnType<typeof loadForJob>>, client = new Anthropic(), revision?: { current: VideoPlan; notes: string[] }): Promise<VideoPlan> {
  const aliases = [...clipAliases(project.clips).entries()].map(([alias, id]) => ({ alias, clip: project.clips.find((c) => c.id === id)! }));
  const { source } = await getTemplateSource("prompt.video");
  const system = renderText(source, { ov: await ovContext(), video: { maxSekunden: project.maxSeconds, schnittSekunden: cutBudget(project.maxSeconds) } });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const picked = pickStills(aliases.map(({ clip }) => stillsOf(clip)));
  for (const [k, { alias }] of aliases.entries()) {
    for (const s of picked[k] ?? []) {
      content.push({ type: "text", text: `Standbild ${alias} bei ${s.t.toFixed(1)} s:` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: (await readStoredFile(s.path)).toString("base64") } });
    }
  }
  content.push({ type: "text", text: buildPlanText(project, aliases) });
  if (revision) {
    const [latest, ...earlier] = [...revision.notes].reverse();
    content.push({
      type: "text",
      text: [
        "<aktueller_schnitt>",
        planForRevision(revision.current, project.clips),
        "</aktueller_schnitt>",
        earlier.length ? `<fruehere_anweisungen>\n${earlier.reverse().map((n) => `- ${n}`).join("\n")}\n</fruehere_anweisungen>` : "",
        `<nachbesserung>${latest ?? ""}</nachbesserung>`,
        "",
        "Überarbeite den aktuellen Schnitt nach der Nachbesserung (frühere Anweisungen gelten weiter). Ändere nur, was die Anweisung verlangt, und behalte alles andere bei. Nenne die Änderungen kurz in der Begründung.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
  const response = await client.beta.messages.parse(
    {
      model: draftModel(),
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: "medium", format: betaZodOutputFormat(aiPlanSchema) },
    },
    { timeout: 10 * 60_000 },
  );
  if (response.stop_reason === "refusal") throw new PlanRefusedError("Die KI hat den Schnitt abgelehnt. Bitte Thema oder Regievorgaben anpassen.");
  if (response.stop_reason === "max_tokens") throw new Error("Der Schnittplan wurde abgeschnitten (zu viele Ausschnitte).");
  if (!response.parsed_output) throw new Error("Die Antwort der KI konnte nicht gelesen werden.");
  const map = clipAliases(project.clips);
  const plan = response.parsed_output;
  const shots = plan.shots.map((s) => ({ ...s, clipId: map.get(s.clipId.trim().toUpperCase()) ?? s.clipId })) as Shot[];
  if (!revision) return { ...plan, shots };
  // Handanpassungen (verschobene Texte, Zeitfenster) bleiben erhalten, solange Ausschnitt und Einblendung gleich sind
  const before = revision.current.shots;
  for (const [i, s] of shots.entries()) {
    const old = before.find((b, k) => b.clipId === s.clipId && b.einblendung === s.einblendung && (k === i || Math.abs(b.start - s.start) < 0.5));
    if (old) Object.assign(s, { einblendungPos: old.einblendungPos, einblendungVon: old.einblendungVon, einblendungBis: old.einblendungBis });
  }
  return { ...plan, shots, titelPos: revision.current.titelPos, untertitelY: revision.current.untertitelY };
}

async function loadForJob(id: string) {
  const p = await db.videoProject.findUnique({ where: { id }, include: { clips: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } });
  if (!p) throw new NotFoundError("Videoprojekt nicht gefunden.");
  return p;
}

/** Job „video-process“: analysieren, Schnittplan erstellen, rendern. Fehler landen am Projekt. */
export async function processProject(id: string, mode: ProcessMode, actorId: string | null, client?: Anthropic, token?: string) {
  if (token) {
    const current = await db.videoProject.findUnique({ where: { id }, select: { jobToken: true } });
    if (current?.jobToken !== token) return; // überholt durch einen neueren Auftrag
  }
  const warnings: string[] = [];
  const work = await mkdtemp(path.join(tmpdir(), "ov-videoschnitt-"));
  try {
    let project = await loadForJob(id);
    if (mode !== "render") {
      await setStatus(id, "ANALYSE", 3);
      await analyze(project, warnings);
      project = await loadForJob(id);
      await setStatus(id, "SCHNITT", 45);
      let raw: VideoPlan;
      let source = "ki";
      const current = planOf(project);
      if (aiConfigured()) {
        raw = await generatePlan(project, client, mode === "revise" && current ? { current, notes: project.revisionNotes } : undefined);
        if (mode === "revise") source = "nachgebessert";
      } else {
        raw = fallbackPlan(clipInfos(project.clips, project.subtitles), project.maxSeconds, { titel: project.title, botschaft: project.message, aufruf: project.callToAction });
        source = "einfach";
        warnings.push("Claude API nicht eingerichtet – einfacher Schnitt ohne KI.");
      }
      const { plan, warnings: w } = normalizePlan(raw, clipInfos(project.clips, project.subtitles), project.maxSeconds);
      warnings.push(...w);
      if (!plan.shots.length) throw new UserError("Aus den Clips ließ sich kein Schnitt erstellen. Bitte längere Clips hochladen.");
      await db.videoProject.update({ where: { id }, data: { plan: plan as unknown as Prisma.InputJsonValue, planSource: source } });
      await audit(db, null, "video.plan", "VideoProject", id, { source, shots: plan.shots.length, actorId });
      project = await loadForJob(id);
    }
    const plan = planOf(project);
    if (!plan) throw new UserError("Es gibt noch keinen Schnittplan.");
    await setStatus(id, "RENDERN", 55);
    const brand = await branding(project.account as SocialAccount, null);
    const clips = project.clips.map((c) => ({ id: c.id, file: absoluteStoredPath(c.path), hasAudio: c.hasAudio, transcript: project.subtitles ? transcriptOf(c) : null }));
    const formats = project.formats.filter(isVideoFormat);
    const old = outputsOf(project).files;
    const files: VideoOutputs["files"] = {};
    for (const [i, format] of formats.entries()) {
      const out = await renderPlan({
        plan,
        clips,
        format,
        branding: project.logoPath ? { ...brand, logoPath: project.logoPath } : brand,
        logo: logoOptions(project),
        music: project.musicPath ? absoluteStoredPath(project.musicPath) : null,
        musicVolume: project.musicVolume,
        workDir: work,
        onProgress: (f) => setStatus(id, "RENDERN", 55 + (44 * (i + f)) / formats.length),
      });
      files[format] = await saveFile(path.join(dirOf(id), "fertig"), `video-${format.replace(":", "x")}.mp4`, await readFile(out));
    }
    await db.videoProject.update({
      where: { id },
      data: { status: "FERTIG", progress: 100, error: "", jobToken: null, jobMode: null, renderedAt: new Date(), outputs: { files, warnings: [...new Set(warnings)] } as unknown as Prisma.InputJsonValue },
    });
    await audit(db, null, "video.rendered", "VideoProject", id, { formats, actorId });
    for (const f of Object.values(old)) if (f) await deleteStoredFile(f);
  } catch (err) {
    console.error("[video]", err);
    const message = err instanceof UserError || err instanceof PlanRefusedError ? err.message : `Bearbeitung fehlgeschlagen: ${(err as Error).message}`;
    await db.videoProject.update({ where: { id }, data: { status: "FEHLER", error: message.slice(0, 500), jobToken: null, jobMode: null, outputs: { ...outputsOf(await loadForJob(id)), warnings } as unknown as Prisma.InputJsonValue } }).catch(() => {});
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Fertiges 9:16-Video (oder das erste Format) als Social-Media-Entwurf übernehmen; Freigabe läuft wie bei jedem Beitrag. */
export async function toMarketingPost(actor: Actor, id: string) {
  const p = await getProject(actor, id);
  const files = outputsOf(p).files;
  const format = (["9:16", "1:1", "16:9"] as VideoFormat[]).find((f) => files[f]);
  if (!format || p.status !== "FERTIG") throw new UserError("Es gibt noch kein fertiges Video.");
  const plan = planOf(p);
  const videoPath = await saveFile("social", "video.mp4", await readStoredFile(files[format]!));
  const body = plan?.beitragstext || [p.title, p.message].filter(Boolean).join("\n\n");
  if (p.marketingPost && p.marketingPost.status !== "VEROEFFENTLICHT") {
    const post = await db.marketingPost.findUniqueOrThrow({ where: { id: p.marketingPost.id } });
    await db.$transaction(async (tx) => {
      // neues Video hebt eine Freigabe auf
      await tx.marketingPost.update({ where: { id: post.id }, data: { videoPath, status: "ENTWURF", approvedAt: null, approvedById: null } });
      await audit(tx, actor, "marketing.update", "MarketingPost", post.id, { video: "aus Videoprojekt ersetzt", videoProjectId: id });
    });
    await deleteStoredFile(post.videoPath);
    return post.id;
  }
  return db.$transaction(async (tx) => {
    const post = await tx.marketingPost.create({
      data: {
        kind: "SOCIAL",
        title: p.title.slice(0, 80),
        body,
        brief: p.topic,
        channels: ["facebook", "instagram"],
        hashtags: plan?.hashtags ?? "",
        account: p.account,
        videoPath,
        createdById: actor.id,
      },
    });
    await tx.videoProject.update({ where: { id }, data: { marketingPostId: post.id } });
    await audit(tx, actor, "marketing.create", "MarketingPost", post.id, { fromVideoProject: id, format });
    return post.id;
  });
}

/** Für Tests und den Editor: Text eines Ausschnitts aus dem Transkript. */
export function shotTranscript(clip: Pick<VideoClip, "transcript">, start: number, end: number) {
  return shotText({ start, end }, transcriptOf(clip));
}

