import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prefillChoice, prefillText, type SearchValue } from "@/lib/prefill";
import { requirePageCapability } from "@/server/auth/session";
import { createProjectAction } from "../actions";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Neues Video" };

type Search = Record<"title" | "topic" | "message" | "callToAction" | "account", SearchValue>;

export default async function NewVideoPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePageCapability("marketing.create");
  const sp = await searchParams;
  const initial = {
    title: prefillText(sp.title, 150),
    topic: prefillText(sp.topic, 4000),
    message: prefillText(sp.message, 300),
    callToAction: prefillText(sp.callToAction, 120),
    account: prefillChoice(sp.account, ["OV", "BBR"] as const, "OV"),
  };
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
          <ProjectForm action={createProjectAction} initial={initial} submitLabel="Weiter zum Hochladen" />
        </CardContent>
      </Card>
    </>
  );
}
