// Satzungslogik – zentral und rein (ohne DB), damit sie vollständig getestet werden kann.
// Quellen: Statut der CDU Deutschlands (Stand 21.02.2026), Satzung/Verfahrensordnung der CDU Baden-Württemberg
// (Stand Mai 2026). Für den OV gilt die Landessatzung, soweit sie nichts regelt das Bundesstatut (Statut § 50).
// Übersicht: SPEC.md Abschnitt 2a.

import { addBerlinDays, berlinDayDiff, startOfBerlinDay } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Ladungsfrist – LV-Satzung § 50 Abs. 3
// „E-Mail spätestens am 7. Tag, Post spätestens am 8. Tag vor der Sitzung; bei Eilbedürftigkeit
//  angemessen verkürzbar.“
// ---------------------------------------------------------------------------

export const MIN_NOTICE_DAYS_EMAIL = 7;
export const MIN_NOTICE_DAYS_POST = 8;

export type InvitationChannel = "EMAIL" | "POST";

export function minimumNoticeDays(channel: InvitationChannel = "EMAIL"): number {
  return channel === "POST" ? MIN_NOTICE_DAYS_POST : MIN_NOTICE_DAYS_EMAIL;
}

/** Konfigurierte Ladungsfrist, nie kürzer als die Satzung erlaubt. */
export function effectiveNoticeDays(configuredDays: number, channel: InvitationChannel = "EMAIL"): number {
  return Math.max(Math.floor(configuredDays) || 0, minimumNoticeDays(channel));
}

/** Letzter Kalendertag (Berlin, 00:00), an dem die Einladung noch rechtzeitig versendet wird. */
export function latestInvitationDay(meetingStart: Date, noticeDays: number): Date {
  return startOfBerlinDay(addBerlinDays(meetingStart, -noticeDays));
}

/** Rechtzeitig, wenn zwischen Versandtag und Sitzungstag mindestens noticeDays Kalendertage liegen. */
export function isInvitationTimely(sentAt: Date, meetingStart: Date, noticeDays: number): boolean {
  return berlinDayDiff(sentAt, meetingStart) >= noticeDays;
}

export type InvitationCheck =
  | { ok: true; timely: boolean }
  | { ok: false; reason: string };

/**
 * Darf jetzt eingeladen werden? Einberufung „mit Tagesordnung“ (LV § 37 Abs. 3, § 50 Abs. 3 und 4);
 * Unterschreitung der Frist nur mit Häkchen „eilbedürftig“ plus Begründung (SPEC.md 2a).
 */
export function checkInvitation(params: {
  now: Date;
  meetingStart: Date;
  noticeDays: number;
  agendaItemCount: number;
  urgent: boolean;
  urgencyReason: string;
  isRepeatAfterNoQuorum?: boolean;
}): InvitationCheck {
  if (params.agendaItemCount === 0) {
    return { ok: false, reason: "Eine Einladung ohne Tagesordnung kann nicht versendet werden (LV-Satzung § 50 Abs. 4)." };
  }
  if (params.meetingStart.getTime() <= params.now.getTime()) {
    return { ok: false, reason: "Die Sitzung liegt in der Vergangenheit." };
  }
  const timely = isInvitationTimely(params.now, params.meetingStart, params.noticeDays);
  // LV § 52 Abs. 3: nach Beschlussunfähigkeit sind Form und Frist nicht bindend
  if (timely || params.isRepeatAfterNoQuorum) return { ok: true, timely };
  if (!params.urgent || params.urgencyReason.trim().length < 10) {
    return {
      ok: false,
      reason: `Die Ladungsfrist von ${params.noticeDays} Tagen ist unterschritten. Versand nur als „eilbedürftig“ mit Begründung (LV-Satzung § 50 Abs. 3).`,
    };
  }
  return { ok: true, timely: false };
}

// ---------------------------------------------------------------------------
// Beschlussfähigkeit – LV-Satzung § 52 Abs. 1 („mindestens die Hälfte“), Statut § 40 Abs. 1
// („mehr als die Hälfte“). Das Tool rechnet standardmäßig mit der strengeren Regel; umstellbar.
// Enthaltungen zählen für die Anwesenheit mit. Vertretung ist ausgeschlossen (LV § 31 Abs. 4).
// ---------------------------------------------------------------------------

export type QuorumRule = "MEHR_ALS_HAELFTE" | "MINDESTENS_HAELFTE";

