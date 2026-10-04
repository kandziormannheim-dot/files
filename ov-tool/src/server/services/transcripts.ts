import "server-only";
import path from "node:path";
import { TranscriptSource, type User } from "@prisma/client";
import mammoth from "mammoth";
import { numberAgenda } from "@/lib/agenda";
import { formatDate, parseDateInput } from "@/lib/dates";
import { meetingTitle, PRESENCE_LABELS } from "@/lib/meetings";
import { AUDIO_EXTENSIONS, normalizeTranscript, parseVtt, TEXT_EXTENSIONS } from "@/lib/transcript-text";
import { formToObject, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { absoluteStoredPath, deleteStoredFile, readStoredFile, saveFile } from "@/server/files";
import { enqueue } from "@/server/jobs/queue";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { aiConfigured, draftSchema, generateDraft, type MinutesDraft } from "./ai-draft";
import { addResolution, asFormalities, startMinutes } from "./minutes";
import { createTaskRecord } from "./tasks";

type Actor = Pick<User, "id" | "role" | "name">;

const MAX_AUDIO_BYTES = 300 * 1024 * 1024;
const MAX_TEXT_BYTES = 10 * 1024 * 1024;

export function listTranscripts(actor: Pick<User, "role">, meetingId: string) {
  assertCan(actor, "transcript.upload");
  return db.transcript.findMany({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
    include: { consentConfirmedBy: { select: { name: true } } },
  });
}

export async function getTranscript(actor: Pick<User, "role">, id: string) {
  assertCan(actor, "transcript.upload");
  const t = await db.transcript.findUnique({ where: { id }, include: { meeting: true } });
  if (!t) throw new NotFoundError("Transkript nicht gefunden.");
  return t;
}

const uploadSchema = z.object({
  source: z.enum(TranscriptSource),
  // Pflicht: „Alle Anwesenden haben der Aufnahme zugestimmt.“ (CLAUDE.md Regel 6)
  consent: z.literal("on", { error: "Bitte bestätigen, dass alle Anwesenden der Aufnahme zugestimmt haben." }),
});

/** Text aus hochgeladener Textdatei (VTT, TXT, DOCX). */
export async function extractText(fileName: string, data: Buffer): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".docx") return normalizeTranscript((await mammoth.extractRawText({ buffer: data })).value);
  const text = data.toString("utf8");
  return normalizeTranscript(ext === ".vtt" || text.startsWith("WEBVTT") ? parseVtt(text) : text);
}

export async function uploadTranscript(actor: Actor, meetingId: string, formData: FormData) {
  assertCan(actor, "transcript.upload");
  const v = uploadSchema.parse(formToObject(formData));
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError("Sitzung nicht gefunden.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Bitte eine Datei auswählen.");
  const ext = path.extname(file.name).toLowerCase();
  const isAudio = AUDIO_EXTENSIONS.includes(ext);
  if (!isAudio && !TEXT_EXTENSIONS.includes(ext)) {
    throw new UserError(`Nicht unterstütztes Format. Erlaubt: ${[...AUDIO_EXTENSIONS, ...TEXT_EXTENSIONS].join(", ")}`);
  }
  if (file.size > (isAudio ? MAX_AUDIO_BYTES : MAX_TEXT_BYTES)) throw new UserError("Die Datei ist zu groß.");
  const data = Buffer.from(await file.arrayBuffer());

  let text: string | null = null;
  let filePath: string | null = null;
  if (isAudio) {
    filePath = await saveFile(`audio/${meetingId}`, file.name, data);
  } else {
    text = await extractText(file.name, data);
    if (!text) throw new UserError("Die Datei enthält keinen lesbaren Text.");
  }
  const t = await db.$transaction(async (tx) => {
    const created = await tx.transcript.create({
      data: {
        meetingId,
        source: v.source,
        originalName: file.name.slice(0, 200),
        mimeType: file.type.slice(0, 100),
        filePath,
        text,
        status: isAudio ? "HOCHGELADEN" : "TRANSKRIBIERT",
        consentConfirmedById: actor.id,
        consentConfirmedAt: new Date(),
      },
    });
    await audit(tx, actor, "transcript.upload", "Transcript", created.id, {
      meetingId,
      source: v.source,
      audio: isAudio,
      consent: true,
    });
    return created;
  });
  if (isAudio) await enqueue("transcribe", { transcriptId: t.id });
  else if (aiConfigured()) await requestDraft(actor, t.id);
  return t;
}

