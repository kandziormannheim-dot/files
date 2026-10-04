import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Themen" };

export default function Page() {
  return <PageHeader title="Themen" description="Stadtteil-Themen und Bürgeranliegen." />;
}
