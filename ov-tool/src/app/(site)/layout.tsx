import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = {
  title: { default: "CDU Seckenheim-Friedrichsfeld", template: "%s · CDU Seckenheim-Friedrichsfeld" },
  robots: { index: true, follow: true },
};

// Öffentliche Seiten (Landing Pages, Presseportal) im CDU-CI – ohne Tracker, ohne Cookies, mit Impressum/Datenschutz.
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-dvh flex-col bg-white text-union-schwarz">
      <header className="border-b-4 border-cadenabbia bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <a href="https://www.cdu-sf.de/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cdu-logo.svg" alt="CDU" className="h-10 w-auto" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-rhoendorf">{settings.ov.name}</span>
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
      <footer className="bg-rhoendorf text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 text-sm">
          <span className="font-semibold">CDU {settings.ov.name}</span>
          <a href={settings.publicSite.imprintUrl} className="underline-offset-2 hover:underline">
            Impressum
          </a>
          <a href={settings.publicSite.privacyUrl} className="underline-offset-2 hover:underline">
            Datenschutz
          </a>
          <Link href="/presse" className="underline-offset-2 hover:underline">
            Presse
          </Link>
        </div>
      </footer>
    </div>
  );
}
