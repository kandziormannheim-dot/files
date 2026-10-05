import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Send, Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getResolution, motionDefaults, resolutionContext } from "@/server/services/resolutions";
import { deleteMotionAction, saveMotionAction, sendMotionAction } from "../actions";
import { MotionForm } from "./motion-form";

export const metadata: Metadata = { title: "Beschluss" };

export default async function ResolutionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let r;
  try {
    r = await getResolution(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const ctx = await resolutionContext(r);
  const canMotion = can(user.role, "motion.send");
  const accepted = r.resultType === "ANGENOMMEN_EINSTIMMIG" || r.resultType === "ANGENOMMEN_MEHRHEITLICH";
  const draft = r.motions.find((m) => m.status === "ENTWURF");
  const defaults = draft ?? (await motionDefaults(r));
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 self-start">
        <Link href="/resolutions">
          <ArrowLeft className="size-4" /> Beschlüsse
        </Link>
      </Button>
      <PageHeader title={`Beschluss ${r.number}`} description={r.subject} />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild>
          <a href={`/api/resolutions/${r.id}/pdf`} target="_blank" rel="noreferrer">
            <FileDown className="size-4" /> Beschluss als PDF
          </a>
        </Button>
        {r.meeting ? (
          <Button asChild variant="outline">
            <Link href={`/meetings/${r.meeting.id}/minutes`}>Zum Protokoll</Link>
          </Button>
        ) : null}
        {r.circulation ? (
          <Button asChild variant="outline">
            <Link href={`/circulations/${r.circulation.id}`}>Zum Umlaufverfahren</Link>
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-neutral-600">Gefasst</dt>
              <dd>{formatDateTime(ctx.datum)}</dd>
              <dt className="text-neutral-600">Verfahren</dt>
              <dd>{ctx.verfahren}</dd>
              {ctx.top ? (
                <>
                  <dt className="text-neutral-600">TOP</dt>
                  <dd>
                    {ctx.top} {ctx.topTitel}
                  </dd>
                </>
              ) : null}
              <dt className="text-neutral-600">Ergebnis</dt>
              <dd className="font-semibold">{ctx.ergebnisText}</dd>
              {ctx.beschlussfaehigkeit ? (
                <>
                  <dt className="text-neutral-600">Beschlussfähigkeit</dt>
                  <dd>{ctx.beschlussfaehigkeit}</dd>
                </>
              ) : null}
            </dl>
            {ctx.wortlaut ? <p className="mt-4 whitespace-pre-line rounded-md bg-cadenabbia-10 p-3 text-sm">{ctx.wortlaut}</p> : <p className="mt-4 text-xs text-neutral-600">Kein Wortlaut im Protokoll hinterlegt (Ergebnistext des TOP).</p>}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {r.motions
            .filter((m) => m.status === "EINGEREICHT")
            .map((m) => (
              <Alert key={m.id} variant="success">
                <AlertDescription>
                  Antrag „{m.title}“ am {formatDateTime(m.sentAt)} an {m.recipientEmail} eingereicht.{" "}
                  <a href={`/api/motions/${m.id}/pdf`} target="_blank" rel="noreferrer" className="underline">
                    PDF
                  </a>
                </AlertDescription>
              </Alert>
            ))}
          {canMotion && accepted ? (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Als Antrag an den Kreisverband</CardTitle>
                {draft ? <Badge variant="warning">Entwurf</Badge> : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <MotionForm action={saveMotionAction.bind(null, r.id, draft?.id ?? null)} values={defaults} isNew={!draft} />
                {draft ? (
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button asChild variant="outline">
                      <a href={`/api/motions/${draft.id}/pdf`} target="_blank" rel="noreferrer">
                        <FileDown className="size-4" /> Antrag-PDF ansehen
                      </a>
                    </Button>
                    <ActionForm action={sendMotionAction.bind(null, r.id, draft.id)} showErrorInline={false}>
                      <ConfirmSubmit confirm={`Antrag jetzt an ${draft.recipientEmail} senden? Antrag und Beschluss gehen als PDF mit.`} pendingText="Wird gesendet …">
                        <Send className="size-4" /> Antrag einreichen
                      </ConfirmSubmit>
                    </ActionForm>
                    <ActionForm action={deleteMotionAction.bind(null, r.id, draft.id)} showErrorInline={false}>
                      <ConfirmSubmit variant="ghost" confirm="Antragsentwurf löschen?" pendingText="…">
                        <Trash2 className="size-4" />
                      </ConfirmSubmit>
                    </ActionForm>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : !accepted ? (
            <p className="text-sm text-neutral-600">Nur angenommene Beschlüsse können als Antrag eingereicht werden.</p>
          ) : (
            <p className="text-sm text-neutral-600">Anträge reicht ein, wer das Recht „Beschlüsse als Antrag einreichen“ hat (Standard: Admin).</p>
          )}
        </div>
      </div>
    </>
  );
}
