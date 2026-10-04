import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoteForm } from "@/components/vote-form";
import { formatDateTime } from "@/lib/dates";
import { getVoteByToken, isVoteOpen, VOTE_LABELS } from "@/server/services/circulations";
import { voteByTokenAction } from "./actions";

export const metadata: Metadata = { title: "Umlaufverfahren" };

// Persönlicher Link aus der Mail (umlauf.einleitung) – Stimmabgabe ohne Login.
export default async function VotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await getVoteByToken(token);
  if (!v) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link ungültig</CardTitle>
        </CardHeader>
      </Card>
    );
  }
  const c = v.circulation;
  const open = isVoteOpen(c, !!v.vote);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Umlaufverfahren {c.number}: {c.subject}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="whitespace-pre-wrap">{c.text}</p>
        {c.reason ? <p className="whitespace-pre-wrap text-neutral-700">Begründung: {c.reason}</p> : null}
        <p>Frist: {formatDateTime(c.deadline)}</p>
        <p>Hallo {v.user.name},</p>
        {v.vote ? (
          <p>
            Ihre Stimme vom {formatDateTime(v.votedAt)}: <strong>{VOTE_LABELS[v.vote]}</strong>
          </p>
        ) : open ? (
          <VoteForm action={voteByTokenAction.bind(null, token)} />
        ) : (
          <p className="text-neutral-600">Das Verfahren ist abgeschlossen oder die Frist ist abgelaufen.</p>
        )}
      </CardContent>
    </Card>
  );
}
