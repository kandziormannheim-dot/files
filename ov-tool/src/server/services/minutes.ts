import "server-only";
import { OutcomeType, Presence, ResolutionResult, type Minutes, type Prisma, type User } from "@prisma/client";
import { numberAgenda } from "@/lib/agenda";
import { berlinParts, formatDate, formatTime, fromBerlin, parseDateTimeInput } from "@/lib/dates";
import { presenceFromResponse } from "@/lib/meetings";
import { checklistComplete, minutesChecklist, nextResolutionNumber } from "@/lib/minutes-checklist";
import { parsePoints } from "@/lib/minutes-text";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit, type DbClient } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { ensureAttendances, newToken } from "./meetings";
import { getSettings } from "./settings";
import { countsForQuorum, evaluateMajority, evaluateQuorum, votesExceedPresent } from "./statute";

type Actor = Pick<User, "id" | "role" | "name">;

export type Formalities = { eroeffnung: string; wiedereroeffnung: string; tagesordnung: string; letztesProtokoll: string };
export type Signer = { name: string; funktion: string };

export function asFormalities(json: unknown): Formalities {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return { eroeffnung: s("eroeffnung"), wiedereroeffnung: s("wiedereroeffnung"), tagesordnung: s("tagesordnung"), letztesProtokoll: s("letztesProtokoll") };
}

export function asSigners(json: unknown): Signer[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((s) => ({ name: String((s as Signer)?.name ?? ""), funktion: String((s as Signer)?.funktion ?? "") }))
    .filter((s) => s.name);
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

export const minutesMeetingInclude = {
  agendaItems: { orderBy: { position: "asc" }, include: { minutesToApprove: { include: { meeting: { select: { startsAt: true } } } } } },
  attendances: { include: { user: { select: { id: true, name: true, email: true, active: true } } } },
  resolutions: { orderBy: { number: "asc" } },
  tasks: {
    orderBy: { createdAt: "asc" },
    include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
  },
} satisfies Prisma.MeetingInclude;

export type MinutesMeeting = Prisma.MeetingGetPayload<{ include: typeof minutesMeetingInclude }>;

export async function loadMinutes(actor: Pick<User, "role">, meetingId: string) {
  assertCan(actor, "read");
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, include: minutesMeetingInclude });
  if (!meeting) throw new NotFoundError("Sitzung nicht gefunden.");
  const minutes = await db.minutes.findFirst({
    where: { meetingId, isCurrent: true },
    include: { sections: true, circulations: { orderBy: { initiatedAt: "desc" } } },
  });
  const versions = await db.minutes.findMany({
    where: { meetingId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true, changeNote: true, sentAt: true, approvedAt: true, isCurrent: true },
  });
  return { meeting, minutes, versions };
}

async function getEditable(actor: Actor, minutesId: string) {
  assertCan(actor, "minutes.edit");
  const minutes = await db.minutes.findUnique({ where: { id: minutesId }, include: { meeting: true } });
  if (!minutes) throw new NotFoundError("Protokoll nicht gefunden.");
  if (!minutes.isCurrent || minutes.status !== "ENTWURF") {
    throw new UserError("Versendete Protokolle sind gesperrt. Änderungen nur als neue Version.");
  }
  return minutes;
}

// ---------------------------------------------------------------------------
// Anlegen
// ---------------------------------------------------------------------------

export async function defaultSigners(actor: Actor): Promise<Signer[]> {
  const s = await getSettings();
  const [chair, deputy] = await Promise.all([
    s.ov.chairUserId ? db.user.findUnique({ where: { id: s.ov.chairUserId } }) : null,
    s.ov.deputyUserId ? db.user.findUnique({ where: { id: s.ov.deputyUserId } }) : null,
  ]);
  const signers: Signer[] = [];
  if (chair) signers.push({ name: chair.name, funktion: chair.functionTitle + (chair.id === actor.id ? " / Protokoll" : "") });
  if (chair?.id !== actor.id) signers.push({ name: actor.name, funktion: "Protokoll" });
  if (deputy && deputy.id !== actor.id && deputy.id !== chair?.id) signers.push({ name: deputy.name, funktion: deputy.functionTitle });
  return signers.slice(0, 2);
}

