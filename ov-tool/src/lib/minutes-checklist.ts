// Prüfliste der Niederschrift (LV-Satzung § 51 Abs. 1 und 2): Ort, Zeitpunkt, Dauer, gestellte Anträge,
// Abstimmungen und Ergebnisse. Ein Protokoll kann erst versendet werden, wenn alle Pflichtpunkte erfüllt sind.

export type ChecklistInput = {
  location: string;
  onlineUrl: string;
  openedAt: Date | null;
  closedAt: Date | null;
  attendanceTotal: number;
  attendanceRecorded: number;
  quorumDetermined: boolean;
  recorderName: string;
  signerCount: number;
  openAgendaItems: string[];
  resolutionsWithoutResult: string[];
  beschluesseWithoutVotes: string[];
};

export type ChecklistItem = { key: string; label: string; ok: boolean; required: boolean; detail?: string };

export function minutesChecklist(i: ChecklistInput): ChecklistItem[] {
  return [
    { key: "ort", label: "Ort der Sitzung", ok: !!(i.location || i.onlineUrl), required: true },
    { key: "beginn", label: "Beginn (Eröffnung)", ok: !!i.openedAt, required: true },
    { key: "ende", label: "Ende der Sitzung (Dauer)", ok: !!i.closedAt, required: true },
    {
      key: "anwesenheit",
      label: "Anwesenheit erfasst",
      ok: i.attendanceTotal > 0 && i.attendanceRecorded === i.attendanceTotal,
      required: true,
      detail: `${i.attendanceRecorded} von ${i.attendanceTotal}`,
    },
    { key: "quorum", label: "Beschlussfähigkeit festgestellt (Statut § 40 Abs. 2)", ok: i.quorumDetermined, required: true },
    {
      key: "tops",
      label: "Alle TOPs behandelt, abgesetzt oder vertagt",
      ok: i.openAgendaItems.length === 0,
      required: true,
      detail: i.openAgendaItems.length ? `offen: TOP ${i.openAgendaItems.join(", ")}` : undefined,
    },
    {
      key: "ergebnisse",
      label: "Anträge mit Ergebnis",
      ok: i.resolutionsWithoutResult.length === 0,
      required: true,
      detail: i.resolutionsWithoutResult.join(", ") || undefined,
    },
    {
      key: "abstimmungen",
      label: "Abstimmungsergebnisse (Ja/Nein/Enthaltung) bei mehrheitlichen Beschlüssen",
      ok: i.beschluesseWithoutVotes.length === 0,
      required: true,
      detail: i.beschluesseWithoutVotes.join(", ") || undefined,
    },
    { key: "protokoll", label: "Protokollführung angegeben", ok: !!i.recorderName.trim(), required: true },
    { key: "unterzeichner", label: "Unterzeichner (LV § 51 Abs. 3)", ok: i.signerCount > 0, required: true },
  ];
}

export function checklistComplete(items: ChecklistItem[]): boolean {
  return items.every((i) => i.ok || !i.required);
}

/** Laufende Beschlussnummer je Jahr: 2026-07 */
export function nextResolutionNumber(year: number, existing: string[], prefix = ""): string {
  const re = new RegExp(`^${prefix}${year}-(\\d+)$`);
  const max = existing.reduce((m, n) => {
    const hit = re.exec(n);
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return `${prefix}${year}-${String(max + 1).padStart(2, "0")}`;
}
