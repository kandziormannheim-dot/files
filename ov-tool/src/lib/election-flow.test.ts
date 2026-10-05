import { describe, expect, it } from "vitest";
import { ballotInstruction, nextStep, type FlowRound } from "./election-flow";

const r = (stage: FlowRound["stage"], round: number, candidateIds: string[], votes: Record<string, number>, elected: string[] = [], noVotes = 0): FlowRound => ({
  stage,
  round,
  candidateIds,
  votes,
  noVotes,
  elected,
});

describe("nextStep Einzelwahl", () => {
  it("beginnt mit dem 1. Wahlgang", () => {
    expect(nextStep("EINZEL", 1, ["a", "b"], [])).toMatchObject({ done: false, stage: "WAHLGANG", round: 1 });
  });
  it("führt über 2. Wahlgang zur Stichwahl und weiter zum Los", () => {
    const rounds = [r("WAHLGANG", 1, ["a", "b", "c"], { a: 9, b: 8, c: 4 })];
    expect(nextStep("EINZEL", 1, ["a", "b", "c"], rounds)).toMatchObject({ stage: "WAHLGANG", round: 2 });
    rounds.push(r("WAHLGANG", 2, ["a", "b", "c"], { a: 10, b: 8, c: 3 }));
    expect(nextStep("EINZEL", 1, ["a", "b", "c"], rounds)).toMatchObject({ stage: "STICHWAHL", round: 1, candidateIds: ["a", "b"] });
    rounds.push(r("STICHWAHL", 1, ["a", "b"], { a: 10, b: 10 }));
    expect(nextStep("EINZEL", 1, ["a", "b", "c"], rounds)).toMatchObject({ stage: "STICHWAHL", round: 2 });
    rounds.push(r("STICHWAHL", 2, ["a", "b"], { a: 10, b: 10 }));
    expect(nextStep("EINZEL", 1, ["a", "b", "c"], rounds)).toMatchObject({ stage: "LOS" });
    rounds.push(r("LOS", 1, ["a", "b"], {}, ["b"]));
    expect(nextStep("EINZEL", 1, ["a", "b", "c"], rounds)).toMatchObject({ done: true, elected: ["b"] });
  });
  it("ist fertig bei absoluter Mehrheit im 1. Wahlgang", () => {
    expect(nextStep("EINZEL", 1, ["a"], [r("WAHLGANG", 1, ["a"], { a: 20 }, [], 3)])).toMatchObject({ done: true, elected: ["a"] });
  });
});

describe("nextStep Sammelwahl", () => {
  it("Stichwahl um den letzten Platz behält die sicher Gewählten", () => {
    const rounds = [r("WAHLGANG", 1, ["a", "b", "c", "d"], { a: 9, b: 7, c: 7, d: 2 }, ["a"])];
    const step = nextStep("SAMMEL", 2, ["a", "b", "c", "d"], rounds);
    expect(step).toMatchObject({ stage: "STICHWAHL", seats: 1, carried: ["a"] });
    rounds.push(r("STICHWAHL", 1, ["b", "c"], { b: 5, c: 4 }, ["a", "b"]));
    expect(nextStep("SAMMEL", 2, ["a", "b", "c", "d"], rounds)).toMatchObject({ done: true, elected: ["a", "b"] });
  });
  it("Hinweis zur Gültigkeit", () => {
    expect(ballotInstruction("SAMMEL", 5, 8)).toContain("mindestens 3 und höchstens 5");
    expect(ballotInstruction("EINZEL", 1, 1)).toContain("Ja");
  });
});
