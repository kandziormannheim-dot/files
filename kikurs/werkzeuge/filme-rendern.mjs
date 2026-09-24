// Erzeugt die deutschen Erklärfilme als MP4 mit Untertiteln (WebVTT) und
// Vorschaubild — aus denselben Szenen, die der Kurs interaktiv zeigt.
//
//   node kikurs/werkzeuge/filme-rendern.mjs            alle Module
//   node kikurs/werkzeuge/filme-rendern.mjs m1 m4      nur diese
//   node kikurs/werkzeuge/filme-rendern.mjs --drehbuch  nur docs/kikurs/DREHBUCH.md
//
// Ablauf je Szene: Chromium rendert public/index.html?film=<modul>&szene=<n>
// als 1280 × 720-Bild, die Tonspur kommt aus einer eigenen Aufnahme
// (kikurs/aufnahmen/<modul>-<n>.wav, falls vorhanden) oder aus der
// Sprachsynthese espeak-ng mit deutscher MBROLA-Stimme. ffmpeg setzt Bild
// und Ton zusammen. Szene 0 ist die Titelkarte.
//
// Voraussetzungen: Node, Playwright mit Chromium, ffmpeg, espeak-ng und
// mbrola-de6 (Ubuntu: apt install ffmpeg espeak-ng mbrola mbrola-de6).
// Andere Stimme: STIMME=mb-de7 (weiblich) oder STIMME=de (espeak, ohne MBROLA).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const hier = path.dirname(fileURLToPath(import.meta.url));
const kurs = path.resolve(hier, '..');
const oeffentlich = path.join(kurs, 'public');
const ziel = path.join(oeffentlich, 'filme');
const aufnahmen = path.join(kurs, 'aufnahmen');
const arbeit = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'kikurs-filme-'));
const STIMME = process.env.STIMME || 'mb-de6';
const TEMPO = process.env.TEMPO || '150';

const require = createRequire(import.meta.url);
let playwright;
for (const kandidat of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
  if (!kandidat) continue;
  try { playwright = require(kandidat); break; } catch { /* nächster */ }
}
if (!playwright) { console.error('Playwright nicht gefunden (PLAYWRIGHT_MODULE setzen).'); process.exit(2); }

// Aussprachehilfen für die deutsche Sprachsynthese. Die Untertitel behalten
// den Originaltext; nur der gesprochene Text wird angepasst.
const AUSSPRACHE = [
  [/\bz\. ?B\./g, 'zum Beispiel'], [/\bn8n\b/g, 'N acht N'], [/\bKI-/g, 'K I-'], [/\bKI\b/g, 'K I'],
  [/\bMCP\b/g, 'M C P'], [/\bJSON\b/g, 'Dschäisen'], [/\bRAG\b/g, 'Rägg'], [/\bDoD\b/g, 'Definition of Done'],
  [/Workflows/g, 'Wörkflous'], [/Workflow/g, 'Wörkflou'], [/Chatbots?/g, (w) => w.replace('Chatbot', 'Tschättbott')],
  [/\bChatGPT\b/g, 'Tschätt G P T'], [/\bClaude\b/g, 'Klohd'], [/\bGemini\b/g, 'Dschemini'], [/\bJira\b/g, 'Dschira'],
  [/\bConfluence\b/g, 'Konfluenz'], [/\bTeams\b/g, 'Tiems'], [/\bTokens\b/g, 'Toukens'], [/\bToken\b/g, 'Touken'],
  [/\bBugs?\b/g, 'Back'], [/\bReview\b/g, 'Riwju'], [/\bUser Story\b/g, 'Juhser Stori'], [/\bWalking Skeleton\b/g, 'Woking Skelleten'],
  [/\bCanvas\b/g, 'Känwes'], [/\bTools?\b/g, 'Tuhl'], [/\bRetro\b/g, 'Retro'], [/\bSprints?\b/g, (w) => w],
  [/\bScrum Master\b/g, 'Skramm Master'], [/\bAgile Coach\b/g, 'Ädschail Koutsch'], [/\bDaily\b/g, 'Däili'],
  [/‚|‘|„|“/g, ''], [/ – /g, ', '],
];
const sprechbar = (t) => AUSSPRACHE.reduce((a, [muster, ersatz]) => a.replace(muster, ersatz), t);

const dauer = (datei) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', datei]).toString().trim());
const vttZeit = (s) => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sek = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sek).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

