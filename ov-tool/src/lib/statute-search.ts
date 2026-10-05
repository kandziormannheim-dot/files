// Volltextsuche über Statut der CDU Deutschlands und Satzung der CDU Baden-Württemberg.
// Läuft rein im Speicher – im Browser (offline) wie auf dem Server (Grundlage für den Frage-Antwort-Assistenten).
// Texte: src/data/statutes.json, erzeugt mit scripts/statute/parse.py aus den amtlichen PDFs.

export type StatuteAbsatz = { nr: string | null; text: string };
export type StatuteSection = { num: string; title: string; part: string | null; absaetze: StatuteAbsatz[] };
export type StatuteDocument = {
  id: string;
  title: string;
  short: string;
  level: "Bund" | "Land" | "Gesetz" | string;
  stand: string;
  source: string;
  sections: StatuteSection[];
};
export type StatuteData = { generated: string; documents: StatuteDocument[] };

export type StatuteHit = {
  docId: string;
  num: string;
  score: number;
  /** Index des am besten passenden Absatzes */
  absatz: number;
  terms: string[];
};

const SUPERSCRIPTS = /[⁰¹²³⁴⁵⁶⁷⁸⁹]/g;

/** Kleinschreibung, Umlaute gefaltet, hochgestellte Satznummern entfernt. */
export function normalize(text: string): string {
  return text
    .replace(SUPERSCRIPTS, " ")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9§ ]+/g, " ");
}

const STOPWORDS = new Set(
  "der die das den dem des ein eine einer eines einem einen und oder bzw auch als an auf aus bei bis durch fuer gegen in im ins mit nach ohne ueber um unter von vor zu zum zur ist sind wird werden wurde kann koennen muss muessen soll sollen darf duerfen wie was wer wann wo welche welcher welches wieviel viele es sie er ich wir ihr man nicht kein keine noch nur so dass ob gibt hat haben sein mein unser unsere unserem unseren dieser diese dieses jeder jede jedes alle mehr".split(
    " ",
  ),
);

/** Einfaches Stammformen-Kürzen für deutsche Endungen – reicht für Satzungsbegriffe. */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ["ungen", "innen", "heiten", "keiten", "ern", "en", "er", "es", "em", "e", "n", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) return word.slice(0, -suffix.length);
  }
  return word;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w) && w !== "§");
}

// Synonyme aus der Vereinspraxis → Begriffe der Satzung
const SYNONYMS: Record<string, string[]> = {
  ladungsfrist: ["einberufung", "frist", "einladung"],
  einladungsfrist: ["einberufung", "frist", "einladung"],
  quorum: ["beschlussfaehig"],
  beschlussfaehigkeit: ["beschlussfaehig"],
  umlaufbeschluss: ["umlaufverfahren"],
  umlauf: ["umlaufverfahren"],
  vorstandswahl: ["wahl", "vorstand"],
  wahl: ["wahl", "gewaehlt", "stimmzettel"],
  wahlen: ["wahl", "gewaehlt", "stimmzettel"],
  stichwahl: ["stichwahl", "wahlgang"],
  geheim: ["geheim", "stimmzettel"],
  amtszeit: ["wahlperiode"],
  protokoll: ["niederschrift", "beurkundung"],
  niederschrift: ["niederschrift", "protokoll"],
  mehrheit: ["mehrheit", "stimmen"],
  enthaltung: ["stimmenthaltung"],
  enthaltungen: ["stimmenthaltung"],
  frauenquote: ["frauen", "drittel"],
  quote: ["frauen", "drittel"],
  beitrag: ["mitgliedsbeitrag", "beitrag"],
  ausschluss: ["parteiausschluss", "ausgeschlossen"],
  austritt: ["austritt"],
  ortsverband: ["ortsverband", "stadtbezirks", "oertlich"],
  ov: ["ortsverband"],
  mitgliederversammlung: ["mitgliederversammlung", "hauptversammlung"],
  delegierte: ["delegiert", "vertreter"],
  kassenpruefer: ["rechnungspruef", "kassenpruef"],
  rechnungspruefer: ["rechnungspruef", "kassenpruef"],
  schatzmeister: ["schatzmeist", "kasse"],
  online: ["digital", "elektronisch", "virtuell"],
  digital: ["digital", "elektronisch", "virtuell"],
  videokonferenz: ["digital", "virtuell", "elektronisch"],
};

