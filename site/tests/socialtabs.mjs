import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// === 1. Weiterhin keine Fremdanfrage auf der Startseite =================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const anfragen = [];
  p.on("request", (r) => {
    const h = new URL(r.url()).host;
    if (!h.includes("127.0.0.1")) anfragen.push(h);
  });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  ok(
    anfragen.length === 0,
    `Startseite mit Social-Bereich: ${anfragen.length ? [...new Set(anfragen)].join(", ") : "KEINE Fremdanfrage"}`,
  );
  await p.close();
}

// === 2. ARIA-Struktur ====================================================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  const struktur = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll("[role='tab']")];
    const panels = [...document.querySelectorAll("[role='tabpanel']")];
    return {
      tabAnzahl: tabs.length,
      panelAnzahl: panels.length,
      erste: tabs.map((t) => ({
        id: t.id,
        gewaehlt: t.getAttribute("aria-selected"),
        tabindex: t.tabIndex,
        steuert: t.getAttribute("aria-controls"),
      })),
      sichtbar: panels.filter((x) => !x.hidden).map((x) => x.id),
      liste: document.querySelector("[role='tablist']") !== null,
    };
  });
  ok(struktur.liste, "tablist vorhanden");
  ok(struktur.tabAnzahl === 3 && struktur.panelAnzahl === 3, `drei Tabs, drei Panels -> ${struktur.tabAnzahl}/${struktur.panelAnzahl}`);
  ok(
    struktur.erste[0].gewaehlt === "true" && struktur.erste[0].id === "tab-linkedin",
    `LinkedIn voreingestellt -> ${struktur.erste[0].id}`,
  );
  ok(
    struktur.erste.filter((t) => t.tabindex === 0).length === 1,
    "genau ein Tab in der Tab-Reihenfolge (roving tabindex)",
  );
  ok(
    JSON.stringify(struktur.sichtbar) === JSON.stringify(["panel-linkedin"]),
    `nur das aktive Panel sichtbar -> ${struktur.sichtbar.join(", ")}`,
  );
  ok(
    struktur.erste.every((t) => t.steuert === t.id.replace("tab-", "panel-")),
    "aria-controls verweist je auf das eigene Panel",
  );
  await p.close();
}

// === 3. Pfeiltasten-Bedienung ============================================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.locator("#tab-linkedin").focus();

  await p.keyboard.press("ArrowRight");
  let aktiv = await p.evaluate(() => document.activeElement?.id);
  let sichtbar = await p.$$eval("[role='tabpanel']", (els) => els.filter((x) => !x.hidden).map((x) => x.id));
  ok(aktiv === "tab-x" && sichtbar[0] === "panel-x", `Pfeil rechts -> ${aktiv}, Panel ${sichtbar[0]}`);

  await p.keyboard.press("ArrowLeft");
  aktiv = await p.evaluate(() => document.activeElement?.id);
  ok(aktiv === "tab-linkedin", `Pfeil links zurück -> ${aktiv}`);

  // Umlauf am Rand
  await p.keyboard.press("ArrowLeft");
  aktiv = await p.evaluate(() => document.activeElement?.id);
  ok(aktiv === "tab-facebook", `Umlauf links -> ${aktiv}`);

  await p.keyboard.press("Home");
  aktiv = await p.evaluate(() => document.activeElement?.id);
  ok(aktiv === "tab-linkedin", `Home -> ${aktiv}`);

  await p.keyboard.press("End");
  aktiv = await p.evaluate(() => document.activeElement?.id);
  ok(aktiv === "tab-facebook", `End -> ${aktiv}`);
  await p.close();
}

