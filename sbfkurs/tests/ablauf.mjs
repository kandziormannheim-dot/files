// SBF-Kurs — Durchlauf im echten Browser (Playwright, Stil site/tests/verify.mjs).
//
// Voraussetzung: laufender Server mit Testkonfiguration (Einladungscode TEST):
//   SBFKURS_KONFIG=/pfad/test-config.php php -S 127.0.0.1:8092 sbfkurs/dev-router.php
//   node sbfkurs/tests/ablauf.mjs
//
// Der Playwright-Pfad ist bewusst nicht im Repo installiert; PW_MODUL zeigt auf
// ein node_modules mit "playwright", EXE auf das Chromium.

import { createRequire } from "node:module";
const require = createRequire(process.env.PW_MODUL || import.meta.url);
const { chromium } = require("playwright");

const EXE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = process.env.BASIS || "http://127.0.0.1:8092";
const CODE = process.env.EINLADUNG || "TEST";
const email = `lerner-${Date.now()}@test.invalid`;
const passwort = "Passwort1234!";

let failed = 0;
const ok = (c, m) => { if (!c) failed++; console.log(`${c ? "OK  " : "FEHL"} ${m}`); };

const b = await chromium.launch({ executablePath: EXE });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const fehlerJs = [];
p.on("pageerror", (e) => fehlerJs.push(String(e)));
const fremd = [];
p.on("request", (r) => { if (!r.url().startsWith(B)) fremd.push(r.url()); });

// 1. Ohne Anmeldung: Kurs leitet auf Login
let r = await p.goto(`${B}/kurs/src`);
ok(p.url().endsWith("/login"), `/kurs/src ohne Anmeldung -> ${p.url()}`);

// 2. Registrieren mit Einladungscode
await p.goto(`${B}/registrieren`);
await p.fill('input[name="code"]', CODE);
await p.fill('input[name="name"]', "Testlerner");
await p.fill('input[name="email"]', email);
await p.fill('input[name="passwort"]', passwort);
await p.fill('input[name="passwort2"]', passwort);
await p.click('main button[type="submit"]');
await p.waitForURL(`${B}/`);
ok(await p.locator("h1").textContent().then((t) => t.includes("Testlerner")), "Dashboard begrüßt mit Namen");
const karten = await p.locator(".kurskarte").count();
ok(karten >= 4, `${karten} Kurskarten sichtbar`);
const prozentVorher = await p.locator(".kurskarte").first().locator(".lernstand-zahl").textContent();
ok(prozentVorher.trim().startsWith("0"), `SRC startet bei ${prozentVorher.trim()}`);

// 3. Lektion lesen
await p.goto(`${B}/lektion/src/01-gmdss`);
ok((await p.locator("article.lektion h2").count()) >= 3, "Lektion hat Zwischenüberschriften");
ok((await p.locator(".kasten-merke").count()) >= 1, "Lektion hat Merke-Block");
await p.click('.lektion-fuss button[type="submit"]');
await p.waitForURL(/\/lektion\/src\/02-/);
ok(true, `„Gelesen“ springt zur nächsten Lektion: ${p.url().split("/").pop()}`);
await p.goto(`${B}/kurs/src`);
ok((await p.locator(".lektionsliste li.gelesen").count()) === 1, "Kursseite zeigt eine gelesene Lektion");

// 4. Trainer: drei Fragen per Tastatur
await p.goto(`${B}/trainer/src/frage?modul=&modus=neu`);
for (let i = 0; i < 3; i++) {
  ok((await p.locator("form[data-trainer]").count()) === 1, `Trainer zeigt Frage ${i + 1}`);
  await p.keyboard.press("1");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".verdikt");
  ok(/Richtig|falsch/.test(await p.locator(".verdikt").textContent()), "Auflösung sichtbar");
  await p.keyboard.press("Enter");
  await p.waitForSelector("form[data-trainer], .karte h1");
}
await p.goto(`${B}/trainer/src/statistik`);
const geuebt = await p.locator("table.liste tbody td:nth-child(3)").allTextContents();
ok(geuebt.reduce((s, t) => s + Number(t), 0) === 3, `Statistik zählt 3 geübte Fragen (${geuebt.join("+")})`);

