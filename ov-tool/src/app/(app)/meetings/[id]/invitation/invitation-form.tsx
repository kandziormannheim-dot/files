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
  testDisabled = false,
  myEmail,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  subject: string;
  text: string;
  total: number;
  newCount: number;
  alreadySent: boolean;
  disabled: boolean;
  testDisabled?: boolean;
  myEmail: string;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <Field label="Betreff" name="subject">
        <Input id="subject" name="subject" defaultValue={subject} required />
      </Field>
      <Field
        label="Text der E-Mail"
        name="text"
        hint="[Zusage-Link] wird für jede Person durch die Knöpfe Zusage/Vielleicht/Absage ersetzt. **Text** erscheint in der Mail fett. Datum, Ort und Tagesordnung bitte in der Sitzung ändern, nicht hier."
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
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton name="intent" value="test" variant="outline" disabled={testDisabled} pendingText="Wird gesendet …">
          Testmail an mich
        </SubmitButton>
        <SubmitButton name="intent" value="send" disabled={disabled} pendingText="Wird versendet …">
          {alreadySent ? "Einladung senden" : `Einladung an ${total} Empfänger senden`}
        </SubmitButton>
      </div>
      <p className="text-xs text-rhoendorf-60">
        „Testmail an mich“ schickt genau diese Einladung mit Knöpfen und Anhängen nur an {myEmail} – ohne Status oder Empfänger zu ändern.
      </p>
    </ActionForm>
  );
}
