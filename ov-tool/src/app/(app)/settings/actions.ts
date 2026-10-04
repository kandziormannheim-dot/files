"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { resetBriefbogen, updateSettings, uploadBriefbogen } from "@/server/services/settings";
import {
  previewTemplate,
  resetTemplate,
  restoreTemplateVersion,
  saveTemplate,
  type TemplatePreview,
} from "@/server/services/templates";

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const changed = await updateSettings(await requireUser(), formData);
    revalidatePath("/", "layout");
    return Object.keys(changed).length ? "Einstellungen gespeichert." : "Keine Änderungen.";
  });
}

export async function uploadBriefbogenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await uploadBriefbogen(await requireUser(), formData);
    revalidatePath("/settings/general");
    return "Briefbogen ersetzt.";
  });
}

export async function resetBriefbogenAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await resetBriefbogen(await requireUser());
    revalidatePath("/settings/general");
    return "Standard-Briefbogen wiederhergestellt.";
  });
}

export async function saveTemplateAction(key: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const t = await saveTemplate(await requireUser(), key, formData);
    revalidatePath("/settings/templates", "layout");
    return `Version ${t.version} gespeichert und aktiv.`;
  });
}

export async function restoreTemplateAction(key: string, version: number, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const t = await restoreTemplateVersion(await requireUser(), key, version);
    revalidatePath("/settings/templates", "layout");
    return `Version ${version} als neue Version ${t.version} aktiviert.`;
  });
}

export async function resetTemplateAction(key: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const t = await resetTemplate(await requireUser(), key);
    revalidatePath("/settings/templates", "layout");
    return `Ausgangsfassung als Version ${t.version} aktiviert.`;
  });
}

export async function previewTemplateAction(key: string, body: string): Promise<TemplatePreview> {
  return previewTemplate(await requireUser(), key, body);
}