export async function startMinutes(actor: Actor, meetingId: string) {
  assertCan(actor, "minutes.edit");
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError("Sitzung nicht gefunden.");
  if (meeting.status === "ABGESAGT") throw new UserError("Für eine abgesagte Sitzung gibt es kein Protokoll.");
  const existing = await db.minutes.findFirst({ where: { meetingId, isCurrent: true } });
  if (existing) return existing;
  const settings = await getSettings();
  const chair = settings.ov.chairUserId ? await db.user.findUnique({ where: { id: settings.ov.chairUserId } }) : null;
  const signers = await defaultSigners(actor);
  return db.$transaction(async (tx) => {
    await ensureAttendances(tx, meetingId);
    // Anwesenheit aus den Zu-/Absagen vorbelegen (SPEC.md 3.3)
    const atts = await tx.attendance.findMany({ where: { meetingId, presence: null } });
    for (const a of atts) {
      const presence = presenceFromResponse(a.response, meeting.format);
      if (presence) await tx.attendance.update({ where: { id: a.id }, data: { presence } });
    }
    if (!meeting.chairNote && chair) {
      await tx.meeting.update({
        where: { id: meetingId },
        data: { chairNote: [chair.name, chair.functionTitle].filter(Boolean).join(", ") },
      });
    }
    const formalities: Formalities = {
      eroeffnung: "",
      wiedereroeffnung: "",
      tagesordnung: meeting.invitationSentAt ? `wie in der Einladung vom ${formatDate(meeting.invitationSentAt)}.` : "",
      letztesProtokoll: "",
    };
    const minutes = await tx.minutes.create({
      data: { meetingId, recorderName: actor.name, formalities, signers },
    });
    await audit(tx, actor, "minutes.start", "Minutes", minutes.id, { meetingId });
    return minutes;
  });
}

// ---------------------------------------------------------------------------
// Kopf, Formalia, Unterzeichner, Abschnitte
// ---------------------------------------------------------------------------

const timeField = z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{2}:\d{2}$/).optional());

/** Uhrzeit (HH:MM) am Sitzungstag in Berliner Zeit. */
function onMeetingDay(startsAt: Date, time: string | undefined): Date | null {
  if (!time) return null;
  const p = berlinParts(startsAt);
  const [h, m] = time.split(":").map(Number);
  return fromBerlin(p.year, p.month, p.day, h!, m!);
}

export async function saveHeader(actor: Actor, minutesId: string, formData: FormData) {
  const minutes = await getEditable(actor, minutesId);
  const v = z
    .object({
      chairNote: optionalText(300),
      recorderName: optionalText(200),
      openedTime: timeField,
      closedTime: timeField,
      interruptionNote: optionalText(300),
      extraAttendees: optionalText(2000),
    })
    .parse(formToObject(formData));
  const data = {
    chairNote: v.chairNote ?? "",
    interruptionNote: v.interruptionNote ?? "",
    extraAttendees: v.extraAttendees ?? "",
    openedAt: onMeetingDay(minutes.meeting.startsAt, v.openedTime),
    closedAt: onMeetingDay(minutes.meeting.startsAt, v.closedTime),
  };
  await db.$transaction(async (tx) => {
    await tx.meeting.update({ where: { id: minutes.meetingId }, data });
    await tx.minutes.update({ where: { id: minutesId }, data: { recorderName: v.recorderName ?? "" } });
    await audit(tx, actor, "minutes.header", "Minutes", minutesId, { ...data, recorderName: v.recorderName });
  });
}

