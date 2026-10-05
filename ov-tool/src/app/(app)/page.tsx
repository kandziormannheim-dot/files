import type { Metadata } from "next";
import Link from "next/link";
import { MeetingStatusBadge, RsvpBadge } from "@/components/meetings/meeting-badges";
import { PageHeader } from "@/components/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateLong, formatTimeShort } from "@/lib/dates";
import { ACTION_TYPE_LABELS, TOPIC_STATUS_LABELS } from "@/lib/labels";
import { meetingTitle } from "@/lib/meetings";
import { requireUser } from "@/server/auth/session";
import { dashboardData } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "Übersicht" };

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await dashboardData(user);
  const more = (href: string, label = "Alle") => (
    <Link href={href} className="text-sm font-normal text-akzent-dunkel hover:underline">
      {label}
    </Link>
  );
  return (
    <>
      <PageHeader title={`Hallo ${user.name.split(" ")[0]}`} />
      {d.notices.length ? (
        <div className="mb-6 flex flex-col gap-2">
          {d.notices.map((n) => (
            <Alert key={n.text} variant={n.level}>
              <AlertDescription>
                <Link href={n.href} className="hover:underline">
                  {n.text}
                </Link>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}
      {/* Mobile-first: Aufgaben und Termine stehen oben */}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Meine offenen Aufgaben ({d.taskCount})</CardTitle>
            {more("/tasks")}
          </CardHeader>
          <CardContent>
            <TaskList tasks={d.tasks} empty="Keine offenen Aufgaben – sehr gut." />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Nächste Sitzung</CardTitle>
              {more("/meetings")}
            </CardHeader>
            <CardContent className="text-sm">
              {d.nextMeeting ? (
                <Link href={`/meetings/${d.nextMeeting.id}`} className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{meetingTitle(d.nextMeeting)}</span>
                    <MeetingStatusBadge status={d.nextMeeting.status} />
                  </div>
                  <div className="mt-1 text-neutral-600">
                    {formatDateLong(d.nextMeeting.startsAt)}, {formatTimeShort(d.nextMeeting.startsAt)} Uhr
                    {d.nextMeeting.location ? ` · ${d.nextMeeting.location}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {d.nextMeeting.myResponse ? <RsvpBadge response={d.nextMeeting.myResponse} /> : null}
                    <span className="text-xs text-neutral-600">
                      {d.nextMeeting.counts.ZUGESAGT} Zusagen · {d.nextMeeting.counts.VIELLEICHT} vielleicht · {d.nextMeeting.counts.ABGESAGT} Absagen · {d.nextMeeting.counts.OFFEN} offen
                      {d.nextMeeting.invitationSentAt ? ` · eingeladen am ${formatDate(d.nextMeeting.invitationSentAt)}` : " · noch nicht eingeladen"}
                    </span>
                  </div>
                </Link>
              ) : (
                <p className="text-neutral-600">Keine Sitzung geplant.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Aktionen und Termine</CardTitle>
              {more("/actions")}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {d.actions.map((a) => (
                  <li key={a.id}>
                    <Link href={`/actions/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 hover:underline">
                      <span>
                        {formatDate(a.startsAt)} · {ACTION_TYPE_LABELS[a.type]}: {a.title}
                      </span>
                      <span className="flex gap-1">
                        {a.mine ? <Badge variant="success">dabei</Badge> : null}
                        {a.open ? <Badge variant="warning">{a.open} Helfer gesucht</Badge> : null}
                      </span>
                    </Link>
                  </li>
                ))}
                {d.actions.length === 0 ? <li className="text-neutral-600">Keine anstehenden Aktionen.</li> : null}
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Zuletzt geänderte Themen</CardTitle>
            {more("/topics")}
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {d.topics.map((t) => (
                <li key={t.id}>
                  <Link href={`/topics/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 hover:underline">
                    <span>{t.title}</span>
                    <span className="flex gap-1">
                      {t.forNextMeeting ? <Badge variant="warning">nächste Sitzung</Badge> : null}
                      <Badge variant="secondary">{TOPIC_STATUS_LABELS[t.status]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
              {d.topics.length === 0 ? <li className="text-neutral-600">Noch keine Themen.</li> : null}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Schnellzugriff</CardTitle>
            {more("/links", "Alle Links")}
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {d.links.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-akzent-dunkel hover:underline">
                    {l.title}
                  </a>
                </li>
              ))}
              {d.links.length === 0 ? <li className="text-neutral-600">Noch keine Links.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
