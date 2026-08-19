import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// --- Zeilenlaenge: der eigentliche Massstab fuer Lesbarkeit --------------
// Auf 375px sind 45 Zeichen bei dieser Schriftgröße physikalisch nicht
// erreichbar — die Grenze gilt dort entsprechend niedriger.
for (const [w, min, max] of [
  [375, 32, 78],
  [768, 45, 78],
  [1024, 45, 78],
  [1280, 45, 78],
  [1920, 45, 78],
]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  // Tatsaechlich gesetzte Zeilen zaehlen statt mit einer Zeichenbreite zu
  // rechnen: Die Ziffer "0" ist deutlich breiter als der Durchschnitt eines
  // Fliesstexts und liefert systematisch zu niedrige Werte.
  const zeichen = await p.evaluate(() => {
    const el = document.querySelector(".pillar__body");
    const bereich = document.createRange();
    bereich.selectNodeContents(el);
    const zeilen = bereich.getClientRects().length;
    const laenge = el.textContent.trim().length;
    return Math.round(laenge / Math.max(zeilen, 1));
  });
  ok(
    zeichen >= min && zeichen <= max,
    `${w}px: ${zeichen} Zeichen pro Zeile (erwartet ${min}-${max})`,
  );
  await p.close();
}

// --- Rasterbruch 1 / 2 / 2 ----------------------------------------------
for (const [w, erwartet] of [
  [375, 1],
  [768, 1],
  [1280, 2],
]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const spalten = await p.evaluate(
    () =>
      getComputedStyle(document.querySelector(".expertise__grid")).gridTemplateColumns.split(
        " ",
      ).length,
  );
  const quer = await p.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  ok(spalten === erwartet, `${w}px: ${spalten} Spalte(n), erwartet ${erwartet}`);
  ok(!quer, `${w}px: kein horizontales Scrollen`);
  await p.close();
}

// --- Hebung bei Hover, und nur bei Zeigergeraeten ------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  // Weiches Scrollen gilt auch fuer programmatisches Scrollen. Playwright
  // berechnet den Mauspunkt waehrend die Seite noch faehrt, der Zeiger landet
  // dort wo die Karte war, und der Test schlaegt in etwa jedem fuenften Lauf
  // grundlos fehl. Fuer die Dauer der Messung hart schalten.
  await p.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  const karte = p.locator(".pillar").first();
  await karte.scrollIntoViewIfNeeded();
  const vorher = await karte.evaluate((el) => ({
    transform: getComputedStyle(el).transform,
    kante: getComputedStyle(el).borderTopColor,
  }));
  await karte.hover();
  // Redesign v3 (Neon): Die Kante wechselt auf Neon-Pink, die Karte hebt
  // um 4px und glueht. Auf den Endwert warten, nicht auf die erste Regung.
  await p
    .waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".pillar")).borderTopColor ===
        "rgb(249, 103, 251)",
      { timeout: 4000 },
    )
    .catch(() => {});
  const nachher = await karte.evaluate((el) => ({
    transform: getComputedStyle(el).transform,
    kante: getComputedStyle(el).borderTopColor,
    glow: getComputedStyle(el).boxShadow !== "none",
  }));
  ok(vorher.transform === "none", `Ruhezustand ohne Verschiebung -> ${vorher.transform}`);
  ok(
    nachher.transform === "matrix(1, 0, 0, 1, 0, -4)",
    `Hover hebt um 4px -> ${nachher.transform}`,
  );
  ok(
    nachher.kante === "rgb(249, 103, 251)" && vorher.kante !== nachher.kante,
    `Kante wechselt auf die Marke -> ${vorher.kante} -> ${nachher.kante}`,
  );
  ok(nachher.glow, "Karte glueht im Hover");
  await p.close();
}

