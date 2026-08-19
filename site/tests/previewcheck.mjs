import { chromium } from 'playwright';
// WebGPU aus: SwiftShader verliert das Device, der WebGL-Fallback der
// Tubes-Bibliothek rendert stabil (gleiche Einstellung wie beim
// Standalone-Beleg).
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--disable-features=WebGPU'],
});
let failed = 0;
const ok = (c, m) => { if (!c) failed++; console.log(`${c ? 'OK  ' : 'FEHL'} ${m}`); };

// Die Vorschau-Datei so laden, wie das Artifact sie ausliefert: als Fragment
// in einem fremden Geruest, OHNE Zugriff auf lokale Dateien oder Server.
import { readFileSync } from 'node:fs';
const fragment = readFileSync('kandzior-vorschau.html', 'utf8');

const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const anfragen = [];
p.on('request', r => { if (!r.url().startsWith('data:') && !r.url().startsWith('about:')) anfragen.push(r.url()); });
const fehler = [];
p.on('pageerror', e => fehler.push(String(e)));

await p.setContent(`<!doctype html><html><head></head><body>${fragment}</body></html>`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);

ok(fehler.length === 0, `Skriptfehler: ${fehler.length ? fehler.join(' | ').slice(0,200) : 'keine'}`);
ok(anfragen.length === 0, `Netzanfragen: ${anfragen.length ? anfragen.slice(0,3).join(', ') : 'KEINE — vollstaendig eigenstaendig'}`);

const schrift = await p.evaluate(async () => {
  await document.fonts.ready;
  return {
    pjs: document.fonts.check('600 32px "Space Grotesk"'),
    bvp: document.fonts.check('400 17px "Lato"'),
  };
});
ok(schrift.pjs && schrift.bvp, `Schriften aus Daten-URIs geladen -> Grotesk:${schrift.pjs} Lato:${schrift.bvp}`);

// Der Tubes-Effekt muss auch in der Vorschau laufen: Er lädt erst bei
// Zeigerbewegung — die CSP des Artifact-Viewers erlaubt keine data:-
// Importe, deshalb liegt die Bibliothek inline (window.__TubesCursor).
await p.mouse.move(200, 200);
await p.mouse.move(700, 400, { steps: 15 });
await p.waitForFunction(
  () => document.querySelector('#hero')?.dataset.tubesAktiv === 'ja',
  { timeout: 8000 },
).catch(() => {});
const tubes = await p.evaluate(() => ({
  inline: typeof window.__TubesCursor === 'function',
  aktiv: document.querySelector('#hero')?.dataset.tubesAktiv,
  hint: !document.querySelector('[data-tubes-hint]')?.hidden,
}));
ok(
  tubes.inline && tubes.aktiv === 'ja' && tubes.hint,
  `Tubes-Effekt läuft in der Vorschau -> inline:${tubes.inline} aktiv:${tubes.aktiv} hint:${tubes.hint}`,
);

const bereiche = await p.$$eval('main > section', els => els.map(e => e.id));
ok(bereiche.join(',') === 'hero,proof,expertise,outlook,about,social,contact', `alle Bereiche -> ${bereiche.join(' → ')}`);

// Theme-Umschalter funktioniert in der Vorschau. v3 ist dark-first:
// Ohne Attribut ist die Seite dunkel, der erste Klick fuehrt zu hell.
const vorher = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
await p.click('[data-theme-toggle]');
// Attribut statt Farbe: Die Flaeche wechselt mit 250ms Uebergang, das
// Attribut sofort.
const attr = await p.getAttribute('html', 'data-theme');
await p.waitForTimeout(350);
const hell = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
ok(
  vorher === 'rgb(8, 8, 15)' && attr === 'light' && hell === 'rgb(255, 255, 255)',
  `Theme-Umschalter wirkt -> Start ${vorher}, Klick -> ${attr}, ${hell}`,
);
await p.click('[data-theme-toggle]');

// Tabs funktionieren
await p.click('#tab-x');
ok(await p.isVisible('#panel-x'), 'Tabwechsel funktioniert');

// Interner Link zeigt den Hinweis statt zu navigieren
await p.evaluate(() => document.querySelector('.footer__legal a').click());
await p.waitForTimeout(300);
const toast = await p.textContent('#preview-toast');
const nochDa = await p.evaluate(() => location.href.startsWith('about:') || document.querySelector('#hero') !== null);
ok(nochDa && /Vorschau/.test(toast), `interner Link -> Hinweis statt Navigation: „${toast.slice(0, 50)}…"`);

// Formular-Validierung lebt
await p.click('.contact__submit');
const meldungen = await p.$$eval('.field__error', els => els.filter(e => !e.hidden).length);
ok(meldungen === 3, `Formular-Validierung aktiv -> ${meldungen} Meldungen`);

await b.close();
console.log(failed === 0 ? '\nVorschau funktioniert eigenstaendig.' : `\n${failed} Problem(e).`);
process.exit(failed ? 1 : 0);
