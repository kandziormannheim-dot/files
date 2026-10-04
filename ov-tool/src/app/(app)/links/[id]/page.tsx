import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/server/auth/session";
import { canEditLink, getLink } from "@/server/services/links";
import { deleteLinkAction, updateLinkAction } from "../actions";
import { LinkForm } from "../link-form";

export const metadata: Metadata = { title: "Link bearbeiten" };

export default async function EditLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const link = await getLink(user, id);
  if (!canEditLink(user, link)) redirect("/no-access");
  return (
    <>
      <PageHeader title="Link bearbeiten" />
      <LinkForm action={updateLinkAction.bind(null, id)} link={link} />
      <ActionForm action={deleteLinkAction.bind(null, id)} className="mt-8 border-t pt-6">
        <ConfirmSubmit variant="destructive" confirm={`„${link.title}“ wirklich löschen?`} pendingText="Wird gelöscht …">
          Link löschen
        </ConfirmSubmit>
      </ActionForm>
    </>
  );
}
