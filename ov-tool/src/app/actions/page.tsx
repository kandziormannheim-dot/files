import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Aktionen" };

export default function Page() {
  return <PageHeader title="Aktionen" description="Infostände, Plakataktionen, Veranstaltungen und Helferschichten." />;
}
