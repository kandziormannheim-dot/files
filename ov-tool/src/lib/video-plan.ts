import { z } from "zod";

// Schnittplan für den automatischen Videoschnitt: Formate, Zeitbudget, Ausrichtung an Wortgrenzen, Untertitel-Zeilen.
// Rein (ohne Server-Abhängigkeiten), damit Editor im Browser und Renderer dieselben Regeln nutzen.

export const VIDEO_FORMATS = {
  "9:16": { width: 1080, height: 1920, label: "Hochformat 9:16", hint: "Reels, TikTok, WhatsApp-Status" },
  "1:1": { width: 1080, height: 1080, label: "Quadrat 1:1", hint: "Facebook- und Instagram-Feed" },
  "16:9": { width: 1920, height: 1080, label: "Querformat 16:9", hint: "YouTube, Webseite, Leinwand" },
} as const;
export type VideoFormat = keyof typeof VIDEO_FORMATS;
export const FORMAT_KEYS = Object.keys(VIDEO_FORMATS) as VideoFormat[];
export const isVideoFormat = (v: unknown): v is VideoFormat => typeof v === "string" && v in VIDEO_FORMATS;

/** Abschlusstafel mit Kernbotschaft, Aufruf und Logo */
export const OUTRO_SECONDS = 3;
/** Titelzeile über dem ersten Ausschnitt */
export const TITLE_SECONDS = 3;
export const MIN_SHOT = 1.5;
export const MAX_SHOTS = 80;
export const MIN_SECONDS = 10;
export const MAX_SECONDS = 320;
export const SHOT_TONES = ["original", "leise", "stumm"] as const;
export type ShotTone = (typeof SHOT_TONES)[number];
export const TONE_LABELS: Record<ShotTone, string> = { original: "O-Ton", leise: "Ton leise", stumm: "ohne Ton" };

/**
 * Zeitpunkte der Standbilder für Vorschau und KI: kurze Clips 3 Bilder, lange Clips etwa alle 20 Sekunden (höchstens 24),
 * damit die KI sieht, wer wann im Bild ist (z. B. wer am Rednerpult steht).
 */
export function stillTimes(duration: number): number[] {
  const d = Math.max(0.2, duration);
  if (d <= 60) return [0.1, 0.5, 0.85].map((f) => Math.round(Math.max(0, Math.min(d - 0.1, d * f)) * 10) / 10);
  const count = Math.min(24, Math.ceil(d / 20));
  const step = d / count;
  return Array.from({ length: count }, (_, i) => Math.round(Math.min(d - 0.5, step * (i + 0.5)) * 10) / 10);
}

/** Höchstzahl Bilder je KI-Anfrage; bei vielen Clips gleichmäßig ausdünnen. */
export const MAX_PLAN_IMAGES = 60;
export function pickStills<T>(perClip: T[][], max = MAX_PLAN_IMAGES): T[][] {
  const total = perClip.reduce((n, l) => n + l.length, 0);
  if (total <= max) return perClip;
  return perClip.map((list) => {
    const keep = Math.max(1, Math.floor((list.length * max) / total));
    if (keep >= list.length) return list;
    return Array.from({ length: keep }, (_, i) => list[Math.floor(((i + 0.5) * list.length) / keep)]!);
  });
}

/** Ohne Musik gibt es keine Stille: „ohne Ton“ wird dann mit leisem Originalton gerendert. */
export function effectiveTone(tone: ShotTone, hasAudio: boolean, hasMusic: boolean): ShotTone {
  if (!hasAudio) return "stumm";
  return tone === "stumm" && !hasMusic ? "leise" : tone;
}

export const LOGO_POSITIONS = { "oben-links": "oben links", "oben-rechts": "oben rechts", "unten-links": "unten links", "unten-rechts": "unten rechts" } as const;
export type LogoPosition = keyof typeof LOGO_POSITIONS;
export const LOGO_SIZES = { klein: "klein", mittel: "mittel", gross: "groß", aus: "kein Logo" } as const;
export type LogoSize = keyof typeof LOGO_SIZES;
export type LogoOptions = { position: LogoPosition; size: LogoSize; chip: boolean };
export const DEFAULT_LOGO: LogoOptions = { position: "oben-links", size: "mittel", chip: true };
export function logoOptions(p: { logoPosition?: string | null; logoSize?: string | null; logoChip?: boolean | null }): LogoOptions {
  return {
    position: p.logoPosition && p.logoPosition in LOGO_POSITIONS ? (p.logoPosition as LogoPosition) : DEFAULT_LOGO.position,
    size: p.logoSize && p.logoSize in LOGO_SIZES ? (p.logoSize as LogoSize) : DEFAULT_LOGO.size,
    chip: p.logoChip ?? true,
  };
}

