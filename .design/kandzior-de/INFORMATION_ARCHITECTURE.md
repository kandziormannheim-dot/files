# Information Architecture: kandzior.de

> Phase 3 von 7 im Designer-Flow. Vorgänger: `DESIGN_BRIEF.md` (Phase 2).
> Nachfolger: `DESIGN_TOKENS.css` (Phase 4).

**Ausgangslage:** Kein bestehendes Routing, keine Navigations- oder Layout-Komponenten, kein Content-Modell im Repository. Der Ordner `site/` enthält bisher ausschließlich `public/assets/`. Diese Architektur entsteht vollständig neu und erweitert nichts.

---

## Grundentscheidung: eine Seite, nicht mehrere

Der Besucher hat 90 Sekunden und **eine** Frage. Jeder Seitenwechsel ist ein Moment, in dem er abbrechen kann — und ein Ladevorgang, in dem er auf einen leeren Bildschirm sieht. Deshalb liegt der gesamte inhaltliche Ablauf auf **einer** Seite, in der Reihenfolge, in der die Frage im Kopf entsteht. Die Navigation springt zu Ankern, sie wechselt keine Dokumente.

Eigene Dokumente bekommen nur die beiden Rechtstexte — weil sie lang, langweilig und rechtlich eigenständig sind — sowie eine Fehlerseite.

---

## Site Map

```
DEUTSCH (Standard)
- Startseite  /
  ├── #hero          Wer ist das
  ├── #proof         Drei Zahlen
  ├── #expertise     Vier Arbeitsfelder
  ├── #outlook       Haltung: Industrie 5.0
  ├── #about         Über mich
  ├── #social        LinkedIn / X / Facebook
  ├── #events        Kommende Veranstaltungen (bedingt sichtbar)
  └── #contact       Anfrage + Kontaktdaten
- Impressum   /impressum
- Datenschutz /datenschutz

ENGLISCH
- Home        /en/
  └── identische Ankerstruktur
- Imprint     /en/imprint
- Privacy     /en/privacy

GLOBAL
- Fehlerseite /404
- Sitemap     /sitemap.xml
- Robots      /robots.txt
```

**Ankerbezeichner sind in beiden Sprachen identisch und englisch.** Fragmente sind technische Bezeichner, kein Inhalt — und weil sie gleich heißen, kann der Sprachumschalter die **Scrollposition erhalten**: Wer bei `#about` auf EN klickt, landet auf `/en/#about` und nicht wieder ganz oben. Lokalisierte Anker würden diesen Sprung kaputt machen und brächten weder für Nutzer noch für Suchmaschinen einen Vorteil.

---

## Navigation Model

**Primärnavigation — maximal fünf Punkte.**

| Position | DE | EN | Ziel | Sichtbarkeit |
| --- | --- | --- | --- | --- |
| 1 | Expertise | Expertise | `#expertise` | immer |
| 2 | Über mich | About | `#about` | immer |
| 3 | Social | Social | `#social` | immer |
| 4 | Events | Events | `#events` | **nur wenn Termine anstehen** |
| 5 | Kontakt | Contact | `#contact` | immer |

Fünf Punkte sind die Obergrenze — darüber wird die Leiste zur Liste und verliert ihre Orientierungsfunktion. Deshalb stehen **Industrie 5.0** und die Zahlen bewusst *nicht* in der Navigation: Beide liegen so früh im Ablauf, dass man sie beim Scrollen zwangsläufig passiert. Ein Navigationspunkt wäre reine Dopplung.

Der aktive Bereich wird beim Scrollen hervorgehoben (`IntersectionObserver`, nicht Scroll-Position-Rechnerei).

**Utility-Navigation** — rechts im Header, getrennt von der Primärnavigation:
- Sprachumschalter DE / EN
- Theme-Umschalter Hell / Dunkel
- Primär-CTA „Anfrage senden" → `#contact` (erscheint erst nach Verlassen des Hero, damit er nicht mit dem Hero-CTA konkurriert)

