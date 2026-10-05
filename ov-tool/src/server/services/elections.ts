import "server-only";
import { ElectionMode, type Prisma, type User } from "@prisma/client";
import { evaluateRound, nextStep, roundLabel, type FlowRound } from "@/lib/election-flow";
import { formatDateLong, parseDateTimeInput } from "@/lib/dates";
import { checkbox, formToObject, optionalInt, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { collectiveVotesPlausible, electionPeriod } from "./statute";

// Wahlmanagement (SPEC.md 3.12): Vorbereitung, Stimmzettel, Auszählung nach LV-Satzung § 57, Niederschrift (§ 51 Abs. 2).
// Keine Mitgliederlisten – nur Zahlen und Bewerber.

type Actor = Pick<User, "id" | "role">;

const electionInclude = {
  positions: {
    orderBy: { sortOrder: "asc" },
    include: { candidates: { orderBy: { name: "asc" } }, rounds: { orderBy: { sequence: "asc" } } },
  },
} satisfies Prisma.ElectionInclude;

export type ElectionFull = Prisma.ElectionGetPayload<{ include: typeof electionInclude }>;
export type PositionFull = ElectionFull["positions"][number];

export function listElections(actor: Actor) {
  assertCan(actor, "read");
  return db.election.findMany({ orderBy: { date: "desc" }, include: { positions: { select: { id: true } } } });
}

export async function getElection(actor: Actor, id: string): Promise<ElectionFull> {
  assertCan(actor, "read");
  const election = await db.election.findUnique({ where: { id }, include: electionInclude });
  if (!election) throw new NotFoundError();
  return election;
}

export function toFlowRounds(position: PositionFull): FlowRound[] {
  return position.rounds.map((r) => ({
    stage: r.stage,
    round: r.round,
    candidateIds: r.candidateIds,
    noVotes: r.noVotes,
    votes: (r.votes ?? {}) as Record<string, number>,
    elected: r.elected,
  }));
}

export function positionStep(position: PositionFull) {
  const active = position.candidates.filter((c) => !c.withdrawn).map((c) => c.id);
  return nextStep(position.mode, position.seats, active, toFlowRounds(position));
}

/** Letzte abgeschlossene Vorstandswahl – Grundlage für die Wahlperiode (LV § 56 Abs. 1). */
export async function lastElectionDate(): Promise<Date | null> {
  const last = await db.election.findFirst({ where: { status: "ABGESCHLOSSEN" }, orderBy: { date: "desc" }, select: { date: true } });
  if (last) return last.date;
  const setting = await db.setting.findUnique({ where: { key: "election.lastDate" } });
  const value = typeof setting?.value === "string" ? new Date(setting.value) : null;
  return value && !Number.isNaN(value.getTime()) ? value : null;
}

export async function electionPeriodStatus(now = new Date()) {
  return electionPeriod(await lastElectionDate(), now);
}

// ---------------------------------------------------------------------------
// Anlegen und Pflege
// ---------------------------------------------------------------------------

/** Vorschlag der Ämter nach LV-Satzung § 37 Abs. 1 (Ehrenvorsitzende werden nicht gewählt). */
export function defaultPositions(assessors: number, withAuditors: boolean) {
  const list: { title: string; mode: ElectionMode; seats: number }[] = [
    { title: "Vorsitzende/r", mode: "EINZEL", seats: 1 },
    { title: "Stellvertretende Vorsitzende", mode: "SAMMEL", seats: 3 },
    { title: "Schriftführer/in", mode: "EINZEL", seats: 1 },
    { title: "Schatzmeister/in", mode: "EINZEL", seats: 1 },
  ];
  if (assessors > 0) list.push({ title: "Beisitzer/innen", mode: "SAMMEL", seats: Math.min(assessors, 12) });
  if (withAuditors) list.push({ title: "Kassenprüfer/innen", mode: "SAMMEL", seats: 2 });
  return list;
}

const electionSchema = z.object({
  title: requiredText(200),
  date: z.string().transform((v, ctx) => {
    const d = parseDateTimeInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Bitte Datum und Uhrzeit angeben." });
    return d as Date;
  }),
  location: optionalText(300),
});

export async function createElection(actor: Actor, formData: FormData) {
  assertCan(actor, "election.manage");
  const raw = formToObject(formData);
  const input = electionSchema.parse(raw);
  const extra = z.object({ defaults: checkbox, assessors: optionalInt, auditors: checkbox }).parse(raw);
  const positions = extra.defaults ? defaultPositions(extra.assessors ?? 0, extra.auditors) : [];
  return db.$transaction(async (tx) => {
    const election = await tx.election.create({
      data: {
        title: input.title,
        date: input.date,
        location: input.location ?? "",
        createdById: actor.id,
        positions: { create: positions.map((p, i) => ({ ...p, sortOrder: i })) },
      },
    });
    await audit(tx, actor, "election.create", "Election", election.id, { title: input.title, positions: positions.length });
    return election;
  });
}

const updateSchema = electionSchema.extend({
  presentEligible: optionalInt,
  chair: optionalText(300),
  countingCommittee: optionalText(500),
  notes: optionalText(4000),
  status: z.enum(["PLANUNG", "LAUFEND", "ABGESCHLOSSEN"]),
});

export async function updateElection(actor: Actor, id: string, formData: FormData) {
  assertCan(actor, "election.manage");
  const input = updateSchema.parse(formToObject(formData));
  if (input.presentEligible !== undefined && input.presentEligible < 0) throw new UserError("Die Zahl der Stimmberechtigten kann nicht negativ sein.");
  return db.$transaction(async (tx) => {
    const before = await tx.election.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    const data = {
      title: input.title,
      date: input.date,
      location: input.location ?? "",
      presentEligible: input.presentEligible ?? null,
      chair: input.chair ?? "",
      countingCommittee: input.countingCommittee ?? "",
      notes: input.notes ?? "",
      status: input.status,
    };
    await tx.election.update({ where: { id }, data });
    await audit(tx, actor, "election.update", "Election", id, changes(before, data));
  });
}

export async function deleteElection(actor: Actor, id: string) {
  assertCan(actor, "election.manage");
  await db.$transaction(async (tx) => {
    const e = await tx.election.findUnique({ where: { id }, include: { positions: { include: { rounds: { select: { id: true } } } } } });
    if (!e) throw new NotFoundError();
    if (e.positions.some((p) => p.rounds.length)) throw new UserError("Wahlen mit erfassten Wahlgängen können nicht gelöscht werden.");
    await tx.election.delete({ where: { id } });
    await audit(tx, actor, "election.delete", "Election", id, { title: e.title });
  });
}

const positionSchema = z.object({
  title: requiredText(200),
  mode: z.enum(ElectionMode),
  seats: z.coerce.number().int().min(1, { error: "Mindestens ein Platz." }).max(30),
});

export async function addPosition(actor: Actor, electionId: string, formData: FormData) {
  assertCan(actor, "election.manage");
  const input = positionSchema.parse(formToObject(formData));
  const seats = input.mode === "EINZEL" ? 1 : input.seats;
  await db.$transaction(async (tx) => {
    const count = await tx.electionPosition.count({ where: { electionId } });
    const p = await tx.electionPosition.create({ data: { electionId, title: input.title, mode: input.mode, seats, sortOrder: count } });
    await audit(tx, actor, "election.position.create", "ElectionPosition", p.id, { title: p.title, mode: p.mode, seats });
  });
}

export async function updatePosition(actor: Actor, positionId: string, formData: FormData) {
  assertCan(actor, "election.manage");
  const input = positionSchema.parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    const before = await tx.electionPosition.findUnique({ where: { id: positionId }, include: { rounds: { select: { id: true } } } });
    if (!before) throw new NotFoundError();
    if (before.rounds.length && (before.mode !== input.mode || before.seats !== input.seats)) {
      throw new UserError("Art und Zahl der Plätze lassen sich nach dem ersten Wahlgang nicht mehr ändern.");
    }
    const data = { title: input.title, mode: input.mode, seats: input.mode === "EINZEL" ? 1 : input.seats };
    await tx.electionPosition.update({ where: { id: positionId }, data });
    await audit(tx, actor, "election.position.update", "ElectionPosition", positionId, changes(before, data));
  });
}

