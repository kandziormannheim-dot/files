import { describe, expect, it } from "vitest";
import { fromBerlin } from "@/lib/dates";
import {
  checkInvitation,
  circulationInadmissible,
  circulationRequiredYes,
  conveneRequestReached,
  countsForQuorum,
  effectiveNoticeDays,
  evaluateCirculation,
  evaluateMajority,
  evaluateQuorum,
  isInvitationTimely,
  latestInvitationDay,
  meetingRhythm,
  nextMeetingDueBy,
  requiredForQuorum,
  votesExceedPresent,
} from "./statute";

describe("Ladungsfrist (LV § 50 Abs. 3)", () => {
  const meeting = fromBerlin(2026, 2, 26, 19, 0); // Donnerstag

  it("E-Mail spätestens am 7. Tag vor der Sitzung", () => {
    expect(latestInvitationDay(meeting, 7).toISOString()).toBe(fromBerlin(2026, 2, 19).toISOString());
    expect(isInvitationTimely(fromBerlin(2026, 2, 19, 23, 59), meeting, 7)).toBe(true);
    expect(isInvitationTimely(fromBerlin(2026, 2, 20, 0, 1), meeting, 7)).toBe(false);
  });

  it("Konfiguration kann die Satzungsfrist nicht unterschreiten", () => {
    expect(effectiveNoticeDays(3)).toBe(7);
    expect(effectiveNoticeDays(10)).toBe(10);
    expect(effectiveNoticeDays(7, "POST")).toBe(8);
  });

  it("ohne Tagesordnung keine Einladung", () => {
    const r = checkInvitation({ now: fromBerlin(2026, 2, 1), meetingStart: meeting, noticeDays: 7, agendaItemCount: 0, urgent: false, urgencyReason: "" });
    expect(r.ok).toBe(false);
  });

  it("verkürzte Frist nur mit eilbedürftig und Begründung", () => {
    const base = { now: fromBerlin(2026, 2, 22), meetingStart: meeting, noticeDays: 7, agendaItemCount: 5 };
    expect(checkInvitation({ ...base, urgent: false, urgencyReason: "" }).ok).toBe(false);
    expect(checkInvitation({ ...base, urgent: true, urgencyReason: "" }).ok).toBe(false);
    expect(checkInvitation({ ...base, urgent: true, urgencyReason: "Frist der Stadt für Stellungnahme läuft ab" })).toEqual({
      ok: true,
      timely: false,
    });
    expect(checkInvitation({ ...base, now: fromBerlin(2026, 2, 10), urgent: false, urgencyReason: "" })).toEqual({
      ok: true,
      timely: true,
    });
  });

  it("nach Beschlussunfähigkeit ist die Frist nicht bindend (LV § 52 Abs. 3)", () => {
    const r = checkInvitation({ now: fromBerlin(2026, 2, 25), meetingStart: meeting, noticeDays: 7, agendaItemCount: 3, urgent: false, urgencyReason: "", isRepeatAfterNoQuorum: true });
    expect(r).toEqual({ ok: true, timely: false });
  });
});

describe("Beschlussfähigkeit (LV § 52, Statut § 40)", () => {
  it("mehr als die Hälfte: bei 10 Stimmberechtigten reichen 5 nicht", () => {
    expect(requiredForQuorum(10, "MEHR_ALS_HAELFTE")).toBe(6);
    expect(evaluateQuorum({ present: 5, eligible: 10, rule: "MEHR_ALS_HAELFTE" }).reached).toBe(false);
    expect(evaluateQuorum({ present: 6, eligible: 10, rule: "MEHR_ALS_HAELFTE" }).reached).toBe(true);
  });

  it("genau die Hälfte anwesend: nur nach LV-Regel beschlussfähig", () => {
    expect(evaluateQuorum({ present: 5, eligible: 10, rule: "MINDESTENS_HAELFTE" }).reached).toBe(true);
    expect(evaluateQuorum({ present: 5, eligible: 10, rule: "MEHR_ALS_HAELFTE" }).reached).toBe(false);
  });

  it("ungerade Zahl Stimmberechtigter", () => {
    expect(requiredForQuorum(11, "MEHR_ALS_HAELFTE")).toBe(6);
    expect(requiredForQuorum(11, "MINDESTENS_HAELFTE")).toBe(6);
  });

  it("Wiederholungssitzung ist in jedem Fall beschlussfähig", () => {
    expect(evaluateQuorum({ present: 1, eligible: 10, rule: "MEHR_ALS_HAELFTE", isRepeatAfterNoQuorum: true }).reached).toBe(true);
  });

  it("ohne Stimmberechtigte nie beschlussfähig", () => {
    expect(evaluateQuorum({ present: 0, eligible: 0, rule: "MINDESTENS_HAELFTE" }).reached).toBe(false);
  });

  it("digital Anwesende zählen, Beratende und Gäste nicht", () => {
    expect(countsForQuorum({ presence: "ANWESEND_DIGITAL", votingRight: "STIMMBERECHTIGT" })).toBe(true);
    expect(countsForQuorum({ presence: "ANWESEND", votingRight: "BERATEND" })).toBe(false);
    expect(countsForQuorum({ presence: "ENTSCHULDIGT", votingRight: "STIMMBERECHTIGT" })).toBe(false);
  });
});

