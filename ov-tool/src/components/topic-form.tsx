"use client";

import type { Topic } from "@prisma/client";
import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { DISTRICT_LABELS, TOPIC_STATUS_LABELS } from "@/lib/labels";

export function TopicForm({
  action,
  topic,
  categories,
  users,
  hasContact,
  retentionMonths,
  encryptionReady,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  topic?: Topic;
  categories: string[];
  users: { id: string; name: string }[];
  hasContact: boolean;
  retentionMonths: number;
  encryptionReady: boolean;
}) {
  const [concern, setConcern] = useState(topic?.isCitizenConcern ?? false);
  const cats = topic && !categories.includes(topic.category) ? [...categories, topic.category] : categories;
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Titel" name="title" className="sm:col-span-2">
        <Input id="title" name="title" defaultValue={topic?.title} required />
      </Field>
      <Field label="Beschreibung" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={topic?.description} rows={4} />
      </Field>
      <Field label="Kategorie" name="category">
        <NativeSelect id="category" name="category" defaultValue={topic?.category ?? cats[0]}>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Ortsteil" name="district">
        <NativeSelect id="district" name="district" defaultValue={topic?.district ?? "BEIDE"}>
          {Object.entries(DISTRICT_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Status" name="status">
        <NativeSelect id="status" name="status" defaultValue={topic?.status ?? "NEU"}>
          {Object.entries(TOPIC_STATUS_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Verantwortlich" name="responsibleId">
        <NativeSelect id="responsibleId" name="responsibleId" defaultValue={topic?.responsibleId ?? ""}>
          <option value="">–</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="forNextMeeting" defaultChecked={topic?.forNextMeeting} /> für die nächste Sitzung (erscheint automatisch in der
          Tagesordnung)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isCitizenConcern" checked={concern} onChange={(e) => setConcern(e.target.checked)} /> Bürgeranliegen
        </label>
      </div>
      {concern ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50/50 p-3 sm:col-span-2">
          <p className="text-sm">
            Kontaktdaten der Bürgerin/des Bürgers sind <strong>optional</strong> und nur mit Einwilligung zu speichern. Sie werden
            verschlüsselt abgelegt und {retentionMonths} Monate nach Erledigung automatisch gelöscht.
          </p>
          {hasContact ? <p className="text-sm text-neutral-700">Es sind Kontaktdaten gespeichert. Neue Eingabe ersetzt sie.</p> : null}
          {encryptionReady ? (
            <>
              <Field label="Kontaktdaten (optional)" name="citizenContact">
                <Textarea id="citizenContact" name="citizenContact" rows={2} placeholder="Name, Telefon oder E-Mail" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="citizenConsent" /> Einwilligung zur Speicherung liegt vor
              </label>
            </>
          ) : (
            <p className="text-sm text-red-800">ENCRYPTION_KEY ist nicht gesetzt – Kontaktdaten können nicht gespeichert werden.</p>
          )}
          {hasContact ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="removeContact" /> gespeicherte Kontaktdaten jetzt löschen
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton>{topic ? "Speichern" : "Thema anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