export async function deletePosition(actor: Actor, positionId: string) {
  assertCan(actor, "election.manage");
  await db.$transaction(async (tx) => {
    const p = await tx.electionPosition.findUnique({ where: { id: positionId }, include: { rounds: { select: { id: true } } } });
    if (!p) throw new NotFoundError();
    if (p.rounds.length) throw new UserError("Ämter mit erfassten Wahlgängen können nicht gelöscht werden.");
    await tx.electionPosition.delete({ where: { id: positionId } });
    await audit(tx, actor, "election.position.delete", "ElectionPosition", positionId, { title: p.title });
  });
}

export async function addCandidate(actor: Actor, positionId: string, formData: FormData) {
  assertCan(actor, "election.manage");
  const input = z.object({ name: requiredText(200), note: optionalText(300) }).parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    const p = await tx.electionPosition.findUnique({ where: { id: positionId }, include: { rounds: { select: { id: true } } } });
    if (!p) throw new NotFoundError();
    if (p.rounds.length) throw new UserError("Nach dem ersten Wahlgang können keine Bewerber mehr hinzukommen.");
    const c = await tx.electionCandidate.create({ data: { positionId, name: input.name, note: input.note ?? "" } });
    await audit(tx, actor, "election.candidate.create", "ElectionCandidate", c.id, { name: c.name, position: p.title });
  });
}

