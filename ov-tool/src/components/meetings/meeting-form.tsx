"use client";

import type { Meeting } from "@prisma/client";
import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { toDateInput, toDateTimeInput } from "@/lib/dates";
import { StatuteRef } from "@/components/statute-ref";

export function MeetingForm({
  action,
  meeting,
  defaultLocation,
  responseDaysBefore,
  noticeDays,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  meeting?: Meeting;
  defaultLocation: string;
  responseDaysBefore: number;
  noticeDays: number;
}) {
  const [format, setFormat] = useState(meeting?.format ?? "PRAESENZ");
  const [urgent, setUrgent] = useState(meeting?.urgent ?? false);
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Sitzungsart" name="type">
        <NativeSelect id="type" name="type" defaultValue={meeting?.type ?? "VORSTANDSSITZUNG"}>
          <option value="VORSTANDSSITZUNG">Vorstandssitzung</option>
          <option value="ERWEITERTE_VORSTANDSSITZUNG">erweiterte Vorstandssitzung</option>
          <option value="KLAUSURTAGUNG">Klausurtagung</option>
          <option value="SONSTIGE">sonstige Sitzung</option>
        </NativeSelect>
      </Field>
      <Field label="Form" name="format" hint="Digital Anwesende zählen für die Beschlussfähigkeit (LV § 50 d).">
        <NativeSelect id="format" name="format" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
          <option value="PRAESENZ">Präsenz</option>
          <option value="DIGITAL">digital</option>
          <option value="HYBRID">hybrid</option>
        </NativeSelect>
      </Field>
      <Field label="Beginn" name="startsAt" hint="Datum und Uhrzeit erscheinen überall aus diesem einen Feld.">
        <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toDateTimeInput(meeting?.startsAt)} required />
      </Field>
      <Field label="Ende (optional)" name="endsAt">
        <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toDateTimeInput(meeting?.endsAt)} />
      </Field>
      {format !== "DIGITAL" ? (
        <Field label="Ort" name="location" className="sm:col-span-2">
          <Input id="location" name="location" defaultValue={meeting?.location ?? defaultLocation} placeholder="Gasthaus, Straße, PLZ Ort" />
        </Field>
      ) : null}
      {format !== "PRAESENZ" ? (
        <Field label="Online-Link (Teams/Zoom)" name="onlineUrl" className="sm:col-span-2">
          <Input id="onlineUrl" name="onlineUrl" type="url" defaultValue={meeting?.onlineUrl} placeholder="https://" />
        </Field>
      ) : null}
      <Field
        label="Rückmeldung bis"
        name="responseDeadline"
        hint={`Leer = ${responseDaysBefore} Tage vor der Sitzung`}
      >
        <Input id="responseDeadline" name="responseDeadline" type="date" defaultValue={toDateInput(meeting?.responseDeadline)} />
      </Field>
      <Field label="Titel (optional)" name="title" hint="Leer = „Vorstandssitzung am …“">
        <Input id="title" name="title" defaultValue={meeting?.title} />
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="urgent" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          eilbedürftig – Ladungsfrist von {noticeDays} Tagen darf unterschritten werden (<StatuteRef cite="LV-Satzung § 50 Abs. 3">LV-Satzung § 50 Abs. 3</StatuteRef>)
        </label>
        {urgent ? (
          <Field label="Begründung (erscheint im Protokoll unter Formalia)" name="urgencyReason">
            <Textarea id="urgencyReason" name="urgencyReason" defaultValue={meeting?.urgencyReason} rows={2} />
          </Field>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>{meeting ? "Speichern" : "Sitzung anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
