import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageCapability } from "@/server/auth/session";
import { aiConfigured } from "@/server/services/ai-draft";
import { createReleaseAction } from "../actions";
import { ReleaseForm } from "../release-form";

export const metadata: Metadata = { title: "Neue Pressemitteilung" };

export default async function NewReleasePage() {
  await requirePageCapability("press.create");
  return (
    <>
      <PageHeader title="Neue Pressemitteilung" description="Entwurf → Freigabe durch den Vorsitz → Veröffentlichung im Portal und Versand an den Verteiler." />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ReleaseForm action={createReleaseAction} aiEnabled={aiConfigured()} />
        </CardContent>
      </Card>
    </>
  );
}
