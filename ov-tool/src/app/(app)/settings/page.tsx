import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageCapability } from "@/server/auth/session";

export const metadata: Metadata = { title: "Einstellungen" };

const SECTIONS = [
  { href: "/settings/general", title: "Allgemein", description: "OV-Daten, Vorsitz, Fristen, Beschlussfähigkeit, Geschäftsstelle, Löschfristen, Briefbogen" },
  { href: "/settings/templates", title: "Vorlagen", description: "Einladungen, Protokoll, Mails, Standard-Tagesordnung, KI-Prompt – versioniert" },
  { href: "/settings/users", title: "Nutzer", description: "Vorstand und Gäste einladen, Rollen, Funktion, Stimmrecht, Zugang entziehen" },
  { href: "/settings/permissions", title: "Rechte", description: "Rechtemanagement: was Schriftführer, Vorstand, Lesezugriff und Gäste dürfen" },
  { href: "/settings/audit", title: "Audit-Log", description: "Wer hat wann was geändert" },
];

export default async function SettingsPage() {
  await requirePageCapability("settings.manage");
  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-akzent">
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
