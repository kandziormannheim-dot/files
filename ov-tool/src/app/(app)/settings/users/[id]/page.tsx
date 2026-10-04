import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requirePageCapability } from "@/server/auth/session";
import { getUser } from "@/server/services/users";
import { resendAccessMailAction, updateUserAction } from "../actions";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "Nutzer bearbeiten" };

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  const actor = await requirePageCapability("users.manage");
  const { id } = await params;
  const { neu } = await searchParams;
  const user = await getUser(actor, id);
  return (
    <>
      <PageHeader title={user.name} description={user.email} />
      {neu ? (
        <Alert variant="success" className="mb-4">
          <AlertDescription>Nutzer wurde angelegt.</AlertDescription>
        </Alert>
      ) : null}
      <UserForm action={updateUserAction.bind(null, id)} user={user} />
      {user.active && user.loginEnabled ? (
        <ActionForm action={resendAccessMailAction.bind(null, id)} className="mt-8 border-t pt-6">
          <SubmitButton variant="outline" pendingText="Wird gesendet …">
            Zugangsmail erneut senden
          </SubmitButton>
        </ActionForm>
      ) : null}
    </>
  );
}
