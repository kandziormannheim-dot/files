import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDate, toDateInput } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listClippings, listReleases } from "@/server/services/press";
import { addClippingAction, deleteClippingAction } from "../actions";
import { PressTabs } from "../press-tabs";

export const metadata: Metadata = { title: "Pressespiegel" };

export default async function ClippingsPage() {
  const user = await requireUser();
  const [clippings, releases] = await Promise.all([listClippings(user), listReleases(user)]);
  const edit = can(user.role, "press.create");
  return (
    <>
      <PageHeader title="Presse" description="Pressespiegel: erschienene Artikel mit Medium, Datum und Bezug zur Pressemitteilung." />
      <PressTabs active="clippings" showContacts={can(user.role, "press.contacts")} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2">
          {clippings.length === 0 ? <li className="text-sm text-neutral-600">Noch keine Artikel erfasst.</li> : null}
          {clippings.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-rhoendorf">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                      {c.title}
                    </a>
                  ) : (
                    c.title
                  )}
                </div>
                <div className="text-xs text-neutral-600">
                  {c.medium} · {formatDate(c.publishedOn)}
                  {c.release ? ` · zu „${c.release.title}“` : ""}
                </div>
                {c.note ? <p className="mt-1 text-neutral-700">{c.note}</p> : null}
              </div>
              {edit ? (
                <ActionForm action={deleteClippingAction.bind(null, c.id)} showErrorInline={false}>
                  <SubmitButton size="sm" variant="ghost" pendingText="…" aria-label="Entfernen">
                    <Trash2 className="size-4" />
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
        {edit ? (
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="text-base">Artikel erfassen</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={addClippingAction} resetOnSuccess className="flex flex-col gap-3">
                <Field label="Titel" name="title">
                  <Input id="title" name="title" required />
                </Field>
                <Field label="Medium" name="medium">
                  <Input id="medium" name="medium" required placeholder="z. B. Mannheimer Morgen" />
                </Field>
                <Field label="Erschienen am" name="publishedOn">
                  <Input id="publishedOn" name="publishedOn" type="date" required defaultValue={toDateInput(new Date())} />
                </Field>
                <Field label="Link" name="url">
                  <Input id="url" name="url" type="url" placeholder="https://…" />
                </Field>
                <Field label="Zur Pressemitteilung" name="releaseId">
                  <NativeSelect id="releaseId" name="releaseId" defaultValue="">
                    <option value="">– keine –</option>
                    {releases.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Notiz" name="note">
                  <Input id="note" name="note" />
                </Field>
                <SubmitButton className="self-start">Erfassen</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
