# Design Brief: kandzior.de — Persönliche Expertise-Website

> Phase 2 von 7 im Designer-Flow. Vorgänger: Grill Me (Phase 1, kein File).
> Nachfolger: `INFORMATION_ARCHITECTURE.md` (Phase 3).

---

## Problem

Ein Geschäftsführer, Mitte 40, hat auf einem Termin oder über eine Empfehlung von Martin Kandzior gehört. Er hat keine Visitenkarte, keine E-Mail, keine Nummer — nur einen Namen. Er googelt „Martin Kandzior Mannheim" und hat vielleicht **90 Sekunden**, bevor der nächste Termin beginnt.

In diesen 90 Sekunden muss er eine einzige Frage beantworten: **Ist das jemand, dem ich ernsthaft schreiben soll?**

Was ihm heute begegnet, beantwortet die Frage nicht. Ein LinkedIn-Profil hinter einer Anmeldeschranke. Verstreute Erwähnungen. Nichts, was ihm sagt, *woran* dieser Mensch arbeitet, *wie tief* das geht und *wie* er ihn erreicht. Also legt er das Thema weg. Nicht weil er Nein gesagt hätte — sondern weil ihm niemand einen Grund gegeben hat, Ja zu sagen, und ein Kontaktweg gefehlt hat.

Die zweite, seltenere Person: jemand, der Martins E-Mail bereits im Postfach hat und vor dem Antworten kurz nachschaut, mit wem er es zu tun hat. Für ihn ist die Seite kein Kontaktweg, sondern eine Bestätigung. **Die Seite wird nicht für ihn gebaut** — sie arbeitet für ihn trotzdem.

---

## Solution

Eine einzelne Seite, die in der Reihenfolge liest, in der die Frage im Kopf des Besuchers entsteht:

**Wer ist das?** — Ein Gesicht, ein Name, ein Satz. Kein Rätselraten, kein Scrollen. Innerhalb der ersten Bildschirmhöhe steht, worin Martin arbeitet und für wen.

**Kann der was?** — Vier Arbeitsfelder und eine Haltung, klar getrennt. Dazu drei belastbare Zahlen und ein Lebenslauf in Absätzen statt in Stichpunkten. Konkret, ohne Arbeitgeber oder Partei zu nennen — die Spezifik liegt in der Sache, nicht in Namen.

**Stimmt das auch?** — Der Beleg liegt außerhalb der Seite. LinkedIn, X und Facebook sind direkt eingebunden und verifizierbar. Die Seite behauptet nichts, was ein Klick nicht bestätigt.

**Wo treffe ich ihn?** — Kommende Veranstaltungen aus Ticket Tailor, sofern welche anstehen. Ein Termin im Kalender ist der stärkste Vertrauensbeweis, den eine Seite anbieten kann: Man kann hingehen und nachsehen.

**Wie erreiche ich ihn?** — Ein kurzes Formular, das nach dem Anliegen fragt, nicht nach einem Lebenslauf. Drei Felder, ein Absenden, eine klare Bestätigung.

Der ganze Rest der Seite existiert, um diesen letzten Schritt wahrscheinlicher zu machen. Es gibt genau **eine** Primäraktion. Alles andere ordnet sich unter.

---

## Experience Principles

**1. Belegen statt behaupten** — *Jede Aussage über Martin muss entweder eine Zahl, ein Bild oder ein klickbarer Beleg sein.* Adjektive kosten Vertrauen, Zahlen bauen es auf. Wo kein Beleg existiert, steht keine Aussage. Ein leeres Feld ist besser als ein Platzhalter: „Ich arbeite an verschiedenen Projekten" liest sich nicht neutral, sondern wie Verstecken.

**2. Breite als Beweis, nicht als Entschuldigung** — *Fünf Felder wirken nur dann souverän, wenn die Seite erklärt, warum sie zusammengehören.* Logistik, Risiko, M&A, Industrie 5.0 und Politik nebeneinander können „macht alles" heißen oder „bewegt sich in Räumen, die sich sonst nicht berühren". Die zweite Lesart entsteht nicht von selbst — sie muss durch Reihenfolge, Überschrift und Einleitung erzwungen werden.

