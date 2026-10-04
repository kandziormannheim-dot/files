"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  addResolution,
  approveLinkedMinutes,
  closeMeetingNow,
  createNewVersion,
  deleteResolution,
  determineQuorum,
  openMeetingNow,
  reopenMeeting,
  saveFormalities,
  saveHeader,
  saveSection,
  saveSigners,
  setPresence,
  startMinutes,
  suspendForNoQuorum,
  type QuorumState,
} from "@/server/services/minutes";
import { autoSendPendingToOffice, sendMinutes, sendToOffice } from "@/server/services/minutes-workflow";
import { createTask } from "@/server/services/tasks";

const refresh = (meetingId: string) => {
  revalidatePath(`/meetings/${meetingId}/minutes`);
  revalidatePath(`/meetings/${meetingId}`);
};

export async function startMinutesAction(meetingId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await startMinutes(await requireUser(), meetingId);
    refresh(meetingId);
  });
}

// Autosave: ohne revalidate, damit Eingaben nicht überschrieben werden
export async function saveHeaderAction(minutesId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => saveHeader(await requireUser(), minutesId, fd));
}
export async function saveFormalitiesAction(minutesId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => saveFormalities(await requireUser(), minutesId, fd));
}
export async function saveSignersAction(minutesId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => saveSigners(await requireUser(), minutesId, fd));
}
export async function saveSectionAction(minutesId: string, itemId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => saveSection(await requireUser(), minutesId, itemId, fd));
}

export async function setPresenceAction(minutesId: string, attendanceId: string, presence: string): Promise<{ error?: string; quorum?: QuorumState }> {
  const user = await requireUser();
  try {
    return { quorum: await setPresence(user, minutesId, attendanceId, presence) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Fehler" };
  }
}

export async function determineQuorumAction(meetingId: string, minutesId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const q = await determineQuorum(await requireUser(), minutesId, fd);
    refresh(meetingId);
    return q.reached ? "Beschlussfähigkeit festgestellt." : "Festgestellt: Die Sitzung ist nicht beschlussfähig.";
  });
}

export async function openMeetingAction(meetingId: string, minutesId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await openMeetingNow(await requireUser(), minutesId);
    refresh(meetingId);
    return "Sitzung eröffnet.";
  });
}

export async function closeMeetingAction(meetingId: string, minutesId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await closeMeetingNow(await requireUser(), minutesId);
    refresh(meetingId);
    return "Sitzung geschlossen.";
  });
}

export async function suspendAction(meetingId: string, minutesId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let repeatId = "";
  const r = await runAction(async () => {
    repeatId = (await suspendForNoQuorum(await requireUser(), minutesId, fd)).id;
  });
  if (r?.ok) {
    refresh(meetingId);
    redirect(`/meetings/${repeatId}`);
  }
  return r;
}

export async function reopenAction(meetingId: string, minutesId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await reopenMeeting(await requireUser(), minutesId);
    refresh(meetingId);
    return "Sitzung wiedereröffnet.";
  });
}

export async function addResolutionAction(meetingId: string, minutesId: string, itemId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const r = await addResolution(await requireUser(), minutesId, itemId, fd);
    await autoSendPendingToOffice();
    refresh(meetingId);
    return `Gespeichert als Nr. ${r.number}.`;
  });
}

export async function deleteResolutionAction(meetingId: string, resolutionId: string): Promise<ActionState> {
  return runAction(async () => {
    await deleteResolution(await requireUser(), resolutionId);
    refresh(meetingId);
    return "Gelöscht.";
  });
}

export async function approveLinkedMinutesAction(meetingId: string, minutesId: string, itemId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await approveLinkedMinutes(await requireUser(), minutesId, itemId);
    await autoSendPendingToOffice();
    refresh(meetingId);
    return "Protokoll als genehmigt markiert.";
  });
}

export async function quickTaskAction(meetingId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await createTask(await requireUser(), fd);
    refresh(meetingId);
    return "Aufgabe angelegt.";
  });
}

export async function sendMinutesAction(meetingId: string, minutesId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const n = await sendMinutes(await requireUser(), minutesId, fd);
    refresh(meetingId);
    return `Protokoll an ${n} Empfänger versendet.`;
  });
}

export async function newVersionAction(meetingId: string, minutesId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await createNewVersion(await requireUser(), minutesId, fd);
    refresh(meetingId);
    return "Neue Version angelegt.";
  });
}

export async function sendToOfficeAction(meetingId: string, minutesId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await sendToOffice(await requireUser(), minutesId);
    refresh(meetingId);
    return "An die Kreisgeschäftsstelle übersandt.";
  });
}
