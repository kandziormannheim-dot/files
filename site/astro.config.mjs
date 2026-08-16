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
    // Jede Route wird ein Verzeichnis mit index.html: /en/index.html,
    // /impressum/index.html. Das liefert jeder statische Hoster korrekt aus,
    // ohne Rewrite-Regeln. Die Alternative "file" erzeugt /en.html — und ein
    // Aufruf von /en/ liefe dort ins Leere. Da der Hoster noch nicht
    // feststeht, gilt die Variante, die nirgends Annahmen macht.
    format: "directory",
    inlineStylesheets: "auto",
  },
  compressHTML: true,
  devToolbar: {
    enabled: false,
  },
});
