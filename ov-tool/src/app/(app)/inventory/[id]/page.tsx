import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, Printer } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { code128Svg } from "@/server/barcode";
import { NotFoundError } from "@/server/errors";
import { getItem, inventoryFacets } from "@/server/services/inventory";
import { lendItemAction, removePhotoAction, retireItemAction, returnItemAction, updateItemAction } from "../actions";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Inventar" };

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ neu?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { neu } = await searchParams;
  const item = await getItem(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const editor = can(user.role, "inventory.edit");
  const manager = can(user.role, "inventory.manage");
  const facets = editor ? await inventoryFacets(user) : null;
  const overdue = item.lentTo && item.lentDueAt && item.lentDueAt < new Date();

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/inventory" className="underline">
          ← Inventar
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={item.name} description={[item.category, item.location].filter(Boolean).join(" · ") || undefined} />
        <div className="flex flex-wrap gap-2">
          {item.retiredAt ? <Badge variant="secondary">ausgemustert {formatDate(item.retiredAt)}</Badge> : null}
          {item.lentTo ? <Badge variant={overdue ? "destructive" : "warning"}>verliehen</Badge> : !item.retiredAt ? <Badge variant="success">im Lager</Badge> : null}
        </div>
      </div>
      {neu ? (
        <Alert variant="success" className="mb-4">
          <AlertDescription>
            Angelegt mit Code <strong className="font-mono">{item.code}</strong>. Etikett drucken und aufkleben.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
              <div className="flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 sm:w-48">
                {item.photoPath ? (
                  <a href={`/api/inventory/${item.id}/photo`} target="_blank" rel="noopener" className="size-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/inventory/${item.id}/photo`} alt={item.name} className="size-full object-cover" />
                  </a>
                ) : (
                  <Package className="size-12 text-neutral-400" aria-hidden />
                )}
              </div>
              <dl className="grid min-w-0 flex-1 grid-cols-[6.5rem_minmax(0,1fr)] content-start gap-x-2 gap-y-1 text-sm">
                <dt className="text-neutral-600">Code</dt>
                <dd className="break-all font-mono font-semibold">{item.code}</dd>
                <dt className="text-neutral-600">Angeschafft</dt>
                <dd>{item.acquiredYear}</dd>
                <dt className="text-neutral-600">Lagerort</dt>
                <dd>{item.location || "–"}</dd>
                <dt className="text-neutral-600">Anzahl</dt>
                <dd>{item.quantity}</dd>
                <dt className="text-neutral-600">Zustand</dt>
                <dd>{item.condition}</dd>
                {item.description ? (
                  <>
                    <dt className="text-neutral-600">Beschreibung</dt>
                    <dd className="whitespace-pre-wrap">{item.description}</dd>
                  </>
                ) : null}
                {item.notes ? (
                  <>
                    <dt className="text-neutral-600">Notizen</dt>
                    <dd className="whitespace-pre-wrap">{item.notes}</dd>
                  </>
                ) : null}
              </dl>
            </CardContent>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="h-14 w-56 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: code128Svg(item.code) }} aria-label={`Barcode ${item.code}`} role="img" />
              <Button asChild variant="outline" size="sm">
                <Link href={`/inventory/labels?ids=${item.id}`} target="_blank">
                  <Printer className="size-4" /> Etikett drucken
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verleih</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {item.lentTo ? (
                <>
                  <p>
                    Verliehen an <strong>{item.lentTo}</strong>
                    {item.lentAt ? ` seit ${formatDate(item.lentAt)}` : ""}
                    {item.lentDueAt ? (
                      <span className={overdue ? "font-semibold text-red-700" : ""}> · Rückgabe bis {formatDate(item.lentDueAt)}</span>
                    ) : null}
                  </p>
                  {editor ? (
                    <ActionForm action={returnItemAction.bind(null, item.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <Field label="Bemerkung zur Rückgabe (optional)" name="returnNote" className="flex-1">
                        <Input id="returnNote" name="returnNote" placeholder="z. B. vollständig, sauber" />
                      </Field>
                      <SubmitButton pendingText="…">Rückgabe buchen</SubmitButton>
                    </ActionForm>
                  ) : null}
                </>
              ) : item.retiredAt ? (
                <p className="text-neutral-600">Ausgemustert – kein Verleih.</p>
              ) : editor ? (
                <ActionForm action={lendItemAction.bind(null, item.id)} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
                  <Field label="Verliehen an" name="borrower" className="sm:col-span-2">
                    <Input id="borrower" name="borrower" required placeholder="z. B. JU Mannheim, FDP Mannheim Süd, Name" />
                  </Field>
                  <Field label="Rückgabe bis (optional)" name="dueAt">
                    <Input id="dueAt" name="dueAt" type="date" />
                  </Field>
                  <Field label="Notiz" name="note">
                    <Input id="note" name="note" placeholder="z. B. für Sommerfest" />
                  </Field>
                  <SubmitButton className="justify-self-start" pendingText="…">
                    Verleih buchen
                  </SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-neutral-600">Im Lager.</p>
              )}

              {item.loans.length ? (
                <div className="mt-2">
                  <p className="mb-1 font-medium">Verlauf</p>
                  <ul className="divide-y rounded-md border">
                    {item.loans.map((l) => (
                      <li key={l.id} className="px-3 py-2">
                        <span className="font-medium">{l.borrower}</span> · {formatDate(l.lentAt)} – {l.returnedAt ? formatDate(l.returnedAt) : "offen"}
                        {l.createdBy ? <span className="text-neutral-600"> · gebucht von {l.createdBy.name}</span> : null}
                        {l.note ? <p className="whitespace-pre-wrap text-neutral-600">{l.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {editor && facets ? (
          <Card>
            <CardHeader>
              <CardTitle>Bearbeiten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ItemForm action={updateItemAction.bind(null, item.id)} item={item} locations={facets.locations} categories={facets.categories} />
              <p className="text-xs text-neutral-600">Code, Nummer und Anschaffungsjahr bleiben fest, damit gedruckte Etiketten gültig bleiben.</p>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {item.photoPath ? (
                  <ActionForm action={removePhotoAction.bind(null, item.id)}>
                    <SubmitButton variant="ghost" size="sm" pendingText="…">
                      Foto entfernen
                    </SubmitButton>
                  </ActionForm>
                ) : null}
                {manager ? (
                  <ActionForm action={retireItemAction.bind(null, item.id, !item.retiredAt)}>
                    <SubmitButton variant="ghost" size="sm" className={item.retiredAt ? "" : "text-red-700"} pendingText="…">
                      {item.retiredAt ? "Wieder in den Bestand" : "Ausmustern"}
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
              <p className="text-xs text-neutral-600">
                Angelegt {formatDateTime(item.createdAt)}
                {item.createdBy ? ` von ${item.createdBy.name}` : ""}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
