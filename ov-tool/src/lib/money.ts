// Beträge in Cent – nie mit Gleitkomma rechnen.

/** "12,50" / "12.50" / "1.234,56" / "12" → Cent; null bei ungültiger Eingabe. */
export function parseEuro(input: string): number | null {
  let s = input.trim().replace(/\s|€/g, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [eur, ct = ""] = s.split(".");
  return Number(eur) * 100 + Number(ct.padEnd(2, "0"));
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** IBAN normalisieren (Großbuchstaben, ohne Leerzeichen) und per Prüfziffer (ISO 13616, mod 97) prüfen. */
export function normalizeIban(input: string): string | null {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  if (iban.startsWith("DE") && iban.length !== 22) return null;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const v = ch >= "A" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1 ? iban : null;
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/** Für Listen: nur Länderkennung und die letzten vier Stellen. */
export function maskIban(iban: string): string {
  return iban.length > 8 ? `${iban.slice(0, 2)}•• •••• ${iban.slice(-4)}` : "••••";
}
