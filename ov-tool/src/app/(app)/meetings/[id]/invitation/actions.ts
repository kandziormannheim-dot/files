"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { sendInvitation } from "@/server/services/invitations";

export async function sendInvitationAction(meetingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const count = await sendInvitation(await requireUser(), meetingId, formData);
    revalidatePath(`/meetings/${meetingId}`, "layout");
    revalidatePath("/meetings");
    return `Einladung an ${count} Empfänger versendet.`;
  });
}
