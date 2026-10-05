"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { attachPresentationToMinutes, saveLeaderNotes } from "@/server/services/presentation";

export async function saveLeaderNotesAction(meetingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const n = await saveLeaderNotes(await requireUser(), meetingId, formData);
    revalidatePath(`/meetings/${meetingId}/presentation`);
    return n ? `Vermerke gespeichert (${n} geändert).` : "Keine Änderungen.";
  });
}

export async function attachPresentationAction(meetingId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const a = await attachPresentationToMinutes(await requireUser(), meetingId);
    revalidatePath(`/meetings/${meetingId}`, "layout");
    return `${a.fileName} ist als Anlage zum Protokoll hinterlegt und geht beim Protokollversand mit.`;
  });
}
