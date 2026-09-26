// Schritt-für-Schritt-Anleitungen als Bildschirmfilme (public/anleitungen/).
//
//   node kikurs/werkzeuge/anleitungen.mjs              alle Filme
//   node kikurs/werkzeuge/anleitungen.mjs n8n-import   nur einen
//
// n8n-Filme brauchen ein laufendes n8n (Vorgabe http://127.0.0.1:5678) mit
// einem Konto: N8N_URL, N8N_EMAIL, N8N_PASSWORT. So lassen sie sich auf
// jeder Version neu drehen, wenn sich die Oberfläche ändert (siehe
// docs/kikurs/README.md, Abschnitt „Anleitungsfilme“).
// Claude und Gemini zeigen vereinfachte Nachbildungen (werkzeuge/demos/),
// weil sich echte Konten nicht automatisiert aufnehmen lassen.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aufnehmen } from './bildschirmfilm.mjs';
import { quelle } from './stimme.mjs';

const hier = path.dirname(fileURLToPath(import.meta.url));
const ZIEL = path.resolve(hier, '..', 'public', 'anleitungen');
const VORLAGEN = path.resolve(hier, '..', 'public', 'vorlagen');
const N8N = process.env.N8N_URL || 'http://127.0.0.1:5678';
const N8N_EMAIL = process.env.N8N_EMAIL || 'kurs@example.org';
const N8N_PASSWORT = process.env.N8N_PASSWORT || 'KursDemo2026!';
const DEMO = (name) => pathToFileURL(path.join(hier, 'demos', name)).href;

// Vor jeder Aufnahme leeren Stand herstellen: Workflows und Läufe der
// Demo-Instanz löschen (nur mit N8N_DB, dem Pfad zur SQLite-Datenbank).
function n8nAufraeumen() {
  if (!process.env.N8N_DB) return;
  execFileSync('python3', ['-c', `import sqlite3,sys
c=sqlite3.connect(sys.argv[1]); c.execute('PRAGMA foreign_keys=ON')
for t in ('execution_entity','shared_workflow','workflow_entity'):
    try: c.execute('DELETE FROM '+t)
    except Exception as e: print(t, e)
c.commit()`, process.env.N8N_DB]);
}

async function n8nAnmelden(h) {
  n8nAufraeumen();
  await h.seite.goto(N8N + '/signin');
  await h.seite.fill('input[type=email], input[name=emailOrLdapLoginId]', N8N_EMAIL);
  await h.seite.fill('input[type=password]', N8N_PASSWORT);
  await h.seite.keyboard.press('Enter');
  await h.seite.waitForURL(/home/, { timeout: 20000 });
  await h.seite.waitForTimeout(1500);
}
async function n8nNeuerWorkflowMitVorlage(h, datei) {
  await h.seite.goto(N8N + '/workflow/new');
  await h.seite.waitForSelector('[data-test-id="workflow-menu"]');
  await h.seite.waitForTimeout(1200);
  await h.klick('[data-test-id="workflow-menu"]');
  await h.hin('[data-test-id="workflow-menu-item-import"]');
  await h.warten(600);
  const [wahl] = await Promise.all([h.seite.waitForEvent('filechooser'), h.klick('[data-test-id="workflow-menu-item-import-from-file"]')]);
  await wahl.setFiles(path.join(VORLAGEN, datei));
  await h.warten(1500);
  await h.klick('[data-test-id="zoom-to-fit"]');
}
const knoten = (name) => `[data-test-id="canvas-node"][data-node-name="${name}"]`;

