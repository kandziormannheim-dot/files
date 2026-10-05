"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  addCandidate,
  addPosition,
  createElection,
  deleteElection,
  deleteLastRound,
  deletePosition,
  recordLot,
  recordRound,
  removeCandidate,
  setAcceptance,
  updateElection,
  updatePosition,
  type RoundInput,
} from "@/server/services/elections";
import { closePoll, createPoll, votePoll } from "@/server/services/polls";

const refresh = (id?: string) => {
  revalidatePath("/elections");
  if (id) revalidatePath(`/elections/${id}`, "layout");
};

export async function createElectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createElection(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/elections/${id}`);
  }
  return result;
}

export async function updateElectionAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateElection(await requireUser(), id, formData);
    refresh(id);
    return "Gespeichert.";
  });
}

export async function deleteElectionAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteElection(await requireUser(), id);
  });
  if (result?.ok) {
    refresh();
    redirect("/elections");
  }
  return result;
}

export async function addPositionAction(electionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addPosition(await requireUser(), electionId, formData);
    refresh(electionId);
    return "Amt angelegt.";
  });
}

export async function updatePositionAction(electionId: string, positionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updatePosition(await requireUser(), positionId, formData);
    refresh(electionId);
    return "Gespeichert.";
  });
}

export async function deletePositionAction(electionId: string, positionId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deletePosition(await requireUser(), positionId);
    refresh(electionId);
    return "Amt entfernt.";
  });
}

export async function addCandidateAction(electionId: string, positionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addCandidate(await requireUser(), positionId, formData);
    refresh(electionId);
  });
}

export async function removeCandidateAction(electionId: string, candidateId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await removeCandidate(await requireUser(), candidateId);
    refresh(electionId);
  });
}

export async function setAcceptanceAction(electionId: string, candidateId: string, value: "ja" | "nein" | "offen", _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await setAcceptance(await requireUser(), candidateId, value === "offen" ? null : value === "ja");
    refresh(electionId);
  });
}

/** Wird auch aus der Offline-Warteschlange der Auszählung aufgerufen. */
export async function recordRoundAction(electionId: string, positionId: string, input: RoundInput): Promise<ActionState> {
  return runAction(async () => {
    const { result } = await recordRound(await requireUser(), positionId, input);
    refresh(electionId);
    return { message: result.text, data: { kind: result.kind } };
  });
}

export async function recordLotAction(electionId: string, positionId: string, winners: string[]): Promise<ActionState> {
  return runAction(async () => {
    await recordLot(await requireUser(), positionId, winners);
    refresh(electionId);
    return "Losentscheid erfasst.";
  });
}

export async function deleteLastRoundAction(electionId: string, positionId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteLastRound(await requireUser(), positionId);
    refresh(electionId);
    return "Letzter Wahlgang zurückgenommen.";
  });
}

export async function createPollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createPoll(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/elections/polls/${id}`);
  }
  return result;
}

export async function votePollAction(pollId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const choices = formData.getAll("choice").map((v) => Number(v));
    await votePoll(await requireUser(), pollId, choices);
    revalidatePath(`/elections/polls/${pollId}`);
    revalidatePath("/elections");
    return "Danke – Antwort gespeichert.";
  });
}

export async function closePollAction(pollId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await closePoll(await requireUser(), pollId);
    revalidatePath(`/elections/polls/${pollId}`);
    revalidatePath("/elections");
    return "Meinungsbild beendet.";
  });
}
