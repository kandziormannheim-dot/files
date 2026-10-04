// Datums- und Zeitformatierung für Oberfläche, Vorlagen und Dokumente.
// In der DB liegt UTC; angezeigt wird immer Europe/Berlin (CLAUDE.md, Konventionen).

export const TIME_ZONE = "Europe/Berlin";

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, ...options });

const dateFmt = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const longFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const weekdayFmt = fmt({ weekday: "long" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const monthYearFmt = fmt({ month: "long", year: "numeric" });
const partsFmt = fmt({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type DateInput = Date | string | number | null | undefined;

export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 26.02.2026 */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "";
}

/** Donnerstag, 26. Februar 2026 */
export function formatDateLong(value: DateInput): string {
  const d = toDate(value);
  return d ? longFmt.format(d) : "";
}

/** Donnerstag */
export function formatWeekday(value: DateInput): string {
  const d = toDate(value);
  return d ? weekdayFmt.format(d) : "";
}

/** 19:00 */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  return d ? timeFmt.format(d) : "";
}

/** 19 bei vollen Stunden, sonst 19:30 */
export function formatTimeShort(value: DateInput): string {
  const t = formatTime(value);
  if (!t) return "";
  const [h, m] = t.split(":");
  return m === "00" ? String(Number(h)) : t;
}

/** März 2026 */
export function formatMonthYear(value: DateInput): string {
  const d = toDate(value);
  return d ? monthYearFmt.format(d) : "";
}

/** 26.02.2026, 19:00 */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  return d ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : "";
}

type BerlinParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function berlinParts(d: Date): BerlinParts {
  const map: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(d)) if (p.type !== "literal") map[p.type] = Number(p.value);
  return {
    year: map.year!,
    month: map.month!,
    day: map.day!,
    hour: map.hour === 24 ? 0 : map.hour!,
    minute: map.minute!,
    second: map.second!,
  };
}

/** Wandelt eine Berliner Wandzeit in einen UTC-Zeitpunkt um (berücksichtigt Sommer-/Winterzeit). */
export function fromBerlin(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Zweimal korrigieren, damit auch Tage mit Zeitumstellung stimmen.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = berlinParts(new Date(ts));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts += guess - asUtc;
  }
  return new Date(ts);
}

/** Wert für <input type="datetime-local"> in Berliner Zeit. */
export function toDateTimeInput(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "";
  const p = berlinParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Wert für <input type="date"> in Berliner Zeit. */
export function toDateInput(value: DateInput): string {
  return toDateTimeInput(value).slice(0, 10);
}

/** Liest "YYYY-MM-DDTHH:MM" (Berliner Zeit) aus einem Formular. */
export function parseDateTimeInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return fromBerlin(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

/** Liest "YYYY-MM-DD" als Berliner Mitternacht. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return fromBerlin(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Beginn des Kalendertags (Berlin) von d. */
export function startOfBerlinDay(d: Date): Date {
  const p = berlinParts(d);
  return fromBerlin(p.year, p.month, p.day);
}

/** Addiert Kalendertage in Berliner Zeit (Wandzeit bleibt gleich). */
export function addBerlinDays(d: Date, days: number): Date {
  const p = berlinParts(d);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return fromBerlin(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), p.hour, p.minute);
}

/** Ganze Kalendertage (Berlin) von a bis b. */
export function berlinDayDiff(a: Date, b: Date): number {
  const pa = berlinParts(a);
  const pb = berlinParts(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}
