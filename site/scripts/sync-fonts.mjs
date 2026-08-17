/**
 * Kopiert die benötigten Schriftdateien aus den fontsource-Paketen nach
 * public/fonts. Die Schriften werden selbst gehostet, damit die Seite ohne
 * Einwilligung keine Anfrage an Google stellt — Begründung in
 * src/styles/fonts.css.
 *
 * Redesign v2 (Swiss/Editorial): EB Garamond (variable, Display) + Lato
 * (statisch 400/700, Fließtext). Lato existiert nicht in 500/600 — Gewichte
 * dazwischen würden synthetisch gerendert und sind deshalb im Token-System
 * auf 400/700 beschränkt.
 *
 * Nur nötig, wenn die fontsource-Pakete aktualisiert wurden.
 */
import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(root, "public/fonts");

const ebg = resolve(root, "node_modules/@fontsource-variable/eb-garamond/files");
const lato = resolve(root, "node_modules/@fontsource/lato/files");

const files = [
  [`${ebg}/eb-garamond-latin-wght-normal.woff2`, "eb-garamond-latin.woff2"],
  [`${ebg}/eb-garamond-latin-ext-wght-normal.woff2`, "eb-garamond-latin-ext.woff2"],
  ...[400, 700].flatMap((w) => [
    [`${lato}/lato-latin-${w}-normal.woff2`, `lato-latin-${w}.woff2`],
    [`${lato}/lato-latin-ext-${w}-normal.woff2`, `lato-latin-ext-${w}.woff2`],
  ]),
];

mkdirSync(out, { recursive: true });

// Alte Familien entfernen, damit keine toten Dateien mit ausgeliefert werden.
for (const alt of readdirSync(out)) {
  if (/^(plus-jakarta-sans|be-vietnam-pro)/.test(alt)) unlinkSync(resolve(out, alt));
}

for (const [from, name] of files) {
  copyFileSync(from, resolve(out, name));
}

console.log(`${files.length} Schriftdateien nach public/fonts kopiert`);
