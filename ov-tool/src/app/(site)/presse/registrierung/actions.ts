"use server";

import { headers } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { UserError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { registerContact } from "@/server/services/press";

export async function registerPressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "x";
    if (!rateLimit(`press-register:${ip}`, 5, 60 * 60_000)) throw new UserError("Zu viele Registrierungen in kurzer Zeit. Bitte später erneut versuchen.");
    await registerContact(formData);
    return "Vielen Dank! Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen gerade geschickt haben.";
  });
}
