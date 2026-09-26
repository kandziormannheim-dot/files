// Bildschirmfilme für die Schritt-für-Schritt-Anleitungen: Chromium bedient
// eine echte Oberfläche (z. B. n8n) oder eine Demo-Seite, Playwright nimmt
// das Bild auf, ein eingeblendeter Mauszeiger macht Klicks sichtbar. Jeder
// Schritt hat einen gesprochenen Text (stimme.mjs); der Schritt dauert so
// lange wie seine Sprache, mindestens aber so lange wie seine Aktion.
// Untertitel stehen in einem Band unter dem Bild, damit sie nichts verdecken.
//
// Ergebnis: <ziel>/<id>.mp4 (1280 × 820), <id>.vtt, <id>.jpg (Vorschaubild).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { sprechen, dauer } from './stimme.mjs';

const require = createRequire(import.meta.url);
let playwright;
for (const k of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
  if (!k) continue;
  try { playwright = require(k); break; } catch { /* nächster */ }
}

const B = 1280, H = 720, BAND = 100;
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const vtt = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const z = (n, l = 2) => String(n).padStart(l, '0');
  return `${z(Math.floor(ms / 3600000))}:${z(Math.floor(ms / 60000) % 60)}:${z(Math.floor(ms / 1000) % 60)}.${z(ms % 1000, 3)}`;
};

// Mauszeiger und Hervorhebung, in jede Seite eingespritzt (auch Pop-ups).
const OVERLAY = `(() => {
  if (window.__kc) return; window.__kc = true;
  const los = () => {
    const z = document.createElement('div');
    z.id = '__kc-zeiger';
    z.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.3 L17.5 13 Z" fill="#14222a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    z.style.cssText = 'position:fixed;left:-50px;top:-50px;z-index:2147483647;pointer-events:none;transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))';
    document.documentElement.appendChild(z);
    addEventListener('mousemove', (e) => { z.style.left = (e.clientX - 3) + 'px'; z.style.top = (e.clientY - 2) + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:3px solid #f4d35e;background:rgba(244,211,94,.35);width:14px;height:14px;left:' + (e.clientX - 7) + 'px;top:' + (e.clientY - 7) + 'px;transition:all .45s ease-out;opacity:1';
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.width = r.style.height = '54px'; r.style.left = (e.clientX - 27) + 'px'; r.style.top = (e.clientY - 27) + 'px'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', los); else los();
  window.__kcRahmen = (x, y, w, h) => {
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;border:3px solid #f4d35e;border-radius:10px;box-shadow:0 0 0 4000px rgba(20,34,42,.18);transition:opacity .3s;left:' + (x - 6) + 'px;top:' + (y - 6) + 'px;width:' + (w + 12) + 'px;height:' + (h + 12) + 'px';
    document.documentElement.appendChild(r);
    setTimeout(() => { r.style.opacity = '0'; setTimeout(() => r.remove(), 350); }, 1600);
  };
})();`;

