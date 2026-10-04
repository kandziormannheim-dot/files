import "server-only";
import { District, TopicEventType, TopicStatus, type Prisma, type User } from "@prisma/client";
import { addMonths } from "@/lib/months";
import { checkbox, formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { parseDateInput } from "@/lib/dates";
import { TOPIC_STATUS_LABELS } from "@/lib/labels";
import { assertCan, can, canEditOwned } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { decrypt, encrypt } from "@/server/crypto";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { getSettings } from "./settings";

// Stadtteil-Themen und Bürgeranliegen (SPEC.md 3.8)

type Actor = Pick<User, "id" | "role" | "name">;

export const topicInclude = {
  responsible: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TopicInclude;

export function canEditTopic(actor: Pick<User, "id" | "role">, t: { createdById: string | null; responsibleId: string | null }) {
  return canEditOwned(actor.role, "topic.editAll", actor.id, [t.createdById, t.responsibleId]);
}

export type TopicFilter = { status?: TopicStatus | "AKTIV"; district?: District; category?: string; q?: string; concerns?: boolean };

export async function listTopics(actor: Pick<User, "role">, f: TopicFilter) {
  assertCan(actor, "read");
  const where: Prisma.TopicWhereInput = {};
  if (f.status === "AKTIV") where.status = { notIn: ["ERLEDIGT", "ZURUECKGESTELLT"] };
  else if (f.status) where.status = f.status;
  if (f.district) where.district = f.district === "BEIDE" ? "BEIDE" : { in: [f.district, "BEIDE"] };
  if (f.category) where.category = f.category;
  if (f.concerns) where.isCitizenConcern = true;
  if (f.q) where.OR = [{ title: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }];
  return db.topic.findMany({ where, orderBy: { updatedAt: "desc" }, include: topicInclude, take: 300 });
}

export async function getTopic(actor: Pick<User, "role">, id: string) {
  assertCan(actor, "read");
  const t = await db.topic.findUnique({
    where: { id },
    include: {
      ...topicInclude,
      events: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { author: { select: { name: true } } } },
      agendaItems: { include: { meeting: { select: { id: true, startsAt: true, type: true, title: true } } } },
    },
  });
  if (!t) throw new NotFoundError("Thema nicht gefunden.");
  return t;
}

/** Kontaktdaten nur für Vorstand und Admin sichtbar (entschlüsselt). */
export function readContact(actor: Pick<User, "role">, t: { citizenContact: string | null }): string | null {
  if (!t.citizenContact || !can(actor.role, "topic.create")) return null;
  try {
    return decrypt(t.citizenContact);
  } catch {
    return "(nicht lesbar – Schlüssel geändert?)";
  }
}

const topicSchema = z.object({
  title: requiredText(300),
  description: optionalText(10_000),
  category: requiredText(100),
  district: z.enum(District),
  status: z.enum(TopicStatus).default("NEU"),
  responsibleId: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  forNextMeeting: checkbox,
  isCitizenConcern: checkbox,
  citizenContact: optionalText(2000),
  citizenConsent: checkbox,
  removeContact: checkbox,
});

async function contactDeleteAfter(status: TopicStatus, current: Date | null) {
  if (status !== "ERLEDIGT") return null;
  if (current) return current;
  const s = await getSettings();
  return addMonths(new Date(), s.retention.citizenContactMonths);
}

function parseTopic(formData: FormData) {
  const v = topicSchema.parse(formToObject(formData));
  if (v.citizenContact && !v.citizenConsent) {
    throw new UserError("Kontaktdaten nur mit Einwilligung der Person speichern (Häkchen „Einwilligung liegt vor“).");
  }
  return v;
}

export async function createTopic(actor: Actor, formData: FormData) {
  assertCan(actor, "topic.create");
  const v = parseTopic(formData);
  return db.$transaction(async (tx) => {
    const t = await tx.topic.create({
      data: {
        title: v.title,
        description: v.description ?? "",
        category: v.category,
        district: v.district,
        status: v.status,
        responsibleId: v.responsibleId ?? null,
        forNextMeeting: v.forNextMeeting,
        isCitizenConcern: v.isCitizenConcern || !!v.citizenContact,
        citizenContact: v.citizenContact ? encrypt(v.citizenContact) : null,
        citizenConsentAt: v.citizenContact ? new Date() : null,
        contactDeleteAfter: await contactDeleteAfter(v.status, null),
        resolvedAt: v.status === "ERLEDIGT" ? new Date() : null,
        createdById: actor.id,
      },
    });
    await tx.topicEvent.create({ data: { topicId: t.id, type: "NOTIZ", text: "Thema angelegt.", date: new Date(), authorId: actor.id } });
    // Kontaktdaten nie ins Audit-Log schreiben
    await audit(tx, actor, "topic.create", "Topic", t.id, { title: t.title, status: t.status, contact: !!v.citizenContact });
    return t;
  });
}

export async function updateTopic(actor: Actor, id: string, formData: FormData) {
  const before = await getTopic(actor, id);
  if (!canEditTopic(actor, before)) throw new ForbiddenError();
  const v = parseTopic(formData);
  const statusChanged = before.status !== v.status;
  const data = {
    title: v.title,
    description: v.description ?? "",
    category: v.category,
    district: v.district,
    status: v.status,
    responsibleId: v.responsibleId ?? null,
    forNextMeeting: v.forNextMeeting,
    isCitizenConcern: v.isCitizenConcern || !!v.citizenContact || (!!before.citizenContact && !v.removeContact),
  };
  const contactUpdate = v.removeContact
    ? { citizenContact: null, citizenConsentAt: null, contactDeletedAt: new Date() }
    : v.citizenContact
      ? { citizenContact: encrypt(v.citizenContact), citizenConsentAt: new Date(), contactDeletedAt: null }
      : {};
  await db.$transaction(async (tx) => {
    await tx.topic.update({
      where: { id },
      data: {
        ...data,
        ...contactUpdate,
        resolvedAt: v.status === "ERLEDIGT" ? (before.resolvedAt ?? new Date()) : null,
        contactDeleteAfter: await contactDeleteAfter(v.status, before.status === "ERLEDIGT" ? before.contactDeleteAfter : null),
      },
    });
    if (statusChanged) {
      await tx.topicEvent.create({
        data: {
          topicId: id,
          type: "STATUS",
          text: `Status: ${TOPIC_STATUS_LABELS[before.status]} → ${TOPIC_STATUS_LABELS[v.status]}`,
          date: new Date(),
          authorId: actor.id,
        },
      });
    }
    await audit(tx, actor, "topic.update", "Topic", id, {
      ...changes(before, data),
      ...(v.removeContact ? { contact: "gelöscht" } : v.citizenContact ? { contact: "geändert" } : {}),
    });
  });
}

const eventSchema = z.object({
  type: z.enum(TopicEventType),
  text: requiredText(10_000),
  date: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

export async function addTopicEvent(actor: Actor, topicId: string, formData: FormData) {
  assertCan(actor, "topic.create");
  await getTopic(actor, topicId);
  const v = eventSchema.parse(formToObject(formData));
  await db.$transaction(async (tx) => {
    const e = await tx.topicEvent.create({
      data: { topicId, type: v.type, text: v.text, date: (v.date && parseDateInput(v.date)) || new Date(), authorId: actor.id },
    });
    await tx.topic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });
    await audit(tx, actor, "topic.event", "Topic", topicId, { eventId: e.id, type: v.type });
  });
}

export async function setForNextMeeting(actor: Actor, topicId: string, value: boolean) {
  assertCan(actor, "topic.create");
  const t = await getTopic(actor, topicId);
  if (!canEditTopic(actor, t) && !can(actor.role, "meeting.manage")) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.topic.update({ where: { id: topicId }, data: { forNextMeeting: value } });
    await audit(tx, actor, "topic.forNextMeeting", "Topic", topicId, { value });
  });
}

export async function deleteTopic(actor: Actor, id: string) {
  const t = await getTopic(actor, id);
  if (!can(actor.role, "topic.editAll") && t.createdById !== actor.id) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.topic.delete({ where: { id } });
    await tx.attachment.deleteMany({ where: { ownerType: "Topic", ownerId: id } });
    await audit(tx, actor, "topic.delete", "Topic", id, { title: t.title });
  });
}
