"use server";

import type { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { addTaskComment, createTask, deleteTask, setTaskStatus, updateTask } from "@/server/services/tasks";

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createTask(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect(`/tasks/${id}`);
  }
  return result;
}

export async function updateTaskAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateTask(await requireUser(), id, formData);
  });
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect(`/tasks/${id}`);
  }
  return result;
}

export async function setTaskStatusAction(id: string, status: TaskStatus, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await setTaskStatus(await requireUser(), id, status);
    revalidatePath("/", "layout");
    return "Status geändert.";
  });
}

export async function deleteTaskAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteTask(await requireUser(), id);
  });
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect("/tasks");
  }
  return result;
}

export async function addCommentAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addTaskComment(await requireUser(), id, formData);
    revalidatePath(`/tasks/${id}`);
    return "Kommentar gespeichert.";
  });
}
