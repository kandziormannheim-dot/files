import "server-only";
import type { User } from "@prisma/client";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { auth } from "./auth";
import { assertCan, can, type Capability } from "./permissions";

export { assertCan };

export type CurrentUser = User;

/** Angemeldeter, aktiver Nutzer – je Request nur einmal aus der DB gelesen. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !user.active || !user.loginEnabled) return null;
  return user;
});

/** Für Seiten und Server Actions: ohne Login zur Anmeldung. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireCapability(capability: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, capability);
  return user;
}

/** Für Seiten: ohne Recht auf die Hinweisseite statt einer Fehlermeldung. */
export async function requirePageCapability(capability: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect("/no-access");
  return user;
}
