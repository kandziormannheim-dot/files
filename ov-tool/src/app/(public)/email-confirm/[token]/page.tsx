import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmEmailAction } from "./actions";

export const metadata: Metadata = { title: "E-Mail-Adresse bestätigen" };

// Bestätigung per Knopfdruck statt beim Aufruf: Link-Scanner von Mailprogrammen sollen den Link nicht verbrauchen.
export default async function EmailConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === "ok" || token === "invalid") {
    const ok = token === "ok";
    return (
      <Card>
        <CardHeader>
          <CardTitle>{ok ? "E-Mail-Adresse geändert" : "Link ungültig"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            {ok
              ? "Ihre neue Adresse ist ab sofort hinterlegt. Bitte melden Sie sich künftig damit an."
              : "Der Link ist abgelaufen, wurde bereits verwendet oder die Adresse ist inzwischen vergeben. Bitte beantragen Sie die Änderung im Profil erneut."}
          </p>
          <Link href="/login" className="underline">
            Zur Anmeldung
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Neue E-Mail-Adresse bestätigen</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>Mit dem Klick wird Ihre E-Mail-Adresse im OV-Management-Tool geändert.</p>
        <form action={confirmEmailAction.bind(null, token)}>
          <Button type="submit">Adresse jetzt ändern</Button>
        </form>
      </CardContent>
    </Card>
  );
}
