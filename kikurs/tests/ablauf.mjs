// Browser-Durchlauf der KI-Werkstatt mit echtem PHP-Server — für die lokale
// Abnahme, nicht für CI (braucht Chromium):
//
//   node kikurs/tests/ablauf.mjs
//
// Startet `php -S` mit einer Testkonfiguration, registriert eine
// Teilnehmerin, hakt Lektionen ab, besteht ein Quiz, meldet sich neu an
// (Lernstand muss vom Server kommen), prüft als Kursleitung die Übersicht
// und schaut, dass alle Seiten ohne JavaScript-Fehler laden.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
for (const k of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
  if (!k) continue;
  try { playwright = require(k); break; } catch { /* weiter */ }
}
const kurs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kikurs-ablauf-'));
const hash = (await import('node:child_process')).execFileSync('php', ['-r', 'echo password_hash("leitung-geheim-1", PASSWORD_DEFAULT);']).toString();
fs.writeFileSync(path.join(tmp, 'konfig.php'), `<?php return ['adminEmail' => 'leitung@example.org', 'adminPasswortHash' => '${hash}',
  'einladungscode' => 'KICKOFF26', 'aussteller' => 'Martin Kandzior', 'daten' => '${tmp}/daten', 'salz' => 'x', 'limit' => ['anfragen' => 100, 'fenster' => 3600]];`);
const PORT = 8000 + Math.floor(Math.random() * 900);
const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', path.join(kurs, 'public')], { env: { ...process.env, KIKURS_KONFIG: path.join(tmp, 'konfig.php') }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const BASIS = `http://127.0.0.1:${PORT}/`;

