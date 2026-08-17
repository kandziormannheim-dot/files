// Erzeugt das Open-Graph-Vorschaubild (1200x630) aus den Design-Tokens der
// Seite — v3 „Neon Flow": Nachtgrund, Neon-Pink/Violett, Space Grotesk.
// Eine saubere typografische Karte altert besser als ein schlecht
// beschnittenes Foto.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fonts = resolve(here, "../../../../home/user/files/site/public/fonts");

const html = `<!doctype html><html><head><style>
  @font-face {
    font-family: "Space Grotesk";
    src: url("http://127.0.0.1:4321/fonts/space-grotesk-latin.woff2") format("woff2-variations");
    font-weight: 300 700;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #08080f;
    font-family: "Space Grotesk", sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 84px;
    position: relative; overflow: hidden;
  }
  .glow {
    position: absolute; right: -220px; top: -220px;
    width: 640px; height: 640px; border-radius: 50%;
    background: radial-gradient(circle, rgba(249,103,251,.28) 0%, rgba(105,88,213,.14) 45%, transparent 70%);
  }
  .glow2 {
    position: absolute; left: -260px; bottom: -300px;
    width: 700px; height: 700px; border-radius: 50%;
    background: radial-gradient(circle, rgba(105,88,213,.22) 0%, rgba(105,88,213,.08) 45%, transparent 70%);
  }
  .mark {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 24px; font-weight: 400; letter-spacing: .16em;
    color: #a1a1bd; text-transform: uppercase;
  }
  .mark b { font-weight: 700; color: #f4f4f8; }
  .name { font-size: 96px; font-weight: 700; letter-spacing: -0.02em; color: #f4f4f8; line-height: 1.02; }
  .line { width: 120px; height: 5px; background: linear-gradient(90deg, #f967fb, #6958d5); border-radius: 3px; margin: 36px 0; }
  .positioning { font-size: 40px; font-weight: 500; letter-spacing: 0; color: #c3c3d9; max-width: 20ch; line-height: 1.3; }
  .foot { display: flex; justify-content: space-between; align-items: baseline; }
  .city { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 24px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #f967fb; }
  .domain { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 24px; font-weight: 400; color: #8f8fac; }
</style></head><body>
  <div class="glow"></div>\n  <div class="glow2"></div>
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
