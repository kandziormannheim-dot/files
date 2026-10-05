import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { confirmContact } from "@/server/services/press";

export const metadata: Metadata = { title: "Registrierung bestätigen", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PressConfirmPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ergebnis?: string }> }) {
  const { token } = await params;
  const { ergebnis } = await searchParams;
  async function confirm() {
    "use server";
    const ok = await confirmContact(token);
    redirect(`/presse/bestaetigen/${token}?ergebnis=${ok ? "ok" : "ungueltig"}`);
  }
  if (ergebnis) {
    return (
      <Alert variant={ergebnis === "ok" ? "success" : "warning"}>
        <AlertDescription className="text-base">
          {ergebnis === "ok"
            ? "Danke – Ihre E-Mail-Adresse ist bestätigt. Wir prüfen die Registrierung und nehmen Sie anschließend in den Presseverteiler auf."
            : "Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet."}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <form action={confirm} className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-extrabold text-rhoendorf">Registrierung bestätigen</h1>
      <p>Bitte bestätigen Sie mit einem Klick Ihre Aufnahme in den Presseverteiler.</p>
      <Button type="submit" size="lg">
        Jetzt bestätigen
      </Button>
    </form>
  );
}
