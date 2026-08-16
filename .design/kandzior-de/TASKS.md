# Build Tasks: kandzior.de

Generiert aus: `.design/kandzior-de/DESIGN_BRIEF.md`, `INFORMATION_ARCHITECTURE.md`, `DESIGN_TOKENS.css`
Datum: 2026-08-16
Ästhetik: **Scandinavian Functionalism** — festgelegt in Aufgabe F1, gilt ab dort für alles Weitere.

**Bestandsaufnahme:** Keine Komponenten, keine Seiten, keine Theme-Datei, keine Abhängigkeiten. `site/` enthält bisher nur `public/assets/`. Jede Komponente unten ist neu; es gibt nichts zu übernehmen und nichts zu ändern.

**Umgang mit fehlenden Inhalten:** Portrait, Logo, Kontaktdaten und Impressum-Anschrift liegen noch nicht vor. Betroffene Aufgaben werden gegen klar gekennzeichnete Platzhalter gebaut, die in **einer** Datei zentralisiert sind (`site/src/content/*.json`). Der spätere Austausch ist eine Datenänderung, kein Codeeingriff. Jede solche Stelle trägt den Kommentar `PLATZHALTER:`, damit sie vor dem Livegang auffindbar ist.

---

## Foundation

- [x] **F1 — Gerüst und sichtbares Token-System.** Astro-Projekt in `site/` mit TypeScript, `BaseLayout.astro` (Meta, `lang`, `hreflang`, Preconnect und Stylesheet für Plus Jakarta Sans und Be Vietnam Pro), Tokens aus Phase 4 nach `src/styles/tokens.css` samt `npm run sync:tokens`, dazu `global.css` mit Reset, Grundtypografie und Fokusstilen. **Fertig, wenn** eine Musterseite unter `/styleguide` alle Typo-Stufen, Farbflächen, Knöpfe, Felder, Karten und Schatten in **beiden** Themes zeigt und `npm run build` fehlerfrei durchläuft. _Neu. Legt die Ästhetik fest: Scandinavian Functionalism._
- [x] **F2 — Zweisprachigkeit als Fundament.** Inhaltsmodell in `src/content/de.json` und `src/content/en.json`, Hilfsfunktion `t()` für den Zugriff, Routen `/` und `/en/`, `hreflang` samt `x-default` und kanonische URLs im Layout. **Fertig, wenn** beide Routen dieselbe Seite in unterschiedlicher Sprache rendern und kein einziger sichtbarer Text im Markup hartkodiert ist. _Neu. Vor allen Bereichen, weil nachträgliche Übersetzung jede Komponente erneut anfasst._
- [x] **F3 — Kopfzeile mit Theme- und Sprachumschalter.** Sticky `Header.astro`, Logo, Ankernavigation, Utility-Bereich. Theme-Umschalter mit **flackerfreiem** Start über ein Inline-Skript im `<head>`, das vor dem ersten Rendern liest. Sprachumschalter überträgt den aktuellen Anker. Skip-Link als erstes fokussierbares Element. **Fertig, wenn** ein Neuladen im dunklen Theme kein weißes Aufblitzen zeigt, der Sprachwechsel bei `#about` auf `/en/#about` landet und die gesamte Kopfzeile per Tastatur bedienbar ist. _Neu. Risiko zuerst: Das Aufblitzen ist später kaum noch sauber nachzurüsten._

## Core UI

