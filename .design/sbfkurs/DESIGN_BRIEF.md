# Design Brief: SBF-Kurs — Online-Kurs für Funk- und Pyro-Zeugnisse

> Phase 2 von 7 im Designer-Flow. Vorgänger: Klärung mit dem Auftraggeber (Rückfragen zu Umfang, Technik, Inhalten).
> Nachfolger: `INFORMATION_ARCHITECTURE.md` (Phase 3).

---

## Problem

Jemand will das SRC machen — oder UBI, den Pyroschein, das LRC. Die Prüfung ist
in sechs Wochen, gelernt wird abends auf dem Sofa mit dem Tablet, in der
S-Bahn mit dem Handy, am Wochenende am Schreibtisch. Der amtliche
Fragenkatalog ist ein PDF mit 180 Fragen; die Lehrbücher erklären viel, aber
sagen nicht, was *diese* Person noch nicht kann.

Was fehlt, ist ein Ort, der drei Dinge zugleich ist: **Lehrbuch** (in
Kapiteln, in eigenen Worten, mit Funksprüchen zum Mitlesen), **Trainer** (der
sich merkt, welche Fragen wackeln) und **Prüfungsbogen** (mit Uhr, so streng
wie der echte). Und der nach jeder Sitzung eine einzige Zahl zeigt: *Wie weit
bin ich?*

## Solution

Eine Lernplattform mit Anmeldung, in der jedes Zeugnis ein Kurs ist und jeder
Kurs denselben Dreiklang hat:

**Lektionen** — 8 bis 10 Kapitel, Lesebreite, Merke-Kästen, Funksprüche als
Dialog. Am Ende jeder Lektion „Das Wichtigste in Kürze“ und der Sprung zu den
passenden Fragen.

**Lerntrainer** — eine Frage, vier Antworten, sofortige Auflösung mit
Erklärung und Link zur Lektion. Tasten 1–4 und Enter reichen. Vier Modi: neue
zuerst, Wackelkandidaten, zufällig, der Reihe nach.

**Prüfungssimulation** — der ganze Bogen auf einer Seite, sticky Uhr, Abgabe
mit Rückfrage, Ergebnis mit jeder falschen Frage aufgelöst. Amtliche Bögen,
sobald sie vorliegen.

Dazu, weil die Funkprüfungen mehr sind als Multiple Choice: Lückentexte für
MAYDAY / PAN PAN / SÉCURITÉ, Reihenfolge-Übungen, Buchstabiertafel,
Übersetzungen mit Musterlösung und ein DSC-Controller zum Anfassen.

## Experience Principles

1. **Ruhe beim Lesen.** Lektionen sind Text auf hellem Grund in Lesebreite —
   keine Kacheln, keine Animationen, nichts, das um Aufmerksamkeit ringt.
2. **Eine Frage zur Zeit.** Der Trainer zeigt nie mehr als eine Frage; die
   Auflösung ersetzt sie, statt darunter zu erscheinen.
3. **Die Prüfung sieht aus wie Papier.** Nummerierte Fragen, Buchstaben A–D,
   ein Kopf mit Zeugnis und Bogen-Nummer. Druckbar.
4. **Fortschritt ist eine Zahl.** Jede Karte auf dem Dashboard hat einen
   Balken und Prozent; Ampel rot/gelb/grün. Keine Abzeichen, keine Punkte.
5. **Ehrlich über den Stand.** Solange Beispielfragen im Katalog sind, sagt
   das die Anwendung an jeder Stelle, an der sie Fragen zeigt.

## Aesthetic Direction

**Scandinavian Functionalism, hell.** Systemschrift, Marineblau als einziger
Akzent, Grün/Gelb/Rot nur für Bewertung und Ampel, Karten mit 1-px-Linie und
kaum Schatten. Der Funkverkehr bekommt eine dunkle Fläche mit Monospace —
das einzige bewusst „technische“ Element, und es markiert genau den Inhalt,
der in der Prüfung wörtlich sitzen muss. Dark Mode über
`prefers-color-scheme`, gedämpft, ohne Umschalter.

Kein Sync der Neon-Tokens von kandzior.de: eine Stunde Lesen und ein
Prüfungsbogen vertragen kein Dunkel-Pink. Die Womo-Schadensakte hat aus
demselben Grund ihre eigene Palette.

## Existing Patterns

- **`womo/`** liefert die technische Vorlage: Front-Controller, `ansicht()`,
  Konfiguration außerhalb des Webroots, CSRF/Origin, Missbrauchsbremse,
  Karten-/Listen-CSS (`.karte`, `.liste`, `.status`, `.filter`). Diese
  Klassennamen sind übernommen, damit sich die Anwendungen gleich anfühlen.
- **`site/tests/*.mjs`** liefert das Testmuster: eigenständige
  Playwright-Skripte mit `OK`/`FEHL`-Zeilen und Exit-Code.
- **`docs/womo/README.md`** liefert die Doku-Gliederung.
