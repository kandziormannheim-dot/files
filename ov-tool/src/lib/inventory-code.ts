// Inventarnummer des OV: OVMASF + fünfstellige laufende Nummer + "." + Anschaffungsjahr (zweistellig).
// Beispiel: OVMASF01234.20 = Nr. 1234, angeschafft 2020.

export const INVENTORY_PREFIX = "OVMASF";
export const MAX_INVENTORY_NUMBER = 99_999;

export function formatInventoryCode(number: number, acquiredYear: number): string {
  if (!Number.isInteger(number) || number < 1 || number > MAX_INVENTORY_NUMBER) throw new RangeError("Nummer 1–99999");
  if (!Number.isInteger(acquiredYear) || acquiredYear < 1900 || acquiredYear > 2999) throw new RangeError("Jahr vierstellig");
  return `${INVENTORY_PREFIX}${String(number).padStart(5, "0")}.${String(acquiredYear % 100).padStart(2, "0")}`;
}

const CODE_RE = new RegExp(`^${INVENTORY_PREFIX}(\\d{5})\\.(\\d{2})$`);

/** Liest einen gescannten oder eingetippten Code (Groß-/Kleinschreibung und Leerzeichen egal). */
export function parseInventoryCode(input: string): { number: number; yearSuffix: number; code: string } | null {
  const s = input.trim().toUpperCase().replace(/\s+/g, "");
  const m = CODE_RE.exec(s);
  if (!m) return null;
  const number = Number(m[1]);
  if (number < 1) return null;
  return { number, yearSuffix: Number(m[2]), code: s };
}
