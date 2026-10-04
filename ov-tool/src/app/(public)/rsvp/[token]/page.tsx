import type { Metadata } from "next";
import { RsvpButtons } from "@/components/meetings/rsvp-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateLong, formatTimeShort } from "@/lib/dates";
import { RSVP_LABELS, isRsvpOpen, meetingTitle } from "@/lib/meetings";
import { getAttendanceByToken } from "@/server/services/meetings";
import { respondByTokenAction } from "./actions";

export const metadata: Metadata = { title: "Zu- oder Absage" };

// Persönlicher Link aus der Einladungsmail – funktioniert ohne Login (SPEC.md 3.2 Punkt 5).
export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const att = await getAttendanceByToken(token);
  if (!att) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link ungültig</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">Bitte verwenden Sie den Link aus der aktuellen Einladung.</CardContent>
      </Card>
    );
  }
  const m = att.meeting;
  const open = isRsvpOpen(m);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{meetingTitle(m)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>
          {formatDateLong(m.startsAt)}, {formatTimeShort(m.startsAt)} Uhr
          {m.location ? <><br />{m.location}</> : null}
        </p>
        <p>
          Hallo {att.user.name}, Ihre Rückmeldung: <strong>{RSVP_LABELS[att.response]}</strong>
          {m.responseDeadline ? ` (erbeten bis ${formatDate(m.responseDeadline)})` : ""}
        </p>
        {open ? (
          <RsvpButtons action={respondByTokenAction.bind(null, token)} current={att.response} />
        ) : (
          <p className="text-neutral-600">{m.status === "ABGESAGT" ? "Die Sitzung wurde abgesagt." : "Rückmeldungen sind nicht mehr möglich."}</p>
        )}
      </CardContent>
    </Card>
  );
}
