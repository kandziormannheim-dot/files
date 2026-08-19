import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const U = B + "/styleguide/";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

const fremde = (p, sammler) =>
  p.on("request", (r) => {
    const h = new URL(r.url()).host;
    if (!h.includes("127.0.0.1")) sammler.push(h);
  });

// === 1. DIE KERNBEDINGUNG: keine Fremdanfrage ohne Klick ================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const anfragen = [];
  fremde(p, anfragen);
  await p.goto(U, { waitUntil: "networkidle" });
  // Auch nach Scrollen und Warten darf nichts nachgeladen werden.
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1500);
  ok(
    anfragen.length === 0,
    `Seitenaufruf ohne Klick: ${anfragen.length ? [...new Set(anfragen)].join(", ") : "KEINE Fremdanfrage"}`,
  );
  const zustaende = await p.$$eval("[data-consent]", (els) =>
    els.map((e) => e.dataset.state),
  );
  ok(
    zustaende.every((z) => z === "idle"),
    `beide Karten im Ruhezustand -> ${JSON.stringify(zustaende)}`,
  );
  const leer = await p.$$eval("[data-consent-mount]", (els) =>
    els.map((e) => e.children.length),
  );
  ok(leer.every((n) => n === 0), `Zielbereiche leer -> ${JSON.stringify(leer)}`);
  await p.close();
}

// === 2. Direktlink funktioniert ohne jedes Laden ========================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(U, { waitUntil: "networkidle" });
  const links = await p.$$eval(".consent__direct", (els) =>
    els.map((e) => ({
      href: e.getAttribute("href"),
      rel: e.getAttribute("rel"),
      ziel: e.getAttribute("target"),
      sichtbar: e.getBoundingClientRect().height > 0,
    })),
  );
  ok(links.length === 2, `zwei Direktlinks -> ${links.length}`);
  ok(
    links.every((l) => l.sichtbar && /^https:/.test(l.href) && /noopener/.test(l.rel)),
    `Direktlinks sichtbar und sicher -> ${JSON.stringify(links.map((l) => l.href))}`,
  );
  await p.close();
}

// === 3. Klick lädt — geprüft gegen einen abgefangenen Anbieter =========
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  // Das echte Skript ist aus dieser Umgebung nicht erreichbar. Statt den
  // Test daran scheitern zu lassen, wird die Anbieterantwort abgefangen:
  // Geprueft wird die Mechanik, nicht die Erreichbarkeit fremder Server.
  await p.route("**/cdn.tickettailor.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "document.currentScript?.parentElement?.insertAdjacentHTML('beforeend','<p data-widget>Termine</p>');",
    }),
  );
  const anfragen = [];
  fremde(p, anfragen);
  await p.goto(U, { waitUntil: "networkidle" });
  ok(anfragen.length === 0, "vor dem Klick weiterhin keine Fremdanfrage");

  await p.locator("#demo-script [data-consent-load]").click();
  await p.waitForFunction(
    () => document.querySelector("#demo-script")?.dataset.state === "loaded",
    { timeout: 8000 },
  );
  ok(true, "Zustand wechselt auf geladen");
  ok(
    anfragen.some((h) => h.includes("tickettailor")),
    `nach dem Klick Anfrage an den Anbieter -> ${[...new Set(anfragen)].join(", ")}`,
  );

  const nachher = await p.evaluate(() => {
    const w = document.querySelector("#demo-script");
    return {
      vorschauSichtbar: w.querySelector(".consent__preview").getBoundingClientRect().height > 0,
      inhalt: Boolean(w.querySelector("[data-widget]")),
      fokus: document.activeElement?.getAttribute("data-consent-mount") !== null,
      attribute: w.querySelector("script")?.getAttribute("data-url"),
    };
  });
  ok(!nachher.vorschauSichtbar, "Vorschau verschwindet nach dem Laden");
  ok(nachher.inhalt, "Anbieterinhalt steht im Zielbereich");
  ok(nachher.fokus, "Fokus wandert in den geladenen Bereich");
  ok(
    nachher.attribute === "https://www.tickettailor.com/all-tickets/mkevents1/",
    `Anbieter-Attribute durchgereicht -> ${nachher.attribute}`,
  );

  // Die zweite Karte darf davon unberuehrt bleiben.
  const andere = await p.evaluate(
    () => document.querySelector("#demo-iframe").dataset.state,
  );
  ok(andere === "idle", `zweite Karte weiterhin im Ruhezustand -> ${andere}`);
  await p.close();
}

// === 4. Fehlschlag: Anbieter nicht erreichbar ==========================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.route("**/cdn.tickettailor.com/**", (route) => route.abort());
  await p.goto(U, { waitUntil: "networkidle" });
  await p.locator("#demo-script [data-consent-load]").click();
  await p.waitForFunction(
    () => document.querySelector("#demo-script")?.dataset.state === "error",
    { timeout: 8000 },
  );
  const f = await p.evaluate(() => {
    const w = document.querySelector("#demo-script");
    return {
      meldung: w.querySelector("[data-consent-status]").textContent.trim(),
      meldungSichtbar:
        w.querySelector("[data-consent-status]").getBoundingClientRect().height > 0,
      knopfWiederNutzbar: !w.querySelector("[data-consent-load]").disabled,
      direktlinkDa: w.querySelector(".consent__direct").getBoundingClientRect().height > 0,
    };
  });
  ok(f.meldungSichtbar && f.meldung.length > 0, `Fehlermeldung sichtbar -> „${f.meldung}“`);
  ok(f.knopfWiederNutzbar, "Knopf ist wieder bedienbar");
  ok(f.direktlinkDa, "Direktlink bleibt erreichbar");
  await p.close();
}

// === 5. Zugaenglichkeit ================================================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(U, { waitUntil: "networkidle" });
  const a = await p.evaluate(() => {
    const w = document.querySelector("#demo-script");
    const k = w.querySelector("[data-consent-load]");
    const hinweis = document.getElementById(k.getAttribute("aria-describedby"));
    const status = w.querySelector("[data-consent-status]");
    return {
      beschrieben: hinweis?.textContent.trim() ?? "",
      steuert: k.getAttribute("aria-controls"),
      zielId: w.querySelector("[data-consent-mount]").id,
      statusRolle: status.getAttribute("role"),
      statusLive: status.getAttribute("aria-live"),
      regionLabel: w.querySelector("[data-consent-mount]").getAttribute("aria-label"),
    };
  });
  ok(/Klick/.test(a.beschrieben), `Knopf verweist auf den Einwilligungstext -> „${a.beschrieben.slice(0, 60)}…“`);
  ok(a.steuert === a.zielId, `aria-controls zeigt auf den Zielbereich -> ${a.steuert}`);
  ok(a.statusRolle === "status" && a.statusLive === "polite", "Statusmeldung wird angekündigt");
  ok(a.regionLabel === "Ticket Tailor", `Zielbereich benannt -> ${a.regionLabel}`);

  // Vollstaendig per Tastatur bedienbar
  await p.route("**/cdn.tickettailor.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await p.locator("#demo-script [data-consent-load]").focus();
  await p.keyboard.press("Enter");
  await p.waitForFunction(
    () => document.querySelector("#demo-script")?.dataset.state !== "idle",
    { timeout: 8000 },
  );
  ok(true, "per Tastatur auslösbar");
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
