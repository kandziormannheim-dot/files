import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { aiConfigured } from "@/server/services/ai-draft";
import { StatuteBrowser } from "./statute-browser";

export const metadata: Metadata = { title: "Satzung" };

export default async function StatutePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  return (
    <>
      <PageHeader
        title="Satzung"
        description="Statut der CDU Deutschlands und Satzung der CDU Baden-Württemberg – Suche nach Stichwort oder Fundstelle (z. B. „LV § 57“), auch offline."
      />
      <StatuteBrowser initialQuery={q ?? ""} canAsk={can(user.role, "statute.ask")} aiEnabled={aiConfigured()} />
    </>
  );
}
