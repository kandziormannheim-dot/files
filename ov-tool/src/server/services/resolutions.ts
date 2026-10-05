import "server-only";
import type { Prisma, User } from "@prisma/client";
import { numberAgenda } from "@/lib/agenda";
import { meetingTitle } from "@/lib/meetings";
import { formToObject, optionalText, requiredText, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit, changes } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { renderMail } from "@/server/mail/render";
import { mailReplyTo, sendMail } from "@/server/mail/transport";
import { ovContext } from "@/server/ov";
import { renderDocumentPdf, renderDocumentPreview } from "@/server/pdf/render";
import { RESULT_LABELS, resultText } from "./minutes";
import { getSettings } from "./settings";
import { senderContext } from "./template-context";

// Beschlüsse des OV als PDF (Briefbogen) und als Antrag an den Kreisverband einreichen.

type Actor = Pick<User, "id" | "role">;

const include = {
  meeting: { include: { agendaItems: true } },
  circulation: true,
  motions: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.ResolutionInclude;

export type ResolutionFull = Prisma.ResolutionGetPayload<{ include: typeof include }>;

export function listResolutions(actor: Actor) {
  assertCan(actor, "read");
  return db.resolution.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { meeting: { select: { id: true, startsAt: true, type: true, title: true } }, circulation: { select: { id: true, number: true } }, motions: { select: { id: true, status: true, sentAt: true } } },
  });
}

export async function getResolution(actor: Actor, id: string): Promise<ResolutionFull> {
  assertCan(actor, "read");
  const r = await db.resolution.findUnique({ where: { id }, include });
  if (!r) throw new NotFoundError();
  return r;
}

/** Wortlaut: Beschlusstext aus dem Protokoll (Ergebnis des TOP) bzw. Text des Umlaufverfahrens. */
async function wording(r: ResolutionFull) {
  if (r.circulation) return { wortlaut: r.circulation.text, begruendung: r.circulation.reason };
  if (r.agendaItemId) {
    const section = await db.minutesSection.findFirst({ where: { agendaItemId: r.agendaItemId, minutes: { isCurrent: true } }, orderBy: { id: "desc" } });
    if (section?.outcomeText) return { wortlaut: section.outcomeText, begruendung: "" };
  }
  return { wortlaut: "", begruendung: "" };
}

export async function resolutionContext(r: ResolutionFull) {
  const ov = await ovContext();
  const numbered = r.meeting ? numberAgenda(r.meeting.agendaItems) : [];
  const top = numbered.find((n) => n.id === r.agendaItemId);
  const stimmen = r.votesYes !== null ? `Ja ${r.votesYes}, Nein ${r.votesNo ?? 0}, Enthaltung ${r.votesAbstain ?? 0}` : "";
  const m = r.meeting;
  const datum = r.circulation?.determinedAt ?? m?.startsAt ?? r.createdAt;
  const verfahren = r.circulation
    ? `Umlaufverfahren ${r.circulation.number} (Statut § 42 Abs. 3)`
    : m
      ? `${meetingTitle(m)}${m.location ? `, ${m.location}` : ""}`
      : "Vorstand";
  const beschlussfaehigkeit = m?.quorumPresent != null && m.quorumEligible != null ? `${m.quorumReached ? "gegeben" : "nicht festgestellt"} (${m.quorumPresent} von ${m.quorumEligible} Stimmberechtigten anwesend)` : r.circulation ? `Mehrheit aller ${r.circulation.eligibleCount} Stimmberechtigten erforderlich` : "";
  return {
    nummer: r.number,
    gremium: `Vorstand der ${ov.nameLang}`,
    gegenstand: r.subject,
    datum,
    verfahren,
    top: top?.number ?? "",
    topTitel: top?.title ?? "",
    ergebnisText: resultText(r),
    ergebnisKurz: RESULT_LABELS[r.resultType],
    stimmen,
    beschlussfaehigkeit,
    ...(await wording(r)),
    ausgestelltAm: new Date(),
  };
}

export async function resolutionPdf(actor: Actor, id: string) {
  const r = await getResolution(actor, id);
  const { pdf } = await renderDocumentPdf("beschluss.dokument", { beschluss: await resolutionContext(r), absender: await senderContext(actor.id, { withSignature: true }) }, `Beschluss ${r.number}`);
  return { pdf, fileName: `Beschluss-${r.number}.pdf` };
}

export async function resolutionPreview(actor: Actor, id: string) {
  const r = await getResolution(actor, id);
  return renderDocumentPreview("beschluss.dokument", { beschluss: await resolutionContext(r), absender: await senderContext(actor.id, { withSignature: true }) }, `Beschluss ${r.number}`);
}

// ---------------------------------------------------------------------------
// Anträge
// ---------------------------------------------------------------------------

export async function motionDefaults(r: ResolutionFull) {
  const settings = await getSettings();
  const ctx = await resolutionContext(r);
  return {
    title: r.subject,
    recipientName: "CDU-Kreisverband Mannheim\nKreisvorstand",
    recipientEmail: settings.office.email,
    body: ctx.wortlaut || `Der Kreisvorstand möge beschließen:\n\n${r.subject}`,
    reason: ctx.begruendung,
  };
}

