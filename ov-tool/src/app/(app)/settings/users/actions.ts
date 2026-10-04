"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { createUser, resendAccessMail, updateUser } from "@/server/services/users";

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const user = await createUser(await requireUser(), formData);
    id = user.id;
  });
  if (result?.ok) {
    revalidatePath("/settings/users");
    redirect(`/settings/users/${id}?neu=1`);
  }
  return result;
}

export async function updateUserAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateUser(await requireUser(), id, formData);
    revalidatePath("/settings/users");
    return "Gespeichert.";
  });
}

export async function resendAccessMailAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await resendAccessMail(await requireUser(), id);
    return "Zugangsmail wurde versendet.";
  });
}
