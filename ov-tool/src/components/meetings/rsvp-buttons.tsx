"use client";

import type { RsvpResponse } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/components/form";
import type { ActionState } from "@/lib/action-state";

export function RsvpButtons({
  action,
  current,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  current: RsvpResponse;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={action} showErrorInline={false}>
        <input type="hidden" name="response" value="ZUGESAGT" />
        <SubmitButton variant={current === "ZUGESAGT" ? "default" : "outline"} pendingText="…">
          {current === "ZUGESAGT" ? "✓ Zugesagt" : "Zusagen"}
        </SubmitButton>
      </ActionForm>
      <ActionForm action={action} showErrorInline={false}>
        <input type="hidden" name="response" value="ABGESAGT" />
        <SubmitButton variant={current === "ABGESAGT" ? "secondary" : "outline"} pendingText="…">
          {current === "ABGESAGT" ? "✓ Abgesagt" : "Absagen"}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
