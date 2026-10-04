"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

export function CancelMeetingDialog({
  action,
  invited,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  invited: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Absagen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sitzung absagen</DialogTitle>
          <DialogDescription>Die Sitzung wird als abgesagt markiert; die Tagesordnung bleibt erhalten.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} onSuccess={() => setOpen(false)} className="flex flex-col gap-3">
          <Field label="Grund (optional, steht in der Absage)" name="cancelReason">
            <Textarea id="cancelReason" name="cancelReason" rows={2} />
          </Field>
          {invited ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="notify" defaultChecked /> Absage an alle Eingeladenen senden
            </label>
          ) : null}
          <SubmitButton variant="destructive" className="self-start">
            Sitzung absagen
          </SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
