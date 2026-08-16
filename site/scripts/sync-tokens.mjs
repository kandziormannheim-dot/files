/**
 * Kopiert die Token-Datei aus dem Design-Ordner in das Astro-Projekt.
 *
 * Quelle der Wahrheit ist .design/kandzior-de/DESIGN_TOKENS.css — das ist die
 * Datei, die in Phase 4 des Design-Flows entstanden ist und in der Änderungen
 * vorgenommen werden. src/styles/tokens.css ist eine Kopie und wird bei jedem
 * Build überschrieben.
 *
 * Läuft automatisch vor `npm run build`.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../.design/kandzior-de/DESIGN_TOKENS.css");
const target = resolve(here, "../src/styles/tokens.css");

const banner = `/* ERZEUGTE DATEI — NICHT HIER BEARBEITEN.
   Quelle: .design/kandzior-de/DESIGN_TOKENS.css
   Neu erzeugen mit: npm run sync:tokens
*/\n`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, banner + readFileSync(source, "utf8"));

console.log("tokens.css aus .design/kandzior-de/DESIGN_TOKENS.css erzeugt");
