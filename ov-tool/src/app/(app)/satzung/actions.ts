"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { askStatute } from "@/server/services/statute-qa";

export async function askStatuteAction(question: string): Promise<ActionState> {
  return runAction(async () => {
    const answer = await askStatute(await requireUser(), question);
    return { data: answer as unknown as Record<string, unknown> };
  });
}
