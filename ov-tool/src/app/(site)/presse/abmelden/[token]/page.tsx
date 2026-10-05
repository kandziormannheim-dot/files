import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { unsubscribeContact } from "@/server/services/press";

export const metadata: Metadata = { title: "Abmelden", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ergebnis?: string }> }) {
  const { token } = await params;
  const { ergebnis } = await searchParams;
  async function unsubscribe() {
    "use server";
    const ok = await unsubscribeContact(token);
    redirect(`/presse/abmelden/${token}?ergebnis=${ok ? "ok" : "ungueltig"}`);
  }
  if (ergebnis) {
    return (
      <Alert variant={ergebnis === "ok" ? "success" : "warning"}>
        <AlertDescription className="text-base">
          {ergebnis === "ok" ? "Sie wurden aus dem Presseverteiler abgemeldet." : "Dieser Abmeldelink ist ungültig."}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <form action={unsubscribe} className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-extrabold text-rhoendorf">Vom Presseverteiler abmelden</h1>
      <p>Sie erhalten danach keine Pressemitteilungen mehr von uns.</p>
      <Button type="submit" size="lg">
        Abmelden
      </Button>
    </form>
  );
}