// Moduldaten aus inhalte.js lesen (ohne Browser).
globalThis.window = {};
await import(pathToFileURL(path.join(oeffentlich, 'einstieg.js')).href);
await import(pathToFileURL(path.join(oeffentlich, 'inhalte.js')).href);
const KURSE = [globalThis.window.EINSTIEG, globalThis.window.KURS];
const K = { module: KURSE.flatMap((k) => k.module.map((m) => Object.assign(m, { kursTitel: k.titel }))) };
const titelSzene = (m) => `Modul ${m.nr}: ${m.titel}. ${m.film.titel.replace(/^Erklärfilm:\s*/, '')}.`;

// --drehbuch: nur das Drehbuch für eigene Sprachaufnahmen schreiben.
if (process.argv.includes('--drehbuch')) {
  const zeilen = ['# KI-Werkstatt — Drehbuch der Erklärfilme', '',
    'Erzeugt von `kikurs/werkzeuge/filme-rendern.mjs --drehbuch` aus `kikurs/public/inhalte.js`.',
    'Wer die Filme mit eigener Stimme vertonen will: je Szene eine WAV-Datei unter',
    '`kikurs/aufnahmen/<Datei>` ablegen und die Filme neu erzeugen. Szenen ohne Aufnahme',
    'behalten die Computerstimme.', ''];
  for (const m of K.module.filter((x) => x.film)) {
    zeilen.push(`## ${m.kursTitel}, Modul ${m.nr}: ${m.film.titel.replace(/^Erklärfilm:\s*/, '')}`, '', '| Datei | Text |', '|---|---|');
    [titelSzene(m)].concat(m.film.szenen.map((s) => s.text)).forEach((t, n) => zeilen.push(`| \`${m.id}-${n}.wav\` | ${t.replace(/\|/g, '\\|')} |`));
    zeilen.push('');
  }
  const datei = path.resolve(kurs, '..', 'docs', 'kikurs', 'DREHBUCH.md');
  fs.writeFileSync(datei, zeilen.join('\n'));
  console.log('Drehbuch geschrieben:', datei);
  process.exit(0);
}

const gewuenscht = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const module = K.module.filter((m) => m.film && (!gewuenscht.length || gewuenscht.includes(m.id)));

fs.mkdirSync(ziel, { recursive: true });
const browser = await playwright.chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
const basis = pathToFileURL(path.join(oeffentlich, 'index.html')).href;

for (const m of module) {
  const szenen = [titelSzene(m)].concat(m.film.szenen.map((s) => s.text));
  const teile = [], cues = [];
  let zeit = 0;
  for (let n = 0; n < szenen.length; n++) {
    await seite.goto(`${basis}?film=${m.id}&szene=${n}`);
    await seite.waitForSelector('body[data-fertig="ja"]', { timeout: 15000 });
    const bild = path.join(arbeit, `${m.id}-${n}.png`);
    await seite.screenshot({ path: bild });

    const eigen = path.join(aufnahmen, `${m.id}-${n}.wav`);
    let ton = eigen;
    if (!fs.existsSync(eigen)) {
      ton = path.join(arbeit, `${m.id}-${n}.wav`);
      execFileSync('espeak-ng', ['-v', STIMME, '-s', TEMPO, '-w', ton, sprechbar(szenen[n])]);
    }
    const pause = n === 0 ? 0.6 : 0.9;
    const laenge = dauer(ton) + pause;
    const teil = path.join(arbeit, `${m.id}-${n}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '25', '-i', bild, '-i', ton,
      '-af', `apad=pad_dur=${pause},aresample=44100`, '-t', laenge.toFixed(3),
      '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'medium', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '25',
      '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-shortest', teil]);
    teile.push(teil);
    if (n > 0) cues.push(`${n}\n${vttZeit(zeit)} --> ${vttZeit(zeit + laenge - 0.2)}\n${m.film.szenen[n - 1].text}\n`);
    zeit += dauer(teil);
    if (n === 1) fs.copyFileSync(bild, path.join(arbeit, `${m.id}-poster.png`));
  }
  const liste = path.join(arbeit, `${m.id}.txt`);
  fs.writeFileSync(liste, teile.map((t) => `file '${t}'`).join('\n'));
  const mp4 = path.join(ziel, `${m.id}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', '-movflags', '+faststart', mp4]);
  fs.writeFileSync(path.join(ziel, `${m.id}.vtt`), 'WEBVTT\n\n' + cues.join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(arbeit, `${m.id}-poster.png`), '-q:v', '5', path.join(ziel, `${m.id}.jpg`)]);
  console.log(`${m.id}: ${szenen.length} Szenen, ${zeit.toFixed(1)} s, ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`);
}
await browser.close();
fs.rmSync(arbeit, { recursive: true, force: true });
