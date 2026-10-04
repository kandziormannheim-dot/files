"use client";

import type { AssigneeGroup, TaskPriority, TaskStatus } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { toDateInput } from "@/lib/dates";

export type TaskFormValues = {
  title?: string;
  description?: string;
  assigneeGroup?: AssigneeGroup;
  assigneeIds?: string[];
  dueDate?: Date | null;
  dueText?: string;
  priority?: TaskPriority | null;
  status?: TaskStatus;
};

type Origin = { meetingId?: string; agendaItemId?: string; resolutionId?: string; actionId?: string; topicId?: string };

export function TaskForm({
  action,
  users,
  values,
  origin,
  originLabel,
  isEdit = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  users: { id: string; name: string; functionTitle: string }[];
  values?: TaskFormValues;
  origin?: Origin;
  originLabel?: string;
  isEdit?: boolean;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {Object.entries(origin ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {originLabel ? <p className="text-sm text-neutral-600">Herkunft: {originLabel}</p> : null}
      <Field label="Titel" name="title">
        <Input id="title" name="title" defaultValue={values?.title} required />
      </Field>
      <Field label="Beschreibung" name="description">
        <Textarea id="description" name="description" defaultValue={values?.description} rows={3} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Verantwortlich</legend>
        <NativeSelect name="assigneeGroup" defaultValue={values?.assigneeGroup ?? "KEINE"} aria-label="Gruppe">
          <option value="KEINE">einzelne Personen</option>
          <option value="VORSTAND">Gruppe „Vorstand“</option>
          <option value="ALLE">Gruppe „alle“</option>
        </NativeSelect>
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-neutral-200 p-2 sm:grid-cols-2">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 py-1 text-sm">
              <Checkbox name="assigneeIds[]" value={u.id} defaultChecked={values?.assigneeIds?.includes(u.id)} />
              <span>
                {u.name}
                {u.functionTitle ? <span className="text-neutral-500"> · {u.functionTitle}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Frist (Datum)" name="dueDate" hint="Nur bei Datum gibt es Erinnerungen.">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={toDateInput(values?.dueDate)} />
        </Field>
        <Field label="… oder Frist als Text" name="dueText" hint="z. B. „laufend“, „nach Bekanntgabe der Antragsfrist“">
          <Input id="dueText" name="dueText" defaultValue={values?.dueText} />
        </Field>
        <Field label="Priorität" name="priority">
          <NativeSelect id="priority" name="priority" defaultValue={values?.priority ?? ""}>
            <option value="">–</option>
            <option value="NIEDRIG">niedrig</option>
            <option value="NORMAL">normal</option>
            <option value="HOCH">hoch</option>
          </NativeSelect>
        </Field>
        {isEdit ? (
          <Field label="Status" name="status">
            <NativeSelect id="status" name="status" defaultValue={values?.status ?? "OFFEN"}>
              <option value="OFFEN">offen</option>
              <option value="IN_ARBEIT">in Arbeit</option>
              <option value="ERLEDIGT">erledigt</option>
            </NativeSelect>
          </Field>
        ) : null}
      </div>
      <SubmitButton className="self-start">{isEdit ? "Speichern" : "Aufgabe anlegen"}</SubmitButton>
    </ActionForm>
  );
}
