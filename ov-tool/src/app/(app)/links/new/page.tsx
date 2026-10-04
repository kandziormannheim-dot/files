import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePageCapability } from "@/server/auth/session";
import { createLinkAction } from "../actions";
import { LinkForm } from "../link-form";

export const metadata: Metadata = { title: "Link anlegen" };

export default async function NewLinkPage() {
  await requirePageCapability("link.create");
  return (
    <>
      <PageHeader title="Link anlegen" />
      <LinkForm action={createLinkAction} />
    </>
  );
}