// 5. Prüfung starten, Timer läuft, alle Antworten setzen, abgeben
await p.goto(`${B}/pruefung/src`);
await p.click('form[action="/pruefung/src/start"] button[type="submit"]');
await p.waitForURL(/\/pruefung\/\d+$/);
const timer1 = await p.locator("[data-timer]").textContent();
await p.waitForTimeout(1500);
const timer2 = await p.locator("[data-timer]").textContent();
ok(timer1 !== timer2, `Timer läuft (${timer1.trim()} -> ${timer2.trim()})`);
const fragen = await p.locator(".bogen-frage").count();
ok(fragen >= 10, `Bogen hat ${fragen} Fragen`);
for (let i = 1; i <= fragen; i++) {
  await p.locator(`#frage-${i} input[type="radio"]`).first().check();
}
ok((await p.locator("[data-beantwortet]").textContent()) === String(fragen), "Zähler zeigt alle beantwortet");
// Entwurf überlebt Neuladen
await p.reload();
ok((await p.locator("input[type=radio]:checked").count()) === fragen, "Antworten nach Neuladen wiederhergestellt");
p.once("dialog", (d) => d.accept());
await p.click(".bogen-fuss button[type=submit]");
await p.waitForURL(/\/ergebnis$/);
const ergebnis = await p.locator(".ergebnis h1").textContent();
ok(/Bestanden|Nicht bestanden/.test(ergebnis), `Ergebnis: ${ergebnis.trim()}`);
ok(/von \d+ richtig/.test(await p.locator(".ergebnis-zahl").textContent()), "Punktestand angezeigt");

// 6. Praxis: Lückentext, Reihenfolge, Buchstabieren, Englisch
await p.goto(`${B}/uebung/src/funkverkehr`);
const erste = p.locator(".uebungsliste li a").first();
await erste.click();
if ((await p.locator(".luecke-feld").count()) > 0) {
  await p.locator(".luecke-feld").first().fill("MAYDAY");
  await p.click('main form button[type="submit"]');
  ok((await p.locator("mark.luecke").count()) > 0, "Lückentext ausgewertet");
} else {
  await p.click('main form button[type="submit"]');
  ok((await p.locator(".reihenfolge.auswertung").count()) === 1, "Reihenfolge ausgewertet");
}
await p.goto(`${B}/uebung/buchstabieren?richtung=lesen`);
const codewoerter = (await p.locator(".codewoerter").textContent()).split("·").map((s) => s.trim());
await p.fill('input[name="eingabe"]', "FALSCH");
await p.click('main form button[type="submit"]');
ok((await p.locator(".ergebnis").count()) === 1, `Buchstabieren ausgewertet (${codewoerter.length} Codewörter)`);
await p.goto(`${B}/uebung/src/englisch`);
await p.locator(".uebungsliste li a").first().click();
await p.fill('textarea[name="eingabe"]', "Container treibt auf Position, Gefahr für die Schifffahrt.");
await p.click('main form button[type="submit"]');
ok((await p.locator(".schluesselwoerter").count()) === 1, "Englisch: Schlüsselwörter geprüft");
await p.click('button[name="einschaetzung"][value="richtig"]');
await p.waitForURL(/\/uebung\/src\/englisch$/);
ok((await p.locator(".hinweis").textContent()).includes("gespeichert"), "Selbsteinschätzung gespeichert");

// 6b. Diktat: Textfassung als Tonspur, vollständige Mitschrift = 100 %
await p.goto(`${B}/uebung/src/diktat`);
await p.locator(".uebungsliste li a").first().click();
ok((await p.locator("[data-diktat] details").count()) === 1, "Diktat: Textfassung vorhanden");
ok((await p.locator("[data-diktat-start]").count()) === 1, "Diktat: Abspielknopf vorhanden");
const diktatText = await p.locator("[data-diktat]").getAttribute("data-text");
await p.fill('textarea[name="eingabe"]', diktatText);
await p.click('main form button[type="submit"]');
ok(/100 %/.test(await p.locator("main h2").first().textContent()), "Diktat: vollständige Mitschrift ergibt 100 %");
ok((await p.locator(".diktat-woerter li.falsch").count()) === 0, "Diktat: kein Wort als fehlend markiert");

