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


---

## Redesign v2 (Swiss/Editorial, 2026-08)

Neues Gewand bei unveränderter Struktur — Richtung vom Auftraggeber gewählt
aus DB-belegten Kandidaten (ui-ux-pro-max) unter den frontend-design-
Philosophien. Fertig-Kriterium jeder Aufgabe: die genannten Suiten grün.

- [x] **R2-1 — Schriften:** EB Garamond (variable) + Lato 400/700 selbst
  gehostet, Preloads umgestellt, alte Familien entfernt. _polish (<120 KB)._
- [x] **R2-2 — Kontrast-Matrix Gold:** vollständig gerechnet; gold-700 trägt
  4,92:1 auf Weiß; einziger Fehlwert gold-700 auf slate-100 → gold-800.
- [x] **R2-3 — Token-Rewrite:** Gold-Skala statt Teal, Radien 0, Schatten →
  Linien, Serif-Typo-Register, Label-Ebene (Mono), Warnfarbe orange.
- [x] **R2-4 — Komponenten-Formwechsel:** Folio-Eyebrow, flache Knöpfe mit
  Invert-Hover, Karten-Hover über die Kante, eckige Toggles/Tabs mit
  Unterkante, Masthead-Logo, Print-Portraitkante. _expertise, verify._
- [x] **R2-5 — Editorial-Layer:** Pull-Quote (#outlook), Drop Cap +
  Print-Caption (#about), Serif-Zahlen mit lining-nums (#proof). _outlook,
  about, stats._
- [x] **R2-6 — Suiten-Anpassung:** expertise (Kante statt Hebung),
  previewcheck (neue Familien), outlook/about (v2-Formsprache); übrige neun
  unverändert grün.
- [x] **R2-7 — OG-Bild v2:** Garamond + Gold, Mono-Folio-Zeile.
- [x] **R2-8 — Regressionslauf:** alle zwölf Suiten grün; axe 0 Verstöße über
  fünf Kombinationen; 176,7 KB gesamt, Schriften 88,8 KB; CLS 0,0017.
- [x] **R2-9 — Doku:** Brief-Addendum „Aesthetic Direction v2",
  Token-Kopfkommentar, dieser Block.

Behobene Regression aus dem Umbau: Masthead-Wortmarke sprengte 320 px um
15 px (17 px-Stufe ohne Mobil-Staffel) — auf 14 px/Mobil zurückgeführt.

## Bilder & Logo (2026-08-17)

Die Originale kamen als eingebettete Bilder an und wurden aus dem
Sitzungsprotokoll extrahiert (Base64). Kein Freisteller vorhanden →
Hero zeigt das volle Foto in runder Maske.

- [x] **B-1 — Aufbereitung:** Hero-Gesichtsausschnitt 800×800 WebP (30 KB),
  Wasserturm-Portrait 760 px WebP (65 KB), Logo auf Inhalt beschnitten als
  Alpha-PNG (10 KB) für die CSS-Maske. Startseite 216,5 KB — im Budget.
- [x] **B-2 — Portrait.astro:** cutout = rundes maskiertes Foto (1/1),
  full = Wasserturm mit Print-Caption; Platzhalterpfad bleibt als
  Rückfallebene. _hero, about._
- [x] **B-3 — Logo.astro:** Marke als CSS-Maske über currentColor-Fläche —
  erbt Theme- und Footer-Farbe aus einer Datei. _footer._
- [x] **B-4 — Suiten:** hero (Platzhalter → echtes Bild, runde Maske),
  footer (logo__family → logo__mark); alle zwölf grün, CLS 0,0000.
- [x] **B-5 — Vorschau:** Assembler als site/scripts/make-vorschau.py ins
  Repo übernommen (Bilder + Maske als data-URIs); Artifact republished.

## Redesign v3 — „Neon Flow" (2026-08-17)

Vorgabe: 21st.dev-Komponente `neon-flow` (TubesBackground). Fertig-Kriterium
jeder Aufgabe: die genannten Suiten grün.

- [x] **N-1 — Effekt vendoren + belegen:** tubes1.min.js aus npm
  (threejs-components@0.0.19, ISC; three.js MIT einkompiliert) nach
  public/vendor; Standalone-Beleg headless: WebGPU verliert das Device
  (SwiftShader), WebGL-Fallback rendert — Suiten testen mit
  --disable-features=WebGPU.
- [x] **N-2 — Kontrastmatrix Neon:** Pink 7,95:1 trägt selbst (dunkle
  Schrift auf Pink-Knopf — Weiß fiele mit 2,5:1 durch); Violett nur
  groß/grafisch (3,76:1), Textstufe #8b7ce8; hell fuchsia-700 6,32:1.
- [x] **N-3 — Tokens v3:** dark-first (:root = Nacht, hell nur per
  Umschalter, kein prefers-Zwilling mehr), Radien zurück, Glow-Tokens,
  ThemeToggle/theme-color entsprechend. _verify, footer._
- [x] **N-4 — Schriften:** Space Grotesk variable statt EB Garamond;
  Preloads/fonts.css/sync-fonts; 67,3 KB geladen. _polish._
- [x] **N-5 — Tubes-Hero:** Canvas hinter dem Inhalt; Laden erst bei
  erster Zeigerbewegung (774 KB nie im Budgetpfad), nie bei Touch/
  Bewegungsreduktion/hellem Theme (dispose beim Wechsel); Klick mischt
  Farben; Mono-Hinweiszeile erscheint erst mit aktivem Effekt. _hero,
  polish (Budget ohne Zeiger)._
- [x] **N-6 — Komponenten:** Glas-Karten mit Glow+Lift, Neon-Knöpfe,
  Drop Cap entfernt (dadurch Zeilenlänge 82 → about-Prosa auf 64ch),
  Outlook-Fußnote sekundär (4,25:1-Fund von axe), Styleguide-Texte v3.
  _expertise, about, outlook._
- [x] **N-7 — Suiten:** verify (Grund/Trennkante), expertise (Pink +
  4px-Lift + Glow), about (20px-Rundung), previewcheck (Grotesk,
  dark-first-Toggle). Alle zwölf grün.
- [x] **N-8 — Endzahlen:** 195,5 KB Startseite (ohne Zeiger) · Schriften
  67,3 KB · axe 0 Verstöße (5 Kombinationen) · CLS 0,0017. OG-Bild v3.
- [x] **N-9 — Vorschau:** Tubes als data-URI im dynamischen Import
  (Artifact hat keinen Server; 1,4 MB, null Netzanfragen), republished.

## Feinschliff v3.1 (2026-08-17)

- [x] **F3-1 — Säulen exklusiver:** Nummern-Folio 01–04 (Mono, Hover →
  Marke), Verlaufs-Oberkante in den Röhrenfarben (0,45 → 1 im Hover),
  Icon-Kacheln 56px mit Verlaufsfläche und Haarlinie. _expertise._
- [x] **F3-2 — Events-Knopf (Ticket Tailor):** Kopfzeile ≥1024px sekundär
  neben dem CTA (extern, noopener, Pfeil-Ikone); mobiles Menü als halbe
  Zeile neben der Anfrage (320px nachgemessen, kein Querscroll). Ziel
  aus events.json (boxOfficeUrl). _verify, footer._
- [x] **F3-3 — Social-Einbettungen:** X-Timeline (Zwei-Klick, rendert als
  iframe mit den letzten Beiträgen) auf data-theme=dark. LinkedIn: kein
  Profil-Feed-Embed seitens LinkedIn — Struktur wartet auf Einbett-URLs
  einzelner Beiträge (social.json, dokumentiert); Facebook: Page-Plugin
  verlangt eine SEITE, martin.kandzior ist ein Profil → Profilkarte
  bleibt. _socialtabs, consent, contact (0 Fremdanfragen ohne Klick)._

## Social-Lösung LinkedIn/Facebook (2026-08-17)

Plattform-Realität: LinkedIn bettet keine Profil-Feeds ein (nur einzelne
Beiträge), Facebooks Page-Plugin verlangt eine Seite statt eines Profils.
Die Lösung fährt zweigleisig:

- [x] **S-1 — Beitrags-Karten (sofort einsatzbereit):** social-posts.json
  → selbst gehostete Karten je Kanal (Wortlaut, Mono-Datum,
  Verlaufskante wie die Säulen, Link zum Original + Profilknopf). Null
  Fremdanfragen, keine Einwilligung nötig; Vorrang-Kaskade je Tab:
  embeds > posts > Profilkarte. _socialtabs, contact._
- [x] **S-2 — Echte iframe-Pfade dokumentiert:** LinkedIn embed/feed/
  update (Beitrag → „Einbetten"), Facebook plugins/post.php für
  ÖFFENTLICHE Einzelbeiträge auch von Profilen — Muster je Kanal in
  social.json (_embeds_beispiel). Gefüllte embeds übernehmen automatisch.
- [ ] **S-3 — Inhalte eintragen:** wartet auf Beitragstexte + Links vom
  Auftraggeber (posts derzeit leer → Tabs zeigen die Profilkarte).

## Feed-Einbettung über Widget-Dienst (2026-08-17)

„Andere schaffen es auch" — ja, über Feed-Widget-Dienste (SociableKIT,
Elfsight, Tagembed, RSS.app), die die Plattformen serverseitig auslesen
und einen iframe liefern. Die Seite ist dafür fertig verdrahtet:

- [x] **W-1 — Verdrahtung:** iframe-Muster je Kanal in social.json
  (_embeds_widget_beispiel), `provider`-Feld → der Einwilligungstext
  nennt den ECHTEN Empfänger der IP („SociableKIT (LinkedIn)"), nicht
  nur die Plattform. Belegt: iframe-Embed läuft durch den Zwei-Klick-
  Mount (widgettest). _socialtabs, consent, contact._
- [ ] **W-2 — Widget anlegen (Auftraggeber, ~5 Min je Kanal):** Konto
  beim Dienst, Widget „LinkedIn Profile Posts" / „Facebook Page Posts"
  mit dunklem Design, iframe-URL + WIDGET_ID in social.json eintragen.
- [ ] **W-3 — VOR Livegang:** Dienst + AV-Vertrag in der Datenschutz-
  erklärung ergänzen (liegt ohnehin bei der Anwaltsprüfung).
