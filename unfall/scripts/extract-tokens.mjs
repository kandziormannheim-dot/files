#!/usr/bin/env node
/**
 * Liest die CSS von sv-rettinger.de und leitet daraus Design-Tokens ab.
 *
 * Erzeugt:
 *   src/styles/tokens.css        — CSS-Variablen (Farben, Schriften, Buttons, Radien)
 *   .design/brand-extract.json   — Rohbefund zum Nachprüfen (alle Fundstellen mit Häufigkeit,
 *                                  interne Links der Hauptseite für die Leistungs-Detailseiten)
 *
 * Aufruf aus unfall/:  node scripts/extract-tokens.mjs [--site https://sv-rettinger.de]
 * Node >= 20 (fetch eingebaut). Hinter einem Proxy: NODE_USE_ENV_PROXY=1 setzen.
 *
 * Es wird nichts erfunden: Werte, die nicht gefunden werden, bleiben als
 * "unbekannt" markiert und müssen von Hand nachgetragen werden.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const argSite = process.argv.indexOf("--site");
const SITE = (argSite > -1 ? process.argv[argSite + 1] : "https://sv-rettinger.de").replace(/\/$/, "");
const UA = "Mozilla/5.0 (compatible; unfall-tokens/1.0)";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  return res.text();
}

const decode = (s) => s.replace(/&#0?38;|&amp;/g, "&").replace(/&quot;/g, '"');

// ---------------------------------------------------------------------------
// 1. Startseite laden, Stylesheets und Inline-Styles einsammeln
// ---------------------------------------------------------------------------
const html = await fetchText(SITE + "/");
const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
const styleHrefs = linkTags
  .filter((t) => /rel=["'][^"']*stylesheet/i.test(t))
  .map((t) => (t.match(/href=["']([^"']+)["']/i) || [])[1])
  .filter(Boolean)
  .map((h) => new URL(decode(h), SITE + "/").href);

const googleFontFamilies = new Set();
for (const href of styleHrefs) {
  if (!/fonts\.googleapis\.com/.test(href)) continue;
  const u = new URL(href);
  for (const fam of u.searchParams.getAll("family")) {
    fam.split("|").forEach((f) => googleFontFamilies.add(decodeURIComponent(f.split(":")[0]).replace(/\+/g, " ")));
  }
}

const cssSources = [];
for (const href of styleHrefs) {
  if (/fonts\.googleapis\.com/.test(href)) continue;
  try {
    cssSources.push({ url: href, css: await fetchText(href) });
  } catch (e) {
    console.warn("übersprungen:", href, e.message);
  }
}
for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
  cssSources.push({ url: "inline <style>", css: m[1] });
}
const allCss = cssSources.map((s) => s.css).join("\n");

// ---------------------------------------------------------------------------
// 2. Hilfsfunktionen
// ---------------------------------------------------------------------------
const count = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n }));
const norm = (v) => v.replace(/!important/g, "").trim().replace(/\s+/g, " ");
const first = (list) => (list.length ? list[0].value : "unbekannt");

/** Zerlegt CSS grob in { selector, decls } — reicht für Elementor-/Theme-CSS. */
function parseRules(css) {
  const out = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const selector = m[1].trim();
    if (selector.startsWith("@")) continue; // @font-face, @keyframes, @media-Kopf
    const decls = {};
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      decls[d.slice(0, i).trim().toLowerCase()] = norm(d.slice(i + 1));
    }
    out.push({ selector, decls });
  }
  return out;
}
const rules = parseRules(allCss);

// ---------------------------------------------------------------------------
// 3. Fundstellen
// ---------------------------------------------------------------------------
// 3a. Elementor-Globals (Farben, Typografie) – der verlässlichste Ort für die Markenpalette
const globals = {};
for (const m of allCss.matchAll(/(--e-global-(?:color|typography)-[\w-]+)\s*:\s*([^;}]+)/g)) {
  globals[m[1]] = norm(m[2]);
}

// 3b. Schriftfamilien nach Häufigkeit; getrennt für Überschriften und Fließtext
const fontAll = new Map(), fontHeading = new Map(), fontBody = new Map();
for (const r of rules) {
  const ff = r.decls["font-family"];
  if (!ff) continue;
  count(fontAll, ff);
  if (/\bh[1-6]\b|heading|title/i.test(r.selector)) count(fontHeading, ff);
  if (/^(html|body|p)\b|\bbody\b|\.elementor-widget-text-editor/i.test(r.selector)) count(fontBody, ff);
}

