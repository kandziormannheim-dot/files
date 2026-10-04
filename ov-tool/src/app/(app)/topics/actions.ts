"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { addTopicEvent, createTopic, deleteTopic, setForNextMeeting, updateTopic } from "@/server/services/topics";

const refresh = (id?: string) => {
  revalidatePath("/topics");
  if (id) revalidatePath(`/topics/${id}`);
  revalidatePath("/");
};

export async function createTopicAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const r = await runAction(async () => {
    id = (await createTopic(await requireUser(), fd)).id;
  });
  if (r?.ok) {
    refresh();
    redirect(`/topics/${id}`);
  }
  return r;
}

export async function updateTopicAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await runAction(async () => updateTopic(await requireUser(), id, fd));
  if (r?.ok) {
    refresh(id);
    redirect(`/topics/${id}`);
  }
  return r;
}

export async function addEventAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addTopicEvent(await requireUser(), id, fd);
    refresh(id);
    return "Eintrag gespeichert.";
  });
}

export async function forNextMeetingAction(id: string, value: boolean, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await setForNextMeeting(await requireUser(), id, value);
    refresh(id);
    return value ? "Wird in die Tagesordnung der nächsten Sitzung aufgenommen." : "Markierung entfernt.";
  });
}

export async function deleteTopicAction(id: string, _prev: ActionState): Promise<ActionState> {
  const r = await runAction(async () => deleteTopic(await requireUser(), id));
  if (r?.ok) {
    refresh();
    redirect("/topics");
  }
  return r;
}
