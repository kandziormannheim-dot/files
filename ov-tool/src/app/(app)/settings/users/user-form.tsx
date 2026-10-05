"use client";

import type { Role, User, VotingRight } from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const ROLES: [Role, string, string][] = [
  ["ADMIN", "Admin", "alles, inkl. Nutzerverwaltung und Versand von Einladungen"],
  ["SCHRIFTFUEHRER", "Schriftführer", "wie Vorstand, zusätzlich Protokolle und Transkripte"],
  ["VORSTAND", "Vorstand", "lesen, anlegen, eigene Aufgaben bearbeiten"],
  ["LESEZUGRIFF", "Lesezugriff", "nur lesen, Zu-/Absage"],
  ["GAST", "Gast (kooptiert)", "erhält Einladungen und Protokolle; Login optional"],
];

const VOTING: [VotingRight, string][] = [
  ["STIMMBERECHTIGT", "stimmberechtigt (gewählt, Ehrenvorsitz)"],
  ["BERATEND", "beratend (LV-Satzung § 37 Abs. 2)"],
  ["OHNE", "ohne Stimmrecht (kooptierte Gäste)"],
];

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  user?: User;
};

export function UserForm({ action, user }: Props) {
  const isNew = !user;
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" name="name">
        <Input id="name" name="name" defaultValue={user?.name} required />
      </Field>
      <Field label="E-Mail" name="email">
        <Input id="email" name="email" type="email" defaultValue={user?.email} required />
      </Field>
      <Field label="Funktion" name="functionTitle" hint="z. B. Ortsvorsitzender, Beisitzerin, Stadtrat">
        <Input id="functionTitle" name="functionTitle" defaultValue={user?.functionTitle} />
      </Field>
      <Field label="Sortierposition" name="sortOrder" hint="Reihenfolge in Anwesenheitslisten (klein = oben)">
        <Input id="sortOrder" name="sortOrder" type="number" defaultValue={user?.sortOrder ?? 100} />
      </Field>
      <Field label="Rolle im Tool" name="role" hint={ROLES.map(([, l, d]) => `${l}: ${d}`).join(" · ")}>
        <NativeSelect id="role" name="role" defaultValue={user?.role ?? "VORSTAND"}>
          {ROLES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Stimmrecht im Vorstand" name="votingRight" hint="Nur Stimmberechtigte zählen für die Beschlussfähigkeit.">
        <NativeSelect id="votingRight" name="votingRight" defaultValue={user?.votingRight ?? "STIMMBERECHTIGT"}>
          {VOTING.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="loginEnabled" defaultChecked={user?.loginEnabled ?? true} />
          Login erlaubt (bei Gästen optional)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isBbr" defaultChecked={user?.isBbr ?? false} />
          CDU-Bezirksbeirat (Zugang zu BBR-Anliegen und BBR-Links)
        </label>
        {isNew ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="sendInvite" defaultChecked />
            Zugangsmail senden
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="active" defaultChecked={user.active} />
            Aktiv (abwählen = Zugang entziehen; bleibt in alten Protokollen erhalten)
          </label>
        )}
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>{isNew ? "Nutzer anlegen" : "Speichern"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
