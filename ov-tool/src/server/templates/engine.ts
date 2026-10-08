import Handlebars from "handlebars";
import {
  formatDate,
  formatDateLong,
  formatMonthYear,
  formatTime,
  formatTimeShort,
  formatWeekday,
  type DateInput,
} from "@/lib/dates";

// Handlebars-Engine mit deutschen Datums-Helfern (templates/README.md).
// Datum und Uhrzeit kommen immer aus einem einzigen Feld und werden nur hier formatiert.

const ATTENDANCE_LABELS: Record<string, string> = {
  ANWESEND: "anwesend",
  ANWESEND_DIGITAL: "anwesend (digital)",
  ENTSCHULDIGT: "entschuldigt",
  NICHT_ANWESEND: "nicht anwesend",
};

const GROUP_LABELS: Record<string, string> = { VORSTAND: "Vorstand", ALLE: "alle" };

type DueLike = {
  frist?: DateInput;
  fristText?: string | null;
  fristDatum?: DateInput;
  dueDate?: DateInput;
  dueText?: string | null;
};

export function dueText(value: unknown): string {
  if (!value || typeof value !== "object") return typeof value === "string" ? value : formatDate(value as DateInput);
  const v = value as DueLike;
  const date = v.dueDate ?? v.fristDatum ?? (v.frist instanceof Date ? v.frist : undefined);
  if (date) return formatDate(date);
  return v.dueText ?? v.fristText ?? (typeof v.frist === "string" ? v.frist : "") ?? "";
}

export function personsText(value: unknown): string {
  if (typeof value === "string") return GROUP_LABELS[value] ?? value;
  if (!Array.isArray(value)) return "";
  return value
    .map((p) => (typeof p === "string" ? (GROUP_LABELS[p] ?? p) : ((p as { name?: string })?.name ?? "")))
    .filter(Boolean)
    .join(", ");
}

export const HELPER_NAMES = [
  "datum",
  "datumLang",
  "wochentag",
  "uhrzeit",
  "uhrzeitKurz",
  "monatJahr",
  "fristText",
  "personen",
  "statusText",
  "eq",
] as const;

function createInstance(escape: boolean) {
  const hb = Handlebars.create();
  const wrap = (fn: (v: DateInput) => string) => (v: unknown) => fn(v as DateInput);
  hb.registerHelper("datum", wrap(formatDate));
  hb.registerHelper("datumLang", wrap(formatDateLong));
  hb.registerHelper("wochentag", wrap(formatWeekday));
  hb.registerHelper("uhrzeit", wrap(formatTime));
  hb.registerHelper("uhrzeitKurz", wrap(formatTimeShort));
  hb.registerHelper("monatJahr", wrap(formatMonthYear));
  hb.registerHelper("fristText", (v: unknown) => dueText(v));
  hb.registerHelper("personen", (v: unknown) => personsText(v));
  hb.registerHelper("statusText", (v: unknown) => ATTENDANCE_LABELS[String(v)] ?? String(v ?? ""));
  hb.registerHelper("eq", function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
    return a === b ? options.fn(this) : options.inverse(this);
  });
  return { hb, compileOptions: { noEscape: !escape, strict: false } as CompileOptions };
}

const textEngine = createInstance(false);
const htmlEngine = createInstance(true);

export type ParsedTemplate = { meta: Record<string, string>; body: string };

/** Trennt den Front-Matter-Block (--- betreff: … ---) vom Inhalt. */
export function parseFrontMatter(source: string): ParsedTemplate {
  const normalized = source.replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  if (!m) return { meta: {}, body: normalized };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const value = line.slice(idx + 1).trim();
    // YAML-Schreibweise mit Anführungszeichen (betreff: "…: …") wie ohne behandeln
    meta[line.slice(0, idx).trim()] = /^"(.*)"$/.test(value) ? value.slice(1, -1) : value;
  }
  return { meta, body: normalized.slice(m[0].length) };
}

export function renderText(template: string, context: object): string {
  return textEngine.hb.compile(template, textEngine.compileOptions)(context);
}

export function renderHtml(template: string, context: object): string {
  return htmlEngine.hb.compile(template, htmlEngine.compileOptions)(context);
}

/** text = Klartext ohne Auszeichnung; raw = mit **fett**-Markierungen (zum Bearbeiten im Einladungsformular). */
export type RenderedMail = { subject: string; text: string; html: string; raw: string };

export function renderMailTemplate(source: string, context: object): RenderedMail {
  const { meta, body } = parseFrontMatter(source);
  const subject = renderText(meta.betreff ?? "", context).replace(/\s+/g, " ").trim();
  const raw = tidyText(renderText(body, context));
  return { subject, text: stripMarkup(raw), html: textToHtml(raw), raw };
}

