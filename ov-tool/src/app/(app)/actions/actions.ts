"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  addShift,
  createAction,
  deleteAction,
  deleteShift,
  saveFollowUp,
  sendHelpCall,
  toggleShiftSignup,
  updateAction,
} from "@/server/services/actions";

const refresh = (id?: string) => {
  revalidatePath("/actions");
  if (id) revalidatePath(`/actions/${id}`);
  revalidatePath("/");
};

export async function createActionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const r = await runAction(async () => {
    id = (await createAction(await requireUser(), fd)).id;
  });
  if (r?.ok) {
    refresh();
    redirect(`/actions/${id}`);
  }
  return r;
}

export async function updateActionAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await runAction(async () => updateAction(await requireUser(), id, fd));
  if (r?.ok) {
    refresh(id);
    redirect(`/actions/${id}`);
  }
  return r;
}

export async function deleteActionAction(id: string, _prev: ActionState): Promise<ActionState> {
  const r = await runAction(async () => deleteAction(await requireUser(), id));
  if (r?.ok) {
    refresh();
    redirect("/actions");
  }
  return r;
}

export async function followUpAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveFollowUp(await requireUser(), id, fd);
    refresh(id);
    return "Nachbereitung gespeichert.";
  });
}

export async function addShiftAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addShift(await requireUser(), id, fd);
    refresh(id);
    return "Schicht angelegt.";
  });
}

export async function deleteShiftAction(actionId: string, shiftId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteShift(await requireUser(), shiftId);
    refresh(actionId);
    return "Schicht gelöscht.";
  });
}

export async function toggleSignupAction(actionId: string, shiftId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const signedUp = await toggleShiftSignup(await requireUser(), shiftId);
    refresh(actionId);
    return signedUp ? "Eingetragen – danke!" : "Ausgetragen.";
  });
}

export async function helpCallAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const n = await sendHelpCall(await requireUser(), id);
    refresh(id);
    return `Helferaufruf an ${n} Personen versendet.`;
  });
}
