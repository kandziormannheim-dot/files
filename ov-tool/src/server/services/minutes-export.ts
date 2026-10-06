import "server-only";
import type { Minutes, User } from "@prisma/client";
import { numberAgenda } from "@/lib/agenda";
import { formatDate } from "@/lib/dates";
import { asPoints, shortName } from "@/lib/minutes-text";
import { dueLabel, GROUP_LABEL } from "@/lib/tasks";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { appUrl, ovContext } from "@/server/ov";
import { renderDocumentPdf, wrapDocument } from "@/server/pdf/render";
import { renderHtml } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";
import { buildMinutesDocx } from "@/server/pdf/minutes-docx";
import { appendAnnexes } from "@/server/pdf/annexes";
import { asFormalities, asSigners, minutesMeetingInclude, resultText, type MinutesMeeting } from "./minutes";
import { meetingContext } from "./template-context";

const CIRCULATION_RESULT: Record<string, string> = {
  ANGENOMMEN: "angenommen",
  ABGELEHNT: "abgelehnt",
  UNZULAESSIG: "unzulässig (Widerspruch von mehr als einem Viertel)",
};

/** Umlaufbeschlüsse seit der letzten Sitzung (Formalia „Bericht über Umlaufbeschlüsse“). */
export async function circulationsToReport(meeting: { id: string; startsAt: Date }) {
  return db.circulation.findMany({
    where: {
      status: { in: ["ANGENOMMEN", "ABGELEHNT", "UNZULAESSIG"] },
      determinedAt: { lt: meeting.startsAt },
      OR: [{ reportedInMeetingId: meeting.id }, { reportedInMeetingId: null }],
    },
    orderBy: { number: "asc" },
  });
}

/** Kontext für protokoll.dokument (Platzhalter siehe templates/README.md). */
export async function minutesContext(minutes: Minutes, meeting: MinutesMeeting) {
  const sections = await db.minutesSection.findMany({ where: { minutesId: minutes.id } });
  const numbered = numberAgenda(meeting.agendaItems);
  const numberOf = (id: string | null) => numbered.find((n) => n.id === id)?.number ?? "";
  const formalities = asFormalities(minutes.formalities);

  const abgesetzt = numbered.filter((i) => i.status === "ABGESETZT");
  const vertagt = numbered.filter((i) => i.status === "VERTAGT");
  const toNotes = [
    ...abgesetzt.map((i) => `TOP ${i.number} „${i.title}“ wird abgesetzt.`),
    ...vertagt.map((i) => `TOP ${i.number} „${i.title}“ wird vertagt.`),
  ].filter((n) => !formalities.tagesordnung.includes(n));
  const tagesordnung = [formalities.tagesordnung, ...toNotes].filter(Boolean).join(" ");

  const anwesenheit = [...meeting.attendances]
    .sort((a, b) => a.sortSnapshot - b.sortSnapshot || a.nameSnapshot.localeCompare(b.nameSnapshot))
    .map((a) => ({ name: a.nameSnapshot, funktion: a.functionSnapshot, status: a.presence ?? "NICHT_ANWESEND" }))
    .concat(
      meeting.extraAttendees
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [name, funktion] = l.split(/\s*[,;–-]\s+/, 2);
          return { name: name ?? l, funktion: funktion ?? "Gast", status: "ANWESEND" as const };
        }),
    );

  const anlagenListe = await minutesAnnexes(meeting.id, numbered);
  const abschnitte = numbered.map((item) => {
    const s = sections.find((x) => x.agendaItemId === item.id);
    let punkte = asPoints(s?.points);
    if (!punkte.length && item.status === "ABGESETZT") punkte = [{ text: "Der Tagesordnungspunkt wird abgesetzt.", unterpunkte: [] }];
    if (!punkte.length && item.status === "VERTAGT") punkte = [{ text: "Der Tagesordnungspunkt wird vertagt.", unterpunkte: [] }];
    return {
      topNummer: item.number,
      topTitel: item.title,
      punkte,
      ergebnis: s?.outcomeType && s.outcomeText ? { art: s.outcomeType, text: s.outcomeText } : undefined,
      notiz: item.minutesNote ?? "",
      anlagen: anlagenListe.filter((a) => a.agendaItemId === item.id).map((a) => ({ nummer: a.nummer, name: a.name })),
    };
  });

  const circs = await circulationsToReport(meeting);
  const anlagen = anlagenListe.map((a) => ({ nummer: a.nummer, name: a.name, top: a.top }));

  return {
    ov: await ovContext(),
    anlagen,
    sitzung: await meetingContext(meeting),
    tagesordnung: numbered.map((i) => ({ nummer: i.number, titel: i.title, ebene: i.level, status: i.status })),
    protokoll: {
      protokollfuehrung: minutes.recorderName,
      version: minutes.version,
      aenderungshinweis: minutes.version > 1 ? minutes.changeNote : "",
      link: `${appUrl()}/meetings/${meeting.id}/minutes`,
      formalia: { ...formalities, tagesordnung },
      abschnitte,
      unterzeichner: asSigners(minutes.signers),
    },
    anwesenheit,
    umlaufbeschluesse: circs.map((c) => ({ nummer: c.number, betreff: c.subject, ergebnisText: CIRCULATION_RESULT[c.status] ?? c.status })),
    beschluesse: meeting.resolutions.map((r) => ({ top: numberOf(r.agendaItemId), gegenstand: r.subject, ergebnisText: resultText(r) })),
    aufgaben: meeting.tasks.map((t, i) => ({
      nr: i + 1,
      titel: t.title,
      verantwortlich: [GROUP_LABEL[t.assigneeGroup], ...t.assignees.map((a) => shortName(a.user.name))].filter(Boolean).join(", "),
      frist: dueLabel(t),
    })),
  };
}