**Was Arbeit ist und was Haltung ist, wird dabei getrennt.** Vier der fünf Karten beschreiben, woran Martin arbeitet. Die fünfte — Industrie 5.0, Automatisierung, KI und Robotik — beschreibt, wo er die Wirtschaft hingehen sieht und welche Haltung er dazu einnimmt: *Keiner muss Angst haben.* Das ist eine Position, keine Dienstleistung, und die Seite muss diesen Unterschied sichtbar machen. Eine Meinung als Leistung zu verkaufen, wäre genau die Sorte Unschärfe, die Prinzip 3 verbietet. Als klar erkennbare Haltung ist sie dagegen wertvoll: Sie ist das Einzige auf der Seite, worüber der Leser anderer Meinung sein kann — und damit das Einzige, worüber er schreiben wird.

**3. Neutralität ohne Vagheit** — *Kein Arbeitgeber, keine Partei, kein Amt — aber jeder Satz so spezifisch wie ohne diese Namen möglich.* „Seit 15 Jahren im internationalen Logistik- und Finanzgeschäft" statt „vielseitig erfahren". Die Compliance-Grenze verläuft bei Eigennamen, nicht bei Substanz.

---

## Aesthetic Direction

> **Ersetzt durch v2** — siehe „Aesthetic Direction v2 (Redesign 2026-08)" am
> Ende dieses Dokuments. Dieser Abschnitt bleibt als Historie erhalten.

- **Philosophy**: **Scandinavian Functionalism** — skandinavische Wärme auf einem Rams-Raster. Klare Struktur, großzügige Weißräume, weiche Tiefe statt harter Schatten, ein einziger funktionaler Akzent. Die geometrische Präzision kommt aus dem Logo, die Wärme aus dem Portrait.
- **Tone**: Ruhig, erwachsen, zugewandt. Ein Mensch, der zuhört, bevor er verkauft. Nicht laut, nicht bescheiden.
- **Reference points**: Stripe (Ruhe und Hierarchie), Linear (Präzision im Detail), Basecamp/37signals (Direktheit im Text), die Portrait-Seiten guter Anwaltskanzleien (Seriosität ohne Steifheit).
- **Anti-references**:
  - **Berater-Landingpage** — Stock-Fotos von Handshakes, „Ich helfe Unternehmen dabei, ihr volles Potenzial zu entfalten", Countdown-Timer, Testimonial-Karussell.
  - **Tech-Startup** — Lila Verläufe auf Weiß, schwebende Glasscheiben, Neon auf Schwarz, animierte Blobs.
  - **Lebenslauf im Web** — Zeitstrahl mit Firmenlogos, Skill-Balken in Prozent, „Über mich" in der dritten Person.
  - **Politiker-Seite** — Deutschlandfarben, Wahlkampf-Duktus, Parteilogos. Diese Seite ist ausdrücklich parteiagnostisch.

---

## Existing Patterns

Der Codebase-Scan ergab: **kein bestehendes Design-System.** Das Repository enthält ein Affiliate-Automations-Projekt (Python, SQL, Docker, eine einzelne React-Komponente `AffiliateAutomationDashboard.jsx`, eine statische `START_HERE.html`) ohne jeden Bezug zu diesem Vorhaben.

Geprüft und **nicht vorhanden**: `tokens.css`, `variables.css`, `theme.css`, `:root`-Deklarationen, `tailwind.config.*`, `components.json`, MUI/Chakra-Themes, `components/`-Verzeichnis, `.storybook/`, JSON-Token-Dateien, `package.json` mit UI-Abhängigkeiten, `@font-face`-Deklarationen.

**Konsequenz:** Wir starten bei null. Es gibt kein Vokabular zu respektieren und nichts zu erweitern. Die Seite entsteht isoliert im Ordner `site/`; am bestehenden Affiliate-Code wird nichts angefasst.

- Typography: keine — wird in Phase 4 definiert
- Colors: keine — wird in Phase 4 definiert
- Spacing: keine — wird in Phase 4 definiert
- Components: keine — jede Komponente unten ist neu

