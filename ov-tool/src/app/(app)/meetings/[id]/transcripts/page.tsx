import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateTime } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { requirePageCapability } from "@/server/auth/session";
import { aiConfigured } from "@/server/services/ai-draft";
import { getMeeting } from "@/server/services/meetings";
import { listTranscripts } from "@/server/services/transcripts";
import { deleteTranscriptAction, requestDraftAction, uploadTranscriptAction } from "./actions";

export const metadata: Metadata = { title: "Transkripte" };

const STATUS: Record<string, [string, "secondary" | "default" | "success" | "destructive" | "warning"]> = {
  HOCHGELADEN: ["wartet auf Transkription", "secondary"],
  TRANSKRIPTION: ["Transkription läuft", "warning"],
  TRANSKRIBIERT: ["Text liegt vor", "default"],
  ENTWURF_LAEUFT: ["Entwurf wird erstellt", "warning"],
  ENTWURF_FERTIG: ["Entwurf fertig", "success"],
  FEHLER: ["Fehler", "destructive"],
};

export default async function TranscriptsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageCapability("transcript.upload");
  const { id } = await params;
  const [meeting, transcripts] = await Promise.all([getMeeting(user, id), listTranscripts(user, id)]);
  const ai = aiConfigured();
  return (
    <>
      <PageHeader title="Protokoll aus Transkript" description={meetingTitle(meeting)} />
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href={`/meetings/${id}/minutes`}>Zum Protokoll</Link>
        </Button>
      </div>
      <Alert className="mb-6">
        <AlertDescription className="flex flex-col gap-1">
          <span>
            <strong>Datenfluss:</strong> Audio wird auf dem eigenen Server mit faster-whisper transkribiert und danach sofort gelöscht – es
            verlässt den Server nicht. Nur der Transkripttext wird mit Tagesordnung und Anwesenheitsliste an die Claude API (Anthropic)
            übermittelt, um einen Protokollentwurf zu erstellen.
          </span>
          <span>Der Text wird gelöscht, sobald das Protokoll genehmigt ist (spätestens nach der eingestellten Frist).</span>
          {!ai ? <span className="text-amber-900">Die Claude API ist nicht eingerichtet – es wird nur transkribiert.</span> : null}
        </AlertDescription>
      </Alert>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Datei hochladen</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={uploadTranscriptAction.bind(null, id)} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
            <Field label="Quelle" name="source">
              <NativeSelect id="source" name="source" defaultValue="TEAMS">
                <option value="HANDY">Handy-Aufnahme (Audio)</option>
                <option value="PLAUD">Plaud o. ä. (Text oder Audio)</option>
                <option value="TEAMS">Teams (VTT/DOCX)</option>
                <option value="ZOOM">Zoom (VTT/TXT)</option>
                <option value="SONSTIGE">Sonstige</option>
              </NativeSelect>
            </Field>
            <Field label="Datei" name="file" hint="Audio: m4a, mp3, wav, ogg, webm · Text: vtt, txt, docx">
              <Input id="file" name="file" type="file" accept=".m4a,.mp3,.wav,.ogg,.webm,.mp4,.aac,.flac,.vtt,.txt,.docx" required />
            </Field>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <Checkbox name="consent" required className="mt-0.5" />
              <span>
                <strong>Alle Anwesenden haben der Aufnahme zugestimmt.</strong> (Pflicht)
              </span>
            </label>
            <SubmitButton className="self-start" pendingText="Wird hochgeladen …">
              Hochladen
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
      <ul className="flex flex-col gap-2">
        {transcripts.map((t) => {
          const [label, variant] = STATUS[t.status] ?? [t.status, "secondary"];
          return (
            <li key={t.id} className="rounded-lg border bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t.originalName}</span>
                <Badge variant={variant}>{label}</Badge>
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                {formatDateTime(t.createdAt)} · Zustimmung bestätigt von {t.consentConfirmedBy?.name ?? "–"}
                {t.audioDeletedAt ? " · Audio gelöscht" : ""}
                {t.textDeletedAt ? " · Text gelöscht" : ""}
                {t.draftAppliedAt ? ` · übernommen ${formatDateTime(t.draftAppliedAt)}` : ""}
              </div>
              {t.error ? <p className="mt-1 text-sm text-red-700">{t.error}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {t.status === "ENTWURF_FERTIG" ? (
                  <Button asChild size="sm">
                    <Link href={`/meetings/${id}/transcripts/${t.id}`}>Entwurf prüfen und übernehmen</Link>
                  </Button>
                ) : null}
                {ai && t.text && (t.status === "TRANSKRIBIERT" || t.status === "FEHLER" || t.status === "ENTWURF_FERTIG") ? (
                  <ActionForm action={requestDraftAction.bind(null, id, t.id)} showErrorInline={false}>
                    <SubmitButton size="sm" variant="outline">
                      {t.status === "ENTWURF_FERTIG" ? "Neu erstellen" : "Entwurf erstellen"}
                    </SubmitButton>
                  </ActionForm>
                ) : null}
                <ActionForm action={deleteTranscriptAction.bind(null, id, t.id)} showErrorInline={false}>
                  <ConfirmSubmit size="sm" variant="ghost" confirm="Transkript endgültig löschen?">
                    Löschen
                  </ConfirmSubmit>
                </ActionForm>
              </div>
            </li>
          );
        })}
        {transcripts.length === 0 ? <li className="text-sm text-neutral-600">Noch keine Transkripte.</li> : null}
      </ul>
    </>
  );
}
