import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/400-italic.css";
import "@fontsource/ibm-plex-serif/600.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OV-Management", template: "%s · OV-Management" },
  description: "Vorstandsarbeit der CDU Seckenheim-Friedrichsfeld",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#52b7c1" }; // Cadenabbia-Türkis

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
