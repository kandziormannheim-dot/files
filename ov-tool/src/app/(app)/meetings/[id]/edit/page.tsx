import type { Metadata } from "next";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { PageHeader } from "@/components/page-header";
import { requirePageCapability } from "@/server/auth/session";
import { getMeeting } from "@/server/services/meetings";
import { getSettings } from "@/server/services/settings";
import { updateMeetingAction } from "../../actions";

export const metadata: Metadata = { title: "Sitzung bearbeiten" };

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageCapability("meeting.manage");
  const { id } = await params;
  const [meeting, s] = await Promise.all([getMeeting(user, id), getSettings()]);
  return (
    <>
      <PageHeader title="Sitzung bearbeiten" />
      <MeetingForm
        action={updateMeetingAction.bind(null, id)}
        meeting={meeting}
        defaultLocation={s.meeting.defaultLocation}
        responseDaysBefore={s.meeting.responseDaysBefore}
        noticeDays={s.meeting.noticeDays}
      />
    </>
  );
}
