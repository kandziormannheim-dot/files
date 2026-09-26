# KI-ckoff — zwei Selbstlernkurse: KI-Einstieg und KI-Werkstatt

Unter [`kikurs/`](../../kikurs/) liegt die Lernplattform **KI-ckoff**
(ki-ckoff.kandzior.de) mit zwei Kursen. Beide nutzen dieselben Konten, dieselbe
Kursleitungsansicht und dieselben Werkzeuge:

1. **KI-Einstieg** („Was ist KI, und was kann ich damit machen?“) ist für
   alle, die neu in der KI-Welt sind. Sieben Module, etwa 4,5 Stunden: Begriffe und
   Geschichte der KI, was ein LLM ist und wie es antwortet, acht
   Einsatzfelder mit Beispielen aus allen Arbeitsbereichen, gute Fragen
   stellen, Datenampel, Prüfen und Deepfakes, nächste Schritte.
2. **KI-Werkstatt** („Vom Chatbot zur eigenen KI-Lösung“) ist für alle, die
   KI schon im Chat nutzen und jetzt selbst Lösungen bauen und andere Teams
   begleiten wollen. Zugeschnitten auf Teilnehmende mit VWL-, Scrum-Master-
   und Agile-Coach-Hintergrund: „Brücken“-Kästen schließen neue Konzepte an
   VWL (Wahrscheinlichkeit, Grenznutzen, Opportunitätskosten, Stichproben)
   und an agile Praxis (Inspect & Adapt, Value Stream Map, Experimente) an.

Rahmen, auf den die Inhalte abgestimmt sind: Alle großen Modelle sind
verfügbar, Automatisierung läuft über **n8n auf einem eigenen Server**, die
Kurse sind zum **Selbstlernen**, per **du**, ohne Programmieren, für
**mehrere Teilnehmende** mit zentralem Lernstand.

Die Startseite ist ein Portal mit beiden Kursen und einer Empfehlung, welcher
passt. Adressen: `#einstieg`, `#werkstatt`, Module `#e0` bis `#e6` und `#m0` bis `#m9`.

## KI-Einstieg

| Modul | Thema | Dauer | Teil |
|---|---|---|---|
| 0 | Willkommen: warum KI jetzt überall ist, drei Mythen, erste Unterhaltung | 0,5 h | 1 |
| 1 | Was ist KI? Regeln oder Beispiele, die KI-Zwiebel, KI im Alltag | 0,75 h | 1 |
| 2 | Was ist ein LLM? Training, Wort-für-Wort-Vorhersage, Grenzen, multimodal | 0,75 h | 1 |
| 3 | Was kann man damit machen? Acht Einsatzfelder, Beispiele je Bereich, KI als Lernpartner | 1 h | 2 |
| 4 | Richtig fragen: vier Zutaten, im Gespräch verbessern, Vorlagen | 0,75 h | 2 |
| 5 | Sicher nutzen: Datenampel, prüfen, Deepfakes erkennen | 0,5 h | 2 |
| 6 | Wie geht es weiter? Stufen bis zum Agenten, persönlicher Vorsatz | 0,25 h | 2 |

Inhalte in `kikurs/public/einstieg.js`, gleicher Aufbau wie `inhalte.js`.
IDs beginnen mit `e`, damit beide Kurse sich einen Lernstand teilen können.

## KI-Werkstatt

| Modul | Thema | Dauer | Woche |
|---|---|---|---|
| 0 | Kick-off: Stufen der KI-Nutzung, Werkzeuge, Lerntagebuch | 1 h | 1 |
| 1 | Wie Sprachmodelle ticken: Tokens, Kontextfenster, Halluzinationen | 2,5 h | 1 |
| 2 | Vom Prompt zum Kontext: sechs Bausteine, JSON-Ausgaben, eigene Assistenten | 3 h | 2 |
| 3 | Werkzeuglandschaft, welches Modell wofür | 2,5 h | 2 |
| 4 | Automatisierung mit n8n: erster Workflow (Impediment-Melder) | 4 h | 3 |
| 5 | KI als Workflow-Baustein: Retro-Radar, Human in the Loop, Qualität messen | 4 h | 4 |
| 6 | RAG, Agenten, MCP, der AI-Agent-Knoten in n8n | 3,5 h | 5 |
| 7 | Datenampel, DSGVO, EU AI Act, Bias | 2 h | 5 |
| 8 | Business Case, Priorisierung, Einführung, Teams begleiten | 3,5 h | 6 |
| 9 | Abschlussprojekt in zwei Mini-Sprints mit Review | 4 h | 6 |

