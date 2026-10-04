// Bezeichnungen und kleine Helfer für Sitzungen (ohne DB).
import type { MeetingFormat, MeetingStatus, MeetingType, Presence, RsvpResponse } from "@prisma/client";
import { formatDate } from "./dates";

export const MEETING_TYPE_LABELS: Record<MeetingType, { art: string; genitiv: string }> = {
  VORSTANDSSITZUNG: { art: "Vorstandssitzung", genitiv: "Vorstandssitzung" },
  ERWEITERTE_VORSTANDSSITZUNG: { art: "erweiterte Vorstandssitzung", genitiv: "erweiterten Vorstandssitzung" },
  KLAUSURTAGUNG: { art: "Klausurtagung", genitiv: "Klausurtagung" },
  SONSTIGE: { art: "Sitzung", genitiv: "Sitzung" },
};

export const MEETING_FORMAT_LABELS: Record<MeetingFormat, string> = {
  PRAESENZ: "Präsenz",
  DIGITAL: "digital",
  HYBRID: "hybrid",
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  GEPLANT: "geplant",
  EINGELADEN: "eingeladen",
  DURCHGEFUEHRT: "durchgeführt",
  AUFGEHOBEN: "aufgehoben",
  ABGESAGT: "abgesagt",
};

export const RSVP_LABELS: Record<RsvpResponse, string> = { OFFEN: "keine Rückmeldung", ZUGESAGT: "zugesagt", ABGESAGT: "abgesagt" };

export const PRESENCE_LABELS: Record<Presence, string> = {
  ANWESEND: "anwesend",
  ANWESEND_DIGITAL: "anwesend (digital)",
  ENTSCHULDIGT: "entschuldigt",
  NICHT_ANWESEND: "nicht anwesend",
};

export function meetingTitle(m: { type: MeetingType; title: string; startsAt: Date }): string {
  return m.title || `${capitalize(MEETING_TYPE_LABELS[m.type].art)} am ${formatDate(m.startsAt)}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Vorbelegung Anwesenheit aus der Rückmeldung: Absage → entschuldigt. */
export function presenceFromResponse(response: RsvpResponse, format: MeetingFormat): Presence | null {
  if (response === "ABGESAGT") return "ENTSCHULDIGT";
  if (response === "ZUGESAGT") return format === "DIGITAL" ? "ANWESEND_DIGITAL" : "ANWESEND";
  return null;
}

/** Sitzung liegt in der Zukunft und findet statt (Zu-/Absage möglich). */
export function isRsvpOpen(m: { startsAt: Date; status: MeetingStatus }, now: Date = new Date()): boolean {
  return m.startsAt.getTime() > now.getTime() && m.status !== "ABGESAGT" && m.status !== "AUFGEHOBEN";
}
