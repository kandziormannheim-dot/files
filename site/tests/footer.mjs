import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

const KONTRAST = `
  (function () {
    const zahl = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, bb]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bb);
    const ueber = (vorne, hinten) => {
      const a = vorne.length > 3 ? vorne[3] : 1;
      return [0, 1, 2].map((i) => vorne[i] * a + hinten[i] * (1 - a));
    };
    window.__k = (vg, flaeche, grund) => {
      const f = ueber(zahl(flaeche), zahl(grund));
      const v = ueber(zahl(vg), f);
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
  console.log(`  --- ${theme} ---`);

  const f = await p.evaluate(() => {
    const fu = document.querySelector(".footer");
    // Die Marke ist eine currentColor-Fläche unter einer Maske — sichtbar
    // ist ihre backgroundColor, nicht eine Textfarbe.
    const logo = document.querySelector(".footer__logo .logo__mark");
    const link = document.querySelector(".footer__link");
    const tag = document.querySelector(".footer__tagline");
    return {
      flaeche: getComputedStyle(fu).backgroundColor,
      seite: getComputedStyle(document.body).backgroundColor,
      logofarbe: getComputedStyle(logo).backgroundColor,
      linkfarbe: getComputedStyle(link).color,
      tagfarbe: getComputedStyle(tag).color,
      breite: Math.round(fu.getBoundingClientRect().width),
      fenster: window.innerWidth,
    };
  });

  // Die Fussleiste ist in beiden Themes dunkel und hebt sich von der Seite ab.
  ok(f.flaeche !== f.seite, `Fläche hebt sich von der Seite ab (${f.flaeche} vs ${f.seite})`);
  ok(f.breite === f.fenster, `volle Breite ${f.breite}px`);

  // Das Logo in der Kopfzeile darf die Umkehrung NICHT mitbekommen.
  const kopf = await p.evaluate(() => {
    const el = document.querySelector(".header .logo__mark");
    return {
      farbe: getComputedStyle(el).backgroundColor,
      erwartet: getComputedStyle(document.body).color,
    };
  });
  ok(kopf.farbe === kopf.erwartet, `Kopfzeilen-Logo folgt weiterhin dem Theme -> ${kopf.farbe}`);

  const kLogo = await p.evaluate((f) => window.__k(f.logofarbe, f.flaeche, f.seite), f);
  const kLink = await p.evaluate((f) => window.__k(f.linkfarbe, f.flaeche, f.seite), f);
  const kTag = await p.evaluate((f) => window.__k(f.tagfarbe, f.flaeche, f.seite), f);
  ok(kLogo >= 4.5, `Logo auf dunkler Fläche ${kLogo}:1 (invertiert)`);
  ok(kLink >= 4.5, `Links ${kLink}:1`);
  ok(kTag >= 4.5, `Tagline ${kTag}:1`);

  await p.close();
}

// --- Inhalt: was hier steht und was NICHT ------------------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  const rechtslinks = await p.$$eval(".footer__legal a", (els) =>
    els.map((e) => ({ text: e.textContent.trim(), href: e.getAttribute("href") })),
  );
  ok(
    rechtslinks.some((l) => l.href === "/impressum") &&
      rechtslinks.some((l) => l.href === "/datenschutz"),
    `Rechtstexte erreichbar -> ${JSON.stringify(rechtslinks)}`,
  );

  // Die Primaernavigation darf sich hier NICHT wiederholen.
  const anker = await p.$$eval(".footer a", (els) =>
    els.map((e) => e.getAttribute("href")).filter((h) => h && h.startsWith("#")),
  );
  ok(
    !anker.some((h) => ["#expertise", "#about", "#social", "#contact"].includes(h)),
    `keine Wiederholung der Primärnavigation -> ${JSON.stringify(anker)}`,
  );

  const profile = await p.$$eval(".footer__profiles a", (els) =>
    els.map((e) => ({ text: e.textContent.trim(), rel: e.getAttribute("rel"), ziel: e.getAttribute("target") })),
  );
  ok(profile.length === 3, `drei Profile -> ${profile.length}`);
  ok(
    profile.every((x) => /noopener/.test(x.rel) && x.ziel === "_blank"),
    "Profile öffnen in neuem Tab mit noopener",
  );

  const umschalter = await p.evaluate(() =>
    document.querySelector(".footer .lang").className,
  );
  ok(/lang--plain/.test(umschalter), `Sprachumschalter in schlichter Fassung -> ${umschalter}`);

  // Der Umschalter muss auch hier den Anker mitnehmen.
  await p.evaluate(() => {
    window.location.hash = "#about";
  });
  const href = await p.evaluate(() => {
    const a = document.querySelector(".footer [data-lang-link]");
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return a.getAttribute("href");
  });
  ok(href === "/en/#about", `Sprachwechsel aus der Fußzeile -> ${href}`);
  await p.close();
}

// --- Englische Fassung verweist auf die englischen Rechtstexte ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/en/", { waitUntil: "networkidle" });
  const links = await p.$$eval(".footer__legal a", (els) =>
    els.map((e) => e.getAttribute("href")),
  );
  ok(
    links.includes("/en/imprint") && links.includes("/en/privacy"),
    `englische Rechtstexte -> ${JSON.stringify(links)}`,
  );
  await p.close();
}

// --- Ueberlagerung des Sprachumschalters in der schlichten Fassung ------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const teile = await p.evaluate(() => {
    const items = [...document.querySelectorAll(".footer .lang__item")];
    return items.map((e) => {
      const r = e.getBoundingClientRect();
      return { text: e.textContent.trim(), links: Math.round(r.left), breite: Math.round(r.width) };
    });
  });
  const ueberlappt =
    teile.length === 2 && teile[0].links + teile[0].breite > teile[1].links + 1;
  ok(!ueberlappt, `DE und EN überlagern sich nicht -> ${JSON.stringify(teile)}`);
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
