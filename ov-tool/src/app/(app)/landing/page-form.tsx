"use client";

import type { LandingPage } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { toDateTimeInput } from "@/lib/dates";

const KINDS: [string, string][] = [
  ["VERANSTALTUNG", "Veranstaltung mit Anmeldung"],
  ["KAMPAGNE", "Kampagne / Thema"],
  ["UMFRAGE", "Umfrage / Bürgerbeteiligung"],
  ["UNTERSTUETZER", "Unterstützerliste"],
  ["PERSON", "Kandidat / Person"],
  ["LINKS", "Linkseite"],
];

export function PageForm({ action, page, linksText }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; page?: LandingPage; linksText?: string }) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Titel" name="title" className="sm:col-span-2">
        <Input id="title" name="title" required defaultValue={page?.title} />
      </Field>
      <Field label="Kurzname (Adresse)" name="slug" hint="management.cdu-sf.de/p/kurzname – Kleinbuchstaben, Ziffern, Bindestriche">
        <Input id="slug" name="slug" required defaultValue={page?.slug} pattern="[a-z0-9-]{2,60}" placeholder="sommerfest" />
      </Field>
      <Field label="Vorlage" name="kind">
        <NativeSelect id="kind" name="kind" defaultValue={page?.kind ?? "VERANSTALTUNG"}>
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Unterzeile" name="subtitle" className="sm:col-span-2">
        <Input id="subtitle" name="subtitle" defaultValue={page?.subtitle} />
      </Field>
      <Field label="Termin (optional)" name="eventAt">
        <Input id="eventAt" name="eventAt" type="datetime-local" defaultValue={page?.eventAt ? toDateTimeInput(page.eventAt) : ""} />
      </Field>
      <Field label="Ort (optional)" name="eventLocation">
        <Input id="eventLocation" name="eventLocation" defaultValue={page?.eventLocation} />
      </Field>
      <Field label="Text" name="body" hint="Absätze durch Leerzeile; „## “ Zwischenüberschrift; „- “ Aufzählung; **fett**" className="sm:col-span-2">
        <Textarea id="body" name="body" rows={10} defaultValue={page?.body} />
      </Field>
      <Field label="Links (optional)" name="links" hint="je Zeile: Beschriftung | https://…" className="sm:col-span-2">
        <Textarea id="links" name="links" rows={3} defaultValue={linksText} placeholder={"Unser Programm | https://www.cdu-sf.de/programm\nInstagram | https://instagram.com/…"} />
      </Field>
      <fieldset className="flex flex-col gap-3 rounded-md border p-4 sm:col-span-2">
        <legend className="px-1 text-sm font-semibold">Formular</legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="formEnabled" defaultChecked={page?.formEnabled ?? true} /> Formular anzeigen (Name und E-Mail sind Pflicht)
        </label>
        <Field label="Überschrift des Formulars" name="formTitle">
          <Input id="formTitle" name="formTitle" defaultValue={page?.formTitle} placeholder="Jetzt anmelden" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="askPhone" defaultChecked={page?.askPhone} /> Telefon abfragen (freiwillig)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="askMessage" defaultChecked={page?.askMessage} /> Nachrichtenfeld anzeigen
        </label>
        <Field label="Beschriftung des Nachrichtenfelds" name="messageLabel">
          <Input id="messageLabel" name="messageLabel" defaultValue={page?.messageLabel} placeholder="z. B. Ihre Idee für Seckenheim" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="newsletterOption" defaultChecked={page?.newsletterOption} /> Newsletter-Häkchen anbieten (Double-Opt-in per Mail)
        </label>
        <Field label="Einwilligungstext" name="consentText" hint="leer = Standardtext mit Löschfrist">
          <Textarea id="consentText" name="consentText" rows={3} defaultValue={page?.consentText} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Einträge löschen nach (Tagen)" name="retentionDays">
            <Input id="retentionDays" name="retentionDays" type="number" min={7} max={730} defaultValue={page?.retentionDays ?? 90} />
          </Field>
          <Field label="Seite offline ab (optional)" name="expiresAt">
            <Input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={page?.expiresAt ? toDateTimeInput(page.expiresAt) : ""} />
          </Field>
        </div>
      </fieldset>
      <SubmitButton className="justify-self-start">{page ? "Speichern" : "Entwurf anlegen"}</SubmitButton>
    </ActionForm>
  );
}
