"use server";

import type { AgendaItemStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  addAgendaItemFromForm,
  cancelMeeting,
  createMeeting,
  deleteAgendaItem,
  dismissCarryOver,
  reorderAgenda,
  respondToMeeting,
  setAgendaItemStatus,
  takeOverCarryOver,
  updateAgendaItem,
  updateMeeting,
} from "@/server/services/meetings";
import { acceptProposal, createProposal, rejectProposal, toggleSupport } from "@/server/services/proposals";

const refresh = (id?: string) => {
  revalidatePath("/meetings");
  if (id) revalidatePath(`/meetings/${id}`);
  revalidatePath("/");
};

export async function createMeetingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createMeeting(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/meetings/${id}`);
  }
  return result;
}

export async function updateMeetingAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateMeeting(await requireUser(), id, formData);
  });
  if (result?.ok) {
    refresh(id);
    redirect(`/meetings/${id}`);
  }
  return result;
}

export async function cancelMeetingAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await cancelMeeting(await requireUser(), id, formData);
    refresh(id);
    return "Sitzung abgesagt.";
  });
}

export async function respondAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await respondToMeeting(await requireUser(), id, formData);
    refresh(id);
    return formData.get("response") === "ZUGESAGT" ? "Zusage gespeichert." : "Absage gespeichert.";
  });
}

export async function addAgendaItemAction(meetingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addAgendaItemFromForm(await requireUser(), meetingId, formData);
    refresh(meetingId);
    return "TOP hinzugefügt.";
  });
}

export async function updateAgendaItemAction(meetingId: string, itemId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateAgendaItem(await requireUser(), itemId, formData);
    refresh(meetingId);
    return "TOP gespeichert.";
  });
}

export async function setAgendaItemStatusAction(meetingId: string, itemId: string, status: AgendaItemStatus): Promise<ActionState> {
  return runAction(async () => {
    await setAgendaItemStatus(await requireUser(), itemId, status);
    refresh(meetingId);
  });
}

export async function deleteAgendaItemAction(meetingId: string, itemId: string): Promise<ActionState> {
  return runAction(async () => {
    await deleteAgendaItem(await requireUser(), itemId);
    refresh(meetingId);
    return "TOP gelöscht.";
  });
}

export async function reorderAgendaAction(meetingId: string, parentId: string | null, ids: string[]): Promise<ActionState> {
  return runAction(async () => {
    await reorderAgenda(await requireUser(), meetingId, parentId, ids);
    refresh(meetingId);
  });
}

export async function takeOverCarryOverAction(meetingId: string, itemId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await takeOverCarryOver(await requireUser(), meetingId, itemId);
    refresh(meetingId);
    return "In die Tagesordnung übernommen.";
  });
}

export async function dismissCarryOverAction(meetingId: string, itemId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await dismissCarryOver(await requireUser(), meetingId, itemId);
    refresh(meetingId);
  });
}

export async function acceptProposalAction(meetingId: string, proposalId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await acceptProposal(await requireUser(), proposalId, meetingId);
    refresh(meetingId);
    revalidatePath("/meetings/proposals");
    return "Vorschlag übernommen.";
  });
}

export async function rejectProposalAction(proposalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await rejectProposal(await requireUser(), proposalId, formData);
    revalidatePath("/meetings", "layout");
    return "Vorschlag verworfen.";
  });
}

export async function createProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await createProposal(await requireUser(), formData);
    revalidatePath("/meetings", "layout");
    return "Vorschlag eingereicht.";
  });
}

export async function toggleSupportAction(proposalId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await toggleSupport(await requireUser(), proposalId);
    revalidatePath("/meetings/proposals");
  });
}
