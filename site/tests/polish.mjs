import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const AXE = readFileSync(new URL("./node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// ============================ P2: Auffindbarkeit ========================
console.log("=== P2: Auffindbarkeit ===");
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  const meta = await p.evaluate(() => {
    const g = (sel) => document.querySelector(sel)?.getAttribute("content") ?? "";
    return {
      titel: document.title,
      beschreibung: g("meta[name='description']"),
      ogTitel: g("meta[property='og:title']"),
      ogBild: g("meta[property='og:image']"),
      ogUrl: g("meta[property='og:url']"),
      ogLocale: g("meta[property='og:locale']"),
      twitter: g("meta[name='twitter:card']"),
      fliesstext: document.querySelector("main").textContent,
    };
  });
  const suchbegriff = (t) => /Martin Kandzior/.test(t) && /Mannheim/.test(t);
  ok(suchbegriff(meta.titel), `Titel trägt Name und Ort -> „${meta.titel}"`);
  ok(suchbegriff(meta.beschreibung), "Beschreibung trägt Name und Ort");
  ok(suchbegriff(meta.fliesstext), "Fließtext trägt Name und Ort");
  ok(meta.ogTitel === meta.titel, "og:title stimmt mit dem Titel überein");
  ok(meta.ogBild === "https://kandzior.de/assets/og.png", `og:image -> ${meta.ogBild}`);
  ok(meta.ogLocale === "de_DE", `og:locale -> ${meta.ogLocale}`);
  ok(meta.twitter === "summary_large_image", "twitter:card gesetzt");

  // JSON-LD: vorhanden, gültig, und NEUTRAL — keine Organisation, kein Amt.
  const schema = await p.evaluate(() => {
    const el = document.querySelector("script[type='application/ld+json']");
    return el ? el.textContent : null;
  });
  ok(Boolean(schema), "Person-Schema vorhanden");
  const person = JSON.parse(schema);
  ok(person["@type"] === "Person" && person.name === "Martin Kandzior", "Schema ist eine Person");
  ok(person.sameAs?.length === 3, `sameAs verweist auf die drei Profile -> ${person.sameAs?.length}`);
  const roh = JSON.stringify(person);
  for (const verboten of ["worksFor", "memberOf", "affiliation", "UPS", "NEOS", "CDU", "MIT "]) {
    ok(!roh.includes(verboten), `Schema neutral: „${verboten.trim()}" kommt nicht vor`);
  }
  await p.close();
}

{
  const p = await b.newPage();
  const r = await p.goto(B + "/sitemap.xml", { waitUntil: "domcontentloaded" });
  const xml = await r.text();
  ok(r.status() === 200, `sitemap.xml -> HTTP ${r.status()}`);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(urls.length === 6, `sechs Inhaltsseiten -> ${urls.length}`);
  ok(
    urls.includes("https://kandzior.de/") && urls.includes("https://kandzior.de/en/privacy"),
    "Start- und Rechtsseiten enthalten",
  );
  ok(!/styleguide|404/.test(xml), "Musterseite und Fehlerseite nicht enthalten");
  ok(/hreflang="x-default"/.test(xml), "hreflang-Alternativen enthalten");

  const robots = await (await p.goto(B + "/robots.txt")).text();
  ok(/Sitemap: https:\/\/kandzior\.de\/sitemap\.xml/.test(robots), "robots.txt verweist auf die Sitemap");
  await p.close();
}

// ============================ P3: Responsive ============================
console.log("=== P3: Responsive-Durchgang ===");
{
  const seiten = ["/", "/en/", "/impressum/", "/datenschutz/", "/en/imprint/", "/en/privacy/", "/404.html"];
  const breiten = [320, 360, 375, 414, 480, 600, 768, 900, 1024, 1200, 1280, 1536, 1920];
  for (const seite of seiten) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(B + seite, { waitUntil: "networkidle" });
    const probleme = [];
    for (const w of breiten) {
      await p.setViewportSize({ width: w, height: 900 });
      await p.waitForTimeout(60);
      const over = await p.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (over > 0) probleme.push(`${w}px:+${over}`);
    }
    ok(probleme.length === 0, `${seite} über 13 Breiten -> ${probleme.length ? probleme.join(" ") : "sauber"}`);
    await p.close();
  }
}

