import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
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
    pjs: document.fonts.check('700 32px "Plus Jakarta Sans"'),
    bvp: document.fonts.check('400 17px "Be Vietnam Pro"'),
  };
});
ok(schrift.pjs && schrift.bvp, `Schriften aus Daten-URIs geladen -> PJS:${schrift.pjs} BVP:${schrift.bvp}`);

const bereiche = await p.$$eval('main > section', els => els.map(e => e.id));
ok(bereiche.join(',') === 'hero,proof,expertise,outlook,about,social,contact', `alle Bereiche -> ${bereiche.join(' → ')}`);

// Theme-Umschalter funktioniert in der Vorschau
await p.click('[data-theme-toggle]');
// Attribut statt Farbe: Die Flaeche wechselt mit 250ms Uebergang, das
// Attribut sofort.
const attr = await p.getAttribute('html', 'data-theme');
await p.waitForTimeout(350);
const dunkel = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
ok(attr === 'dark' && dunkel === 'rgb(15, 23, 42)', `Theme-Umschalter wirkt -> ${attr}, ${dunkel}`);
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
