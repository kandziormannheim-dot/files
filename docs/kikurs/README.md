# KI-Werkstatt — Selbstlernkurs „Vom Chatbot zur eigenen KI-Lösung“

Der Kurs unter [`kikurs/`](../../kikurs/) richtet sich an Menschen, die KI bisher
nur im Chat (ChatGPT, Claude, Copilot) nutzen und lernen wollen, wie sie daraus
verlässliche Automatisierungen und Lösungen bauen. Zugeschnitten ist er auf eine
Teilnehmerin mit VWL-Studium, Scrum-Master- und Agile-Coach-Hintergrund: Jedes
Modul hat „Brücken“-Kästen, die neue Konzepte an VWL (Wahrscheinlichkeit,
Opportunitätskosten, Stichproben) und agile Praxis (Inspect & Adapt, Value
Stream Map, Experimente) anschließen.

## Aufbau

| Modul | Thema | Dauer | Woche |
|---|---|---|---|
| 0 | Kick-off: Stufen der KI-Nutzung, Werkzeuge, Lerntagebuch | 1 h | 1 |
| 1 | Wie Sprachmodelle ticken: Tokens, Kontextfenster, Halluzinationen | 2,5 h | 1 |
| 2 | Vom Prompt zum Kontext: sechs Bausteine, JSON-Ausgaben, eigene Assistenten | 3 h | 2 |
| 3 | Werkzeuglandschaft und Auswahlkriterien | 2 h | 2 |
| 4 | Automatisierung ohne Code: erster Workflow (Impediment-Melder) | 4 h | 3 |
| 5 | KI als Workflow-Baustein: Retro-Radar, Human in the Loop, Qualität messen | 4 h | 4 |
| 6 | RAG, Agenten, MCP, Prompt Injection, Blick auf die API | 3,5 h | 5 |
| 7 | Datenampel, DSGVO, EU AI Act, Bias | 2 h | 5 |
| 8 | Business Case, Priorisierung, Einführung als Experiment | 3 h | 6 |
| 9 | Abschlussprojekt in zwei Mini-Sprints mit Review | 4 h | 6 |

Jedes Modul: Lernziele → Lektionen mit SVG-Grafiken (abhakbar) → Erklärfilm
(wo vorhanden) → Videos und Lesestoff → Praxisübung → Wissenscheck (ab 70 %
bestanden). Dazu kommen die Werkzeuge Prompt-Baukasten, Prompt-Bibliothek,
Automatisierungs-Rechner (Gewinnschwelle), Use-Case-Canvas mit
Nutzen-Risiko-Matrix, Glossar und eine Teilnahmebestätigung, die sich nach
allen Modulen freischaltet.

## Videos

- **Erklärfilme** (Module 1, 4, 6, 8) sind eigene Szenenfilme: Die Grafik wird
  Schritt für Schritt hervorgehoben, der Text über die Sprachausgabe des
  Browsers vorgelesen (Deutsch, abschaltbar). Keine Fremdinhalte, keine
  Einbettung, kein Tracking.
- **Externe Videos** (3Blue1Brown, Andrej Karpathy, n8n-Einsteigerkurs,
  Anthropic Academy) sind als Link-Karten eingebunden, nicht als iframe. Das
  hält die Seite DSGVO-freundlich. Die meisten sind englisch.

## Technik

Statische Seite ohne Build und ohne Abhängigkeiten: `index.html`, `kurs.css`,
`grafiken.js` (alle Grafiken als SVG-Funktionen), `inhalte.js` (alle Texte und
Daten), `kurs.js` (Navigation, Fortschritt, Quiz, Film, Werkzeuge). Der
Lernstand liegt nur im `localStorage` des Browsers. Hell- und Dunkelmodus,
Handy-tauglich.

Lokal ansehen: `kikurs/index.html` im Browser öffnen. Zum Veröffentlichen
reicht jeder statische Webspace (z. B. als Subdomain auf dem Plesk-Server wie
bei den anderen Projekten).

## Inhalte pflegen

Alles Inhaltliche steht in `kikurs/inhalte.js`. Je Modul: `ziele`,
`lektionen` (HTML-Text; `<figure class="grafik" data-grafik="name">` setzt eine
Grafik aus `grafiken.js` ein), optional `film` (`grafik` + `szenen` mit
`schritt` und `text`), `videos`, `uebung`, `quiz` (`richtig` ist der Index der
richtigen Antwort). `woche`, `versatz` und `breite` steuern den Balkenplan.

## Vor dem Einsatz prüfen

- Werkzeugnamen, Preise und Funktionen ändern sich schnell (Stand September 2026).
- EU AI Act: Die Fristen für Hochrisiko-Systeme wurden durch den Digital Omnibus
  verschoben; Modul 7 verweist auf die laufend gepflegte Zeitleiste.
- Modul 7 ist eine Orientierung, kein Rechtsrat.
