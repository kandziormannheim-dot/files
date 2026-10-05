import { describe, expect, it } from "vitest";
import { fromBerlin } from "@/lib/dates";
import {
  collectiveBallotValid,
  collectiveVotesPlausible,
  electionPeriod,
  evaluateCollectiveElection,
  evaluateSingleElection,
  hasAbsoluteMajority,
  memberAssemblyInvitationDeadline,
  nextElectionDueBy,
} from "./statute";

const c = (id: string, votes: number) => ({ id, votes });

describe("Wahlperiode (LV § 56 Abs. 1, Statut § 44)", () => {
  it("endet am 31.12. des übernächsten Kalenderjahres", () => {
    const due = nextElectionDueBy(fromBerlin(2025, 3, 14, 19, 0));
    expect(due.toISOString()).toBe(fromBerlin(2027, 12, 31, 23, 59).toISOString());
  });
  it("warnt 120 Tage vorher und meldet Überschreitung", () => {
    const last = fromBerlin(2024, 5, 1, 19, 0);
    expect(electionPeriod(last, fromBerlin(2026, 6, 1, 12, 0))?.warn).toBe(false);
    expect(electionPeriod(last, fromBerlin(2026, 10, 1, 12, 0))?.warn).toBe(true);
    expect(electionPeriod(last, fromBerlin(2027, 1, 2, 12, 0))?.overdue).toBe(true);
    expect(electionPeriod(null, new Date())).toBeNull();
  });
});

describe("Ladung Mitgliederversammlung (LV § 50 Abs. 2)", () => {
  it("spätestens am achten Tag vorher", () => {
    const d = memberAssemblyInvitationDeadline(fromBerlin(2026, 11, 20, 19, 0));
    expect(d.getTime()).toBeLessThanOrEqual(fromBerlin(2026, 11, 12, 23, 59).getTime());
    expect(d.getTime()).toBeGreaterThanOrEqual(fromBerlin(2026, 11, 12, 0, 0).getTime());
  });
});

describe("Einzelwahl (LV § 57 Abs. 2)", () => {
  it("absolute Mehrheit: genau die Hälfte reicht nicht", () => {
    expect(hasAbsoluteMajority(10, 20)).toBe(false);
    expect(hasAbsoluteMajority(11, 20)).toBe(true);
    expect(hasAbsoluteMajority(0, 0)).toBe(false);
  });

  it("einzige Bewerberin: Nein-Stimmen zählen, Enthaltungen nicht", () => {
    expect(evaluateSingleElection({ stage: "WAHLGANG", round: 1, candidates: [c("a", 12)], no: 11 }).kind).toBe("GEWAEHLT");
    expect(evaluateSingleElection({ stage: "WAHLGANG", round: 1, candidates: [c("a", 11)], no: 11 }).kind).toBe("WAHLGANG_2");
    expect(evaluateSingleElection({ stage: "WAHLGANG", round: 2, candidates: [c("a", 5)], no: 9 }).kind).toBe("NICHT_GEWAEHLT");
  });

  it("drei Bewerber ohne absolute Mehrheit → zweiter Wahlgang, dann Stichwahl der beiden Besten", () => {
    const r1 = evaluateSingleElection({ stage: "WAHLGANG", round: 1, candidates: [c("a", 9), c("b", 8), c("c", 4)] });
    expect(r1.kind).toBe("WAHLGANG_2");
    const r2 = evaluateSingleElection({ stage: "WAHLGANG", round: 2, candidates: [c("a", 10), c("b", 8), c("c", 3)] });
    expect(r2).toMatchObject({ kind: "STICHWAHL", candidates: ["a", "b"] });
  });

  it("Gleichstand um Platz 2 nach Wahlgang 2 → beschränkte Wiederholung von Wahlgang 2", () => {
    const r = evaluateSingleElection({ stage: "WAHLGANG", round: 2, candidates: [c("a", 10), c("b", 6), c("c", 6)] });
    expect(r.kind).toBe("WAHLGANG_2_BESCHRAENKT");
    if (r.kind === "WAHLGANG_2_BESCHRAENKT") expect(r.candidates.sort()).toEqual(["a", "b", "c"]);
  });

  it("Gleichstand an der Spitze zwischen genau zwei → Stichwahl", () => {
    const r = evaluateSingleElection({ stage: "WAHLGANG", round: 2, candidates: [c("a", 8), c("b", 8), c("c", 3)] });
    expect(r).toMatchObject({ kind: "STICHWAHL", candidates: ["a", "b"] });
  });

  it("Stichwahl: Mehrheit gewinnt, Gleichstand → weitere Stichwahl, dann Los", () => {
    expect(evaluateSingleElection({ stage: "STICHWAHL", round: 1, candidates: [c("a", 11), c("b", 10)] })).toMatchObject({ kind: "GEWAEHLT", elected: ["a"] });
    expect(evaluateSingleElection({ stage: "STICHWAHL", round: 1, candidates: [c("a", 10), c("b", 10)] }).kind).toBe("STICHWAHL");
    expect(evaluateSingleElection({ stage: "STICHWAHL", round: 2, candidates: [c("a", 10), c("b", 10)] }).kind).toBe("LOS");
  });

  it("lehnt negative oder gebrochene Stimmenzahlen ab", () => {
    expect(() => evaluateSingleElection({ stage: "WAHLGANG", round: 1, candidates: [c("a", -1)] })).toThrow();
    expect(() => evaluateSingleElection({ stage: "WAHLGANG", round: 1, candidates: [c("a", 1.5)] })).toThrow();
  });
});