### Markenmaterial (vorhanden, außerhalb des Repos)

| Asset | Zustand | Bemerkung |
| --- | --- | --- |
| Portrait | Vorhanden, hohe Auflösung, Hochformat | Blaues Sakko, weißes Hemd ohne Krawatte, offenes Lächeln. Hintergrund: Mannheimer Wasserturm mit Springbrunnen. Warm und zugewandt — trägt den Ton der ganzen Seite. |
| Logo | Vorhanden als schwarzes PNG auf Weiß, quadratisch | Geometrisches „MK"-Monogramm, horizontal geteilt durch die gesperrte Wortmarke MARTIN KANDZIOR. Setzt die typografische Richtung. |

**Beide Dateien fehlen noch im Repository.** Erwartet werden sie unter:

```
site/public/assets/
├── portrait-martin-kandzior.jpg     ← Original, ungeschnitten, max. Auflösung
├── logo-mk.svg                       ← Vektor, transparent, einfarbig (currentColor)
└── logo-mk.png                       ← Fallback, transparent
```

---

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `BaseLayout` | New | HTML-Gerüst, Meta-Tags, `hreflang`, JSON-LD `Person`-Schema, Font-Preload |
| `Header` | New | Sticky, Logo links, Ankernavigation, Sprach- und Theme-Umschalter |
| `LanguageToggle` | New | DE/EN. Zustand in `localStorage`, echte URLs `/` und `/en/` |
| `ThemeToggle` | New | Hell (Default) / Dunkel. `localStorage`, respektiert `prefers-color-scheme` beim Erstbesuch |
| `MobileNav` | New | Hamburger, Vollbild-Overlay, Fokus-Falle, `Esc` schließt |
| `Hero` | New | Portrait, Positionierungssatz, Primär-CTA. Erste Bildschirmhöhe ohne Scrollen vollständig |
| `ExpertisePillar` | New | Karte: Icon, Titel, 2–3 Sätze. Sanfter Hover-Lift |
| `ExpertiseGrid` | New | Fünf Karten. Desktop 3 + 2 mittig, Tablet 2 + 2 + 1, Mobil gestapelt |
| `About` | New | Portrait-Wiederholung in anderer Behandlung, Fließtext-Biografie, Stichpunkte |
| `StatsRow` | New | Drei Zahlen. Zähler-Animation nur bei `prefers-reduced-motion: no-preference` |
| `SocialTabs` | New | Tabs LinkedIn / X / Facebook. **Zwei-Klick-Einbettung**, siehe Key Interactions |
| `ConsentPlaceholder` | New | Vorschaukarte vor dem Laden eines Drittanbieter-Widgets. Von `SocialTabs` und `EventsSection` gemeinsam genutzt |
| `EventsSection` | New | Kommende Veranstaltungen aus Ticket Tailor. Zwei-Klick-Einbettung, definierter Leerzustand, blendet sich bei Bedarf aus |
| `EventCard` | New | Fallback-Darstellung für manuell gepflegte Termine: Datum, Titel, Ort, Link zur Anmeldung |
| `CTABand` | New | „Lust, was Großes zu starten?" plus Stats-Row |
| `ContactForm` | New | Name, E-Mail, Anliegen. Client-Validierung, Lade-/Erfolgs-/Fehlerzustand, Honeypot |
| `ContactInfo` | New | E-Mail, Ort, Profil-Links |
| `Footer` | New | Logo invertiert, Social-Links, Sprachumschalter, Impressum, Datenschutz |
| `LegalPage` | New | Zwei Unterseiten: Impressum, Datenschutzerklärung |
| `Icon` | New | Inline-SVG-Set. Keine Icon-Library als Abhängigkeit |

---

## Key Interactions

**Sprachumschaltung.** Klick auf DE/EN führt auf die entsprechende URL (`/` ↔ `/en/`), nicht auf einen DOM-Austausch. Die Wahl wird in `localStorage` gemerkt und bei erneutem Besuch berücksichtigt — aber **nie automatisch weitergeleitet**, wenn der Nutzer eine Sprache explizit angesteuert hat. Getrennte URLs sind Pflicht, weil Auffindbarkeit unter „Martin Kandzior Mannheim" die halbe Existenzberechtigung der Seite ist; ein reiner JavaScript-Umschalter macht eine der beiden Sprachen für Suchmaschinen unsichtbar.