Jedes Modul: Lernziele → Lektionen mit SVG-Grafiken (abhakbar) →
**deutscher Erklärfilm** → weiterführende Videos (meist Englisch, freiwillig)
→ Praxisübung → Wissenscheck (ab 70 % bestanden). Werkzeuge: Lernplan,
Selbsteinschätzung, Prompt-Baukasten, Prompt-Bibliothek, n8n-Vorlagen,
Automatisierungs-Rechner, Use-Case-Canvas, Glossar, Teilnahmebestätigung.

## Erklärfilme (Deutsch, selbst erzeugt)

Zu jedem der 17 Module beider Kurse gibt es einen Film als MP4 mit Untertiteln (`public/filme/`):
Die Grafik des Moduls wird Szene für Szene hervorgehoben, eine deutsche
Stimme spricht den Text, die Untertitel stehen im Bild und als WebVTT-Spur.
Darunter bleibt die interaktive Fassung, die der Browser selbst vorliest.

Die Filme entstehen aus den Szenen in `public/einstieg.js` und `public/inhalte.js`:

```sh
sudo apt install ffmpeg espeak-ng mbrola mbrola-de6   # einmalig
node kikurs/werkzeuge/filme-rendern.mjs               # alle Filme
node kikurs/werkzeuge/filme-rendern.mjs m4            # nur Modul 4
node kikurs/werkzeuge/filme-rendern.mjs --drehbuch    # DREHBUCH.md neu schreiben
```

Die Standardstimme ist eine Computerstimme (MBROLA `de6`). **Mit eigener
Stimme vertonen:** Das [Drehbuch](DREHBUCH.md) listet jede Szene mit
Dateinamen. Eine Aufnahme als `kikurs/aufnahmen/m1-2.wav` ersetzt genau diese
Szene, danach den Film neu erzeugen. Eine andere Computerstimme wählt
`STIMME=mb-de7` (weiblich).

## Anleitungsfilme (Schritt für Schritt)

Fünf Bildschirmfilme zeigen die Werkzeuge in Aktion (`public/anleitungen/`,
Seite „Anleitungsfilme“ und eingebettet in den passenden Modulen):

| Film | Inhalt | Oberfläche | Module |
|---|---|---|---|
| `claude` | Chat, gute Bitte, nachschärfen, PDF anhängen, Projekt mit Anweisungen und Wissen | vereinfachte Nachbildung | e4, m2 |
| `gemini` | dasselbe in Gemini mit Gems | vereinfachte Nachbildung | e4, m2 |
| `n8n-import` | Vorlage importieren, Knoten ansehen, Testformular, Executions, Publish | **echtes n8n 2.40** | m4 |
| `n8n-bauen` | Formular-Auslöser von Grund auf, Test, Drag-and-drop in „Edit Fields“ | **echtes n8n 2.40** | m4 |
| `n8n-ki` | Retro-Radar: Prompt, Chat Model, Zugangsdaten-Dialog, JSON-Format | **echtes n8n 2.40** | m5, m6 |

Claude und Gemini lassen sich ohne echte Konten nicht automatisch aufnehmen.
Die Nachbildung (`werkzeuge/demos/chat.html`) ist im Film und auf der Seite
als solche gekennzeichnet, trägt keine Logos und zeigt dieselben Bedienwege.

`werkzeuge/anleitungen.mjs` enthält die Drehbücher, `werkzeuge/bildschirmfilm.mjs`
nimmt auf. Chromium bedient die Oberfläche, und die Bilder kommen mit
Zeitstempel über das Chrome-Screencast-Protokoll. Ein eingeblendeter
Mauszeiger mit Klick-Markierung zeigt jede Bewegung, ein Band unter dem Bild
den Untertitel. Jeder Schritt dauert so lange wie seine Sprache.

Neu drehen, etwa nach einem n8n-Update:

