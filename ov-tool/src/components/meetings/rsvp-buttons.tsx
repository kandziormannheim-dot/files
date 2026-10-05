"use client";

import type { RsvpResponse } from "@prisma/client";
import { Check, CircleHelp, X } from "lucide-react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type Choice = Exclude<RsvpResponse, "OFFEN">;

const CHOICES: { value: Choice; label: string; icon: typeof Check; active: string }[] = [
  { value: "ZUGESAGT", label: "Ich komme", icon: Check, active: "border-gruen bg-gruen/10 text-[#1f6b43] ring-2 ring-gruen/40" },
  { value: "VIELLEICHT", label: "Vielleicht", icon: CircleHelp, active: "border-union-gold bg-union-gold/15 text-[#6b4500] ring-2 ring-union-gold/50" },
  { value: "ABGESAGT", label: "Ich kann nicht", icon: X, active: "border-union-rot bg-union-rot/10 text-union-rot ring-2 ring-union-rot/30" },
];

/**
 * Zu-/Absage mit „Vielleicht“ und optionaler Nachricht – auf der Rückmeldeseite (Link aus der Einladung)
 * und auf der Sitzungsseite. `initial` wählt die Antwort aus dem Mail-Link vor; gespeichert wird erst beim Absenden.
 */
export function RsvpButtons({
  action,
  current,
  initial,
  note = "",
  large = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  current: RsvpResponse;
  initial?: Choice;
  note?: string;
  large?: boolean;
}) {
  const [choice, setChoice] = useState<Choice | null>(initial ?? (current === "OFFEN" ? null : current));
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <fieldset>
        <legend className="sr-only">Ihre Rückmeldung</legend>
        <div className="grid grid-cols-3 gap-2">
          {CHOICES.map(({ value, label, icon: Icon, active }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 bg-white text-center font-semibold text-rhoendorf transition",
                large ? "min-h-24 px-2 py-4 text-sm sm:text-base" : "px-2 py-3 text-sm",
                choice === value ? active : "border-rhoendorf-10 hover:border-cadenabbia",
              )}
            >
              <input type="radio" name="response" value={value} checked={choice === value} onChange={() => setChoice(value)} className="sr-only" required />
              <Icon className={large ? "size-7" : "size-5"} aria-hidden />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rsvp-note" className="text-sm font-medium text-rhoendorf">
          Nachricht an den Vorstand <span className="font-normal text-rhoendorf-60">(optional)</span>
        </label>
        <Textarea
          id="rsvp-note"
          name="note"
          rows={large ? 3 : 2}
          maxLength={1000}
          defaultValue={note}
          placeholder={choice === "ABGESAGT" ? "z. B. Grund, Vertretung, Hinweise zu einem TOP" : "z. B. komme etwas später, Anmerkung zur Tagesordnung"}
        />
      </div>
      <SubmitButton className={cn("self-start", large && "w-full sm:w-auto")} disabled={!choice} pendingText="Wird gespeichert …">
        {current === "OFFEN" ? "Rückmeldung senden" : "Rückmeldung aktualisieren"}
      </SubmitButton>
    </ActionForm>
  );
}
