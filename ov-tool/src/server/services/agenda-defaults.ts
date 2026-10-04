// Vorbelegung der Tagesordnung aus der Vorlage „tagesordnung.standard“ (templates/standard-tagesordnung.json).
// Rein (ohne DB): bekommt die Daten, die es braucht, und liefert die TOP-Struktur.
import type { AgendaItemKind } from "@prisma/client";
import { renderText } from "@/server/templates/engine";

type TopDef = {
  titel?: string;
  position?: "start" | "ende";
  auto?: string;
  unterpunkte?: { titel: string }[];
  platzhalter?: string;
};

export type StandardAgenda = { tops: TopDef[] };

export type DraftAgendaItem = {
  title: string;
  kind: AgendaItemKind;
  description?: string;
  minutesToApproveId?: string;
  topicId?: string;
  children: { title: string }[];
};

export type AgendaContext = {
  /** Protokolle im Status „versendet“, die in der Sitzung genehmigt werden sollen */
  minutesToApprove: { id: string; meetingDate: Date }[];
  overdueTasks: { title: string; responsible: string; due: string }[];
  /** Stadtteil-Themen „für nächste Sitzung“ */
  topics: { id: string; title: string }[];
};

export function parseStandardAgenda(json: string): StandardAgenda {
  const parsed = JSON.parse(json) as Partial<StandardAgenda>;
  if (!parsed || !Array.isArray(parsed.tops)) throw new Error("Standard-Tagesordnung: Feld „tops“ fehlt");
  return { tops: parsed.tops };
}

export function buildDefaultAgenda(def: StandardAgenda, ctx: AgendaContext): DraftAgendaItem[] {
  const start: DraftAgendaItem[] = [];
  const end: DraftAgendaItem[] = [];
  let placeholderSeen = false;
  const specific: DraftAgendaItem[] = ctx.topics.map((t) => ({ title: t.title, kind: "NORMAL", topicId: t.id, children: [] }));

  for (const top of def.tops) {
    if (top.platzhalter !== undefined && !top.titel) {
      placeholderSeen = true;
      continue;
    }
    if (!top.titel) continue;
    const target = top.position === "ende" || (top.position === undefined && placeholderSeen) ? end : start;
    const children = (top.unterpunkte ?? []).map((u) => ({ title: u.titel }));

    if (top.auto === "nur_wenn_protokoll_versendet_und_nicht_genehmigt") {
      for (const m of ctx.minutesToApprove) {
        target.push({
          title: renderText(top.titel, { letztesProtokoll: { sitzungsdatum: m.meetingDate } }).trim(),
          kind: "PROTOKOLLGENEHMIGUNG",
          minutesToApproveId: m.id,
          children,
        });
      }
      continue;
    }
    if (top.auto === "nur_wenn_ueberfaellige_aufgaben") {
      if (!ctx.overdueTasks.length) continue;
      target.push({
        title: renderText(top.titel, {}).trim(),
        kind: "AUFGABENBERICHT",
        description: ctx.overdueTasks.map((t) => `${t.title} – ${t.responsible || "offen"} – ${t.due}`).join("\n"),
        children,
      });
      continue;
    }
    const kind: AgendaItemKind =
      target === end ? (/termin/i.test(top.titel) ? "TERMINE" : /sonstig/i.test(top.titel) ? "SONSTIGES" : "NORMAL") : "NORMAL";
    target.push({ title: renderText(top.titel, {}).trim(), kind, children });
  }
  return [...start, ...specific, ...end];
}
