"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { updateOwnProfile } from "@/server/services/users";

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateOwnProfile(await requireUser(), formData);
    revalidatePath("/", "layout");
    return "Gespeichert.";
  });
}