**Sekundärnavigation:** existiert genau einmal — die Tab-Leiste innerhalb von `#social` (LinkedIn / X / Facebook). Sonst nirgends. Zwei Ebenen sind das Maximum, tiefer geht diese Seite nicht.

**Mobile Navigation** (< 768 px): Hamburger rechts, Vollbild-Overlay mit den fünf Primärpunkten untereinander, darunter Sprach- und Theme-Umschalter, unten der CTA als vollbreite Fläche. Öffnen setzt den Fokus ins Overlay und fängt ihn; `Esc` und Klick auf einen Punkt schließen; der Fokus kehrt zum Hamburger zurück. Das Overlay ersetzt die Navigation vollständig — es gibt keine Bottom-Tabs und keine ausklappbaren Unterebenen.

**Footer-Navigation:** Logo, die drei Profil-Links, Sprachumschalter, Impressum, Datenschutz, Copyright. Der Footer wiederholt die Primärnavigation **nicht** — auf einer Einzelseite ist der Nutzer am Ende schon durch alles gescrollt.

**Skip-Link:** „Zum Inhalt springen" als erstes fokussierbares Element, sichtbar nur bei Tastaturfokus.

---

## Content Hierarchy

### Startseite — Reihenfolge und Begründung

**1. `#hero` — Wer ist das?**
Portrait, Name, Positionierungssatz, Primär-CTA. Muss ohne Scrollen vollständig sichtbar sein, auch auf 375 × 667. Der Positionierungssatz ist die erste Zeile, die der Besucher liest — sie beantwortet „Was macht der?" bevor er entscheidet, ob er weiterliest.

**2. `#proof` — Drei Zahlen.**
15 Jahre · Mio. USD · Teams bis 50. Schmales Band direkt unter dem Hero.

*Abweichung vom ursprünglichen Entwurf, bewusst:* Die Stats-Row war als Teil des CTA-Bands an Position 6 geplant. Damit hätte die überwiegende Mehrheit der Besucher sie nie gesehen — die drei Zahlen sind aber der schnellste verfügbare Beleg und beantworten „Kann der was?" in drei Sekunden. Belege gehören dorthin, wo noch gelesen wird, nicht ans Ende. Das CTA-Band verliert dadurch nichts; es behält Überschrift und Knopf.

**3. `#expertise` — Vier Arbeitsfelder.**
Logistische Risiken · E-Commerce-Logistik · M&A · Wirtschaft & Politik. Je Karte: Icon, Titel, zwei bis drei Sätze. Kurze Einleitung darüber, die die Klammer benennt — ohne sie liest sich die Breite als Beliebigkeit (Prinzip 2 aus dem Brief).

*Abweichung, bewusst:* Ursprünglich waren es fünf Karten in einem 3-plus-2-Raster. Es sind jetzt **vier Karten plus ein eigener Block**, weil KI/Industrie 5.0 keine Leistung ist, sondern eine Haltung — und Kategorien nicht vermischt werden dürfen. Nebenwirkung: Vier Karten rastern auf jedem Breakpoint sauber (4 / 2 × 2 / 1), fünf hätten auf jeder Breite eine ungleiche Reihe erzeugt.

**4. `#outlook` — Industrie 5.0.**
Eigener Block mit Zitat-Charakter, visuell klar von den Karten abgesetzt: „Keiner muss Angst haben." Darunter zwei bis drei Sätze zu Automatisierung, KI und Robotik und dazu, was das für Menschen in Betrieben bedeutet.

Steht direkt nach der Expertise, weil der Kontrast dort am stärksten wirkt: erst was er tut, dann wo er hinschaut. Es ist der einzige Teil der Seite, dem der Leser widersprechen kann — und damit der wahrscheinlichste Anlass, das Formular auszufüllen.

**5. `#about` — Über mich.**
Vollständiges Foto mit Wasserturm, großzügig. Biografie in Absätzen, erste Person. Darin untergebracht, was in der Stats-Row keinen Platz hat: internationaler Aufbau von Organisationen, durchschnittliches Auftragsvolumen, Größenordnungen. Ort und Herkunft werden hier benannt — die Seite wird unter „Martin Kandzior **Mannheim**" gefunden, und das Wort muss im Fließtext vorkommen, nicht nur im Bild.