**Theme-Umschaltung.** Hell ist Standard. Beim allerersten Besuch entscheidet `prefers-color-scheme`; danach gewinnt die manuelle Wahl. Das Umschalten passiert ohne Aufblitzen — das Theme wird vor dem ersten Rendern gesetzt.

**Expertise-Karten.** Hover hebt die Karte um 4 px und verstärkt den Schatten weich (200 ms, `ease-out`). Kein Kippen, kein Rotieren, kein Glühen — die 3D-Wirkung entsteht durch Ebenen und Licht, nicht durch Effekte. Tastaturfokus zeigt dieselbe Hebung plus sichtbaren Fokusring.

**Social-Tabs mit Zwei-Klick-Einbettung.** Jeder Tab zeigt zunächst eine gestaltete Vorschaukarte: Plattform-Logo, Martins Profilname, ein Satz Kontext, ein Knopf „Beiträge laden". **Erst dieser Klick lädt das Drittanbieter-Skript.** Ohne Klick verlässt kein Byte den Server dieser Seite. Damit entfällt das Cookie-Banner ersatzlos. Neben dem Knopf steht immer ein direkter Profil-Link — wer nicht laden will, kommt trotzdem hin.

**Events.** Der Bereich lädt das Ticket-Tailor-Widget nach demselben Zwei-Klick-Muster wie die Social-Tabs — Vorschaukarte, dann Klick, dann Skript. Daneben steht immer ein direkter Link zur Ticket-Tailor-Box-Office-Seite, damit auch ohne Laden ein Weg zum Termin führt.

Entscheidend ist der **Leerzustand**, denn er tritt zwangsläufig ein. Stehen keine Veranstaltungen an, zeigt der Bereich weder eine leere Liste noch „Keine Events gefunden" — beides liest sich wie ein aufgegebenes Projekt. Stattdessen **blendet sich der Bereich vollständig aus**, inklusive seines Navigationspunktes. Eine Seite ohne Events-Bereich wirkt vollständig; ein Events-Bereich ohne Events wirkt verlassen. Das Ein- und Ausblenden geschieht über einen Schalter im Inhaltsdatensatz, nicht über einen Code-Eingriff.

