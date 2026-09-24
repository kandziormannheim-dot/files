# KI-Werkstatt — Drehbuch der Erklärfilme

Erzeugt von `kikurs/werkzeuge/filme-rendern.mjs --drehbuch` aus `kikurs/public/inhalte.js`.
Wer die Filme mit eigener Stimme vertonen will: je Szene eine WAV-Datei unter
`kikurs/aufnahmen/<Datei>` ablegen und die Filme neu erzeugen. Szenen ohne Aufnahme
behalten die Computerstimme.

## Modul 0: Vom Chatbot zum Agenten

| Datei | Text |
|---|---|
| `m0-0.wav` | Modul 0: Kick-off: Vom Chatten zum Bauen. Vom Chatbot zum Agenten. |
| `m0-1.wav` | Willkommen in der KI-Werkstatt. Heute nutzt du KI wahrscheinlich als Chatbot: Du fragst, die KI antwortet, und du kopierst das Ergebnis heraus. |
| `m0-2.wav` | Auf der zweiten Stufe richtest du einen Assistenten ein. Er kennt deine Anweisungen und dein Material, du musst dich nicht jedes Mal wiederholen. |
| `m0-3.wav` | Auf der dritten Stufe baust du Workflows. Ein Ablauf startet von selbst, etwa wenn ein Formular eingeht, und die KI ist ein Schritt darin. |
| `m0-4.wav` | Ganz rechts stehen Agenten. Sie bekommen ein Ziel und Werkzeuge und planen die Schritte selbst. Das ist mächtig, braucht aber gute Leitplanken. |
| `m0-5.wav` | In sechs Wochen gehst du diese Stufen Schritt für Schritt hinauf. Am Ende steht deine eigene KI-Lösung, die im Team wirklich läuft. |

## Modul 1: Wie eine KI-Antwort entsteht

| Datei | Text |
|---|---|
| `m1-0.wav` | Modul 1: Wie Sprachmodelle wirklich ticken. Wie eine KI-Antwort entsteht. |
| `m1-1.wav` | Du schreibst einen Satz. Das Sprachmodell zerlegt ihn zuerst in Tokens, also in Wörter und Wortstücke. |
| `m1-2.wav` | Für jedes denkbare nächste Token berechnet es eine Wahrscheinlichkeit. Hier liegt ‚blockiert‘ vorn, weil der Satz nach einem typischen Daily klingt. |
| `m1-3.wav` | Ein Token wird gezogen und angehängt. Dann beginnt die Rechnung von vorn, Token für Token, bis die Antwort fertig ist. |
| `m1-4.wav` | Merke: Die KI schlägt nichts nach. Sie erzeugt die plausibelste Fortsetzung. Deshalb ist guter Kontext so wichtig. |

## Modul 2: Ein Prompt wie ein gutes Briefing

| Datei | Text |
|---|---|
| `m2-0.wav` | Modul 2: Vom Prompt zum Kontext. Ein Prompt wie ein gutes Briefing. |
| `m2-1.wav` | Ein guter Prompt ist ein gutes Briefing. Er beginnt mit der Rolle: Aus welcher Perspektive soll die KI arbeiten? |
| `m2-2.wav` | Dann das Ziel: Was soll am Ende herauskommen, und wofür brauchst du es? |
| `m2-3.wav` | Der Kontext ist der wichtigste Baustein. Wer ist das Team, was ist passiert, welches Material gibt es? |
| `m2-4.wav` | Das Format legt fest, wie die Antwort aussieht, zum Beispiel eine Tabelle mit festen Spalten und einer Längengrenze. |
| `m2-5.wav` | Ein Beispiel für ein gutes Ergebnis wirkt oft stärker als jede Beschreibung. |
| `m2-6.wav` | Zum Schluss die Grenzen: Was darf nicht passieren, und wann soll die KI lieber nachfragen? |
| `m2-7.wav` | Ändere beim Verbessern immer nur einen Baustein. So weißt du, was gewirkt hat, genau wie bei einem Team-Experiment. |