// === 4. Inhalte je Tab ===================================================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  // LinkedIn: Feed ueber SociableKIT-Widget -> ConsentEmbed, und der
  // Einwilligungstext nennt den ECHTEN Empfaenger der IP (den Dienst),
  // nicht nur die Plattform.
  const li = await p.evaluate(() => {
    const panel = document.querySelector("#panel-linkedin");
    return {
      ladeknopf: Boolean(panel.querySelector("[data-consent-load]")),
      hinweis: panel.querySelector(".consent__notice")?.textContent ?? "",
      embed: panel.querySelector("[data-consent]")?.dataset.embed ?? "",
      direkt: panel.querySelector(".consent__direct")?.getAttribute("href"),
    };
  });
  ok(li.ladeknopf, "LinkedIn nutzt die Einwilligungs-Vorschau (Widget-Feed)");
  ok(
    /SociableKIT \(LinkedIn\)/.test(li.hinweis),
    `Einwilligungstext nennt den Dienst -> "${li.hinweis.trim().slice(0, 70)}…"`,
  );
  ok(
    li.embed.includes("widgets.sociablekit.com/linkedin-profile-posts/iframe/25706175"),
    "Widget-Quelle ist das eingetragene SociableKIT-iframe",
  );
  ok(li.direkt === "https://linkedin.com/in/martin-kandzior", `LinkedIn-Direktlink -> ${li.direkt}`);

  // X: Einbettung vorhanden -> ConsentEmbed mit vorbereitetem Anker
  const x = await p.evaluate(() => {
    const panel = document.querySelector("#panel-x");
    return {
      consent: Boolean(panel.querySelector("[data-consent]")),
      anker: panel.querySelector(".twitter-timeline")?.getAttribute("href"),
      dnt: panel.querySelector(".twitter-timeline")?.getAttribute("data-dnt"),
      direkt: panel.querySelector(".consent__direct")?.getAttribute("href"),
    };
  });
  ok(x.consent, "X nutzt die Einwilligungs-Vorschau");
  ok(
    String(x.anker).startsWith("https://x.com/martinkandzior"),
    `X-Anker für die Timeline -> ${x.anker}`,
  );
  ok(x.dnt === "true", "X-Timeline mit Do-Not-Track-Attribut");
  ok(x.direkt === "https://x.com/martinkandzior", `X-Direktlink -> ${x.direkt}`);

  // Facebook: Feed ueber SociableKIT-Widget ('Facebook Profile' — der Typ,
  // der auch fuer Profile funktioniert) -> ConsentEmbed mit Anbieternennung
  const fb = await p.evaluate(() => {
    const panel = document.querySelector("#panel-facebook");
    return {
      ladeknopf: Boolean(panel.querySelector("[data-consent-load]")),
      hinweis: panel.querySelector(".consent__notice")?.textContent ?? "",
      embed: panel.querySelector("[data-consent]")?.dataset.embed ?? "",
      direkt: panel.querySelector(".consent__direct")?.getAttribute("href"),
    };
  });
  ok(fb.ladeknopf, "Facebook nutzt die Einwilligungs-Vorschau (Widget-Feed)");
  ok(
    /SociableKIT \(Facebook\)/.test(fb.hinweis),
    `Einwilligungstext nennt den Dienst -> "${fb.hinweis.trim().slice(0, 70)}…"`,
  );
  ok(
    fb.embed.includes("widgets.sociablekit.com/facebook-profile/iframe/25706182"),
    "Widget-Quelle ist das eingetragene SociableKIT-iframe",
  );
  ok(fb.direkt === "https://facebook.com/martin.kandzior", `Facebook-Direktlink -> ${fb.direkt}`);
  await p.close();
}

// === 5. X-Einbettung laedt nach Klick — Anbieter abgefangen ==============
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.route("**/platform.twitter.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "document.querySelector('.twitter-timeline')?.insertAdjacentHTML('afterend','<div data-tl>Timeline</div>');",
    }),
  );
  const anfragen = [];
  p.on("request", (r) => {
    const h = new URL(r.url()).host;
    if (!h.includes("127.0.0.1")) anfragen.push(h);
  });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.click("#tab-x");
  ok(anfragen.length === 0, "Tabwechsel allein löst keine Fremdanfrage aus");

  await p.click("#social-x [data-consent-load]");
  await p.waitForFunction(
    () => document.querySelector("#social-x")?.dataset.state === "loaded",
    { timeout: 8000 },
  );
  ok(anfragen.some((h) => h.includes("twitter")), `nach Klick Anfrage an den Anbieter -> ${[...new Set(anfragen)].join(", ")}`);
  const inhalt = await p.evaluate(() => Boolean(document.querySelector("[data-tl]")));
  ok(inhalt, "Timeline-Inhalt gerendert");
  await p.close();
}

// === 6. Reihenfolge und Breiten =========================================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const reihenfolge = await p.$$eval("main > section", (els) => els.map((e) => e.id));
  ok(
    reihenfolge.indexOf("about") < reihenfolge.indexOf("social"),
    `Social folgt auf die Biografie -> ${reihenfolge.join(" → ")}`,
  );
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
