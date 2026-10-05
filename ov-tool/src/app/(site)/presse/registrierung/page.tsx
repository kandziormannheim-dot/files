import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Presseverteiler" };

export default async function PressRegisterPage() {
  const settings = await getSettings();
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl font-extrabold tracking-[-0.01em] text-rhoendorf">Presseverteiler</h1>
      <p className="font-serif text-lg text-rhoendorf">
        Für Journalistinnen und Journalisten: Pressemitteilungen der CDU {settings.ov.name} direkt per E-Mail. Nach der Bestätigung Ihrer E-Mail-Adresse prüfen wir
        die Registrierung kurz.
      </p>
      <RegisterForm privacyUrl={settings.publicSite.privacyUrl} />
    </div>
  );
}