## Modul 3: Welches Werkzeug wofür?

| Datei | Text |
|---|---|
| `m3-0.wav` | Modul 3: Die Werkzeuglandschaft verstehen. Welches Werkzeug wofür?. |
| `m3-1.wav` | Allzweck-Assistenten wie Claude, ChatGPT oder Gemini sind dein Denk- und Schreibwerkzeug. Bei euch sind alle großen Modelle verfügbar. |
| `m3-2.wav` | Recherche-Werkzeuge antworten mit Quellenangaben, aus dem Web oder aus deinen eigenen Dokumenten. |
| `m3-3.wav` | Viele Programme haben KI inzwischen eingebaut, etwa Jira und Confluence oder Teams. Dort arbeitet die KI direkt mit deinen Daten. |
| `m3-4.wav` | Für Automatisierungen habt ihr n8n auf einem eigenen Server. Damit verbindest du Programme und KI zu festen Abläufen. |
| `m3-5.wav` | Agenten verfolgen ein Ziel selbstständig. Auch n8n hat dafür einen eigenen Baustein. |
| `m3-6.wav` | Frag immer zuerst: Was soll erledigt werden? Dann wähle die Werkzeugklasse, und erst ganz zum Schluss das Produkt. |

## Modul 4: Ein Workflow Schritt für Schritt

| Datei | Text |
|---|---|
| `m4-0.wav` | Modul 4: Automatisierung ohne Code. Ein Workflow Schritt für Schritt. |
| `m4-1.wav` | Alles beginnt mit einem Auslöser. Hier: Jemand schickt ein Formular ab. Ab jetzt läuft alles ohne dich. |
| `m4-2.wav` | Der nächste Schritt bereitet die Daten auf, zum Beispiel Datum ergänzen oder Text säubern. |
| `m4-3.wav` | Der KI-Schritt ordnet ein oder fasst zusammen. Er liefert feste Felder zurück, zum Beispiel eine Kategorie. |
| `m4-4.wav` | Die Weiche prüft eine Bedingung. Je nach Kategorie geht es in eine andere Richtung. |
| `m4-5.wav` | Bei einem Bug entsteht ein Ticket, bei einer Idee eine Nachricht ans Team. |
| `m4-6.wav` | Ist die KI unsicher, geht der Fall an einen Menschen. So bleibt die Qualität hoch. |

## Modul 5: Vier Dinge, die KI im Workflow erledigt

| Datei | Text |
|---|---|
| `m5-0.wav` | Modul 5: KI als Baustein im Workflow. Vier Dinge, die KI im Workflow erledigt. |
| `m5-1.wav` | Erstens: Einordnen. Die KI liest einen Text und ordnet ihn einer Kategorie zu, zum Beispiel Bug, Idee oder Lob. |
| `m5-2.wav` | Zweitens: Zusammenfassen. Aus einem langen Transkript werden fünf Kernpunkte und die offenen Fragen. |
| `m5-3.wav` | Drittens: Herausziehen. Aus einer freien E-Mail werden feste Felder wie Wunsch, Frist und Priorität. |
| `m5-4.wav` | Viertens: Entwerfen. Aus Stichpunkten wird eine User Story mit Akzeptanzkriterien. |
| `m5-5.wav` | Wichtig ist immer eine feste Ausgabeform, damit der nächste Schritt weiterarbeiten kann. Und ein Mensch an den heiklen Stellen. |

## Modul 6: So arbeitet ein Agent