{
  // Beruehrungsgeraet: kein haengender Hover-Zustand
  const ctx = await b.newContext({
    viewport: { width: 375, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const p = await ctx.newPage();
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const regel = await p.evaluate(() => window.matchMedia("(hover: hover)").matches);
  ok(!regel, "Berührungsgerät meldet (hover: hover) = false, Hebung greift nicht");
  await ctx.close();
}

// --- Inhalt und Struktur -------------------------------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  const titel = await p.$$eval(".pillar__title", (els) => els.map((e) => e.textContent.trim()));
  ok(titel.length === 4, `vier Säulen -> ${titel.length}`);
  // Seit dem Säulentausch (M&A -> KI/Robotik/Automatisierung, 2026-08-17)
  // ist „KI" als Kartentitel legitim — nur die HALTUNG „Industrie 5.0"
  // darf weiterhin nicht als Leistung unter den Karten stehen.
  ok(
    !titel.some((t) => /5\.0|Industrie/i.test(t)),
    `Industrie 5.0 steht nicht unter den Karten -> ${JSON.stringify(titel)}`,
  );
  ok(
    titel.some((t) => /KI, Robotik/.test(t)),
    `KI-Säule vorhanden -> ${JSON.stringify(titel)}`,
  );

  const icons = await p.$$eval(".pillar .pillar-icon", (els) =>
    els.map((e) => ({
      versteckt: e.getAttribute("aria-hidden"),
      pfade: e.querySelectorAll("path").length,
    })),
  );
  ok(icons.length === 4, `vier Icons -> ${icons.length}`);
  ok(
    icons.every((i) => i.versteckt === "true" && i.pfade > 0),
    `Icons sind dekorativ ausgezeichnet und gezeichnet -> ${JSON.stringify(icons)}`,
  );

  // Ueberschriftenebenen luecklos: h1 -> h2 -> h3
  const ebenen = await p.$$eval("h1, h2, h3", (els) =>
    els.map((e) => Number(e.tagName[1])),
  );
  let luecke = false;
  for (let i = 1; i < ebenen.length; i++) if (ebenen[i] - ebenen[i - 1] > 1) luecke = true;
  ok(!luecke, `Überschriftenebenen ohne Sprung -> ${ebenen.join(" ")}`);

  // Die Einleitung traegt die Klammer
  const lead = await p.textContent(".expertise__lead");
  ok(lead.length > 60, `Einleitung vorhanden (${lead.length} Zeichen)`);

  // Trennungs-Entscheid (2026-08-18): Wirtschaft und Politik stehen als
  // beschriftete Gruppen getrennt; die Politik-Karte traegt den violetten
  // Zweitakzent statt der Roehren-Verlaufskante.
  const gruppen = await p.$$eval(".expertise__group", (els) =>
    els.map((e) => e.textContent.trim()),
  );
  ok(
    gruppen.length === 2 && /Politik|Politics/.test(gruppen[1]),
    `zwei Gruppenlabels -> ${JSON.stringify(gruppen)}`,
  );
  const politik = await p.evaluate(() => {
    const karte = document.querySelector(".pillar--politics");
    return {
      inEigenemRaster: Boolean(
        karte && karte.closest(".expertise__grid--politics"),
      ),
      kante: karte
        ? getComputedStyle(karte, "::before").backgroundColor
        : null,
      icon: karte
        ? getComputedStyle(karte.querySelector(".pillar__icon")).color
        : null,
    };
  });
  ok(politik.inEigenemRaster, "Politik-Karte steht in eigener Reihe");
  ok(
    politik.kante === "rgb(105, 88, 213)",
    `Politik-Kante ist Violett (Zweitakzent) -> ${politik.kante}`,
  );
  ok(
    politik.icon === "rgb(139, 124, 232)",
    `Politik-Icon traegt die Text-Stufe des Zweitakzents -> ${politik.icon}`,
  );
  await p.close();
}

// --- Englische Fassung ---------------------------------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/en/", { waitUntil: "networkidle" });
  const titel = await p.$$eval(".pillar__title", (els) => els.map((e) => e.textContent.trim()));
  ok(
    titel.includes("AI, Robotics & Automation") && titel.includes("E-Commerce Logistics"),
    `englische Titel -> ${JSON.stringify(titel)}`,
  );
  await p.close();
}

// --- Neue Zahl im Band ---------------------------------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const werte = await p.$$eval(".proof__value", (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, " ").trim()),
  );
  ok(werte[1].includes("350"), `mittlere Zahl ist jetzt 350 -> ${JSON.stringify(werte)}`);
  const bio = await p.evaluate(() => document.body.textContent);
  ok(!/durchschnittlichen Auftragsvolumen/.test(bio), "ADV steht nicht doppelt im Text");
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