/** **fett** im Klartext: Sternchen entfernen. */
export function stripMarkup(text: string): string {
  return normalizeNewlines(text).replace(/\*\*(.+?)\*\*/g, "$1");
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

const TOP_LINE = /^(\t| {4})?(TOP\s+\S+)(?:\t| {2,})(.*)$/;

/** Tagesordnung (Zeilen „TOP 1<Tab>Titel“, Unterpunkte mit führendem Tab) als ausgerichtete Tabelle. */
function agendaTableHtml(lines: string[]): string {
  const rows = lines
    .map((l) => {
      const m = TOP_LINE.exec(l)!;
      const sub = !!m[1];
      return `<tr><td style="width:${sub ? 56 : 72}px;padding:3px 12px 3px ${sub ? "16px" : "0"};white-space:nowrap;vertical-align:top;font-weight:700;color:#2d3c4b">${escapeHtml(m[2]!)}</td><td style="padding:3px 0;vertical-align:top">${inlineHtml(m[3]!)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 1em;border-collapse:collapse;font-size:15px">${rows}</table>`;
}

function inlineHtml(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#2d3c4b">$1</strong>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2d3c4b">$1</a>');
}

/** Überzählige Leerzeilen und Leerzeichen am Zeilenende entfernen. */
export function tidyText(text: string): string {
  return (
    text
      .split("\n")
      .map((l) => l.replace(/[ \t]+$/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Klartext-Mail → einfache HTML-Mail (Absätze, Zeilenumbrüche, klickbare Links). */
export function textToHtml(text: string): string {
  // Formulare liefern Zeilenumbrüche als CRLF – vereinheitlichen, sonst greifen Absatz- und TOP-Erkennung nicht
  const paragraphs = normalizeNewlines(text)
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      const lines = p.split("\n");
      if (lines.every((l) => TOP_LINE.test(l))) return agendaTableHtml(lines);
      const html = lines
        .map((l) => inlineHtml(l).replace(/^(\t| {4})/, "&nbsp;&nbsp;&nbsp;&nbsp;").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;"))
        .join("<br>");
      return `<p style="margin:0 0 1em">${html}</p>`;
    })
    .join("\n");
  return `<!doctype html><html lang="de"><body style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b191d;max-width:640px">${paragraphs}</body></html>`;
}

type PathNode = { type: string; original?: string; parts?: string[]; data?: boolean };

/**
 * Alle Platzhalter-Pfade einer Vorlage (für die Prüfung unbekannter Platzhalter, CLAUDE.md Konventionen).
 * Pfade innerhalb von #each werden mit dem Präfix der Liste und "[]" zurückgegeben, z. B. "tagesordnung[].nummer".
 */
export function extractPlaceholders(source: string): string[] {
  const { meta, body } = parseFrontMatter(source);
  const found = new Set<string>();
  const helpers = new Set<string>(HELPER_NAMES);
  const builtins = new Set(["if", "unless", "each", "with", "else", "this", "lookup", "log"]);

  const walk = (node: unknown, scope: string[]) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown> & { type?: string };
    const visitPath = (p: PathNode | undefined, sc: string[]) => {
      if (!p || p.type !== "PathExpression" || p.data) return;
      const original = p.original ?? "";
      if (original === "this" || original === "." || helpers.has(original) || builtins.has(original)) return;
      let path = original.replace(/^this\./, "");
      let scopeIdx = sc.length;
      while (path.startsWith("../")) {
        path = path.slice(3);
        scopeIdx -= 1;
      }
      const prefix = sc.slice(0, Math.max(0, scopeIdx)).join(".");
      found.add(prefix ? `${prefix}.${path}` : path);
    };
    const visitParams = (params: unknown[] | undefined, sc: string[]) => {
      for (const p of params ?? []) {
        const pn = p as PathNode & Record<string, unknown>;
        if (pn.type === "PathExpression") visitPath(pn, sc);
        else if (pn.type === "SubExpression") walk(pn, sc);
      }
    };

    switch (n.type) {
      case "Program":
        for (const s of (n.body as unknown[]) ?? []) walk(s, scope);
        return;
      case "MustacheStatement":
      case "SubExpression": {
        const path = n.path as PathNode;
        const params = n.params as unknown[];
        if (params?.length || helpers.has(path.original ?? "")) visitParams(params, scope);
        else visitPath(path, scope);
        return;
      }
      case "BlockStatement": {
        const path = n.path as PathNode;
        const params = n.params as unknown[];
        visitParams(params, scope);
        let inner = scope;
        if (path.original === "each" || path.original === "with") {
          const first = params?.[0] as PathNode | undefined;
          if (first?.type === "PathExpression") {
            const p = (first.original ?? "").replace(/^this\./, "");
            const base = scope.length ? `${scope.join(".")}.${p}` : p;
            inner = [path.original === "each" ? `${base}[]` : base];
          }
        }
        walk(n.program, inner);
        walk(n.inverse, scope);
        return;
      }
      default:
        return;
    }
  };

  for (const src of [meta.betreff ?? "", body]) walk(Handlebars.parse(src), []);
  return [...found].sort();
}

/**
 * Prüft, ob alle Platzhalter in der Whitelist stehen. Erlaubt sind exakte Pfade sowie
 * Pfade unterhalb eines erlaubten Präfixes, der mit ".*" endet (z. B. "aktion.*").
 */
export function findUnknownPlaceholders(source: string, allowed: readonly string[]): string[] {
  const exact = new Set(allowed.filter((a) => !a.endsWith(".*")));
  const prefixes = allowed.filter((a) => a.endsWith(".*")).map((a) => a.slice(0, -1));
  return extractPlaceholders(source).filter((p) => {
    if (exact.has(p)) return false;
    if (prefixes.some((pre) => p.startsWith(pre))) return false;
    // "liste.length" ist erlaubt, wenn die Liste erlaubt ist
    if (p.endsWith(".length")) {
      const list = p.slice(0, -7);
      if (exact.has(list) || [...exact].some((e) => e.startsWith(`${list}[]`))) return false;
    }
    return true;
  });
}
