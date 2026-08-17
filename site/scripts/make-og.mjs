// Erzeugt das Open-Graph-Vorschaubild (1200x630) aus den Design-Tokens der
// Seite — Nachtblau, Teal-Akzent, Plus Jakarta Sans. Kein Foto: Das Portrait
// liegt noch nicht vor, und eine saubere typografische Karte altert besser
// als ein schlecht beschnittenes Bild.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fonts = resolve(here, "../../../../home/user/files/site/public/fonts");

const html = `<!doctype html><html><head><style>
  @font-face {
    font-family: "EB Garamond";
    src: url("http://127.0.0.1:4321/fonts/eb-garamond-latin.woff2") format("woff2-variations");
    font-weight: 200 800;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #0f172a;
    font-family: "EB Garamond", serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 84px;
    position: relative; overflow: hidden;
  }
  .glow {
    position: absolute; right: -220px; top: -220px;
    width: 640px; height: 640px; border-radius: 50%;
    background: radial-gradient(circle, rgba(202,138,4,.30) 0%, rgba(202,138,4,.10) 45%, transparent 70%);
  }
  .mark {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 24px; font-weight: 400; letter-spacing: .16em;
    color: #94a3b8; text-transform: uppercase;
  }
  .mark b { font-weight: 700; color: #f8fafc; }
  .name { font-size: 96px; font-weight: 700; letter-spacing: -0.01em; color: #f8fafc; line-height: 1.05; }
  .line { width: 96px; height: 5px; background: #eab308; border-radius: 0; margin: 36px 0; }
  .positioning { font-size: 40px; font-weight: 500; letter-spacing: 0; color: #cbd5e1; max-width: 20ch; line-height: 1.3; }
  .foot { display: flex; justify-content: space-between; align-items: baseline; }
  .city { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 24px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #eab308; }
  .domain { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 24px; font-weight: 400; color: #64748b; }
</style></head><body>
  <div class="glow"></div>
  <div class="mark">Martin <b>Kandzior</b></div>
  <div>
    <div class="name">Logistik, Risiko<br>und Politik.</div>
    <div class="line"></div>
    <div class="positioning">Dort, wo sich die drei überschneiden.</div>
  </div>
  <div class="foot"><span class="city">Mannheim</span><span class="domain">kandzior.de</span></div>
</body></html>`;

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto("http://127.0.0.1:4321/404.html", { waitUntil: "domcontentloaded" });
await p.setContent(html, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
await p.screenshot({
  path: "/home/user/files/site/public/assets/og.png",
  type: "png",
});
await b.close();
console.log("og.png erzeugt");