// 3c. Buttons: Elementor-Button, Theme-Buttons, Formular-Submit
const btn = { background: new Map(), color: new Map(), radius: new Map(), padding: new Map(), weight: new Map(), transform: new Map(), size: new Map(), font: new Map() };
for (const r of rules) {
  if (!/\.elementor-button(?!-wrapper)|\bbutton\b|\.btn\b|\.wp-block-button__link|input\[type=["']?submit/i.test(r.selector)) continue;
  const d = r.decls;
  if (d["background-color"] || d.background) count(btn.background, d["background-color"] || d.background);
  if (d.color) count(btn.color, d.color);
  if (d["border-radius"]) count(btn.radius, d["border-radius"]);
  if (d.padding) count(btn.padding, d.padding);
  if (d["font-weight"]) count(btn.weight, d["font-weight"]);
  if (d["text-transform"]) count(btn.transform, d["text-transform"]);
  if (d["font-size"]) count(btn.size, d["font-size"]);
  if (d["font-family"]) count(btn.font, d["font-family"]);
}

// 3d. Alle Border-Radius-Werte (Karten, Bilder, Felder)
const radii = new Map();
for (const r of rules) if (r.decls["border-radius"]) count(radii, r.decls["border-radius"]);

// 3e. Farben insgesamt (Hex/rgb) nach Häufigkeit – Plausibilitätskontrolle für die Globals
const colors = new Map();
for (const m of allCss.matchAll(/#(?:[0-9a-f]{3}){1,2}\b|rgba?\([^)]+\)/gi)) count(colors, m[0].toLowerCase());

// 3f. Interne Links der Startseite → Kandidaten für die Leistungs-Detailseiten
const links = new Map();
for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
  const href = new URL(decode(m[1]), SITE + "/").href;
  if (!href.startsWith(SITE)) continue;
  const label = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (label && !links.has(href)) links.set(href, label);
}

// ---------------------------------------------------------------------------
// 4. Tokens ableiten
// ---------------------------------------------------------------------------
const g = (k) => globals[`--e-global-color-${k}`] || "unbekannt";
const typo = (k) => globals[`--e-global-typography-${k}-font-family`];
const headingFont = typo("primary") || first(sorted(fontHeading)) || first(sorted(fontAll));
const bodyFont = typo("text") || first(sorted(fontBody)) || first(sorted(fontAll));
// die drei häufigsten Radien, danach numerisch sortiert (klein → groß)
const px = (v) => parseFloat(v) * (/em$/.test(v) ? 16 : 1);
const radiiTop = sorted(radii)
  .map((x) => x.value)
  .filter((v) => !/^0(px)?$/.test(v) && !/50%|999/.test(v))
  .slice(0, 3)
  .sort((a, b) => px(a) - px(b));

const tokens = `/* ==========================================================================
   Rettinger & Kollegen — Design-Tokens für unfall.sv-rettinger.de
   ERZEUGT von scripts/extract-tokens.mjs aus der CSS von ${SITE}
   am ${new Date().toISOString().slice(0, 10)}. Nichts davon ist erfunden; "unbekannt"
   heißt: in der CSS nicht gefunden, von Hand aus .design/brand-extract.json nachtragen.
   ========================================================================== */

:root {
  /* Farben — Elementor Global Colors der Hauptseite */
  --color-primary:   ${g("primary")};
  --color-secondary: ${g("secondary")};
  --color-text:      ${g("text")};
  --color-accent:    ${g("accent")};
${Object.entries(globals)
  .filter(([k]) => k.startsWith("--e-global-color-") && !/-(primary|secondary|text|accent)$/.test(k))
  .map(([k, v]) => `  --brand-${k.replace("--e-global-color-", "")}: ${v};`)
  .join("\n")}
  --color-bg:        #ffffff; /* Seitengrund; nur ändern, wenn die Hauptseite abweicht */

  /* Schriftfamilien */
  --font-heading: ${headingFont};
  --font-body:    ${bodyFont};

  /* Buttons — .elementor-button der Hauptseite */
  --btn-bg:        ${first(sorted(btn.background))};
  --btn-text:      ${first(sorted(btn.color))};
  --btn-radius:    ${first(sorted(btn.radius))};
  --btn-padding:   ${first(sorted(btn.padding))};
  --btn-weight:    ${first(sorted(btn.weight))};
  --btn-transform: ${first(sorted(btn.transform))};
  --btn-font:      ${first(sorted(btn.font))};

  /* Eckenradien — die drei häufigsten Werte der Hauptseite, klein → groß */
  --radius-sm: ${radiiTop[0] ?? "unbekannt"};
  --radius-md: ${radiiTop[1] ?? radiiTop[0] ?? "unbekannt"};
  --radius-lg: ${radiiTop[2] ?? radiiTop[1] ?? radiiTop[0] ?? "unbekannt"};
}
`;

const report = {
  site: SITE,
  extractedAt: new Date().toISOString(),
  stylesheets: styleHrefs,
  googleFontFamilies: [...googleFontFamilies],
  elementorGlobals: globals,
  fontsAll: sorted(fontAll),
  fontsHeading: sorted(fontHeading),
  fontsBody: sorted(fontBody),
  buttons: Object.fromEntries(Object.entries(btn).map(([k, v]) => [k, sorted(v)])),
  borderRadii: sorted(radii),
  colorsByFrequency: sorted(colors).slice(0, 40),
  internalLinks: [...links.entries()].map(([href, label]) => ({ href, label })),
};

mkdirSync(resolve(root, "src/styles"), { recursive: true });
mkdirSync(resolve(root, ".design"), { recursive: true });
writeFileSync(resolve(root, "src/styles/tokens.css"), tokens);
writeFileSync(resolve(root, ".design/brand-extract.json"), JSON.stringify(report, null, 2));

console.log(tokens);
console.log(`Rohbefund: .design/brand-extract.json (${cssSources.length} CSS-Quellen, ${rules.length} Regeln, ${links.size} interne Links)`);
if (googleFontFamilies.size) console.log("Google Fonts auf der Hauptseite:", [...googleFontFamilies].join(", "));
