"use client";

import type { Action } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { toDateTimeInput } from "@/lib/dates";
import { ACTION_STATUS_LABELS, ACTION_TYPE_LABELS } from "@/lib/labels";

export function CampaignActionForm({ action, value }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; value?: Action }) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Titel" name="title" className="sm:col-span-2">
        <Input id="title" name="title" defaultValue={value?.title} required />
      </Field>
      <Field label="Art" name="type">
        <NativeSelect id="type" name="type" defaultValue={value?.type ?? "INFOSTAND"}>
          {Object.entries(ACTION_TYPE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Status" name="status">
        <NativeSelect id="status" name="status" defaultValue={value?.status ?? "GEPLANT"}>
          {Object.entries(ACTION_STATUS_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Beginn" name="startsAt">
        <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toDateTimeInput(value?.startsAt)} required />
      </Field>
      <Field label="Ende" name="endsAt">
        <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toDateTimeInput(value?.endsAt)} />
      </Field>
      <Field label="Ort" name="location" className="sm:col-span-2">
        <Input id="location" name="location" defaultValue={value?.location} />
      </Field>
      <Field label="Beschreibung" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={value?.description} rows={3} />
      </Field>
      <Field label="Partner" name="partners" hint="z. B. andere Parteien, Vereine" className="sm:col-span-2">
        <Input id="partners" name="partners" defaultValue={value?.partners} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{value ? "Speichern" : "Aktion anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
