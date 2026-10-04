// Stichpunkte eines TOPs als einfacher Text im Editor (eine Zeile je Punkt, eingerückte Zeilen sind Unterpunkte).
//   Der Ortsvorsitzende begrüßt die Anwesenden.
//   Vorschlag: Infostand am 2. Adventssamstag.
//     Material über den Kreisverband
// Gespeichert wird [{ text, unterpunkte: [] }] (Protokollvorlage: „–“ für Punkte, „·“ für Unterpunkte).

export type Point = { text: string; unterpunkte: string[] };

const BULLET = /^[-–—•*·]\s*/;

export function parsePoints(text: string): Point[] {
  const points: Point[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!raw.trim()) continue;
    const isSub = /^(\s{2,}|\t)/.test(raw) || /^\s*·/.test(raw);
    const content = raw.trim().replace(BULLET, "").trim();
    if (!content) continue;
    const last = points.at(-1);
    if (isSub && last) last.unterpunkte.push(content);
    else points.push({ text: content, unterpunkte: [] });
  }
  return points;
}

export function serializePoints(points: Point[]): string {
  return points.map((p) => [p.text, ...p.unterpunkte.map((u) => `  ${u}`)].join("\n")).join("\n");
}

export function asPoints(json: unknown): Point[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((p): p is { text: unknown; unterpunkte?: unknown } => !!p && typeof p === "object" && "text" in p)
    .map((p) => ({
      text: String(p.text ?? ""),
      unterpunkte: Array.isArray(p.unterpunkte) ? p.unterpunkte.map(String) : [],
    }))
    .filter((p) => p.text);
}

/** Nachname für die Aufgabentabelle („Kelsch, Kandzior“). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.at(-1) ?? name;
}
