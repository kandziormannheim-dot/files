"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

type FormAction = (s: ActionState, f: FormData) => Promise<ActionState>;

export function SendMinutesForm({ action, canCirculate, complete }: { action: FormAction; canCirculate: boolean; complete: boolean }) {
  const [mode, setMode] = useState("SITZUNG");
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Genehmigungsweg</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="approvalMode" value="SITZUNG" checked={mode === "SITZUNG"} onChange={() => setMode("SITZUNG")} />
          in der Folgesitzung (der TOP „Genehmigung des Protokolls“ wird automatisch aufgenommen)
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="approvalMode"
            value="UMLAUF"
            disabled={!canCirculate}
            checked={mode === "UMLAUF"}
            onChange={() => setMode("UMLAUF")}
          />
          im Umlaufverfahren (Statut § 42 Abs. 3) – startet sofort{canCirculate ? "" : " (nur Admin)"}
        </label>
      </fieldset>
      {mode === "UMLAUF" ? (
        <Field label="Frist des Umlaufverfahrens" name="circulationDeadline" hint="leer = Standardfrist aus den Einstellungen">
          <Input id="circulationDeadline" name="circulationDeadline" type="date" />
        </Field>
      ) : null}
      <SubmitButton className="self-start" disabled={!complete} pendingText="Wird versendet …">
        Protokoll versenden
      </SubmitButton>
    </ActionForm>
  );
}

export function NewVersionForm({ action }: { action: FormAction }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-2">
      <Field label="Änderungshinweis" name="changeNote" hint="Was wird korrigiert? Erscheint im Protokoll.">
        <Textarea id="changeNote" name="changeNote" rows={2} required />
      </Field>
      <SubmitButton variant="outline" className="self-start">
        Neue Version anlegen
      </SubmitButton>
    </ActionForm>
  );
}
