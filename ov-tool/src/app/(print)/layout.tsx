import type { ReactNode } from "react";
import { requireUser } from "@/server/auth/session";

// Druckansichten ohne Navigation – Anmeldung erforderlich.
export default async function PrintLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return <div className="min-h-dvh bg-white">{children}</div>;
}
