"use client";

import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

type Values = { title: string; recipientName: string; recipientEmail: string; ccEmail?: string; body: string; reason: string };

export function MotionForm({ action, values, isNew }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; values: Values; isNew: boolean }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <Field label="Titel des Antrags" name="title">
        <Input id="title" name="title" required defaultValue={values.title} />
      </Field>
      <Field label="Empfänger (Anschrift im PDF)" name="recipientName" hint="z. B. Kreisvorstand oder Kreisparteitag der CDU Mannheim">
        <Textarea id="recipientName" name="recipientName" rows={2} required defaultValue={values.recipientName} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="E-Mail der Kreisgeschäftsstelle" name="recipientEmail" hint="Vorbelegt aus den Einstellungen">
          <Input id="recipientEmail" name="recipientEmail" type="email" required defaultValue={values.recipientEmail} />
        </Field>
        <Field label="Kopie an (optional)" name="ccEmail" hint="Sie selbst erhalten automatisch eine Kopie">
          <Input id="ccEmail" name="ccEmail" type="email" defaultValue={values.ccEmail} />
        </Field>
      </div>
      <Field label="Antragstext" name="body" hint="z. B. „Der Kreisvorstand möge beschließen: …“">
        <Textarea id="body" name="body" rows={8} required defaultValue={values.body} />
      </Field>
      <Field label="Begründung" name="reason">
        <Textarea id="reason" name="reason" rows={6} defaultValue={values.reason} />
      </Field>
      <SubmitButton className="self-start">{isNew ? "Antrag anlegen" : "Speichern"}</SubmitButton>
    </ActionForm>
  );
}
