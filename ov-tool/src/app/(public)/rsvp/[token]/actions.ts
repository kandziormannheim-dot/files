"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { rateLimit } from "@/server/rate-limit";
import { UserError } from "@/server/errors";
import { respondByToken } from "@/server/services/meetings";

export async function respondByTokenAction(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!rateLimit(`rsvp:${token}`, 20, 60 * 60_000)) throw new UserError("Zu viele Versuche. Bitte später erneut.");
    await respondByToken(token, formData);
    return formData.get("response") === "ZUGESAGT" ? "Vielen Dank – Ihre Zusage ist gespeichert." : "Vielen Dank – Ihre Absage ist gespeichert.";
  });
}
