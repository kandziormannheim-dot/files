import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// === I3: Events ausgeblendet (visible=false) ============================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const events = await p.evaluate(() => ({
    bereich: Boolean(document.querySelector("#events")),
    navPunkt: [...document.querySelectorAll("[data-nav-link]")].some(
      (a) => a.getAttribute("href") === "#events",
    ),
  }));
  ok(!events.bereich, "Events-Bereich existiert nicht (visible=false)");
  ok(!events.navPunkt, "Events-Navigationspunkt existiert nicht");
  const reihenfolge = await p.$$eval("main > section", (els) => els.map((e) => e.id));
  ok(
    reihenfolge.indexOf("social") + 1 === reihenfolge.indexOf("contact"),
    `Social geht ohne Lücke in Kontakt über -> ${reihenfolge.join(" → ")}`,
  );
  await p.close();
}

// === I4: Struktur und Zugänglichkeit ====================================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });

  const s = await p.evaluate(() => {
    const form = document.querySelector("[data-contact-form]");
    const labels = [...form.querySelectorAll("label")].filter(
      (l) => !l.closest(".contact__hp"),
    );
    const hp = form.querySelector(".contact__hp input");
    // Beschnitten wird der CONTAINER (1x1, overflow hidden), nicht das Feld:
    // getBoundingClientRect des Feldes meldet weiter die Layoutgroesse.
    // Sichtbarkeit prueft man an dem Element, das sie herstellt — und
    // zusaetzlich daran, ob an der Feldposition wirklich etwas anderes liegt.
    const wrap = form.querySelector(".contact__hp").getBoundingClientRect();
    const feldR = hp.getBoundingClientRect();
    const dort = document.elementFromPoint(
      Math.min(feldR.left + 5, innerWidth - 1),
      Math.min(feldR.top + 5, innerHeight - 1),
    );
    const hpRect = { width: wrap.width, height: wrap.height };
    const hpVerdeckt = dort !== hp;
    return {
      labelAnzahl: labels.length,
      labelsSichtbar: labels.every((l) => l.getBoundingClientRect().height > 0),
      labelsVerbunden: labels.every((l) =>
        form.querySelector(`#${l.getAttribute("for")}`),
      ),
      novalidate: form.hasAttribute("novalidate"),
      hpUnsichtbar: hpRect.width <= 1 && hpRect.height <= 1 && hpVerdeckt,
      hpTabindex: hp.tabIndex,
      statusRegion: Boolean(document.querySelector("[data-form-status][aria-live='polite']")),
      email: document.querySelector(".contact__info a[href^='mailto:']")?.textContent.trim(),
      titel: document.querySelector("#contact-heading")?.textContent.trim(),
    };
  });
  ok(s.labelAnzahl === 3 && s.labelsSichtbar && s.labelsVerbunden, "drei sichtbare, verbundene Labels");
  ok(s.novalidate, "eigene Validierung statt Browser-Blasen (novalidate)");
  ok(s.hpUnsichtbar && s.hpTabindex === -1, "Honeypot unsichtbar und aus der Tab-Reihenfolge");
  ok(s.statusRegion, "aria-live-Statusregion vorhanden");
  ok(s.email === "mail@kandzior.de", `echte E-Mail-Adresse -> ${s.email}`);
  ok(s.titel === "Lust, was Großes zu starten?", `CTA-Überschrift -> „${s.titel}"`);

  // Die Erfolgskarte darf im Ruhezustand NICHT sichtbar sein. Genau dieser
  // Fall stand einmal sichtbar neben dem Formular: display:flex der
  // Komponente schlug das display:none des hidden-Attributs.
  const erfolgRuhe = await p.evaluate(() => {
    const e = document.querySelector("[data-form-success]");
    return { hidden: e.hidden, hoehe: e.getBoundingClientRect().height };
  });
  ok(
    erfolgRuhe.hidden && erfolgRuhe.hoehe === 0,
    `Erfolgskarte im Ruhezustand unsichtbar -> ${JSON.stringify(erfolgRuhe)}`,
  );
  const fehlschlagRuhe = await p.evaluate(
    () => document.querySelector("[data-form-failure]").getBoundingClientRect().height,
  );
  ok(fehlschlagRuhe === 0, "Fehlermeldung im Ruhezustand unsichtbar");
  await p.close();
}

// === I4: Validierung beim Verlassen, nicht beim Tippen ==================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "html{scroll-behavior:auto !important}" });

  const email = p.locator("#cf-email");
  await email.scrollIntoViewIfNeeded();
  await email.focus();
  await email.pressSequentially("keine-adresse");
  let fehlerSichtbar = await p.evaluate(
    () => !document.getElementById("cf-email-error").hidden,
  );
  ok(!fehlerSichtbar, "während des Tippens keine Fehlermeldung");

  await p.locator("#cf-name").focus(); // Feld verlassen
  fehlerSichtbar = await p.evaluate(() => {
    const m = document.getElementById("cf-email-error");
    return !m.hidden && m.textContent.length > 0;
  });
  const invalid = await p.getAttribute("#cf-email", "aria-invalid");
  ok(fehlerSichtbar && invalid === "true", "nach dem Verlassen: Meldung unter dem Feld, aria-invalid gesetzt");

  // Korrektur lässt die Meldung beim Tippen verschwinden
  await email.focus();
  await email.fill("mensch@unternehmen.de");
  fehlerSichtbar = await p.evaluate(
    () => !document.getElementById("cf-email-error").hidden,
  );
  ok(!fehlerSichtbar, "Korrektur nimmt die Meldung sofort zurück");
  await p.close();
}

