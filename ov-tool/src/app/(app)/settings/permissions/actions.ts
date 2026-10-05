"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { resetRolePermissions, saveRolePermissions } from "@/server/auth/role-permissions";

export async function savePermissionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const n = await saveRolePermissions(await requireUser(), formData);
    revalidatePath("/", "layout");
    return n ? "Rechte gespeichert." : "Keine Änderungen.";
  });
}

export async function resetPermissionsAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await resetRolePermissions(await requireUser());
    revalidatePath("/", "layout");
    return "Werkseinstellung wiederhergestellt.";
  });
}