const motionSchema = z.object({
  title: requiredText(300),
  recipientName: requiredText(300),
  recipientEmail: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email({ error: "Bitte die E-Mail-Adresse der Kreisgeschäftsstelle angeben." })),
  ccEmail: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim().toLowerCase() : v), z.email({ error: "Ungültige Adresse." }).optional()),
  body: requiredText(20000),
  reason: optionalText(20000),
});

export async function saveMotion(actor: Actor, resolutionId: string, motionId: string | null, formData: FormData) {
  assertCan(actor, "motion.send");
  const input = motionSchema.parse(formToObject(formData));
  const data = { title: input.title, recipientName: input.recipientName, recipientEmail: input.recipientEmail, ccEmail: input.ccEmail ?? "", body: input.body, reason: input.reason ?? "" };
  return db.$transaction(async (tx) => {
    const r = await tx.resolution.findUnique({ where: { id: resolutionId } });
    if (!r) throw new NotFoundError();
    if (!["ANGENOMMEN_EINSTIMMIG", "ANGENOMMEN_MEHRHEITLICH"].includes(r.resultType)) throw new UserError("Nur angenommene Beschlüsse können als Antrag eingereicht werden.");
    if (motionId) {
      const before = await tx.motion.findUnique({ where: { id: motionId } });
      if (!before || before.resolutionId !== resolutionId) throw new NotFoundError();
      if (before.status === "EINGEREICHT") throw new UserError("Der Antrag ist bereits eingereicht und kann nicht mehr geändert werden.");
      await tx.motion.update({ where: { id: motionId }, data });
      await audit(tx, actor, "motion.update", "Motion", motionId, changes(before as unknown as Record<string, unknown>, data));
      return before;
    }
    const m = await tx.motion.create({ data: { ...data, resolutionId, createdById: actor.id } });
    await audit(tx, actor, "motion.create", "Motion", m.id, { resolution: r.number, title: m.title });
    return m;
  });
}

async function motionPdfFor(actor: Actor, motionId: string) {
  const motion = await db.motion.findUnique({ where: { id: motionId } });
  if (!motion) throw new NotFoundError();
  const r = await getResolution(actor, motion.resolutionId);
  const beschluss = await resolutionContext(r);
  const absender = await senderContext(actor.id, { withSignature: true });
  const antrag = { titel: motion.title, empfaenger: motion.recipientName, datum: motion.sentAt ?? new Date(), text: motion.body, begruendung: motion.reason };
  const { pdf } = await renderDocumentPdf("antrag.dokument", { beschluss, eingabe: antrag, absender }, `Antrag ${motion.title}`);
  return { motion, r, beschluss, antrag, absender, pdf };
}

export async function motionPdf(actor: Actor, motionId: string) {
  assertCan(actor, "read");
  const { pdf, motion } = await motionPdfFor(actor, motionId);
  return { pdf, fileName: `Antrag-${motion.title.replace(/[^\wäöüÄÖÜß-]+/g, "-").slice(0, 60)}.pdf` };
}

/** Einreichen: Begleit-Mail mit Antrag und Beschluss als PDF an die Kreisgeschäftsstelle; Versand wird festgehalten. */
export async function sendMotion(actor: Actor, motionId: string) {
  assertCan(actor, "motion.send");
  const { motion, r, beschluss, antrag, absender, pdf } = await motionPdfFor(actor, motionId);
  if (motion.status === "EINGEREICHT") throw new UserError("Der Antrag wurde bereits eingereicht.");
  const { pdf: beschlussPdf } = await renderDocumentPdf("beschluss.dokument", { beschluss, absender }, `Beschluss ${r.number}`);
  const mail = await renderMail("antrag.versand", { beschluss, eingabe: antrag, absender });
  const sender = await db.user.findUnique({ where: { id: actor.id }, select: { email: true } });
  const cc = [motion.ccEmail, sender?.email].filter((x): x is string => !!x && x !== motion.recipientEmail);
  await sendMail({
    to: motion.recipientEmail,
    ...(cc.length ? { cc: [...new Set(cc)].join(", ") } : {}),
    replyTo: sender?.email ?? mailReplyTo(),
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: [
      { filename: `Antrag-${r.number}.pdf`, content: pdf, contentType: "application/pdf" },
      { filename: `Beschluss-${r.number}.pdf`, content: beschlussPdf, contentType: "application/pdf" },
    ],
  });
  await db.$transaction(async (tx) => {
    await tx.motion.update({ where: { id: motionId }, data: { status: "EINGEREICHT", sentAt: new Date(), sentById: actor.id } });
    await audit(tx, actor, "motion.send", "Motion", motionId, { to: motion.recipientEmail, cc, resolution: r.number });
  });
  return { to: motion.recipientEmail };
}

export async function deleteMotion(actor: Actor, motionId: string) {
  assertCan(actor, "motion.send");
  await db.$transaction(async (tx) => {
    const m = await tx.motion.findUnique({ where: { id: motionId } });
    if (!m) throw new NotFoundError();
    if (m.status === "EINGEREICHT") throw new UserError("Eingereichte Anträge bleiben zur Dokumentation erhalten.");
    await tx.motion.delete({ where: { id: motionId } });
    await audit(tx, actor, "motion.delete", "Motion", motionId, { title: m.title });
  });
}
