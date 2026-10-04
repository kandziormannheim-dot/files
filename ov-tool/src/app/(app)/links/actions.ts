"use server";

import type { LinkCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { createLink, deleteLink, reorderLinks, updateLink } from "@/server/services/links";

export async function createLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await createLink(await requireUser(), formData);
  });
  if (result?.ok) {
    revalidatePath("/links");
    redirect("/links");
  }
  return result;
}

export async function updateLinkAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateLink(await requireUser(), id, formData);
  });
  if (result?.ok) {
    revalidatePath("/links");
    redirect("/links");
  }
  return result;
}

export async function deleteLinkAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteLink(await requireUser(), id);
  });
  if (result?.ok) {
    revalidatePath("/links");
    redirect("/links");
  }
  return result;
}

export async function reorderLinksAction(category: LinkCategory, ids: string[]): Promise<ActionState> {
  return runAction(async () => {
    await reorderLinks(await requireUser(), category, ids);
    revalidatePath("/links");
  });
}
