"use client";

import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

export function InvitationForm({
  action,
  subject,
  text,
  total,
  newCount,
  alreadySent,
  disabled,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  subject: string;
  text: string;
  total: number;
  newCount: number;
  alreadySent: boolean;
  disabled: boolean;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <Field label="Betreff" name="subject">
        <Input id="subject" name="subject" defaultValue={subject} required />
      </Field>
      <Field
        label="Text der E-Mail"
        name="text"
        hint="[Zusage-Link] wird für jede Person durch ihren persönlichen Link ersetzt. Datum, Ort und Tagesordnung bitte in der Sitzung ändern, nicht hier."
      >
        <Textarea id="text" name="text" defaultValue={text} rows={18} className="font-mono text-sm" />
      </Field>
      {alreadySent ? (
        <Field label="Empfänger" name="scope">
          <NativeSelect id="scope" name="scope" defaultValue={newCount ? "new" : "all"}>
            <option value="new">nur neu hinzugekommene ({newCount})</option>
            <option value="all">erneut an alle ({total})</option>
          </NativeSelect>
        </Field>
      ) : (
        <input type="hidden" name="scope" value="all" />
      )}
      <SubmitButton className="self-start" disabled={disabled} pendingText="Wird versendet …">
        {alreadySent ? "Einladung senden" : `Einladung an ${total} Empfänger senden`}
      </SubmitButton>
    </ActionForm>
  );
}
