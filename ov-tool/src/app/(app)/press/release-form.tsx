"use client";

import type { PressRelease } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { toDateTimeInput } from "@/lib/dates";

export function ReleaseForm({ action, pm, aiEnabled }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; pm?: PressRelease; aiEnabled?: boolean }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <Field label="Überschrift" name="title">
        <Input id="title" name="title" required defaultValue={pm?.title} />
      </Field>
      <Field label="Unterzeile" name="subtitle">
        <Input id="subtitle" name="subtitle" defaultValue={pm?.subtitle} />
      </Field>
      <Field
        label={pm ? "Text" : "Text oder Stichpunkte"}
        name="body"
        hint="Absätze durch Leerzeile trennen; „## “ für Zwischenüberschriften. Ortsmarke am Anfang, z. B. „Mannheim-Seckenheim.“"
      >
        <Textarea id="body" name="body" rows={pm ? 16 : 8} defaultValue={pm?.body} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zitatgeber/in (optional)" name="quoteGiver">
          <Input id="quoteGiver" name="quoteGiver" defaultValue={pm?.quoteGiver} placeholder="z. B. Martin Kandzior, Vorsitzender" />
        </Field>
        <Field label="Sperrfrist (optional)" name="embargoUntil" hint="Im Portal erst ab diesem Zeitpunkt; Versand mit Sperrfristvermerk.">
          <Input id="embargoUntil" name="embargoUntil" type="datetime-local" defaultValue={pm?.embargoUntil ? toDateTimeInput(pm.embargoUntil) : ""} />
        </Field>
      </div>
      {!pm && aiEnabled ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="useAi" /> Entwurf von Claude aus den Stichpunkten schreiben lassen (danach prüfen!)
        </label>
      ) : null}
      <SubmitButton className="self-start" pendingText={pm ? "Wird gespeichert …" : "Wird angelegt …"}>
        {pm ? "Speichern" : "Entwurf anlegen"}
      </SubmitButton>
    </ActionForm>
  );
}