export async function saveFormalities(actor: Actor, minutesId: string, formData: FormData) {
  await getEditable(actor, minutesId);
  const v = z
    .object({
      eroeffnung: optionalText(2000),
      wiedereroeffnung: optionalText(2000),
      tagesordnung: optionalText(2000),
      letztesProtokoll: optionalText(2000),
    })
    .parse(formToObject(formData));
  const formalities: Formalities = {
    eroeffnung: v.eroeffnung ?? "",
    wiedereroeffnung: v.wiedereroeffnung ?? "",
    tagesordnung: v.tagesordnung ?? "",
    letztesProtokoll: v.letztesProtokoll ?? "",
  };
  await db.$transaction(async (tx) => {
    await tx.minutes.update({ where: { id: minutesId }, data: { formalities } });
    await audit(tx, actor, "minutes.formalities", "Minutes", minutesId);
  });
}

export async function saveSigners(actor: Actor, minutesId: string, formData: FormData) {
  await getEditable(actor, minutesId);
  const names = formData.getAll("signerName[]").map(String);
  const functions = formData.getAll("signerFunction[]").map(String);
  const signers = names
    .map((name, i) => ({ name: name.trim().slice(0, 200), funktion: (functions[i] ?? "").trim().slice(0, 200) }))
    .filter((s) => s.name)
    .slice(0, 4);
  await db.$transaction(async (tx) => {
    await tx.minutes.update({ where: { id: minutesId }, data: { signers } });
    await audit(tx, actor, "minutes.signers", "Minutes", minutesId, { signers });
  });
}

const sectionSchema = z.object({
  points: z.string().max(50_000).default(""),
  outcomeType: z.preprocess((v) => (v === "" ? undefined : v), z.enum(OutcomeType).optional()),
  outcomeText: optionalText(5000),
});

export async function saveSection(actor: Actor, minutesId: string, agendaItemId: string, formData: FormData) {
  const minutes = await getEditable(actor, minutesId);
  const item = await db.agendaItem.findUnique({ where: { id: agendaItemId } });
  if (!item || item.meetingId !== minutes.meetingId) throw new NotFoundError("TOP nicht gefunden.");
  const v = sectionSchema.parse(formToObject(formData));
  const data = {
    points: parsePoints(v.points),
    outcomeType: v.outcomeText ? (v.outcomeType ?? null) : null,
    outcomeText: v.outcomeText ?? "",
  };
  await db.minutesSection.upsert({
    where: { minutesId_agendaItemId: { minutesId, agendaItemId } },
    create: { minutesId, agendaItemId, ...data },
    update: data,
  });
  // Autosave: Audit nur für die Tatsache der Änderung, nicht für jeden Tastendruck-Inhalt
  await audit(db, actor, "minutes.section", "Minutes", minutesId, { agendaItemId });
}

// ---------------------------------------------------------------------------
// Anwesenheit und Beschlussfähigkeit
// ---------------------------------------------------------------------------

export type QuorumState = { present: number; eligible: number; required: number; reached: boolean; byRepeat: boolean };

export async function liveQuorum(meetingId: string): Promise<QuorumState> {
  const [meeting, atts, settings] = await Promise.all([
    db.meeting.findUniqueOrThrow({ where: { id: meetingId } }),
    db.attendance.findMany({ where: { meetingId } }),
    getSettings(),
  ]);
  const eligible = atts.filter((a) => a.votingSnapshot === "STIMMBERECHTIGT").length;
  const present = atts.filter((a) => countsForQuorum({ presence: a.presence, votingRight: a.votingSnapshot })).length;
  return evaluateQuorum({ present, eligible, rule: settings.meeting.quorumRule, isRepeatAfterNoQuorum: meeting.isRepeatAfterNoQuorum });
}

export async function setPresence(actor: Actor, minutesId: string, attendanceId: string, presence: string) {
  const minutes = await getEditable(actor, minutesId);
  const p = z.enum(Presence).parse(presence);
  const att = await db.attendance.findUnique({ where: { id: attendanceId } });
  if (!att || att.meetingId !== minutes.meetingId) throw new NotFoundError("Teilnahme nicht gefunden.");
  await db.$transaction(async (tx) => {
    await tx.attendance.update({ where: { id: attendanceId }, data: { presence: p } });
    await audit(tx, actor, "minutes.presence", "Minutes", minutesId, { attendanceId, presence: p });
  });
  return liveQuorum(minutes.meetingId);
}

