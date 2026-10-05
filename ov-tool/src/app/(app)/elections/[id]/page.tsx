import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, FileText, Printer, Trash2, UserPlus, X } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { StatuteRef } from "@/components/statute-ref";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, toDateTimeInput } from "@/lib/dates";
import { roundLabel } from "@/lib/election-flow";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getElection, positionStep, type ElectionFull } from "@/server/services/elections";
import {
  addCandidateAction,
  addPositionAction,
  deleteElectionAction,
  deletePositionAction,
  removeCandidateAction,
  setAcceptanceAction,
  updateElectionAction,
} from "../actions";

export const metadata: Metadata = { title: "Wahl" };

async function load(id: string, user: Awaited<ReturnType<typeof requireUser>>): Promise<ElectionFull> {
  try {
    return await getElection(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

export default async function ElectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const election = await load(id, user);
  const manage = can(user.role, "election.manage");
  const closed = election.status === "ABGESCHLOSSEN";
  const hasRounds = election.positions.some((p) => p.rounds.length);

  return (
    <>
      <PageHeader title={election.title} description={`${formatDateTime(election.date)}${election.location ? ` · ${election.location}` : ""}`} />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={`/elections/${election.id}/ballots`} target="_blank" rel="noreferrer">
            <Printer className="size-4" /> Alle Stimmzettel (1. Wahlgang)
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/elections/${election.id}/protocol`}>
            <FileText className="size-4" /> Niederschrift Wahlteil
          </Link>
        </Button>
      </div>

      <Alert className="mb-6">
        <AlertDescription>
          Vorstandswahlen sind geheim mit Stimmzetteln durchzuführen, Handzeichen ist ausgeschlossen (<StatuteRef cite="LV-Satzung § 57 Abs. 1">LV-Satzung § 57 Abs. 1</StatuteRef>
          ). Die Mitgliederversammlung ist ohne Rücksicht auf die Zahl der Anwesenden beschlussfähig, wenn ordnungsgemäß eingeladen wurde (
          <StatuteRef cite="LV-Satzung § 52 Abs. 2">LV-Satzung § 52 Abs. 2</StatuteRef>). Bei Vorschlägen auf eine gleichberechtigte Beteiligung von
          Frauen und Männern achten (<StatuteRef cite="Statut § 15">Statut § 15</StatuteRef>). Im Tool werden keine Mitgliederlisten geführt – nur Zahlen.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {election.positions.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Ämter angelegt.</p> : null}
          {election.positions.map((p) => {
            const step = positionStep(p);
            const name = (cid: string) => p.candidates.find((c) => c.id === cid)?.name ?? "?";
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <p className="text-xs text-neutral-600">
                      {p.mode === "EINZEL" ? "Einzelwahl (§ 57 Abs. 2)" : `Sammelwahl, ${p.seats} ${p.seats === 1 ? "Platz" : "Plätze"} (§ 57 Abs. 3)`}
                    </p>
                  </div>
                  {step.done ? (
                    <Badge variant={step.failed ? "destructive" : "success"}>{step.failed ? "ohne Ergebnis" : "entschieden"}</Badge>
                  ) : p.rounds.length ? (
                    <Badge variant="warning">als Nächstes: {step.label}</Badge>
                  ) : (
                    <Badge variant="secondary">{p.candidates.length} Vorschläge</Badge>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <ul className="flex flex-col divide-y rounded-md border">
                    {p.candidates.map((c) => {
                      const elected = step.done && step.elected.includes(c.id);
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                          <span className={c.withdrawn ? "text-neutral-400 line-through" : "font-medium text-rhoendorf"}>{c.name}</span>
                          {c.note ? <span className="text-xs text-neutral-500">{c.note}</span> : null}
                          {elected ? <Badge variant="success">gewählt</Badge> : null}
                          {elected ? (
                            <span className="ml-auto flex items-center gap-1 text-xs">
                              Annahme:
                              {manage && !closed ? (
                                (["ja", "nein", "offen"] as const).map((v) => (
                                  <ActionForm key={v} action={setAcceptanceAction.bind(null, election.id, c.id, v)} showErrorInline={false}>
                                    <SubmitButton
                                      size="sm"
                                      variant={(v === "ja" && c.accepted === true) || (v === "nein" && c.accepted === false) || (v === "offen" && c.accepted == null) ? "default" : "outline"}
                                      pendingText="…"
                                    >
                                      {v}
                                    </SubmitButton>
                                  </ActionForm>
                                ))
                              ) : (
                                <span>{c.accepted === true ? "angenommen" : c.accepted === false ? "abgelehnt" : "offen"}</span>
                              )}
                            </span>
                          ) : manage && !closed && !c.withdrawn && !step.done ? (
                            <ActionForm action={removeCandidateAction.bind(null, election.id, c.id)} showErrorInline={false} className="ml-auto">
                              <SubmitButton size="sm" variant="ghost" pendingText="…" aria-label={p.rounds.length ? "Verzicht vermerken" : "Vorschlag entfernen"}>
                                <X className="size-4" /> {p.rounds.length ? "verzichtet" : ""}
                              </SubmitButton>
                            </ActionForm>
                          ) : null}
                        </li>
                      );
                    })}
                    {p.candidates.length === 0 ? <li className="px-3 py-2 text-sm text-neutral-500">Noch keine Vorschläge.</li> : null}
                  </ul>
                  {manage && !closed && p.rounds.length === 0 ? (
                    <ActionForm action={addCandidateAction.bind(null, election.id, p.id)} resetOnSuccess className="flex flex-wrap items-end gap-2">
                      <Input name="name" placeholder="Name der Bewerberin / des Bewerbers" required className="min-w-0 flex-1" aria-label="Name" />
                      <Input name="note" placeholder="Zusatz (optional)" className="w-40" aria-label="Zusatz" />
                      <SubmitButton size="sm" variant="outline" pendingText="…">
                        <UserPlus className="size-4" /> Vorschlag
                      </SubmitButton>
                    </ActionForm>
                  ) : null}

                  {p.rounds.length ? (
                    <div className="flex flex-col gap-1 text-xs text-neutral-700">
                      {p.rounds.map((r) => (
                        <div key={r.id}>
                          <span className="font-semibold">{roundLabel(r.stage, r.round)}:</span>{" "}
                          {r.stage === "LOS"
                            ? `Los zwischen ${r.candidateIds.map(name).join(", ")}`
                            : `${r.ballotsCast} abgegeben, ${r.invalid} ungültig, ${r.abstentions} Enthaltungen – ${r.candidateIds
                                .map((cid) => `${name(cid)} ${(r.votes as Record<string, number>)[cid] ?? 0}`)
                                .join(", ")}${r.noVotes ? `, Nein ${r.noVotes}` : ""}`}
                          <div className="text-neutral-500">{r.resultText}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {!step.done && p.candidates.some((c) => !c.withdrawn) ? (
                      <>
                        {step.stage !== "LOS" ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={`/elections/${election.id}/ballots?position=${p.id}`} target="_blank" rel="noreferrer">
                              <Printer className="size-4" /> Stimmzettel {step.label}
                            </a>
                          </Button>
                        ) : null}
                        {manage && !closed ? (
                          <Button asChild size="sm">
                            <Link href={`/elections/${election.id}/count/${p.id}`}>
                              <Calculator className="size-4" /> {step.stage === "LOS" ? "Losentscheid erfassen" : `${step.label} auszählen`}
                            </Link>
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    {manage && !closed && p.rounds.length === 0 ? (
                      <ActionForm action={deletePositionAction.bind(null, election.id, p.id)} showErrorInline={false}>
                        <ConfirmSubmit size="sm" variant="ghost" confirm={`Amt „${p.title}“ entfernen?`} pendingText="…">
                          <Trash2 className="size-4" /> Amt entfernen
                        </ConfirmSubmit>
                      </ActionForm>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {manage && !closed ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weiteres Amt</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={addPositionAction.bind(null, election.id)} resetOnSuccess className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <Field label="Amt" name="title">
                    <Input id="title" name="title" required placeholder="z. B. Mitgliederbeauftragte/r" />
                  </Field>
                  <Field label="Art" name="mode">
                    <NativeSelect id="mode" name="mode" defaultValue="EINZEL">
                      <option value="EINZEL">Einzelwahl</option>
                      <option value="SAMMEL">Sammelwahl</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Plätze" name="seats">
                    <Input id="seats" name="seats" type="number" min={1} max={30} defaultValue={1} />
                  </Field>
                  <SubmitButton pendingText="…">Hinzufügen</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Versammlung</CardTitle>
          </CardHeader>
          <CardContent>
            {manage ? (
              <ActionForm action={updateElectionAction.bind(null, election.id)} className="flex flex-col gap-3">
                <Field label="Bezeichnung" name="title">
                  <Input id="title" name="title" defaultValue={election.title} required />
                </Field>
                <Field label="Datum und Uhrzeit" name="date">
                  <Input id="date" name="date" type="datetime-local" defaultValue={toDateTimeInput(election.date)} required />
                </Field>
                <Field label="Ort" name="location">
                  <Input id="location" name="location" defaultValue={election.location} />
                </Field>
                <Field label="Anwesende Stimmberechtigte" name="presentEligible" hint="laut Anwesenheitsliste der Kreisgeschäftsstelle; Plausibilitätsprüfung der Stimmzettel">
                  <Input id="presentEligible" name="presentEligible" type="number" min={0} defaultValue={election.presentEligible ?? ""} />
                </Field>
                <Field label="Versammlungsleitung" name="chair">
                  <Input id="chair" name="chair" defaultValue={election.chair} />
                </Field>
                <Field label="Zählkommission" name="countingCommittee">
                  <Input id="countingCommittee" name="countingCommittee" defaultValue={election.countingCommittee} placeholder="Namen, durch Komma getrennt" />
                </Field>
                <Field label="Notizen" name="notes">
                  <Textarea id="notes" name="notes" rows={3} defaultValue={election.notes} />
                </Field>
                <Field label="Status" name="status" hint="„abgeschlossen“ sperrt die Auszählung und setzt die Wahlperiode neu.">
                  <NativeSelect id="status" name="status" defaultValue={election.status}>
                    <option value="PLANUNG">in Vorbereitung</option>
                    <option value="LAUFEND">läuft</option>
                    <option value="ABGESCHLOSSEN">abgeschlossen</option>
                  </NativeSelect>
                </Field>
                <SubmitButton className="self-start">Speichern</SubmitButton>
              </ActionForm>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-neutral-600">Anwesend</dt>
                <dd>{election.presentEligible ?? "–"}</dd>
                <dt className="text-neutral-600">Leitung</dt>
                <dd>{election.chair || "–"}</dd>
                <dt className="text-neutral-600">Zählkommission</dt>
                <dd>{election.countingCommittee || "–"}</dd>
              </dl>
            )}
            {manage && !hasRounds ? (
              <ActionForm action={deleteElectionAction.bind(null, election.id)} showErrorInline={false} className="mt-4 border-t pt-4">
                <ConfirmSubmit variant="ghost" size="sm" confirm="Diese Wahl samt Ämtern und Vorschlägen löschen?" pendingText="…">
                  <Trash2 className="size-4" /> Wahl löschen
                </ConfirmSubmit>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
