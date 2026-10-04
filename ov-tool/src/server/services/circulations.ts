import "server-only";
import { CirculationVoteValue, type Circulation, type CirculationVote, type User } from "@prisma/client";
import { addBerlinDays, berlinParts, parseDateInput, startOfBerlinDay } from "@/lib/dates";
import { nextResolutionNumber } from "@/lib/minutes-checklist";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit, type DbClient } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import type { MailAttachment } from "@/server/mail/transport";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { markMinutesApproved, newToken } from "./minutes";
import { getSettings } from "./settings";
import { circulationRequiredYes, evaluateCirculation, type CirculationEvaluation } from "./statute";
import { meetingContext, senderContext } from "./template-context";

type Actor = Pick<User, "id" | "role" | "name">;

export const VOTE_LABELS: Record<CirculationVoteValue, string> = {
  JA: "Zustimmung",
  NEIN: "Ablehnung",
  ENTHALTUNG: "Enthaltung",
  WIDERSPRUCH: "Widerspruch gegen das Umlaufverfahren",
};

export function tally(c: Pick<Circulation, "eligibleCount">, votes: Pick<CirculationVote, "vote">[]) {
  const count = (v: CirculationVoteValue) => votes.filter((x) => x.vote === v).length;
  return {
    eligible: c.eligibleCount,
    yes: count("JA"),
    no: count("NEIN"),
    abstain: count("ENTHALTUNG"),
    objections: count("WIDERSPRUCH"),
  };
}

/** Auswertung nach Statut § 42 Abs. 3 (Schweigen ist keine Zustimmung). */
export function evaluate(c: Circulation, votes: Pick<CirculationVote, "vote">[], now = new Date()): CirculationEvaluation {
  return evaluateCirculation(tally(c, votes), now.getTime() > c.deadline.getTime());
}

export function voteUrl(token: string) {
  return `${appUrl()}/vote/${token}`;
}

export function listCirculations(actor: Pick<User, "role">) {
  assertCan(actor, "read");
  return db.circulation.findMany({
    orderBy: { initiatedAt: "desc" },
    include: { votes: { select: { vote: true } }, minutes: { include: { meeting: { select: { startsAt: true } } } } },
    take: 200,
  });
}

export async function getCirculation(actor: Pick<User, "role">, id: string) {
  assertCan(actor, "read");
  const c = await db.circulation.findUnique({
    where: { id },
    include: {
      votes: { include: { user: { select: { id: true, name: true } } }, orderBy: { votedAt: "asc" } },
      initiatedBy: { select: { name: true } },
      determinedBy: { select: { name: true } },
      minutes: { include: { meeting: true } },
      resolution: true,
    },
  });
  if (!c) throw new NotFoundError("Umlaufverfahren nicht gefunden.");
  return c;
}

