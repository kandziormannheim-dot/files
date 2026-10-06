import "server-only";
import type { User } from "@prisma/client";
import { cache } from "react";
import { email as emailSchema, formToObject, optionalText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { sniffType } from "@/lib/file-types";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { deleteStoredFile, saveFile } from "@/server/files";
import { effectiveNoticeDays, type QuorumRule } from "./statute";

// Einstellungen (SPEC.md 3.10) als Schlüssel/Wert in der Tabelle Setting, mit Standardwerten.

export const SETTING_DEFAULTS = {
  "ov.name": "Seckenheim-Friedrichsfeld",
  "ov.nameLang": "CDU Mannheim-Süd / Seckenheim-Friedrichsfeld",
  "ov.nameAnschrift": "CDU OV Mannheim-Süd Seckenheim-Friedrichsfeld",
  "ov.ort": "Mannheim",
  "ov.absenderzeile": "",
  /** Vorsitzender: Absender der Einladungen, erster Unterzeichner */
  "ov.chairUserId": "",
  /** stellv. Vorsitzender: zweiter Unterzeichner */
  "ov.deputyUserId": "",
  "meeting.noticeDays": "7",
  "meeting.responseDaysBefore": "2",
  "meeting.rsvpReminderDaysBefore": "4",
  "meeting.invitationWarnDays": "2",
  "meeting.quorumRule": "MEHR_ALS_HAELFTE",
  "meeting.defaultLocation": "",
  "task.reminderDaysBefore": "3",
  "task.overdueReminder": "true",
  "circulation.defaultDays": "7",
  "office.email": "",
  "office.autoSend": "false",
  "retention.transcriptDays": "90",
  "retention.citizenContactMonths": "6",
  "topic.categories": "Verkehr\nSchule\nBauen\nSicherheit\nVereine\nSonstiges",
  "briefbogen.path": "",
  /** Datum der letzten Vorstandswahl (JJJJ-MM-TT), falls nicht im Tool erfasst – Wahlperiode LV § 56 */
  "election.lastDate": "",
  /** Öffentliche Seiten (Landing Pages, Presseportal) */
  "public.imprintUrl": "https://www.cdu-sf.de/impressum/",
  "public.privacyUrl": "https://www.cdu-sf.de/datenschutz/",
  "press.contact": "",
  /** BBR-Anliegen → Social Media: Deck-Board(s) (Titel oder ID, je Zeile), Logos der Kanäle, letzter Abruf */
  "bbr.deckBoards": "BBR Seckenheim",
  "bbr.lastSync": "",
  "social.logoOv": "",
  "social.logoBbr": "",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export type AppSettings = {
  ov: { name: string; nameLang: string; nameAnschrift: string; ort: string; absenderzeile: string; chairUserId: string; deputyUserId: string };
  meeting: {
    noticeDays: number;
    responseDaysBefore: number;
    rsvpReminderDaysBefore: number;
    invitationWarnDays: number;
    quorumRule: QuorumRule;
    defaultLocation: string;
  };
  task: { reminderDaysBefore: number; overdueReminder: boolean };
  circulation: { defaultDays: number };
  office: { email: string; autoSend: boolean };
  retention: { transcriptDays: number; citizenContactMonths: number };
  topicCategories: string[];
  briefbogenPath: string;
  publicSite: { imprintUrl: string; privacyUrl: string; pressContact: string };
  social: { deckBoards: string; lastSync: string; logoOv: string; logoBbr: string };
};

const int = (v: string, fallback: number) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : fallback);

export function toAppSettings(raw: Record<string, string>): AppSettings {
  const v = (k: SettingKey) => raw[k] ?? SETTING_DEFAULTS[k];
  return {
    ov: {
      name: v("ov.name"),
      nameLang: v("ov.nameLang"),
      nameAnschrift: v("ov.nameAnschrift"),
      ort: v("ov.ort"),
      absenderzeile: v("ov.absenderzeile"),
      chairUserId: v("ov.chairUserId"),
      deputyUserId: v("ov.deputyUserId"),
    },
    meeting: {
      noticeDays: effectiveNoticeDays(int(v("meeting.noticeDays"), 7)),
      responseDaysBefore: Math.max(0, int(v("meeting.responseDaysBefore"), 2)),
      rsvpReminderDaysBefore: Math.max(0, int(v("meeting.rsvpReminderDaysBefore"), 4)),
      invitationWarnDays: Math.max(0, int(v("meeting.invitationWarnDays"), 2)),
      quorumRule: v("meeting.quorumRule") === "MINDESTENS_HAELFTE" ? "MINDESTENS_HAELFTE" : "MEHR_ALS_HAELFTE",
      defaultLocation: v("meeting.defaultLocation"),
    },
    task: {
      reminderDaysBefore: Math.max(0, int(v("task.reminderDaysBefore"), 3)),
      overdueReminder: v("task.overdueReminder") === "true",
    },
    circulation: { defaultDays: Math.max(1, int(v("circulation.defaultDays"), 7)) },
    office: { email: v("office.email"), autoSend: v("office.autoSend") === "true" },
    retention: {
      transcriptDays: Math.max(1, int(v("retention.transcriptDays"), 90)),
      citizenContactMonths: Math.max(1, int(v("retention.citizenContactMonths"), 6)),
    },
    topicCategories: v("topic.categories")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    briefbogenPath: v("briefbogen.path"),
    publicSite: { imprintUrl: v("public.imprintUrl"), privacyUrl: v("public.privacyUrl"), pressContact: v("press.contact") },
    social: { deckBoards: v("bbr.deckBoards"), lastSync: v("bbr.lastSync"), logoOv: v("social.logoOv"), logoBbr: v("social.logoBbr") },
  };
}

async function loadRaw(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Einstellungen (je Request einmal gelesen). */
export const getSettings = cache(async (): Promise<AppSettings> => toAppSettings(await loadRaw()));

/** Ohne React-Cache (Jobs, Tests). */
export async function getSettingsUncached(): Promise<AppSettings> {
  return toAppSettings(await loadRaw());
}

export async function getRawSettings(actor: Pick<User, "role">) {
  assertCan(actor, "settings.manage");
  return { ...SETTING_DEFAULTS, ...(await loadRaw()) } as Record<SettingKey, string>;
}

const intField = (min: number, max: number) => z.coerce.number().int().min(min).max(max).transform(String);
const boolField = z.preprocess((v) => (v === "on" || v === "true" ? "true" : "false"), z.string());

const settingsSchema = z
  .object({
    "ov.name": optionalText(200),
    "ov.nameLang": optionalText(300),
    "ov.nameAnschrift": optionalText(300),
    "ov.ort": optionalText(100),
    "ov.absenderzeile": optionalText(300),
    "ov.chairUserId": optionalText(50),
    "ov.deputyUserId": optionalText(50),
    "meeting.noticeDays": intField(7, 60),
    "meeting.responseDaysBefore": intField(0, 30),
    "meeting.rsvpReminderDaysBefore": intField(0, 30),
    "meeting.invitationWarnDays": intField(0, 30),
    "meeting.quorumRule": z.enum(["MEHR_ALS_HAELFTE", "MINDESTENS_HAELFTE"]),
    "meeting.defaultLocation": optionalText(300),
    "task.reminderDaysBefore": intField(0, 60),
    "task.overdueReminder": boolField,
    "circulation.defaultDays": intField(1, 60),
    "office.email": z.preprocess((v) => (v === "" ? undefined : v), emailSchema.optional()),
    "office.autoSend": boolField,
    "retention.transcriptDays": intField(1, 3650),
    "retention.citizenContactMonths": intField(1, 120),
    "topic.categories": optionalText(2000),
    "election.lastDate": z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    "public.imprintUrl": optionalText(300),
    "public.privacyUrl": optionalText(300),
    "press.contact": optionalText(1000),
    "bbr.deckBoards": optionalText(500),
  })
  .partial();

export async function updateSettings(actor: Pick<User, "id" | "role">, formData: FormData) {
  assertCan(actor, "settings.manage");
  const raw = formToObject(formData);
  // Checkboxen fehlen im Formular, wenn sie abgewählt sind
  for (const key of ["task.overdueReminder", "office.autoSend"]) if (`${key}__present` in raw && !(key in raw)) raw[key] = "false";
  const input = settingsSchema.parse(raw);
  const before = await loadRaw();
  const changed: Record<string, [string | null, string]> = {};
  await db.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined && !(key in raw)) continue;
      const val = value ?? "";
      if ((before[key] ?? SETTING_DEFAULTS[key as SettingKey]) === val) continue;
      await tx.setting.upsert({ where: { key }, create: { key, value: val }, update: { value: val } });
      changed[key] = [before[key] ?? null, val];
    }
    if (Object.keys(changed).length) await audit(tx, actor, "settings.update", "Setting", null, changed);
  });
  return changed;
}

