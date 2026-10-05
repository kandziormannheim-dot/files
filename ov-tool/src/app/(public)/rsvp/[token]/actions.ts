"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { rateLimit } from "@/server/rate-limit";
import { UserError } from "@/server/errors";
import { respondByToken } from "@/server/services/meetings";

const THANKS: Record<string, string> = {
  ZUGESAGT: "Vielen Dank – Ihre Zusage ist gespeichert.",
  VIELLEICHT: "Vielen Dank – wir haben „vielleicht“ notiert. Bitte geben Sie Bescheid, sobald Sie es wissen.",
  ABGESAGT: "Vielen Dank – Ihre Absage ist gespeichert.",
};

export async function respondByTokenAction(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!rateLimit(`rsvp:${token}`, 20, 60 * 60_000)) throw new UserError("Zu viele Versuche. Bitte später erneut.");
    await respondByToken(token, formData);
    return THANKS[String(formData.get("response"))] ?? "Vielen Dank – Ihre Rückmeldung ist gespeichert.";
  });
}
