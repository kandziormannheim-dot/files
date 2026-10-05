"use server";

import { headers } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { UserError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { submitLanding } from "@/server/services/landing";

export async function submitLandingAction(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "x";
    if (!rateLimit(`landing:${ip}`, 10, 60 * 60_000)) throw new UserError("Zu viele Einträge in kurzer Zeit. Bitte später erneut versuchen.");
    const { newsletter } = await submitLanding(slug, formData);
    return newsletter
      ? "Vielen Dank! Bitte bestätigen Sie noch den Newsletter über den Link in der E-Mail, die wir Ihnen gerade geschickt haben."
      : "Vielen Dank – Ihr Eintrag ist angekommen.";
  });
}