| Datei | Text |
|---|---|
| `m6-0.wav` | Modul 6: Eigenes Wissen und KI-Agenten. So arbeitet ein Agent. |
| `m6-1.wav` | Der Agent bekommt ein Ziel, zum Beispiel: Bereite das Sprint Review vor. |
| `m6-2.wav` | Er macht einen Plan: Tickets holen, gruppieren, Texte schreiben, Seite anlegen. |
| `m6-3.wav` | Er nutzt ein Werkzeug, etwa die Jira-Suche, und bekommt Daten zurück. |
| `m6-4.wav` | Die Werkzeuge sind über Konnektoren angebunden, oft über den offenen Standard MCP. |
| `m6-5.wav` | Er schaut sich das Ergebnis an und entscheidet über den nächsten Schritt. |
| `m6-6.wav` | Ist das Ziel erreicht, hört er auf. Sonst beginnt die Schleife erneut. |
| `m6-7.wav` | Leitplanken halten den Agenten sicher: wenig Rechte, Freigabe vor dem Senden, jedes Protokoll nachvollziehbar. |

## Modul 7: Die Datenampel

| Datei | Text |
|---|---|
| `m7-0.wav` | Modul 7: Verantwortung: Datenschutz, Recht, Fairness. Die Datenampel. |
| `m7-1.wav` | Grün sind öffentliche Informationen: Fachartikel, Webseiten, deine eigenen anonymen Notizen. Die darfst du in jedes seriöse KI-Werkzeug geben. |
| `m7-2.wav` | Gelb sind interne Informationen wie Backlog, Prozessbeschreibungen oder Protokolle ohne Namen. Die gehören nur in die freigegebene Firmen-KI. |
| `m7-3.wav` | Rot sind personenbezogene und vertrauliche Daten, etwa Namen mit Bewertungen oder Kundendaten. Hier brauchst du eine Freigabe, oder du lässt es ganz. |
| `m7-4.wav` | Im Zweifel stufst du eine Stufe strenger ein. Und du wertest Themen aus, nicht Personen. |

## Modul 8: Welche Use Cases zuerst?

| Datei | Text |
|---|---|
| `m8-0.wav` | Modul 8: Wirtschaftlichkeit und Einführung im Team. Welche Use Cases zuerst?. |
| `m8-1.wav` | Retro-Notizen clustern: großer Nutzen, geringes Risiko, wenn die Notizen anonym sind. Ein idealer Start. |
| `m8-2.wav` | Meeting-Protokolle sparen viel Zeit. Das Risiko ist mittel, weil Namen und Aussagen drinstecken. |
| `m8-3.wav` | User Stories vorformulieren: solider Nutzen, kaum Risiko. Der Mensch prüft ohnehin im Refinement. |
| `m8-4.wav` | Bewerbungen vorsortieren: Das ist Hochrisiko nach dem EU AI Act. Nur mit strengen Leitplanken, oder gar nicht. |
| `m8-5.wav` | Kunden-Mails automatisch beantworten: großer Nutzen, aber hohe Außenwirkung. Freigabe durch Menschen einbauen. |
| `m8-6.wav` | Ein Glossar-Bot fürs Team ist risikoarm, bringt aber weniger. Gut als Lernprojekt. |

## Modul 9: Dein Abschlussprojekt in zwei Sprints

| Datei | Text |
|---|---|
| `m9-0.wav` | Modul 9: Abschlussprojekt: deine eigene KI-Lösung. Dein Abschlussprojekt in zwei Sprints. |
| `m9-1.wav` | Am Anfang steht der Canvas. Du klärst Problem, Nutzer, Daten und woran du den Erfolg misst. |
| `m9-2.wav` | Im ersten Sprint baust du das Walking Skeleton: die kleinste Version, die einmal von Anfang bis Ende läuft. |
| `m9-3.wav` | Im zweiten Sprint kommen Testsatz, Leitplanken und eine Woche echte Nutzung dazu. |
| `m9-4.wav` | Im Review zeigst du in fünf Minuten, was die Lösung bringt, mit echten Zahlen, und entscheidest über den nächsten Schritt. |
| `m9-5.wav` | Und wie immer endet es mit einer Retro: Was machst du beim nächsten KI-Projekt anders? |
