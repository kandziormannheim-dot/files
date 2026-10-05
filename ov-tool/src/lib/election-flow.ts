// Ablauf einer Wahl je Amt: aus den erfassten Wahlgängen den nächsten Schritt ableiten (LV-Satzung § 57).
// Rein und ohne DB – läuft auf dem Server und in der Auszählungsmaske (auch offline).

import { evaluateCollectiveElection, evaluateSingleElection, type ElectionStep } from "@/server/services/statute";

export type FlowMode = "EINZEL" | "SAMMEL";
export type FlowStage = "WAHLGANG" | "STICHWAHL" | "LOS";

export type FlowRound = {
  stage: FlowStage;
  round: number;
  candidateIds: string[];
  noVotes: number;
  votes: Record<string, number>;
  elected: string[];
};

export type NextStep =
  | { done: false; stage: "WAHLGANG" | "STICHWAHL"; round: number; candidateIds: string[]; seats: number; carried: string[]; label: string }
  | { done: false; stage: "LOS"; round: number; candidateIds: string[]; seats: number; carried: string[]; label: string }
  | { done: true; elected: string[]; failed: boolean; label: string };

export function roundLabel(stage: FlowStage, round: number): string {
  if (stage === "LOS") return "Losentscheid";
  if (stage === "STICHWAHL") return round > 1 ? `${round}. Stichwahl` : "Stichwahl";
  return `${round}. Wahlgang`;
}

/** Ergebnis eines erfassten Wahlgangs nach § 57 berechnen. */
export function evaluateRound(
  mode: FlowMode,
  seats: number,
  round: Pick<FlowRound, "stage" | "round" | "candidateIds" | "noVotes" | "votes">,
  carried: string[] = [],
): ElectionStep {
  const candidates = round.candidateIds.map((id) => ({ id, votes: round.votes[id] ?? 0 }));
  if (mode === "EINZEL") {
    return evaluateSingleElection({
      stage: round.stage === "STICHWAHL" ? "STICHWAHL" : "WAHLGANG",
      round: round.round,
      candidates,
      no: candidates.length === 1 ? round.noVotes : 0,
    });
  }
  const step = evaluateCollectiveElection({ seats: seats - carried.length, candidates, runoff: round.stage === "STICHWAHL" });
  if (step.kind === "GEWAEHLT") return { ...step, elected: [...carried, ...step.elected] };
  if (step.kind === "STICHWAHL" || step.kind === "LOS") return { ...step, elected: [...carried, ...step.elected] };
  return step;
}

/** Nächster Schritt für ein Amt anhand der bisherigen Wahlgänge. */
export function nextStep(mode: FlowMode, seats: number, activeCandidateIds: string[], rounds: FlowRound[]): NextStep {
  const last = rounds[rounds.length - 1];
  if (!last) {
    return { done: false, stage: "WAHLGANG", round: 1, candidateIds: activeCandidateIds, seats, carried: [], label: roundLabel("WAHLGANG", 1) };
  }
  if (last.stage === "LOS") {
    return { done: true, elected: last.elected, failed: last.elected.length === 0, label: "Gewählt durch Los" };
  }
  // „mitgenommene“ Gewählte bei Sammelwahl-Stichwahlen: elected des Vorgängers ohne die Stichwahl-Kandidaten
  const prev = rounds[rounds.length - 2];
  const carried = mode === "SAMMEL" && last.stage === "STICHWAHL" && prev ? prev.elected.filter((id) => !last.candidateIds.includes(id)) : [];
  const step = evaluateRound(mode, seats, last, carried);
  switch (step.kind) {
    case "GEWAEHLT":
      return { done: true, elected: step.elected, failed: step.elected.length === 0, label: step.text };
    case "NICHT_GEWAEHLT":
      return { done: true, elected: [], failed: true, label: step.text };
    case "WAHLGANG_2":
    case "WAHLGANG_2_BESCHRAENKT":
      return { done: false, stage: "WAHLGANG", round: 2, candidateIds: step.candidates, seats, carried: [], label: `${roundLabel("WAHLGANG", 2)}${step.kind === "WAHLGANG_2_BESCHRAENKT" ? " (beschränkt)" : ""}` };
    case "STICHWAHL": {
      const n = last.stage === "STICHWAHL" ? last.round + 1 : 1;
      return { done: false, stage: "STICHWAHL", round: n, candidateIds: step.candidates, seats: step.seats, carried: step.elected, label: roundLabel("STICHWAHL", n) };
    }
    case "LOS":
      return { done: false, stage: "LOS", round: 1, candidateIds: step.candidates, seats: step.seats, carried: step.elected, label: "Losentscheid" };
  }
}

/** Gültigkeitshinweis für Stimmzettel und Auszählung. */
export function ballotInstruction(mode: FlowMode, seats: number, candidateCount: number): string {
  if (mode === "EINZEL") {
    return candidateCount === 1 ? "Bitte „Ja“, „Nein“ oder „Enthaltung“ ankreuzen." : "Bitte einen Namen ankreuzen.";
  }
  const min = Math.ceil(seats / 2);
  return `Bitte mindestens ${min} und höchstens ${seats} ${seats === 1 ? "Namen" : "Namen"} ankreuzen. Stimmzettel mit weniger oder mehr Kreuzen sind ungültig (LV-Satzung § 57 Abs. 3).`;
}
