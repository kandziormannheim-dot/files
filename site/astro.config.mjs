// @ts-check
import { defineConfig } from "astro/config";

/**
 * kandzior.de — statische Ausgabe, hosting-neutral.
 *
 * Die Seite wird vollständig zur Bauzeit erzeugt und läuft damit auf jedem
 * Hoster, der Dateien ausliefert. Der Hoster steht noch nicht fest (offener
 * Punkt 6 im Brief); diese Konfiguration legt sich auf keinen fest.
 *
 * `site` wird für kanonische URLs, hreflang und die Sitemap gebraucht und
 * muss vor dem Livegang auf die echte Domain zeigen.
 */
export default defineConfig({
  site: "https://kandzior.de",
  output: "static",
  trailingSlash: "ignore",
  build: {
    // Erzeugt /impressum.html statt /impressum/index.html — funktioniert auf
    // einfachen Hostern ohne Rewrite-Regeln zuverlaessiger.
    format: "file",
    inlineStylesheets: "auto",
  },
  compressHTML: true,
  devToolbar: {
    enabled: false,
  },
});