/** Audio → Text mit faster-whisper auf dem eigenen Server. Audio wird danach sofort gelöscht. */
export async function transcribe(transcriptId: string) {
  const t = await db.transcript.findUnique({ where: { id: transcriptId } });
  if (!t?.filePath) return;
  const url = (process.env.WHISPER_URL || "http://whisper:9000").replace(/\/$/, "");
  await db.transcript.update({ where: { id: t.id }, data: { status: "TRANSKRIPTION", progress: 10, error: "" } });
  try {
    const audio = await readStoredFile(t.filePath);
    const body = new FormData();
    body.append("audio_file", new Blob([new Uint8Array(audio)], { type: t.mimeType || "application/octet-stream" }), t.originalName);
    const res = await fetch(`${url}/asr?task=transcribe&language=de&output=txt&encode=true`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(6 * 3600_000),
    });
    if (!res.ok) throw new Error(`Whisper antwortet mit ${res.status}`);
    const text = normalizeTranscript(await res.text());
    await db.transcript.update({
      where: { id: t.id },
      data: { text, status: "TRANSKRIBIERT", progress: 100, filePath: null, audioDeletedAt: new Date() },
    });
    await deleteStoredFile(t.filePath);
    await audit(db, null, "transcript.transcribed", "Transcript", t.id, { chars: text.length, audioDeleted: true });
    if (aiConfigured()) await enqueue("ai-draft", { transcriptId: t.id });
  } catch (err) {
    console.error("[whisper]", err);
    await db.transcript.update({
      where: { id: t.id },
      data: { status: "FEHLER", error: `Transkription fehlgeschlagen: ${(err as Error).message}`.slice(0, 500) },
    });
  }
}

export async function requestDraft(actor: Actor, transcriptId: string) {
  assertCan(actor, "transcript.upload");
  if (!aiConfigured()) throw new UserError("Die Claude API ist nicht eingerichtet (ANTHROPIC_API_KEY).");
  const t = await db.transcript.findUnique({ where: { id: transcriptId } });
  if (!t?.text) throw new UserError("Es liegt noch kein Transkripttext vor.");
  await db.transcript.update({ where: { id: t.id }, data: { status: "ENTWURF_LAEUFT", error: "" } });
  await audit(db, actor, "transcript.draftRequested", "Transcript", t.id);
  await enqueue("ai-draft", { transcriptId: t.id });
}

/** Erzeugt den Entwurf (Job „ai-draft“) und benachrichtigt die hochladende Person. */
export async function createDraft(transcriptId: string) {
  const t = await db.transcript.findUnique({
    where: { id: transcriptId },
    include: {
      consentConfirmedBy: true,
      meeting: { include: { agendaItems: true, attendances: true } },
    },
  });
  if (!t?.text) return;
  await db.transcript.update({ where: { id: t.id }, data: { status: "ENTWURF_LAEUFT", error: "" } });
  try {
    const draft = await generateDraft({
      agenda: numberAgenda(t.meeting.agendaItems).map((i) => ({ number: i.number, title: i.title })),
      attendance: [...t.meeting.attendances]
        .sort((a, b) => a.sortSnapshot - b.sortSnapshot)
        .map((a) => ({ name: a.nameSnapshot, funktion: a.functionSnapshot, status: a.presence ? PRESENCE_LABELS[a.presence] : "unbekannt" })),
      transcript: t.text,
    });
    await db.transcript.update({ where: { id: t.id }, data: { draft, draftCreatedAt: new Date(), status: "ENTWURF_FERTIG" } });
    await audit(db, null, "transcript.draftCreated", "Transcript", t.id, {
      sections: draft.abschnitte.length,
      resolutions: draft.beschluesse.length,
      tasks: draft.aufgaben.length,
    });
    const user = t.consentConfirmedBy;
    if (user?.active) {
      const mail = await renderMail("transkript.fertig", {
        empfaenger: { name: user.name },
        transkript: { sitzung: meetingTitle(t.meeting), link: `${appUrl()}/meetings/${t.meetingId}/transcripts/${t.id}` },
      });
      await queueMail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html });
    }
  } catch (err) {
    console.error("[ai-draft]", err);
    await db.transcript.update({
      where: { id: t.id },
      data: { status: "FEHLER", error: `Entwurf fehlgeschlagen: ${(err as Error).message}`.slice(0, 500) },
    });
  }
}

export function parseStoredDraft(json: unknown): MinutesDraft | null {
  const r = draftSchema.safeParse(json);
  return r.success ? r.data : null;
}

export type ApplySummary = { sections: number; resolutions: number; tasks: number; errors: string[] };

/**
 * Übernimmt einen Entwurf in das Protokoll. Stichpunkte und Formalia nur in leere Felder (oder überschreiben, wenn
 * gewählt); Beschlüsse und Aufgaben nur die ausdrücklich ausgewählten (CLAUDE.md Regel 7).
 */