// 6c. SBF Binnen: Bildfrage mit eigener SVG-Grafik und Schallsignal-Knopf (Frage 4 in der Reihe)
await p.goto(`${B}/trainer/binnen/frage?modul=basis&modus=reihe`);
for (let i = 1; i <= 4; i++) {
  const nr = (await p.locator(".fragekopf").first().textContent().catch(() => "")) || "";
  if ((await p.locator("figure.fragebild img").count()) > 0) {
    ok(/kurz/i.test(await p.locator("figure.fragebild img").getAttribute("alt")), `Bildfrage mit sprechendem Alt-Text (Frage ${i}${nr ? ", " + nr.trim() : ""})`);
    ok((await p.locator("button[data-schall]").count()) === 1, "Schallsignal-Knopf vorhanden");
    break;
  }
  await p.locator('input[type="radio"]').first().check();
  await p.click('form[data-trainer] button[type="submit"]');
  await p.click("a[data-enter]");
}
const svg = await p.request.get(`${B}/bild/binnen/017.svg`);
ok(svg.ok() && (svg.headers()["content-type"] || "").includes("svg") && (await svg.text()).includes("<title"), "eigene SVG wird mit Titel ausgeliefert");

// 7. DSC: Routineanruf komplett durchspielen (PTT wird gehalten und losgelassen)
await p.goto(`${B}/uebung/dsc?kurs=src`);
await p.click('[data-szenario="routine-individual"]');
await p.click('[data-taste="menu"]');
await p.click('[data-taste="runter"]');          // INDIVIDUAL CALL
await p.click('[data-taste="ent"]');
for (const z of "211987650") await p.click(`[data-ziffer="${z}"]`);
await p.click('[data-taste="ent"]');
await p.click('[data-taste="ent"]');              // ROUTINE
await p.click('[data-taste="ent"]');              // CH 72 vorausgewählt
await p.click('[data-taste="ent"]');              // SEND
await p.click('[data-taste="ptt"]');
ok(!(await p.locator("form[data-dsc-ergebnis]").isHidden()), "DSC-Szenario abgeschlossen, Ergebnis speicherbar");
ok((await p.locator("[data-funk-antwort]").textContent()).includes("ALBATROS"), "Funkgerät: Gegenstelle antwortet nach dem Loslassen der PTT");
ok((await p.locator("[data-protokoll] li.ok").count()) >= 6, "alle Schritte des Szenarios erfüllt");
await p.click("form[data-dsc-ergebnis] button");
await p.waitForURL(/\/uebung\/dsc$/);
ok((await p.locator(".hinweis").textContent()).includes("6 von 6"), "DSC-Ergebnis 6 von 6 gespeichert");

// 8. Fortschritt gestiegen, Abmelden, Sperre
await p.goto(`${B}/`);
const prozentNachher = await p.locator(".kurskarte").first().locator(".lernstand-zahl").textContent();
ok(parseInt(prozentNachher, 10) > 0, `SRC-Lernstand jetzt ${prozentNachher.trim()}`);
await p.click('nav form[action="/logout"] button');
await p.waitForURL(`${B}/login`);
await p.goto(`${B}/kurs/src`);
ok(p.url().endsWith("/login"), "nach Abmelden leitet /kurs/src wieder auf /login");
await p.goto(`${B}/admin`);
ok(p.url().endsWith("/login"), "/admin ohne Anmeldung leitet auf /login");

// 9. Hygiene
ok(fehlerJs.length === 0, `keine JavaScript-Fehler${fehlerJs.length ? ": " + fehlerJs.join("; ") : ""}`);
ok(fremd.length === 0, `keine Fremdanfragen${fremd.length ? ": " + fremd.join(", ") : ""}`);

// Screenshots für den Design-Review
const shots = process.env.SCREENSHOTS;
if (shots) {
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await ctx2.newPage();
  await q.goto(`${B}/login`);
  await q.fill('input[name="email"]', email); await q.fill('input[name="passwort"]', passwort);
  await q.click('main button[type="submit"]'); await q.waitForURL(`${B}/`);
  for (const [name, pfad] of [["dashboard", "/"], ["lektion", "/lektion/src/06-notverkehr"], ["trainer", "/trainer/src/frage?modus=zufall"], ["pruefung", "/pruefung/src"], ["dsc", "/uebung/dsc?kurs=src"]]) {
    for (const w of [375, 1280]) {
      await q.setViewportSize({ width: w, height: 900 });
      await q.goto(`${B}${pfad}`);
      await q.screenshot({ path: `${shots}/${name}-${w}.png`, fullPage: w === 1280 });
    }
  }
  await ctx2.close();
}

await b.close();
console.log(failed === 0 ? "\nAlles bestanden." : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
