"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { sendInvitation, sendInvitationTest } from "@/server/services/invitations";

export async function sendInvitationAction(meetingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (formData.get("intent") === "test") {
      await sendInvitationTest(user, meetingId, formData);
      return `Testmail an ${user.email} gesendet – bitte Postfach (ggf. Spam) prüfen. Die Einladung ist noch nicht verschickt.`;
    }
    const count = await sendInvitation(user, meetingId, formData);
    revalidatePath(`/meetings/${meetingId}`, "layout");
    revalidatePath("/meetings");
    return `Einladung an ${count} Empfänger versendet.`;
  });
}
