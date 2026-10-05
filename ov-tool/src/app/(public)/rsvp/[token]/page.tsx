import type { Metadata } from "next";
import { CalendarPlus, Clock, MapPin, Video } from "lucide-react";
import { RsvpButtons } from "@/components/meetings/rsvp-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { numberAgenda } from "@/lib/agenda";
import { formatDate, formatDateLong, formatTimeShort } from "@/lib/dates";
import { RSVP_LABELS, isRsvpOpen, meetingTitle } from "@/lib/meetings";
import { getAttendanceByToken } from "@/server/services/meetings";
import { respondByTokenAction } from "./actions";

export const metadata: Metadata = { title: "Rückmeldung zur Sitzung", robots: { index: false, follow: false } };

const PRESELECT: Record<string, "ZUGESAGT" | "VIELLEICHT" | "ABGESAGT"> = {
  ja: "ZUGESAGT",
  zusage: "ZUGESAGT",
  vielleicht: "VIELLEICHT",
  nein: "ABGESAGT",
  absage: "ABGESAGT",
};

// Persönliche Rückmeldeseite aus der Einladungsmail – ohne Login (SPEC.md 3.2 Punkt 5).
// Die Links in der Mail wählen die Antwort nur vor; gespeichert wird erst per Klick (Link-Scanner der Mailprogramme sollen nichts auslösen).
export default async function RsvpPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ antwort?: string }> }) {
  const { token } = await params;
  const { antwort } = await searchParams;
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
  const agenda = numberAgenda(m.agendaItems);
  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="bg-rhoendorf px-5 py-4 text-white">
          <p className="font-serif text-sm text-white/80">Einladung</p>
          <h2 className="text-xl font-extrabold leading-tight tracking-[-0.01em] text-white sm:text-2xl">{meetingTitle(m)}</h2>
        </div>
        <CardContent className="flex flex-col gap-2 pt-4 text-sm">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-cadenabbia" aria-hidden />
            <span>
              {formatDateLong(m.startsAt)}, {formatTimeShort(m.startsAt)} Uhr
            </span>
          </p>
          {m.location ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-cadenabbia" aria-hidden />
              <a className="underline decoration-cadenabbia underline-offset-2" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(m.location)}`} target="_blank" rel="noopener noreferrer">
                {m.location}
              </a>
            </p>
          ) : null}
          {m.onlineUrl ? (
            <p className="flex items-start gap-2">
              <Video className="mt-0.5 size-4 shrink-0 text-cadenabbia" aria-hidden />
              <a className="break-all underline decoration-cadenabbia underline-offset-2" href={m.onlineUrl} target="_blank" rel="noopener noreferrer">
                Online teilnehmen
              </a>
            </p>
          ) : null}
          <a href={`/api/rsvp/${token}/ics`} className="mt-1 inline-flex items-center gap-2 self-start text-rhoendorf underline decoration-cadenabbia underline-offset-2">
            <CalendarPlus className="size-4" aria-hidden /> In meinen Kalender
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hallo {att.user.name}, sind Sie dabei?</CardTitle>
          <p className="font-serif text-sm text-rhoendorf/80">
            {att.response === "OFFEN" ? "Noch keine Rückmeldung." : `Ihre bisherige Rückmeldung: ${RSVP_LABELS[att.response]}.`}
            {m.responseDeadline ? ` Erbeten bis ${formatDate(m.responseDeadline)}.` : ""}
          </p>
        </CardHeader>
        <CardContent>
          {open ? (
            <RsvpButtons
              action={respondByTokenAction.bind(null, token)}
              current={att.response}
              initial={antwort ? PRESELECT[antwort.toLowerCase()] : undefined}
              note={att.note}
              large
            />
          ) : (
            <p className="text-sm text-rhoendorf-60">{m.status === "ABGESAGT" ? "Die Sitzung wurde abgesagt." : "Rückmeldungen sind nicht mehr möglich."}</p>
          )}
        </CardContent>
      </Card>

      {agenda.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tagesordnung</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-1 text-sm">
              {agenda.map((i) => (
                <li key={i.id} className={i.level ? "pl-6 text-rhoendorf/80" : ""}>
                  <span className="inline-block w-12 font-semibold text-rhoendorf">TOP {i.number}</span> {i.title}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