- [x] **C1 — Hero.** Portrait freigestellt mit Teal-Schein und 10px-Ruhebewegung über 7s, Name, Positionierungssatz, Primär-CTA. **Fertig, wenn** der Bereich auf 375 × 667 ohne Scrollen vollständig sichtbar ist und die Bewegung bei `prefers-reduced-motion` vollständig ruht. _Neu. Früh, weil sich hier entscheidet, ob die Ästhetik trägt._
- [x] **C2 — Zahlen-Band.** Drei Werte (15 Jahre · Mio. USD · Teams bis 50) unmittelbar unter dem Hero. Zähler-Animation nur bei aktivem Sichtbarkeitseintritt, nicht auf Mobil, nicht bei Bewegungsreduktion. **Fertig, wenn** die Zahlen ohne JavaScript vollständig lesbar sind. _Neu. Nutzt `--stat-value-size`._
- [x] **C3 — Expertise-Raster.** Vier Karten mit Icon, Titel, zwei bis drei Sätzen, dazu die Einleitung, die die Klammer benennt. Hebung um 4px bei Hover **und** Tastaturfokus. **Fertig, wenn** das Raster bei 1280/768/375 als 4 / 2×2 / 1 bricht und Fokus dieselbe Hebung auslöst wie Hover. _Neu. Inline-SVG-Icons, keine Icon-Bibliothek._
- [x] **C4 — Industrie 5.0.** Eigener Block mit Zitat-Charakter, visuell klar von den Karten abgesetzt, Kernsatz „Keiner muss Angst haben." **Fertig, wenn** er auf den ersten Blick **nicht** wie eine fünfte Karte aussieht — das ist der ganze Zweck der Trennung. _Neu._
- [x] **C5 — Über mich.** Vollständiges Portrait mit Wasserturm, großzügig, dazu Biografie in Absätzen und erster Person. Enthält „Mannheim" im Fließtext. **Fertig, wenn** die Lesebreite `--max-width-content` einhält und das Bild in beiden Themes eine saubere Kante hat. _Neu._
- [x] **C6 — Fußzeile.** Logo invertiert, Profil-Links, Sprachumschalter, Impressum, Datenschutz, Copyright. Wiederholt die Primärnavigation nicht. **Fertig, wenn** das Logo in beiden Themes korrekt invertiert und alle Rechtslinks erreichbar sind. _Neu. Nutzt `LanguageToggle` aus F3._

## Interactions & States

- [x] **I1 — Einwilligungs-Vorschau als geteilte Komponente.** `ConsentPlaceholder.astro`: gestaltete Karte mit Plattformlogo, Kontextzeile, Knopf „Beiträge laden" und danebenliegendem Direktlink. Lädt das Drittanbieter-Skript **erst** beim Klick. **Fertig, wenn** ein Netzwerkmitschnitt beim Seitenaufruf **null** Anfragen an Fremd-Domains zeigt. Deckt ab: Ruhe, Hover, Fokus, Laden, Geladen, Fehlschlag. _Neu. Grundlage für I2 und I3 — Risiko zuerst, weil davon die Cookie-Banner-Freiheit abhängt._
- [x] **I2 — Social-Tabs.** Tabs LinkedIn / X / Facebook nach ARIA-Tab-Muster mit Pfeiltasten-Bedienung, LinkedIn voreingestellt. Je Tab eine `ConsentPlaceholder`. Eingebettete Beiträge samt Datum in `src/content/social.json`. **Fertig, wenn** die Tabs vollständig per Tastatur bedienbar sind und jeder Tab auch ohne Laden einen Weg zum Profil bietet. _Nutzt I1._
- [x] **I3 — Events.** Ticket-Tailor-Einbindung über `ConsentPlaceholder`, Direktlink auf `https://buytickets.at/mkevents1`, Konfiguration in `src/content/events.json` mit Sichtbarkeitsschalter. **Fertig, wenn** bei `"visible": false` weder Bereich noch Navigationspunkt existieren und die Seite ohne erkennbare Lücke von Social zu Kontakt übergeht. Deckt ab: sichtbar, ausgeblendet, geladen, Fehlschlag. _Nutzt I1. Ankernavigation aus F3 muss bedingt rendern._
- [x] **I4 — Kontaktformular.** Drei Felder mit sichtbaren Labels, Validierung beim Verlassen des Feldes, Honeypot, `aria-invalid`, `aria-describedby`, `aria-live` für Statusmeldungen. Absenden gegen eine **austauschbare** Schnittstelle in `src/content/site.json`. **Fertig, wenn** Erfolg das Formular durch die konkrete Zusage ersetzt und Fehlschlag alle Eingaben erhält und die E-Mail-Adresse als Ausweichweg nennt. Deckt ab: Ruhe, Fokus, ungültig, Laden, Erfolg, Fehlschlag. _Neu. Kontaktdaten sind bis auf Weiteres Platzhalter._
- [x] **I5 — Mobiles Menü.** Hamburger, Vollbild-Overlay, Fokus wandert hinein und wird gefangen, `Esc` schließt, Fokus kehrt zum Auslöser zurück, Scrollen dahinter gesperrt. **Fertig, wenn** die Tastaturbedienung den Fokus nie hinter das Overlay verliert. _Neu. Erweitert `Header` aus F3._

## Responsive & Polish

