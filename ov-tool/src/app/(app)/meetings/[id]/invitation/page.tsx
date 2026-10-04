import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { requirePageCapability } from "@/server/auth/session";
import { invitationPreview } from "@/server/services/invitations";
import { sendInvitationAction } from "./actions";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = { title: "Einladung" };

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageCapability("invitation.send");
  const { id } = await params;
  const p = await invitationPreview(user, id);
  const newCount = p.recipients.filter((r) => !r.invitedAt).length;
  const { meeting, deadline } = p;

  return (
    <>
      <PageHeader title="Einladung" description={meetingTitle(meeting)} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/meetings/${id}`}>Zurück zur Sitzung</Link>
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/meetings/${id}/invitation-pdf`} target="_blank" rel="noopener">
            PDF ansehen
          </a>
        </Button>
      </div>

      {meeting.invitationSentAt ? (
        <Alert variant="success" className="mb-4">
          <AlertDescription>Einladung versendet am {formatDateTime(meeting.invitationSentAt)}.</AlertDescription>
        </Alert>
      ) : (
        <Alert variant={deadline.daysLeft < 0 ? "destructive" : deadline.daysLeft <= 2 ? "warning" : "default"} className="mb-4">
          <AlertTitle>Ladungsfrist {deadline.noticeDays} Tage (LV-Satzung § 50 Abs. 3)</AlertTitle>
          <AlertDescription>
            {meeting.isRepeatAfterNoQuorum
              ? "Erneute Einladung nach Beschlussunfähigkeit – Form und Frist sind nicht bindend (LV § 52 Abs. 3)."
              : deadline.daysLeft >= 0
                ? `Die Einladung muss spätestens am ${formatDate(deadline.latestDay)} versendet werden (noch ${deadline.daysLeft} Tage).`
                : `Die Frist ist am ${formatDate(deadline.latestDay)} abgelaufen.${meeting.urgent ? " Versand als eilbedürftig möglich." : " Versand nur als „eilbedürftig“ mit Begründung (Sitzung bearbeiten)."}`}
          </AlertDescription>
        </Alert>
      )}
      {!p.check.ok ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{p.check.reason}</AlertDescription>
        </Alert>
      ) : null}
      {!p.sender.name ? (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>
            Kein Vorsitzender als Absender hinterlegt – es wird Ihr Name verwendet.{" "}
            <Link href="/settings/general" className="underline">
              Einstellungen
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <InvitationForm
          action={sendInvitationAction.bind(null, id)}
          subject={p.subject}
          text={p.text}
          total={p.recipients.length}
          newCount={newCount}
          alreadySent={!!meeting.invitationSentAt}
          disabled={!p.check.ok || p.locked}
        />
        <Card>
          <CardHeader>
            <CardTitle>Empfänger ({p.recipients.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {p.recipients.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {r.name} {r.role === "GAST" ? <span className="text-neutral-500">(Gast)</span> : null}
                  </span>
                  {r.invitedAt ? <Badge variant="success">eingeladen</Badge> : <Badge variant="secondary">neu</Badge>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-600">Alle aktiven Nutzer und Gäste. Die PDF-Einladung hängt an jeder Mail.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