export function requiredForQuorum(eligible: number, rule: QuorumRule): number {
  if (eligible <= 0) return 1;
  return rule === "MEHR_ALS_HAELFTE" ? Math.floor(eligible / 2) + 1 : Math.ceil(eligible / 2);
}

export type QuorumResult = { present: number; eligible: number; required: number; reached: boolean; byRepeat: boolean };

export function evaluateQuorum(params: {
  present: number;
  eligible: number;
  rule: QuorumRule;
  /** LV § 52 Abs. 3: die neue Sitzung nach Aufhebung ist in jedem Fall beschlussfähig */
  isRepeatAfterNoQuorum?: boolean;
}): QuorumResult {
  const required = requiredForQuorum(params.eligible, params.rule);
  const byRepeat = !!params.isRepeatAfterNoQuorum;
  const reached = byRepeat || (params.eligible > 0 && params.present >= required);
  return { present: params.present, eligible: params.eligible, required, reached, byRepeat };
}

/** Anwesend (auch digital, LV § 50 d) und stimmberechtigt zählt für das Quorum. */
export function countsForQuorum(a: { presence: string | null; votingRight: string }): boolean {
  return (a.presence === "ANWESEND" || a.presence === "ANWESEND_DIGITAL") && a.votingRight === "STIMMBERECHTIGT";
}

// ---------------------------------------------------------------------------
// Mehrheiten – LV-Satzung § 55 Abs. 1
// Einfache Mehrheit der abgegebenen gültigen Stimmen; Enthaltungen gelten als nicht abgegeben;
// Stimmengleichheit = abgelehnt.
// ---------------------------------------------------------------------------

export type VoteCounts = { yes: number; no: number; abstain: number };

