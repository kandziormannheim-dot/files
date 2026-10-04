import type { Metadata } from "next";
import Link from "next/link";
import { CirculationBadge } from "@/components/circulation-badge";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { VoteForm } from "@/components/vote-form";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { evaluate, getCirculation, tally, VOTE_LABELS } from "@/server/services/circulations";
import { abortAction, announceAction, determineAction, voteAction } from "../actions";

export const metadata: Metadata = { title: "Umlaufverfahren" };

export default async function CirculationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await getCirculation(user, id);
  const t = tally(c, c.votes);
  const ev = evaluate(c, c.votes);
  const mine = c.votes.find((v) => v.userId === user.id);
  const manage = can(user.role, "circulation.manage");
  const quarter = c.eligibleCount / 4;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={`${c.number} · ${c.subject}`} description={`Eingeleitet am ${formatDate(c.initiatedAt)}${c.initiatedBy ? ` von ${c.initiatedBy.name}` : ""} · Frist ${formatDateTime(c.deadline)}`} />
        <CirculationBadge status={c.status} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-2 pt-4 text-sm">
              <p className="whitespace-pre-wrap">{c.text}</p>
              {c.reason ? <p className="whitespace-pre-wrap text-neutral-700">Begründung: {c.reason}</p> : null}
              {c.minutes ? (
                <p>
                  Gegenstand:{" "}
                  <Link href={`/meetings/${c.minutes.meetingId}/minutes`} className="text-akzent-dunkel underline">
                    Protokoll der Sitzung vom {formatDate(c.minutes.meeting.startsAt)}
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>
          {c.resultText ? (
            <Alert variant={c.status === "ANGENOMMEN" ? "success" : c.status === "LAUFEND" ? "default" : "warning"}>
              <AlertDescription>
                {c.resultText}
                {c.determinedAt ? ` (festgestellt ${formatDateTime(c.determinedAt)}${c.determinedBy ? ` durch ${c.determinedBy.name}` : ""})` : ""}
                {c.announcedAt ? ` · bekanntgegeben ${formatDate(c.announcedAt)}` : ""}
              </AlertDescription>
            </Alert>
          ) : null}
          {mine && c.status === "LAUFEND" ? (
            <Card>
              <CardHeader>
                <CardTitle>Ihre Stimme</CardTitle>
              </CardHeader>
              <CardContent>
                {mine.vote ? (
                  <p className="text-sm">
                    Abgegeben am {formatDateTime(mine.votedAt)}: <strong>{VOTE_LABELS[mine.vote]}</strong>
                  </p>
                ) : (
                  <VoteForm action={voteAction.bind(null, id)} />
                )}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Stimmen ({t.yes + t.no + t.abstain + t.objections} von {t.eligible})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {c.votes.map((v) => (
                  <li key={v.id} className="flex flex-wrap justify-between gap-2 border-b pb-1">
                    <span>{v.user.name}</span>
                    <span className="text-neutral-600">
                      {v.vote ? `${VOTE_LABELS[v.vote]} · ${formatDateTime(v.votedAt)}` : "keine Rückmeldung"}
                      {v.comment ? ` · „${v.comment}“` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Stand</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>
                Zustimmungen: <strong>{t.yes}</strong> von erforderlich {ev.requiredYes} (Mehrheit aller {t.eligible} Stimmberechtigten)
              </p>
              <p>
                Widersprüche: <strong>{t.objections}</strong> – unzulässig ab mehr als {quarter.toLocaleString("de-DE")} (einem Viertel)
              </p>
              <p>
                Ablehnungen {t.no} · Enthaltungen {t.abstain} · ausstehend {ev.pending}
              </p>
              <p className="text-neutral-600">Schweigen gilt nicht als Zustimmung.</p>
              {c.status === "LAUFEND" ? <p className="font-medium">{ev.final ? "Das Ergebnis steht fest." : ev.text}</p> : null}
            </CardContent>
          </Card>
          {manage && c.status === "LAUFEND" ? (
            <Card>
              <CardHeader>
                <CardTitle>Feststellung</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ActionForm action={determineAction.bind(null, id)} className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox name="announce" defaultChecked /> Ergebnis gleich an den Vorstand bekanntgeben
                  </label>
                  <SubmitButton disabled={!ev.final}>Ergebnis feststellen</SubmitButton>
                </ActionForm>
                <ActionForm action={abortAction.bind(null, id)} className="flex flex-col gap-2 border-t pt-3">
                  <Input name="reason" placeholder="Grund (optional)" aria-label="Grund für den Abbruch" />
                  <SubmitButton variant="ghost" size="sm" className="self-start">
                    Verfahren abbrechen
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}
          {manage && c.status !== "LAUFEND" && c.status !== "ABGEBROCHEN" && !c.announcedAt ? (
            <ActionForm action={announceAction.bind(null, id)}>
              <SubmitButton>Ergebnis bekanntgeben</SubmitButton>
            </ActionForm>
          ) : null}
        </aside>
      </div>
    </>
  );
}
