import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getPoll, POLL_NOTICE } from "@/server/services/polls";
import { closePollAction, votePollAction } from "../../actions";

export const metadata: Metadata = { title: "Meinungsbild" };

export default async function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let poll;
  try {
    poll = await getPoll(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const max = Math.max(1, ...poll.counts);
  const canVote = poll.open && can(user.role, "meeting.respond");
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 self-start">
        <Link href="/elections">
          <ArrowLeft className="size-4" /> Wahlen & Abstimmungen
        </Link>
      </Button>
      <PageHeader title={poll.question} description={poll.description || undefined} />
      <Alert variant="warning" className="mb-4">
        <AlertDescription>{POLL_NOTICE}</AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {canVote ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{poll.mine ? "Antwort ändern" : "Meine Antwort"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={votePollAction.bind(null, poll.id)} className="flex flex-col gap-3">
                {poll.options.map((o, i) => (
                  <label key={i} className="flex items-center gap-3 rounded-md border p-3 text-base has-[:checked]:border-cadenabbia has-[:checked]:bg-cadenabbia-10">
                    <input type={poll.multiple ? "checkbox" : "radio"} name="choice" value={i} defaultChecked={poll.mine?.includes(i)} className="size-4 accent-[#2d3c4b]" />
                    {o}
                  </label>
                ))}
                <SubmitButton className="self-start">Antwort speichern</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Stand ({poll.total} Antworten)</CardTitle>
            {poll.open ? <Badge variant="warning">läuft{poll.closesAt ? ` bis ${formatDateTime(poll.closesAt)}` : ""}</Badge> : <Badge variant="secondary">beendet</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {poll.options.map((o, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm">
                  <span>{o}</span>
                  <span className="font-semibold">{poll.counts[i]}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-rhoendorf-10">
                  <div className="h-2 rounded bg-cadenabbia" style={{ width: `${((poll.counts[i] ?? 0) / max) * 100}%` }} />
                </div>
              </div>
            ))}
            {!poll.anonymous && poll.voters.length ? (
              <div className="border-t pt-3 text-sm">
                {poll.voters.map((v) => (
                  <div key={v.name}>
                    <span className="font-medium">{v.name}:</span> {v.choices.map((c) => poll.options[c]).join(", ")}
                  </div>
                ))}
              </div>
            ) : null}
            {poll.anonymous ? <p className="text-xs text-neutral-500">Anonym – es werden keine Namen angezeigt.</p> : null}
            {poll.open && poll.canClose ? (
              <ActionForm action={closePollAction.bind(null, poll.id)} showErrorInline={false}>
                <ConfirmSubmit size="sm" variant="outline" confirm="Meinungsbild jetzt beenden?" pendingText="…">
                  Beenden
                </ConfirmSubmit>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
