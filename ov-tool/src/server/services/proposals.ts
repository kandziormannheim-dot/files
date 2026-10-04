import "server-only";
import type { User } from "@prisma/client";
import { checkbox, formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { queueMail } from "@/server/mail/outbox";
import { renderMail } from "@/server/mail/render";
import { appUrl } from "@/server/ov";
import { addAgendaItem } from "./meetings";
import { CONVENE_REQUEST_SUPPORTERS, conveneRequestReached } from "./statute";

type Actor = Pick<User, "id" | "role" | "name">;

const proposalSchema = z.object({
  title: requiredText(300),
  description: optionalText(5000),
  meetingId: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  isConveneRequest: checkbox,
});

export async function createProposal(actor: Actor, formData: FormData) {
  assertCan(actor, "agenda.propose");
  const v = proposalSchema.parse(formToObject(formData));
  if (v.meetingId) {
    const m = await db.meeting.findUnique({ where: { id: v.meetingId } });
    if (!m || !["GEPLANT", "EINGELADEN"].includes(m.status)) throw new UserError("Für diese Sitzung sind keine Vorschläge mehr möglich.");
  }
  return db.$transaction(async (tx) => {
    const p = await tx.agendaProposal.create({
      data: {
        title: v.title,
        description: v.description ?? "",
        meetingId: v.meetingId ?? null,
        isConveneRequest: v.isConveneRequest,
        proposedById: actor.id,
      },
    });
    await audit(tx, actor, "proposal.create", "AgendaProposal", p.id, { title: p.title, convene: p.isConveneRequest });
    return p;
  });
}

export function listProposals(actor: Pick<User, "role">) {
  assertCan(actor, "read");
  return db.agendaProposal.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      proposedBy: { select: { id: true, name: true } },
      supporters: { include: { user: { select: { id: true, name: true } } } },
      meeting: { select: { id: true, startsAt: true, type: true, title: true } },
      agendaItem: { select: { meetingId: true } },
    },
    take: 200,
  });
}

/** Unterstützung eines Antrags auf Einberufung; ab fünf Mitgliedern wird der Admin informiert (LV § 31 Abs. 3). */
export async function toggleSupport(actor: Actor, proposalId: string) {
  assertCan(actor, "agenda.propose");
  const p = await db.agendaProposal.findUnique({ where: { id: proposalId }, include: { supporters: true } });
  if (!p) throw new NotFoundError("Vorschlag nicht gefunden.");
  if (!p.isConveneRequest || p.status !== "OFFEN") throw new UserError("Nur offene Anträge auf Einberufung können unterstützt werden.");
  if (p.proposedById === actor.id) throw new UserError("Als Antragsteller zählen Sie bereits mit.");
  const supporting = p.supporters.some((s) => s.userId === actor.id);
  const count = await db.$transaction(async (tx) => {
    if (supporting) await tx.proposalSupporter.delete({ where: { proposalId_userId: { proposalId, userId: actor.id } } });
    else await tx.proposalSupporter.create({ data: { proposalId, userId: actor.id } });
    await audit(tx, actor, supporting ? "proposal.unsupport" : "proposal.support", "AgendaProposal", proposalId);
    return tx.proposalSupporter.count({ where: { proposalId } });
  });
  if (!supporting && conveneRequestReached(count) && !p.adminNotifiedAt) {
    await db.agendaProposal.update({ where: { id: proposalId }, data: { adminNotifiedAt: new Date() } });
    const admins = await db.user.findMany({ where: { role: "ADMIN", active: true } });
    const mail = await renderMail("antrag.einberufung", {
      antrag: {
        titel: p.title,
        beschreibung: p.description,
        unterstuetzer: count + 1,
        erforderlich: CONVENE_REQUEST_SUPPORTERS,
        link: `${appUrl()}/meetings/proposals`,
      },
    });
    for (const a of admins) await queueMail({ to: a.email, subject: mail.subject, text: mail.text, html: mail.html });
  }
}

/** Admin übernimmt einen Vorschlag in die TO einer Sitzung. */
export async function acceptProposal(actor: Actor, proposalId: string, meetingId: string) {
  assertCan(actor, "meeting.manage");
  const p = await db.agendaProposal.findUnique({ where: { id: proposalId } });
  if (!p || p.status !== "OFFEN") throw new UserError("Der Vorschlag ist nicht mehr offen.");
  await db.$transaction(async (tx) => {
    await addAgendaItem(actor, meetingId, { title: p.title, description: p.description, proposalId: p.id }, tx);
    await tx.agendaProposal.update({ where: { id: proposalId }, data: { status: "UEBERNOMMEN", meetingId } });
    await audit(tx, actor, "proposal.accept", "AgendaProposal", proposalId, { meetingId });
  });
}

export async function rejectProposal(actor: Actor, proposalId: string, formData: FormData) {
  assertCan(actor, "meeting.manage");
  const { decisionNote } = z.object({ decisionNote: optionalText(1000) }).parse(formToObject(formData));
  const p = await db.agendaProposal.findUnique({ where: { id: proposalId } });
  if (!p || p.status !== "OFFEN") throw new UserError("Der Vorschlag ist nicht mehr offen.");
  await db.$transaction(async (tx) => {
    await tx.agendaProposal.update({ where: { id: proposalId }, data: { status: "VERWORFEN", decisionNote: decisionNote ?? "" } });
    await audit(tx, actor, "proposal.reject", "AgendaProposal", proposalId, { note: decisionNote });
  });
}