export async function setSetting(actor: Pick<User, "id" | "role">, key: SettingKey, value: string) {
  assertCan(actor, "settings.manage");
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await audit(tx, actor, "settings.update", "Setting", key, { [key]: value });
  });
}

/** Briefbogen (A4-Hintergrundbild, PNG) austauschen (SPEC.md 3.6). */
export async function uploadBriefbogen(actor: Pick<User, "id" | "role">, formData: FormData) {
  assertCan(actor, "settings.manage");
  const file = formData.get("briefbogen");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Bitte eine PNG-Datei auswählen.");
  if (file.size > 8_000_000) throw new UserError("Die Datei ist größer als 8 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  if (sniffType(data) !== "image/png") throw new UserError("Der Briefbogen muss ein PNG-Bild sein (A4, z. B. 1414×2000 px).");
  const rel = await saveFile("briefbogen", "briefbogen.png", data);
  const before = (await loadRaw())["briefbogen.path"];
  await setSetting(actor, "briefbogen.path", rel);
  await deleteStoredFile(before);
}

export async function resetBriefbogen(actor: Pick<User, "id" | "role">) {
  assertCan(actor, "settings.manage");
  const before = (await loadRaw())["briefbogen.path"];
  await setSetting(actor, "briefbogen.path", "");
  await deleteStoredFile(before);
}