// Aufnahme über das Chrome-Screencast-Protokoll: Jedes Bild kommt mit
// seinem Zeitstempel, der Schnitt setzt die Bilder später genau auf die
// Uhrzeit der Schritte. (Playwrights eingebaute Videoaufnahme verliert über
// einige Minuten mehrere Sekunden und lässt Bild und Stimme auseinanderlaufen.)
async function screencastStarten(ctx, seite, ordner, bilder) {
  const sitzung = await ctx.newCDPSession(seite);
  const liste = []; bilder.set(seite, liste);
  let n = 0;
  sitzung.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const datei = path.join(ordner, `${bilder.size}-${String(n++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(datei, Buffer.from(data, 'base64'));
    liste.push({ t: metadata.timestamp * 1000, datei });
    sitzung.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await sitzung.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: B, maxHeight: H, everyNthFrame: 1 });
  return sitzung;
}

/** Untertitelband (1280 × 100) als PNG rendern. */
async function bandBild(browser, text, datei, kopf) {
  const p = await browser.newPage({ viewport: { width: B, height: BAND } });
  await p.setContent(`<html><body style="margin:0;width:${B}px;height:${BAND}px;background:#14222a;color:#fff;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box;font:500 23px/1.35 'IBM Plex Sans','DejaVu Sans',Arial,sans-serif">
    <span style="flex:none;background:#f4d35e;color:#14222a;font:700 15px/1 'IBM Plex Mono','DejaVu Sans Mono',monospace;padding:7px 10px;border-radius:6px;letter-spacing:.06em">${kopf}</span>
    <span>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></body></html>`);
  await p.screenshot({ path: datei });
  await p.close();
}

/** Titelkarte (1280 × 820) als PNG. */
async function titelBild(browser, film, datei) {
  const p = await browser.newPage({ viewport: { width: B, height: H + BAND } });
  await p.setContent(`<html><body style="margin:0;width:${B}px;height:${H + BAND}px;background:#eef2f0;display:grid;place-content:center;justify-items:start;gap:18px;padding:0 140px;box-sizing:border-box;font-family:'IBM Plex Sans','DejaVu Sans',Arial,sans-serif;color:#14222a">
    <svg width="76" height="76" viewBox="0 0 38 38"><rect x="1" y="1" width="36" height="36" rx="8" fill="#0d6e66"/><rect x="8" y="9" width="9" height="9" rx="2" fill="#f4d35e"/><rect x="21" y="9" width="9" height="9" rx="2" fill="#fff"/><rect x="8" y="21" width="9" height="9" rx="2" fill="#fff"/><path d="M21 25.5 l3 3 l6-7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div style="font:600 17px 'IBM Plex Mono','DejaVu Sans Mono',monospace;letter-spacing:.12em;color:#4a5b62;text-transform:uppercase">KI-ckoff · Schritt-für-Schritt-Anleitung</div>
    <div style="font:700 62px/1.1 'Bricolage Grotesque','DejaVu Sans',Arial,sans-serif;max-width:24ch">${film.titel}</div>
    <div style="font-size:26px;color:#4a5b62;max-width:48ch">${film.untertitel}</div>
    ${film.hinweis ? `<div style="margin-top:14px;font-size:18px;color:#a6521b;background:#f8e2d2;padding:10px 14px;border-radius:8px;max-width:60ch">${film.hinweis}</div>` : ''}
  </body></html>`);
  await p.screenshot({ path: datei });
  await p.close();
}

/**
 * Einen Film aufnehmen.
 * film = { id, titel, untertitel, hinweis?, kontext?, start: async (h) => {}, schritte: [{ text, aktion: async (h) => {} }] }
 */
export async function aufnehmen(film, ziel) {
  if (!playwright) throw new Error('Playwright nicht gefunden (PLAYWRIGHT_MODULE setzen).');
  const arbeit = fs.mkdtempSync(path.join(os.tmpdir(), `kc-${film.id}-`));
  const browser = await playwright.chromium.launch();
  const log = (...a) => console.log(`[${film.id}]`, ...a);

  // 1. Sprache für Titel und Schritte vorab erzeugen.
  const titelText = `${film.titel}. ${film.untertitel}`;
  const titelWav = await sprechen(titelText, path.join(arbeit, 'titel.wav'));
  const wavs = [];
  for (let i = 0; i < film.schritte.length; i++) {
    const w = path.join(arbeit, `s${i}.wav`);
    await sprechen(film.schritte[i].text, w);
    wavs.push({ datei: w, laenge: dauer(w) });
  }
  log(`Sprache fertig: ${wavs.length} Schritte, ${wavs.reduce((a, w) => a + w.laenge, 0).toFixed(0)} s`);

  // 2. Aufnahme.
  const ctx = await browser.newContext(Object.assign({ viewport: { width: B, height: H }, deviceScaleFactor: 1 }, film.kontext || {}));
  await ctx.addInitScript(OVERLAY);
  const bilderOrdner = path.join(arbeit, 'bilder'); fs.mkdirSync(bilderOrdner);
  const bilder = new Map();
  const erste = await ctx.newPage();
  const zustand = { seite: erste, maus: { x: B / 2, y: H / 2 } };
  const segmente = [];
  let segStart = null;
  const segmentWechsel = async (neu) => {
    if (segStart !== null) segmente.push({ seite: zustand.seite, von: segStart, bis: Date.now() });
    if (neu && !bilder.has(neu)) { await screencastStarten(ctx, neu, bilderOrdner, bilder); await new Promise((r) => setTimeout(r, 300)); }
    zustand.seite = neu; segStart = Date.now();
  };

  const h = {
    get seite() { return zustand.seite; },
    ctx,
    warten: (ms) => new Promise((r) => setTimeout(r, ms)),
    async hin(ziel, opt = {}) {
      const el = typeof ziel === 'string' ? zustand.seite.locator(ziel).first() : ziel;
      await el.waitFor({ state: 'visible', timeout: opt.timeout || 15000 });
      const box = await el.boundingBox();
      const x = box.x + box.width * (opt.dx ?? 0.5), y = box.y + box.height * (opt.dy ?? 0.5);
      await zustand.seite.mouse.move(x, y, { steps: opt.schritte || 22 });
      zustand.maus = { x, y };
      if (opt.rahmen) await zustand.seite.evaluate(([a, b, c, d]) => window.__kcRahmen && window.__kcRahmen(a, b, c, d), [box.x, box.y, box.width, box.height]);
      return { el, box, x, y };
    },
    async klick(ziel, opt = {}) {
      const { x, y } = await h.hin(ziel, opt);
      await h.warten(opt.vorher ?? 250);
      await zustand.seite.mouse.click(x, y, { clickCount: opt.doppel ? 2 : 1 });
      await h.warten(opt.nachher ?? 500);
    },
    async tippen(ziel, text, opt = {}) {
      await h.klick(ziel, { nachher: 150 });
      await zustand.seite.keyboard.type(text, { delay: opt.tempo ?? 45 });
      await h.warten(300);
    },
    async ziehen(von, nach, opt = {}) {
      const a = await h.hin(von, { rahmen: true });
      await h.warten(500);
      await zustand.seite.mouse.down();
      const zielEl = typeof nach === 'string' ? zustand.seite.locator(nach).first() : nach;
      const box = await zielEl.boundingBox();
      const x = box.x + box.width * (opt.dx ?? 0.5), y = box.y + box.height * (opt.dy ?? 0.5);
      await zustand.seite.mouse.move(a.x + 12, a.y + 6, { steps: 4 });
      await zustand.seite.mouse.move(x, y, { steps: 35 });
      await h.warten(350);
      await zustand.seite.mouse.up();
      zustand.maus = { x, y };
      await h.warten(opt.nachher ?? 800);
    },
    async zeigen(ziel, opt = {}) { await h.hin(ziel, Object.assign({ rahmen: true }, opt)); await h.warten(opt.nachher ?? 600); },
    async wechsel(seite) { await segmentWechsel(seite); },
    async neuesFenster(ausloeser) {
      const [neu] = await Promise.all([ctx.waitForEvent('page'), ausloeser()]);
      await neu.setViewportSize({ width: B, height: H });
      await neu.waitForLoadState();
      return neu;
    },
  };

  if (film.start) await film.start(h);             // Vorbereitung, landet nicht im Film
  await h.warten(400);
  await segmentWechsel(zustand.seite);
  const aufnahmeStart = segStart;
  const zeiten = [];
  for (let i = 0; i < film.schritte.length; i++) {
    const s = film.schritte[i];
    const t0 = Date.now();
    zeiten.push((t0 - aufnahmeStart) / 1000);
    try { if (s.aktion) await s.aktion(h); }
    catch (e) { await zustand.seite.screenshot({ path: path.join(arbeit, `fehler-${i}.png`) }); throw new Error(`Schritt ${i + 1} („${s.text.slice(0, 40)} …“): ${e.message} — Bildschirmfoto: ${arbeit}/fehler-${i}.png`); }
    const rest = t0 + (wavs[i].laenge + (s.pause ?? 0.7)) * 1000 - Date.now();
    if (rest > 0) await h.warten(rest);
    log(`Schritt ${i + 1}/${film.schritte.length}`);
  }
  zeiten.push((Date.now() - aufnahmeStart) / 1000);
  await segmentWechsel(null);
  await h.warten(300);
  await ctx.close();

  // 3. Bild zusammensetzen: Für jeden Zeitraum das jeweils letzte Bild der
  //    aktiven Seite, so lange gezeigt, bis das nächste kommt.
  const eintraege = [];
  for (const seg of segmente.filter((sg) => sg.seite && sg.bis > sg.von)) {
    const liste = (bilder.get(seg.seite) || []).slice().sort((a, b) => a.t - b.t);
    if (!liste.length) throw new Error('Keine Bilder für eine Seite aufgenommen.');
    let i = liste.findLastIndex((b) => b.t <= seg.von); if (i < 0) i = 0;
    let t = seg.von;
    while (t < seg.bis) {
      const naechstes = liste[i + 1] && liste[i + 1].t < seg.bis ? liste[i + 1].t : seg.bis;
      const d = Math.max(0, naechstes - t);
      if (d > 0) eintraege.push({ datei: liste[i].datei, d: d / 1000 });
      t = naechstes; i++;
      if (i >= liste.length) { i = liste.length - 1; if (t < seg.bis) { eintraege.push({ datei: liste[i].datei, d: (seg.bis - t) / 1000 }); t = seg.bis; } }
    }
  }
  const liste = path.join(arbeit, 'liste.txt');
  fs.writeFileSync(liste, eintraege.map((e) => `file '${e.datei}'\nduration ${e.d.toFixed(3)}`).join('\n') + `\nfile '${eintraege[eintraege.length - 1].datei}'\n`);
  const roh = path.join(arbeit, 'roh.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', liste, '-vf', `scale=${B}:${H}:force_original_aspect_ratio=decrease,pad=${B}:${H}:(ow-iw)/2:(oh-ih)/2:color=white,fps=25,setsar=1`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', roh]);

  // 4. Untertitelbänder, Titelkarte, Ton.
  const titelLaenge = dauer(titelWav) + 1.2;
  const titelPng = path.join(arbeit, 'titel.png');
  await titelBild(browser, film, titelPng);
  const baender = [];
  for (let i = 0; i < film.schritte.length; i++) {
    const png = path.join(arbeit, `band${i}.png`);
    await bandBild(browser, film.schritte[i].text, png, `SCHRITT ${i + 1}/${film.schritte.length}`);
    baender.push(png);
  }
  await browser.close();

  const titelMp4 = path.join(arbeit, 'titel.mp4');
  ff(['-loop', '1', '-framerate', '25', '-i', titelPng, '-t', titelLaenge.toFixed(3), '-vf', 'setsar=1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', titelMp4]);
  // Bänder unter das Bild setzen, jedes für seinen Zeitraum.
  const eingaben = ['-i', roh]; baender.forEach((b) => eingaben.push('-i', b));
  let filter = `[0:v]pad=${B}:${H + BAND}:0:0:color=#14222a[v0]`;
  baender.forEach((_, i) => { filter += `;[v${i}][${i + 1}:v]overlay=0:${H}:enable='between(t,${zeiten[i].toFixed(2)},${(zeiten[i + 1] - 0.01).toFixed(2)})'[v${i + 1}]`; });
  const mitBand = path.join(arbeit, 'mitband.mp4');
  ff([...eingaben, '-filter_complex', filter, '-map', `[v${baender.length}]`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', mitBand]);
  const liste2 = path.join(arbeit, 'liste2.txt');
  fs.writeFileSync(liste2, [titelMp4, mitBand].map((t) => `file '${t}'`).join('\n'));
  const bild = path.join(arbeit, 'bild.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', liste2, '-c', 'copy', bild]);

  // Tonspur: Titel bei 0,4 s, jeder Schritt zu seinem Beginn.
  const ton = ['-i', titelWav]; wavs.forEach((w) => ton.push('-i', w.datei));
  const verz = [0.4 + 0, ...zeiten.slice(0, -1).map((z) => titelLaenge + z + 0.15)];
  let af = verz.map((v, i) => `[${i}:a]aresample=44100,adelay=${Math.round(v * 1000)}|${Math.round(v * 1000)}[a${i}]`).join(';');
  af += ';' + verz.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${verz.length}:normalize=0:dropout_transition=0[aus]`;
  const tonDatei = path.join(arbeit, 'ton.m4a');
  ff([...ton, '-filter_complex', af, '-map', '[aus]', '-c:a', 'aac', '-b:a', '96k', '-ac', '1', tonDatei]);

  fs.mkdirSync(ziel, { recursive: true });
  const mp4 = path.join(ziel, `${film.id}.mp4`);
  ff(['-i', bild, '-i', tonDatei, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', mp4]);
  const cues = film.schritte.map((s, i) => `${i + 1}\n${vtt(titelLaenge + zeiten[i])} --> ${vtt(titelLaenge + zeiten[i + 1] - 0.05)}\n${s.text}\n`);
  fs.writeFileSync(path.join(ziel, `${film.id}.vtt`), 'WEBVTT\n\n' + cues.join('\n'));
  ff(['-ss', (titelLaenge + (zeiten[1] ?? 1)).toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '5', path.join(ziel, `${film.id}.jpg`)]);
  const gesamt = titelLaenge + zeiten[zeiten.length - 1];
  log(`fertig: ${mp4} (${gesamt.toFixed(0)} s, ${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB)`);
  if (!process.env.BEHALTEN) fs.rmSync(arbeit, { recursive: true, force: true });
  return { mp4, dauer: gesamt };
}