**6. `#social` — Der externe Beleg.**
Tabs LinkedIn / X / Facebook, Zwei-Klick-Einbettung. LinkedIn ist der erste und voreingestellte Tab: Es ist das einzige Profil, das der Zielperson etwas bedeutet.

Steht bewusst **nach** der Biografie: erst behauptet die Seite etwas, dann bietet sie den Ort an, wo man es prüfen kann. Umgekehrt wäre es eine Aufforderung zum Wegklicken, bevor die Botschaft steht.

**7. `#events` — Kommende Veranstaltungen.** *(bedingt sichtbar)*
Ticket-Tailor-Einbindung, Zwei-Klick, plus direkter Box-Office-Link. Ohne anstehende Termine verschwindet der Bereich vollständig, samt Navigationspunkt.

Steht nach Social, weil Termine derselben Kategorie angehören: Beleg, nicht Angebot. Und **vor** dem Kontakt, weil ein Termin ein zweiter Weg zum ersten Gespräch ist — wer sich nicht traut zu schreiben, kommt vielleicht hin.

**8. `#contact` — Die eine Aktion.**
Überschrift „Lust, was Großes zu starten?", darunter Formular (Name, E-Mail, Anliegen) und rechts die Kontaktdaten.

*Abweichung, bewusst:* CTA-Band und Kontaktbereich waren zwei getrennte Abschnitte. Ein CTA-Band unmittelbar über dem Formular, auf das es verweist, ist eine Aufforderung, das zu tun, was ohnehin direkt darunter steht — das kostet Höhe und wirkt wie ein Verkaufstrichter. Zusammengelegt.

**9. Footer.**
Logo invertiert, Profil-Links, Sprachumschalter, Impressum, Datenschutz, Copyright.

### Impressum / Datenschutz

Reine Textdokumente, ein Inhaltsspalten-Layout, gleiche Kopf- und Fußzeile, kein CTA, keine Einbettungen. Zurück-Link in den Kopfbereich. Die **deutsche Fassung ist die rechtlich maßgebliche**; die englischen Fassungen sind Übersetzungen und tragen einen entsprechenden Hinweis.

### Fehlerseite

Logo, „Diese Seite gibt es nicht", ein Knopf zurück zur Startseite. Sprache richtet sich nach dem Pfadpräfix.

---

## User Flows

### Fluss A — Der primäre Fluss: Empfehlung ohne Kanal

1. Besucher hört Martins Namen auf einem Termin, hat keine Kontaktdaten
2. Sucht „Martin Kandzior Mannheim" → Treffer `kandzior.de`
3. Landet auf `/`, sieht Hero: Gesicht, Name, Positionierungssatz
   - **Bricht ab**, wenn der Satz nicht anschlussfähig ist → Seite hat verloren, ohne Rückfrage
   - **Scrollt weiter** → nächster Schritt
4. Liest die drei Zahlen (ca. 3 Sekunden)
5. Überfliegt die vier Arbeitsfelder, bleibt an dem hängen, das sein Thema berührt
6. Stößt auf Industrie 5.0 — stimmt zu oder widerspricht. Beides erhöht die Wahrscheinlichkeit einer Nachricht
7. Entscheidungspunkt:
   - **Überzeugt** → springt per CTA zu `#contact` → Fluss E
   - **Braucht Bestätigung** → scrollt zu `#about`, dann `#social` → Fluss C
   - **Nicht überzeugt** → verlässt die Seite
8. Ziel: abgeschickte Anfrage mit konkretem Anliegen

### Fluss B — Der Mitnahme-Fluss: Kanal vorhanden

1. Besucher hat Martins E-Mail im Postfach, sucht vor dem Antworten nach dem Namen
2. Landet auf `/`, überfliegt Hero, Zahlen, Arbeitsfelder — Dauer typischerweise unter 30 Sekunden
3. Verlässt die Seite **ohne** Interaktion
4. Antwortet in seinem E-Mail-Programm