- [x] **P1 — Rechtstexte und Fehlerseite.** `/impressum`, `/datenschutz`, `/en/imprint`, `/en/privacy`, `/404`. Einspaltiges Layout, Kopfzeile ohne Ankernavigation und ohne CTA. Rechtstexte als strukturierte Gliederung mit `PLATZHALTER:`-Markierungen; die deutsche Fassung trägt den Hinweis, dass sie maßgeblich ist. **Fertig, wenn** alle fünf Routen bauen und aus der Fußzeile erreichbar sind. _Neu. Inhaltliche Prüfung durch einen Anwalt bleibt außerhalb des Umfangs._
- [x] **P2 — Auffindbarkeit.** `Person`-Schema als JSON-LD auf der Startseite (ohne Arbeitgeber, ohne Partei), Titel und Beschreibungen je Sprache, Open Graph mit eigenem Vorschaubild, `sitemap.xml`, `robots.txt`. **Fertig, wenn** „Martin Kandzior Mannheim" wörtlich in Titel, Beschreibung und Fließtext vorkommt und die Sitemap alle sechs Inhaltsseiten führt. _Neu. Halbe Existenzberechtigung der Seite._
- [x] **P3 — Responsive-Durchgang.** Alle Bereiche bei 375, 768, 1280 prüfen. Besonders: Wechsel des Hero-Bildausschnitts, Kartenraster, horizontal scrollende Tabs, zweispaltiger Kontaktbereich. **Fertig, wenn** bei keiner Breite zwischen 320 und 1920 horizontal gescrollt werden muss. Breakpoints: alle drei. _Kein neuer Code, sondern Korrekturen._
- [x] **P4 — Barrierefreiheits-Durchgang.** Fokusringe überall sichtbar, Tab-Reihenfolge folgt der Leserichtung, Berührungsziele ≥ 44px, `alt`-Texte gesetzt, Überschriftenebenen lückenlos, Formularfehler angekündigt, Bewegungsreduktion greift. Kontraste stichprobenartig gegen die gerechneten Werte aus Phase 4 gegenprüfen. **Fertig, wenn** die Seite ohne Maus vollständig bedienbar ist und WCAG 2.2 AA erfüllt. _Prüfung, kein Neubau._
- [x] **P5 — Ladeverhalten.** Portrait in modernen Formaten und mehreren Breiten, `width`/`height` gegen Layoutsprünge, Schriften mit `display: swap` und Vorabladen, JavaScript nur dort, wo es gebraucht wird. **Fertig, wenn** die Startseite ohne geladene Einbettungen keine Fremdanfrage stellt und ohne sichtbaren Layoutsprung erscheint. _Optimierung._

## Review

- [x] **R1 — Design Review.** `/design-review` gegen den Brief. Prüft Hierarchie, Konsistenz, Responsive-Verhalten, Barrierefreiheit und Treue zur Ästhetik, mit Bildschirmfotos je Breakpoint und Theme. Ergebnis: `DESIGN_REVIEW.md` plus `screenshots/`.

---

## Reihenfolge und Begründung

**F1 → F2 → F3** sind zwingend zuerst und in dieser Reihenfolge. Zweisprachigkeit nachzurüsten bedeutet, jede gebaute Komponente ein zweites Mal anzufassen; das flackerfreie Theme lässt sich später nicht sauber nachbessern.

**I1 vor allem, was einbettet.** Wenn die Zwei-Klick-Mechanik nicht trägt, brauchst du doch ein Cookie-Banner — und das ändert die Gestaltung der ganzen Seite. Diese Unsicherheit gehört an den Anfang, nicht ans Ende.

**C1 früh**, damit die ästhetische Richtung an der auffälligsten Stelle überprüfbar ist, bevor Aufwand in Details fließt.

**P1 bis P5 nach allem anderen**, weil sie Bestehendes prüfen und korrigieren, statt Neues zu erzeugen.

## Aufgaben, die auf Zulieferung warten

| Aufgabe | Wartet auf | Umgehung bis dahin |
| --- | --- | --- |
| C1, C5 | Portrait als Datei | Grau hinterlegte Platzhalterfläche im richtigen Seitenverhältnis |
| F3, C6 | Logo als SVG | Wortmarke als Text in Plus Jakarta Sans |
| I2 | Profil-URLs, ausgewählte Beiträge | Beispiel-Einträge in `social.json` |
| I3 | Widget-Snippet aus dem Ticket-Tailor-Konto | Direktlink funktioniert bereits; Einbettung folgt dem dokumentierten Muster |
| I4 | E-Mail-Adresse, Formular-Endpunkt | Schnittstelle bleibt austauschbar, Absenden protokolliert in die Konsole |
| P1 | Ladungsfähige Anschrift | Gliederung mit `PLATZHALTER:`-Markierungen |
| C2 | Exakte Zahl direkt geführter Mitarbeitender | Vorsichtige Formulierung „Teams bis 50" |
