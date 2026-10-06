"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formatEuro } from "@/lib/money";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { addItem, approveAndSend, createClaim, deleteClaim, deleteItem, setClaimOutcome, submitClaim, updateClaim, withdrawClaim } from "@/server/services/expenses";

const refresh = (id?: string) => {
  revalidatePath("/expenses");
  if (id) revalidatePath(`/expenses/${id}`);
};

export async function createClaimAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createClaim(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/expenses/${id}`);
  }
  return result;
}

export async function updateClaimAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateClaim(await requireUser(), id, formData);
    refresh(id);
    return "Gespeichert.";
  });
}

export async function addItemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addItem(await requireUser(), id, formData);
    refresh(id);
    return "Position erfasst.";
  });
}

export async function deleteItemAction(id: string, itemId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteItem(await requireUser(), itemId);
    refresh(id);
  });
}

export async function submitClaimAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await submitClaim(await requireUser(), id);
    refresh(id);
    return "Zur Freigabe eingereicht.";
  });
}

export async function withdrawClaimAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await withdrawClaim(await requireUser(), id);
    refresh(id);
    return "Zurückgezogen – wieder bearbeitbar.";
  });
}

export async function approveAndSendAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const { to, total } = await approveAndSend(await requireUser(), id);
    refresh(id);
    return `Freigegeben und an ${to} gesendet (${formatEuro(total)}).`;
  });
}

export async function outcomeAction(id: string, outcome: "ERLEDIGT" | "ABGELEHNT", _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await setClaimOutcome(await requireUser(), id, outcome, String(formData.get("note") ?? "").trim() || undefined);
    refresh(id);
    return outcome === "ERLEDIGT" ? "Als erledigt markiert." : "Als abgelehnt markiert.";
  });
}

export async function deleteClaimAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteClaim(await requireUser(), id);
  });
  if (result?.ok) {
    refresh();
    redirect("/expenses");
  }
  return result;
}
