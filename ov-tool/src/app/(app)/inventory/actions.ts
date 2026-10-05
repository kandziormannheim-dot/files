"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { createItem, lendItem, removePhoto, retireItem, returnItem, updateItem } from "@/server/services/inventory";

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
    await lendItem(await requireUser(), id, formData);
    refresh(id);
    return "Verleih gebucht.";
  });
}

export async function returnItemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await returnItem(await requireUser(), id, formData);
    refresh(id);
    return "Rückgabe gebucht.";
  });
}

export async function retireItemAction(id: string, retire: boolean, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await retireItem(await requireUser(), id, retire);
    refresh(id);
    return retire ? "Ausgemustert." : "Wieder im Bestand.";
  });
}