// === I4: Absenden mit leeren Feldern fokussiert das erste Problem =======
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  await p.locator(".contact__submit").click();
  const fokus = await p.evaluate(() => document.activeElement?.id);
  const meldungen = await p.$$eval(".field__error", (els) =>
    els.filter((e) => !e.hidden).length,
  );
  ok(fokus === "cf-name", `Fokus springt auf das erste fehlerhafte Feld -> ${fokus}`);
  ok(meldungen === 3, `alle drei Meldungen sichtbar -> ${meldungen}`);
  await p.close();
}

// === I4: Erfolg gegen abgefangenen Endpunkt =============================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  // Endpunkt ist leer -> Simulationsmodus. Der Testfall prueft den echten
  // Weg: Endpunkt setzen und die Anfrage abfangen.
  await p.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document
        .querySelector("[data-contact-form]")
        ?.setAttribute("data-endpoint", "/api/kontakt");
    });
  });
  let empfangen = null;
  await p.route("**/api/kontakt", (route) => {
    empfangen = JSON.parse(route.request().postData() ?? "{}");
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "html{scroll-behavior:auto !important}" });

  await p.fill("#cf-name", "Erika Musterfrau");
  await p.fill("#cf-email", "erika@unternehmen.de");
  await p.fill("#cf-message", "Zwei Sätze zu meinem Anliegen. Rückruf erbeten.");
  await p.locator(".contact__submit").click();

  await p.waitForSelector("[data-form-success]:not([hidden])", { timeout: 8000 });
  const nachher = await p.evaluate(() => ({
    formularWeg: document.querySelector("[data-contact-form]").hidden,
    zusage: document.querySelector("[data-form-success]").textContent,
    fokusImErfolg: document.activeElement?.hasAttribute("data-form-success"),
  }));
  ok(nachher.formularWeg, "Erfolg ersetzt das Formular");
  ok(/zwei Werktagen/.test(nachher.zusage), "Zusage ist konkret (zwei Werktage)");
  ok(nachher.fokusImErfolg, "Fokus wandert in die Bestätigung");
  ok(
    empfangen && empfangen.name === "Erika Musterfrau" && empfangen.email === "erika@unternehmen.de",
    `Endpunkt erhielt die Daten -> ${JSON.stringify(empfangen)}`,
  );
  await p.close();
}

// === I4: Fehlschlag erhält Eingaben und nennt den Ausweichweg ===========
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  await p.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document
        .querySelector("[data-contact-form]")
        ?.setAttribute("data-endpoint", "/api/kontakt");
    });
  });
  await p.route("**/api/kontakt", (route) => route.fulfill({ status: 500, body: "" }));
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "html{scroll-behavior:auto !important}" });

  await p.fill("#cf-name", "Erika Musterfrau");
  await p.fill("#cf-email", "erika@unternehmen.de");
  await p.fill("#cf-message", "Wichtiges Anliegen, darf nicht verloren gehen.");
  await p.locator(".contact__submit").click();

  await p.waitForSelector("[data-form-failure]:not([hidden])", { timeout: 8000 });
  const f = await p.evaluate(() => ({
    name: document.querySelector("#cf-name").value,
    nachricht: document.querySelector("#cf-message").value,
    ausweich: document.querySelector("[data-form-failure] a[href^='mailto:']")?.textContent,
    knopfFrei: !document.querySelector(".contact__submit").disabled,
    formularDa: !document.querySelector("[data-contact-form]").hidden,
  }));
  ok(f.formularDa && f.name === "Erika Musterfrau" && /verloren/.test(f.nachricht), "alle Eingaben bleiben erhalten");
  ok(f.ausweich === "mail@kandzior.de", `Ausweichweg als Link -> ${f.ausweich}`);
  ok(f.knopfFrei, "Knopf wieder bedienbar für den zweiten Versuch");
  await p.close();
}

// === I4: Honeypot zeigt still Erfolg, sendet aber nichts ================
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  await p.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document
        .querySelector("[data-contact-form]")
        ?.setAttribute("data-endpoint", "/api/kontakt");
    });
  });
  let getroffen = false;
  await p.route("**/api/kontakt", (route) => {
    getroffen = true;
    return route.fulfill({ status: 200, body: "{}" });
  });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "html{scroll-behavior:auto !important}" });

  await p.fill("#cf-name", "Bot Botsson");
  await p.fill("#cf-email", "bot@spam.example");
  await p.fill("#cf-message", "Kaufen Sie jetzt!");
  await p.evaluate(() => {
    document.querySelector("[name='company']").value = "Spam GmbH";
  });
  await p.locator(".contact__submit").click();
  await p.waitForSelector("[data-form-success]:not([hidden])", { timeout: 8000 });
  ok(!getroffen, "Honeypot gefüllt: Endpunkt wurde NICHT angefragt");
  ok(true, "Bot sieht trotzdem die Erfolgsmeldung");
  await p.close();
}

// === Breiten und Regression ============================================
for (const w of [320, 375, 768, 1280, 1920]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const quer = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!quer, `${w}px: kein horizontales Scrollen`);
  await p.close();
}

{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const anfragen = [];
  p.on("request", (r) => {
    const h = new URL(r.url()).host;
    if (!h.includes("127.0.0.1")) anfragen.push(h);
  });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1000);
  ok(anfragen.length === 0, `vollständige Seite: ${anfragen.length ? [...new Set(anfragen)].join(", ") : "KEINE Fremdanfrage"}`);
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