export type StatuteRef = { docId?: string; num: string; absatz?: string };

const DOC_ALIASES: [RegExp, string][] = [
  [/\b(lv[- ]?satzung|landessatzung|satzung( der)? cdu (bw|baden)|bw[- ]satzung|lv)\b/i, "lv-satzung"],
  [/\b(verfahrensordnung|verfo)\b/i, "lv-verfahrensordnung"],
  [/\b(finanzordnung|fino)\b/i, "lv-finanzordnung"],
  [/\b(go[- ]?cdu|geschaeftsordnung|geschäftsordnung)\b/i, "go-cdu"],
  [/\b(fbo|beitragsordnung)\b/i, "fbo"],
  [/\b(pgo|parteigerichtsordnung)\b/i, "pgo"],
  [/\b(dso|datenschutzordnung)\b/i, "dso"],
  [/\b(bfao)\b/i, "bfao"],
  [/\b(partg|parteiengesetz)\b/i, "partg"],
  [/\b(statut|bundesstatut)\b/i, "statut"],
];

/** Erkennt Fundstellen wie „§ 43 Statut“, „LV-Satzung § 57 Abs. 2“, „§ 52 Abs. 3 LV“. */
export function parseReference(query: string): StatuteRef | null {
  const m = query.match(/§\s*(\d+)\s*([a-z])?\b(?:\s*(?:abs\.?|absatz)\s*(\d+[a-z]?))?/i);
  if (!m) return null;
  let docId: string | undefined;
  for (const [re, id] of DOC_ALIASES) {
    if (re.test(query)) {
      docId = id;
      break;
    }
  }
  return { docId, num: m[1] + (m[2]?.toLowerCase() ?? ""), absatz: m[3] };
}

export function findSection(data: StatuteData, docId: string, num: string) {
  const doc = data.documents.find((d) => d.id === docId);
  const section = doc?.sections.find((s) => s.num === num);
  return doc && section ? { doc, section } : null;
}

export function citation(doc: Pick<StatuteDocument, "short">, section: Pick<StatuteSection, "num">, absatz?: string | null) {
  return `${doc.short} § ${section.num.replace(/([a-z])$/, " $1")}${absatz ? ` Abs. ${absatz}` : ""}`;
}

type IndexedSection = { docId: string; num: string; title: string; titleTokens: Set<string>; absaetze: string[][] };
const indexCache = new WeakMap<StatuteData, IndexedSection[]>();

function buildIndex(data: StatuteData): IndexedSection[] {
  const cached = indexCache.get(data);
  if (cached) return cached;
  const index = data.documents.flatMap((doc) =>
    doc.sections.map((s) => ({
      docId: doc.id,
      num: s.num,
      title: s.title,
      titleTokens: new Set(tokenize(s.title).map(stem)),
      absaetze: s.absaetze.map((a) => tokenize(a.text).map(stem)),
    })),
  );
  indexCache.set(data, index);
  return index;
}

// Für den Ortsverband gilt zuerst die Landessatzung, dann das Statut (Statut § 50); Gesetz und Nebenordnungen danach.
const DOC_WEIGHT: Record<string, number> = { "lv-satzung": 1.25, statut: 1.2, "go-cdu": 1, "lv-verfahrensordnung": 0.9 };

