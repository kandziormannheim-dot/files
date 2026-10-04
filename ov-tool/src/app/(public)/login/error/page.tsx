import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Anmeldung fehlgeschlagen" };

const MESSAGES: Record<string, string> = {
  Verification: "Der Anmeldelink ist abgelaufen oder wurde bereits verwendet.",
  AccessDenied: "Für diese Adresse ist kein Zugang freigeschaltet.",
};

export default async function LoginErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Anmeldung fehlgeschlagen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{MESSAGES[error ?? ""] ?? "Die Anmeldung hat nicht funktioniert."}</p>
        <Link href="/login" className="text-akzent-dunkel underline">
          Neuen Anmeldelink anfordern
        </Link>
      </CardContent>
    </Card>
  );
}