**Kontaktformular.** Validierung erfolgt beim Verlassen des Feldes, nicht bei jedem Tastendruck. Fehler stehen unter dem Feld, in Worten, ohne Rot-Gewitter. Beim Absenden wird der Knopf zum Ladezustand und ist gesperrt. Erfolg ersetzt das Formular durch eine Bestätigung mit einer konkreten Zusage („Ich melde mich innerhalb von zwei Werktagen"), nicht durch ein anonymes „Danke". Fehlschlag zeigt die eingegebenen Daten weiterhin an und nennt die E-Mail-Adresse als Ausweichweg — die Anfrage darf niemals verloren gehen.

**Sticky Header.** Beim Scrollen nach unten verkleinert sich der Header und legt eine weiche Trennkante an. Er verschwindet nicht — der CTA muss jederzeit erreichbar bleiben.

---

## Responsive Behavior

Mobile first. Breakpoints: **375 / 768 / 1280**.

| Bereich | Mobil | Tablet | Desktop |
| --- | --- | --- | --- |
| Navigation | Hamburger, Vollbild-Overlay | Hamburger | Horizontale Ankerleiste |
| Hero | Gestapelt, Portrait über Text, Portrait beschnitten | Gestapelt, größeres Portrait | Zweispaltig, Text links, Portrait rechts |
| Expertise | Eine Spalte | 2 + 2 + 1 | 3 + 2 mittig |
| Über mich | Gestapelt | Gestapelt | Zweispaltig |
| Social-Tabs | Tabs scrollen horizontal, Einbettung volle Breite | Tabs nebeneinander | Tabs nebeneinander, Inhalt zentriert, max. 680 px |
| Events | Termine untereinander, volle Breite | Zwei Spalten | Zwei Spalten, max. 960 px |
| Stats | Untereinander | Drei nebeneinander | Drei nebeneinander |
| Formular | Volle Breite, Felder gestapelt | Volle Breite | Zweispaltig: Formular links, Kontaktdaten rechts |

**Verhaltensänderungen, nicht nur Größenänderungen:**
- Die Navigation wechselt unter 768 px die Interaktionsform vollständig
- Das Hero-Portrait wechselt Bildausschnitt und Position, nicht nur Skalierung
- Die Zähler-Animation der Stats-Row entfällt auf Mobil — sie kostet dort mehr als sie bringt
- Social-Einbettungen laufen auf Mobil grundsätzlich im Ein-Spalten-Layout, unabhängig davon, was der Anbieter liefert

---

## Accessibility Requirements

**Kontrast — mit einer konkreten Einschränkung, die das Farbschema betrifft.** Teal `#0d9488` erreicht auf Weiß nur **3,74:1**. Das genügt für große Schrift (ab 24 px bzw. 19 px fett), für Flächen und für Bedienelemente — **nicht** für Fließtext. Für Text auf hellem Grund wird deshalb ein dunklerer Teal-Ton verwendet (Richtwert `#0f766e`, ca. 5,1:1). Auf dem dunklen Nachtblau `#0f172a` erreicht `#0d9488` dagegen **4,84:1** und ist dort für Fließtext zulässig. Phase 4 legt das verbindlich fest.

- Fließtext mindestens 4,5:1, große Schrift und Bedienelemente mindestens 3:1, in **beiden** Themes
- Vollständige Tastaturbedienbarkeit: sichtbarer Fokusring auf jedem interaktiven Element, mindestens 3:1 zum Untergrund, niemals `outline: none` ohne Ersatz
- Fokusverwaltung im mobilen Menü: Fokus wandert beim Öffnen hinein, wird gefangen, kehrt beim Schließen zum Auslöser zurück, `Esc` schließt
- Social-Tabs als echtes ARIA-Tab-Muster: Pfeiltasten wechseln, `aria-selected`, `role="tabpanel"`
- Formularfelder mit sichtbaren `<label>`, nicht mit Platzhaltertext; Fehler via `aria-describedby` und `aria-invalid`; Statusmeldungen in einer `aria-live`-Region
- `prefers-reduced-motion: reduce` deaktiviert Float, Zähler und Scroll-Reveals vollständig — nicht abgeschwächt, sondern aus
- Portrait mit beschreibendem `alt`; Logo im Header als Text-Alternative „Martin Kandzior"; dekorative Grafiken `aria-hidden`
- Sprachwechsel setzt `lang` korrekt; Sprachumschalter tragen `hreflang` und `lang`
- Zielgröße für Berührung mindestens 44 × 44 px

**Zielniveau: WCAG 2.2 AA.**

---

## Out of Scope

Ausdrücklich **nicht** Teil dieses Briefs:

- **Blog, News, Publikationen.** Regelmäßiger Inhalt braucht regelmäßige Pflege. Ein verwaister Blog schadet mehr, als er nützt.
- **Content-Management-System.** Inhalte liegen als Markdown/JSON im Repository und werden per Commit geändert.
- **Newsletter, Chat-Widget, Downloads.** Jede zweite Aktion schwächt die eine, auf die es ankommt.
- **Eigene Termin- oder Ticketverwaltung.** Veranstaltungen werden ausschließlich in Ticket Tailor gepflegt und von dort eingebunden. Diese Seite speichert keine Anmeldungen, verarbeitet keine Zahlungen und führt keine eigene Terminliste.
- **Mehrseitige Struktur.** Eine Seite plus Impressum plus Datenschutzerklärung. Sonst nichts.
- **Weitere Sprachen** über DE und EN hinaus.
- **Analytics und Tracking.** Kein Google Analytics. Falls später Messung gewünscht ist, dann cookiefrei und serverseitig — als eigene Entscheidung, nicht als Beifang.
- **Nennung von Arbeitgebern, Parteien, Ämtern oder Organisationen.** Gilt für alle Texte, Bildunterschriften und Meta-Daten ohne Ausnahme.
- **Das bestehende Affiliate-Automations-Projekt** im Wurzelverzeichnis. Wird nicht angefasst, nicht verschoben, nicht aufgeräumt.
- **Rechtsberatung.** Ich liefere Struktur und Platzhalter für Impressum und Datenschutzerklärung. Die inhaltliche Prüfung ist Sache eines Anwalts — insbesondere die Formulierungen zur Verarbeitung der Formulardaten.

---

## Offene Punkte

Diese Fragen blockieren Phase 3 nicht, müssen aber vor Phase 6 (Bauen) beantwortet sein:

| # | Punkt | Warum es zählt | Spätestens vor |
| --- | --- | --- | --- |
| 1 | ~~Substanz hinter der KI-Säule~~ | **Geklärt.** Keine Kundenprojekte, sondern eine wirtschaftliche Position: Industrie 5.0 mit KI und Robotik, und die Haltung „Keiner muss Angst haben". Bleibt drin — aber als Haltung ausgewiesen, nicht als Leistung. Siehe Prinzip 2. | — |
| 2 | **Bilddateien im Repository** | Ohne Portrait kein Hero. Logo als PNG auf weißem Grund ist auf dunklem Untergrund unbrauchbar — SVG mit Transparenz nötig. | Phase 6 |
| 3 | **Wasserturm behalten oder freistellen?** | Siehe unten. | Phase 3 |
| 4 | **Exakte Zahl direkt geführter Mitarbeitender** | „Leitung und Mitarbeit in Teams mit ca. 50" ist nicht „50 geführt". Auf der ersten Seite der eigenen Visitenkarte zu übertreiben, ist teuer. | Phase 6 |
| 5 | **Ladungsfähige Anschrift fürs Impressum** | Bei einer Privatperson ohne Geschäftsadresse ist das die Wohnadresse. Sollte vor dem Livegang bewusst entschieden sein. | Livegang |
| 6 | **Hosting und Formular-Endpunkt** | Wird hosting-neutral gebaut, der Endpunkt bleibt austauschbar. Die Entscheidung kostet später nichts. | Livegang |
| 7 | **Kontaktdaten** | E-Mail-Adresse für Formular und Kontaktbereich, Profil-URLs für LinkedIn, X, Facebook. | Phase 6 |
| 8 | **Biografie- und Säulentexte** | Entwurf kommt von mir, Korrektur von Martin. Schneller als andersherum. | Phase 6 |
| 9 | ~~Ticket-Tailor-Zugangsdaten~~ | **Geklärt.** Box Office: `https://buytickets.at/mkevents1`, Kürzel `mkevents1`. Offen bleibt nur das exakte Widget-Snippet — siehe Hinweis unter der Tabelle. | Phase 6 |
| 10 | **Rechtliches zum Ticketverkauf** | Kostenpflichtige Tickets bedeuten Handel: Das wirkt auf Impressum, Umsatzsteuer, Widerrufsrecht und AGB. Kostenlose Anmeldungen sind unkritisch. Gehört auf den Tisch des Anwalts aus dem Out-of-Scope-Punkt. | Livegang |

### Zu Punkt 9: das Ticket-Tailor-Snippet

Die Box-Office-Adresse lautet **`https://buytickets.at/mkevents1`**. Der Direktlink neben der Vorschaukarte steht damit fest und funktioniert unabhängig von jeder Einbettung.

Für die eingebettete Variante erzeugt Ticket Tailor im Konto unter **Box Office → Publish → Website widget** ein Snippet, das eine kontospezifische `data-url` enthält. Dieses Snippet sollte aus dem Dashboard kopiert werden, statt es aus dem Kürzel zu rekonstruieren — es enthält Parameter, die je Konto abweichen können. Bis es vorliegt, wird gegen das dokumentierte Muster gebaut und die Konfiguration in **einer** Datei (`site/src/content/events.json`) gehalten, sodass der Austausch eine Zeile ist und keinen Codeeingriff bedeutet.

*Anmerkung zur Prüfbarkeit:* Ich konnte die Box-Office-Seite aus dieser Umgebung nicht aufrufen — die Domain ist durch den Egress-Proxy blockiert. Ob dort aktuell Termine stehen und wie die Seite aussieht, ist von hier aus nicht überprüfbar. Der Leerzustand aus dem Abschnitt „Key Interactions" wird deshalb so gebaut, dass er unabhängig davon trägt.

### Zu Punkt 3: der Wasserturm

Ursprünglich war „Portrait freigestellt" entschieden — Martin ohne Hintergrund, schwebend. Das Portrait zeigt aber den **Mannheimer Wasserturm**, und das ist kein beliebiger Hintergrund: Es ist das Wahrzeichen der Stadt, die im Suchbegriff steht, der diese Seite überhaupt findbar macht. Freistellen wirft diesen Anker weg.

Empfehlung: **Beides nutzen, an verschiedenen Stellen.** Im Hero das freigestellte Portrait wie geplant — dort zählt die Person allein. Im Bereich „Über mich" das vollständige Foto mit Wasserturm, großzügig und ungeschnitten. Dann trägt das Hero die Person und der Bio-Bereich den Ort, und beide Bilder haben eine Aufgabe statt einer Wiederholung.

### Zur Typografie: drei Schriften sind eine zu viel

Entschieden waren Plus Jakarta Sans, Inter und Be Vietnam Pro. Drei Schriftfamilien auf einer einzelnen Seite erzeugen keine Hierarchie, sondern Unruhe — und laden drei Schriftpakete statt zwei. Inter ist zudem die am häufigsten verwendete Schrift im Web und trägt keine Handschrift.

Empfehlung: **Plus Jakarta Sans** für Überschriften — geometrisch, mit der gleichen konstruierten Anmutung wie das MK-Monogramm — und **Be Vietnam Pro** für Fließtext: ruhiger, gut ausgebauter Schnittsatz, saubere deutsche Umlaute. **Inter entfällt.** Zwei Familien, klare Rollen, halbe Ladezeit. Verbindlich festgelegt in Phase 4.


---

## Aesthetic Direction v2 (Redesign 2026-08)

Auf Wunsch des Auftraggebers unter Einsatz der Skills `frontend-design` und
`ui-ux-pro-max` neu gerichtet. Struktur, Inhalte und IA blieben unverändert —
gewechselt hat ausschließlich das visuelle Gewand.

- **Philosophy**: **Swiss Modernism 2.0 + Editorial** — DB-Stil
  `swiss-modernism-2-0` (einziger von 88 mit „professional services" im
  Einsatzgebiet) als Fundament: strenges Raster, Linien statt Schatten,
  Flachheit, eckige Formen, EIN Akzent. Darüber `editorial-grid-magazine`
  als Layer: Folio-Label mit Regel-Linie (alle Sektionen), Pull-Quote
  (#outlook), Drop Cap und Print-Bildunterschrift (#about) — Autorität
  statt Landingpage.
- **Farbwelt**: DB-Palette „Banking/Traditional Finance" — Navy `#0f172a`
  bleibt exakt, Akzent **Gold `#a16207`** (yellow-700) statt Teal. Gold
  trägt 4,92:1 auf Weiß und darf damit — anders als das Teal — selbst Text,
  Link und Knopffüllung sein. Dunkles Theme: gold-600 als Textakzent
  (gedeckt), gold-500 für Füllungen. Warnfarbe wurde orange, damit Status
  nie wie Marke aussieht.
- **Typografie**: DB-Paarung „Legal Professional" — **EB Garamond**
  (variable, Display) + **Lato** (400/700, Fließtext; 500/600 existieren in
  Lato nicht) + ui-monospace als Label-Ebene. Selbst gehostet, Initialladung
  ≈ 89 KB.
- **Tone**: unverändert. **Anti-references**: unverändert gültig.
- Alle Kontraste neu gerechnet (Tabelle im Kopf von DESIGN_TOKENS.css);
  zwölf Prüfsuiten grün, axe WCAG 2.2 AA ohne Verstöße, Startseite 176,7 KB.
