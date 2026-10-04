"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { removeSignature, updateOwnProfile, uploadSignature } from "@/server/services/users";

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateOwnProfile(await requireUser(), formData);
    revalidatePath("/", "layout");
    return "Gespeichert.";
  });
}

export async function uploadSignatureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await uploadSignature(await requireUser(), formData);
    revalidatePath("/profile");
    return "Unterschrift gespeichert.";
  });
}

export async function removeSignatureAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await removeSignature(await requireUser());
    revalidatePath("/profile");
    return "Unterschrift entfernt.";
  });
}
