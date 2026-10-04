"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  abortCirculation,
  announceCirculation,
  determineCirculation,
  startCirculation,
  voteAsUser,
} from "@/server/services/circulations";
import { autoSendPendingToOffice } from "@/server/services/minutes-workflow";

export async function startCirculationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const r = await runAction(async () => {
    id = (await startCirculation(await requireUser(), formData)).id;
  });
  if (r?.ok) {
    revalidatePath("/circulations");
    redirect(`/circulations/${id}`);
  }
  return r;
}

export async function voteAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await voteAsUser(await requireUser(), id, formData);
    revalidatePath(`/circulations/${id}`);
    return "Ihre Stimme ist gespeichert.";
  });
}

export async function determineAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await determineCirculation(await requireUser(), id, { announce: formData.get("announce") === "on" });
    await autoSendPendingToOffice();
    revalidatePath("/circulations", "layout");
    revalidatePath("/meetings", "layout");
    return "Ergebnis festgestellt.";
  });
}

export async function announceAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await announceCirculation(await requireUser(), id);
    revalidatePath(`/circulations/${id}`);
    return "Ergebnis bekanntgegeben.";
  });
}

export async function abortAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await abortCirculation(await requireUser(), id, formData);
    revalidatePath("/circulations", "layout");
    return "Verfahren abgebrochen.";
  });
}