export async function applyDraft(actor: Actor, transcriptId: string, formData: FormData): Promise<ApplySummary> {
  assertCan(actor, "minutes.edit");
  const t = await db.transcript.findUnique({ where: { id: transcriptId }, include: { meeting: { include: { agendaItems: true } } } });
  if (!t) throw new NotFoundError("Transkript nicht gefunden.");
  const draft = parseStoredDraft(t.draft);
  if (!draft) throw new UserError("Kein gültiger Entwurf vorhanden.");
  const overwrite = formData.get("overwrite") === "on";
  const selectedResolutions = new Set(formData.getAll("resolution[]").map(String));
  const selectedTasks = new Set(formData.getAll("task[]").map(String));

  const minutes = await startMinutes(actor, t.meetingId);
  if (minutes.status !== "ENTWURF") throw new UserError("Das Protokoll ist bereits versendet.");
  const numbered = numberAgenda(t.meeting.agendaItems);
  const itemFor = (nr: string | null) => numbered.find((i) => i.number === nr?.replace(/^TOP\s*/i, "").trim());
  const summary: ApplySummary = { sections: 0, resolutions: 0, tasks: 0, errors: [] };

  await db.$transaction(async (tx) => {
    const sections = await tx.minutesSection.findMany({ where: { minutesId: minutes.id } });
    for (const a of draft.abschnitte) {
      const item = itemFor(a.topNummer);
      if (!item) {
        summary.errors.push(`TOP ${a.topNummer} gibt es in der Tagesordnung nicht.`);
        continue;
      }
      const existing = sections.find((s) => s.agendaItemId === item.id);
      const empty = !existing || (Array.isArray(existing.points) && existing.points.length === 0 && !existing.outcomeText);
      if (!empty && !overwrite) continue;
      const data = {
        points: a.punkte.map((p) => ({ text: p.text, unterpunkte: p.unterpunkte })),
        outcomeType: a.ergebnis?.art ?? null,
        outcomeText: a.ergebnis?.text ?? "",
      };
      await tx.minutesSection.upsert({
        where: { minutesId_agendaItemId: { minutesId: minutes.id, agendaItemId: item.id } },
        create: { minutesId: minutes.id, agendaItemId: item.id, ...data },
        update: data,
      });
      if (item.status === "OFFEN") await tx.agendaItem.update({ where: { id: item.id }, data: { status: a.status } });
      summary.sections += 1;
    }
    const f = asFormalities(minutes.formalities);
    const pick = (cur: string, next: string | null) => (overwrite ? next || cur : cur || next || "");
    await tx.minutes.update({
      where: { id: minutes.id },
      data: {
        formalities: {
          eroeffnung: pick(f.eroeffnung, draft.formalia.eroeffnung),
          wiedereroeffnung: pick(f.wiedereroeffnung, draft.formalia.wiedereroeffnung),
          tagesordnung: pick(f.tagesordnung, draft.formalia.tagesordnung),
          letztesProtokoll: pick(f.letztesProtokoll, draft.formalia.letztesProtokoll),
        },
        aiUncertainties: [...draft.unsicherheiten, ...draft.verschiedenes.map((v) => `Ohne passenden TOP: ${v}`)],
      },
    });
  });

  for (const [i, r] of draft.beschluesse.entries()) {
    if (!selectedResolutions.has(String(i))) continue;
    const item = itemFor(r.topNummer);
    if (!item) {
      summary.errors.push(`Beschluss „${r.gegenstand}“: TOP ${r.topNummer} unbekannt.`);
      continue;
    }
    const isBeschluss = ["ANGENOMMEN_EINSTIMMIG", "ANGENOMMEN_MEHRHEITLICH", "ABGELEHNT"].includes(r.ergebnisart);
    const fd = new FormData();
    fd.set("subject", r.gegenstand);
    fd.set("kind", isBeschluss ? "BESCHLUSS" : "ERGEBNIS");
    fd.set("resultType", r.ergebnisart);
    if (isBeschluss && r.ja !== null) {
      fd.set("votesYes", String(r.ja));
      fd.set("votesNo", String(r.nein ?? 0));
      fd.set("votesAbstain", String(r.enthaltung ?? 0));
    }
    try {
      await addResolution(actor, minutes.id, item.id, fd);
      summary.resolutions += 1;
    } catch (err) {
      summary.errors.push(`Beschluss „${r.gegenstand}“: ${(err as Error).message}`);
    }
  }

  for (const [i, task] of draft.aufgaben.entries()) {
    if (!selectedTasks.has(String(i))) continue;
    const assignee = String(formData.get(`taskAssignee-${i}`) ?? "");
    const item = itemFor(task.topNummer);
    await db.$transaction(async (tx) => {
      await createTaskRecord(tx, actor, {
        title: task.titel,
        assigneeGroup: assignee === "VORSTAND" || assignee === "ALLE" ? assignee : "KEINE",
        assigneeIds: assignee && assignee !== "VORSTAND" && assignee !== "ALLE" ? [assignee] : [],
        dueDate: task.fristDatum ? parseDateInput(task.fristDatum) : null,
        dueText: task.fristDatum ? "" : (task.fristText ?? ""),
        meetingId: t.meetingId,
        agendaItemId: item?.id ?? null,
      });
    });
    summary.tasks += 1;
  }

  await db.$transaction(async (tx) => {
    await tx.transcript.update({ where: { id: t.id }, data: { draftAppliedAt: new Date() } });
    await audit(tx, actor, "transcript.draftApplied", "Transcript", t.id, { ...summary, overwrite });
  });
  return summary;
}

/** Transkript sofort löschen (Text und ggf. Audio). */
export async function deleteTranscript(actor: Actor, id: string) {
  const t = await getTranscript(actor, id);
  await deleteStoredFile(t.filePath);
  await db.$transaction(async (tx) => {
    await tx.transcript.delete({ where: { id } });
    await audit(tx, actor, "transcript.delete", "Transcript", id, { meetingId: t.meetingId, date: formatDate(t.createdAt) });
  });
}

export { absoluteStoredPath };
