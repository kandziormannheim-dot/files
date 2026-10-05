"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { addMeetingFiles, attachPreviousMinutes, deleteAttachment, setInInvitation } from "@/server/services/attachments";

const refresh = (meetingId: string) => {
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath(`/meetings/${meetingId}/invitation`);
};

export async function uploadMeetingFilesAction(meetingId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const n = await addMeetingFiles(await requireUser(), meetingId, fd);
    refresh(meetingId);
    return n === 1 ? "Unterlage gespeichert." : `${n} Unterlagen gespeichert.`;
  });
}

export async function attachPreviousMinutesAction(meetingId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const { attachment, status } = await attachPreviousMinutes(await requireUser(), meetingId);
    refresh(meetingId);
    return `${attachment.fileName} beigefügt${status === "ENTWURF" ? " (Achtung: Protokoll ist noch Entwurf)" : ""}.`;
  });
}

export async function toggleInvitationAction(meetingId: string, id: string, value: boolean, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await setInInvitation(await requireUser(), id, value);
    refresh(meetingId);
    return value ? "Wird mit der Einladung verschickt." : "Wird nicht mit der Einladung verschickt.";
  });
}

export async function deleteMeetingFileAction(meetingId: string, id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteAttachment(await requireUser(), id);
    refresh(meetingId);
    return "Unterlage gelöscht.";
  });
}
