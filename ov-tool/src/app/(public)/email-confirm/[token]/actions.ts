"use server";

import { redirect } from "next/navigation";
import { confirmEmailChange } from "@/server/services/users";

export async function confirmEmailAction(token: string) {
  const ok = await confirmEmailChange(token);
  redirect(ok ? "/email-confirm/ok" : "/email-confirm/invalid");
}