export type Word = { start: number; end: number; word: string };
export type Segment = { start: number; end: number; text: string; words?: Word[] };
export type ClipInfo = { id: string; duration: number; hasAudio: boolean; transcript?: Segment[] | null };

/** Position eines Textblocks in Prozent der Bildbreite/-höhe (linke obere Ecke). */
export const posSchema = z.object({ x: z.number(), y: z.number() });
export type Pos = z.infer<typeof posSchema>;

/** Ausschnitt, wie ihn die KI liefert */
export const aiShotSchema = z.object({
  clipId: z.string(),
  start: z.number(),
  end: z.number(),
  ton: z.enum(SHOT_TONES),
  einblendung: z.string(),
  untertitel: z.boolean(),
  /** korrigierter Untertiteltext (leer = Transkript von Whisper) */
  untertitelText: z.string().default(""),
});

/** Ausschnitt mit Anpassungen aus dem Editor: verschobene Einblendung, Zeitfenster der Einblendung */
export const shotSchema = aiShotSchema.extend({
  einblendungPos: posSchema.optional(),
  /** Sekunden ab Beginn des Ausschnitts; leer = ganzer Ausschnitt (im ersten Ausschnitt nach der Titelzeile) */
  einblendungVon: z.number().optional(),
  einblendungBis: z.number().optional(),
});
export type Shot = z.infer<typeof shotSchema>;

const planFields = {
  titel: z.string(),
  unterzeile: z.string(),
  abschluss: z.string(),
  aufruf: z.string(),
  beitragstext: z.string(),
  hashtags: z.string(),
  begruendung: z.string(),
};

/** Schnittplan, den Claude als strukturierte Ausgabe liefert */
export const aiPlanSchema = z.object({ ...planFields, shots: z.array(aiShotSchema) });

/** gespeicherter Schnittplan: zusätzlich verschobene Titelzeile und Untertitel */
export const planSchema = z.object({
  ...planFields,
  shots: z.array(shotSchema),
  titelPos: posSchema.optional(),
  /** senkrechte Mitte der Untertitel in Prozent der Bildhöhe */
  untertitelY: z.number().optional(),
});
export type VideoPlan = z.infer<typeof planSchema>;

/**
 * Standardlayout je Format (Prozent; Schriftgrößen in Pixel der Zielgröße). Abstand zu den Bedienelementen von
 * Instagram/TikTok oben, unten und rechts. Vorschau im Editor und Renderer nutzen dieselben Werte.
 */
export const LAYOUT: Record<VideoFormat, { titel: Pos; einblendung: Pos; untertitelY: number; fonts: { titel: number; unterzeile: number; einblendung: number; untertitel: number }; logoHeight: number; margin: number }> = {
  "9:16": { titel: { x: 5.5, y: 15 }, einblendung: { x: 5.5, y: 56 }, untertitelY: 73, fonts: { titel: 86, unterzeile: 42, einblendung: 54, untertitel: 52 }, logoHeight: 96, margin: 5.5 },
  "1:1": { titel: { x: 4.6, y: 15 }, einblendung: { x: 4.6, y: 64 }, untertitelY: 88, fonts: { titel: 72, unterzeile: 36, einblendung: 46, untertitel: 44 }, logoHeight: 80, margin: 4.6 },
  "16:9": { titel: { x: 4.2, y: 15 }, einblendung: { x: 4.2, y: 66 }, untertitelY: 89, fonts: { titel: 80, unterzeile: 40, einblendung: 50, untertitel: 48 }, logoHeight: 90, margin: 3.2 },
};

export const LOGO_SCALE: Record<Exclude<LogoSize, "aus">, number> = { klein: 0.7, mittel: 1, gross: 1.45 };

const clampPos = (p: Pos | undefined): Pos | undefined =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: Math.round(Math.max(0, Math.min(90, p.x)) * 10) / 10, y: Math.round(Math.max(0, Math.min(95, p.y)) * 10) / 10 } : undefined;