/** Feststellung der Beschlussfähigkeit vor Eintritt in die TO (Statut § 40 Abs. 2). */
export async function determineQuorum(actor: Actor, minutesId: string, formData: FormData) {
  const minutes = await getEditable(actor, minutesId);
  const { determinedBy } = z.object({ determinedBy: requiredText(200) }).parse(formToObject(formData));
  const q = await liveQuorum(minutes.meetingId);
  await db.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: minutes.meetingId },
      data: {
        quorumDeterminedAt: new Date(),
        quorumDeterminedBy: determinedBy,
        quorumPresent: q.present,
        quorumEligible: q.eligible,
        quorumReached: q.reached,
      },
    });
    await audit(tx, actor, "minutes.quorum", "Meeting", minutes.meetingId, { ...q, determinedBy });
  });
  return q;
}

export async function openMeetingNow(actor: Actor, minutesId: string) {
  const minutes = await getEditable(actor, minutesId);
  const now = new Date();
  const f = asFormalities(minutes.formalities);
  const chair = minutes.meeting.chairNote.split(",")[0]?.trim();
  await db.$transaction(async (tx) => {
    await tx.meeting.update({ where: { id: minutes.meetingId }, data: { openedAt: now } });
    if (!f.eroeffnung) {
      await tx.minutes.update({
        where: { id: minutesId },
        data: { formalities: { ...f, eroeffnung: `${formatTime(now)} Uhr${chair ? ` durch ${chair}` : ""}.` } },
      });
    }
    await audit(tx, actor, "minutes.open", "Meeting", minutes.meetingId, { openedAt: now.toISOString() });
  });
}

export async function closeMeetingNow(actor: Actor, minutesId: string) {
  const minutes = await getEditable(actor, minutesId);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: minutes.meetingId },
      data: { closedAt: now, status: minutes.meeting.status === "AUFGEHOBEN" ? "AUFGEHOBEN" : "DURCHGEFUEHRT" },
    });
    await audit(tx, actor, "minutes.close", "Meeting", minutes.meetingId, { closedAt: now.toISOString() });
  });
}

/**
 * Beschlussunfähigkeit: Sitzung sofort aufheben und neu einladen (LV § 52 Abs. 3). Die Folgesitzung übernimmt
 * die Tagesordnung, ist in jedem Fall beschlussfähig und nutzt die Vorlage einladung.wiederholung.
 */
