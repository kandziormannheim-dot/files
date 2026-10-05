"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { createDeadline, deleteDeadline } from "@/server/services/deadlines";

export async function createDeadlineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await createDeadline(await requireUser(), formData);
    revalidatePath("/deadlines");
    revalidatePath("/");
    return "Frist eingetragen.";
  });
}

export async function deleteDeadlineAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteDeadline(await requireUser(), id);
    revalidatePath("/deadlines");
    revalidatePath("/");
  });
}
