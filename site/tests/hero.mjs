import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// --- Die harte Bedingung aus C1: alles auf 375x667 ohne Scrollen ----------
{
  const p = await b.newPage({ viewport: { width: 375, height: 667 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const m = await p.evaluate(() => {
    const g = (s) => document.querySelector(s).getBoundingClientRect();
    return {
      heroUnterkante: Math.round(g(".hero").bottom),
      ctaUnterkante: Math.round(g(".hero__actions").bottom),
      portraitHoehe: Math.round(g(".portrait").height),
      nameOberkante: Math.round(g(".hero__name").top),
      fenster: window.innerHeight,
      seite: document.documentElement.scrollHeight,
      querScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  console.log("    375x667:", JSON.stringify(m));
  ok(m.ctaUnterkante <= 667, `Anfrage-Knopf sichtbar bei ${m.ctaUnterkante}px (Grenze 667)`);
  ok(m.heroUnterkante <= 667, `Hero endet bei ${m.heroUnterkante}px (Grenze 667)`);
  ok(!m.querScroll, "kein horizontales Scrollen");
  await p.close();
}

// --- Weitere Breiten: nie horizontal scrollen ----------------------------
for (const w of [320, 375, 768, 1024, 1280, 1920]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const over = await p.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  ok(!over, `${w}px: kein horizontales Scrollen`);
  await p.close();
}

// --- Ruhebewegung: laeuft normal, ruht bei Bewegungsreduktion ------------
for (const [motion, sollLaufen] of [
  ["no-preference", true],
  ["reduce", false],
]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.emulateMedia({ reducedMotion: motion === "reduce" ? "reduce" : "no-preference" });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const anim = await p.evaluate(() => {
    const el = document.querySelector(".portrait--cutout .portrait__placeholder, .portrait--cutout .portrait__image");
    const cs = getComputedStyle(el);
    return { name: cs.animationName, dauer: cs.animationDuration };
  });
  const laeuft = anim.name !== "none" && anim.dauer !== "0s";
  ok(laeuft === sollLaufen, `${motion}: Bewegung ${laeuft ? "laeuft" : "ruht"} (${anim.name}, ${anim.dauer})`);
  await p.close();
}

// --- Reihenfolge fuer Tastatur bleibt gleich, obwohl das Bild wandert -----
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const order = await p.evaluate(() => {
    const grid = document.querySelector(".hero__grid");
    return Array.from(grid.children).map((el) => el.className.split(" ")[0]);
  });
  ok(
    order[0] === "hero__portrait" && order[1] === "hero__text",
    `Markup-Reihenfolge unveraendert -> ${order.join(", ")}`,
  );
  const portraitLinks = await p.evaluate(() => {
    const pr = document.querySelector(".hero__portrait").getBoundingClientRect();
    const tx = document.querySelector(".hero__text").getBoundingClientRect();
    return pr.left > tx.left;
  });
  ok(portraitLinks, "Portrait steht auf Desktop optisch rechts vom Text");
  await p.close();
}

// --- Das echte Portrait: beschrieben, geladen, freigestellt --------------
// Seit 2026-08-19 liegt der Freisteller vor: keine runde Maske mehr —
// die Transparenz der Datei ist die Silhouette über dem Neon-Schein.
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const bild = await p.evaluate(() => {
    const el = document.querySelector(".portrait--cutout .portrait__image");
    return (
      el && {
        alt: el.getAttribute("alt"),
        geladen: el.naturalWidth > 0,
        quelle: el.currentSrc,
        rund: getComputedStyle(el).borderRadius,
      }
    );
  });
  ok(!!bild && !!bild.alt, `Portrait trägt Alt-Text -> "${bild && bild.alt}"`);
  ok(!!bild && bild.geladen, "Portraitdatei wird geladen");
  ok(
    !!bild && bild.quelle.includes("portrait-freigestellt"),
    `Freisteller ist die Quelle -> ${bild && bild.quelle.split("/").pop()}`,
  );
  ok(!!bild && bild.rund === "0px", `keine Maske mehr -> ${bild && bild.rund}`);
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
