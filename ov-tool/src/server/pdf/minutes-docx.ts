import "server-only";
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatDateLong, formatTime, formatDate } from "@/lib/dates";
import type { MinutesContext } from "@/server/services/minutes-export";

// DOCX mit derselben Struktur wie protokoll.dokument (für Nachbearbeitung in Word, SPEC.md 3.3).

const ACCENT = "52B7C1";
const LIGHT = "E6F4F5";
const STATUS: Record<string, string> = {
  ANWESEND: "anwesend",
  ANWESEND_DIGITAL: "anwesend (digital)",
  ENTSCHULDIGT: "entschuldigt",
  NICHT_ANWESEND: "nicht anwesend",
};

const p = (text: string, opts: { bold?: boolean; size?: number; after?: number; indent?: number } = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 80 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, font: "Inter" })],
  });

const labeled = (label: string, text: string) =>
  new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `${label}: `, bold: true, font: "Inter" }), new TextRun({ text, font: "Inter" })],
  });

const h2 = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    border: { bottom: { color: ACCENT, size: 12, style: BorderStyle.SINGLE, space: 2 } },
    children: [new TextRun({ text, bold: true, size: 23, font: "Inter", color: "1A1A1A" })],
  });

function table(header: string[] | null, rows: string[][], widths: number[]) {
  const cell = (text: string, head: boolean, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: head ? { type: ShadingType.CLEAR, fill: LIGHT, color: "auto" } : undefined,
      children: [p(text, { bold: head, after: 40 })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...(header ? [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, true, widths[i]!)) })] : []),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, false, widths[i]!)) })),
    ],
  });
}

export async function buildMinutesDocx(ctx: MinutesContext): Promise<Buffer> {
  const s = ctx.sitzung;
  const pr = ctx.protokoll;
  const f = pr.formalia;
  const quorum = s.wiederholungNachBeschlussunfaehigkeit
    ? "gegeben gemäß § 52 Abs. 3 LV-Satzung (erneute Einladung nach Beschlussunfähigkeit)"
    : s.beschlussfaehig
      ? `festgestellt durch ${s.feststellungDurch}`
      : "nicht gegeben – die Sitzung wurde gemäß § 52 Abs. 3 LV-Satzung aufgehoben";

  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: `Protokoll der ${s.artGenitiv}`, bold: true, size: 30, font: "Inter" })] }),
    p(ctx.ov.nameLang, { after: 200 }),
    ...(pr.aenderungshinweis ? [p(`Version ${pr.version} – ${pr.aenderungshinweis}`, { size: 16 })] : []),
    table(
      null,
      [
        ["Datum", formatDateLong(s.beginn)],
        ["Ort", [s.ort, s.onlineLink ? "online" : ""].filter(Boolean).join(" / ")],
        ["Beginn / Ende", `${formatTime(s.eroeffnetUm)} Uhr${s.unterbrechung ? ` (${s.unterbrechung})` : ""} bis ${formatTime(s.geschlossenUm)} Uhr`],
        ["Sitzungsleitung", s.sitzungsleitung],
        ["Protokollführung", pr.protokollfuehrung],
        ["Einladung vom", `${formatDate(s.einladungVom)}, ${s.einladungsweg}`],
      ],
      [28, 72],
    ),
    h2("Anwesenheit"),
    table(["Name", "Funktion", "Status"], ctx.anwesenheit.map((a) => [a.name, a.funktion, STATUS[a.status] ?? a.status]), [35, 40, 25]),
    h2("Formalia"),
    ...(f.eroeffnung ? [labeled("Eröffnung", f.eroeffnung)] : []),
    ...(f.wiedereroeffnung ? [labeled("Wiedereröffnung", f.wiedereroeffnung)] : []),
    labeled("Beschlussfähigkeit", `${quorum} (${s.quorumAnwesend} von ${s.quorumStimmberechtigt} stimmberechtigten Mitgliedern anwesend)`),
    ...(s.eilbeduerftig ? [labeled("Verkürzte Ladungsfrist", s.eilbeduerftigBegruendung)] : []),
    ...(ctx.umlaufbeschluesse.length
      ? [labeled("Umlaufbeschlüsse seit der letzten Sitzung", ctx.umlaufbeschluesse.map((u) => `Nr. ${u.nummer} „${u.betreff}“ – ${u.ergebnisText}`).join("; "))]
      : []),
    labeled("Tagesordnung", f.tagesordnung),
    ...(f.letztesProtokoll ? [labeled("Protokoll der letzten Sitzung", f.letztesProtokoll)] : []),
    h2("Verlauf der Sitzung"),
  ];

  for (const a of pr.abschnitte) {
    children.push(p(`TOP ${a.topNummer}    ${a.topTitel}`, { bold: true, after: 60 }));
    for (const pt of a.punkte) {
      children.push(p(`– ${pt.text}`, { indent: 720, after: 40 }));
      for (const u of pt.unterpunkte) children.push(p(`· ${u}`, { indent: 1080, after: 40 }));
    }
    if (a.notiz) children.push(p(`Notiz: ${a.notiz}`, { indent: 720, after: 40 }));
    if (a.anlagen.length) children.push(p(a.anlagen.map((x) => `Anlage ${x.nummer}: ${x.name}`).join("; "), { indent: 720, after: 40 }));
    if (a.ergebnis) children.push(p(`${a.ergebnis.art === "BESCHLUSS" ? "Beschluss:" : "Ergebnis:"} ${a.ergebnis.text}`, { bold: true, indent: 720 }));
  }

  if (ctx.beschluesse.length) {
    children.push(h2("Beschlüsse und Ergebnisse im Überblick"));
    children.push(table(["TOP", "Gegenstand", "Ergebnis"], ctx.beschluesse.map((b) => [b.top, b.gegenstand, b.ergebnisText]), [12, 53, 35]));
  }
  if (ctx.aufgaben.length) {
    children.push(h2("Aufgaben"));
    children.push(
      table(["Nr.", "Aufgabe", "Verantwortlich", "Frist"], ctx.aufgaben.map((t) => [String(t.nr), t.titel, t.verantwortlich, t.frist]), [8, 47, 25, 20]),
    );
  }
  children.push(p(""));
  if (ctx.anlagen.length) {
    children.push(labeled("Anlagen", ""));
    for (const x of ctx.anlagen) children.push(p(`Anlage ${x.nummer}: ${x.name}${x.top ? ` (zu TOP ${x.top})` : ""}`, { indent: 360, after: 40 }));
  }
  children.push(labeled("Ende der Sitzung", `${formatTime(s.geschlossenUm)} Uhr`));
  children.push(p("", { after: 600 }));
  children.push(
    table(
      null,
      [
        pr.unterzeichner.map(() => `${ctx.ov.ort}, ________________`),
        pr.unterzeichner.map(() => "\n\n_____________________________"),
        pr.unterzeichner.map((u) => `${u.name}\n${u.funktion}`),
      ],
      pr.unterzeichner.map(() => Math.floor(100 / Math.max(1, pr.unterzeichner.length))),
    ),
  );

  const doc = new Document({
    creator: "OV-Management",
    title: `Protokoll ${formatDate(s.beginn)}`,
    styles: { default: { document: { run: { font: "Inter", size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1400, bottom: 1400, left: 1418, right: 1247 } } }, children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