export async function removeCandidate(actor: Actor, candidateId: string) {
  assertCan(actor, "election.manage");
  await db.$transaction(async (tx) => {
    const c = await tx.electionCandidate.findUnique({ where: { id: candidateId }, include: { position: { include: { rounds: { select: { id: true } } } } } });
    if (!c) throw new NotFoundError();
    if (c.position.rounds.length) {
      // nach Wahlgängen nur Verzicht vermerken, Datensatz bleibt für die Niederschrift
      await tx.electionCandidate.update({ where: { id: candidateId }, data: { withdrawn: true } });
      await audit(tx, actor, "election.candidate.withdraw", "ElectionCandidate", candidateId, { name: c.name });
      return;
    }
    await tx.electionCandidate.delete({ where: { id: candidateId } });
    await audit(tx, actor, "election.candidate.delete", "ElectionCandidate", candidateId, { name: c.name });
  });
}

export async function setAcceptance(actor: Actor, candidateId: string, accepted: boolean | null) {
  assertCan(actor, "election.manage");
  await db.$transaction(async (tx) => {
    const c = await tx.electionCandidate.update({ where: { id: candidateId }, data: { accepted } });
    await audit(tx, actor, "election.candidate.acceptance", "ElectionCandidate", candidateId, { name: c.name, accepted });
  });
}

// ---------------------------------------------------------------------------
// Auszählung
// ---------------------------------------------------------------------------

export type RoundInput = {
  /** Kennung des erwarteten Schritts (Schutz gegen doppelte Erfassung) */
  sequence: number;
  ballotsCast: number;
  invalid: number;
  abstentions: number;
  noVotes: number;
  votes: Record<string, number>;
  /** Plausibilitätswarnung bei Sammelwahl bewusst übergehen */
  override?: boolean;
};

const intField = z.coerce.number().int({ error: "Ganze Zahl angeben." }).min(0, { error: "Nicht negativ." });
const roundSchema = z.object({
  sequence: z.coerce.number().int().min(1),
  ballotsCast: intField,
  invalid: intField,
  abstentions: intField,
  noVotes: intField.default(0),
  votes: z.record(z.string(), intField),
  override: z.boolean().optional(),
});

