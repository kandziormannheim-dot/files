"use client";

import { useState } from "react";
import { addResolutionAction } from "@/app/(app)/meetings/[id]/minutes/actions";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { evaluateMajority } from "@/server/services/statute";

export function ResolutionDialog({ meetingId, minutesId, itemId, topLabel }: { meetingId: string; minutesId: string; itemId: string; topLabel: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"BESCHLUSS" | "ERGEBNIS">("BESCHLUSS");
  const [votes, setVotes] = useState({ yes: "", no: "", abstain: "" });
  const hasVotes = votes.yes !== "" || votes.no !== "" || votes.abstain !== "";
  let preview = "";
  if (kind === "BESCHLUSS" && hasVotes) {
    try {
      preview = evaluateMajority({ yes: Number(votes.yes || 0), no: Number(votes.no || 0), abstain: Number(votes.abstain || 0) }).text;
    } catch {
      preview = "";
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Beschluss/Ergebnis
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Beschluss oder Ergebnis zu {topLabel}</DialogTitle>
          <DialogDescription>
            Beschluss = abgestimmt (einfache Mehrheit der abgegebenen Stimmen, Enthaltungen zählen nicht, Gleichstand = abgelehnt). Ergebnis =
            Feststellung ohne Abstimmung.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={addResolutionAction.bind(null, meetingId, minutesId, itemId)}
          onSuccess={() => {
            setOpen(false);
            setVotes({ yes: "", no: "", abstain: "" });
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Art" name="kind">
            <NativeSelect id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="BESCHLUSS">Beschluss (abgestimmt)</option>
              <option value="ERGEBNIS">Ergebnis (ohne Abstimmung)</option>
            </NativeSelect>
          </Field>
          <Field label="Gegenstand / Antragstext" name="subject">
            <Textarea id="subject" name="subject" rows={2} required />
          </Field>
          {kind === "BESCHLUSS" ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(["yes", "no", "abstain"] as const).map((k) => (
                  <Field key={k} label={{ yes: "Ja", no: "Nein", abstain: "Enthaltung" }[k]} name={`votes${k}`}>
                    <Input
                      name={{ yes: "votesYes", no: "votesNo", abstain: "votesAbstain" }[k]}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={votes[k]}
                      onChange={(e) => setVotes((v) => ({ ...v, [k]: e.target.value }))}
                    />
                  </Field>
                ))}
              </div>
              {hasVotes ? (
                <p className="rounded-md bg-akzent-hell/60 px-3 py-2 text-sm">{preview}</p>
              ) : (
                <>
                  <input type="hidden" name="resultType" value="ANGENOMMEN_EINSTIMMIG" />
                  <p className="text-xs text-neutral-600">Ohne Stimmenzahlen wird „einstimmig angenommen“ erfasst.</p>
                </>
              )}
            </>
          ) : (
            <Field label="Ergebnisart" name="resultType">
              <NativeSelect id="resultType" name="resultType" defaultValue="FESTGESTELLT">
                <option value="FESTGESTELLT">festgestellt</option>
                <option value="KENNTNISNAHME">zur Kenntnis genommen</option>
                <option value="VERTAGT">vertagt</option>
                <option value="ABGESETZT">abgesetzt</option>
              </NativeSelect>
            </Field>
          )}
          <SubmitButton className="self-start">Speichern</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
