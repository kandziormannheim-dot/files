import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";

// Alles unterhalb von (app) erfordert eine Anmeldung.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell isAdmin={can(user.role, "settings.manage")} isBbr={user.isBbr} user={{ name: user.name, email: user.email }}>
      {children}
    </AppShell>
  );
}
