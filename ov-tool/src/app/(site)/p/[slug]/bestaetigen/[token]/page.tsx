import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { confirmNewsletter } from "@/server/services/landing";

export const metadata: Metadata = { title: "Bestätigung", robots: { index: false } };
export const dynamic = "force-dynamic";

// Bestätigung per Knopfdruck, damit Link-Scanner in Mailprogrammen nicht automatisch bestätigen
export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ ergebnis?: string }> }) {
  const { slug, token } = await params;
  const { ergebnis } = await searchParams;
  async function confirm() {
    "use server";
    const ok = await confirmNewsletter(token);
    redirect(`/p/${slug}/bestaetigen/${token}?ergebnis=${ok ? "ok" : "ungueltig"}`);
  }
  if (ergebnis) {
    return (
      <Alert variant={ergebnis === "ok" ? "success" : "warning"}>
        <AlertDescription className="text-base">
          {ergebnis === "ok" ? "Danke – Ihre Anmeldung zum Newsletter ist bestätigt." : "Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet."}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <form action={confirm} className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-extrabold text-rhoendorf">Newsletter-Anmeldung bestätigen</h1>
      <p>Bitte bestätigen Sie mit einem Klick, dass Sie den Newsletter erhalten möchten.</p>
      <Button type="submit" size="lg">
        Jetzt bestätigen
      </Button>
    </form>
  );
}
