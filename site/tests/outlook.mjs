import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

/** Relativluminanz und Kontrast nach WCAG, im Browser gerechnet. */
const KONTRAST = `
  (function () {
    const zahl = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, bb]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bb);
    // Halbtransparente Flaeche ueber ihren Untergrund legen.
    const ueber = (vorne, hinten) => {
      const a = vorne.length > 3 ? vorne[3] : 1;
      return [0, 1, 2].map((i) => vorne[i] * a + hinten[i] * (1 - a));
    };
    window.__kontrast = (vordergrund, flaeche, untergrund) => {
      const f = ueber(zahl(flaeche), zahl(untergrund));
      const v = ueber(zahl(vordergrund), f);
      const l1 = lum(v), l2 = lum(f);
      const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
  })();
`;

for (const theme of ["light", "dark"]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, theme);
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.addScriptTag({ content: KONTRAST });

  const m = await p.evaluate(() => {
    const abschnitt = document.querySelector(".outlook");
    const karte = document.querySelector(".pillar");
    const zitat = document.querySelector(".outlook__quote p");
    const kartentitel = document.querySelector(".pillar__title");
    const cs = getComputedStyle(abschnitt);
    const ks = getComputedStyle(karte);
    const body = getComputedStyle(document.body);
    return {
      flaeche: cs.backgroundColor,
      kartenflaeche: ks.backgroundColor,
      seitenflaeche: body.backgroundColor,
      radius: cs.borderRadius,
      schatten: cs.boxShadow,
      kartenRadius: ks.borderRadius,
      kartenSchatten: ks.boxShadow,
      kartenRahmen: ks.borderTopWidth,
      blockRahmenLR: cs.borderLeftWidth,
      breite: Math.round(abschnitt.getBoundingClientRect().width),
      fenster: window.innerWidth,
      zitatGroesse: parseFloat(getComputedStyle(zitat).fontSize),
      titelGroesse: parseFloat(getComputedStyle(kartentitel).fontSize),
      strich: getComputedStyle(document.querySelector(".outlook__quote")).borderLeftWidth,
      textfarbe: getComputedStyle(zitat).color,
      notizfarbe: getComputedStyle(document.querySelector(".outlook__note")).color,
    };
  });

  const kZitat = await p.evaluate(
    (m) => window.__kontrast(m.textfarbe, m.flaeche, m.seitenflaeche),
    m,
  );
  const kNotiz = await p.evaluate(
    (m) => window.__kontrast(m.notizfarbe, m.flaeche, m.seitenflaeche),
    m,
  );

  console.log(`  --- ${theme} ---`);
  ok(m.flaeche !== m.kartenflaeche, `Fläche unterscheidet sich von der Karte (${m.flaeche} vs ${m.kartenflaeche})`);
  ok(m.flaeche !== m.seitenflaeche, `Fläche unterscheidet sich von der Seite (${m.seitenflaeche})`);
  ok(m.radius === "0px" && m.schatten === "none", `keine Karteneigenschaften: Radius ${m.radius}, Schatten ${m.schatten}`);
  // Redesign v2 (Swiss): Karten sind absichtlich eckig und flach — die
  // Abgrenzung traegt jetzt die RAHMENLINIE: Karten haben eine, der
  // Haltungsblock laeuft randlos ueber die volle Breite.
  ok(
    parseFloat(m.kartenRahmen) > 0 && m.blockRahmenLR === "0px",
    `Abgrenzung ueber die Linie: Karte ${m.kartenRahmen}, Block seitlich ${m.blockRahmenLR}`,
  );
  ok(m.breite === m.fenster, `volle Breite ${m.breite}px von ${m.fenster}px`);
  ok(m.zitatGroesse > m.titelGroesse * 1.5, `Zitat ${m.zitatGroesse}px deutlich größer als Kartentitel ${m.titelGroesse}px`);
  ok(parseFloat(m.strich) >= 3, `Zitatstrich vorhanden (${m.strich})`);
  ok(kZitat >= 4.5, `Kontrast Zitat auf getönter Fläche ${kZitat}:1`);
  ok(kNotiz >= 4.5, `Kontrast Fußnote ${kNotiz}:1`);

  await p.close();
}

// --- Gliederung und Abgrenzung im Markup --------------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  const inKarten = await p.evaluate(() =>
    Boolean(document.querySelector(".expertise__grid .outlook, .expertise .outlook")),
  );
  ok(!inKarten, "Block liegt außerhalb des Expertise-Rasters");

  const ebenen = await p.$$eval("h1, h2, h3", (els) => els.map((e) => Number(e.tagName[1])));
  let luecke = false;
  for (let i = 1; i < ebenen.length; i++) if (ebenen[i] - ebenen[i - 1] > 1) luecke = true;
  ok(!luecke, `Überschriftenebenen ohne Sprung -> ${ebenen.join(" ")}`);

  const zitat = await p.evaluate(() =>
    document.querySelector(".outlook__quote").tagName.toLowerCase(),
  );
  ok(zitat === "blockquote", `Zitat als <blockquote> ausgezeichnet -> <${zitat}>`);

  // Relative Reihenfolge statt vollstaendiger Liste: Sonst bricht der Test
  // bei jedem neuen Bereich, obwohl nichts kaputt ist.
  const reihenfolge = await p.$$eval("main > section", (els) => els.map((e) => e.id));
  const folgt = (a, bb) =>
    reihenfolge.indexOf(a) !== -1 &&
    reihenfolge.indexOf(bb) !== -1 &&
    reihenfolge.indexOf(a) < reihenfolge.indexOf(bb);
  ok(
    folgt("expertise", "outlook"),
    `Haltungsblock folgt auf die Karten -> ${reihenfolge.join(" → ")}`,
  );
  await p.close();
}

// --- Breiten -------------------------------------------------------------
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
