import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Aufgaben" };

export default function Page() {
  return <PageHeader title="Aufgaben" description="Aufgaben mit Verantwortlichen und Fristen." />;
}
