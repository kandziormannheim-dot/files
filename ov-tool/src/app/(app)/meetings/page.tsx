import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Sitzungen" };

export default function Page() {
  return <PageHeader title="Sitzungen" description="Vorstandssitzungen von der Einladung bis zum genehmigten Protokoll." />;
}