export async function suspendForNoQuorum(actor: Actor, minutesId: string, formData: FormData) {
  assertCan(actor, "meeting.manage");
  const minutes = await getEditable(actor, minutesId);
  const meeting = minutes.meeting;
  if (meeting.isRepeatAfterNoQuorum) throw new UserError("Die Wiederholungssitzung ist in jedem Fall beschlussfähig.");
  const q = await liveQuorum(meeting.id);
  if (q.reached) throw new UserError("Die Sitzung ist beschlussfähig.");
  const v = z
    .object({ startsAt: z.string().min(1, { error: "Bitte den neuen Termin angeben." }), location: optionalText(300) })
    .parse(formToObject(formData));
  const startsAt = parseDateTimeInput(v.startsAt);
  if (!startsAt || startsAt <= new Date()) throw new UserError("Der neue Termin muss in der Zukunft liegen.");
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "AUFGEHOBEN",
        closedAt: now,
        quorumDeterminedAt: meeting.quorumDeterminedAt ?? now,
        quorumDeterminedBy: meeting.quorumDeterminedBy || actor.name,
        quorumPresent: q.present,
        quorumEligible: q.eligible,
        quorumReached: false,
      },
    });
    const repeat = await tx.meeting.create({
      data: {
        type: meeting.type,
        format: meeting.format,
        title: meeting.title,
        startsAt,
        location: v.location ?? meeting.location,
        onlineUrl: meeting.onlineUrl,
        isRepeatAfterNoQuorum: true,
        previousMeetingId: meeting.id,
        chairNote: meeting.chairNote,
        createdById: actor.id,
      },
    });
    const items = await tx.agendaItem.findMany({ where: { meetingId: meeting.id }, orderBy: { position: "asc" } });
    const idMap = new Map<string, string>();
    for (const it of items.filter((i) => !i.parentId).concat(items.filter((i) => i.parentId))) {
      const created = await tx.agendaItem.create({
        data: {
          meetingId: repeat.id,
          parentId: it.parentId ? (idMap.get(it.parentId) ?? null) : null,
          position: it.position,
          title: it.title,
          description: it.description,
          kind: it.kind,
          topicId: it.topicId,
          minutesToApproveId: it.minutesToApproveId,
        },
      });
      idMap.set(it.id, created.id);
    }
    await ensureAttendances(tx, repeat.id);
    await audit(tx, actor, "meeting.suspendNoQuorum", "Meeting", meeting.id, { ...q, repeatMeetingId: repeat.id });
    return repeat;
  });
}

/** Wiedereröffnung derselben Sitzung nur, wenn das Quorum inzwischen erreicht ist (SPEC.md 2a). */
export async function reopenMeeting(actor: Actor, minutesId: string) {
  assertCan(actor, "meeting.manage");
  const minutes = await getEditable(actor, minutesId);
  const meeting = minutes.meeting;
  if (meeting.status !== "AUFGEHOBEN") throw new UserError("Die Sitzung ist nicht aufgehoben.");
  const q = await liveQuorum(meeting.id);
  if (!q.reached) throw new UserError(`Noch nicht beschlussfähig: ${q.present} von ${q.eligible} anwesend, nötig sind ${q.required}.`);
  const repeat = await db.meeting.findUnique({ where: { previousMeetingId: meeting.id } });
  if (repeat?.invitationSentAt) throw new UserError("Zur Folgesitzung wurde bereits eingeladen. Bitte dort fortfahren.");
  const now = new Date();
  const f = asFormalities(minutes.formalities);
  await db.$transaction(async (tx) => {
    if (repeat) await tx.meeting.delete({ where: { id: repeat.id } });
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        status: meeting.invitationSentAt ? "EINGELADEN" : "GEPLANT",
        closedAt: null,
        interruptionNote: `Wiedereröffnung ${formatTime(now)} Uhr`,
        quorumDeterminedAt: now,
        quorumPresent: q.present,
        quorumEligible: q.eligible,
        quorumReached: true,
      },
    });
    await tx.minutes.update({
      where: { id: minutesId },
      data: { formalities: { ...f, wiedereroeffnung: f.wiedereroeffnung || `${formatTime(now)} Uhr; Beschlussfähigkeit ist nun gegeben.` } },
    });
    await audit(tx, actor, "meeting.reopen", "Meeting", meeting.id, { ...q });
  });
}

// ---------------------------------------------------------------------------
// Beschlüsse und Ergebnisse
// ---------------------------------------------------------------------------

const BESCHLUSS_RESULTS = ["ANGENOMMEN_EINSTIMMIG", "ANGENOMMEN_MEHRHEITLICH", "ABGELEHNT"] as const;
const ERGEBNIS_RESULTS = ["FESTGESTELLT", "KENNTNISNAHME", "ABGESETZT", "VERTAGT"] as const;

export const RESULT_LABELS: Record<ResolutionResult, string> = {
  ANGENOMMEN_EINSTIMMIG: "einstimmig angenommen",
  ANGENOMMEN_MEHRHEITLICH: "mehrheitlich angenommen",
  ABGELEHNT: "abgelehnt",
  FESTGESTELLT: "festgestellt",
  ABGESETZT: "abgesetzt",
  VERTAGT: "vertagt",
  KENNTNISNAHME: "zur Kenntnis genommen",
};