export const FILME = [
  {
    id: 'n8n-import',
    titel: 'n8n: eine Vorlage importieren und testen',
    untertitel: 'Der Impediment-Melder aus Modul 4, Schritt für Schritt auf eurem n8n-Server',
    start: n8nAnmelden,
    schritte: [
      { text: 'Du bist in n8n angemeldet. Über das Plus-Zeichen oben links legst du einen neuen, leeren Workflow an.',
        aktion: async (h) => { await h.klick('[data-test-id="universal-add"]'); await h.klick('[data-test-id="navigation-menu-item"]:has-text("New workflow"), [data-test-id="navigation-menu-item"]:has-text("Workflow")'); await h.warten(1200); } },
      { text: 'Neben dem Namen des Workflows öffnen die drei Punkte ein Menü. Dort findest du den Eintrag Import.',
        aktion: async (h) => { await h.klick('[data-test-id="workflow-menu"]'); await h.hin('[data-test-id="workflow-menu-item-import"]'); } },
      { text: 'Wähle „From file“ und dann die Vorlagendatei aus dem Kurs, hier den Impediment-Melder. Mit einem Klick auf „Zoom to fit“ siehst du alles auf einen Blick.',
        aktion: async (h) => {
          const [wahl] = await Promise.all([h.seite.waitForEvent('filechooser'), h.klick('[data-test-id="workflow-menu-item-import-from-file"]')]);
          await wahl.setFiles(path.join(VORLAGEN, 'impediment-melder.n8n.json'));
          await h.warten(1500); await h.klick('[data-test-id="zoom-to-fit"]');
        } },
      { text: 'Der Workflow ist da. Links der Auslöser, das Formular. In der Mitte die Weiche. Rechts die Nachricht an dich. Die Notiz oben erklärt, was nach dem Import noch zu tun ist.',
        aktion: async (h) => {
          await h.zeigen('[data-test-id="canvas-trigger-node"]'); await h.zeigen(knoten('Stark?'));
          await h.zeigen(knoten('Nachricht an Scrum Master')); await h.zeigen('.vue-flow__node:not(:has([data-test-id="canvas-node"]))');
        } },
      { text: 'Ein Doppelklick auf das Formular öffnet seine Einstellungen: Titel, Beschreibung und die drei Felder. Hier passt du alles an dein Team an.',
        aktion: async (h) => { await h.klick('[data-test-id="canvas-trigger-node"]', { doppel: true, nachher: 1500 }); await h.hin('text=Form Elements'); await h.seite.mouse.wheel(0, 380); await h.warten(900); } },
      { text: 'Mit der Escape-Taste geht es zurück auf die Arbeitsfläche.',
        aktion: async (h) => { await h.seite.keyboard.press('Escape'); await h.warten(700); } },
      { text: 'Die Weiche prüft die Stärke des Hindernisses. Nur bei Stufe drei, blockiert, geht es oben weiter zur Nachricht. Alles andere läuft unten aus, ohne Nachricht.',
        aktion: async (h) => { await h.klick(knoten('Stark?'), { doppel: true, nachher: 1800 }); await h.seite.keyboard.press('Escape'); await h.warten(500); } },
      { text: 'Das kleine Warndreieck heißt: Hier fehlen noch Zugangsdaten für den E-Mail-Versand. Die legst du einmal an, oder du tauschst den Knoten gegen Teams oder Slack.',
        aktion: async (h) => { await h.zeigen(`${knoten('Nachricht an Scrum Master')} [data-test-id="node-issues"]`); } },
      { text: 'Jetzt testen wir. Ein Klick auf „Execute workflow“, und n8n öffnet das Testformular in einem neuen Fenster.',
        aktion: async (h) => {
          const neu = await h.neuesFenster(() => h.klick('[data-test-id="execute-workflow-button"]'));
          await neu.waitForSelector('textarea'); await h.warten(400); await h.wechsel(neu); await h.warten(800);
        } },
      { text: 'So sieht dein Team das Formular. Wir tragen ein Hindernis ein: Die Testumgebung ist seit gestern nicht erreichbar. Stärke zwei.',
        aktion: async (h) => {
          await h.tippen('textarea', 'Die Testumgebung ist nicht erreichbar.');
          await h.tippen('input[name="field-1"], input#field-1', 'seit gestern');
          await h.hin('select'); await h.seite.selectOption('select', { label: '2 – bremst' }); await h.warten(600);
        } },
      { text: 'Abschicken.',
        aktion: async (h) => { await h.klick('button#submit-btn, button[type="submit"]', { nachher: 1500 }); } },
      { text: 'Zurück im Editor siehst du den Durchlauf. Grüne Haken zeigen, welche Schritte gelaufen sind. Bei Stärke zwei ging es unten aus der Weiche heraus, also ohne Nachricht.',
        aktion: async (h) => { const editor = h.ctx.pages()[0]; await editor.bringToFront(); await h.wechsel(editor); await h.warten(600); await h.zeigen(knoten('Stark?')); } },
      { text: 'Unter „Executions“ steht jeder Lauf mit allen Daten. Das ist dein wichtigstes Werkzeug bei der Fehlersuche.',
        aktion: async (h) => { await h.klick('[data-test-id="radio-button-executions"]', { nachher: 1800 }); await h.hin(h.seite.getByText('Succeeded').first(), { timeout: 5000 }).catch(() => {}); } },
      { text: 'Wenn alles passt, klickst du oben rechts auf „Publish“. Ab dann läuft der Workflow dauerhaft, und dein Team bekommt den Link zum Produktionsformular.',
        aktion: async (h) => { await h.klick('[data-test-id="radio-button-workflow"]', { nachher: 900 }); await h.zeigen('[data-test-id="workflow-open-publish-modal-button"]'); } },
      { text: 'Geschafft. Im nächsten Film kommt ein KI-Schritt dazu: der Retro-Radar.', pause: 1.2 },
    ],
  },
  {
    id: 'n8n-bauen',
    titel: 'n8n: den ersten Workflow selbst bauen',
    untertitel: 'Formular anlegen, testen und die Antworten mit Drag-and-drop weiterverarbeiten',
    start: n8nAnmelden,
    schritte: [
      { text: 'Wir bauen einen Workflow von Grund auf: ein kurzes Feedback-Formular zum Daily. Zuerst ein neuer, leerer Workflow.',
        aktion: async (h) => { await h.klick('[data-test-id="universal-add"]'); await h.klick('[data-test-id="navigation-menu-item"]:has-text("Workflow")'); await h.warten(1200); } },
      { text: 'Jeder Workflow beginnt mit einem Auslöser. Klick auf „Add first step“ und such nach „Form“.',
        aktion: async (h) => { await h.klick('[data-test-id="canvas-plus-button"]', { nachher: 800 }); await h.seite.keyboard.type('form', { delay: 120 }); await h.warten(800); } },
      { text: 'Wähle „n8n Form“ und dann den Auslöser „On new n8n Form event“. So startet der Workflow, sobald jemand das Formular abschickt.',
        aktion: async (h) => {
          await h.klick(h.seite.locator('[data-test-id="node-creator-item-name"]', { hasText: 'n8n Form' }).first(), { nachher: 900 });
          await h.klick(h.seite.locator('[data-test-id="node-creator-item-name"]', { hasText: 'On new n8n Form event' }).first(), { nachher: 1500 });
        } },
      { text: 'Rechts oben stehen die Einstellungen des Formulars. Wir geben ihm einen Titel: Kurzes Feedback zum Daily.',
        aktion: async (h) => { await h.tippen('[data-test-id="parameter-input-formTitle"] input', 'Kurzes Feedback zum Daily'); } },
      { text: 'Unter „Form Elements“ kommen die Fragen dazu. „Add Form Element“, dann die Frage eintragen: Wie war das Daily heute?',
        aktion: async (h) => { await h.klick('[data-test-id="fixed-collection-add"]', { nachher: 900 }); await h.tippen('[data-test-id="parameter-input-fieldLabel"] input', 'Wie war das Daily heute?'); } },
      { text: 'Jetzt ein Testlauf: „Execute step“ öffnet das Testformular.',
        aktion: async (h) => {
          const neu = await h.neuesFenster(() => h.klick('[data-test-id="node-execute-button"], button:has-text("Execute step")'));
          await neu.waitForSelector('input'); await h.warten(400); await h.wechsel(neu); await h.warten(700);
        } },
      { text: 'Wir antworten wie ein Teammitglied: kurz und fokussiert. Abschicken.',
        aktion: async (h) => { await h.tippen('input[name="field-0"], input#field-0', 'Kurz und fokussiert'); await h.klick('#submit-btn, button[type="submit"]', { nachher: 1500 }); } },
      { text: 'Zurück in n8n: Rechts unter „Output“ steht die Antwort als Datensatz. Genau mit diesen Daten arbeiten alle weiteren Schritte.',
        aktion: async (h) => { const editor = h.ctx.pages()[0]; await editor.bringToFront(); await h.wechsel(editor); await h.warten(800); await h.zeigen(h.seite.getByText('Kurz und fokussiert').last()); } },
      { text: 'Mit Escape zurück zur Arbeitsfläche. Das Plus rechts am Formular hängt den nächsten Schritt an.',
        aktion: async (h) => { await h.seite.keyboard.press('Escape'); await h.warten(700); await h.klick('[data-test-id="canvas-handle-plus"]', { nachher: 800 }); } },
      { text: 'Wir nehmen „Edit Fields“. Damit bereitest du Daten auf, zum Beispiel für eine Tabelle oder eine Nachricht.',
        aktion: async (h) => { await h.seite.keyboard.type('edit fields', { delay: 90 }); await h.warten(700); await h.klick(h.seite.locator('[data-test-id="node-creator-item-name"]', { hasText: 'Edit Fields' }).first(), { nachher: 1600 }); } },
      { text: 'Links unter „Input“ siehst du die Felder aus dem Formular. Zieh die Antwort einfach mit der Maus in das Feld in der Mitte.',
        aktion: async (h) => { await h.ziehen(h.seite.locator('[data-test-id="run-data-schema-item"]', { hasText: 'Wie war das Daily' }).first(), '[data-test-id="assignment-collection-drop-area"], [data-test-id="drop-area"]', { nachher: 1000 }); } },
      { text: 'n8n legt automatisch ein Feld an und setzt einen Ausdruck in doppelten geschweiften Klammern. Der holt den Wert aus dem vorherigen Schritt.',
        aktion: async (h) => { await h.zeigen('[data-test-id="assignment-collection-assignments"], [data-test-id="assignment"]'); } },
      { text: 'Ein Klick auf „Execute step“ zeigt rechts das Ergebnis dieses Schritts.',
        aktion: async (h) => { await h.klick('[data-test-id="node-execute-button"]', { nachher: 1600 }); } },
      { text: 'Zurück auf der Arbeitsfläche siehst du deinen ersten eigenen Workflow: Formular und Aufbereitung, beide mit grünem Haken. Als Nächstes würdest du eine Nachricht oder eine Tabelle anhängen.',
        aktion: async (h) => { await h.seite.keyboard.press('Escape'); await h.warten(600); await h.klick('[data-test-id="zoom-to-fit"]'); } },
      { text: 'Wichtig: n8n speichert automatisch. Dauerhaft aktiv wird der Workflow erst mit „Publish“ oben rechts.', pause: 1.2,
        aktion: async (h) => { await h.zeigen('[data-test-id="workflow-open-publish-modal-button"]'); } },
    ],
  },
  {
    id: 'n8n-ki',
    titel: 'n8n: der KI-Baustein im Retro-Radar',
    untertitel: 'Wie ein Sprachmodell in einen Workflow kommt und was du dafür einrichten musst',
    start: async (h) => { await n8nAnmelden(h); await h.seite.goto(N8N + '/workflow/new'); await h.seite.waitForSelector('[data-test-id="workflow-menu"]'); await h.warten(1200); },
    schritte: [
      { text: 'Wir öffnen die Vorlage „Retro-Radar: einordnen“ aus Modul 5, wieder über das Menü mit den drei Punkten, Import, From file.',
        aktion: async (h) => {
          await h.klick('[data-test-id="workflow-menu"]'); await h.hin('[data-test-id="workflow-menu-item-import"]'); await h.warten(500);
          const [wahl] = await Promise.all([h.seite.waitForEvent('filechooser'), h.klick('[data-test-id="workflow-menu-item-import-from-file"]')]);
          await wahl.setFiles(path.join(VORLAGEN, 'retro-radar-einordnen.n8n.json')); await h.warten(1500); await h.klick('[data-test-id="zoom-to-fit"]');
        } },
      { text: 'Der Ablauf: Das Team schickt anonymes Feedback per Formular. Die KI ordnet es ein. Das Ergebnis wird gespeichert. Ist die KI unsicher, bekommst du eine Nachricht.',
        aktion: async (h) => { for (const n of ['Formular: Retro-Feedback', 'KI: einordnen', 'Speichern', 'Unsicher?', 'Zur Prüfung an dich']) await h.zeigen(knoten(n), { nachher: 350 }); } },
      { text: 'Unter dem KI-Schritt hängen zwei kleine Bausteine: das Sprachmodell, das denkt, und das JSON-Format, das die Antwort in feste Felder bringt.',
        aktion: async (h) => { await h.zeigen(knoten('Chat Model')); await h.zeigen(knoten('JSON-Format')); } },
      { text: 'Ein Doppelklick auf „KI: einordnen“ zeigt den Prompt. Die Stellen in doppelten geschweiften Klammern setzt n8n mit den Antworten aus dem Formular.',
        aktion: async (h) => { await h.klick(knoten('KI: einordnen'), { doppel: true, nachher: 1500 }); await h.zeigen('[data-test-id="parameter-input-text"], [data-test-id="inline-expression-editor-input"]', { timeout: 6000 }).catch(() => {}); } },
      { text: 'Zurück, und jetzt das Sprachmodell. Hier wählst du, welches Modell arbeitet. In der Vorlage ist Claude eingetragen.',
        aktion: async (h) => { await h.seite.keyboard.press('Escape'); await h.warten(700); await h.klick(knoten('Chat Model'), { doppel: true, nachher: 1400 }); await h.zeigen(h.seite.getByText('Model', { exact: true }).first(), { nachher: 300 }); await h.zeigen(h.seite.getByText('Sampling Temperature').first()); } },
      { text: 'Damit n8n das Modell nutzen darf, braucht es Zugangsdaten. Ein Klick auf „Connect“ öffnet das Fenster für den API-Schlüssel. Den bekommst du von eurer IT oder aus dem Konto beim Anbieter.',
        aktion: async (h) => { await h.klick('button:has-text("Connect to"), [data-test-id="node-credentials-empty-state"] button', { nachher: 1800 }); } },
      { text: 'Wir tragen hier nichts ein und schließen das Fenster. Ein API-Schlüssel ist wie ein Passwort: nie in Chats, Tickets oder Dokumente kopieren.',
        aktion: async (h) => { await h.seite.keyboard.press('Escape'); await h.warten(700); await h.seite.keyboard.press('Escape'); await h.warten(600); } },
      { text: 'Du willst lieber GPT oder Gemini nutzen? Dann löschst du diesen Modell-Baustein und hängst über das Plus am KI-Schritt einen anderen Chat-Model-Baustein an. Alles andere bleibt gleich.',
        aktion: async (h) => { await h.zeigen(knoten('Chat Model')); await h.hin(knoten('KI: einordnen'), { dy: 1.05, dx: 0.12 }); await h.warten(800); } },
      { text: 'Das JSON-Format legt fest, welche Felder die KI zurückgibt: Thema, Stimmung, Kernaussage und ob sie sich sicher ist. Genau diese Felder nutzt die Weiche danach.',
        aktion: async (h) => { await h.klick(knoten('JSON-Format'), { doppel: true, nachher: 1600 }); await h.seite.keyboard.press('Escape'); await h.warten(500); } },
      { text: 'Die Warndreiecke zeigen, was noch fehlt: Zugangsdaten für das Modell, eine Tabelle zum Speichern und die E-Mail-Zugangsdaten. Die gelbe Notiz beschreibt jeden Handgriff.',
        aktion: async (h) => { await h.zeigen(knoten('Speichern')); await h.zeigen('.vue-flow__node:not(:has([data-test-id="canvas-node"]))'); } },
      { text: 'Sind die Zugangsdaten eingetragen, testest du wie gewohnt mit „Execute workflow“ und miss mit zwanzig Beispielen, wie oft die KI richtig liegt.', pause: 1.2,
        aktion: async (h) => { await h.zeigen('[data-test-id="execute-workflow-button"]'); } },
    ],
  },
];

