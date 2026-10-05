import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Undo2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { StatuteRef } from "@/components/statute-ref";
import { Button } from "@/components/ui/button";
import { roundLabel } from "@/lib/election-flow";
import { requirePageCapability } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getElection, positionStep } from "@/server/services/elections";
import { deleteLastRoundAction } from "../../../actions";
import { CountForm } from "./count-form";

export const metadata: Metadata = { title: "Auszählung" };

export default async function CountPage({ params }: { params: Promise<{ id: string; positionId: string }> }) {
  const user = await requirePageCapability("election.manage");
  const { id, positionId } = await params;
  let election;
  try {
    election = await getElection(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const position = election.positions.find((p) => p.id === positionId);
  if (!position) notFound();
  const step = positionStep(position);
  const last = position.rounds[position.rounds.length - 1];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 self-start">
        <Link href={`/elections/${id}`}>
          <ArrowLeft className="size-4" /> {election.title}
        </Link>
      </Button>
      <PageHeader
        title={`${position.title}: ${step.done ? "entschieden" : step.label}`}
        description={position.mode === "EINZEL" ? "Einzelwahl – absolute Mehrheit der gültigen Stimmen, Enthaltungen zählen nicht (LV-Satzung § 57 Abs. 2)." : `Sammelwahl – ${position.seats} Plätze, gewählt nach Stimmenreihenfolge (LV-Satzung § 57 Abs. 3).`}
      />
      {step.done ? (
        <p className="text-sm">
          {step.label}{" "}
          <Link href={`/elections/${id}`} className="underline">
            Zurück zur Übersicht
          </Link>
        </p>
      ) : (
        <CountForm
          electionId={id}
          positionId={position.id}
          mode={position.mode}
          seats={position.seats}
          sequence={position.rounds.length + 1}
          presentEligible={election.presentEligible}
          step={step}
          candidates={step.candidateIds.map((cid) => ({ id: cid, name: position.candidates.find((c) => c.id === cid)?.name ?? "?" }))}
        />
      )}
      {last && election.status !== "ABGESCHLOSSEN" ? (
        <ActionForm action={deleteLastRoundAction.bind(null, id, position.id)} showErrorInline={false} className="mt-8 border-t pt-4">
          <ConfirmSubmit variant="ghost" size="sm" confirm={`${roundLabel(last.stage, last.round)} wirklich zurücknehmen (z. B. nach Zählfehler)?`} pendingText="…">
            <Undo2 className="size-4" /> Letzten Wahlgang ({roundLabel(last.stage, last.round)}) zurücknehmen
          </ConfirmSubmit>
        </ActionForm>
      ) : null}
      <p className="mt-6 font-serif text-xs text-neutral-600">
        Die Auszählung funktioniert auch ohne Netz: Eingaben werden auf diesem Gerät zwischengespeichert und übertragen, sobald wieder Verbindung besteht.
        Grundlage: <StatuteRef cite="LV-Satzung § 57">LV-Satzung § 57</StatuteRef>, Niederschrift nach <StatuteRef cite="LV-Satzung § 51 Abs. 2">§ 51 Abs. 2</StatuteRef>.
      </p>
    </>
  );
}