export async function recordRound(actor: Actor, positionId: string, raw: RoundInput) {
  assertCan(actor, "election.manage");
  const input = roundSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const position = await tx.electionPosition.findUnique({
      where: { id: positionId },
      include: { election: true, candidates: true, rounds: { orderBy: { sequence: "asc" } } },
    });
    if (!position) throw new NotFoundError();
    if (position.election.status === "ABGESCHLOSSEN") throw new UserError("Die Wahl ist abgeschlossen.");
    const full = position as unknown as PositionFull;
    if (input.sequence !== position.rounds.length + 1) throw new UserError("Dieser Wahlgang wurde bereits erfasst. Bitte die Seite neu laden.");
    const step = positionStep(full);
    if (step.done) throw new UserError("Für dieses Amt ist die Wahl bereits entschieden.");
    if (step.stage === "LOS") throw new UserError("Es ist ein Losentscheid nötig.");

    const votes: Record<string, number> = {};
    for (const id of step.candidateIds) votes[id] = input.votes[id] ?? 0;
    const candidateVotes = Object.values(votes).reduce((s, n) => s + n, 0);
    const valid = input.ballotsCast - input.invalid - input.abstentions;
    if (valid < 0) throw new UserError("Ungültige Stimmzettel und Enthaltungen übersteigen die abgegebenen Stimmzettel.");
    const present = position.election.presentEligible;
    if (present != null && input.ballotsCast > present) {
      throw new UserError(`Es wurden mehr Stimmzettel abgegeben (${input.ballotsCast}) als Stimmberechtigte anwesend sind (${present}).`);
    }
    const single = position.mode === "EINZEL";
    const noVotes = single && step.candidateIds.length === 1 ? input.noVotes : 0;
    if (single && candidateVotes + noVotes !== valid) {
      throw new UserError(`Die Stimmen (${candidateVotes + noVotes}) passen nicht zu den gültigen Stimmzetteln (${valid}).`);
    }
    if (!single && !input.override && valid > 0 && !collectiveVotesPlausible(candidateVotes, valid, step.seats)) {
      throw new UserError(
        `Plausibilität: Bei ${valid} gültigen Stimmzetteln und ${step.seats} Plätzen sind ${Math.ceil(step.seats / 2) * valid} bis ${step.seats * valid} Stimmen möglich, erfasst sind ${candidateVotes}. Zählung prüfen oder bewusst übernehmen.`,
      );
    }
    const flow = { stage: step.stage, round: step.round, candidateIds: step.candidateIds, noVotes, votes };
    const result = evaluateRound(position.mode, position.seats, flow, step.carried);
    const elected = "elected" in result ? result.elected : [];
    const created = await tx.electionRound.create({
      data: {
        positionId,
        sequence: input.sequence,
        stage: step.stage,
        round: step.round,
        candidateIds: step.candidateIds,
        ballotsCast: input.ballotsCast,
        invalid: input.invalid,
        abstentions: input.abstentions,
        noVotes,
        votes,
        resultKind: result.kind,
        resultText: result.text,
        elected,
        createdById: actor.id,
      },
    });
    if (position.election.status === "PLANUNG") await tx.election.update({ where: { id: position.electionId }, data: { status: "LAUFEND" } });
    await audit(tx, actor, "election.round.record", "ElectionRound", created.id, {
      position: position.title,
      round: roundLabel(step.stage, step.round),
      ballotsCast: input.ballotsCast,
      invalid: input.invalid,
      abstentions: input.abstentions,
      votes,
      result: result.kind,
    });
    return { result };
  });
}

