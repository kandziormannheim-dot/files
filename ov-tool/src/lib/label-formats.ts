// Druckformate für Inventar-Etiketten: Etikettenbögen (A4) und Etikettendrucker (Rollen, ein Etikett je Seite).
// Maße in Millimetern laut Herstellerangaben; kleine Abweichungen des Druckers über „Versatz“ ausgleichen.

export type LabelFormat = {
  key: string;
  name: string;
  /** Hinweis für die Auswahl, z. B. kompatible Artikelnummern */
  hint: string;
  page: { width: number; height: number };
  cols: number;
  rows: number;
  label: { width: number; height: number };
  /** Rand oben/links bis zum ersten Etikett */
  margin: { top: number; left: number };
  /** Abstand zwischen den Etiketten (horizontal/vertikal) */
  gap: { x: number; y: number };
  /** Etikettendrucker: ein Etikett je Seite, kein „Überspringen“ */
  roll?: boolean;
};

const A4 = { width: 210, height: 297 };

export const LABEL_FORMATS: LabelFormat[] = [
  {
    key: "roll-50x30",
    name: "Etikettendrucker 50 × 30 mm",
    hint: "Thermo-Etiketten 50 × 30 mm (Rolle)",
    page: { width: 50, height: 30 },
    cols: 1,
    rows: 1,
    label: { width: 50, height: 30 },
    margin: { top: 0, left: 0 },
    gap: { x: 0, y: 0 },
    roll: true,
  },
  {
    key: "a4-3x8-70x37",
    name: "A4-Bogen 3 × 8 · 70 × 37 mm",
    hint: "z. B. Avery Zweckform 3474, randlos",
    page: A4,
    cols: 3,
    rows: 8,
    label: { width: 70, height: 37 },
    margin: { top: 0.5, left: 0 },
    gap: { x: 0, y: 0 },
  },
  {
    key: "a4-3x8-70x36",
    name: "A4-Bogen 3 × 8 · 70 × 36 mm",
    hint: "z. B. Avery Zweckform 3475",
    page: A4,
    cols: 3,
    rows: 8,
    label: { width: 70, height: 36 },
    margin: { top: 4.5, left: 0 },
    gap: { x: 0, y: 0 },
  },
  {
    key: "a4-3x8-70x35",
    name: "A4-Bogen 3 × 8 · 70 × 35 mm",
    hint: "z. B. Avery Zweckform 3422",
    page: A4,
    cols: 3,
    rows: 8,
    label: { width: 70, height: 35 },
    margin: { top: 8.5, left: 0 },
    gap: { x: 0, y: 0 },
  },
  {
    key: "a4-3x7-63x38",
    name: "A4-Bogen 3 × 7 · 63,5 × 38,1 mm",
    hint: "z. B. Avery L7160, Herma 4677",
    page: A4,
    cols: 3,
    rows: 7,
    label: { width: 63.5, height: 38.1 },
    margin: { top: 15.15, left: 7.2 },
    gap: { x: 2.5, y: 0 },
  },
  {
    key: "a4-5x13-38x21",
    name: "A4-Bogen 5 × 13 · 38,1 × 21,2 mm (klein)",
    hint: "z. B. Avery L7651 – nur Barcode und Code",
    page: A4,
    cols: 5,
    rows: 13,
    label: { width: 38.1, height: 21.2 },
    margin: { top: 10.7, left: 4.7 },
    gap: { x: 2.5, y: 0 },
  },
  {
    key: "a4-2x4-105x74",
    name: "A4-Bogen 2 × 4 · 105 × 74 mm (groß)",
    hint: "z. B. Avery Zweckform 3483 – mit Standort und Kategorie",
    page: A4,
    cols: 2,
    rows: 4,
    label: { width: 105, height: 74 },
    margin: { top: 0.5, left: 0 },
    gap: { x: 0, y: 0 },
  },
  {
    key: "roll-62x29",
    name: "Etikettendrucker 62 × 29 mm",
    hint: "z. B. Brother DK-11209 (QL-Serie)",
    page: { width: 62, height: 29 },
    cols: 1,
    rows: 1,
    label: { width: 62, height: 29 },
    margin: { top: 0, left: 0 },
    gap: { x: 0, y: 0 },
    roll: true,
  },
  {
    key: "roll-89x36",
    name: "Etikettendrucker 89 × 36 mm",
    hint: "z. B. Dymo 99012 (LabelWriter)",
    page: { width: 89, height: 36 },
    cols: 1,
    rows: 1,
    label: { width: 89, height: 36 },
    margin: { top: 0, left: 0 },
    gap: { x: 0, y: 0 },
    roll: true,
  },
];

export const DEFAULT_LABEL_FORMAT = LABEL_FORMATS[0]!;

export function labelFormat(key: string | null | undefined): LabelFormat {
  return LABEL_FORMATS.find((f) => f.key === key) ?? DEFAULT_LABEL_FORMAT;
}

export function labelsPerPage(f: LabelFormat) {
  return f.cols * f.rows;
}

/**
 * Inhaltsstufe nach Etikettengröße: klein = nur Barcode+Code, kompakt = Name+QR oben, Barcode volle Breite darunter
 * (schmale Etiketten, damit die Striche breit genug für Thermodrucker bleiben), normal = Name, Barcode und QR nebeneinander,
 * groß = + Standort/Kategorie.
 */
export function labelDensity(f: LabelFormat): "klein" | "kompakt" | "normal" | "gross" {
  if (f.label.height < 25 || f.label.width < 45) return "klein";
  if (f.label.width < 55) return "kompakt";
  if (f.label.height >= 60 && f.label.width >= 90) return "gross";
  return "normal";
}

/** Versatz in mm begrenzen (Ausgleich für Drucker, die das Blatt leicht verschoben einziehen). */
export function clampOffset(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(-10, Math.min(10, Math.round(n * 10) / 10)) : 0;
}
