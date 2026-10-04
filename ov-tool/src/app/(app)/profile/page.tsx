import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, VOTING_RIGHT_LABELS } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { icsUrl } from "@/server/services/calendar";
import { formatDateTime } from "@/lib/dates";
import { pendingEmailChange } from "@/server/services/users";
import { removeSignatureAction, renewIcsAction, requestEmailChangeAction, updateProfileAction, uploadSignatureAction } from "./actions";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const pending = await pendingEmailChange(user.id);
  return (
    <>
      <PageHeader title="Mein Profil" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stammdaten</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateProfileAction} className="flex flex-col gap-4">
              <Field label="Name" name="name">
                <Input id="name" name="name" defaultValue={user.name} required />
              </Field>
              <Field label="Telefon (optional)" name="phone">
                <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+49 621 …" />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="showPhoneInBoard" defaultChecked={user.showPhoneInBoard} className="mt-1" />
                <span>Telefonnummer in der Vorstandsliste für alle Nutzer des Tools anzeigen</span>
              </label>
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
                <dt className="text-neutral-600">Rolle</dt>
                <dd>{ROLE_LABELS[user.role]}</dd>
                <dt className="text-neutral-600">Funktion</dt>
                <dd>{user.functionTitle || "–"}</dd>
                <dt className="text-neutral-600">Stimmrecht</dt>
                <dd>{VOTING_RIGHT_LABELS[user.votingRight]}</dd>
              </dl>
              <p className="text-xs text-neutral-600">Rolle, Funktion und Stimmrecht ändert der Admin.</p>
              <SubmitButton className="self-start">Speichern</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>E-Mail-Adresse</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              Aktuell: <strong>{user.email}</strong>
            </p>
            <p className="text-neutral-600">
              An diese Adresse gehen Anmeldelinks, Einladungen und Protokolle. Nach einer Änderung erhalten Sie einen
              Bestätigungslink an die neue Adresse; erst danach wird sie übernommen.
            </p>
            {pending ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2">
                Änderung auf <strong>{pending.newEmail}</strong> wartet auf Bestätigung (Link gültig bis {formatDateTime(pending.expiresAt)} Uhr).
              </p>
            ) : null}
            <ActionForm action={requestEmailChangeAction} className="flex flex-col gap-2">
              <Field label="Neue E-Mail-Adresse" name="newEmail">
                <Input id="newEmail" name="newEmail" type="email" required autoComplete="email" />
              </Field>
              <SubmitButton variant="outline" className="self-start" pendingText="Wird gesendet …">
                Bestätigungslink senden
              </SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unterschrift</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-neutral-600">
              Wird in Einladungen eingesetzt, die Sie als Absender verschicken. Am besten PNG mit transparentem Hintergrund.
              Protokolle erhalten Unterschriftslinien zur händischen Unterzeichnung.
            </p>
            {user.signatureImagePath ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/signature/${user.id}`} alt="Ihre Unterschrift" className="h-16 w-fit rounded border bg-white p-1" />
                <ActionForm action={removeSignatureAction}>
                  <SubmitButton variant="outline" size="sm">
                    Unterschrift entfernen
                  </SubmitButton>
                </ActionForm>
              </>
            ) : null}
            <ActionForm action={uploadSignatureAction} className="flex flex-col gap-2">
              <Input type="file" name="signature" accept="image/png,image/jpeg,image/webp" required aria-label="Bilddatei" />
              <SubmitButton variant="outline" className="self-start" pendingText="Wird hochgeladen …">
                {user.signatureImagePath ? "Ersetzen" : "Hochladen"}
              </SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kalender-Abo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-neutral-600">
              Sitzungen, Aktionen und Ihre Schichten im eigenen Kalender (Outlook, Apple, Google: „Kalender abonnieren“ bzw. „Per URL
              hinzufügen“). Der Link ist persönlich – nicht weitergeben.
            </p>
            <Input readOnly value={icsUrl(user.icsToken)} aria-label="Kalender-Link" className="font-mono text-xs" />
            <ActionForm action={renewIcsAction}>
              <SubmitButton size="sm" variant="outline">
                Neuen Link erzeugen (alten sperren)
              </SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
