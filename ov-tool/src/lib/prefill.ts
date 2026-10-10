/**
 * Vorbelegung von Formularen über die Adresse (`/marketing/new?brief=…`,
 * `/marketing/videos/new?title=…`), z. B. aus einem externen Redaktionswerkzeug.
 * Das Tool hängt von keinem bestimmten Werkzeug ab.
 * Werte werden nur als Formular-Vorgaben genutzt; geprüft wird wie immer beim Absenden.
 */
export type SearchValue = string | string[] | undefined;

/** Erster Wert eines Suchparameters, gekürzt auf `max` Zeichen, ohne Steuerzeichen außer Zeilenumbrüchen. */
export function prefillText(value: SearchValue, max: number): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

/** Wert aus einer festen Auswahl, sonst `fallback`. */
export function prefillChoice<T extends string>(value: SearchValue, allowed: readonly T[], fallback: T): T {
  const v = prefillText(value, 40);
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Komma-getrennte Liste, gefiltert auf erlaubte Werte; leer → `fallback`. */
export function prefillList<T extends string>(value: SearchValue, allowed: readonly T[], fallback: T[]): T[] {
  const list = prefillText(value, 200)
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as readonly string[]).includes(s));
  return list.length ? Array.from(new Set(list)) : fallback;
}
