import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { MinutesEditor, type EditorData } from "@/components/minutes/minutes-editor";
import { MinutesView } from "@/components/minutes/minutes-view";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { numberAgenda } from "@/lib/agenda";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { checklistComplete } from "@/lib/minutes-checklist";
import { asPoints, serializePoints, shortName } from "@/lib/minutes-text";
import { dueLabel, GROUP_LABEL } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import {
  asFormalities,
  asSigners,
  liveQuorum,
  loadMinutes,
  minutesChecklistFor,
  resultText,
} from "@/server/services/minutes";
import { minutesContext, minutesPreviewHtml } from "@/server/services/minutes-export";
import { DocumentPreview } from "@/components/document-preview";
import { getSettings } from "@/server/services/settings";
import { listActiveUsers } from "@/server/services/users";
import { newVersionAction, sendMinutesAction, sendToOfficeAction, startMinutesAction } from "./actions";
import { NewVersionForm, SendMinutesForm } from "./workflow-panel";

export const metadata: Metadata = { title: "Protokoll" };

const STATUS: Record<string, string> = { ENTWURF: "Entwurf", VERSENDET: "versendet", GENEHMIGT: "genehmigt" };

export default async function MinutesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ansicht?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { ansicht } = await searchParams;
  const { meeting, minutes, versions } = await loadMinutes(user, id);
  const canEdit = can(user.role, "minutes.edit");

  if (!minutes) {
    return (
      <>
        <PageHeader title="Protokoll" description={meetingTitle(meeting)} />
        {canEdit && meeting.status !== "ABGESAGT" ? (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4 text-sm">
              <p>
                Die Protokollvorlage wird mit Datum, Ort, Anwesenden (aus den Zu-/Absagen) und der Tagesordnung vorbefüllt. Sie können live
                während der Sitzung schreiben oder nachträglich.
              </p>
              <ActionForm action={startMinutesAction.bind(null, id)}>
                <SubmitButton>Protokoll starten</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-neutral-600">Für diese Sitzung gibt es noch kein Protokoll.</p>
        )}
      </>
    );
  }

  const editing = canEdit && minutes.status === "ENTWURF" && !ansicht;
  const [checklist, ctx, settings] = await Promise.all([minutesChecklistFor(minutes, meeting), minutesContext(minutes, meeting), getSettings()]);
  const complete = checklistComplete(checklist);
  const runningCirculation = minutes.circulations.find((c) => c.status === "LAUFEND");

  let editorData: EditorData | null = null;
  if (editing) {
    const [quorum, users] = await Promise.all([liveQuorum(meeting.id), listActiveUsers()]);
    const numbered = numberAgenda(meeting.agendaItems);
    editorData = {
      meetingId: meeting.id,
      minutesId: minutes.id,
      header: {
        chairNote: meeting.chairNote,
        recorderName: minutes.recorderName,
        openedTime: formatTime(meeting.openedAt),
        closedTime: formatTime(meeting.closedAt),
        interruptionNote: meeting.interruptionNote,
        extraAttendees: meeting.extraAttendees,
      },
      formalities: asFormalities(minutes.formalities),
      signers: asSigners(minutes.signers),
      attendance: [...meeting.attendances]
        .sort((a, b) => a.sortSnapshot - b.sortSnapshot || a.nameSnapshot.localeCompare(b.nameSnapshot))
        .map((a) => ({
          id: a.id,
          name: a.nameSnapshot,
          funktion: a.functionSnapshot,
          voting: a.votingSnapshot,
          response: a.response,
          presence: a.presence,
        })),
      quorum,
      determined: meeting.quorumDeterminedAt
        ? { by: meeting.quorumDeterminedBy, present: meeting.quorumPresent ?? 0, eligible: meeting.quorumEligible ?? 0, reached: !!meeting.quorumReached }
        : null,
      isRepeat: meeting.isRepeatAfterNoQuorum,
      suspended: meeting.status === "AUFGEHOBEN",
      canManage: can(user.role, "meeting.manage"),
      defaultLocation: meeting.location,
      users: users.map((u) => ({ id: u.id, name: u.name })),
      uncertainties: Array.isArray(minutes.aiUncertainties) ? (minutes.aiUncertainties as unknown[]).map(String) : [],
      tops: numbered.map((item) => {
        const section = minutes.sections.find((s) => s.agendaItemId === item.id);
        return {
          id: item.id,
          number: item.number,
          level: item.level,
          title: item.title,
          status: item.status,
          kind: item.kind,
          approval: item.minutesToApprove
            ? {
                minutesId: item.minutesToApprove.id,
                status: item.minutesToApprove.status,
                date: formatDate(item.minutesToApprove.meeting.startsAt),
              }
            : null,
          pointsText: serializePoints(asPoints(section?.points)),
          outcomeType: section?.outcomeType ?? "",
          outcomeText: section?.outcomeText ?? "",
          resolutions: meeting.resolutions
            .filter((r) => r.agendaItemId === item.id)
            .map((r) => ({ id: r.id, number: r.number, subject: r.subject, label: resultText(r) })),
          tasks: meeting.tasks
            .filter((t) => t.agendaItemId === item.id)
            .map((t) => ({
              id: t.id,
              title: t.title,
              who: [GROUP_LABEL[t.assigneeGroup], ...t.assignees.map((a) => shortName(a.user.name))].filter(Boolean).join(", "),
              due: dueLabel(t),
            })),
        };
      }),
    };
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Protokoll" description={meetingTitle(meeting)} />
        <div className="flex items-center gap-2">
          {minutes.version > 1 ? <Badge variant="outline">Version {minutes.version}</Badge> : null}
          <Badge variant={minutes.status === "GENEHMIGT" ? "success" : minutes.status === "VERSENDET" ? "default" : "secondary"}>
            {STATUS[minutes.status]}
          </Badge>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/meetings/${id}`}>Zur Sitzung</Link>
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/minutes/${minutes.id}/download?format=pdf`} target="_blank" rel="noopener">
            PDF
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/minutes/${minutes.id}/download?format=docx`}>DOCX</a>
        </Button>
        <nav className="flex gap-1" aria-label="Ansicht">
            {(canEdit && minutes.status === "ENTWURF"
              ? [
                  ["", "Bearbeiten"],
                  ["vorschau", "Lesen"],
                  ["dokument", "Vorschau"],
                ]
              : [
                  ["", "Lesen"],
                  ["dokument", "Vorschau"],
                ]
            ).map(([v, label]) => (
              <Link
                key={v}
                href={`/meetings/${id}/minutes${v ? `?ansicht=${v}` : ""}`}
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  (ansicht ?? "") === v ? "bg-akzent-hell font-semibold text-akzent-dunkel" : "text-neutral-600 hover:bg-neutral-100",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        {canEdit ? (
          <Button asChild variant="outline">
            <Link href={`/meetings/${id}/presentation`}>Präsentation</Link>
          </Button>
        ) : null}
        {canEdit && minutes.status === "ENTWURF" ? (
          <Button asChild variant="outline">
            <Link href={`/meetings/${id}/transcripts`}>Aus Transkript</Link>
          </Button>
        ) : null}
      </div>

      {ansicht === "dokument" ? (
        <DocumentPreview
          html={await minutesPreviewHtml(user, minutes.id)}
          title={`Protokoll${minutes.version > 1 ? ` (Version ${minutes.version})` : ""}`}
          pdfHref={`/api/minutes/${minutes.id}/download?format=pdf`}
        />
      ) : null}

      {minutes.status === "VERSENDET" ? (
        <Alert className="mb-4">
          <AlertDescription>
            Versendet am {formatDateTime(minutes.sentAt)}. Der Inhalt ist gesperrt; Korrekturen nur als neue Version.{" "}
            {minutes.approvalMode === "UMLAUF" && runningCirculation ? (
              <Link href={`/circulations/${runningCirculation.id}`} className="underline">
                Genehmigung läuft im Umlaufverfahren {runningCirculation.number}.
              </Link>
            ) : (
              "Genehmigung in der nächsten Sitzung."
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {minutes.status === "GENEHMIGT" ? (
        <Alert variant="success" className="mb-4">
          <AlertDescription>
            Genehmigt am {formatDate(minutes.approvedAt)} ({minutes.approvalMode === "UMLAUF" ? "im Umlaufverfahren" : "in der Sitzung"}).
            {minutes.sentToOfficeAt ? ` An die Kreisgeschäftsstelle übersandt am ${formatDate(minutes.sentToOfficeAt)}.` : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0">{editorData ? <MinutesEditor d={editorData} /> : <MinutesView ctx={ctx} />}</div>
        <aside className="flex flex-col gap-4">
          {minutes.status === "ENTWURF" ? (
            <Card>
              <CardHeader>
                <CardTitle>Prüfliste (LV-Satzung § 51)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-1 text-sm">
                  {checklist.map((c) => (
                    <li key={c.key} className={c.ok ? "text-green-800" : "text-red-800"}>
                      {c.ok ? "✓" : "✗"} {c.label}
                      {c.detail ? <span className="text-neutral-600"> ({c.detail})</span> : null}
                    </li>
                  ))}
                </ul>
                {can(user.role, "minutes.send") ? (
                  <SendMinutesForm
                    action={sendMinutesAction.bind(null, id, minutes.id)}
                    canCirculate={can(user.role, "circulation.manage")}
                    complete={complete}
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          {minutes.status === "VERSENDET" && canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Korrektur</CardTitle>
              </CardHeader>
              <CardContent>
                <NewVersionForm action={newVersionAction.bind(null, id, minutes.id)} />
              </CardContent>
            </Card>
          ) : null}
          {minutes.status === "GENEHMIGT" && can(user.role, "minutes.send") ? (
            <Card>
              <CardHeader>
                <CardTitle>Kreisgeschäftsstelle</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>Die Niederschrift ist der zuständigen Geschäftsstelle zu übersenden (LV-Satzung § 51 Abs. 3).</p>
                {settings.office.email ? (
                  <ActionForm action={sendToOfficeAction.bind(null, id, minutes.id)}>
                    <SubmitButton variant={minutes.sentToOfficeAt ? "outline" : "default"}>
                      {minutes.sentToOfficeAt ? "Erneut übersenden" : `An ${settings.office.email} senden`}
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <Link href="/settings/general" className="underline">
                    E-Mail der Geschäftsstelle in den Einstellungen hinterlegen
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : null}
          {versions.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Versionen</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <a href={`/api/minutes/${v.id}/download?format=pdf`} target="_blank" rel="noopener" className="text-akzent-dunkel underline">
                        Version {v.version}
                      </a>{" "}
                      – {STATUS[v.status]}
                      {v.changeNote ? ` – ${v.changeNote}` : ""}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
