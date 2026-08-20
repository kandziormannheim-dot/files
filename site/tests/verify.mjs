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

// 1. Beide Sprachen erreichbar und uebersetzt
for (const [path, lang, expect] of [
  ["/", "de", "Ich arbeite dort"],
  ["/en/", "en", "I work where"],
]) {
  const p = await b.newPage();
  const r = await p.goto(B + path, { waitUntil: "networkidle" });
  const html = await p.content();
  const htmlLang = await p.getAttribute("html", "lang");
  ok(r.status() === 200, `${path} -> HTTP ${r.status()}`);
  ok(htmlLang === lang, `${path} lang="${htmlLang}"`);
  ok(html.includes(expect), `${path} enthaelt uebersetzten Text`);
  const other = lang === "de" ? "en" : "de";
  const alt = await p.getAttribute(`link[hreflang="${other}"]`, "href");
  ok(!!alt, `${path} hreflang ${other} -> ${alt}`);
  const xd = await p.getAttribute('link[hreflang="x-default"]', "href");
  ok(xd === "https://kandzior.de/", `${path} x-default -> ${xd}`);
  console.log(`     Titel: ${await p.title()}`);
  await p.close();
}

// 2. Sprachumschalter nimmt den Anker mit
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(B + "/#contact", { waitUntil: "networkidle" });
  const href = await p.evaluate(() => {
    const a = document.querySelector("[data-lang-link]");
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return a.getAttribute("href");
  });
  ok(href === "/en/#contact", `Sprachwechsel bei #contact -> ${href}`);
  await p.close();
}

// 3. Theme: vor dem Rendern gesetzt, Umschalter wirkt und merkt sich
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.addInitScript(() => {
    try {
      localStorage.setItem("theme", "dark");
    } catch {}
  });
  await p.goto(B + "/", { waitUntil: "domcontentloaded" });
  const early = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  ok(early === "dark", `Theme vor dem Rendern gesetzt -> ${early}`);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === "rgb(8, 8, 15)", `Grundflaeche dunkel -> ${bg}`);
  await p.click("[data-theme-toggle]");
  const after = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const stored = await p.evaluate(() => localStorage.getItem("theme"));
  const label = await p.getAttribute("[data-theme-toggle]", "aria-label");
  ok(after === "light" && stored === "light", `Umschalten -> ${after}, gemerkt: ${stored}`);
  ok(String(label).includes("dunkl"), `Beschriftung nennt das Ziel -> "${label}"`);
  await p.close();
}

