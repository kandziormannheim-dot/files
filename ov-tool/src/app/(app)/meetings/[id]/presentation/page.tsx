import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Paperclip, Presentation } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { numberAgenda } from "@/lib/agenda";
import { formatDateTime } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { getMeeting } from "@/server/services/meetings";
import { canLeadMeeting } from "@/server/services/presentation";
import { attachPresentationAction, saveLeaderNotesAction } from "./actions";

export const metadata: Metadata = { title: "Präsentation" };

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!canLeadMeeting(user)) notFound();
  const meeting = await getMeeting(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const agenda = numberAgenda(meeting.agendaItems);
  const attached = await db.attachment.findFirst({ where: { ownerType: "Meeting", ownerId: id, inMinutes: true, fileName: { endsWith: ".pptx" } }, orderBy: { createdAt: "desc" } });

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href={`/meetings/${id}`} className="underline">
          ← {meetingTitle(meeting)}
        </Link>
      </div>
      <PageHeader
        title="Präsentation für die Sitzungsleitung"
        description="PowerPoint im CDU-Design aus der Tagesordnung: Titel, Tagesordnung, je TOP eine Folie, Abschluss. Ihre Vermerke stehen in den Notizen – sichtbar nur in der Referentenansicht."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild>
          <a href={`/api/meetings/${id}/presentation`}>
            <Download className="size-4" /> PowerPoint herunterladen
          </a>
        </Button>
        <ActionForm action={attachPresentationAction.bind(null, id)} showErrorInline={false}>
          <SubmitButton variant="outline" pendingText="Wird erzeugt …">
            <Paperclip className="size-4" /> Als Anlage zum Protokoll
          </SubmitButton>
        </ActionForm>
      </div>
      {attached ? (
        <Alert className="mb-6">
          <AlertDescription>
            <Presentation className="mr-1 inline size-4" /> {attached.fileName} ist seit {formatDateTime(attached.createdAt)} Uhr Anlage zum Protokoll. Nach Änderungen an Vermerken
            erneut „Als Anlage zum Protokoll“ wählen – die alte Fassung wird ersetzt.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Vermerke je TOP (Notizen der Präsentation)</CardTitle>
        </CardHeader>
        <CardContent>
          {agenda.length === 0 ? (
            <p className="text-sm text-rhoendorf-60">Noch keine Tagesordnung.</p>
          ) : (
            <ActionForm action={saveLeaderNotesAction.bind(null, id)} className="flex flex-col gap-4">
              {agenda.map((i) => (
                <div key={i.id} className={i.level ? "pl-6" : ""}>
                  <label htmlFor={`note-${i.id}`} className="mb-1 flex gap-3 text-sm">
                    <span className="w-16 shrink-0 font-bold text-rhoendorf">TOP {i.number}</span>
                    <span className="font-medium">{i.title}</span>
                  </label>
                  <Textarea
                    id={`note-${i.id}`}
                    name={`note:${i.id}`}
                    defaultValue={i.leaderNotes}
                    rows={2}
                    placeholder="z. B. Wer berichtet? Beschlussvorschlag, Hintergrund, Zeitrahmen"
                  />
                </div>
              ))}
              <p className="text-xs text-rhoendorf-60">
                Automatisch ergänzt: Zahl der Stimmberechtigten und Quorum, Abstimmungshinweise bei Protokoll und Tagesordnung, offene Aufgaben und anstehende Termine.
              </p>
              <SubmitButton className="self-start">Vermerke speichern</SubmitButton>
            </ActionForm>
          )}
        </CardContent>
      </Card>
    </>
  );
}
