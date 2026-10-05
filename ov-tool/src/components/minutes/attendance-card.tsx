"use client";

import type { Presence } from "@prisma/client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  determineQuorumAction,
  reopenAction,
  setPresenceAction,
  suspendAction,
} from "@/app/(app)/meetings/[id]/minutes/actions";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { QuorumState } from "@/server/services/minutes";

export type AttendanceRow = { id: string; name: string; funktion: string; voting: string; response: string; presence: Presence | null };

const VOTING: Record<string, string> = { STIMMBERECHTIGT: "", BERATEND: "beratend", OHNE: "ohne Stimmrecht" };

export function AttendanceCard({
  meetingId,
  minutesId,
  rows,
  initialQuorum,
  determined,
  isRepeat,
  suspended,
  canManage,
  defaultLocation,
}: {
  meetingId: string;
  minutesId: string;
  rows: AttendanceRow[];
  initialQuorum: QuorumState;
  determined: { by: string; present: number; eligible: number; reached: boolean } | null;
  isRepeat: boolean;
  suspended: boolean;
  canManage: boolean;
  defaultLocation: string;
}) {
  const [quorum, setQuorum] = useState(initialQuorum);
  const [, startTransition] = useTransition();

  const change = (id: string, presence: string) =>
    startTransition(async () => {
      const res = await setPresenceAction(minutesId, id, presence);
      if (res.error) toast.error(res.error);
      else if (res.quorum) setQuorum(res.quorum);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anwesenheit und Beschlussfähigkeit</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className={`rounded-md px-3 py-2 text-sm font-medium ${quorum.reached ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-950"}`}
          aria-live="polite"
        >
          {quorum.present} von {quorum.eligible} Stimmberechtigten anwesend – beschlussfähig: {quorum.reached ? "ja" : "nein"}
          {quorum.byRepeat ? " (Wiederholungssitzung, LV § 52 Abs. 3)" : ` (nötig: ${quorum.required})`}
        </div>
        <ul className="flex flex-col divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <div className="min-w-0 text-sm">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-neutral-500">
                  {[r.funktion, VOTING[r.voting]].filter(Boolean).join(" · ")}
                  {r.response === "ZUGESAGT" ? " · hatte zugesagt" : r.response === "ABGESAGT" ? " · hatte abgesagt" : r.response === "VIELLEICHT" ? " · vielleicht" : ""}
                </div>
              </div>
              <NativeSelect
                className="w-48"
                defaultValue={r.presence ?? ""}
                aria-label={`Anwesenheit ${r.name}`}
                onChange={(e) => change(r.id, e.target.value)}
              >
                <option value="" disabled>
                  – bitte wählen –
                </option>
                <option value="ANWESEND">anwesend</option>
                <option value="ANWESEND_DIGITAL">anwesend (digital)</option>
                <option value="ENTSCHULDIGT">entschuldigt</option>
                <option value="NICHT_ANWESEND">nicht anwesend</option>
              </NativeSelect>
            </li>
          ))}
        </ul>

        {determined ? (
          <p className="text-sm">
            Festgestellt durch {determined.by}: {determined.present} von {determined.eligible} anwesend –{" "}
            <strong>{determined.reached || isRepeat ? "beschlussfähig" : "nicht beschlussfähig"}</strong>.
          </p>
        ) : (
          <p className="text-sm text-neutral-600">Vor Eintritt in die Tagesordnung stellt der Vorsitzende die Beschlussfähigkeit fest (Statut § 40 Abs. 2).</p>
        )}
        <ActionForm action={determineQuorumAction.bind(null, meetingId, minutesId)} className="flex flex-wrap items-end gap-2" showErrorInline={false}>
          <Field label="Festgestellt durch" name="determinedBy" className="min-w-0 flex-1">
            <Input id="determinedBy" name="determinedBy" defaultValue={determined?.by || "den Vorsitzenden"} />
          </Field>
          <SubmitButton variant={determined ? "outline" : "default"}>
            {determined ? "Erneut feststellen" : "Beschlussfähigkeit feststellen"}
          </SubmitButton>
        </ActionForm>

        {suspended ? (
          <Alert variant="warning">
            <AlertDescription className="flex flex-col gap-2">
              Die Sitzung wurde wegen Beschlussunfähigkeit aufgehoben (LV-Satzung § 52 Abs. 3). Eine Wiedereröffnung ist nur möglich,
              wenn die Beschlussfähigkeit inzwischen erreicht ist.
              {canManage ? (
                <ActionForm action={reopenAction.bind(null, meetingId, minutesId)} showErrorInline={false}>
                  <SubmitButton size="sm" variant="outline" disabled={!quorum.reached}>
                    Sitzung wiedereröffnen
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : canManage && determined && !determined.reached && !isRepeat ? (
          <SuspendDialog meetingId={meetingId} minutesId={minutesId} defaultLocation={defaultLocation} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function SuspendDialog({ meetingId, minutesId, defaultLocation }: { meetingId: string; minutesId: string; defaultLocation: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Sitzung wegen Beschlussunfähigkeit aufheben</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sitzung aufheben</DialogTitle>
          <DialogDescription>
            Der Vorsitzende muss die Sitzung sofort aufheben und neu einladen. Die neue Sitzung ist in jedem Fall beschlussfähig; Form und
            Frist sind nicht bindend (LV-Satzung § 52 Abs. 3). Die Tagesordnung wird übernommen.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={suspendAction.bind(null, meetingId, minutesId)} className="flex flex-col gap-3">
          <Field label="Neuer Termin" name="startsAt">
            <Input id="startsAt" name="startsAt" type="datetime-local" required />
          </Field>
          <Field label="Ort" name="location">
            <Input id="location" name="location" defaultValue={defaultLocation} />
          </Field>
          <SubmitButton variant="destructive" className="self-start">
            Aufheben und Folgesitzung anlegen
          </SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
