"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  approvePost,
  createPost,
  deletePost,
  markPublished,
  revokeApproval,
  sendToWordpress,
  updatePost,
} from "@/server/services/marketing";
import { publishToMeta } from "@/server/services/meta";

export async function createPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createPost(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    revalidatePath("/marketing");
    redirect(`/marketing/${id}`);
  }
  return result;
}

const refresh = (id: string) => {
  revalidatePath("/marketing");
  revalidatePath(`/marketing/${id}`);
};

export async function updatePostAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updatePost(await requireUser(), id, formData);
    refresh(id);
    return "Gespeichert.";
  });
}

export async function approvePostAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await approvePost(await requireUser(), id);
    refresh(id);
    return "Freigegeben.";
  });
}

export async function revokePostAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await revokeApproval(await requireUser(), id);
    refresh(id);
    return "Freigabe zurückgenommen.";
  });
}

export async function markPublishedAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await markPublished(await requireUser(), id);
    refresh(id);
    return "Als veröffentlicht vermerkt.";
  });
}

export async function wordpressAction(id: string, mode: "draft" | "publish", _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const wp = await sendToWordpress(await requireUser(), id, mode);
    refresh(id);
    return wp.status === "publish" ? "Auf der Webseite veröffentlicht." : "Als Entwurf in WordPress gespeichert.";
  });
}

export async function deletePostAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deletePost(await requireUser(), id);
  });
  if (result?.ok) {
    revalidatePath("/marketing");
    redirect("/marketing");
  }
  return result;
}

export async function publishMetaAction(
  id: string,
  network: "facebook" | "instagram",
  format: "image" | "video",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const pub = await publishToMeta(await requireUser(), id, network, format, { withBlogLink: formData.get("withBlogLink") === "on" });
    refresh(id);
    return `Veröffentlicht auf ${network === "facebook" ? "Facebook" : "Instagram"}.${pub.permalink ? ` ${pub.permalink}` : ""}`;
  });
}