Für diesen Fluss wird nichts gebaut, nichts gemessen und nichts optimiert. Er ist Mitnahmeeffekt. **Wichtig ist nur, dass die Seite ihn nicht abschreckt** — kein Cookie-Banner, kein Overlay, kein Newsletter-Popup, keine Wartezeit. Genau deshalb sind Einbettungen Zwei-Klick.

### Fluss C — Prüfen des Belegs

1. Besucher erreicht `#social`
2. Sieht die Vorschaukarte des voreingestellten LinkedIn-Tabs
3. Entscheidungspunkt:
   - **„Beiträge laden"** → Skript wird geladen, Einbettung erscheint an Ort und Stelle → zurück zu Fluss A Schritt 7
   - **Direkter Profil-Link** → verlässt die Seite Richtung LinkedIn → *Risiko: kommt eventuell nicht zurück.* Deshalb öffnet der Link in einem neuen Tab
   - **Anderer Tab** → wechselt zu X oder Facebook, Vorgang wiederholt sich

### Fluss D — Der Veranstaltungsfluss

1. Besucher erreicht `#events` (nur wenn Termine anstehen)
2. Sieht Vorschaukarte mit Anzahl kommender Termine
3. „Termine laden" → Ticket-Tailor-Widget erscheint
4. Klickt einen Termin → Ticket Tailor öffnet in neuem Tab
5. Anmeldung findet **vollständig außerhalb** dieser Seite statt — kein Datenrückfluss, keine Bestätigung hier

Steht kein Termin an, existiert weder Bereich noch Navigationspunkt. Der Übergang von `#social` zu `#contact` ist dann nahtlos und für den Besucher nicht als Lücke erkennbar.

### Fluss E — Die Anfrage

1. Besucher erreicht `#contact`, per CTA-Sprung oder durch Scrollen
2. Sieht drei Felder: Name, E-Mail, Anliegen
3. Füllt aus, verlässt jeweils das Feld → Validierung greift beim Verlassen, nicht beim Tippen
   - **Feld ungültig** → Meldung unter dem Feld, in Worten; Fokus bleibt, wo er ist
   - **Alles gültig** → Absenden ist möglich
4. Absenden → Knopf geht in den Ladezustand, ist gesperrt
   - **Erfolg** → Formular wird durch Bestätigung ersetzt: „Ich melde mich innerhalb von zwei Werktagen." Die Zusage ist konkret, weil ein anonymes „Danke" den Besucher im Ungewissen lässt
   - **Fehler** → Eingaben bleiben vollständig erhalten, Fehlermeldung nennt die E-Mail-Adresse als Ausweichweg. Eine Anfrage darf nie verloren gehen
5. Ziel erreicht

### Fluss F — Sprachwechsel

1. Besucher klickt DE/EN, an beliebiger Stelle der Seite
2. Aktueller Anker wird gelesen und an die Ziel-URL angehängt (`/en/#about`)
3. Wahl wird in `localStorage` abgelegt
4. Besucher landet an **derselben inhaltlichen Stelle** in der anderen Sprache

Bei einem späteren Besuch von `/` wird die gemerkte Sprache berücksichtigt — **aber nur, wenn der Nutzer ohne Sprachpräfix kommt.** Wer `/en/` direkt aufruft oder aus einem Suchergebnis kommt, wird niemals umgeleitet. Automatische Weiterleitungen aufgrund von Browsersprache oder Standort finden nicht statt: Sie brechen Suchmaschinen-Indexierung und verärgern Zweisprachige.

---

## Naming Conventions

