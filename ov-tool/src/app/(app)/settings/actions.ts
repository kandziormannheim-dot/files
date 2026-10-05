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

/** Testmail an die eigene Adresse – prüft SMTP-Zugang und Zustellung. */
export async function sendTestMailAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    const { assertCan } = await import("@/server/auth/permissions");
    assertCan(user, "settings.manage");
    const { sendMail } = await import("@/server/mail/transport");
    await sendMail({
      to: user.email,
      subject: "Testmail aus dem OV-Management",
      text: `Hallo ${user.name},\n\ndiese Testmail bestätigt, dass der Mailversand des OV-Managements funktioniert.\n\nAbsender: ${process.env.MAIL_FROM ?? "(nicht gesetzt)"}\nServer: ${process.env.SMTP_HOST ?? "(kein SMTP – nur Log)"}\n`,
    });
    const { audit } = await import("@/server/audit");
    const { db } = await import("@/server/db");
    await audit(db, user, "mail.test", "User", user.id, { to: user.email });
    return `Testmail an ${user.email} gesendet. Falls sie nicht ankommt: Spam-Ordner prüfen.`;
  });
}
