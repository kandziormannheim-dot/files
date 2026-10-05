"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { email as emailSchema, formToObject, z } from "@/lib/validation";
import { runAction } from "@/server/action";
import { signIn, signOut } from "@/server/auth/auth";
import { UserError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";

const loginSchema = z.object({
  email: emailSchema,
  from: z.string().optional(),
});

/** Anmeldelink anfordern. Rate-Limit je Adresse und je IP (SPEC.md Abschnitt 6). */
export async function requestLoginLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const { email, from } = loginSchema.parse(formToObject(formData));
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unbekannt";
    const okEmail = rateLimit(`login:email:${email}`, 3, 15 * 60_000);
    const okIp = rateLimit(`login:ip:${ip}`, 10, 15 * 60_000);
    if (!okEmail || !okIp) throw new UserError("Zu viele Anmeldeversuche. Bitte in einigen Minuten erneut versuchen.");
    const redirectTo = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
    // redirect: false – sonst leitet Auth.js über eine API-Route um, was nach einer Server Action hängen bleibt
    await signIn("email", { email, redirectTo, redirect: false });
  });
  if (result?.ok) redirect("/login/check");
  return result;
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

/** Anmeldung über die CDU-Cloud (Nextcloud) – leitet zur Cloud weiter. */
export async function loginWithCloud(formData: FormData) {
  const from = String(formData.get("from") ?? "");
  const redirectTo = from.startsWith("/") && !from.startsWith("//") ? from : "/";
  await signIn("nextcloud", { redirectTo });
}