export function resultText(r: { resultType: ResolutionResult; votesYes: number | null; votesNo: number | null; votesAbstain: number | null }) {
  const label = RESULT_LABELS[r.resultType];
  if (r.votesYes === null || r.resultType === "ANGENOMMEN_EINSTIMMIG" && !r.votesAbstain) return label;
  return `${label} (${r.votesYes}:${r.votesNo ?? 0}:${r.votesAbstain ?? 0})`;
}

const intOrUndefined = z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(500).optional());

const resolutionSchema = z.object({
  subject: requiredText(1000),
  kind: z.enum(OutcomeType),
  resultType: z.preprocess((v) => (v === "" ? undefined : v), z.enum(ResolutionResult).optional()),
  votesYes: intOrUndefined,
  votesNo: intOrUndefined,
  votesAbstain: intOrUndefined,
});

async function nextNumber(tx: DbClient, year: number) {
  const existing = await tx.resolution.findMany({ where: { number: { startsWith: `${year}-` } }, select: { number: true } });
  return nextResolutionNumber(year, existing.map((e) => e.number));
}

/** Genehmigt ein Protokoll (in einer Sitzung oder per Umlauf). */
export async function markMinutesApproved(
  tx: DbClient,
  actor: Actor | null,
  minutesId: string,
  via: { meetingId?: string; circulationId?: string },
) {
  const m = await tx.minutes.findUnique({ where: { id: minutesId } });
  if (!m || m.status !== "VERSENDET") return false;
  await tx.minutes.update({
    where: { id: minutesId },
    data: {
      status: "GENEHMIGT",
      approvedAt: new Date(),
      approvedAtMeetingId: via.meetingId ?? null,
      approvalMode: via.circulationId ? "UMLAUF" : "SITZUNG",
    },
  });
  await audit(tx, actor, "minutes.approve", "Minutes", minutesId, via);
  return true;
}