describe("Sammelwahl (LV § 57 Abs. 3)", () => {
  it("Gültigkeit: mindestens die Hälfte, höchstens alle Plätze angekreuzt", () => {
    expect(collectiveBallotValid(2, 4)).toBe(true);
    expect(collectiveBallotValid(1, 4)).toBe(false);
    expect(collectiveBallotValid(5, 4)).toBe(false);
    expect(collectiveBallotValid(2, 3)).toBe(true);
    expect(collectiveBallotValid(1, 3)).toBe(false);
    expect(collectiveBallotValid(1, 1)).toBe(true);
  });

  it("Plausibilität der Stimmensumme", () => {
    expect(collectiveVotesPlausible(40, 10, 4)).toBe(true);
    expect(collectiveVotesPlausible(41, 10, 4)).toBe(false);
    expect(collectiveVotesPlausible(19, 10, 4)).toBe(false);
    expect(collectiveVotesPlausible(20, 10, 3)).toBe(true);
    expect(collectiveVotesPlausible(19, 10, 3)).toBe(false);
  });

  it("gewählt in der Reihenfolge der Stimmen", () => {
    const r = evaluateCollectiveElection({ seats: 2, candidates: [c("a", 5), c("b", 9), c("c", 7)] });
    expect(r).toMatchObject({ kind: "GEWAEHLT", elected: ["b", "c"] });
  });

  it("Gleichstand um den letzten Platz → Stichwahl, erneut → Los", () => {
    const r = evaluateCollectiveElection({ seats: 2, candidates: [c("a", 9), c("b", 7), c("c", 7)] });
    expect(r).toMatchObject({ kind: "STICHWAHL", elected: ["a"], seats: 1 });
    const again = evaluateCollectiveElection({ seats: 1, candidates: [c("b", 4), c("c", 4)], runoff: true });
    expect(again.kind).toBe("LOS");
  });

  it("weniger Bewerber mit Stimmen als Plätze → alle gewählt", () => {
    expect(evaluateCollectiveElection({ seats: 4, candidates: [c("a", 3), c("b", 2), c("c", 0)] })).toMatchObject({ kind: "GEWAEHLT", elected: ["a", "b"] });
  });
});
