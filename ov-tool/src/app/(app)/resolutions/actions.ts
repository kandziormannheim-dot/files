"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { deleteMotion, saveMotion, sendMotion } from "@/server/services/resolutions";

const refresh = (id: string) => {
  revalidatePath("/resolutions");
  revalidatePath(`/resolutions/${id}`);
};

export async function saveMotionAction(resolutionId: string, motionId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveMotion(await requireUser(), resolutionId, motionId, formData);
    refresh(resolutionId);
    return "Antrag gespeichert – bitte PDF prüfen und dann einreichen.";
  });
}

export async function sendMotionAction(resolutionId: string, motionId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const { to } = await sendMotion(await requireUser(), motionId);
    refresh(resolutionId);
    return `Antrag an ${to} gesendet (Antrag und Beschluss als PDF).`;
  });
}

export async function deleteMotionAction(resolutionId: string, motionId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteMotion(await requireUser(), motionId);
    refresh(resolutionId);
    return "Entwurf gelöscht.";
  });
}