export async function addResolution(actor: Actor, minutesId: string, agendaItemId: string, formData: FormData) {
  const minutes = await getEditable(actor, minutesId);
  const meeting = minutes.meeting;
  const item = await db.agendaItem.findUnique({ where: { id: agendaItemId } });
  if (!item || item.meetingId !== meeting.id) throw new NotFoundError("TOP nicht gefunden.");
  const v = resolutionSchema.parse(formToObject(formData));

  let resultType: ResolutionResult;
  let votes: { yes: number; no: number; abstain: number } | null = null;
  let text: string;
  if (v.kind === "BESCHLUSS") {
    if (!meeting.quorumDeterminedAt) throw new UserError("Bitte zuerst die Beschlussfähigkeit feststellen (Statut § 40 Abs. 2).");
    if (!meeting.quorumReached && !meeting.isRepeatAfterNoQuorum) throw new UserError("Die Sitzung ist nicht beschlussfähig.");
    const hasVotes = v.votesYes !== undefined || v.votesNo !== undefined || v.votesAbstain !== undefined;
    if (hasVotes) {
      votes = { yes: v.votesYes ?? 0, no: v.votesNo ?? 0, abstain: v.votesAbstain ?? 0 };
      if (meeting.quorumPresent !== null && votesExceedPresent(votes, meeting.quorumPresent)) {
        throw new UserError(`Mehr Stimmen als anwesende Stimmberechtigte (${meeting.quorumPresent}).`);
      }
      const m = evaluateMajority(votes);
      resultType = m.resultType;
      text = m.text;
    } else {
      if (v.resultType !== "ANGENOMMEN_EINSTIMMIG") {
        throw new UserError("Bei mehrheitlichen oder abgelehnten Beschlüssen bitte die Stimmen angeben (LV-Satzung § 51 Abs. 1).");
      }
      resultType = "ANGENOMMEN_EINSTIMMIG";
      text = "Der Antrag wird einstimmig angenommen.";
    }
  } else {
    const r = v.resultType ?? "FESTGESTELLT";
    if (!(ERGEBNIS_RESULTS as readonly string[]).includes(r)) throw new UserError("Ungültige Ergebnisart für ein Ergebnis.");
    resultType = r;
    text = v.subject;
  }

  const year = berlinParts(meeting.startsAt).year;
  const resolution = await db.$transaction(async (tx) => {
    const created = await tx.resolution.create({
      data: {
        meetingId: meeting.id,
        agendaItemId,
        number: await nextNumber(tx, year),
        subject: v.subject,
        kind: v.kind,
        resultType,
        votesYes: votes?.yes ?? null,
        votesNo: votes?.no ?? null,
        votesAbstain: votes?.abstain ?? null,
      },
    });
    // Ergebniszeile am TOP vorbelegen, falls noch leer
    const section = await tx.minutesSection.findUnique({ where: { minutesId_agendaItemId: { minutesId, agendaItemId } } });
    if (!section?.outcomeText) {
      await tx.minutesSection.upsert({
        where: { minutesId_agendaItemId: { minutesId, agendaItemId } },
        create: { minutesId, agendaItemId, outcomeType: v.kind, outcomeText: text },
        update: { outcomeType: v.kind, outcomeText: text },
      });
    }
    // TOP „Genehmigung des Protokolls“: angenommener Beschluss genehmigt das verknüpfte Protokoll
    if (item.kind === "PROTOKOLLGENEHMIGUNG" && item.minutesToApproveId && (BESCHLUSS_RESULTS.slice(0, 2) as readonly string[]).includes(resultType)) {
      if (await markMinutesApproved(tx, actor, item.minutesToApproveId, { meetingId: meeting.id })) {
        const f = asFormalities(minutes.formalities);
        if (!f.letztesProtokoll) {
          await tx.minutes.update({
            where: { id: minutesId },
            data: { formalities: { ...f, letztesProtokoll: `wird ${RESULT_LABELS[resultType].replace("angenommen", "genehmigt")}.` } },
          });
        }
      }
    }
    await audit(tx, actor, "resolution.create", "Resolution", created.id, {
      number: created.number,
      subject: created.subject,
      resultType,
      votes,
    });
    return created;
  });
  return resolution;
}

export async function deleteResolution(actor: Actor, resolutionId: string) {
  const r = await db.resolution.findUnique({ where: { id: resolutionId } });
  if (!r?.meetingId) throw new NotFoundError("Beschluss nicht gefunden.");
  const minutes = await db.minutes.findFirst({ where: { meetingId: r.meetingId, isCurrent: true } });
  if (!minutes) throw new NotFoundError("Protokoll nicht gefunden.");
  await getEditable(actor, minutes.id);
  await db.$transaction(async (tx) => {
    await tx.resolution.delete({ where: { id: resolutionId } });
    await audit(tx, actor, "resolution.delete", "Resolution", resolutionId, { number: r.number, subject: r.subject });
  });
}

/** TOP „Genehmigung des Protokolls“ ohne förmliche Abstimmung als genehmigt markieren. */
export async function approveLinkedMinutes(actor: Actor, minutesId: string, agendaItemId: string) {
  const minutes = await getEditable(actor, minutesId);
  const item = await db.agendaItem.findUnique({ where: { id: agendaItemId } });
  if (!item || item.meetingId !== minutes.meetingId || !item.minutesToApproveId) throw new NotFoundError("TOP nicht gefunden.");
  const ok = await db.$transaction((tx) => markMinutesApproved(tx, actor, item.minutesToApproveId!, { meetingId: minutes.meetingId }));
  if (!ok) throw new UserError("Das Protokoll ist nicht (mehr) zur Genehmigung offen.");
}

// ---------------------------------------------------------------------------
// Prüfliste, Versionen
// ---------------------------------------------------------------------------