const startSchema = z.object({
  subject: requiredText(300),
  text: requiredText(10_000),
  reason: optionalText(5000),
  deadline: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

export type StartCirculationInput = {
  subject: string;
  text: string;
  reason?: string;
  deadline?: Date;
  minutesId?: string;
  decidedInMeetingId?: string;
  attachments?: MailAttachment[];
};

/** Leitet ein Umlaufverfahren ein: Versand an alle Stimmberechtigten mit persönlichem Link. */
export async function startCirculationRecord(actor: Actor, input: StartCirculationInput) {
  assertCan(actor, "circulation.manage");
  const settings = await getSettings();
  // Frist: Ende des gewählten Tages (Berlin)
  const deadlineDay = input.deadline ?? startOfBerlinDay(addBerlinDays(new Date(), settings.circulation.defaultDays));
  const deadline = new Date(addBerlinDays(startOfBerlinDay(deadlineDay), 1).getTime() - 1000);
  if (deadline.getTime() <= Date.now()) throw new UserError("Die Frist muss in der Zukunft liegen.");
  const eligible = await db.user.findMany({ where: { active: true, votingRight: "STIMMBERECHTIGT" } });
  if (!eligible.length) throw new UserError("Es gibt keine stimmberechtigten Vorstandsmitglieder.");
  const year = berlinParts(new Date()).year;

  const circulation = await db.$transaction(async (tx) => {
    const existing = await tx.circulation.findMany({ where: { number: { startsWith: `U-${year}-` } }, select: { number: true } });
    const c = await tx.circulation.create({
      data: {
        number: nextResolutionNumber(year, existing.map((e) => e.number), "U-"),
        subject: input.subject,
        text: input.text,
        reason: input.reason ?? "",
        minutesId: input.minutesId,
        decidedInMeetingId: input.decidedInMeetingId,
        initiatedById: actor.id,
        deadline,
        eligibleCount: eligible.length,
        votes: { create: eligible.map((u) => ({ userId: u.id, token: newToken() })) },
      },
      include: { votes: { include: { user: true } } },
    });
    await audit(tx, actor, "circulation.start", "Circulation", c.id, {
      number: c.number,
      subject: c.subject,
      eligible: eligible.length,
      deadline: deadline.toISOString(),
    });
    return c;
  });

  const minutes = input.minutesId
    ? await db.minutes.findUnique({ where: { id: input.minutesId }, include: { meeting: true } })
    : null;
  const base = {
    absender: await senderContext(actor.id),
    sitzung: minutes ? await meetingContext(minutes.meeting) : undefined,
    umlauf: {
      betreff: circulation.subject,
      text: circulation.text,
      begruendung: circulation.reason,
      frist: circulation.deadline,
      nummer: circulation.number,
      stimmberechtigt: circulation.eligibleCount,
      erforderlich: circulationRequiredYes(circulation.eligibleCount),
      protokoll: !!minutes,
    },
  };
  for (const v of circulation.votes) {
    const mail = await renderMail("umlauf.einleitung", {
      ...base,
      empfaenger: { name: v.user.name },
      umlauf: { ...base.umlauf, link: voteUrl(v.token) },
    });
    await queueMail({ to: v.user.email, subject: mail.subject, text: mail.text, html: mail.html, attachments: input.attachments });
  }
  return circulation;
}

export async function startCirculation(actor: Actor, formData: FormData) {
  const v = startSchema.parse(formToObject(formData));
  return startCirculationRecord(actor, {
    subject: v.subject,
    text: v.text,
    reason: v.reason,
    deadline: v.deadline ? (parseDateInput(v.deadline) ?? undefined) : undefined,
  });
}

const voteSchema = z.object({ vote: z.enum(CirculationVoteValue), comment: optionalText(1000) });

async function recordVote(voteId: string, actor: Actor | null, formData: FormData) {
  const v = voteSchema.parse(formToObject(formData));
  const vote = await db.circulationVote.findUnique({ where: { id: voteId }, include: { circulation: true } });
  if (!vote) throw new NotFoundError("Stimme nicht gefunden.");
  const c = vote.circulation;
  if (c.status !== "LAUFEND") throw new UserError("Das Umlaufverfahren ist abgeschlossen.");
  if (c.deadline.getTime() < Date.now()) throw new UserError("Die Frist ist abgelaufen.");
  if (vote.vote) throw new UserError("Sie haben bereits abgestimmt. Die Stimme kann nicht geändert werden.");
  await db.$transaction(async (tx) => {
    await tx.circulationVote.update({ where: { id: voteId }, data: { vote: v.vote, comment: v.comment ?? "", votedAt: new Date() } });
    await audit(tx, actor, "circulation.vote", "Circulation", c.id, { voteId, vote: v.vote });
    // Widerspricht mehr als ein Viertel, ist das Verfahren sofort unzulässig (Statut § 42 Abs. 3)
    const votes = await tx.circulationVote.findMany({ where: { circulationId: c.id } });
    const ev = evaluate(c, votes);
    if (ev.outcome === "UNZULAESSIG") {
      await tx.circulation.update({
        where: { id: c.id },
        data: { status: "UNZULAESSIG", determinedAt: new Date(), resultText: ev.text },
      });
      await afterOutcome(tx, null, c, "UNZULAESSIG");
      await audit(tx, null, "circulation.inadmissible", "Circulation", c.id, { ...tally(c, votes) });
    }
  });
}

export async function voteByToken(token: string, formData: FormData) {
  const vote = await db.circulationVote.findUnique({ where: { token } });
  if (!vote) throw new UserError("Der Link ist ungültig.");
  await recordVote(vote.id, null, formData);
}

export async function voteAsUser(actor: Actor, circulationId: string, formData: FormData) {
  const vote = await db.circulationVote.findUnique({ where: { circulationId_userId: { circulationId, userId: actor.id } } });
  if (!vote) throw new UserError("Sie sind in diesem Verfahren nicht stimmberechtigt.");
  await recordVote(vote.id, actor, formData);
}

export function getVoteByToken(token: string) {
  if (!token || token.length < 20) return null;
  return db.circulationVote.findUnique({
    where: { token },
    include: { circulation: true, user: { select: { name: true } } },
  });
}

/** Folgen eines Ergebnisses für ein Protokoll. */
async function afterOutcome(tx: DbClient, actor: Actor | null, c: Circulation, outcome: "ANGENOMMEN" | "ABGELEHNT" | "UNZULAESSIG") {
  if (!c.minutesId) return;
  if (outcome === "ANGENOMMEN") {
    await markMinutesApproved(tx, actor, c.minutesId, { circulationId: c.id });
  } else {
    // nicht genehmigt → Genehmigung in der nächsten Sitzung
    await tx.minutes.update({ where: { id: c.minutesId }, data: { approvalMode: "SITZUNG" } });
  }
}

/** Admin stellt das Ergebnis fest (nach Fristablauf oder sobald es feststeht). */
export async function determineCirculation(actor: Actor, id: string, opts: { announce: boolean }) {
  assertCan(actor, "circulation.manage");
  const c = await db.circulation.findUnique({ where: { id }, include: { votes: true } });
  if (!c) throw new NotFoundError("Umlaufverfahren nicht gefunden.");
  if (c.status !== "LAUFEND") throw new UserError("Das Ergebnis ist bereits festgestellt.");
  const ev = evaluate(c, c.votes);
  if (!ev.final || ev.outcome === "LAUFEND") throw new UserError(`Das Ergebnis steht noch nicht fest. ${ev.text}`);
  const t = tally(c, c.votes);
  await db.$transaction(async (tx) => {
    await tx.circulation.update({
      where: { id },
      data: { status: ev.outcome as "ANGENOMMEN", determinedById: actor.id, determinedAt: new Date(), resultText: ev.text },
    });
    if (ev.outcome === "ANGENOMMEN") {
      await tx.resolution.create({
        data: {
          circulationId: c.id,
          meetingId: c.decidedInMeetingId,
          number: c.number,
          subject: c.subject,
          kind: "BESCHLUSS",
          resultType: t.no === 0 ? "ANGENOMMEN_EINSTIMMIG" : "ANGENOMMEN_MEHRHEITLICH",
          votesYes: t.yes,
          votesNo: t.no,
          votesAbstain: t.abstain,
        },
      });
    }
    await afterOutcome(tx, actor, c, ev.outcome as "ANGENOMMEN");
    await audit(tx, actor, "circulation.determine", "Circulation", id, { outcome: ev.outcome, ...t });
  });
  if (opts.announce) await announceCirculation(actor, id);
}

/** Bekanntgabe an den Vorstand (Vorlage umlauf.ergebnis). */
export async function announceCirculation(actor: Actor, id: string) {
  assertCan(actor, "circulation.manage");
  const c = await db.circulation.findUnique({ where: { id }, include: { votes: true } });
  if (!c) throw new NotFoundError("Umlaufverfahren nicht gefunden.");
  if (c.status === "LAUFEND" || c.status === "ABGEBROCHEN") throw new UserError("Es gibt noch kein Ergebnis zum Bekanntgeben.");
  const t = tally(c, c.votes);
  const users = await db.user.findMany({ where: { active: true } });
  const mail = await renderMail("umlauf.ergebnis", {
    absender: await senderContext(actor.id),
    umlauf: {
      betreff: c.subject,
      text: c.text,
      frist: c.deadline,
      nummer: c.number,
      stimmberechtigt: t.eligible,
      ja: t.yes,
      nein: t.no,
      enthaltung: t.abstain,
      widerspruch: t.objections,
      ohneRueckmeldung: t.eligible - t.yes - t.no - t.abstain - t.objections,
      angenommen: c.status === "ANGENOMMEN",
      ergebnisText: c.resultText,
    },
  });
  for (const u of users) await queueMail({ to: u.email, subject: mail.subject, text: mail.text, html: mail.html });
  await db.$transaction(async (tx) => {
    await tx.circulation.update({ where: { id }, data: { announcedAt: new Date() } });
    await audit(tx, actor, "circulation.announce", "Circulation", id, { recipients: users.length });
  });
}

export async function abortCirculation(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "circulation.manage");
  const { reason } = z.object({ reason: optionalText(1000) }).parse(formToObject(formData));
  const c = await db.circulation.findUnique({ where: { id } });
  if (!c || c.status !== "LAUFEND") throw new UserError("Nur laufende Verfahren können abgebrochen werden.");
  await db.$transaction(async (tx) => {
    await tx.circulation.update({
      where: { id },
      data: { status: "ABGEBROCHEN", determinedById: actor.id, determinedAt: new Date(), resultText: `Abgebrochen${reason ? `: ${reason}` : "."}` },
    });
    if (c.minutesId) await tx.minutes.update({ where: { id: c.minutesId }, data: { approvalMode: "SITZUNG" } });
    await audit(tx, actor, "circulation.abort", "Circulation", id, { reason });
  });
}

/** Stimmabgabe noch möglich? */
export function isVoteOpen(c: Pick<Circulation, "status" | "deadline">, alreadyVoted: boolean, now: Date = new Date()) {
  return c.status === "LAUFEND" && !alreadyVoted && c.deadline.getTime() > now.getTime();
}
