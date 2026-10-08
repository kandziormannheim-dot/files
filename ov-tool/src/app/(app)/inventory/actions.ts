"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import type { LoanPhase } from "@prisma/client";
import { createItem, removePhoto, retireItem, updateItem } from "@/server/services/inventory";
import { addLoanPhotos, lendItem, mailSummary, returnItem, sendLoanProtocol } from "@/server/services/inventory-loans";

const refresh = (id?: string) => {
  revalidatePath("/inventory");
  if (id) revalidatePath(`/inventory/${id}`);
};

export async function createItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createItem(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/inventory/${id}?neu=1`);
  }
  return result;
}

export async function updateItemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateItem(await requireUser(), id, formData);
    refresh(id);
    return "Gespeichert.";
  });
}

export async function removePhotoAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await removePhoto(await requireUser(), id);
    refresh(id);
    return "Foto entfernt.";
  });
}

export async function lendItemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { mail } = await lendItem(await requireUser(), id, formData);
    refresh(id);
    return `Verleih gebucht. ${mailSummary(mail)}`;
  });
}

export async function returnItemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { mail } = await returnItem(await requireUser(), id, formData);
    refresh(id);
    return `Rückgabe gebucht. ${mailSummary(mail)}`;
  });
}

export async function retireItemAction(id: string, retire: boolean, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await retireItem(await requireUser(), id, retire);
    refresh(id);
    return retire ? "Ausgemustert." : "Wieder im Bestand.";
  });
}

const phaseOf = (p: string): LoanPhase => (p === "RUECKGABE" ? "RUECKGABE" : "AUSGABE");

export async function resendProtocolAction(itemId: string, loanId: string, phase: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const r = await sendLoanProtocol(await requireUser(), loanId, phaseOf(phase));
    refresh(itemId);
    return r.sent ? `Protokoll an ${r.recipients.length} Empfänger gesendet.` : { message: mailSummary(r) };
  });
}

export async function addLoanPhotosAction(itemId: string, loanId: string, phase: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addLoanPhotos(await requireUser(), loanId, phaseOf(phase), formData);
    refresh(itemId);
    return "Fotos gespeichert.";
  });
}