describe("Mehrheiten (LV § 55 Abs. 1)", () => {
  it("Stimmengleichheit ist abgelehnt", () => {
    expect(evaluateMajority({ yes: 4, no: 4, abstain: 1 }).resultType).toBe("ABGELEHNT");
  });

  it("Enthaltungen gelten als nicht abgegeben", () => {
    const r = evaluateMajority({ yes: 2, no: 1, abstain: 6 });
    expect(r.accepted).toBe(true);
    expect(r.resultType).toBe("ANGENOMMEN_MEHRHEITLICH");
    expect(r.text).toBe("Der Antrag wird mit 2 Ja-Stimmen, 1 Nein-Stimme und 6 Enthaltungen angenommen.");
  });

  it("einstimmig, auch bei Enthaltungen", () => {
    expect(evaluateMajority({ yes: 7, no: 0, abstain: 0 }).text).toBe("Der Antrag wird einstimmig angenommen.");
    expect(evaluateMajority({ yes: 6, no: 0, abstain: 1 }).text).toBe(
      "Der Antrag wird einstimmig bei 1 Enthaltung angenommen.",
    );
  });

  it("nur Enthaltungen: abgelehnt", () => {
    expect(evaluateMajority({ yes: 0, no: 0, abstain: 5 }).accepted).toBe(false);
  });

  it("erkennt mehr Stimmen als Anwesende", () => {
    expect(votesExceedPresent({ yes: 5, no: 2, abstain: 1 }, 7)).toBe(true);
    expect(votesExceedPresent({ yes: 5, no: 2, abstain: 0 }, 7)).toBe(false);
  });

  it("weist ungültige Zahlen zurück", () => {
    expect(() => evaluateMajority({ yes: -1, no: 0, abstain: 0 })).toThrow();
  });
});

describe("Umlaufverfahren (Statut § 42 Abs. 3)", () => {
  it("Mehrheit aller Stimmberechtigten", () => {
    expect(circulationRequiredYes(10)).toBe(6);
    expect(circulationRequiredYes(11)).toBe(6);
  });

  it("Widerspruch von genau einem Viertel ist noch zulässig, mehr nicht", () => {
    expect(circulationInadmissible(3, 12)).toBe(false);
    expect(circulationInadmissible(4, 12)).toBe(true);
    expect(circulationInadmissible(2, 10)).toBe(false); // 2,5 wäre ein Viertel
    expect(circulationInadmissible(3, 10)).toBe(true);
  });

  it("wird sofort unzulässig, sobald mehr als ein Viertel widerspricht", () => {
    const r = evaluateCirculation({ eligible: 10, yes: 5, no: 0, abstain: 0, objections: 3 }, false);
    expect(r.outcome).toBe("UNZULAESSIG");
    expect(r.final).toBe(true);
  });

  it("Schweigen zählt nicht als Zustimmung", () => {
    const r = evaluateCirculation({ eligible: 10, yes: 5, no: 1, abstain: 0, objections: 0 }, true);
    expect(r.outcome).toBe("ABGELEHNT");
    expect(r.text).toContain("Nicht abgegebene Stimmen zählen nicht als Zustimmung");
  });

  it("steht vor Fristablauf fest, wenn weitere Widersprüche nichts mehr ändern können", () => {
    // 12 Stimmberechtigte, 7 Ja, 3 ausstehend: selbst 3 Widersprüche = genau ein Viertel → zulässig
    const r = evaluateCirculation({ eligible: 12, yes: 7, no: 2, abstain: 0, objections: 0 }, false);
    expect(r.outcome).toBe("ANGENOMMEN");
    expect(r.final).toBe(true);
  });

  it("bleibt offen, solange ausstehende Widersprüche es noch unzulässig machen könnten", () => {
    const r = evaluateCirculation({ eligible: 12, yes: 7, no: 0, abstain: 0, objections: 1 }, false);
    // 1 Widerspruch + 4 ausstehende = 5 > 3 → könnte noch unzulässig werden
    expect(r.outcome).toBe("LAUFEND");
    expect(evaluateCirculation({ eligible: 12, yes: 7, no: 0, abstain: 0, objections: 1 }, true).outcome).toBe("ANGENOMMEN");
  });

  it("steht als abgelehnt fest, wenn die Mehrheit nicht mehr erreichbar ist", () => {
    const r = evaluateCirculation({ eligible: 8, yes: 2, no: 5, abstain: 0, objections: 0 }, false);
    expect(r.outcome).toBe("ABGELEHNT");
    expect(r.final).toBe(true);
  });

  it("Enthaltungen helfen nicht zur Mehrheit aller Stimmberechtigten", () => {
    expect(evaluateCirculation({ eligible: 10, yes: 5, no: 0, abstain: 5, objections: 0 }, true).outcome).toBe("ABGELEHNT");
  });
});

describe("Sitzungsrhythmus (LV § 37 Abs. 3 i. V. m. § 31 Abs. 3)", () => {
  it("zwei Monate, am Monatsende gekappt", () => {
    expect(nextMeetingDueBy(new Date("2026-12-31T18:00:00Z")).toISOString()).toBe("2027-02-28T18:00:00.000Z");
  });

  it("warnt drei Wochen vorher, wenn keine Sitzung geplant ist", () => {
    const last = fromBerlin(2026, 1, 15, 19);
    expect(meetingRhythm(last, false, fromBerlin(2026, 2, 20))?.warn).toBe(false);
    expect(meetingRhythm(last, false, fromBerlin(2026, 2, 25))?.warn).toBe(true);
    expect(meetingRhythm(last, true, fromBerlin(2026, 3, 20))?.warn).toBe(false);
    expect(meetingRhythm(last, false, fromBerlin(2026, 3, 20))?.overdue).toBe(true);
    expect(meetingRhythm(null, false, new Date())).toBeNull();
  });

  it("Antrag auf Einberufung ab fünf Mitgliedern", () => {
    expect(conveneRequestReached(3)).toBe(false);
    expect(conveneRequestReached(4)).toBe(true);
  });
});
