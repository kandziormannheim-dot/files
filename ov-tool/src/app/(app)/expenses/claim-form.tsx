"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

type Values = { title: string; occasion: string; payout: "SPENDE" | "UEBERWEISUNG" | "BAR"; accountHolder: string; ibanMasked: string; address: string; note: string };

const OPTIONS: { value: Values["payout"]; label: string; hint: string }[] = [
  { value: "UEBERWEISUNG", label: "Überweisung", hint: "auf mein Konto" },
  { value: "BAR", label: "Barauszahlung", hint: "gegen Quittung" },
  { value: "SPENDE", label: "Spendenbescheinigung", hint: "Verzicht auf Erstattung (Aufwandsspende)" },
];

export function ClaimForm({ action, values, defaultHolder, isNew }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; values?: Values; defaultHolder: string; isNew: boolean }) {
  const [payout, setPayout] = useState<Values["payout"]>(values?.payout ?? "UEBERWEISUNG");
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <Field label="Wofür?" name="title">
        <Input id="title" name="title" required defaultValue={values?.title} placeholder="z. B. Material Infostand Weihnachtsmarkt" />
      </Field>
      <Field label="Anlass (optional)" name="occasion">
        <Input id="occasion" name="occasion" defaultValue={values?.occasion} placeholder="z. B. Infostand am 12.12. in Seckenheim" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Erstattung als</legend>
        <div className={isNew ? "grid grid-cols-1 gap-2 sm:grid-cols-3" : "grid grid-cols-1 gap-2"}>
          {OPTIONS.map((o) => (
            <label key={o.value} className="flex cursor-pointer flex-col rounded-md border p-3 text-sm has-[:checked]:border-cadenabbia has-[:checked]:bg-cadenabbia-10">
              <span className="flex items-center gap-2 font-semibold text-rhoendorf">
                <input type="radio" name="payout" value={o.value} checked={payout === o.value} onChange={() => setPayout(o.value)} className="accent-[#2d3c4b]" />
                {o.label}
              </span>
              <span className="pl-6 text-xs text-neutral-600">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {payout === "UEBERWEISUNG" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kontoinhaber/in" name="accountHolder">
            <Input id="accountHolder" name="accountHolder" defaultValue={values?.accountHolder || defaultHolder} autoComplete="name" />
          </Field>
          <Field label="IBAN" name="iban" hint={values?.ibanMasked ? `Gespeichert: ${values.ibanMasked} – leer lassen, um sie zu behalten` : "wird verschlüsselt gespeichert und nach 12 Monaten gelöscht"}>
            <Input id="iban" name="iban" inputMode="text" autoComplete="off" placeholder="DE.." required={!values?.ibanMasked} />
          </Field>
        </div>
      ) : null}
      {payout === "SPENDE" ? (
        <Field label="Anschrift für die Spendenbescheinigung" name="address" hint="Straße, Hausnummer, PLZ, Ort. Voraussetzung ist ein Anspruch auf Erstattung, auf den freiwillig verzichtet wird – die Prüfung erfolgt durch die Kreisgeschäftsstelle.">
          <Textarea id="address" name="address" rows={3} required defaultValue={values?.address} autoComplete="street-address" />
        </Field>
      ) : null}
      <Field label="Bemerkung (optional)" name="note">
        <Textarea id="note" name="note" rows={2} defaultValue={values?.note} />
      </Field>
      <SubmitButton className="self-start">{isNew ? "Weiter zu den Belegen" : "Speichern"}</SubmitButton>
    </ActionForm>
  );
}