// Claude und Gemini: gleicher Ablauf, eigene Begriffe (Projekte / Gems).
const PROMPT_MAIL = 'Schreib eine Einladungsmail zum Sommerfest. Wer: 80 Kolleginnen und Kollegen. Fakten: 12. Juli, 16 Uhr, Innenhof, Grillen. Ton: locker, per du. Länge: höchstens 5 Sätze.';
const ANTWORT_MAIL = '**Betreff: Sommerfest am 12. Juli – wir grillen!**\n\nHallo zusammen,\n\nam 12. Juli ab 16 Uhr feiern wir unser Sommerfest im Innenhof. Der Grill ist an, für Getränke ist gesorgt, und gute Laune bringt ihr mit. Kommt einfach vorbei, auch wenn ihr nur kurz Zeit habt.\n\nWir freuen uns auf euch!';
const ANTWORT_KURZ = '**Betreff: Sommerfest am 12. Juli!**\n\nHallo zusammen, am 12. Juli ab 16 Uhr grillen wir im Innenhof. Kommt vorbei, wir freuen uns auf euch!';
const ANTWORT_PDF = '**Die fünf wichtigsten Punkte aus den Retro-Notizen:**\n\n1. Das Daily dauert oft länger als 15 Minuten.\n2. Reviews warten zu lange auf Freigabe.\n3. Die Zusammenarbeit mit dem Design lief deutlich besser.\n4. Zu viele ungeplante Anfragen mitten im Sprint.\n5. Wunsch: ein festes Zeitfenster für Refinement.\n\nSoll ich dazu zwei passende Retro-Formate vorschlagen?';
const ANWEISUNGEN = 'Du unterstützt ein agiles Team. Antworte auf Deutsch, per du, kurz und in Stichpunkten. Nenne keine Namen aus Retro-Notizen. Frag nach, wenn etwas unklar ist.';
const ANTWORT_DOD = 'Laut eurer **Definition of Done** ist eine Story fertig, wenn:\n\n- ein Code-Review erfolgt ist,\n- alle Tests grün sind,\n- die Doku aktualisiert ist,\n- der Product Owner sie abgenommen hat.\n\nFehlt einer der Punkte, gehört die Story zurück in „In Arbeit“.';

