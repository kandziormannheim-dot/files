import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageCapability } from "@/server/auth/session";
import { createProjectAction } from "../actions";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Neues Video" };

export default async function NewVideoPage() {
  await requirePageCapability("marketing.create");
  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/marketing/videos" className="underline">
          ← Videos
        </Link>
      </div>
      <PageHeader title="Neues Video" description="Erst die Eckdaten, danach die Clips hochladen. Geschnitten wird automatisch, sobald alle Clips da sind." />
      <Card>
        <CardContent className="pt-6">
          <ProjectForm action={createProjectAction} submitLabel="Weiter zum Hochladen" />
        </CardContent>
      </Card>
    </>
  );
}
