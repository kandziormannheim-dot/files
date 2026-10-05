import "server-only";
import type { User } from "@prisma/client";
import { parseDateTimeInput } from "@/lib/dates";
import { checkbox, formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan, can } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";

// Meinungsbild im Vorstand (SPEC.md 3.13): ausdrücklich NICHT bindend – keine Beschlüsse, keine Wahlen.
// Förmliche Abstimmungen laufen in der Sitzung (Protokoll) oder im Umlaufverfahren.

type Actor = Pick<User, "id" | "role">;

export const POLL_NOTICE = "Meinungsbild – nicht bindend. Kein Beschluss im Sinne der Satzung.";

export function pollOpen(p: { closedAt: Date | null; closesAt: Date | null }, now = new Date()) {
  return !p.closedAt && (!p.closesAt || p.closesAt > now);
}

export async function listPolls(actor: Actor) {
  assertCan(actor, "read");
  const polls = await db.poll.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { votes: { select: { userId: true } } } });
  return polls.map((p) => ({ ...p, voteCount: p.votes.length, voted: p.votes.some((v) => v.userId === actor.id), open: pollOpen(p) }));
}

export async function getPoll(actor: Actor, id: string) {
  assertCan(actor, "read");
  const poll = await db.poll.findUnique({ where: { id }, include: { votes: true } });
  if (!poll) throw new NotFoundError();
  const counts = poll.options.map((_, i) => poll.votes.filter((v) => v.choices.includes(i)).length);
  const mine = poll.votes.find((v) => v.userId === actor.id)?.choices ?? null;
  let voters: { name: string; choices: number[] }[] = [];
  if (!poll.anonymous) {
    const users = await db.user.findMany({ where: { id: { in: poll.votes.map((v) => v.userId) } }, select: { id: true, name: true } });
    voters = poll.votes.map((v) => ({ name: users.find((u) => u.id === v.userId)?.name ?? "?", choices: v.choices })).sort((a, b) => a.name.localeCompare(b.name, "de"));
  }
  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    options: poll.options,
    multiple: poll.multiple,
    anonymous: poll.anonymous,
    closesAt: poll.closesAt,
    closedAt: poll.closedAt,
    createdAt: poll.createdAt,
    open: pollOpen(poll),
    total: poll.votes.length,
    counts,
    mine,
    voters,
    canClose: poll.createdById === actor.id || can(actor.role, "meeting.manage"),
  };
}

const createSchema = z.object({
  question: requiredText(300),
  description: optionalText(2000),
  options: z
    .string()
    .transform((v) => [...new Set(v.split(/\r?\n/).map((o) => o.trim()).filter(Boolean))])
    .pipe(z.array(z.string().max(200)).min(2, { error: "Mindestens zwei Antwortmöglichkeiten, je Zeile eine." }).max(20)),
  multiple: checkbox,
  anonymous: checkbox,
  closesAt: optionalText(30),
});

export async function createPoll(actor: Actor, formData: FormData) {
  assertCan(actor, "poll.create");
  const input = createSchema.parse(formToObject(formData));
  const closesAt = input.closesAt ? parseDateTimeInput(input.closesAt) : null;
  if (input.closesAt && !closesAt) throw new UserError("Ungültiges Enddatum.");
  return db.$transaction(async (tx) => {
    const poll = await tx.poll.create({
      data: {
        question: input.question,
        description: input.description ?? "",
        options: input.options,
        multiple: input.multiple,
        anonymous: input.anonymous,
        closesAt,
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "poll.create", "Poll", poll.id, { question: poll.question, anonymous: poll.anonymous });
    return poll;
  });
}

export async function votePoll(actor: Actor, pollId: string, choices: number[]) {
  assertCan(actor, "read");
  if (!can(actor.role, "meeting.respond")) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    const poll = await tx.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundError();
    if (!pollOpen(poll)) throw new UserError("Das Meinungsbild ist beendet.");
    const picked = [...new Set(choices)].filter((c) => Number.isInteger(c) && c >= 0 && c < poll.options.length);
    if (picked.length === 0) throw new UserError("Bitte eine Antwort wählen.");
    if (!poll.multiple && picked.length > 1) throw new UserError("Nur eine Antwort möglich.");
    await tx.pollVote.upsert({
      where: { pollId_userId: { pollId, userId: actor.id } },
      create: { pollId, userId: actor.id, choices: picked },
      update: { choices: picked, createdAt: new Date() },
    });
    // Bei anonymen Meinungsbildern keine Antwort ins Audit-Log
    await audit(tx, actor, "poll.vote", "Poll", pollId, poll.anonymous ? {} : { choices: picked });
  });
}

export async function closePoll(actor: Actor, pollId: string) {
  assertCan(actor, "read");
  await db.$transaction(async (tx) => {
    const poll = await tx.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundError();
    if (poll.createdById !== actor.id && !can(actor.role, "meeting.manage")) throw new ForbiddenError();
    await tx.poll.update({ where: { id: pollId }, data: { closedAt: new Date() } });
    await audit(tx, actor, "poll.close", "Poll", pollId, {});
  });
}