| Konzept | DE | EN | Begründung |
| --- | --- | --- | --- |
| Arbeitsfelder | Expertise | Expertise | In beiden Sprachen gleich, spart eine Übersetzungsvariante. „Leistungen" wurde verworfen — es verspricht ein Dienstleistungsangebot, das die Seite nicht macht |
| Haltungsblock | Industrie 5.0 | Industry 5.0 | Etablierter Begriff, kein Kunstwort. Trägt die Botschaft ohne Erklärung |
| Biografie | Über mich | About | Erste Person, nicht „Über Martin Kandzior" — die Seite spricht als er, nicht über ihn |
| Profile | Social | Social | Kurz, in beiden Sprachen verstanden. „Soziale Medien" klingt behördlich |
| Veranstaltungen | Events | Events | Im Deutschen etabliert und kürzer als „Veranstaltungen" |
| Primäraktion | Anfrage senden | Send enquiry | Konkret. Nicht „Kontakt aufnehmen" (vage) und nicht „Jetzt durchstarten" (Verkäufersprache) |
| Kontaktbereich | Kontakt | Contact | — |
| Formularfeld 3 | Ihr Anliegen | Your enquiry | Fragt nach der Sache, nicht nach einer „Nachricht". Wer nach dem Anliegen gefragt wird, schreibt zwei konkrete Sätze statt „Hallo, melden Sie sich mal" |
| Einbettung laden | Beiträge laden | Load posts | Benennt genau, was passiert |
| Rechtstext 1 | Impressum | Imprint | — |
| Rechtstext 2 | Datenschutz | Privacy | — |
| Anrede | Sie | you | Durchgehend Siezen. Die Zielperson ist ein Geschäftsführer Mitte 40, den ein „Du" auf einer Erstbegegnung irritiert |

**Was nirgends vorkommt:** Arbeitgebernamen, Parteinamen, Amtsbezeichnungen, Organisationsnamen — auch nicht in `alt`-Texten, Bildunterschriften, Dateinamen, Meta-Beschreibungen oder strukturierten Daten.

---

## Component Reuse Map

| Komponente | Verwendet auf | Unterschiede |
| --- | --- | --- |
| `BaseLayout` | allen Seiten | Meta-Daten und `hreflang` je Seite; `Person`-Schema nur auf der Startseite |
| `Header` | allen Seiten | Auf Rechtstexten und Fehlerseite ohne Ankernavigation und ohne CTA — nur Logo, Sprache, Theme |
| `Footer` | allen Seiten | identisch |
| `LanguageToggle` | Header, Footer, Mobile-Overlay | Behält den Anker nur auf der Startseite; auf Rechtstexten führt er auf die entsprechende Übersetzung |
| `ThemeToggle` | Header, Mobile-Overlay | identisch |
| `ConsentPlaceholder` | `#social`, `#events` | Plattformlogo, Text und Ziel-Link je Verwendung unterschiedlich; Mechanik identisch |
| `Section` | allen Startseiten-Bereichen | Einheitlicher vertikaler Rhythmus, Überschriftenebene, `id`-Anker. Wechselnde Hintergrundtöne zur Abgrenzung |
| `Button` | Hero, Header, Kontakt, Events, Fehlerseite | Zwei Varianten: primär (gefüllt) und sekundär (Umriss). Nur eine primäre Ausprägung pro Bildschirmhöhe |
| `Icon` | Expertise, Social, Kontakt, Footer | Inline-SVG, erbt `currentColor` |

---

## Content Growth Plan

| Bereich | Wächst? | Umgang |
| --- | --- | --- |
| Hero, Zahlen, Expertise, Industrie 5.0, Über mich | Nein | Fester Inhalt, Änderung per Commit. Keine Vorkehrungen nötig |
| Events | Ja, aber **extern** | Ticket Tailor ist die alleinige Quelle. Diese Seite führt keine Liste, kein Archiv, keine Paginierung. Vergangene Termine verschwinden automatisch, weil das Widget nur kommende zeigt |
| Social | Ja, aber **extern** | X aktualisiert sich selbst. **LinkedIn und Facebook nicht:** LinkedIn bietet keine einbettbaren Profil-Feeds, nur einzelne Posts; Facebooks Page-Plugin verlangt eine Seite, kein Profil. Diese beiden Tabs sind handverlesen und **müssen gepflegt werden** |
| Rechtstexte | Selten | Änderung per Commit |