export function searchStatutes(
  data: StatuteData,
  query: string,
  opts: { docIds?: string[]; limit?: number } = {},
): StatuteHit[] {
  const limit = opts.limit ?? 20;
  const hits: StatuteHit[] = [];
  const ref = parseReference(query);
  if (ref) {
    for (const doc of data.documents) {
      if (ref.docId ? doc.id !== ref.docId : !["lv-satzung", "statut"].includes(doc.id)) continue;
      if (opts.docIds && !opts.docIds.includes(doc.id)) continue;
      const idx = doc.sections.findIndex((s) => s.num === ref.num);
      if (idx < 0) continue;
      const section = doc.sections[idx]!;
      const absatz = ref.absatz ? Math.max(0, section.absaetze.findIndex((a) => a.nr === ref.absatz)) : 0;
      hits.push({ docId: doc.id, num: section.num, score: 1000 - hits.length, absatz, terms: [] });
    }
  }
  const rest = query.replace(/§\s*\d+\s*[a-z]?\b(\s*(abs\.?|absatz)\s*\d+[a-z]?)?/gi, " ");
  const words = tokenize(rest).filter((w) => !DOC_ALIASES.some(([re]) => re.test(w)) || !ref);
  if (words.length === 0) return hits.slice(0, limit);

  // Jeder Suchbegriff ist eine Gruppe aus Stamm + Synonymen; Treffer zählen je Gruppe
  const groups = words.map((w) => [...new Set([stem(w), ...(SYNONYMS[w] ?? []).map(stem)])]);
  const terms = [...new Set(groups.flat())];
  const matches = (token: string, term: string) => token === term || (term.length >= 5 && token.startsWith(term)) || (term.length >= 7 && token.includes(term));

  for (const s of buildIndex(data)) {
    if (opts.docIds && !opts.docIds.includes(s.docId)) continue;
    if (hits.some((h) => h.docId === s.docId && h.num === s.num)) continue;
    let score = 0;
    let groupsHit = 0;
    let bestAbsatz = 0;
    let bestAbsatzScore = -1;
    const absatzScores = s.absaetze.map(() => 0);
    for (const group of groups) {
      let groupScore = 0;
      for (const term of group) {
        const primary = term === group[0] ? 1 : 0.5;
        for (const t of s.titleTokens) if (matches(t, term)) groupScore += 6 * primary;
        s.absaetze.forEach((tokens, i) => {
          let n = 0;
          for (const t of tokens) if (matches(t, term)) n++;
          if (n) {
            const v = Math.min(n, 4) * primary;
            absatzScores[i]! += v;
            groupScore += v;
          }
        });
      }
      if (groupScore > 0) groupsHit++;
      score += Math.log2(1 + groupScore);
    }
    if (groupsHit === 0) continue;
    absatzScores.forEach((v, i) => {
      if (v > bestAbsatzScore) {
        bestAbsatzScore = v;
        bestAbsatz = i;
      }
    });
    // Alle Begriffe gefunden ist deutlich besser als viele Treffer eines Begriffs
    score *= (groupsHit / groups.length) ** 2;
    score *= DOC_WEIGHT[s.docId] ?? 0.8;
    hits.push({ docId: s.docId, num: s.num, score, absatz: bestAbsatz, terms });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Markiert Suchbegriffe; liefert Teile für die Darstellung (ohne HTML). */
export function highlight(text: string, terms: string[]): { text: string; hit: boolean }[] {
  if (terms.length === 0) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  const re = /[A-Za-zÄÖÜäöüß0-9]+|[^A-Za-zÄÖÜäöüß0-9]+/g;
  for (const m of text.matchAll(re)) {
    const word = m[0];
    const n = stem(normalize(word).trim());
    const hit = /[A-Za-zÄÖÜäöüß]/.test(word) && n.length >= 2 && terms.some((t) => n === t || (t.length >= 5 && n.startsWith(t)) || (t.length >= 7 && n.includes(t)));
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += word;
    else parts.push({ text: word, hit });
  }
  return parts;
}

/** Ausschnitt rund um den ersten Treffer. */
export function snippet(text: string, terms: string[], length = 260): string {
  if (text.length <= length) return text;
  const parts = highlight(text, terms);
  let pos = 0;
  for (const p of parts) {
    if (p.hit) break;
    pos += p.text.length;
  }
  if (pos >= text.length) pos = 0;
  const start = Math.max(0, pos - 80);
  const cut = text.slice(start, start + length);
  return `${start > 0 ? "… " : ""}${cut.trim()}${start + length < text.length ? " …" : ""}`;
}
