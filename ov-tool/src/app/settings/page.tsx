import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Einstellungen" };

export default function Page() {
  return <PageHeader title="Einstellungen" description="Vorlagen, Fristen und Nutzerverwaltung." />;
}