export type MinutesContext = Awaited<ReturnType<typeof minutesContext>>;

/**
 * Anlagen zum Protokoll, fortlaufend nummeriert: zuerst die Anhänge der TOPs in Reihenfolge der Tagesordnung,
 * danach weitere Anlagen der Sitzung (z. B. Sitzungspräsentation).
 */
export async function minutesAnnexes(meetingId: string, numbered?: { id: string; number: string }[]) {
  const files = await db.attachment.findMany({ where: { ownerType: "Meeting", ownerId: meetingId, inMinutes: true }, orderBy: { createdAt: "asc" } });
  const order = numbered ?? numberAgenda(await db.agendaItem.findMany({ where: { meetingId } }));
  const pos = (id: string | null) => (id ? order.findIndex((n) => n.id === id) : -1);
  const sorted = [
    ...files.filter((f) => f.agendaItemId && pos(f.agendaItemId) >= 0).sort((a, b) => pos(a.agendaItemId) - pos(b.agendaItemId) || a.createdAt.getTime() - b.createdAt.getTime()),
    ...files.filter((f) => !f.agendaItemId || pos(f.agendaItemId) < 0),
  ];
  return sorted.map((f, i) => ({
    nummer: i + 1,
    name: f.fileName,
    agendaItemId: f.agendaItemId,
    top: f.agendaItemId ? (order.find((n) => n.id === f.agendaItemId)?.number ?? "") : "",
    attachment: f,
  }));
}

async function load(minutesId: string) {
  const minutes = await db.minutes.findUnique({ where: { id: minutesId } });
  if (!minutes) throw new NotFoundError("Protokoll nicht gefunden.");
  const meeting = await db.meeting.findUniqueOrThrow({ where: { id: minutes.meetingId }, include: minutesMeetingInclude });
  return { minutes, meeting };
}

function fileBase(meeting: { startsAt: Date }, minutes: Minutes) {
  return `Protokoll-${meeting.startsAt.toISOString().slice(0, 10)}${minutes.version > 1 ? `-v${minutes.version}` : ""}`;
}

/** PDF ohne Audit (für Versand im Service). */
export async function renderMinutesPdf(minutesId: string) {
  const { minutes, meeting } = await load(minutesId);
  const ctx = await minutesContext(minutes, meeting);
  const { pdf: base, version } = await renderDocumentPdf("protokoll.dokument", ctx, `Protokoll ${formatDate(meeting.startsAt)}`);
  // PDF- und Bild-Anlagen werden ans Protokoll angehängt; andere Formate gehen als eigene Datei mit
  const annexes = await minutesAnnexes(meeting.id);
  const { pdf, merged } = await appendAnnexes(base, annexes.map((a) => ({ nummer: a.nummer, name: a.name, mimeType: a.attachment.mimeType, filePath: a.attachment.filePath })));
  return { pdf, version, filename: `${fileBase(meeting, minutes)}.pdf`, minutes, meeting, mergedAnnexIds: annexes.filter((a) => merged.includes(a.nummer)).map((a) => a.attachment.id) };
}

/** Download über die Oberfläche – wird im Audit-Log erfasst (SPEC.md 3.3 Vertraulichkeit). */
export async function downloadMinutes(actor: Pick<User, "id" | "role">, minutesId: string, format: "pdf" | "docx") {
  assertCan(actor, "read");
  if (format === "pdf") {
    const r = await renderMinutesPdf(minutesId);
    await audit(db, actor, "minutes.download", "Minutes", minutesId, { format });
    return { data: r.pdf, filename: r.filename, contentType: "application/pdf" };
  }
  const { minutes, meeting } = await load(minutesId);
  const ctx = await minutesContext(minutes, meeting);
  const data = await buildMinutesDocx(ctx);
  await audit(db, actor, "minutes.download", "Minutes", minutesId, { format });
  return {
    data,
    filename: `${fileBase(meeting, minutes)}.docx`,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

/** HTML-Vorschau für die Leseansicht (gleiche Vorlage wie das PDF). */
export async function minutesPreviewHtml(actor: Pick<User, "id" | "role">, minutesId: string) {
  assertCan(actor, "read");
  const { minutes, meeting } = await load(minutesId);
  const ctx = await minutesContext(minutes, meeting);
  const { source } = await getTemplateSource("protokoll.dokument");
  return wrapDocument(renderHtml(source, ctx), "Protokoll", { screen: true });
}
