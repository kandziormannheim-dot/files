import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Camera, Check, FileDown, FileText, ImageIcon, Send, Trash2, Undo2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime, toDateInput } from "@/lib/dates";
import { formatEuro, formatIban, maskIban } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getClaim, PAYOUT_LABELS, STATUS_LABELS } from "@/server/services/expenses";
import { getSettings } from "@/server/services/settings";
import {
  addItemAction,
  approveAndSendAction,
  deleteClaimAction,
  deleteItemAction,
  outcomeAction,
  submitClaimAction,
  updateClaimAction,
  withdrawClaimAction,
} from "../actions";
import { ClaimForm } from "../claim-form";

export const metadata: Metadata = { title: "Auslage" };

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let claim;
  try {
    claim = await getClaim(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) redirect("/no-access");
    throw e;
  }
  const settings = await getSettings();
  const approver = can(user.role, "expense.approve");
  const own = claim.claimantId === user.id;
  const editable = claim.status === "ENTWURF" || (claim.status === "EINGEREICHT" && approver);
  const missingReceipts = claim.items.filter((i) => !i.receiptPath).length;
  const ready = claim.items.length > 0 && missingReceipts === 0;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 self-start">
        <Link href="/expenses">
          <ArrowLeft className="size-4" /> Auslagen
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={`${claim.number} · ${claim.title}`} description={`${claim.claimantName} · ${PAYOUT_LABELS[claim.payout]}`} />
        <Badge variant={claim.status === "ERLEDIGT" ? "success" : claim.status === "ABGELEHNT" ? "destructive" : claim.status === "EINGEREICHT" ? "warning" : "secondary"}>
          {STATUS_LABELS[claim.status]}
        </Badge>
      </div>

      {claim.status === "VERSENDET" ? (
        <Alert variant="success" className="mb-4">
          <AlertDescription>Am {formatDateTime(claim.sentAt)} an {claim.sentTo} gesendet.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Belege</CardTitle>
              <span className="text-lg font-extrabold text-rhoendorf">{formatEuro(claim.total)}</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {claim.items.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Belege erfasst.</p> : null}
              <ul className="flex flex-col divide-y rounded-md border">
                {claim.items.map((i, idx) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="w-6 text-neutral-500">{idx + 1}.</span>
                    <span className="w-24 shrink-0">{formatDate(i.date)}</span>
                    <span className="min-w-0 flex-1">{i.description}</span>
                    {i.receiptPath ? (
                      <a href={`/api/expenses/items/${i.id}/receipt`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-rhoendorf underline" aria-label="Beleg ansehen">
                        {i.receiptMime.startsWith("image/") ? <ImageIcon className="size-4 text-cadenabbia" /> : <FileText className="size-4 text-cadenabbia" />} Beleg
                      </a>
                    ) : (
                      <Badge variant="destructive">Beleg fehlt</Badge>
                    )}
                    <span className="w-24 text-right font-semibold">{formatEuro(i.amountCents)}</span>
                    {editable ? (
                      <ActionForm action={deleteItemAction.bind(null, claim.id, i.id)} showErrorInline={false}>
                        <ConfirmSubmit size="sm" variant="ghost" confirm="Position löschen?" pendingText="…" aria-label="Position löschen">
                          <Trash2 className="size-4" />
                        </ConfirmSubmit>
                      </ActionForm>
                    ) : null}
                  </li>
                ))}
              </ul>
              {editable ? (
                <ActionForm action={addItemAction.bind(null, claim.id)} resetOnSuccess className="grid gap-3 rounded-md border border-dashed border-cadenabbia bg-cadenabbia-10 p-3 sm:grid-cols-[9rem_minmax(0,1fr)_8rem]">
                  <Field label="Belegdatum" name="date">
                    <Input id="date" name="date" type="date" required defaultValue={toDateInput(new Date())} />
                  </Field>
                  <Field label="Beschreibung" name="description">
                    <Input id="description" name="description" required placeholder="z. B. Flyer-Druck, Glühwein, Bahnticket" />
                  </Field>
                  <Field label="Betrag (€)" name="amount">
                    <Input id="amount" name="amount" inputMode="decimal" required placeholder="12,50" />
                  </Field>
                  <Field label={<span className="flex items-center gap-1"><Camera className="size-4" /> Beleg (Foto oder PDF)</span>} name="receipt" className="sm:col-span-2" hint="Am Handy öffnet sich die Kamera. Fotos werden ohne Standortdaten gespeichert.">
                    <Input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" required />
                  </Field>
                  <SubmitButton className="self-end" pendingText="Lädt hoch …">
                    Hinzufügen
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Abschluss</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a href={`/api/expenses/${claim.id}/pdf`} target="_blank" rel="noreferrer">
                    <FileDown className="size-4" /> PDF ansehen (Antrag + Belege)
                  </a>
                </Button>
              </div>
              {!ready && editable ? <p className="text-neutral-600">Zum Absenden muss jede Position einen Beleg haben.</p> : null}
              {own && claim.status === "ENTWURF" && !approver ? (
                <ActionForm action={submitClaimAction.bind(null, claim.id)} showErrorInline={false}>
                  <SubmitButton disabled={!ready}>
                    <Check className="size-4" /> Zur Freigabe einreichen
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {claim.status === "EINGEREICHT" && (own || approver) ? (
                <ActionForm action={withdrawClaimAction.bind(null, claim.id)} showErrorInline={false}>
                  <SubmitButton variant="ghost" size="sm">
                    <Undo2 className="size-4" /> Zurückziehen
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {approver && (claim.status === "ENTWURF" || claim.status === "EINGEREICHT") ? (
                <ActionForm action={approveAndSendAction.bind(null, claim.id)} showErrorInline={false} className="flex flex-col gap-1">
                  <ConfirmSubmit
                    disabled={!ready || !settings.office.email}
                    confirm={`Antrag über ${formatEuro(claim.total)} als sachlich und rechnerisch richtig freigeben und an ${settings.office.email} senden?`}
                    pendingText="Wird gesendet …"
                  >
                    <Send className="size-4" /> Freigeben und an die Kreisgeschäftsstelle senden
                  </ConfirmSubmit>
                  {settings.office.email ? (
                    <span className="text-xs text-neutral-600">An {settings.office.email}{claim.personal.email ? `; Kopie an ${claim.personal.email}` : " – keine E-Mail des Mitglieds hinterlegt, daher ohne Kopie"}.</span>
                  ) : (
                    <span className="text-xs text-union-rot">Keine E-Mail der Kreisgeschäftsstelle hinterlegt (Einstellungen → Allgemein).</span>
                  )}
                </ActionForm>
              ) : null}
              {approver && claim.status === "VERSENDET" ? (
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={outcomeAction.bind(null, claim.id, "ERLEDIGT")} showErrorInline={false}>
                    <SubmitButton size="sm">{claim.payout === "SPENDE" ? "Spendenbescheinigung erhalten – erledigt" : "Erstattet – erledigt"}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={outcomeAction.bind(null, claim.id, "ABGELEHNT")} showErrorInline={false} className="flex gap-2">
                    <Input name="note" placeholder="Grund (optional)" className="h-8 w-48" aria-label="Grund" />
                    <SubmitButton size="sm" variant="outline">
                      Abgelehnt
                    </SubmitButton>
                  </ActionForm>
                </div>
              ) : null}
              {claim.status === "ENTWURF" && (own || approver) ? (
                <ActionForm action={deleteClaimAction.bind(null, claim.id)} showErrorInline={false}>
                  <ConfirmSubmit variant="ghost" size="sm" confirm="Entwurf samt Belegen löschen?" pendingText="…">
                    <Trash2 className="size-4" /> Entwurf löschen
                  </ConfirmSubmit>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Angaben</CardTitle>
          </CardHeader>
          <CardContent>
            {editable ? (
              <ClaimForm
                action={updateClaimAction.bind(null, claim.id)}
                defaultHolder={claim.claimantName}
                isNew={false}
                values={{
                  memberName: claim.claimantName,
                  memberEmail: claim.personal.email ?? "",
                  title: claim.title,
                  occasion: claim.occasion,
                  payout: claim.payout,
                  accountHolder: claim.personal.accountHolder ?? "",
                  ibanMasked: claim.personal.iban ? maskIban(claim.personal.iban) : "",
                  address: claim.personal.address ?? "",
                  note: claim.note,
                }}
              />
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {claim.personal.email ? (
                  <>
                    <dt className="text-neutral-600">E-Mail</dt>
                    <dd>{claim.personal.email}</dd>
                  </>
                ) : null}
                <dt className="text-neutral-600">Anlass</dt>
                <dd>{claim.occasion || "–"}</dd>
                <dt className="text-neutral-600">Erstattung</dt>
                <dd>{PAYOUT_LABELS[claim.payout]}</dd>
                {claim.personal.iban ? (
                  <>
                    <dt className="text-neutral-600">Konto</dt>
                    <dd>
                      {claim.personal.accountHolder}
                      <br />
                      {approver ? formatIban(claim.personal.iban) : maskIban(claim.personal.iban)}
                    </dd>
                  </>
                ) : null}
                {claim.personal.address ? (
                  <>
                    <dt className="text-neutral-600">Anschrift</dt>
                    <dd className="whitespace-pre-line">{claim.personal.address}</dd>
                  </>
                ) : null}
                {claim.note ? (
                  <>
                    <dt className="text-neutral-600">Bemerkung</dt>
                    <dd className="whitespace-pre-line">{claim.note}</dd>
                  </>
                ) : null}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
