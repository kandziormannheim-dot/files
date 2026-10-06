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

/** Einfacher Markdown-Fettdruck (**…** bzw. __…__) als Abschnitte, z. B. „**Anliegen:** Text“. */
export function boldSegments(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  const re = /(\*\*|__)(.+?)\1/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[2]!, bold: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out.filter((s) => s.text);
}

/** Markdown-Auszeichnung entfernen (für Videotafeln, einfache Texte). */
export function stripMarkdown(text: string): string {
  return boldSegments(text)
    .map((s) => s.text)
    .join("")
    .replace(/(^|\s)[*_]+(?=\S)|(?<=\S)[*_]+(?=\s|$)/g, "$1");
}
