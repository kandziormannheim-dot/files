"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { applyDraft, deleteTranscript, requestDraft, uploadTranscript } from "@/server/services/transcripts";

export async function uploadTranscriptAction(meetingId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const t = await uploadTranscript(await requireUser(), meetingId, fd);
    revalidatePath(`/meetings/${meetingId}/transcripts`);
    return t.filePath ? "Hochgeladen – die Transkription läuft im Hintergrund." : "Hochgeladen.";
  });
}

export async function requestDraftAction(meetingId: string, id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await requestDraft(await requireUser(), id);
    revalidatePath(`/meetings/${meetingId}/transcripts`);
    return "Der Entwurf wird erstellt. Sie erhalten eine E-Mail, sobald er fertig ist.";
  });
}

export async function applyDraftAction(meetingId: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const s = await applyDraft(await requireUser(), id, fd);
    revalidatePath(`/meetings/${meetingId}`, "layout");
    const msg = `Übernommen: ${s.sections} TOPs, ${s.resolutions} Beschlüsse, ${s.tasks} Aufgaben.`;
    if (s.errors.length) return { message: `${msg} Nicht übernommen: ${s.errors.join(" ")}` };
    return msg;
  });
}

export async function deleteTranscriptAction(meetingId: string, id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteTranscript(await requireUser(), id);
    revalidatePath(`/meetings/${meetingId}/transcripts`);
    return "Transkript gelöscht.";
  });
}
