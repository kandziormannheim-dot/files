import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

// next/font lädt Inter beim Build und liefert sie selbst aus (keine Anfragen an Google zur Laufzeit).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "OV-Management", template: "%s · OV-Management" },
  description: "Vorstandsarbeit der CDU Seckenheim-Friedrichsfeld",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#52b7c1" };

export default function RootLayout({ children }: { children: ReactNode }) {
  // Rollen kommen mit Paket 1.2 (Auth); bis dahin ist der Admin-Bereich ausgeblendet.
  const isAdmin = false;
  return (
    <html lang="de" className={inter.variable}>
      <body>
        <AppShell isAdmin={isAdmin}>{children}</AppShell>
      </body>
    </html>
  );
}
