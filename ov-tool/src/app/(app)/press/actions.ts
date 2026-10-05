"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import {
  addClipping,
  addContact,
  approveRelease,
  createRelease,
  deleteClipping,
  deleteContact,
  deleteRelease,
  publishRelease,
  revokeRelease,
  setContactStatus,
  updateRelease,
} from "@/server/services/press";

const refresh = (id?: string) => {
  revalidatePath("/press", "layout");
  revalidatePath("/presse", "layout");
  if (id) revalidatePath(`/press/${id}`);
};

export async function createReleaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createRelease(await requireUser(), formData)).id;
  });
  if (result?.ok) {
    refresh();
    redirect(`/press/${id}`);
  }
  return result;
}

export async function updateReleaseAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateRelease(await requireUser(), id, formData);
    refresh(id);
    return "Gespeichert.";
  });
}

export async function approveReleaseAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await approveRelease(await requireUser(), id);
    refresh(id);
    return "Freigegeben.";
  });
}

export async function revokeReleaseAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await revokeRelease(await requireUser(), id);
    refresh(id);
    return "Zurück im Entwurf.";
  });
}

export async function publishReleaseAction(id: string, send: boolean, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const { sent } = await publishRelease(await requireUser(), id, send);
    refresh(id);
    return send ? `Veröffentlicht und an ${sent} Empfänger einzeln versendet.` : "Im Presseportal veröffentlicht.";
  });
}

export async function deleteReleaseAction(id: string, _prev: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteRelease(await requireUser(), id);
  });
  if (result?.ok) {
    refresh();
    redirect("/press");
  }
  return result;
}

export async function addContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addContact(await requireUser(), formData);
    refresh();
    return "Kontakt aufgenommen.";
  });
}

export async function setContactStatusAction(id: string, status: "AKTIV" | "ABGEMELDET", _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await setContactStatus(await requireUser(), id, status);
    refresh();
  });
}

export async function deleteContactAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteContact(await requireUser(), id);
    refresh();
    return "Kontakt gelöscht.";
  });
}

export async function addClippingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addClipping(await requireUser(), formData);
    refresh();
    return "Artikel erfasst.";
  });
}

export async function deleteClippingAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteClipping(await requireUser(), id);
    refresh();
  });
}
