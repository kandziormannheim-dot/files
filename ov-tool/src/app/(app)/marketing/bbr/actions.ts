"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  createTestConcern,
  deleteTestConcern,
  resetSocialLogo,
  setConcernIgnored,
  startGeneration,
  syncNow,
  updateCreative,
  uploadSocialLogo,
  type SocialAccount,
} from "@/server/services/bbr-social";

const refresh = () => {
  revalidatePath("/marketing");
  revalidatePath("/marketing/bbr");
};

export async function syncNowAction(): Promise<ActionState> {
  return runAction(async () => {
    const r = await syncNow(await requireUser());
    refresh();
    return `${r.found} Anliegen mit Kurzfassung gefunden, ${r.created} neu, ${r.changed} geändert.`;
  });
}

export async function generateAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await startGeneration(await requireUser(), id, formData);
    refresh();
    return "Die Beiträge werden erstellt – das dauert etwa eine Minute. Danach die Seite neu laden.";
  });
}

export async function ignoreAction(id: string, ignored: boolean): Promise<ActionState> {
  return runAction(async () => {
    await setConcernIgnored(await requireUser(), id, ignored);
    refresh();
  });
}

export async function createTestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await createTestConcern(await requireUser(), formData);
    refresh();
    return "Test-Anliegen angelegt. Jetzt beim Anliegen „Beiträge erstellen“ wählen.";
  });
}

export async function deleteTestAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    await deleteTestConcern(await requireUser(), id);
    refresh();
  });
}

export async function uploadLogoAction(account: SocialAccount, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await uploadSocialLogo(await requireUser(), account, formData);
    refresh();
    return "Logo gespeichert. Es gilt für neu erzeugte Kacheln und Videos.";
  });
}

export async function resetLogoAction(account: SocialAccount): Promise<ActionState> {
  return runAction(async () => {
    await resetSocialLogo(await requireUser(), account);
    refresh();
  });
}

export async function updateCreativeAction(postId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const media = await updateCreative(await requireUser(), postId, formData);
    revalidatePath(`/marketing/${postId}`);
    return media.mediaError ? `Teilweise erzeugt: ${media.mediaError}` : "Kachel und Video neu erzeugt.";
  });
}
