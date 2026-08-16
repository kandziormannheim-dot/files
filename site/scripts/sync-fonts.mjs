/**
 * Kopiert die benötigten Schriftdateien aus den fontsource-Paketen nach
 * public/fonts. Die Schriften werden selbst gehostet, damit die Seite ohne
 * Einwilligung keine Anfrage an Google stellt — Begründung in
 * src/styles/fonts.css.
 *
 * Nur nötig, wenn die fontsource-Pakete aktualisiert wurden.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(root, "public/fonts");

const pjs = resolve(root, "node_modules/@fontsource-variable/plus-jakarta-sans/files");
const bvp = resolve(root, "node_modules/@fontsource/be-vietnam-pro/files");

/** Be Vietnam Pro wird bewusst auf 400 und 600 beschränkt — siehe fonts.css. */
const weights = [400, 600];

const files = [
  [`${pjs}/plus-jakarta-sans-latin-wght-normal.woff2`, "plus-jakarta-sans-latin.woff2"],
  [`${pjs}/plus-jakarta-sans-latin-ext-wght-normal.woff2`, "plus-jakarta-sans-latin-ext.woff2"],
  ...weights.flatMap((w) => [
    [`${bvp}/be-vietnam-pro-latin-${w}-normal.woff2`, `be-vietnam-pro-latin-${w}.woff2`],
    [`${bvp}/be-vietnam-pro-latin-ext-${w}-normal.woff2`, `be-vietnam-pro-latin-ext-${w}.woff2`],
  ]),
];

mkdirSync(out, { recursive: true });
for (const [from, name] of files) {
  copyFileSync(from, resolve(out, name));
}

console.log(`${files.length} Schriftdateien nach public/fonts kopiert`);
