import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { readStoredFile, storedFileExists } from "@/server/files";
import { ovContext } from "@/server/ov";
import { getSettings } from "@/server/services/settings";
import { renderHtml } from "@/server/templates/engine";
import { TEMPLATES_DIR } from "@/server/templates/files";
import { getTemplateSource } from "@/server/templates/store";

// HTML-Vorlage → PDF über Chromium (SPEC.md 5). Der Briefbogen liegt als Hintergrundbild auf jeder Seite,
// das Seitenraster hält Kopf und Fuß frei (Kommentar in templates/briefbogen.css).

let browserPromise: Promise<Browser> | null = null;

function executablePath(): string | undefined {
  return process.env.CHROMIUM_PATH || undefined;
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.isConnected()) return b;
  }
  browserPromise = chromium.launch({ executablePath: executablePath(), args: [
      "--no-sandbox",
      "--font-render-hinting=none",
      // keine Verbindungen nach außen (Datenschutz, Offline-Betrieb)
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-domain-reliability",
      "--disable-sync",
      "--no-first-run",
      "--no-pings",
    ] });
  return browserPromise;
}

async function fontFaceCss(): Promise<string> {
  const dir = path.join(TEMPLATES_DIR, "assets", "fonts");
  const face = async (file: string, style: string, range: string) => {
    const data = (await readFile(path.join(dir, file))).toString("base64");
    return `@font-face{font-family:"Inter";font-style:${style};font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${range};}`;
  };
  const latin = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  const latinExt = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
  return [
    await face("inter-latin-wght-normal.woff2", "normal", latin),
    await face("inter-latin-ext-wght-normal.woff2", "normal", latinExt),
    await face("inter-latin-wght-italic.woff2", "italic", latin),
  ].join("\n");
}

async function briefbogenDataUri(): Promise<string> {
  const s = await getSettings();
  const custom = s.briefbogenPath && (await storedFileExists(s.briefbogenPath)) ? await readStoredFile(s.briefbogenPath) : null;
  const data = custom ?? (await readFile(path.join(TEMPLATES_DIR, "assets", "briefbogen.png")));
  return `data:image/png;base64,${data.toString("base64")}`;
}

/** Komplettes HTML-Dokument um den Inhalt einer Dokument-Vorlage. */
export async function wrapDocument(contentHtml: string, title: string): Promise<string> {
  const css = (await readFile(path.join(TEMPLATES_DIR, "briefbogen.css"), "utf8"))
    // Keine externen Schriften laden (Datenschutz, Offline-Rendering) – Inter ist eingebettet.
    .replace(/@import\s+url\([^)]*\)\s*;?/g, "");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
<style>${await fontFaceCss()}\n${css}</style></head><body>
<div class="briefbogen-hintergrund" style="background-image:url(${await briefbogenDataUri()})"></div>
<table class="seite"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot>
<tbody><tr><td>
${contentHtml}
</td></tr></tbody></table></body></html>`;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

/** Rendert eine Dokument-Vorlage (einladung.dokument, protokoll.dokument) zu PDF. */
export async function renderDocumentPdf(key: string, context: object, title: string) {
  const { source, version } = await getTemplateSource(key);
  const html = await wrapDocument(renderHtml(source, { ov: await ovContext(), ...context }), title);
  return { pdf: await htmlToPdf(html), html, version };
}

export async function closePdfBrowser() {
  const b = await browserPromise?.catch(() => null);
  browserPromise = null;
  await b?.close();
}