/**
 * Zeitfenster der Einblendung im Ausschnitt (Sekunden ab Ausschnittbeginn). Ohne eigene Angabe läuft sie über den ganzen
 * Ausschnitt, im ersten Ausschnitt erst nach der Titelzeile (bleibt danach weniger als 1 s, entfällt sie).
 */
export function einblendungWindow(shot: Pick<Shot, "start" | "end" | "einblendungVon" | "einblendungBis">, titleEnd = 0): { from: number; to: number } | null {
  const dur = shot.end - shot.start;
  if (shot.einblendungVon == null && titleEnd && dur - titleEnd < 1) return null;
  const from = Math.max(0, Math.min(shot.einblendungVon ?? titleEnd, dur - 0.5));
  const to = Math.max(from + 0.5, Math.min(shot.einblendungBis ?? dur, dur));
  return { from: r2(from), to: r2(to) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function cutBudget(maxSeconds: number) {
  return Math.max(MIN_SHOT, maxSeconds - OUTRO_SECONDS);
}

export function planDuration(plan: Pick<VideoPlan, "shots">) {
  return r2(plan.shots.reduce((sum, s) => sum + (s.end - s.start), 0) + OUTRO_SECONDS);
}

function wordsOf(segments: Segment[] | null | undefined): Word[] {
  return (segments ?? []).flatMap((s) => s.words ?? []).filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start);
}

/** Start und Ende an Wortgrenzen legen, damit O-Töne nicht mitten im Wort beginnen oder enden. */
export function snapToWords(start: number, end: number, segments: Segment[] | null | undefined, duration: number) {
  const words = wordsOf(segments);
  if (!words.length) return { start, end };
  const inside = words.filter((w) => w.end > start && w.start < end);
  if (!inside.length) return { start, end };
  const first = inside[0]!;
  const last = inside[inside.length - 1]!;
  // Wort, das am Ende nur angeschnitten wäre (weniger als die Hälfte drin), weglassen
  const lastFull = last.end > end && (end - last.start) / (last.end - last.start) < 0.5 && inside.length > 1 ? inside[inside.length - 2]! : last;
  const s = start > first.start ? Math.max(0, first.start - 0.12) : Math.max(0, Math.min(start, first.start - 0.12));
  const e = Math.min(duration, lastFull.end + 0.2);
  return { start: r2(s), end: r2(Math.max(e, s + 0.5)) };
}

/** Letztes Wortende ≤ limit (für das Kürzen am Budget), sonst limit. */
function wordEndBefore(limit: number, start: number, segments: Segment[] | null | undefined) {
  const ends = wordsOf(segments)
    .filter((w) => w.end <= limit && w.end > start + MIN_SHOT)
    .map((w) => w.end);
  return ends.length ? Math.min(limit, Math.max(...ends) + 0.15) : limit;
}

/**
 * Schnittplan prüfen und korrigieren: unbekannte Clips und zu kurze Ausschnitte entfernen, Zeiten auf die Clip-Länge begrenzen,
 * O-Töne an Wortgrenzen ausrichten und alles auf das Zeitbudget (max. Länge minus Abschlusstafel) kürzen.
 */
export function normalizePlan(plan: z.input<typeof planSchema> | VideoPlan, clips: ClipInfo[], maxSeconds: number): { plan: VideoPlan; warnings: string[] } {
  const warnings: string[] = [];
  const byId = new Map(clips.map((c) => [c.id, c]));
  const budget = cutBudget(maxSeconds);
  let used = 0;
  const shots: Shot[] = [];
  for (const raw of plan.shots.slice(0, MAX_SHOTS) as Shot[]) {
    const clip = byId.get(raw.clipId);
    if (!clip) {
      warnings.push("Ein Ausschnitt verweist auf einen unbekannten Clip und wurde entfernt.");
      continue;
    }
    const tone: ShotTone = clip.hasAudio ? raw.ton : "stumm";
    let start = Math.max(0, Math.min(raw.start, clip.duration));
    let end = Math.max(0, Math.min(raw.end, clip.duration));
    if (end < start) [start, end] = [end, start];
    if (tone !== "stumm" && clip.transcript?.length) ({ start, end } = snapToWords(start, end, clip.transcript, clip.duration));
    if (end - start < MIN_SHOT) end = Math.min(clip.duration, start + MIN_SHOT);
    if (end - start < MIN_SHOT) start = Math.max(0, end - MIN_SHOT);
    if (end - start < MIN_SHOT - 0.01) {
      warnings.push("Ein Ausschnitt war kürzer als 1,5 Sekunden und wurde entfernt.");
      continue;
    }
    const remaining = budget - used;
    if (remaining < MIN_SHOT) {
      warnings.push(`Ausschnitte über ${maxSeconds} Sekunden hinaus wurden weggelassen.`);
      break;
    }
    if (end - start > remaining) {
      end = tone !== "stumm" ? wordEndBefore(start + remaining, start, clip.transcript) : start + remaining;
      warnings.push(`Der letzte Ausschnitt wurde gekürzt, damit das Video höchstens ${maxSeconds} Sekunden lang ist.`);
    }
    const shot: Shot = {
      clipId: clip.id,
      start: r2(start),
      end: r2(end),
      ton: tone,
      einblendung: raw.einblendung.trim().slice(0, 80),
      untertitel: tone !== "stumm" && raw.untertitel && !!clip.transcript?.length,
      untertitelText: (raw.untertitelText ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    };
    const pos = clampPos(raw.einblendungPos);
    if (pos) shot.einblendungPos = pos;
    const dur = shot.end - shot.start;
    if (raw.einblendungVon != null && Number.isFinite(raw.einblendungVon)) shot.einblendungVon = r2(Math.max(0, Math.min(raw.einblendungVon, dur - 0.5)));
    if (raw.einblendungBis != null && Number.isFinite(raw.einblendungBis)) shot.einblendungBis = r2(Math.max(shot.einblendungVon ?? 0.5, Math.min(raw.einblendungBis, dur)));
    shots.push(shot);
    used += shot.end - shot.start;
  }
  return {
    plan: {
      titel: plan.titel.trim().slice(0, 80),
      unterzeile: plan.unterzeile.trim().slice(0, 120),
      shots,
      abschluss: plan.abschluss.trim().slice(0, 100),
      aufruf: plan.aufruf.trim().slice(0, 80),
      beitragstext: plan.beitragstext.trim().slice(0, 1500),
      hashtags: plan.hashtags.trim().slice(0, 200),
      begruendung: plan.begruendung.trim().slice(0, 3000),
      ...(clampPos(plan.titelPos) ? { titelPos: clampPos(plan.titelPos) } : {}),
      ...(plan.untertitelY != null && Number.isFinite(plan.untertitelY) ? { untertitelY: Math.round(Math.max(10, Math.min(95, plan.untertitelY)) * 10) / 10 } : {}),
    },
    warnings: [...new Set(warnings)],
  };
}

/** Einfacher Schnitt ohne KI: alle Clips nacheinander, gleich lang, Ton nach Verfügbarkeit. */
export function fallbackPlan(clips: ClipInfo[], maxSeconds: number, texts: { titel: string; botschaft: string; aufruf: string }): VideoPlan {
  const usable = clips.filter((c) => c.duration >= MIN_SHOT).slice(0, MAX_SHOTS);
  const each = usable.length ? Math.max(MIN_SHOT, cutBudget(maxSeconds) / usable.length) : 0;
  return {
    titel: texts.titel,
    unterzeile: "",
    shots: usable.map((c, i) => {
      const len = Math.min(each, c.duration);
      const start = Math.max(0, (c.duration - len) / 2);
      return {
        clipId: c.id,
        start,
        end: start + len,
        ton: c.hasAudio ? "original" : "stumm",
        einblendung: i === Math.floor(usable.length / 2) ? texts.botschaft.slice(0, 60) : "",
        untertitel: c.hasAudio,
        untertitelText: "",
      };
    }),
    abschluss: texts.botschaft,
    aufruf: texts.aufruf,
    beitragstext: "",
    hashtags: "",
    begruendung: "Einfacher Schnitt ohne KI (Claude API nicht eingerichtet).",
  };
}

export type Cue = { from: number; to: number; text: string };

/**
 * Untertitel-Zeilen für einen Ausschnitt, Zeiten relativ zum Ausschnittbeginn.
 * Höchstens 7 Wörter, 42 Zeichen (zwei kurze Zeilen) oder 3 Sekunden je Untertitel; Umbruch bevorzugt nach Satzzeichen.
 */
export function subtitleCues(shot: Pick<Shot, "start" | "end"> & { untertitelText?: string }, segments: Segment[] | null | undefined): Cue[] {
  const words = wordsOf(segments).filter((w) => w.end > shot.start + 0.05 && w.start < shot.end - 0.05);
  if (shot.untertitelText?.trim()) return correctedCues(shot.untertitelText, shot, words);
  const cues: Cue[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((w) => w.word.trim()).join(" ").replace(/\s+([,.!?;:])/g, "$1").trim();
    const from = Math.max(0, cur[0]!.start - shot.start);
    const to = Math.min(shot.end - shot.start, cur[cur.length - 1]!.end - shot.start + 0.15);
    if (text) cues.push({ from: r2(from), to: r2(Math.max(to, from + 0.4)), text });
    cur = [];
  };
  for (const w of words) {
    const text = [...cur, w].map((x) => x.word.trim()).join(" ");
    const span = cur.length ? w.end - cur[0]!.start : 0;
    if (cur.length && (cur.length >= 7 || text.length > 42 || span > 3)) flush();
    cur.push(w);
    if (/[.!?;:,]$/.test(w.word.trim()) && cur.length >= 2) flush();
  }
  flush();
  // Lücken schließen, damit Zeilen nicht flackern
  for (let i = 0; i < cues.length - 1; i++) if (cues[i + 1]!.from - cues[i]!.to < 0.3) cues[i]!.to = cues[i + 1]!.from;
  if (cues.length) return cues;
  // ohne Wortzeiten: Sätze im Ausschnitt als Ganzes
  return (segments ?? [])
    .filter((s) => s.end > shot.start && s.start < shot.end && s.text.trim())
    .map((s) => ({ from: r2(Math.max(0, s.start - shot.start)), to: r2(Math.min(shot.end, s.end) - shot.start), text: s.text.trim() }));
}

/**
 * Korrigierter Text: in Zeilen wie oben teilen und über die Sprechzeit (erstes bis letztes erkanntes Wort) verteilen,
 * anteilig nach Zeichen – Whisper-Fehler lassen sich so beheben, ohne Zeitstempel von Hand zu setzen.
 */
function correctedCues(text: string, shot: Pick<Shot, "start" | "end">, words: Word[]): Cue[] {
  const dur = shot.end - shot.start;
  const from = words.length ? Math.max(0, words[0]!.start - shot.start) : 0;
  const to = words.length ? Math.min(dur, words[words.length - 1]!.end - shot.start + 0.15) : dur;
  const lines: string[] = [];
  let cur: string[] = [];
  for (const w of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (cur.length && (cur.length >= 7 || [...cur, w].join(" ").length > 42)) {
      lines.push(cur.join(" "));
      cur = [];
    }
    cur.push(w);
    if (/[.!?;:,]$/.test(w) && cur.length >= 2) {
      lines.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length) lines.push(cur.join(" "));
  const total = lines.reduce((n, l) => n + l.length, 0) || 1;
  let t = from;
  return lines.map((l) => {
    const len = ((to - from) * l.length) / total;
    const cue = { from: r2(t), to: r2(t + len), text: l };
    t += len;
    return cue;
  });
}

/** Transkripttext eines Ausschnitts (für Editor und KI-Kontrolle). */
export function shotText(shot: Pick<Shot, "start" | "end">, segments: Segment[] | null | undefined) {
  const words = wordsOf(segments).filter((w) => w.end > shot.start + 0.05 && w.start < shot.end - 0.05);
  if (words.length) return words.map((w) => w.word.trim()).join(" ").replace(/\s+([,.!?;:])/g, "$1");
  return (segments ?? [])
    .filter((s) => s.end > shot.start && s.start < shot.end)
    .map((s) => s.text.trim())
    .join(" ");
}

/** Whisper-JSON (openai-whisper-asr-webservice, output=json, word_timestamps=true) in Segmente umwandeln. */
export function parseWhisperJson(data: unknown): Segment[] {
  const segs = (data as { segments?: unknown[] })?.segments;
  if (!Array.isArray(segs)) return [];
  return segs
    .map((s) => {
      const o = s as { start?: number; end?: number; text?: string; words?: { start?: number; end?: number; word?: string }[] };
      return {
        start: r2(Number(o.start) || 0),
        end: r2(Number(o.end) || 0),
        text: String(o.text ?? "").trim(),
        words: (o.words ?? [])
          .filter((w) => Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)) && String(w.word ?? "").trim())
          .map((w) => ({ start: r2(Number(w.start)), end: r2(Number(w.end)), word: String(w.word).trim() })),
      };
    })
    .filter((s) => s.text && s.end > s.start);
}