function chatFilm(app) {
  const name = app === 'claude' ? 'Claude' : 'Gemini';
  const sammlung = app === 'claude' ? 'Projekt' : 'Gem';
  const url = DEMO('chat.html') + '?app=' + app;
  const antwort = (text) => async (h) => { await h.seite.evaluate((t) => window.demo.antworte(t, 45), text); };
  const start = app === 'claude'
    ? 'Du öffnest claude.ai im Browser oder die Claude-App und meldest dich mit deinem Firmenkonto an. Links stehen deine Chats, in der Mitte das Eingabefeld.'
    : 'Du öffnest gemini.google.com oder die Gemini-App und meldest dich mit deinem Google-Konto der Firma an. Links stehen deine Chats, in der Mitte das Eingabefeld.';
  return {
    id: app,
    titel: `${name}: Chat, Dateien und ${app === 'claude' ? 'Projekte' : 'Gems'}`,
    untertitel: `Die wichtigsten Handgriffe in ${name}, Schritt für Schritt`,
    hinweis: `Vereinfachte Nachbildung der Oberfläche. Das echte ${name} sieht je nach Version etwas anders aus; die Bedienwege sind dieselben.`,
    start: async (h) => { await h.seite.goto(url); await h.warten(600); },
    schritte: [
      { text: start, aktion: async (h) => { await h.zeigen('aside', { nachher: 500 }); await h.zeigen('.box'); } },
      { text: 'Ein Klick auf „Neuer Chat“ startet ein frisches Gespräch. Für jedes neue Thema einen neuen Chat, dann stören alte Inhalte nicht.',
        aktion: async (h) => { await h.klick('#neuer-chat'); } },
      { text: 'Wir schreiben unsere Bitte mit den vier Zutaten: Ziel, Hintergrund mit allen Fakten, Form und Ton.',
        aktion: async (h) => { await h.tippen('#eingabe', PROMPT_MAIL, { tempo: 22 }); } },
      { text: `Abschicken mit Enter oder dem Pfeil. ${name} antwortet Wort für Wort.`,
        aktion: async (h) => { await h.klick('#senden'); await antwort(ANTWORT_MAIL)(h); } },
      { text: 'Passt fast. Statt neu anzufangen, schärfst du im Gespräch nach: kürzer, höchstens zwei Sätze.',
        aktion: async (h) => { await h.tippen('#eingabe', 'Kürzer bitte, höchstens zwei Sätze.'); await h.klick('#senden'); await antwort(ANTWORT_KURZ)(h); } },
      { text: `Über das Plus-Zeichen hängst du Dateien an, zum Beispiel Notizen als PDF. ${name} liest sie mit. Achte auf die Datenampel: keine Namen mit Bewertungen.`,
        aktion: async (h) => { await h.klick('#neuer-chat', { nachher: 400 }); await h.klick('#plus', { nachher: 500 }); await h.klick('#m-datei', { nachher: 300 }); await h.seite.evaluate(() => window.demo.anhang('Retro-Notizen-Sprint-14.pdf')); await h.warten(500); } },
      { text: 'Dazu die Frage: Fasse die Notizen in fünf Punkten zusammen.',
        aktion: async (h) => { await h.tippen('#eingabe', 'Fasse die Notizen in fünf Punkten zusammen.'); await h.klick('#senden'); await antwort(ANTWORT_PDF)(h); } },
      { text: app === 'claude'
          ? 'Für wiederkehrende Aufgaben legst du ein Projekt an. Links auf „Projekte“, dann „Neues Projekt“.'
          : 'Für wiederkehrende Aufgaben baust du dir ein Gem, also einen eigenen Assistenten. Links auf „Gems“, dann „Neues Gem“.',
        aktion: async (h) => { await h.klick('#nav-sammlung', { nachher: 700 }); await h.klick('#s-neu', { nachher: 600 }); } },
      { text: `Name und ${app === 'claude' ? 'Anweisungen' : 'Anleitung'}: Rolle, Sprache, Ton und Grenzen. Sie gelten für jeden Chat in diesem ${sammlung}, du musst sie nie wieder eintippen.`,
        aktion: async (h) => { await h.tippen('#n-name', 'Retro-Assistent'); await h.tippen('#n-anw', ANWEISUNGEN, { tempo: 18 }); } },
      { text: 'Unter „Wissen“ lädst du Dokumente hoch, etwa eure Definition of Done oder die Team-Arbeitsvereinbarung.',
        aktion: async (h) => { await h.klick('#n-plus', { nachher: 300 }); await h.seite.evaluate(() => { window.demo.wissen('Definition-of-Done.pdf'); window.demo.wissen('Arbeitsvereinbarung.pdf'); }); await h.warten(600); await h.klick('#n-fertig', { nachher: 800 }); } },
      { text: `Ein Chat im neuen ${sammlung}: Jetzt reicht eine kurze Frage. Die Anweisungen und das Wissen sind automatisch dabei.`,
        aktion: async (h) => { await h.seite.evaluate((n) => { window.demo.neuerChat(); window.demo.kontext(n); }, sammlung + ': Retro-Assistent'); await h.warten(500); await h.tippen('#eingabe', 'Wann ist eine Story bei uns fertig?'); await h.klick('#senden'); await antwort(ANTWORT_DOD)(h); } },
      { text: `Die Antwort stützt sich auf eure eigenen Dokumente. So wird ${name} vom allgemeinen Chatbot zum Assistenten für dein Team. Prüfe wichtige Aussagen trotzdem nach.`, pause: 1.2,
        aktion: async (h) => { await h.zeigen('.msg.ki >> nth=-1'); } },
    ],
  };
}
FILME.push(chatFilm('claude'), chatFilm('gemini'));

const gewuenscht = process.argv.slice(2);
console.log(`Stimme: ${quelle() === 'elevenlabs' ? 'ElevenLabs' : 'Computerstimme (espeak-ng/MBROLA); für ElevenLabs ELEVENLABS_API_KEY setzen'}`);
for (const film of FILME.filter((f) => !gewuenscht.length || gewuenscht.includes(f.id))) {
  await aufnehmen(film, ZIEL);
}