export async function minutesChecklistFor(minutes: Minutes, meeting: MinutesMeeting) {
  const numbered = numberAgenda(meeting.agendaItems);
  const signers = asSigners(minutes.signers);
  const attendances = meeting.attendances.filter((a) => a.user.active || a.presence);
  return minutesChecklist({
    location: meeting.location,
    onlineUrl: meeting.onlineUrl,
    openedAt: meeting.openedAt,
    closedAt: meeting.closedAt,
    attendanceTotal: attendances.length,
    attendanceRecorded: attendances.filter((a) => a.presence).length,
    quorumDetermined: !!meeting.quorumDeterminedAt || meeting.isRepeatAfterNoQuorum,
    recorderName: minutes.recorderName,
    signerCount: signers.length,
    openAgendaItems: meeting.status === "AUFGEHOBEN" ? [] : numbered.filter((i) => i.status === "OFFEN").map((i) => i.number),
    resolutionsWithoutResult: [],
    beschluesseWithoutVotes: meeting.resolutions
      .filter((r) => r.kind === "BESCHLUSS" && r.resultType !== "ANGENOMMEN_EINSTIMMIG" && r.votesYes === null)
      .map((r) => r.number),
  });
}

export async function assertSendable(minutes: Minutes, meeting: MinutesMeeting) {
  const items = await minutesChecklistFor(minutes, meeting);
  if (!checklistComplete(items)) {
    const missing = items.filter((i) => !i.ok && i.required).map((i) => i.label);
    throw new UserError(`Das Protokoll ist noch nicht vollständig: ${missing.join("; ")}.`);
  }
}

/** Korrektur nach Versand: neue Version mit Änderungshinweis (CLAUDE.md Regel 9). */
export async function createNewVersion(actor: Actor, minutesId: string, formData: FormData) {
  assertCan(actor, "minutes.edit");
  const { changeNote } = z.object({ changeNote: requiredText(1000) }).parse(formToObject(formData));
  const old = await db.minutes.findUnique({ where: { id: minutesId }, include: { sections: true } });
  if (!old || !old.isCurrent) throw new NotFoundError("Protokoll nicht gefunden.");
  if (old.status !== "VERSENDET") throw new UserError("Neue Versionen gibt es nur für versendete, noch nicht genehmigte Protokolle.");
  return db.$transaction(async (tx) => {
    await tx.minutes.update({ where: { id: old.id }, data: { isCurrent: false } });
    const created = await tx.minutes.create({
      data: {
        meetingId: old.meetingId,
        version: old.version + 1,
        previousVersionId: old.id,
        changeNote,
        recorderName: old.recorderName,
        formalities: old.formalities ?? {},
        signers: old.signers ?? [],
        aiUncertainties: old.aiUncertainties ?? undefined,
        sections: {
          create: old.sections.map((s) => ({
            agendaItemId: s.agendaItemId,
            points: s.points ?? [],
            outcomeType: s.outcomeType,
            outcomeText: s.outcomeText,
          })),
        },
      },
    });
    // TO-Punkt „Genehmigung“ einer künftigen Sitzung auf die neue Version umhängen
    await tx.agendaItem.updateMany({ where: { minutesToApproveId: old.id }, data: { minutesToApproveId: created.id } });
    // Ein laufendes Umlaufverfahren über die alte Fassung ist hinfällig
    await tx.circulation.updateMany({
      where: { minutesId: old.id, status: "LAUFEND" },
      data: { status: "ABGEBROCHEN", resultText: "Abgebrochen: Das Protokoll wurde korrigiert (neue Version)." },
    });
    await audit(tx, actor, "minutes.newVersion", "Minutes", created.id, { from: old.version, changeNote });
    return created;
  });
}

export function assertCanSend(actor: Pick<User, "role">) {
  if (actor.role !== "ADMIN" && actor.role !== "SCHRIFTFUEHRER") throw new ForbiddenError();
  assertCan(actor, "minutes.send");
}

export { newToken };