```sh
# n8n lokal (braucht Node 24), einmalig ein Konto anlegen
npx n8n start                         # oder vorhandene Test-Instanz
N8N_URL=http://127.0.0.1:5678 N8N_EMAIL=… N8N_PASSWORT=… \
N8N_DB=~/.n8n/database.sqlite \
  node kikurs/werkzeuge/anleitungen.mjs            # alle fünf
node kikurs/werkzeuge/anleitungen.mjs claude       # nur einer
```

`N8N_DB` ist optional. Damit räumt das Skript vor jeder Aufnahme die
Workflows der Demo-Instanz ab, sodass jeder Film mit leerer Startseite
beginnt. **Nie gegen die echte Firmen-Instanz verwenden.**

## Sprachausgabe: ElevenLabs

Alle Filme, also die Erklärfilme und die Anleitungsfilme, sprechen über
`werkzeuge/stimme.mjs`:

- **ElevenLabs**, sobald `ELEVENLABS_API_KEY` gesetzt ist (Modell
  `eleven_multilingual_v2`, Stimme per `ELEVENLABS_VOICE_ID`, sonst eine
  mehrsprachige Standardstimme). Fertige Aufnahmen landen in
  `~/.cache/kikurs-stimmen/`, ein erneuter Lauf kostet also keine Zeichen
  doppelt.
- **Computerstimme** (espeak-ng mit MBROLA `de6`) ohne Schlüssel oder mit
  `STIMME=espeak`.

Die eingecheckten Filme sprechen noch mit der Computerstimme, weil in der
Umgebung, in der sie entstanden sind, weder ein Schlüssel hinterlegt noch
`api.elevenlabs.io` erreichbar war. Mit Schlüssel neu vertonen:

```sh
export ELEVENLABS_API_KEY=…            # aus dem ElevenLabs-Konto, nie einchecken
export ELEVENLABS_VOICE_ID=…           # optional, z. B. eine deutsche Stimme
node kikurs/werkzeuge/filme-rendern.mjs          # 17 Erklärfilme
node kikurs/werkzeuge/anleitungen.mjs            # 5 Anleitungsfilme
```

Bei ElevenLabs werden die Texte unverändert gesprochen. Die
Aussprachehilfen (etwa „n8n“ → „N acht N“) gelten nur für die
Computerstimme.

## n8n-Vorlagen

`public/vorlagen/*.n8n.json` sind importierbare Workflows (Impediment-Melder,
Retro-Radar einordnen und zusammenfassen, Glossar-Bot). Sie werden von
`werkzeuge/n8n-vorlagen.py` erzeugt und mit `werkzeuge/n8n-pruefen.cjs` gegen
eine echte n8n-Installation geprüft: Gibt es Knotentyp und Version, kennt der
Knoten jeden Parameter, bleiben Pflichtfelder offen?

```sh
python3 kikurs/werkzeuge/n8n-vorlagen.py
npm install n8n --prefix /tmp/n8n
N8N_MODULE=/tmp/n8n/node_modules node kikurs/werkzeuge/n8n-pruefen.cjs
```

Geprüft mit n8n 2.40, zusätzlich per echtem Import in eine laufende
n8n-2.40-Instanz (siehe Anleitungsfilme). Die Vorlagen nutzen bewusst ältere, weiterhin
unterstützte Knotenversionen, damit sie auch auf etwas älteren Servern
laufen. Der Data-Table-Knoten braucht eine neuere n8n-Version. Fehlt er,
ersetzt man ihn durch Google Sheets oder Excel. Als Modell ist Anthropic
eingetragen, jedes andere Chat-Model-Knoten-Paar funktioniert genauso.

## Teilnahmebestätigung (PDF)

Wer alle Module eines Kurses abgeschlossen hat (Lektionen abgehakt, jedes
Quiz ab 70 %), kann auf der Seite „Teilnahmebestätigung“ ein PDF
herunterladen: A4 quer, mit Name, Kurs, Inhalt, Umfang, Abschlussdatum,
Nachweisnummer und **Martin Kandzior** als Aussteller (Kursleitung KI-ckoff).
Das PDF entsteht im Browser. Die Seite wird auf eine Leinwand gezeichnet und
als PDF 1.4 mit Titel und Autor verpackt, ohne Bibliothek und ohne Server.
Den Namen der ausstellenden Person setzt der Workflow über die Eingabe
`aussteller` in `kikurs-config.php`. Ohne Server gilt die Vorgabe in `kurs.js`.
Die Nachweisnummer ergibt sich aus Kurs, Name und Abschlussdatum und bleibt
darum bei jedem erneuten Herunterladen gleich.

