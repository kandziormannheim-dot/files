import type { Metadata } from "next";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { PageHeader } from "@/components/page-header";
import { requirePageCapability } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import { createMeetingAction } from "../actions";

export const metadata: Metadata = { title: "Sitzung anlegen" };

export default async function NewMeetingPage() {
  await requirePageCapability("meeting.manage");
  const s = await getSettings();
  return (
    <>
      <PageHeader
        title="Sitzung anlegen"
        description="Die Tagesordnung wird aus der Standardvorlage vorbelegt (inkl. Protokollgenehmigung, überfälliger Aufgaben und Stadtteil-Themen)."
      />
      <MeetingForm
        action={createMeetingAction}
        defaultLocation={s.meeting.defaultLocation}
        responseDaysBefore={s.meeting.responseDaysBefore}
        noticeDays={s.meeting.noticeDays}
      />
    </>
  );
}