export type MajorityResult = {
  accepted: boolean;
  resultType: "ANGENOMMEN_EINSTIMMIG" | "ANGENOMMEN_MEHRHEITLICH" | "ABGELEHNT";
  text: string;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function evaluateMajority({ yes, no, abstain }: VoteCounts): MajorityResult {
  if ([yes, no, abstain].some((n) => !Number.isInteger(n) || n < 0)) throw new Error("Ungültige Stimmenzahl");
  const accepted = yes > no; // Gleichstand → abgelehnt; Enthaltungen zählen nicht
  if (!accepted) {
    return {
      accepted,
      resultType: "ABGELEHNT",
      text:
        yes === 0 && no === 0
          ? "Der Antrag ist abgelehnt (keine gültigen Ja-Stimmen)."
          : `Der Antrag wird mit ${plural(yes, "Ja-Stimme", "Ja-Stimmen")}, ${plural(no, "Nein-Stimme", "Nein-Stimmen")} und ${plural(abstain, "Enthaltung", "Enthaltungen")} abgelehnt.`,
    };
  }
  if (no === 0) {
    return {
      accepted,
      resultType: "ANGENOMMEN_EINSTIMMIG",
      text:
        abstain === 0
          ? "Der Antrag wird einstimmig angenommen."
          : `Der Antrag wird einstimmig bei ${plural(abstain, "Enthaltung", "Enthaltungen")} angenommen.`,
    };
  }
  return {
    accepted,
    resultType: "ANGENOMMEN_MEHRHEITLICH",
    text: `Der Antrag wird mit ${plural(yes, "Ja-Stimme", "Ja-Stimmen")}, ${plural(no, "Nein-Stimme", "Nein-Stimmen")} und ${plural(abstain, "Enthaltung", "Enthaltungen")} angenommen.`,
  };
}

/** Plausibilität: Es können nicht mehr Stimmen abgegeben werden als Stimmberechtigte anwesend sind. */
export function votesExceedPresent(votes: VoteCounts, presentEligible: number): boolean {
  return votes.yes + votes.no + votes.abstain > presentEligible;
}

// ---------------------------------------------------------------------------
// Umlaufverfahren – Statut § 42 Abs. 3, LV-Satzung § 55 Abs. 1
// Unzulässig, wenn mehr als ein Viertel widerspricht. Beschluss braucht die Mehrheit ALLER
// Stimmberechtigten. Schweigen gilt nicht als Zustimmung.
// ---------------------------------------------------------------------------

export type CirculationCounts = { eligible: number; yes: number; no: number; abstain: number; objections: number };

export type CirculationOutcome = "LAUFEND" | "ANGENOMMEN" | "ABGELEHNT" | "UNZULAESSIG";

export function circulationRequiredYes(eligible: number): number {
  return Math.floor(eligible / 2) + 1;
}

/** Mehr als ein Viertel widerspricht → unzulässig. Genau ein Viertel ist noch zulässig. */
export function circulationInadmissible(objections: number, eligible: number): boolean {
  return objections * 4 > eligible;
}

export type CirculationEvaluation = {
  outcome: CirculationOutcome;
  /** Ergebnis steht fest (auch vor Fristablauf) */
  final: boolean;
  requiredYes: number;
  pending: number;
  text: string;
};

export function evaluateCirculation(c: CirculationCounts, deadlinePassed: boolean): CirculationEvaluation {
  const cast = c.yes + c.no + c.abstain + c.objections;
  if (cast > c.eligible) throw new Error("Mehr Stimmen als Stimmberechtigte");
  const pending = c.eligible - cast;
  const requiredYes = circulationRequiredYes(c.eligible);
  const base = { requiredYes, pending };

  if (circulationInadmissible(c.objections, c.eligible)) {
    return {
      ...base,
      outcome: "UNZULAESSIG",
      final: true,
      text: `Mehr als ein Viertel der Stimmberechtigten (${c.objections} von ${c.eligible}) hat dem Umlaufverfahren widersprochen. Das Verfahren ist unzulässig; der Gegenstand wird in der nächsten Sitzung behandelt.`,
    };
  }
  // Können noch ausstehende Widersprüche das Verfahren unzulässig machen?
  const couldBecomeInadmissible = !deadlinePassed && circulationInadmissible(c.objections + pending, c.eligible);

  if (c.yes >= requiredYes && !couldBecomeInadmissible) {
    return {
      ...base,
      outcome: "ANGENOMMEN",
      final: true,
      text: `Der Beschluss ist mit ${c.yes} von ${c.eligible} Stimmen der Stimmberechtigten angenommen (erforderlich: ${requiredYes}).`,
    };
  }
  const yesStillPossible = c.yes + (deadlinePassed ? 0 : pending);
  if (yesStillPossible < requiredYes && !couldBecomeInadmissible) {
    return {
      ...base,
      outcome: "ABGELEHNT",
      final: true,
      text: `Der Beschluss ist nicht zustande gekommen: ${c.yes} Zustimmungen, erforderlich sind ${requiredYes} von ${c.eligible} Stimmberechtigten. Nicht abgegebene Stimmen zählen nicht als Zustimmung.`,
    };
  }
  return {
    ...base,
    outcome: "LAUFEND",
    final: false,
    text: `Bisher ${c.yes} Zustimmungen (erforderlich ${requiredYes}), ${c.objections} Widersprüche, ${pending} ausstehend.`,
  };
}

// ---------------------------------------------------------------------------
// Sitzungsrhythmus – LV-Satzung § 37 Abs. 3 i. V. m. § 31 Abs. 3
// Der Vorstand tagt mindestens alle zwei Monate, außerdem auf Antrag von fünf Mitgliedern.
// ---------------------------------------------------------------------------

export const CONVENE_REQUEST_SUPPORTERS = 5;
export const RHYTHM_WARNING_DAYS = 21;

/** Spätester Termin für die nächste Sitzung: zwei Monate nach der letzten (gleicher Tag im Monat bzw. Monatsende). */
export function nextMeetingDueBy(lastMeeting: Date): Date {
  const d = new Date(lastMeeting);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 2);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export type RhythmStatus = { dueBy: Date; daysLeft: number; warn: boolean; overdue: boolean };

/** Warnung, wenn bald zwei Monate um sind und keine neue Sitzung geplant ist (SPEC.md 2a). */
export function meetingRhythm(lastMeeting: Date | null, hasPlannedMeeting: boolean, now: Date): RhythmStatus | null {
  if (!lastMeeting) return null;
  const dueBy = nextMeetingDueBy(lastMeeting);
  const daysLeft = berlinDayDiff(now, dueBy);
  return {
    dueBy,
    daysLeft,
    warn: !hasPlannedMeeting && daysLeft <= RHYTHM_WARNING_DAYS,
    overdue: !hasPlannedMeeting && daysLeft < 0,
  };
}

/** Antrag auf Einberufung: Antragsteller plus Unterstützer (LV § 31 Abs. 3). */
export function conveneRequestReached(supporterCount: number, proposerCounts = true): boolean {
  return supporterCount + (proposerCounts ? 1 : 0) >= CONVENE_REQUEST_SUPPORTERS;
}