## Mehrere Teilnehmende

Die Kursseite ist statisch, dazu kommt eine kleine PHP-Schnittstelle
(`public/api.php` → `src/api.php`, SQLite):

- **Konten:** Registrierung mit Einladungscode, entweder mit dem gemeinsamen Code
  aus der Konfiguration oder mit Einmalcodes, die die Kursleitung erzeugt.
  Passwörter ab 10 Zeichen, Sperre nach 10 Fehlversuchen, Bremse je IP.
- **Lernstand:** Häkchen, Quizergebnisse, Canvas und Rechner werden je Konto
  gespeichert und beim Anmelden auf jedem Gerät geladen. Zusätzlich bleibt eine
  Kopie im Browser.
- **Kursleitung** (Seite „Teilnehmende“): Fortschritt aller Konten je Kurs, Module
  abgeschlossen, zuletzt aktiv, Passwort zurücksetzen (Einmal-Passwort,
  Wechsel erzwungen), sperren, löschen, Einmalcodes.
- Ohne Server (Datei direkt geöffnet, statische Vorschau) läuft der Kurs wie
  bisher mit Lernstand nur im Browser.

Tests: `php kikurs/tests/lauf.php` (Schnittstelle, Kursdaten, Filme, Vorlagen),
auch in CI über `.github/workflows/kikurs-tests.yml`. Dazu kommt lokal
`node kikurs/tests/ablauf.mjs` (Browser mit PHP-Server: ganzer Einstieg bis zum PDF).

## Livegang auf ki-ckoff.kandzior.de

1. Actions → **„DNS-Eintrag setzen“**, Name `ki-ckoff`.
2. Actions → **„KI-ckoff einrichten“**
   ([`ki-ckoff-einrichten.yml`](../../.github/workflows/ki-ckoff-einrichten.yml)):
   Plesk-Passwort (oder Secret `PLESK_PASSWORT`), E-Mail der Kursleitung,
   Passwort der Kursleitung (oder Secret `KIKURS_ADMIN_PASSWORT`), optional
   Einladungscode. Der Workflow testet, legt die Subdomain mit Webroot
   `kikurs-app/public` an, überträgt `public/` und `src/`, schreibt
   `kikurs-config.php` oberhalb des Webroots, holt das Zertifikat und prüft
   Schnittstelle, Seite, Film und Vorlage. Ohne Code-Eingabe erzeugt er einen
   und zeigt ihn in der Zusammenfassung. `-` schaltet den gemeinsamen Code ab.
   Ein erneuter Lauf ist zugleich der Update-Weg. Konten und Lernstände in
   `kikurs-daten/` bleiben dabei erhalten.

Von Hand: Webroot auf `kikurs/public` zeigen lassen, `src/` daneben,
`kikurs-config.php` nach `kikurs-config.beispiel.php` oberhalb anlegen,
PHP 8.2+ mit `pdo_sqlite`.

## Inhalte pflegen

Alles Inhaltliche steht in `kikurs/public/einstieg.js` (Einstieg) und
`kikurs/public/inhalte.js` (Werkstatt, dazu Prompts, Vorlagen, Glossar).
Kursweite Angaben (`titel`, `kurzname`, `lead`, `heldGrafik`, `einheit`,
`planTitel`, `zertifikatText` …) stehen oben in jeder Datei. Je Modul: `ziele`,
`lektionen` (HTML-Text; `<figure class="grafik" data-grafik="name">` setzt eine
Grafik aus `grafiken.js` ein), `film` (`grafik` + `szenen` mit `schritt` und
`text`), `videos`, `uebung`, `quiz` (`richtig` ist der Index der richtigen
Antwort). `woche`, `versatz` und `breite` steuern den Balkenplan. Nach
Änderungen an Filmszenen die Filme neu erzeugen, `lauf.php` meldet fehlende.

## Vor dem Einsatz prüfen

- Werkzeugnamen, Preise und Funktionen ändern sich schnell (Stand September 2026).
- EU AI Act: Die Fristen für Hochrisiko-Systeme wurden durch den Digital Omnibus
  verschoben. Modul 7 verweist auf die laufend gepflegte Zeitleiste.
- Modul 7 ist eine Orientierung, kein Rechtsrat.