export async function recordLot(actor: Actor, positionId: string, winners: string[]) {
  assertCan(actor, "election.manage");
  return db.$transaction(async (tx) => {
    const position = await tx.electionPosition.findUnique({ where: { id: positionId }, include: { candidates: true, rounds: { orderBy: { sequence: "asc" } } } });
    if (!position) throw new NotFoundError();
    const step = positionStep(position as unknown as PositionFull);
    if (step.done || step.stage !== "LOS") throw new UserError("Ein Losentscheid ist hier nicht vorgesehen.");
    const picked = [...new Set(winners)].filter((w) => step.candidateIds.includes(w));
    if (picked.length !== step.seats) throw new UserError(`Bitte genau ${step.seats} durch Los gezogene Person(en) auswählen.`);
    const elected = [...step.carried, ...picked];
    await tx.electionRound.create({
      data: {
        positionId,
        sequence: position.rounds.length + 1,
        stage: "LOS",
        round: 1,
        candidateIds: step.candidateIds,
        resultKind: "GEWAEHLT",
        resultText: "Durch Los entschieden (LV-Satzung § 57).",
        elected,
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "election.round.lot", "ElectionPosition", positionId, { position: position.title, elected });
  });
}

export async function deleteLastRound(actor: Actor, positionId: string) {
  assertCan(actor, "election.manage");
  await db.$transaction(async (tx) => {
    const last = await tx.electionRound.findFirst({ where: { positionId }, orderBy: { sequence: "desc" }, include: { position: { include: { election: true } } } });
    if (!last) throw new UserError("Es gibt keinen Wahlgang zum Zurücknehmen.");
    if (last.position.election.status === "ABGESCHLOSSEN") throw new UserError("Die Wahl ist abgeschlossen.");
    await tx.electionRound.delete({ where: { id: last.id } });
    await audit(tx, actor, "election.round.delete", "ElectionRound", last.id, { position: last.position.title, sequence: last.sequence, votes: last.votes });
  });
}

// ---------------------------------------------------------------------------
// Niederschrift (LV-Satzung § 51 Abs. 2): alle Bewerber, gültige Stimmen, Stimmen je Bewerber, offen/geheim
// ---------------------------------------------------------------------------

export function electionProtocol(election: ElectionFull, ovName: string): string {
  const lines: string[] = [];
  lines.push(`Wahlen – ${election.title}`);
  lines.push(`${ovName}, ${formatDateLong(election.date)}${election.location ? `, ${election.location}` : ""}`);
  lines.push("");
  if (election.chair) lines.push(`Versammlungsleitung: ${election.chair}`);
  if (election.countingCommittee) lines.push(`Zählkommission: ${election.countingCommittee}`);
  if (election.presentEligible != null) lines.push(`Anwesende Stimmberechtigte laut Anwesenheitsliste: ${election.presentEligible}`);
  lines.push("Alle Wahlen wurden geheim mit Stimmzetteln durchgeführt (LV-Satzung § 57 Abs. 1, Statut § 43 Abs. 1).");
  for (const p of election.positions) {
    const name = (id: string) => p.candidates.find((c) => c.id === id)?.name ?? "?";
    lines.push("");
    lines.push(`${p.title}${p.mode === "SAMMEL" ? ` (Sammelwahl, ${p.seats} ${p.seats === 1 ? "Platz" : "Plätze"})` : ""}`);
    lines.push(`Vorgeschlagen: ${p.candidates.map((c) => c.name + (c.withdrawn ? " (verzichtet)" : "")).join(", ") || "–"}`);
    for (const r of p.rounds) {
      if (r.stage === "LOS") {
        lines.push(`- Losentscheid zwischen ${r.candidateIds.map(name).join(", ")}: gezogen ${r.elected.filter((id) => r.candidateIds.includes(id)).map(name).join(", ")}`);
        continue;
      }
      const valid = r.ballotsCast - r.invalid - r.abstentions;
      const votes = r.votes as Record<string, number>;
      const detail = r.candidateIds
        .map((id) => `${name(id)} ${votes[id] ?? 0}`)
        .concat(r.noVotes ? [`Nein ${r.noVotes}`] : [])
        .join(", ");
      lines.push(
        `- ${roundLabel(r.stage, r.round)}: abgegeben ${r.ballotsCast}, ungültig ${r.invalid}, Enthaltungen ${r.abstentions}, gültig ${valid}. Stimmen: ${detail}.`,
      );
    }
    const step = positionStep(p);
    if (step.done && step.elected.length) {
      lines.push(`Gewählt: ${step.elected.map((id) => {
        const c = p.candidates.find((x) => x.id === id);
        const acc = c?.accepted === true ? " – nimmt die Wahl an" : c?.accepted === false ? " – nimmt die Wahl nicht an" : "";
        return `${name(id)}${acc}`;
      }).join("; ")}`);
    } else if (step.done) {
      lines.push(`Ergebnis: ${step.label}`);
    } else if (p.rounds.length) {
      lines.push(`Offen: ${step.label}`);
    }
  }
  return lines.join("\n");
}
