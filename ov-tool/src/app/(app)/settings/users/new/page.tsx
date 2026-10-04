import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePageCapability } from "@/server/auth/session";
import { createUserAction } from "../actions";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "Nutzer anlegen" };

export default async function NewUserPage() {
  await requirePageCapability("users.manage");
  return (
    <>
      <PageHeader title="Nutzer anlegen" />
      <UserForm action={createUserAction} />
    </>
  );
}
