"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { createPage, deletePage, deleteSubmission, setPageStatus, updatePage } from "@/server/services/landing";

const refresh = (id?: string) => {
  revalidatePath("/landing");
  if (id) revalidatePath(`/landing/${id}`);
};

export async function createPageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createPage(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/landing/${id}`);
  }
  return result;
}

export async function updatePageAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { resetApproval } = await updatePage(await requireUser(), id, formData);
    refresh(id);
    return resetApproval ? "Gespeichert – die Seite muss erneut freigegeben werden." : "Gespeichert.";
  });
}

export async function setPageStatusAction(id: string, status: "ENTWURF" | "FREIGEGEBEN" | "ARCHIVIERT", _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await setPageStatus(await requireUser(), id, status);
    refresh(id);
    return status === "FREIGEGEBEN" ? "Freigegeben – die Seite ist online." : status === "ARCHIVIERT" ? "Archiviert." : "Offline genommen.";
  });
}

export async function deletePageAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deletePage(await requireUser(), id);
  });
  if (result?.ok) {
    refresh();
    redirect("/landing");
  }
  return result;
}

export async function deleteSubmissionAction(pageId: string, id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteSubmission(await requireUser(), id);
    refresh(pageId);
  });
}
