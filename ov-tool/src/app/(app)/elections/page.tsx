import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, Plus, Vote } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { StatuteRef } from "@/components/statute-ref";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { electionPeriodStatus, listElections } from "@/server/services/elections";
import { listPolls, POLL_NOTICE } from "@/server/services/polls";
import { createElectionAction } from "./actions";

export const metadata: Metadata = { title: "Wahlen & Abstimmungen" };

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" }> = {
  PLANUNG: { label: "in Vorbereitung", variant: "secondary" },
  LAUFEND: { label: "läuft", variant: "warning" },
  ABGESCHLOSSEN: { label: "abgeschlossen", variant: "success" },
};

export default async function ElectionsPage() {
  const user = await requireUser();
  const [elections, polls, period] = await Promise.all([listElections(user), listPolls(user), electionPeriodStatus()]);
  const manage = can(user.role, "election.manage");
  return (
    <>
      <PageHeader
        title="Wahlen & Abstimmungen"
        description="Vorstandswahlen in der Mitgliederversammlung, Meinungsbilder im Vorstand und Hinweise zu förmlichen Abstimmungen."
      />

      {period ? (
        <Alert variant={period.overdue ? "destructive" : period.warn ? "warning" : "default"} className="mb-6">
          <CalendarClock className="size-4" />
          <AlertTitle>
            Nächste Vorstandswahl spätestens bis {formatDate(period.dueBy)}
            {period.overdue ? " – überschritten" : period.warn ? ` – noch ${period.daysLeft} Tage` : ""}
          </AlertTitle>
          <AlertDescription>
            Zu allen Parteigremien ist mindestens in jedem zweiten Kalenderjahr zu wählen (<StatuteRef cite="LV-Satzung § 56 Abs. 1">LV-Satzung § 56 Abs. 1</StatuteRef>,{" "}
            <StatuteRef cite="Statut § 44">Statut § 44</StatuteRef>). Einladung zur Mitgliederversammlung spätestens am 8. Tag vorher (
            <StatuteRef cite="LV-Satzung § 50 Abs. 2">LV-Satzung § 50 Abs. 2</StatuteRef>).
          </AlertDescription>
        </Alert>
      ) : (
        <p className="mb-6 text-sm text-neutral-600">
          Das Datum der letzten Vorstandswahl ist noch nicht bekannt. Nach Abschluss einer Wahl im Tool wird die Wahlperiode automatisch überwacht
          {can(user.role, "settings.manage") ? (
            <>
              {" "}
              (oder unter <Link href="/settings/general" className="underline">Einstellungen</Link> eintragen)
            </>
          ) : null}
          .
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-rhoendorf">
            <Vote className="size-5 text-cadenabbia" /> Vorstandswahlen
          </h2>
          {elections.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Wahl angelegt.</p> : null}
          <ul className="flex flex-col gap-2">
            {elections.map((e) => (
              <li key={e.id}>
                <Link href={`/elections/${e.id}`} className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:border-cadenabbia">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-rhoendorf">{e.title}</div>
                    <div className="text-xs text-neutral-600">
                      {formatDateTime(e.date)} · {e.positions.length} Ämter
                    </div>
                  </div>
                  <Badge variant={STATUS[e.status]!.variant}>{STATUS[e.status]!.label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          {manage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Neue Wahl (Mitgliederversammlung)</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={createElectionAction} className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bezeichnung" name="title" className="sm:col-span-2">
                    <Input id="title" name="title" required defaultValue={`Mitgliederversammlung mit Vorstandswahlen ${new Date().getFullYear()}`} />
                  </Field>
                  <Field label="Datum und Uhrzeit" name="date">
                    <Input id="date" name="date" type="datetime-local" required />
                  </Field>
                  <Field label="Ort" name="location">
                    <Input id="location" name="location" placeholder="z. B. Restaurant Weingärtner" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <Checkbox name="defaults" defaultChecked /> Ämter nach LV-Satzung § 37 Abs. 1 vorschlagen
                  </label>
                  <Field label="Zahl der Beisitzer (MV-Beschluss, bis 12)" name="assessors">
                    <Input id="assessors" name="assessors" type="number" min={0} max={12} defaultValue={6} />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <Checkbox name="auditors" defaultChecked /> Kassenprüfer mitwählen
                  </label>
                  <SubmitButton className="justify-self-start" pendingText="Wird angelegt …">
                    <Plus className="size-4" /> Wahl anlegen
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-rhoendorf">
              <ClipboardCheck className="size-5 text-cadenabbia" /> Meinungsbilder
            </h2>
            {can(user.role, "poll.create") ? (
              <Button asChild size="sm">
                <Link href="/elections/polls/new">
                  <Plus className="size-4" /> Neu
                </Link>
              </Button>
            ) : null}
          </div>
          <p className="font-serif text-xs text-neutral-600">{POLL_NOTICE}</p>
          {polls.length === 0 ? <p className="text-sm text-neutral-600">Noch kein Meinungsbild.</p> : null}
          <ul className="flex flex-col gap-2">
            {polls.map((p) => (
              <li key={p.id}>
                <Link href={`/elections/polls/${p.id}`} className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:border-cadenabbia">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-rhoendorf">{p.question}</div>
                    <div className="text-xs text-neutral-600">
                      {p.voteCount} Antworten{p.closesAt && p.open ? ` · bis ${formatDateTime(p.closesAt)}` : ""}
                      {p.anonymous ? " · anonym" : ""}
                    </div>
                  </div>
                  {p.open ? <Badge variant={p.voted ? "success" : "warning"}>{p.voted ? "abgestimmt" : "offen"}</Badge> : <Badge variant="secondary">beendet</Badge>}
                </Link>
              </li>
            ))}
          </ul>

          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="text-base">Förmliche Abstimmungen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-neutral-700">
              <p>
                <strong>In der Sitzung:</strong> Ja/Nein/Enthaltung je Antrag im Protokoll erfassen – das Ergebnis wird nach{" "}
                <StatuteRef cite="LV-Satzung § 55">LV-Satzung § 55</StatuteRef> berechnet (Sitzung → Protokoll → Beschluss).
              </p>
              <p>
                <strong>Zwischen Sitzungen:</strong> <Link href="/circulations" className="underline">Umlaufverfahren</Link> per E-Mail-Link (
                <StatuteRef cite="Statut § 42 Abs. 3">Statut § 42 Abs. 3</StatuteRef>).
              </p>
              <p className="text-neutral-600">
                Geheime Wahlen und förmliche Abstimmungen über die App sind bewusst nicht möglich: Elektronische Stimmabgabe ist nur mit einem anerkannten,
                zertifizierten Verfahren zulässig (<StatuteRef cite="Statut § 43 Abs. 1">Statut § 43 Abs. 1</StatuteRef>). Vorstandswahlen werden mit
                Papier-Stimmzetteln durchgeführt; das Tool druckt sie und wertet die Auszählung aus.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