// ============================ P4: Barrierefreiheit ======================
console.log("=== P4: Barrierefreiheits-Durchgang (axe-core, WCAG 2.2 AA) ===");
for (const [seite, theme] of [
  ["/", "light"],
  ["/", "dark"],
  ["/en/", "light"],
  ["/datenschutz/", "light"],
  ["/impressum/", "dark"],
]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, theme);
  await p.goto(B + seite, { waitUntil: "networkidle" });
  await p.addScriptTag({ content: AXE });
  const ergebnis = await p.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      anzahl: v.nodes.length,
      ziele: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
  });
  ok(
    ergebnis.length === 0,
    `${seite} (${theme}): ${ergebnis.length === 0 ? "keine Verstöße" : JSON.stringify(ergebnis)}`,
  );
  await p.close();
}

// Beruehrungsziele — axe prueft 24px (WCAG 2.2 minimum), das eigene Ziel
// sind 44px fuer die wesentlichen Bedienelemente.
{
  const p = await b.newPage({ viewport: { width: 375, height: 800 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const klein = await p.evaluate(() => {
    const wesentlich = document.querySelectorAll(
      ".button, .header__burger, .theme-toggle, [data-consent-load], .social__tab, .field__control",
    );
    const zuKlein = [];
    wesentlich.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && (r.height < 44 || r.width < 44)) {
        zuKlein.push(`${el.className.split(" ")[0]}:${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    return zuKlein;
  });
  ok(klein.length === 0, `Berührungsziele ≥44px -> ${klein.length ? klein.join(", ") : "alle"}`);
  await p.close();
}

// ============================ P5: Ladeverhalten =========================
console.log("=== P5: Ladeverhalten ===");
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const uebertragen = [];
  p.on("response", async (r) => {
    try {
      const body = await r.body();
      uebertragen.push({ url: r.url().replace(B, ""), bytes: body.length });
    } catch {}
  });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  const nachTyp = {};
  for (const r of uebertragen) {
    const typ = r.url.includes("/vendor/silktide/")
      ? "consent"
      : r.url.endsWith(".woff2")
        ? "fonts"
        : r.url.includes("/_astro/") && r.url.endsWith(".js")
          ? "js"
          : r.url.endsWith(".css")
            ? "css"
            : r.url === "/" || r.url.endsWith(".html")
              ? "html"
              : "sonstiges";
    nachTyp[typ] = (nachTyp[typ] ?? 0) + r.bytes;
  }
  // Der Consent-Manager (Silktide, selbst gehostet) ist rechtlich verlangt
  // und läuft außerhalb des 300-KB-Budgets der eigentlichen Seite — dafür
  // bekommt er ein eigenes, enges Budget, damit er nicht heimlich wächst.
  const gesamt =
    uebertragen.reduce((s, r) => s + r.bytes, 0) - (nachTyp.consent ?? 0);
  console.log(
    "     Gewicht:",
    Object.entries(nachTyp)
      .map(([t, by]) => `${t} ${(by / 1024).toFixed(1)}KB`)
      .join(" · "),
    `→ gesamt ohne Consent ${(gesamt / 1024).toFixed(1)}KB`,
  );
  ok(gesamt < 300 * 1024, `Startseite unter 300KB -> ${(gesamt / 1024).toFixed(1)}KB`);
  ok(
    (nachTyp.consent ?? 0) > 0 && (nachTyp.consent ?? 0) < 40 * 1024,
    `Consent-Manager unter 40KB -> ${((nachTyp.consent ?? 0) / 1024).toFixed(1)}KB`,
  );
  ok((nachTyp.fonts ?? 0) < 120 * 1024, `Schriften unter 120KB -> ${((nachTyp.fonts ?? 0) / 1024).toFixed(1)}KB`);

  // Vorabgeladene Schriften muessen exakt die sein, die auch verwendet werden.
  const preloads = await p.$$eval("link[rel='preload'][as='font']", (els) =>
    els.map((e) => e.getAttribute("href")),
  );
  const geladen = uebertragen.filter((r) => r.url.endsWith(".woff2")).map((r) => r.url);
  ok(
    preloads.every((pre) => geladen.includes(pre)),
    `Vorabladungen werden verwendet -> ${preloads.join(", ")}`,
  );

  // Kein Layoutsprung: Alle Bilder/Platzhalter reservieren ihre Flaeche.
  const cls = await p.evaluate(
    () =>
      new Promise((fertig) => {
        let wert = 0;
        new PerformanceObserver((liste) => {
          for (const e of liste.getEntries()) if (!e.hadRecentInput) wert += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => fertig(wert), 800);
      }),
  );
  ok(cls < 0.02, `Layoutsprung (CLS) -> ${cls.toFixed(4)}`);
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
