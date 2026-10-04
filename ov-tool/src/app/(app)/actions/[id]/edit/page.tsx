import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CampaignActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/server/auth/session";
import { canEditAction, getAction } from "@/server/services/actions";
import { deleteActionAction, updateActionAction } from "../../actions";

export const metadata: Metadata = { title: "Aktion bearbeiten" };

export default async function EditActionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const action = await getAction(user, id);
  if (!canEditAction(user, action)) redirect("/no-access");
  return (
    <>
      <PageHeader title="Aktion bearbeiten" />
      <CampaignActionForm action={updateActionAction.bind(null, id)} value={action} />
      <ActionForm action={deleteActionAction.bind(null, id)} className="mt-8 border-t pt-6">
        <ConfirmSubmit variant="destructive" confirm="Aktion mit allen Schichten löschen?">
          Aktion löschen
        </ConfirmSubmit>
      </ActionForm>
    </>
  );
}
