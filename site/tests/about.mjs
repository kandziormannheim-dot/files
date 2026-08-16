import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// --- Lesebreite: die Kernbedingung der Aufgabe ---------------------------
for (const [w, min, max] of [
  [375, 32, 80],
  [768, 45, 80],
  [1280, 45, 80],
  [1920, 45, 80],
]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const zeichen = await p.evaluate(() => {
    const el = document.querySelector(".about__prose p");
    const bereich = document.createRange();
    bereich.selectNodeContents(el);
    return Math.round(
      el.textContent.trim().length / Math.max(bereich.getClientRects().length, 1),
    );
  });
  const grenze = await p.evaluate(() => {
    const el = document.querySelector(".about__prose");
    return {
      breite: Math.round(el.getBoundingClientRect().width),
      maxWidth: getComputedStyle(el).maxWidth,
    };
  });
  ok(
    zeichen >= min && zeichen <= max,
    `${w}px: ${zeichen} Zeichen pro Zeile (erwartet ${min}-${max}, Spalte ${grenze.breite}px)`,
  );
  await p.close();
}

// --- Saubere Bildkante in beiden Themes ---------------------------------
for (const theme of ["light", "dark"]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, theme);
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const kante = await p.evaluate(() => {
    const el = document.querySelector(
      ".portrait--full .portrait__image, .portrait--full .portrait__placeholder",
    );
    const cs = getComputedStyle(el);
    return {
      rahmenbreite: cs.borderTopWidth,
      rahmenfarbe: cs.borderTopColor,
      radius: cs.borderTopLeftRadius,
      schatten: cs.boxShadow !== "none",
    };
  });
  ok(
    parseFloat(kante.rahmenbreite) > 0 && kante.radius !== "0px",
    `${theme}: Kante definiert — Rahmen ${kante.rahmenbreite} ${kante.rahmenfarbe}, Radius ${kante.radius}`,
  );
  ok(kante.schatten, `${theme}: Schatten vorhanden`);
  await p.close();
}

// --- Ort im Fließtext, nicht nur im Bild --------------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const text = await p.textContent(".about__prose");
  ok(/Mannheim/.test(text), "Mannheim steht im Fliesstext der Biografie");

  const untertitel = await p.textContent(".portrait--full .portrait__caption");
  ok(/Wasserturm/.test(untertitel), `Bildunterschrift -> ${untertitel.trim()}`);

  const figure = await p.evaluate(() =>
    document.querySelector(".portrait--full").tagName.toLowerCase(),
  );
  const cap = await p.evaluate(() =>
    document.querySelector(".portrait__caption").tagName.toLowerCase(),
  );
  ok(figure === "figure" && cap === "figcaption", `Bild als <${figure}> mit <${cap}>`);

  const ich = await p.textContent(".about__prose");
  ok(/\bIch\b/.test(ich), "Biografie in erster Person");
  await p.close();
}

// --- Bild links, im Hero rechts: Rhythmus statt Wiederholung -------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const seiten = await p.evaluate(() => {
    const l = (s) => document.querySelector(s).getBoundingClientRect().left;
    return {
      heroBildLinks: l(".hero__portrait") > l(".hero__text"),
      aboutBildLinks: l(".about__media") < l(".about__text"),
    };
  });
  ok(
    seiten.heroBildLinks && seiten.aboutBildLinks,
    "Hero: Bild rechts, Über mich: Bild links",
  );
  await p.close();
}

// --- Reihenfolge und Breiten --------------------------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  // Relative Reihenfolge statt vollstaendiger Liste: Sonst bricht der Test
  // bei jedem neuen Bereich, obwohl nichts kaputt ist.
  const reihenfolge = await p.$$eval("main > section", (els) => els.map((e) => e.id));
  const folgt = (a, bb) =>
    reihenfolge.indexOf(a) !== -1 &&
    reihenfolge.indexOf(bb) !== -1 &&
    reihenfolge.indexOf(a) < reihenfolge.indexOf(bb);
  ok(
    folgt("hero", "proof") && folgt("outlook", "about"),
    `Reihenfolge -> ${reihenfolge.join(" → ")}`,
  );
  const ebenen = await p.$$eval("h1, h2, h3", (els) => els.map((e) => Number(e.tagName[1])));
  let luecke = false;
  for (let i = 1; i < ebenen.length; i++) if (ebenen[i] - ebenen[i - 1] > 1) luecke = true;
  ok(!luecke, `Überschriftenebenen ohne Sprung -> ${ebenen.join(" ")}`);
  await p.close();
}

for (const w of [320, 375, 768, 1280, 1920]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const quer = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!quer, `${w}px: kein horizontales Scrollen`);
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
