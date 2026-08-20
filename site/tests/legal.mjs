import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });

// Cookie-Banner (Silktide) vorab quittieren: Sein Backdrop laege sonst ueber
// der Seite und finge jeden Klick ab. Die Banner-Mechanik selbst prueft
// verify.mjs in einem eigenen Abschnitt mit unquittierter Seite.
const _newPage = b.newPage.bind(b);
b.newPage = async (opts) => {
  const p = await _newPage(opts);
  await p.addInitScript(() => {
    try { localStorage.setItem("stcm.hasConsented", "1"); } catch {}
  });
  return p;
};
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// === I5: Fokus-Falle im mobilen Menü ====================================
{
  const p = await b.newPage({ viewport: { width: 375, height: 667 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.click("[data-menu-open]");
  ok(
    await p.evaluate(() => document.activeElement?.hasAttribute("data-menu-close")),
    "Fokus wandert beim Öffnen auf den Schließen-Knopf",
  );

  // Vorwärts durch das gesamte Menü tabben: Der Fokus muss immer im Overlay
  // bleiben und irgendwann wieder am Anfang ankommen.
  const stationen = [];
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press("Tab");
    const wo = await p.evaluate(() => ({
      imMenu: document.querySelector("[data-menu]").contains(document.activeElement),
      kennung:
        document.activeElement?.getAttribute("aria-label") ??
        document.activeElement?.textContent?.trim().slice(0, 20) ??
        "?",
    }));
    stationen.push(wo);
  }
  ok(
    stationen.every((s) => s.imMenu),
    `12x Tab: Fokus verlässt das Overlay nie -> ${stationen.map((s) => s.kennung).join(" | ")}`,
  );

  // Rückwärts vom ersten Element: landet auf dem letzten
  await p.click("[data-menu-close]"); // schließen …
  await p.click("[data-menu-open]"); // … und sauber neu öffnen
  await p.keyboard.press("Shift+Tab");
  const rueckwaerts = await p.evaluate(() => ({
    imMenu: document.querySelector("[data-menu]").contains(document.activeElement),
    text: document.activeElement?.textContent?.trim().slice(0, 24),
  }));
  ok(
    rueckwaerts.imMenu,
    `Shift+Tab vom Anfang bleibt im Overlay -> ${rueckwaerts.text}`,
  );

  await p.keyboard.press("Escape");
  ok(
    await p.evaluate(() => document.activeElement?.hasAttribute("data-menu-open")),
    "Esc schließt, Fokus kehrt zum Auslöser zurück",
  );
  await p.close();
}

// === P1: Alle fünf Routen bauen und antworten ===========================
for (const [pfad, erwartet] of [
  ["/impressum/", "Impressum"],
  ["/datenschutz/", "Datenschutzerklärung"],
  ["/en/imprint/", "Imprint"],
  ["/en/privacy/", "Privacy Policy"],
]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const r = await p.goto(B + pfad, { waitUntil: "networkidle" });
  const h1 = await p.textContent("h1");
  ok(r.status() === 200 && h1.trim() === erwartet, `${pfad} -> HTTP ${r.status()}, „${h1.trim()}"`);
  await p.close();
}

{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const r = await p.goto(B + "/gibt-es-nicht", { waitUntil: "networkidle" });
  const code = await p.textContent(".notfound__code").catch(() => null);
  ok(r.status() === 404 && code === "404", `unbekannte URL -> HTTP ${r.status()}, Fehlerseite gerendert`);
  await p.close();
}

// === P1: Kopfzeile der Rechtstexte ohne Ankernavigation und CTA =========
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/impressum/", { waitUntil: "networkidle" });
  const kopf = await p.evaluate(() => ({
    nav: Boolean(document.querySelector(".header__nav")),
    cta: Boolean(document.querySelector(".header__cta")),
    burger: Boolean(document.querySelector(".header__burger")),
    logo: Boolean(document.querySelector(".header .logo")),
    zurueck: document.querySelector(".legal__back")?.getAttribute("href"),
  }));
  ok(!kopf.nav && !kopf.cta && !kopf.burger, "Kopfzeile minimal: keine Ankernavigation, kein CTA, kein Menü");
  ok(kopf.logo && kopf.zurueck === "/", `Logo und Zurück-Link vorhanden -> ${kopf.zurueck}`);
  await p.close();
}

// === P1: Inhalt beschreibt die GEBAUTE Seite ============================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/datenschutz/", { waitUntil: "networkidle" });
  const text = await p.evaluate(() => document.body.textContent);

  for (const verboten of ["Cookiebot", "Google Analytics", "Brevo", "TikTok", "YouTube", "Newsletter"]) {
    ok(!text.includes(verboten), `beschreibt nichts Nichtexistentes: „${verboten}" kommt nicht vor`);
  }
  for (const noetig of ["Hetzner", "Zwei-Klick", "Ticket Tailor", "localStorage", "keine Cookies"]) {
    ok(text.includes(noetig), `beschreibt die echte Seite: „${noetig}" kommt vor`);
  }
  ok(!/PLATZHALTER/.test(text), "keine Platzhalter-Markierungen mehr im Rechtstext");
  await p.close();
}

// === P1: Maßgeblichkeits-Hinweis nur auf Englisch =======================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/en/privacy/", { waitUntil: "networkidle" });
  const hinweis = await p.textContent(".legal__authoritative").catch(() => null);
  ok(
    /German version/.test(hinweis ?? ""),
    `EN trägt den Hinweis auf die maßgebliche deutsche Fassung -> „${(hinweis ?? "").slice(0, 60)}"`,
  );
  await p.close();
}
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/datenschutz/", { waitUntil: "networkidle" });
  ok(
    !(await p.$(".legal__authoritative")),
    "DE trägt den Hinweis nicht — sie IST die maßgebliche Fassung",
  );
  await p.close();
}

// === P1: Sprachwechsel zwischen den Rechtstexten ========================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/impressum/", { waitUntil: "networkidle" });
  const enLink = await p.getAttribute("[data-lang-link]", "href");
  ok(enLink === "/en/imprint", `Sprachumschalter führt auf die Entsprechung -> ${enLink}`);
  const hreflang = await p.getAttribute('link[hreflang="en"]', "href");
  ok(hreflang === "https://kandzior.de/en/imprint", `hreflang -> ${hreflang}`);
  await p.close();
}

// === P1: Fußzeile verlinkt die Rechtstexte, Breiten stimmen =============
for (const w of [320, 375, 768, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(B + "/datenschutz/", { waitUntil: "networkidle" });
  const quer = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!quer, `${w}px: Rechtstext ohne horizontales Scrollen`);
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
