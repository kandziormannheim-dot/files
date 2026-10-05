import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { User } from "@prisma/client";
import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { numberAgenda } from "@/lib/agenda";
import { formatDate, formatDateLong, formatTimeShort } from "@/lib/dates";
import { MEETING_TYPE_LABELS, meetingTitle } from "@/lib/meetings";
import { formToObject, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { saveFile, deleteStoredFile } from "@/server/files";
import { getMeeting } from "./meetings";
import { getSettings } from "./settings";
import { requiredForQuorum } from "./statute";

// Sitzungspräsentation (PowerPoint) im CDU-Corporate-Design als roter Faden für die Sitzungsleitung:
// Titel, Tagesordnung, je TOP eine Folie, Abschluss. Vermerke der Sitzungsleitung stehen in den Notizen.

type Actor = Pick<User, "id" | "role">;

/** Sitzungsleitung = wer Sitzungen verwalten, einladen oder protokollieren darf. */
export function canLeadMeeting(actor: Pick<User, "role">) {
  return can(actor.role, "meeting.manage") || can(actor.role, "invitation.send") || can(actor.role, "minutes.edit");
}

// CDU-CI (CDU Manual 2023)
const C = { cadenabbia: "52B7C1", rhoendorf: "2D3C4B", schwarz: "1B191D", weiss: "FFFFFF", tint10: "EEF8F9", tint25: "D4EDF0", grau: "818A93" };
const FONT = "Arial"; // auf jedem Rechner vorhanden; Inter wird von PowerPoint ohne Installation ersetzt

let logoCache: string | null = null;
async function logoPng(): Promise<string> {
  if (logoCache) return logoCache;
  const svg = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", "cdu-logo.svg"));
  const png = await sharp(svg, { density: 300 }).resize({ width: 1200 }).png().toBuffer();
  logoCache = `image/png;base64,${png.toString("base64")}`;
  return logoCache;
}

/** Hinweise für die Notizen, abhängig von Art und Titel des TOPs. */
async function autoNotes(item: { kind: string; title: string }, ctx: { eligible: number; required: number; meetingStart: Date }) {
  const t = item.title.toLowerCase();
  const notes: string[] = [];
  if (t.includes("beschlussfähig")) {
    notes.push(
      `Beschlussfähigkeit feststellen: ${ctx.eligible} Stimmberechtigte – beschlussfähig ab ${ctx.required} Anwesenden (Anwesenheitsliste im Tool).`,
      "Ordnungsgemäße Ladung feststellen (Ladungsfrist 7 Tage per E-Mail, LV-Satzung § 50 Abs. 3).",
    );
  }
  if (t.includes("tagesordnung") && t.includes("beschluss")) notes.push("Ergänzungs- oder Änderungswünsche zur Tagesordnung? Abstimmung: Ja / Nein / Enthaltung.");
  if (item.kind === "PROTOKOLLGENEHMIGUNG" || (t.includes("protokoll") && t.includes("beschluss")))
    notes.push("Änderungswünsche zum Protokoll? Abstimmung über die Genehmigung: Ja / Nein / Enthaltung.");
  if (item.kind === "AUFGABENBERICHT") {
    const tasks = await db.task.findMany({ where: { status: { not: "ERLEDIGT" } }, orderBy: { dueDate: "asc" }, take: 15 });
    if (tasks.length) notes.push("Offene Aufgaben:", ...tasks.map((x) => `– ${x.title}${x.dueDate ? ` (bis ${formatDate(x.dueDate)})` : ""}`));
  }
  if (item.kind === "TERMINE" || t === "termine") {
    const until = new Date(ctx.meetingStart.getTime() + 90 * 86_400_000);
    const [actions, meetings] = await Promise.all([
      db.action.findMany({ where: { startsAt: { gt: ctx.meetingStart, lt: until }, status: { not: "ABGESAGT" } }, orderBy: { startsAt: "asc" }, take: 10 }),
      db.meeting.findMany({ where: { startsAt: { gt: ctx.meetingStart, lt: until }, status: { notIn: ["ABGESAGT", "AUFGEHOBEN"] } }, orderBy: { startsAt: "asc" }, take: 5 }),
    ]);
    const lines = [
      ...meetings.map((m) => ({ d: m.startsAt, s: `${formatDate(m.startsAt)} ${meetingTitle(m).replace(/ am \d\d\.\d\d\.\d{4}$/, "")}` })),
      ...actions.map((a) => ({ d: a.startsAt, s: `${formatDate(a.startsAt)} ${a.title}` })),
    ].sort((a, b) => a.d.getTime() - b.d.getTime());
    if (lines.length) notes.push("Termine aus dem Tool (nächste 90 Tage):", ...lines.map((l) => `– ${l.s}`));
  }
  return notes;
}

export async function buildMeetingPresentation(actor: Actor, meetingId: string): Promise<{ data: Buffer; filename: string }> {
  assertCan(actor, "read");
  if (!canLeadMeeting(actor)) throw new ForbiddenError();
  const meeting = await getMeeting(actor, meetingId);
  const settings = await getSettings();
  const eligible = await db.user.count({ where: { active: true, votingRight: "STIMMBERECHTIGT" } });
  const required = requiredForQuorum(eligible, settings.meeting.quorumRule);
  const agenda = numberAgenda(meeting.agendaItems);
  const tops = agenda.filter((i) => i.level === 0);
  const logo = await logoPng();
  const art = MEETING_TYPE_LABELS[meeting.type].art;
  const footerText = `${settings.ov.name ? `CDU ${settings.ov.name}` : "CDU"} · ${art.charAt(0).toUpperCase()}${art.slice(1)} am ${formatDate(meeting.startsAt)}`;

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13,33 × 7,5 Zoll
  pres.author = "OV-Management CDU Seckenheim-Friedrichsfeld";
  pres.company = "CDU Seckenheim-Friedrichsfeld";
  pres.title = meetingTitle(meeting);
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

  // Inhaltslayout: weiß, Logo unten rechts auf Weiß, Fußzeile und Foliennummer
  pres.defineSlideMaster({
    title: "CDU Inhalt",
    background: { color: C.weiss },
    objects: [
      { image: { data: logo, x: 11.55, y: 6.78, w: 1.3, h: 0.373 } },
      { text: { text: footerText, options: { x: 0.6, y: 6.85, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: C.grau, margin: 0 } } },
    ],
    slideNumber: { x: 10.6, y: 6.85, w: 0.7, h: 0.3, fontFace: FONT, fontSize: 10, color: C.grau, align: "right" },
  });

  // 1 Titelfolie: Cadenabbia-Fläche, Logo auf weißem Feld, Headline weiß auf Rhöndorf-Feld (Variante A)
  const title = pres.addSlide();
  title.background = { color: C.cadenabbia };
  title.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.55, w: 2.9, h: 1.05, fill: { color: C.weiss }, line: { color: C.weiss } });
  title.addImage({ data: logo, x: 0.8, y: 0.72, w: 2.5, h: 0.717 });
  title.addShape(pres.ShapeType.rect, { x: 0.6, y: 2.45, w: 9.6, h: 2.6, fill: { color: C.rhoendorf }, line: { color: C.rhoendorf } });
  title.addText(art.charAt(0).toUpperCase() + art.slice(1), { x: 0.95, y: 2.65, w: 9, h: 1.1, fontFace: FONT, fontSize: 44, bold: true, color: C.weiss, margin: 0, isTextBox: true });
  title.addText(
    [
      { text: `${formatDateLong(meeting.startsAt)}, ${formatTimeShort(meeting.startsAt)} Uhr`, options: { breakLine: true } },
      { text: meeting.location || (meeting.onlineUrl ? "Online" : "") },
    ],
    { x: 0.95, y: 3.8, w: 9, h: 1.05, fontFace: FONT, fontSize: 20, color: C.weiss, margin: 0, valign: "top", isTextBox: true },
  );
  title.addText(settings.ov.nameLang, { x: 0.6, y: 6.6, w: 10, h: 0.4, fontFace: FONT, fontSize: 14, color: C.rhoendorf, margin: 0, isTextBox: true });
  title.addNotes(
    [
      "Begrüßung, Dank für das Kommen.",
      `Stimmberechtigt: ${eligible} – beschlussfähig ab ${required} Anwesenden.`,
      meeting.chairNote ? `Sitzungsleitung: ${meeting.chairNote}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // 2 Tagesordnung: bis 10 TOPs groß in einer Spalte, sonst zwei Spalten à 10 (ggf. mehrere Folien)
  const perSlide = 20;
  for (let page = 0; page * perSlide < tops.length; page++) {
    const s = pres.addSlide({ masterName: "CDU Inhalt" });
    s.addText(page ? "Tagesordnung (Fortsetzung)" : "Tagesordnung", { x: 0.6, y: 0.45, w: 12, h: 0.8, fontFace: FONT, fontSize: 36, bold: true, color: C.rhoendorf, margin: 0, isTextBox: true });
    const chunk = tops.slice(page * perSlide, page * perSlide + perSlide);
    const single = chunk.length <= 10;
    const cols = single ? [chunk] : [chunk.slice(0, 10), chunk.slice(10, 20)];
    const size = single ? (chunk.length <= 7 ? 22 : 18) : 15;
    cols.forEach((col, ci) => {
      if (!col.length) return;
      // Tabelle statt Tabulator: Nummern und Themen stehen in jedem Programm sauber untereinander
      const rows: PptxGenJS.TableRow[] = col.map((t) => {
        const off = t.status === "ABGESETZT";
        return [
          { text: `TOP ${t.number}`, options: { bold: true, color: off ? C.grau : C.rhoendorf } },
          { text: `${t.title}${off ? " (abgesetzt)" : ""}`, options: { color: off ? C.grau : C.schwarz } },
        ];
      });
      const numW = single ? 1.5 : 1.15;
      const w = single ? 12.1 : 5.9;
      s.addTable(rows, {
        x: 0.6 + ci * 6.2,
        y: 1.55,
        w,
        colW: [numW, w - numW],
        fontFace: FONT,
        fontSize: size,
        valign: "top",
        margin: [single ? 4 : 2, 4, single ? 4 : 2, 0],
        border: { type: "none" },
      });
    });
    s.addNotes("Tagesordnung vorstellen und Änderungswünsche abfragen.");
  }

  // 3 Je TOP eine Folie
  for (const top of tops) {
    const s = pres.addSlide({ masterName: "CDU Inhalt" });
    const subs = agenda.filter((c) => c.parentId === top.id);
    const off = top.status === "ABGESETZT";
    s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 0.5, w: 1.8, h: 0.62, fill: { color: off ? C.grau : C.cadenabbia }, line: { color: off ? C.grau : C.cadenabbia }, rectRadius: 0.12 });
    s.addText(`TOP ${top.number}`, { x: 0.6, y: 0.5, w: 1.8, h: 0.62, fontFace: FONT, fontSize: 18, bold: true, color: C.rhoendorf, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(`${top.number} / ${tops.length}`, { x: 10.8, y: 0.5, w: 2, h: 0.62, fontFace: FONT, fontSize: 12, color: C.grau, align: "right", valign: "middle", margin: 0, isTextBox: true });
    s.addText(top.title + (off ? " (abgesetzt)" : ""), { x: 0.6, y: 1.35, w: 12.1, h: 1.5, fontFace: FONT, fontSize: 36, bold: true, color: C.rhoendorf, valign: "top", margin: 0, fit: "shrink", isTextBox: true });
    const body: PptxGenJS.TextProps[] = [];
    if (top.description) body.push({ text: top.description, options: { color: C.schwarz, breakLine: subs.length > 0, paraSpaceAfter: 10 } });
    subs.forEach((c, i) =>
      body.push({ text: `TOP ${c.number}  ${c.title}`, options: { bullet: true, color: C.schwarz, breakLine: i < subs.length - 1, paraSpaceAfter: 8 } }),
    );
    if (body.length) {
      s.addShape(pres.ShapeType.rect, { x: 0.6, y: 3.05, w: 12.1, h: 2.9, fill: { color: C.tint10 }, line: { color: C.tint10 } });
      s.addText(body, { x: 0.9, y: 3.25, w: 11.5, h: 2.5, fontFace: FONT, fontSize: 18, valign: "top", margin: 0, fit: "shrink", isTextBox: true });
    } else {
      // Roter Faden: Ausschnitt der Tagesordnung rund um den aktuellen TOP
      const idx = tops.indexOf(top);
      const from = Math.max(0, Math.min(idx - 2, tops.length - 5));
      const around = tops.slice(from, from + 5);
      s.addShape(pres.ShapeType.rect, { x: 0.6, y: 3.05, w: 12.1, h: 2.9, fill: { color: C.tint10 }, line: { color: C.tint10 } });
      s.addText(
        around.flatMap((t, i) => {
          const cur = t === top;
          const done = tops.indexOf(t) < idx;
          const color = cur ? C.rhoendorf : done ? C.grau : C.schwarz;
          return [
            { text: `TOP ${t.number}`, options: { bold: true, color } },
            { text: `\t${t.title}`, options: { bold: cur, color, breakLine: i < around.length - 1 } },
          ];
        }),
        { x: 0.9, y: 3.25, w: 11.5, h: 2.5, fontFace: FONT, fontSize: 18, valign: "top", margin: 0, paraSpaceAfter: 8, tabStops: [{ position: 1.3 }], isTextBox: true },
      );
    }
    const nextTop = tops[tops.indexOf(top) + 1];
    if (nextTop)
      s.addText(`Als Nächstes: TOP ${nextTop.number} ${nextTop.title}`, { x: 0.6, y: 6.2, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 12, color: C.grau, margin: 0, isTextBox: true });
    const notes = [
      ...(top.leaderNotes ? [top.leaderNotes] : []),
      ...subs.filter((c) => c.leaderNotes).map((c) => `TOP ${c.number}: ${c.leaderNotes}`),
      ...(await autoNotes(top, { eligible, required, meetingStart: meeting.startsAt })),
    ];
    s.addNotes(notes.join("\n\n") || "Keine Vermerke.");
  }

  // 4 Abschluss
  const next = await db.meeting.findFirst({
    where: { startsAt: { gt: meeting.startsAt }, status: { notIn: ["ABGESAGT", "AUFGEHOBEN"] } },
    orderBy: { startsAt: "asc" },
  });
  const end = pres.addSlide();
  end.background = { color: C.cadenabbia };
  end.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.55, w: 2.9, h: 1.05, fill: { color: C.weiss }, line: { color: C.weiss } });
  end.addImage({ data: logo, x: 0.8, y: 0.72, w: 2.5, h: 0.717 });
  end.addText("Vielen Dank!", { x: 0.6, y: 2.6, w: 12, h: 1.2, fontFace: FONT, fontSize: 54, bold: true, color: C.rhoendorf, margin: 0, isTextBox: true });
  end.addText(next ? `Nächste Sitzung: ${formatDateLong(next.startsAt)}, ${formatTimeShort(next.startsAt)} Uhr` : "Nächste Sitzung: Termin folgt", {
    x: 0.6, y: 3.9, w: 12, h: 0.6, fontFace: FONT, fontSize: 22, color: C.rhoendorf, margin: 0, isTextBox: true,
  });
  end.addNotes("Sitzung schließen, Uhrzeit für das Protokoll festhalten.");

  const data = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  const filename = `Praesentation-${meeting.startsAt.toISOString().slice(0, 10)}.pptx`;
  return { data, filename };
}

const notesSchema = z.record(z.string(), z.string().max(4000));

/** Vermerke je TOP speichern (Formularfelder note:<agendaItemId>). */
export async function saveLeaderNotes(actor: Actor, meetingId: string, formData: FormData) {
  if (!canLeadMeeting(actor)) throw new ForbiddenError();
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, include: { agendaItems: { select: { id: true, leaderNotes: true } } } });
  if (!meeting) throw new NotFoundError("Sitzung nicht gefunden.");
  const raw = Object.fromEntries(Object.entries(formToObject(formData)).filter(([k]) => k.startsWith("note:")).map(([k, v]) => [k.slice(5), String(v ?? "")]));
  const notes = notesSchema.parse(raw);
  const own = new Map(meeting.agendaItems.map((i) => [i.id, i.leaderNotes]));
  let changed = 0;
  await db.$transaction(async (tx) => {
    for (const [id, text] of Object.entries(notes)) {
      if (!own.has(id) || own.get(id) === text.trim()) continue;
      await tx.agendaItem.update({ where: { id }, data: { leaderNotes: text.trim() } });
      changed++;
    }
    if (changed) await audit(tx, actor, "meeting.leaderNotes", "Meeting", meetingId, { changed });
  });
  return changed;
}

/** Präsentation erzeugen und als Anlage zum Protokoll ablegen (ersetzt eine frühere Fassung). */
export async function attachPresentationToMinutes(actor: Actor, meetingId: string) {
  const { data, filename } = await buildMeetingPresentation(actor, meetingId);
  const old = await db.attachment.findMany({ where: { ownerType: "Meeting", ownerId: meetingId, fileName: filename } });
  const rel = await saveFile(`attachments/meeting/${meetingId}`, filename, data);
  const a = await db.$transaction(async (tx) => {
    if (old.length) await tx.attachment.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    const created = await tx.attachment.create({
      data: {
        ownerType: "Meeting",
        ownerId: meetingId,
        filePath: rel,
        fileName: filename,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: data.length,
        uploadedById: actor.id,
        inMinutes: true,
      },
    });
    await audit(tx, actor, "minutes.presentationAttached", "Meeting", meetingId, { attachmentId: created.id });
    return created;
  });
  for (const o of old) await deleteStoredFile(o.filePath);
  return a;
}

/** Anlagen, die mit dem Protokoll verschickt werden. */
export function minutesAttachments(meetingId: string) {
  return db.attachment.findMany({ where: { ownerType: "Meeting", ownerId: meetingId, inMinutes: true }, orderBy: { createdAt: "asc" } });
}
