import type { Metadata } from "next";
import Link from "next/link";
import { MeetingStatusBadge, RsvpBadge } from "@/components/meetings/meeting-badges";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateLong, formatTimeShort } from "@/lib/dates";
import { MEETING_FORMAT_LABELS, meetingTitle } from "@/lib/meetings";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listMeetings, meetingRhythmData } from "@/server/services/meetings";
import { meetingRhythm } from "@/server/services/statute";

export const metadata: Metadata = { title: "Sitzungen" };

export default async function MeetingsPage() {
  const user = await requireUser();
  const [{ upcoming, past }, rhythmData] = await Promise.all([listMeetings(user), meetingRhythmData()]);
  const rhythm = meetingRhythm(rhythmData.last?.startsAt ?? null, !!rhythmData.next, new Date());

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Sitzungen" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/circulations">Umlaufbeschlüsse</Link>
          </Button>
          {can(user.role, "agenda.propose") ? (
            <Button asChild variant="outline">
              <Link href="/meetings/proposals">TO-Vorschläge</Link>
            </Button>
          ) : null}
          {can(user.role, "meeting.manage") ? (
            <Button asChild>
              <Link href="/meetings/new">Sitzung anlegen</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {rhythm?.warn ? (
        <Alert variant={rhythm.overdue ? "destructive" : "warning"} className="mb-6">
          <AlertTitle>{rhythm.overdue ? "Sitzungsrhythmus überschritten" : "Nächste Sitzung planen"}</AlertTitle>
          <AlertDescription>
            Der Vorstand tagt mindestens alle zwei Monate (LV-Satzung § 37 Abs. 3 i. V. m. § 31 Abs. 3). Letzte Sitzung:{" "}
            {formatDate(rhythmData.last!.startsAt)} – spätestens bis {formatDate(rhythm.dueBy)} sollte die nächste stattfinden.
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="mb-8">
        <h2 className="mb-2 font-semibold">Anstehend</h2>
        {upcoming.length === 0 ? <p className="text-sm text-neutral-600">Keine Sitzung geplant.</p> : null}
        <ul className="flex flex-col gap-2">
          {upcoming.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`} className="block rounded-lg border bg-white p-3 hover:border-akzent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{meetingTitle(m)}</span>
                  <span className="flex gap-1">
                    {m.attendances[0] ? <RsvpBadge response={m.attendances[0].response} /> : null}
                    <MeetingStatusBadge status={m.status} />
                  </span>
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  {formatDateLong(m.startsAt)}, {formatTimeShort(m.startsAt)} Uhr · {MEETING_FORMAT_LABELS[m.format]}
                  {m.location ? ` · ${m.location}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Vergangen</h2>
        <ul className="flex flex-col divide-y rounded-lg border bg-white">
          {past.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-neutral-50">
                <span>
                  {formatDate(m.startsAt)} · {meetingTitle(m)}
                </span>
                <span className="flex gap-1">
                  {m.minutes[0] ? (
                    <span className="text-xs text-neutral-600">Protokoll: {m.minutes[0].status.toLowerCase()}</span>
                  ) : null}
                  <MeetingStatusBadge status={m.status} />
                </span>
              </Link>
            </li>
          ))}
          {past.length === 0 ? <li className="p-3 text-sm text-neutral-600">Noch keine.</li> : null}
        </ul>
      </section>
    </>
  );
}
