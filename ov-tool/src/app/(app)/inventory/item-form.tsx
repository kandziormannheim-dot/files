"use client";

import type { InventoryItem } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

const CONDITIONS = ["neu", "gut", "gebraucht", "reparaturbedürftig", "defekt"];

export function ItemForm({
  action,
  item,
  nextNumber,
  locations,
  categories,
  defaults,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  item?: InventoryItem;
  nextNumber?: number;
  locations: string[];
  categories: string[];
  defaults?: { number?: number; year?: number };
}) {
  const year = new Date().getFullYear();
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Bezeichnung" name="name" className="sm:col-span-2">
        <Input id="name" name="name" defaultValue={item?.name} required placeholder="z. B. Sonnenschirm CDU türkis" />
      </Field>
      <Field label={item?.photoPath ? "Foto ersetzen" : "Foto"} name="photo" hint="Am Handy öffnet sich direkt die Kamera. Standortdaten werden entfernt." className="sm:col-span-2">
        <Input id="photo" name="photo" type="file" accept="image/*" capture="environment" />
      </Field>
      {!item ? (
        <>
          <Field label="Anschaffungsjahr" name="acquiredYear" hint="Steht im Code hinter dem Punkt (.20 = 2020).">
            <Input id="acquiredYear" name="acquiredYear" type="number" inputMode="numeric" min={1950} max={year} defaultValue={defaults?.year ?? year} required />
          </Field>
          <Field label="Laufende Nummer" name="number" hint={`Leer lassen = nächste freie (${String(nextNumber ?? 1).padStart(5, "0")}). Nur für schon beschriftete Teile eintragen.`}>
            <Input id="number" name="number" type="number" inputMode="numeric" min={1} max={99999} placeholder={String(nextNumber ?? 1)} defaultValue={defaults?.number} />
          </Field>
        </>
      ) : null}
      <Field label="Lagerort" name="location">
        <Input id="location" name="location" list="inv-locations" defaultValue={item?.location} placeholder="z. B. Garage Kandzior, Regal 2" />
        <datalist id="inv-locations">
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <Field label="Kategorie" name="category">
        <Input id="category" name="category" list="inv-categories" defaultValue={item?.category} placeholder="z. B. Infostand, Technik, Werbung" />
        <datalist id="inv-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Anzahl" name="quantity">
        <Input id="quantity" name="quantity" type="number" inputMode="numeric" min={1} defaultValue={item?.quantity ?? 1} />
      </Field>
      <Field label="Zustand" name="condition">
        <NativeSelect id="condition" name="condition" defaultValue={item?.condition ?? "gut"}>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Beschreibung" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" rows={2} defaultValue={item?.description} placeholder="Maße, Farbe, Zubehör …" />
      </Field>
      <Field label="Notizen" name="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={2} defaultValue={item?.notes} />
      </Field>
      <SubmitButton className="justify-self-start" pendingText="Wird gespeichert …">
        {item ? "Speichern" : "Anlegen"}
      </SubmitButton>
    </ActionForm>
  );
}