let ok = 0, fehl = 0;
const pruefe = (b, t) => { b ? ok++ : fehl++; console.log((b ? 'OK   ' : 'FEHL ') + t); };
const browser = await playwright.chromium.launch();
const fehler = [];
const neueSeite = async (ctx) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fehler.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_CERT|net::ERR/.test(m.text())) fehler.push(m.text()); });
  return p;
};
try {
  const ctx = await browser.newContext();
  const p = await neueSeite(ctx);
  await p.goto(BASIS);
  await p.waitForSelector('#login-form');
  pruefe(await p.isVisible('#login-form'), 'ohne Anmeldung erscheint das Anmeldeformular');
  await p.click('[data-aktion="zu-registrieren"]');
  await p.fill('#f-code', 'kickoff26');
  await p.fill('#f-name', 'Anna Beispiel');
  await p.fill('#f-email', 'anna@example.org');
  await p.fill('#f-pw', 'sehr-geheim-1');
  await p.click('#reg-form button[type="submit"]');
  await p.waitForSelector('.seitenleiste .konto-zeile strong');
  pruefe((await p.textContent('.konto-zeile strong')) === 'Anna Beispiel', 'Registrierung meldet an, Name in der Seitenleiste');

  await p.goto(BASIS + '#m1');
  await p.waitForSelector('[data-lektion="m1l1"]');
  for (const id of ['m1l1', 'm1l2', 'm1l3', 'm1l4']) {
    await p.evaluate((x) => { document.querySelector(`details[data-id="${x}"]`).open = true; }, id);
    await p.click(`[data-lektion="${id}"]`);
  }
  const m1 = await p.evaluate(() => window.KURS.module.find((m) => m.id === 'm1').quiz.map((q) => q.richtig));
  for (let n = 0; n < m1.length; n++) await p.click(`.quiz .frage[data-n="${n}"] .antwort[data-k="${m1[n]}"]`);
  await p.waitForSelector('.quiz-ergebnis:not([hidden])');
  pruefe((await p.textContent('.quiz-ergebnis')).includes('Bestanden'), 'Quiz Modul 1 bestanden');
  pruefe(await p.isVisible('video.filmvideo'), 'Modulseite zeigt den Erklärfilm');
  const film = await p.evaluate(async () => (await fetch('filme/m1.mp4', { method: 'HEAD' })).status);
  pruefe(film === 200, 'Film m1.mp4 wird ausgeliefert');
  await p.waitForFunction(() => document.querySelector('#sync')?.dataset.status === 'ok', null, { timeout: 8000 });
  pruefe(true, 'Lernstand an den Server übertragen');

  // Ganzen Einstieg abschließen und die Teilnahmebestätigung als PDF holen.
  const einstieg = await p.evaluate(() => window.EINSTIEG.module.map((m) => ({ id: m.id, lektionen: m.lektionen.map((l) => l.id), quiz: m.quiz.map((q) => q.richtig) })));
  for (const m of einstieg) {
    await p.evaluate((h) => { location.hash = h; }, m.id);
    await p.waitForSelector(`[data-lektion="${m.lektionen[0]}"]`, { state: 'attached' });
    for (const id of m.lektionen) {
      await p.evaluate((x) => { document.querySelector(`details[data-id="${x}"]`).open = true; }, id);
      await p.click(`[data-lektion="${id}"]`);
    }
    for (let n = 0; n < m.quiz.length; n++) await p.click(`.quiz .frage[data-n="${n}"] .antwort[data-k="${m.quiz[n]}"]`);
  }
  await p.evaluate(() => { location.hash = 'einstieg-zertifikat'; });
  await p.waitForSelector('[data-aktion="zertifikat-pdf"]:not([disabled])');
  pruefe((await p.textContent('.zertifikat')).includes('Martin Kandzior'), 'Bestätigung nennt den Aussteller aus der Konfiguration');
  const [download] = await Promise.all([p.waitForEvent('download'), p.click('[data-aktion="zertifikat-pdf"]')]);
  const pdfPfad = path.join(tmp, 'bestaetigung.pdf');
  await download.saveAs(pdfPfad);
  const pdf = fs.readFileSync(pdfPfad);
  pruefe(pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 50000 && download.suggestedFilename().includes('Einstieg'), `PDF heruntergeladen (${download.suggestedFilename()}, ${Math.round(pdf.length / 1024)} KB)`);
  console.log('PDF:', pdfPfad);

  // Neuer Browser ohne lokale Daten: Stand muss vom Server kommen.
  const ctx2 = await browser.newContext();
  const p2 = await neueSeite(ctx2);
  await p2.goto(BASIS);
  await p2.waitForSelector('#login-form');
  await p2.fill('#f-email', 'anna@example.org');
  await p2.fill('#f-pw', 'sehr-geheim-1');
  await p2.click('#login-form button[type="submit"]');
  await p2.waitForSelector('.konto-zeile strong');
  pruefe((await p2.$$('.kurskarte')).length === 2, 'nach der Anmeldung: Portal mit zwei Kursen');
  await p2.evaluate(() => { location.hash = 'm1'; });
  await p2.waitForSelector('a.nav-link[href="#m1"]');
  const status = await p2.getAttribute('a.nav-link[href="#m1"]', 'data-status');
  pruefe(status === 'fertig', 'auf einem anderen Gerät ist Modul 1 fertig (Stand vom Server)');
  pruefe((await p2.$('a[href="#teilnehmende"]')) === null, 'Teilnehmerin sieht keine Kursleitungsseite');

  // Kursleitung
  const ctx3 = await browser.newContext();
  const p3 = await neueSeite(ctx3);
  await p3.goto(BASIS);
  await p3.waitForSelector('#login-form');
  await p3.fill('#f-email', 'leitung@example.org');
  await p3.fill('#f-pw', 'leitung-geheim-1');
  await p3.click('#login-form button[type="submit"]');
  await p3.waitForSelector('a[href="#teilnehmende"]');
  await p3.click('a[href="#teilnehmende"]');
  await p3.waitForSelector('.tn-tabelle');
  const zeile = await p3.textContent('.tn-tabelle');
  pruefe(zeile.includes('Anna Beispiel') && zeile.includes('1/10') && zeile.includes('7/7'), 'Kursleitung sieht Anna: Werkstatt 1/10, Einstieg 7/7');
  await p3.fill('#einladung-bemerkung', 'Team Blau');
  await p3.click('#einladung-form button');
  await p3.waitForFunction(() => document.body.textContent.includes('Team Blau'));
  pruefe(true, 'Einmalcode erzeugt und gelistet');
  await p3.screenshot({ path: path.join(tmp, 'teilnehmende.png'), fullPage: true });

  for (const r of ['start', 'einstieg', 'einstieg-plan', 'einstieg-zertifikat', 'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'werkstatt', 'werkstatt-plan', 'plan', 'm0', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'baukasten', 'prompts', 'vorlagen', 'rechner', 'canvas', 'glossar', 'zertifikat', 'konto']) {
    await p3.evaluate((h) => { location.hash = h; }, r);
    await p3.waitForTimeout(80);
  }
  pruefe(fehler.length === 0, 'keine JavaScript-Fehler' + (fehler.length ? ': ' + fehler.join(' | ') : ''));
  console.log('Screenshot Kursleitung:', path.join(tmp, 'teilnehmende.png'));
} finally {
  await browser.close();
  server.kill();
}
console.log(`\n${ok} bestanden, ${fehl} fehlgeschlagen`);
process.exit(fehl ? 1 : 0);
