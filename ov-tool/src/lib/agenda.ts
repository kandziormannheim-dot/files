// Nummerierung der Tagesordnung: TOPs 1, 2, 3 …, Unterpunkte 1.1, 1.2 … (SPEC.md 3.2).
// Wird bei jeder Änderung neu berechnet und nie gespeichert.

export type AgendaNode = { id: string; parentId: string | null; position: number };

export type NumberedItem<T> = T & { number: string; level: 0 | 1 };

export function numberAgenda<T extends AgendaNode>(items: T[]): NumberedItem<T>[] {
  const byPos = (a: T, b: T) => a.position - b.position;
  const top = items.filter((i) => !i.parentId).sort(byPos);
  const out: NumberedItem<T>[] = [];
  top.forEach((item, i) => {
    const n = String(i + 1);
    out.push({ ...item, number: n, level: 0 });
    items
      .filter((c) => c.parentId === item.id)
      .sort(byPos)
      .forEach((child, j) => out.push({ ...child, number: `${n}.${j + 1}`, level: 1 }));
  });
  return out;
}

/** Nummer eines einzelnen TOPs (oder "" wenn unbekannt). */
export function agendaNumberOf(items: AgendaNode[], id: string): string {
  return numberAgenda(items).find((i) => i.id === id)?.number ?? "";
}