// 4. Kopfzeile: Klebe-Zustand
// Kleines Fenster, damit die Seite garantiert scrollbar ist — sonst prueft
// der Test nichts und meldet trotzdem Erfolg.
{
  const p = await b.newPage({ viewport: { width: 1280, height: 400 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  ok(
    await p.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    ),
    "Seite ist scrollbar (Voraussetzung des Tests)",
  );
  const before = await p.getAttribute("[data-header]", "data-scrolled");
  const hBefore = await p.evaluate(
    () => document.querySelector(".header__inner").getBoundingClientRect().height,
  );
  await p.evaluate(() => window.scrollTo(0, 300));
  await p.waitForTimeout(400);
  const after = await p.getAttribute("[data-header]", "data-scrolled");
  const hAfter = await p.evaluate(
    () => document.querySelector(".header__inner").getBoundingClientRect().height,
  );
  const border = await p.evaluate(
    () => getComputedStyle(document.querySelector("[data-header]")).borderBottomColor,
  );
  ok(before === "false" && after === "true", `Klebe-Zustand ${before} -> ${after}`);
  ok(hBefore === 72 && hAfter === 60, `Hoehe ${hBefore}px -> ${hAfter}px`);
  // v3 dark-first: border-primary ist night-600.
  ok(border === "rgb(38, 38, 60)", `Trennkante erscheint -> ${border}`);
  await p.close();
}

// 4b. Sprungmarke ragt im Ruhezustand nicht ins Bild — auch nicht mit Schatten
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const s = await p.evaluate(() => {
    const el = document.querySelector(".skip-link");
    return {
      unterkante: el.getBoundingClientRect().bottom,
      schatten: getComputedStyle(el).boxShadow,
    };
  });
  ok(s.unterkante < 0, `Sprungmarke ausserhalb -> Unterkante ${s.unterkante}px`);
  ok(s.schatten === "none", `Kein Schatten im Ruhezustand -> ${s.schatten}`);
  await p.close();
}

// 5. Mobiles Menue
{
  const p = await b.newPage({ viewport: { width: 375, height: 667 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  ok(await p.isHidden(".header__nav"), "Ankernavigation auf 375px ausgeblendet");
  await p.click("[data-menu-open]");
  ok(await p.isVisible("[data-menu]"), "Menue oeffnet");
  ok(
    (await p.getAttribute("[data-menu-open]", "aria-expanded")) === "true",
    "aria-expanded=true",
  );
  ok(
    await p.evaluate(() => document.body.style.overflow === "hidden"),
    "Scrollsperre aktiv",
  );
  ok(
    await p.evaluate(() => document.activeElement?.hasAttribute("data-menu-close")),
    "Fokus wandert in das Menue",
  );
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  ok(await p.isHidden("[data-menu]"), "Esc schliesst");
  ok(
    await p.evaluate(() => document.activeElement?.hasAttribute("data-menu-open")),
    "Fokus kehrt zum Ausloeser zurueck",
  );
  await p.close();
}

// 6. Events-Punkt fehlt, weil visible=false
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const links = await p.$$eval("[data-nav-link]", (els) =>
    els.map((e) => e.getAttribute("href")),
  );
  ok(!links.includes("#events"), `Navigation ohne Events -> ${links.join("  ")}`);
  await p.close();
}

// 7. Sprungmarke ist erstes Tab-Ziel
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.keyboard.press("Tab");
  const cls = await p.evaluate(() => document.activeElement?.className);
  ok(String(cls).includes("skip-link"), `Erstes Tab-Ziel -> ${cls}`);
  await p.close();
}

// 8. Keine Fremdanfragen, kein Konsolenfehler
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const foreign = [];
  const errs = [];
  p.on("request", (r) => {
    const h = new URL(r.url()).host;
    if (!h.includes("127.0.0.1")) foreign.push(h);
  });
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(B + "/", { waitUntil: "networkidle" });
  ok(
    foreign.length === 0,
    `Fremd-Domains: ${foreign.length ? [...new Set(foreign)].join(", ") : "KEINE"}`,
  );
  ok(errs.length === 0, `Skriptfehler: ${errs.length ? errs.join(" | ") : "keine"}`);
  await p.close();
}

// 9. Cookie-Banner (Silktide): erscheint unquittiert, "Nur notwendige"
// schliesst ihn, die Wahl wird gemerkt und ueberlebt das Neuladen.
// Frischer Kontext OHNE den Vorab-Quittungs-Wrapper von oben.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.waitForSelector("#stcm-wrapper .stcm-reject-all", { timeout: 5000 });
  ok(true, "Banner erscheint beim ersten Besuch");
  const btnText = await p.textContent("#stcm-wrapper .stcm-reject-all");
  ok(
    String(btnText).includes("Nur notwendige"),
    `Ablehnen-Knopf beschriftet -> "${String(btnText).trim()}"`,
  );
  await p.click("#stcm-wrapper .stcm-reject-all");
  await p.waitForTimeout(300);
  const zustand = await p.evaluate(() => ({
    prompt: !!document.querySelector("#stcm-wrapper .stcm-reject-all"),
    gemerkt: localStorage.getItem("stcm.hasConsented"),
    statistik: localStorage.getItem("stcm.consent.statistik"),
  }));
  ok(!zustand.prompt, "Banner nach 'Nur notwendige' geschlossen");
  ok(zustand.gemerkt !== null, `Wahl gemerkt -> stcm.hasConsented=${zustand.gemerkt}`);
  ok(
    zustand.statistik !== "true",
    `Statistik nicht eingewilligt -> ${zustand.statistik}`,
  );
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const wieder = await p.evaluate(
    () => !!document.querySelector("#stcm-wrapper .stcm-reject-all"),
  );
  ok(!wieder, "Banner bleibt nach Neuladen geschlossen");
  ok(
    await p.isVisible("#stcm-icon"),
    "Cookie-Symbol unten links bleibt erreichbar",
  );
  await ctx.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
