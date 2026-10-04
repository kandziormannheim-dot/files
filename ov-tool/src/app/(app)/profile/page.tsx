import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, VOTING_RIGHT_LABELS } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { removeSignatureAction, updateProfileAction, uploadSignatureAction } from "./actions";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
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
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
                <dt className="text-neutral-600">E-Mail</dt>
                <dd>{user.email}</dd>
                <dt className="text-neutral-600">Rolle</dt>
                <dd>{ROLE_LABELS[user.role]}</dd>
                <dt className="text-neutral-600">Funktion</dt>
                <dd>{user.functionTitle || "–"}</dd>
                <dt className="text-neutral-600">Stimmrecht</dt>
                <dd>{VOTING_RIGHT_LABELS[user.votingRight]}</dd>
              </dl>
              <p className="text-xs text-neutral-600">E-Mail, Rolle, Funktion und Stimmrecht ändert der Admin.</p>
              <SubmitButton className="self-start">Speichern</SubmitButton>
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
      </div>
    </>
  );
}
