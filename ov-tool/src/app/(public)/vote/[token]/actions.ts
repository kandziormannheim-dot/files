"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { UserError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { voteByToken } from "@/server/services/circulations";

export async function voteByTokenAction(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!rateLimit(`vote:${token}`, 10, 60 * 60_000)) throw new UserError("Zu viele Versuche. Bitte später erneut.");
    await voteByToken(token, formData);
    return "Vielen Dank – Ihre Stimme ist gespeichert.";
  });
}
