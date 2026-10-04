import "server-only";
import type { AgendaItem, Meeting } from "@prisma/client";
import { numberAgenda } from "@/lib/agenda";
import { MEETING_TYPE_LABELS } from "@/lib/meetings";
import { db } from "@/server/db";
import { readSignatureDataUri } from "@/server/files";
import { getSettings } from "./settings";

// Vorlagen-Kontext (Platzhalter siehe templates/README.md). Datum und Uhrzeit werden als Date übergeben
// und erst in der Vorlage über die Helfer formatiert – so gibt es nur ein einziges Feld je Zeitpunkt.

export async function meetingContext(meeting: Meeting) {
  const art = MEETING_TYPE_LABELS[meeting.type];
  return {
    art: art.art,
    artGenitiv: art.genitiv,
    beginn: meeting.startsAt,
    ende: meeting.endsAt,
    ort: meeting.location,
    onlineLink: meeting.onlineUrl,
    rueckmeldungBis: meeting.responseDeadline,
    einladungVom: meeting.invitationSentAt ?? new Date(),
    einladungsweg: "per E-Mail",
    absagegrund: meeting.cancelReason,
    eroeffnetUm: meeting.openedAt ?? meeting.startsAt,
    geschlossenUm: meeting.closedAt ?? meeting.endsAt,
    unterbrechung: meeting.interruptionNote,
    sitzungsleitung: meeting.chairNote,
    beschlussfaehig: meeting.quorumReached ?? false,
    quorumAnwesend: meeting.quorumPresent ?? 0,
    quorumStimmberechtigt: meeting.quorumEligible ?? 0,
    feststellungDurch: meeting.quorumDeterminedBy,
    wiederholungNachBeschlussunfaehigkeit: meeting.isRepeatAfterNoQuorum,
    eilbeduerftig: meeting.urgent,
    eilbeduerftigBegruendung: meeting.urgencyReason,
  };
}

export function agendaContext(items: AgendaItem[]) {
  return numberAgenda(items).map((i) => ({ nummer: i.number, titel: i.title, ebene: i.level, status: i.status }));
}

/**
 * Absender (Platzhalter absender.*): der Vorsitzende aus den Einstellungen, sonst die handelnde Person.
 * Für PDFs wird das Unterschriftsbild als data-URI eingebettet.
 */
export async function senderContext(actingUserId?: string, opts: { withSignature?: boolean } = {}) {
  const settings = await getSettings();
  const id = settings.ov.chairUserId || actingUserId;
  const user = id ? await db.user.findUnique({ where: { id } }) : null;
  if (!user) return { name: "", funktion: "", unterschrift: undefined as string | undefined };
  return {
    name: user.name,
    funktion: user.functionTitle,
    unterschrift: opts.withSignature ? await readSignatureDataUri(user.signatureImagePath) : undefined,
  };
}
