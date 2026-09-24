# KI-Werkstatt (ki-ckoff) — Selbstlernkurs „Vom Chatbot zur eigenen KI-Lösung“

Der Kurs unter [`kikurs/`](../../kikurs/) richtet sich an Menschen, die KI bisher
nur im Chat (ChatGPT, Claude, Copilot) nutzen. Danach sollen sie selbst
KI-Lösungen bauen und andere Teams bei der Einführung begleiten können.
Zugeschnitten ist er auf Teilnehmende mit VWL-, Scrum-Master- und
Agile-Coach-Hintergrund: „Brücken“-Kästen schließen neue Konzepte an VWL
(Wahrscheinlichkeit, Grenznutzen, Opportunitätskosten, Stichproben) und an
agile Praxis (Inspect & Adapt, Value Stream Map, Experimente) an.

Rahmen, auf den die Inhalte abgestimmt sind: Alle großen Modelle sind
verfügbar, Automatisierung läuft über **n8n auf einem eigenen Server**, der
Kurs ist zum **Selbstlernen**, per **du**, ohne Programmieren, für **mehrere
Teilnehmende** mit zentralem Lernstand. Adresse: **ki-ckoff.kandzior.de**.

## Aufbau

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

Zu jedem Modul gibt es einen Film als MP4 mit Untertiteln (`public/filme/`):
Die Grafik des Moduls wird Szene für Szene hervorgehoben, eine deutsche
Stimme spricht den Text, die Untertitel stehen im Bild und als WebVTT-Spur.
Darunter bleibt die interaktive Fassung, die der Browser selbst vorliest.

Die Filme entstehen aus den Szenen in `public/inhalte.js`:

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

Geprüft mit n8n 2.40. Die Vorlagen nutzen bewusst ältere, weiterhin
unterstützte Knotenversionen, damit sie auch auf etwas älteren Servern
laufen. Der Data-Table-Knoten braucht eine neuere n8n-Version. Fehlt er,
ersetzt man ihn durch Google Sheets oder Excel. Als Modell ist Anthropic
eingetragen, jedes andere Chat-Model-Knoten-Paar funktioniert genauso.

## Mehrere Teilnehmende

Die Kursseite ist statisch, dazu kommt eine kleine PHP-Schnittstelle
(`public/api.php` → `src/api.php`, SQLite):

- **Konten:** Registrierung mit Einladungscode, entweder mit dem gemeinsamen Code
  aus der Konfiguration oder mit Einmalcodes, die die Kursleitung erzeugt.
  Passwörter ab 10 Zeichen, Sperre nach 10 Fehlversuchen, Bremse je IP.
- **Lernstand:** Häkchen, Quizergebnisse, Canvas und Rechner werden je Konto
  gespeichert und beim Anmelden auf jedem Gerät geladen. Zusätzlich bleibt eine
  Kopie im Browser.
- **Kursleitung** (Seite „Teilnehmende“): Fortschritt aller Konten, Module
  abgeschlossen, zuletzt aktiv, Passwort zurücksetzen (Einmal-Passwort,
  Wechsel erzwungen), sperren, löschen, Einmalcodes.
- Ohne Server (Datei direkt geöffnet, statische Vorschau) läuft der Kurs wie
  bisher mit Lernstand nur im Browser.

Tests: `php kikurs/tests/lauf.php` (Schnittstelle, Kursdaten, Filme, Vorlagen),
in CI über `.github/workflows/kikurs-tests.yml`.

## Livegang auf ki-ckoff.kandzior.de

1. Actions → **„DNS-Eintrag setzen“**, Name `ki-ckoff`.
2. Actions → **„KI-Werkstatt einrichten“**
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

Alles Inhaltliche steht in `kikurs/public/inhalte.js`. Je Modul: `ziele`,
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
