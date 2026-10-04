"use client";

import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";

const OPTIONS = [
  ["JA", "Zustimmung"],
  ["NEIN", "Ablehnung"],
  ["ENTHALTUNG", "Enthaltung"],
  ["WIDERSPRUCH", "Widerspruch gegen das Umlaufverfahren"],
] as const;

/** Stimmabgabe im Umlaufverfahren – eine Stimme, danach nicht mehr änderbar. */
export function VoteForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Ihre Stimme</legend>
        {OPTIONS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-akzent has-[:checked]:bg-akzent-hell/60">
            <input type="radio" name="vote" value={value} required />
            {label}
          </label>
        ))}
      </fieldset>
      <Field label="Anmerkung (optional)" name="comment">
        <Input id="comment" name="comment" />
      </Field>
      <p className="text-xs text-neutral-600">Die Stimme kann nach dem Absenden nicht mehr geändert werden. Sie wird mit Zeitstempel archiviert.</p>
      <SubmitButton className="self-start" pendingText="Wird gespeichert …">
        Stimme abgeben
      </SubmitButton>
    </ActionForm>
  );
}
