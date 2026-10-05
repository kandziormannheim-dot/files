import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageCapability } from "@/server/auth/session";
import { createPageAction } from "../actions";
import { PageForm } from "../page-form";

export const metadata: Metadata = { title: "Neue Landing Page" };

export default async function NewLandingPage() {
  await requirePageCapability("landing.edit");
  return (
    <>
      <PageHeader title="Neue Landing Page" description="CDU-CI, ohne Tracker, Impressum und Datenschutz werden automatisch verlinkt." />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <PageForm action={createPageAction} />
        </CardContent>
      </Card>
    </>
  );
}