**Die einzige wiederkehrende Pflegeaufgabe** sind die LinkedIn- und Facebook-Einbettungen. Ein eingebetteter Beitrag von vor acht Monaten sagt dem Besucher „inaktiv" — das Gegenteil dessen, wofür der Bereich existiert. Deshalb wird beim Bauen eine Datei `site/src/content/social.json` angelegt, in der die eingebetteten Beiträge samt Datum stehen, mit einem Kommentar zur empfohlenen Prüffrequenz (**vierteljährlich**). Wenn die Pflege realistisch nicht stattfindet, ist die ehrlichere Lösung, LinkedIn und Facebook auf reine Profilkarten ohne Einbettung zu reduzieren — die Entscheidung lässt sich jederzeit ohne Umbau treffen.

Ein Blog ist und bleibt außerhalb des Umfangs (siehe Brief). Sollte er je dazukommen, ist der Anschlusspunkt `/blog` mit `/blog/<slug>` und `/en/blog/<slug>` — die URL-Struktur unten hält den Platz dafür frei, ohne ihn zu belegen.

---

## URL Strategy

**Muster:** `/<sprachpräfix>/<seiten-slug>` — Deutsch ohne Präfix, Englisch unter `/en/`.

| Regel | Festlegung |
| --- | --- |
| Standardsprache | Deutsch, ohne Präfix. Die Zielperson ist deutschsprachig; die kürzere URL gehört dem häufigeren Fall |
| Zweitsprache | `/en/` als Pfadpräfix. Keine Subdomain, keine Länderdomain, kein Query-Parameter |
| Schreibweise | Durchgehend Kleinbuchstaben, Wörter mit Bindestrich getrennt, keine Umlaute, kein abschließender Schrägstrich außer bei `/en/` |
| Dynamische Segmente | **Keine.** Alle Routen sind statisch und zur Bauzeit bekannt |
| Query-Parameter | **Keine.** Kein Filtern, kein Sortieren, kein Blättern, keine Tracking-Parameter in eigenen Links |
| Fragmente | Die acht Anker der Startseite, in beiden Sprachen identisch |
| `hreflang` | Jede Seite verweist auf ihre Entsprechung plus `x-default` auf die deutsche Fassung |
| Kanonisch | Jede Seite trägt eine absolute kanonische URL auf sich selbst |
| Weiterleitungen | `www` → ohne `www`; HTTP → HTTPS. Sonst keine |
| Sprachweiche | Server- oder browserseitige Sprachumleitung findet **nicht** statt. Nur der ausdrückliche Klick wechselt die Sprache |

**Vollständige Routenliste:**

```
/                  Startseite DE
/impressum         Impressum DE
/datenschutz       Datenschutzerklärung DE
/en/               Startseite EN
/en/imprint        Imprint EN
/en/privacy        Privacy EN
/404               Fehlerseite
/sitemap.xml       enthält alle sechs Inhaltsseiten
/robots.txt        erlaubt alles, verweist auf die Sitemap
```

Reserviert, aber nicht angelegt: `/blog`, `/en/blog`.

---

## Offene Punkte aus Phase 3

| # | Punkt | Betrifft |
| --- | --- | --- |
| A | **Vier statt fünf Expertise-Karten** — Bestätigung, dass Industrie 5.0 als eigener Haltungsblock steht und nicht als fünfte Karte | Phase 6 |
| B | **Zahlen-Band an Position 2** statt im CTA-Band am Ende | Phase 6 |
| C | **CTA-Band und Kontakt zusammengelegt** — „Lust, was Großes zu starten?" wird zur Überschrift des Kontaktbereichs | Phase 6 |
| D | **Pflege der LinkedIn- und Facebook-Einbettungen** — vierteljährlich, oder auf reine Profilkarten reduzieren | vor Livegang |
| E | Übernommen aus Phase 2: Bilddateien, Ticket-Tailor-Zugang, Kontaktdaten, Impressum-Anschrift, Team-Zahl, Texte, Hosting | Phase 6 |
