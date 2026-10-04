"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { addAttachment, deleteAttachment, type OwnerType } from "@/server/services/attachments";

export async function addAttachmentAction(ownerType: OwnerType, ownerId: string, path: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addAttachment(await requireUser(), ownerType, ownerId, fd.get("file"));
    revalidatePath(path);
    return "Anhang gespeichert.";
  });
}

export async function deleteAttachmentAction(id: string, path: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteAttachment(await requireUser(), id);
    revalidatePath(path);
    return "Anhang gelöscht.";
  });
}
