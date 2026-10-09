"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  createProject,
  deleteProject,
  removeClip,
  removeMusic,
  savePlan,
  setMusic,
  startProcessing,
  toMarketingPost,
  updateProject,
  type ProcessMode,
} from "@/server/services/video";

const refresh = (id?: string) => {
  revalidatePath("/marketing/videos");
  if (id) revalidatePath(`/marketing/videos/${id}`);
};

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createProject(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/marketing/videos/${id}`);
  }
  return result;
}

export async function updateProjectAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateProject(await requireUser(), id, formData);
    refresh(id);
    return "Gespeichert. Für einen neuen Schnitt „Neu schneiden lassen“ wählen.";
  });
}

export async function deleteProjectAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteProject(await requireUser(), id);
  });
  if (result?.ok) {
    refresh();
    redirect("/marketing/videos");
  }
  return result;
}

export async function startProcessingAction(id: string, mode: ProcessMode, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await startProcessing(await requireUser(), id, mode);
    refresh(id);
    return mode === "render" ? "Video wird neu gerendert." : "Video wird geschnitten – das dauert einige Minuten.";
  });
}

export async function savePlanAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const warnings = await savePlan(await requireUser(), id, formData);
    refresh(id);
    return ["Schnitt gespeichert – Video wird neu gerendert.", ...warnings].join(" ");
  });
}

export async function removeClipAction(id: string, clipId: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await removeClip(await requireUser(), clipId);
    refresh(id);
    return "Clip entfernt.";
  });
}

export async function setMusicAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await setMusic(await requireUser(), id, formData);
    refresh(id);
    return "Musik gespeichert. Sie wird beim nächsten Rendern unterlegt.";
  });
}

export async function removeMusicAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await removeMusic(await requireUser(), id);
    refresh(id);
    return "Musik entfernt.";
  });
}

export async function toMarketingPostAction(id: string, _prev: ActionState): Promise<ActionState> {
  let postId = "";
  const result = await runAction(async () => {
    postId = await toMarketingPost(await requireUser(), id);
  });
  if (result?.ok) {
    refresh(id);
    revalidatePath("/marketing");
    redirect(`/marketing/${postId}`);
  }
  return result;
}

/** Nach dem Hochladen automatisch schneiden (vom Upload-Dialog aufgerufen). */
export async function autoStartAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await runAction(async () => {
    await startProcessing(await requireUser(), id, "full");
  });
  refresh(id);
  return r?.ok ? { ok: true } : { ok: false, error: r?.error };
}
