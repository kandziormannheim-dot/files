import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Links" };

export default function Page() {
  return <PageHeader title="Links" description="Link-Hub zu CDUplus, Webseiten und Social Media." />;
}
