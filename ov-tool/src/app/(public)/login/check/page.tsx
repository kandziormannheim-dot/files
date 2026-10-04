import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "E-Mail prüfen" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Bitte prüfen Sie Ihr Postfach</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Wenn die Adresse für das OV-Management freigeschaltet ist, haben wir Ihnen einen Anmeldelink geschickt. Er ist
          15 Minuten gültig und funktioniert nur einmal.
        </p>
        <p className="text-neutral-600">Keine E-Mail erhalten? Bitte auch den Spam-Ordner prüfen oder den Admin fragen.</p>
      </CardContent>
    </Card>
  );
}
