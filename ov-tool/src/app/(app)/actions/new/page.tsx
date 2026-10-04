import type { Metadata } from "next";
import { CampaignActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { requirePageCapability } from "@/server/auth/session";
import { createActionAction } from "../actions";

export const metadata: Metadata = { title: "Aktion anlegen" };

export default async function NewActionPage() {
  await requirePageCapability("action.create");
  return (
    <>
      <PageHeader title="Aktion anlegen" />
      <CampaignActionForm action={createActionAction} />
    </>
  );
}
