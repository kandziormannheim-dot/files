"use client";

import type { Link } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { LINK_CATEGORY_LABELS, LINK_CATEGORY_ORDER } from "@/lib/labels";

export function LinkForm({
  action,
  link,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  link?: Link;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Titel" name="title">
        <Input id="title" name="title" defaultValue={link?.title} required />
      </Field>
      <Field label="Kategorie" name="category">
        <NativeSelect id="category" name="category" defaultValue={link?.category ?? "SONSTIGES"}>
          {LINK_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {LINK_CATEGORY_LABELS[c]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Adresse (URL)" name="url" className="sm:col-span-2">
        <Input id="url" name="url" type="text" inputMode="url" defaultValue={link?.url} placeholder="https://" required />
      </Field>
      <Field label="Beschreibung" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={link?.description} rows={2} />
      </Field>
      <Field
        label="Zugang über …"
        name="accessNote"
        hint="Wer hat Zugang bzw. wen fragen? Keine Passwörter eintragen."
        className="sm:col-span-2"
      >
        <Input id="accessNote" name="accessNote" defaultValue={link?.accessNote} />
      </Field>
      <Field
        label="Redaktionsnotiz"
        name="editorialNote"
        hint="Für Social-Media-Kanäle: wer betreut, Posting-Rhythmus"
        className="sm:col-span-2"
      >
        <Textarea id="editorialNote" name="editorialNote" defaultValue={link?.editorialNote} rows={2} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{link ? "Speichern" : "Link anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
