import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageCapability } from "@/server/auth/session";
import { createClaimAction } from "../actions";
import { ClaimForm } from "../claim-form";

export const metadata: Metadata = { title: "Neue Auslage" };

export default async function NewExpensePage() {
  const user = await requirePageCapability("expense.create");
  return (
    <>
      <PageHeader title="Neue Auslagenerstattung" description="Name, Anschrift und E-Mail des Mitglieds eintragen – im nächsten Schritt folgen die Belege." />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ClaimForm action={createClaimAction} defaultHolder={user.name} defaultEmail={user.email} isNew />
        </CardContent>
      </Card>
    </>
  );
}
