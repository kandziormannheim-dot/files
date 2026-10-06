// Auslesen der Nextcloud-Deck-Karten aus dem Tool „BBR-Anliegen“ (bbr-anliegen.cdu-sf.de).
// Die Kartenbeschreibung ist Markdown, z. B.:
//
//   **Bezirk:** Seckenheim
//   **Hinweisgeber/Kontakt:** …
//
//   **Kurzfassung**
//
//   Zeile 1
//   Zeile 2
//   Zeile 3
//
//   **Erläuterung**
//   …
//
// Übernommen werden ausschließlich Überschrift (Kartentitel), Bezirk und Kurzfassung.
// Hinweisgeber und Erläuterung enthalten ggf. personenbezogene oder interne Angaben und werden nie gelesen.

export const BEZIRKE = ["Seckenheim", "Friedrichsfeld"] as const;
export type Bezirk = (typeof BEZIRKE)[number];

export type ParsedCard = { kurzfassung: string; bezirk: Bezirk | null };

/** Text zwischen „**Kurzfassung**“ und der nächsten fett gesetzten Abschnittsüberschrift bzw. „---“. */
export function extractKurzfassung(description: string): string {
  const text = description.replace(/\r\n?/g, "\n");
  const start = text.search(/^[ \t]*(?:\*\*|__|#+\s*)Kurzfassung:?(?:\*\*|__)?:?[ \t]*$/im);
  if (start < 0) return "";
  const afterHeading = text.slice(start).replace(/^[^\n]*\n?/, "");
  const end = afterHeading.search(/^[ \t]*(?:(?:\*\*|__)[^*_\n]+(?:\*\*|__)|#+\s+\S.*|-{3,})[ \t]*$/m);
  const body = end < 0 ? afterHeading : afterHeading.slice(0, end);
  return body
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s+/, "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

/** Bezirk aus einer Zeile „Bezirk: …“, sonst aus Titel/Boardname („BBR Friedrichsfeld“). */
export function detectBezirk(...sources: (string | null | undefined)[]): Bezirk | null {
  for (const s of sources) {
    if (!s) continue;
    const line = s.match(/\*{0,2}Bezirk(?:sbeirat)?:?\*{0,2}:?\s*(?:Mannheim-)?([A-Za-zäöüÄÖÜß-]+)/i);
    const hit = BEZIRKE.find((b) => line?.[1]?.toLowerCase() === b.toLowerCase());
    if (hit) return hit;
  }
  for (const s of sources) {
    if (!s) continue;
    const hit = BEZIRKE.find((b) => s.toLowerCase().includes(b.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

export function parseCardDescription(description: string, ...context: (string | null | undefined)[]): ParsedCard {
  // Bezirk nur aus dem Kopf der Beschreibung (vor der Kurzfassung) und dem Kontext, nicht aus der Erläuterung
  const head = description.split(/\*\*Kurzfassung/i)[0] ?? "";
  return { kurzfassung: extractKurzfassung(description), bezirk: detectBezirk(head, ...context) };
}

/** Stabiler Vergleichswert, um geänderte Kurzfassungen zu erkennen. */
export function kurzfassungKey(title: string, kurzfassung: string, bezirk: string | null): string {
  return [title.trim(), bezirk ?? "", kurzfassung.replace(/\s+/g, " ").trim()].join("␟");
}

/** Zeilen der Kurzfassung (in der Regel drei). */
export function kurzfassungLines(kurzfassung: string): string[] {
  return kurzfassung
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Kanalname der BBR-Gruppe, z. B. „CDU-Gruppe im BBR Seckenheim“. */
export function bbrAccountName(bezirk: string | null | undefined): string {
  return bezirk ? `CDU-Gruppe im BBR ${bezirk}` : "CDU-Gruppe im BBR Seckenheim/Friedrichsfeld";
}
