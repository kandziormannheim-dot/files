import type { MeetingStatus, RsvpResponse } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { MEETING_STATUS_LABELS, RSVP_LABELS } from "@/lib/meetings";

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const variant =
    status === "EINGELADEN" ? "default" : status === "DURCHGEFUEHRT" ? "success" : status === "GEPLANT" ? "secondary" : "destructive";
  return <Badge variant={variant}>{MEETING_STATUS_LABELS[status]}</Badge>;
}

export function RsvpBadge({ response }: { response: RsvpResponse }) {
  const variant = response === "ZUGESAGT" ? "success" : response === "ABGESAGT" ? "secondary" : response === "VIELLEICHT" ? "default" : "warning";
  return <Badge variant={variant}>{RSVP_LABELS[response]}</Badge>;
}
