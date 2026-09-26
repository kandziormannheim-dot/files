// Sprachausgabe für alle Kursfilme: ElevenLabs, wenn ein API-Schlüssel da
// ist, sonst die freie deutsche Computerstimme (espeak-ng + MBROLA).
//
//   ELEVENLABS_API_KEY    Schlüssel aus dem ElevenLabs-Konto (Pflicht für ElevenLabs)
//   ELEVENLABS_VOICE_ID   Stimme, z. B. aus der ElevenLabs-Stimmbibliothek
//                         (Vorgabe: eine mehrsprachige Standardstimme)
//   ELEVENLABS_MODEL      Modell (Vorgabe: eleven_multilingual_v2)
//   STIMME=espeak         ElevenLabs bewusst nicht verwenden
//
// Fertige Aufnahmen landen in einem Zwischenspeicher (Text + Stimme als
// Schlüssel), damit ein erneuter Filmlauf keine Zeichen doppelt verbraucht.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCHLUESSEL = process.env.ELEVENLABS_API_KEY || '';
const STIMM_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const MODELL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const ESPEAK_STIMME = process.env.ESPEAK_STIMME || 'mb-de6';
const CACHE = process.env.STIMMEN_CACHE || path.join(os.homedir(), '.cache', 'kikurs-stimmen');

export const quelle = () => (SCHLUESSEL && process.env.STIMME !== 'espeak' ? 'elevenlabs' : 'espeak');

// Aussprachehilfen nur für die Computerstimme; ElevenLabs spricht
// Fachbegriffe und Anglizismen von selbst richtig.
const AUSSPRACHE = [
  [/\bz\. ?B\./g, 'zum Beispiel'], [/\bn8n\b/g, 'N acht N'], [/\bKI-/g, 'K I-'], [/\bKI\b/g, 'K I'],
  [/\bMCP\b/g, 'M C P'], [/\bJSON\b/g, 'Dschäisen'], [/\bRAG\b/g, 'Rägg'], [/\bDoD\b/g, 'Definition of Done'],
  [/Workflows/g, 'Wörkflous'], [/Workflow/g, 'Wörkflou'], [/Chatbots?/g, (w) => w.replace('Chatbot', 'Tschättbott')],
  [/\bChatGPT\b/g, 'Tschätt G P T'], [/\bClaude\b/g, 'Klohd'], [/\bGemini\b/g, 'Dschemini'], [/\bJira\b/g, 'Dschira'],
  [/\bConfluence\b/g, 'Konfluenz'], [/\bTeams\b/g, 'Tiems'], [/\bTokens\b/g, 'Toukens'], [/\bToken\b/g, 'Touken'],
  [/\bBugs?\b/g, 'Back'], [/\bReview\b/g, 'Riwju'], [/\bUser Story\b/g, 'Juhser Stori'], [/\bWalking Skeleton\b/g, 'Woking Skelleten'],
  [/\bCanvas\b/g, 'Känwes'], [/\bTools?\b/g, 'Tuhl'], [/\bScrum Master\b/g, 'Skramm Master'], [/\bAgile Coach\b/g, 'Ädschail Koutsch'],
  [/\bDaily\b/g, 'Däili'], [/\bPublish\b/g, 'Pablisch'], [/\bExecute\b/g, 'Exekjut'], [/\bImport\b/g, 'Import'],
  [/\bGems?\b/g, (w) => w.replace('Gem', 'Dschem')], [/\bPrompts?\b/g, (w) => w], [/\bUpload\b/g, 'Aplohd'],
  [/‚|‘|„|“/g, ''], [/ – /g, ', '],
];
export const sprechbar = (t) => AUSSPRACHE.reduce((a, [muster, ersatz]) => a.replace(muster, ersatz), t);

export const dauer = (datei) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', datei]).toString().trim());

/** Text sprechen und als WAV (44,1 kHz, mono) nach `ziel` schreiben. */
export async function sprechen(text, ziel) {
  fs.mkdirSync(CACHE, { recursive: true });
  if (quelle() === 'elevenlabs') {
    const schluessel = crypto.createHash('sha256').update([MODELL, STIMM_ID, text].join('|')).digest('hex').slice(0, 24);
    const mp3 = path.join(CACHE, schluessel + '.mp3');
    if (!fs.existsSync(mp3)) {
      const antwort = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${STIMM_ID}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': SCHLUESSEL, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: MODELL, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 } }),
      });
      if (!antwort.ok) throw new Error(`ElevenLabs antwortet mit HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`);
      fs.writeFileSync(mp3, Buffer.from(await antwort.arrayBuffer()));
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '44100', '-ac', '1', ziel]);
    return ziel;
  }
  execFileSync('espeak-ng', ['-v', ESPEAK_STIMME, '-s', process.env.TEMPO || '150', '-w', ziel, sprechbar(text)]);
  return ziel;
}
