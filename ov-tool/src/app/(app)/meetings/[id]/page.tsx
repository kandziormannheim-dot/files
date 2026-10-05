import type { Metadata } from "next";
import Link from "next/link";
import { AgendaEditor, type EditorItem } from "@/components/meetings/agenda-editor";
import { CancelMeetingDialog } from "@/components/meetings/cancel-dialog";
import { MeetingStatusBadge, RsvpBadge } from "@/components/meetings/meeting-badges";
import { RsvpButtons } from "@/components/meetings/rsvp-buttons";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateLong, formatTimeShort } from "@/lib/dates";
import { MEETING_FORMAT_LABELS, isRsvpOpen, meetingTitle } from "@/lib/meetings";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { agendaSuggestions, ensureAttendances, getMeeting, isMeetingLocked, numberedAgenda } from "@/server/services/meetings";
import { listTasks } from "@/server/services/tasks";
import {
  acceptProposalAction,
  cancelMeetingAction,
  dismissCarryOverAction,
  respondAction,
  takeOverCarryOverAction,
} from "../actions";

export const metadata: Metadata = { title: "Sitzung" };

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let meeting = await getMeeting(user, id);
  const upcoming = isRsvpOpen(meeting);
  if (upcoming && (await ensureAttendances(db, id))) meeting = await getMeeting(user, id);

  const manage = can(user.role, "meeting.manage");
  const editable = manage && !isMeetingLocked(meeting);
  const numbered = numberedAgenda(meeting);
  const tree: EditorItem[] = numbered
    .filter((i) => i.level === 0)
    .map((top) => ({
      ...top,
      children: numbered.filter((c) => c.parentId === top.id).map((c) => ({ ...c, children: [] })),
    }));
  const mine = meeting.attendances.find((a) => a.userId === user.id);
  const byResponse = (r: string) =>
    meeting.attendances
      .filter((a) => a.response === r)
      .sort((a, b) => a.sortSnapshot - b.sortSnapshot || a.nameSnapshot.localeCompare(b.nameSnapshot));
  const [suggestions, tasks] = await Promise.all([
    editable ? agendaSuggestions(id) : null,
    listTasks(user, { view: "all" }).then((t) => t.filter((x) => x.meetingId === id)),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={meetingTitle(meeting)}
          description={`${formatDateLong(meeting.startsAt)}, ${formatTimeShort(meeting.startsAt)} Uhr · ${MEETING_FORMAT_LABELS[meeting.format]}`}
        />
        <MeetingStatusBadge status={meeting.status} />
      </div>

      {meeting.status === "ABGESAGT" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Diese Sitzung wurde abgesagt.{meeting.cancelReason ? ` Grund: ${meeting.cancelReason}` : ""}</AlertDescription>
        </Alert>
      ) : null}
      {meeting.isRepeatAfterNoQuorum ? (
        <Alert className="mb-4">
          <AlertDescription>
            Erneute Sitzung nach Beschlussunfähigkeit – in jedem Fall beschlussfähig (LV-Satzung § 52 Abs. 3).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 flex flex-col gap-1 text-sm">
        {meeting.location ? <div>Ort: {meeting.location}</div> : null}
        {meeting.onlineUrl ? (
          <div>
            Online:{" "}
            <a href={meeting.onlineUrl} className="text-akzent-dunkel underline" target="_blank" rel="noopener noreferrer">
              {meeting.onlineUrl}
            </a>
          </div>
        ) : null}
        {meeting.responseDeadline ? <div>Rückmeldung bis {formatDate(meeting.responseDeadline)}</div> : null}
        {meeting.invitationSentAt ? <div>Einladung versendet am {formatDate(meeting.invitationSentAt)}</div> : null}
        {meeting.urgent ? <div>Eilbedürftig: {meeting.urgencyReason}</div> : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {manage && !isMeetingLocked(meeting) ? (
          <>
            <Button asChild variant="outline">
              <Link href={`/meetings/${id}/edit`}>Bearbeiten</Link>
            </Button>
            <Button asChild>
              <Link href={`/meetings/${id}/invitation`}>{meeting.invitationSentAt ? "Einladung ansehen" : "Einladung vorbereiten"}</Link>
            </Button>
            {meeting.status !== "DURCHGEFUEHRT" ? (
              <CancelMeetingDialog action={cancelMeetingAction.bind(null, id)} invited={!!meeting.invitationSentAt} />
            ) : null}
          </>
        ) : null}
        {meeting.status !== "ABGESAGT" ? (
          <Button asChild variant="outline">
            <Link href={`/meetings/${id}/minutes`}>Protokoll</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 font-semibold">Tagesordnung</h2>
            <AgendaEditor meetingId={id} items={tree} editable={editable} canDelete={meeting.status === "GEPLANT"} />
          </section>

          {suggestions && (suggestions.proposals.length || suggestions.carryOvers.length) ? (
            <Card>
              <CardHeader>
                <CardTitle>Vorschläge für die Tagesordnung</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {suggestions.proposals.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-neutral-600">
                        TO-Vorschlag von {p.proposedBy?.name ?? "–"}
                        {p.isConveneRequest ? ` · Antrag auf Einberufung (${p._count.supporters + 1} Unterstützer)` : ""}
                      </div>
                    </div>
                    <ActionForm action={acceptProposalAction.bind(null, id, p.id)} showErrorInline={false}>
                      <SubmitButton size="sm" variant="secondary">
                        Übernehmen
                      </SubmitButton>
                    </ActionForm>
                  </div>
                ))}
                {suggestions.carryOvers.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-neutral-600">
                        {c.status === "VERTAGT" ? "vertagt" : "abgesetzt"} in der Sitzung vom {formatDate(c.meeting.startsAt)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <ActionForm action={takeOverCarryOverAction.bind(null, id, c.id)} showErrorInline={false}>
                        <SubmitButton size="sm" variant="secondary">
                          Übernehmen
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={dismissCarryOverAction.bind(null, id, c.id)} showErrorInline={false}>
                        <SubmitButton size="sm" variant="ghost">
                          Nicht mehr vorschlagen
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </div>
                ))}
                <Link href="/meetings/proposals" className="text-sm text-akzent-dunkel underline">
                  Alle TO-Vorschläge
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <section>
            <h2 className="mb-2 font-semibold">Aufgaben aus dieser Sitzung</h2>
            <TaskList tasks={tasks} empty="Noch keine." />
          </section>
        </div>

        {/* Auf dem Handy stehen Zu-/Absage und Rückmeldungen vor der Tagesordnung */}
        <div className="order-first flex flex-col gap-4 lg:order-none">
          {mine && upcoming ? (
            <Card>
              <CardHeader>
                <CardTitle>Ihre Teilnahme</CardTitle>
              </CardHeader>
              <CardContent>
                <RsvpButtons action={respondAction.bind(null, id)} current={mine.response} note={mine.note} />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Rückmeldungen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {(["ZUGESAGT", "VIELLEICHT", "ABGESAGT", "OFFEN"] as const).map((r) => {
                const list = byResponse(r);
                return (
                  <div key={r}>
                    <div className="mb-1 flex items-center gap-2">
                      <RsvpBadge response={r} /> <span className="text-neutral-600">{list.length}</span>
                    </div>
                    <div className="text-neutral-700">{list.map((a) => a.nameSnapshot).join(", ") || "–"}</div>
                  </div>
                );
              })}
              {meeting.attendances.some((a) => a.note) ? (
                <div className="border-t pt-3">
                  <p className="mb-1 font-semibold text-rhoendorf">Nachrichten zur Rückmeldung</p>
                  <ul className="flex flex-col gap-2">
                    {meeting.attendances
                      .filter((a) => a.note)
                      .map((a) => (
                        <li key={a.id}>
                          <span className="font-medium">{a.nameSnapshot}</span> <RsvpBadge response={a.response} />
                          <p className="whitespace-pre-wrap font-serif text-rhoendorf/80">„{a.note}“</p>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
