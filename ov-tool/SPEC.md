# OV-Management-Tool – CDU Seckenheim-Friedrichsfeld

**Adresse:** https://management.cdu-sf.de
**Stand:** Oktober 2026 · Version 0.3 (Vorlagen aus Einladung 19.02.2026 und Protokoll 26.02.2026; Satzungsvorgaben Bund/BW in Abschnitt 2a)
**Umsetzung:** Claude Code, arbeitspaketweise (siehe Abschnitt 9)

---

## 1. Ziel

Ein schlankes, selbst gehostetes Werkzeug für den Vorstand des CDU-Ortsverbands, das die laufende Parteiarbeit an einem Ort bündelt:

- Vorstandssitzungen von der Einladung bis zum genehmigten Protokoll
- Aufgaben mit Verantwortlichen und Fristen, damit nach Sitzungen nichts versandet
- Aktionen und Termine (Infostände, Plakataktionen, Veranstaltungen) mit Helferplanung
- Stadtteil-Themen und Bürgeranliegen mit nachvollziehbarem Verlauf
- Link-Hub zu CDUplus, Webseiten und Social-Media-Accounts des OV

Das Tool erstellt Einladungen, Tagesordnungen und Protokollvorlagen **selbstständig** aus den vorhandenen Daten. Aus Transkripten (Handy, Plaud, Teams, Zoom) erzeugt es einen Protokollentwurf inklusive Beschlüssen und Aufgaben.

### Nicht-Ziele

- **Keine Mitgliederverwaltung.** Mitgliederdaten bleiben in den offiziellen Parteisystemen.
- Keine direkte Integration in CDUplus (keine öffentliche Schnittstelle bekannt), nur Verlinkung.
- Kein direktes Posten auf Social Media (ggf. später als Redaktionsplan).

---

## 2. Nutzer und Rollen

Nutzerkreis: Vorstand des OV, ca. 10–12 Personen. Login per **Magic Link** (E-Mail-Link, kein Passwort).

| Rolle | Rechte |
|---|---|
| **Admin** | Alles, inkl. Nutzerverwaltung, Einstellungen, Vorlagen, Versand von Einladungen |
| **Schriftführer** | Wie Vorstand, zusätzlich Protokolle erstellen/bearbeiten, Transkripte hochladen, Protokolle versenden |
| **Vorstand** | Alles lesen; eigene Aufgaben bearbeiten; Aufgaben, Themen, Aktionen und TO-Vorschläge anlegen; sich für Helferschichten eintragen; Zu-/Absage zu Sitzungen |
| **Lesezugriff** | Nur lesen (z. B. Ehrenvorsitz), Zu-/Absage zu Sitzungen |
| **Gast** | Kooptierte Gäste: erhalten Einladungen und Protokolle, erscheinen in der Anwesenheitsliste, können zu-/absagen. Login optional (dann wie Lesezugriff). |

Jeder Nutzer hat zusätzlich eine **Funktionsbezeichnung** (z. B. „Ortsvorsitzender“, „stellv. Vorsitzender“, „Schriftführer“, „Stadtrat“, „Beisitzerin“, „Beisitzer & Handwerksberater“, „Ehrenvorsitzende“) und eine **Sortierposition**. Beides steuert die Reihenfolge und Beschriftung in Anwesenheitslisten. Funktion und Rolle sind unabhängig voneinander (der Schriftführer muss nicht die Rolle *Schriftführer* haben, wenn ein anderer protokolliert).

Status von Gästen ist änderbar (Kooptierung erteilen/entziehen); ein Entzug deaktiviert den Zugang, die Person bleibt in alten Protokollen erhalten.

Unabhängig von der App-Rolle hat jeder Nutzer ein **Stimmrecht im Vorstand** (`stimmberechtigt` / `beratend` / `ohne`). Gewählte Vorstandsmitglieder und Ehrenvorsitzende auf Lebenszeit sind stimmberechtigt (LV-Satzung § 37 Abs. 1), Mitglieder nach § 37 Abs. 2 (z. B. Kreisvorstandsmitglieder aus dem OV, Vereinigungsvorsitzende) beratend, kooptierte Gäste ohne Stimmrecht. Nur Stimmberechtigte zählen für die Beschlussfähigkeit.

Rechte werden **serverseitig** geprüft, nie nur in der Oberfläche.

---

## 2a. Satzungsvorgaben (verbindlich für die Umsetzung)

Geprüft: Statut der CDU Deutschlands (Stand 21.02.2026) und Satzung/Verfahrensordnung der CDU Baden-Württemberg (Stand Mai 2026). Für den OV gilt die Landessatzung; soweit sie nichts regelt, das Bundesstatut (Statut § 50). Eine eigene Satzung oder Geschäftsordnung des OV bzw. des Kreisverbands Mannheim ist noch zu prüfen.

| Thema | Regel | Quelle | Umsetzung im Tool |
|---|---|---|---|
| Sitzungsrhythmus | Vorstand tagt **mindestens alle zwei Monate**, außerdem auf Antrag von fünf Mitgliedern in angemessener Frist | LV § 37 Abs. 3 i. V. m. § 31 Abs. 3 | Dashboard-Warnung, wenn seit der letzten Sitzung bald zwei Monate vergangen sind und keine neue geplant ist. TO-Vorschläge können als „Antrag auf Einberufung“ markiert werden; ab fünf Unterstützern Hinweis an den Admin |
| Einberufung | durch den Vorsitzenden, schriftlich, per Telefax oder E-Mail, **mit Tagesordnung** | LV § 37 Abs. 3, § 50 Abs. 3 und 4 | Versand nur durch Admin; Einladung ohne TO lässt sich nicht versenden |
| Ladungsfrist | E-Mail spätestens am **7. Tag**, Post spätestens am 8. Tag vor der Sitzung; bei Eilbedürftigkeit angemessen verkürzbar | LV § 50 Abs. 3 | Standard 7 Tage, nicht unterschreitbar ohne Häkchen „eilbedürftig“ plus Begründung, die im Protokoll unter Formalia erscheint |
| Beschlussfähigkeit | ordnungsgemäß einberufen und **mindestens die Hälfte** (LV § 52) bzw. **mehr als die Hälfte** (Statut § 40) der Stimmberechtigten anwesend; Enthaltungen zählen mit | LV § 52 Abs. 1, Statut § 40 Abs. 1 | Das Tool rechnet mit der strengeren Regel (**mehr als die Hälfte**) und zeigt live „x von y anwesend – beschlussfähig ja/nein“. Wert in den Einstellungen umstellbar, falls der Kreisverband das anders auslegt |
| Feststellung | vor Eintritt in die TO durch den Vorsitzenden | Statut § 40 Abs. 2 | Pflichtschritt im Live-Protokoll vor TOP 1 |
| Beschlussunfähigkeit | Vorsitzender muss die Sitzung **sofort aufheben** und neu einladen; Form und Frist sind dann nicht bindend, die neue Sitzung ist **in jedem Fall beschlussfähig** – darauf ist in der Einladung hinzuweisen | LV § 52 Abs. 3 | Button „Sitzung wegen Beschlussunfähigkeit aufheben“: setzt Status `AUFGEHOBEN`, sperrt Beschlüsse, erzeugt Folgesitzung mit Vorlage `einladung.wiederholung` (inkl. Pflichthinweis). Eine Wiedereröffnung derselben Sitzung ist nur möglich, wenn das Quorum inzwischen erreicht ist |
| Vertretung | Vorstandsmitglieder können sich nicht vertreten lassen | LV § 31 Abs. 4 | keine Stimmrechtsübertragung im Datenmodell |
| Digitale/hybride Sitzung | Vorstandssitzungen in Präsenz oder digital; Recht auf Zuschaltung, wenn angeboten; Vorstand kann hybrid in begründeten Fällen ausschließen | LV § 50 d | Sitzungsform `PRÄSENZ` / `DIGITAL` / `HYBRID`; Anwesenheitsstatus `anwesend (digital)` zählt für das Quorum |
| Mehrheiten | einfache Mehrheit der abgegebenen gültigen Stimmen; **Enthaltungen gelten als nicht abgegeben**; Stimmengleichheit = abgelehnt | LV § 55 Abs. 1 | Ergebnis wird aus Ja/Nein/Enthaltung automatisch berechnet und vorgeschlagen |
| Umlaufverfahren | zulässig für Vorstände; **unzulässig, wenn mehr als ein Viertel widerspricht**; Beschluss braucht die **Mehrheit aller Stimmberechtigten** (nicht nur der Antwortenden); Einleitung, Widerspruch und Stimmabgabe schriftlich oder elektronisch; Vorsitzender stellt Ergebnis fest und gibt es bekannt. **Schweigen gilt nicht als Zustimmung.** | Statut § 42 Abs. 3, LV § 55 Abs. 1 | Allgemeines Modul „Umlaufbeschluss“ (nicht nur für Protokolle), siehe 3.3 |
| Niederschrift | Pflicht; muss Ort, Zeitpunkt, Dauer, gestellte Anträge, Abstimmungen und Ergebnisse enthalten; bei Wahlen alle Bewerber, gültige Stimmen, Stimmen je Bewerber, offen/geheim | LV § 51 Abs. 1 und 2 | Protokoll kann erst versendet werden, wenn diese Pflichtangaben vollständig sind (Prüfliste im Editor) |
| Unterzeichnung und Übersendung | vom Protokollführer im Einvernehmen mit dem Vorsitzenden zu unterzeichnen und **der zuständigen Geschäftsstelle zu übersenden** | LV § 51 Abs. 3 | Einstellung „E-Mail der Kreisgeschäftsstelle“; nach Genehmigung Button bzw. automatischer Versand des PDF dorthin, Versand wird protokolliert |
| Datenschutz | Verarbeitung nach DSO; Auftragsverarbeiter sorgfältig auswählen und kontrollieren | DSO § 8 | AV-Vertrag mit Hoster und Prüfung der Claude-API-Bedingungen (siehe offene Punkte) |

---

## 3. Module

### 3.1 Dashboard (Startseite)

- Meine offenen Aufgaben (überfällige zuerst)
- Nächste Sitzung mit Status (Einladung versendet? Zusagen?)
- Nächste Aktionen/Termine, offene Helferschichten
- Zuletzt geänderte Stadtteil-Themen
- Schnellzugriff Link-Hub

Mobile-first: Auf dem Handy stehen Aufgaben und Termine oben.

### 3.2 Sitzungen

**Ablauf einer Vorstandssitzung im Tool:**

1. **Anlegen:** Datum, Uhrzeit, Ort und/oder Online-Link (Teams/Zoom), Sitzungsart.
2. **Tagesordnung wird automatisch vorbelegt** aus der Vorlage (Standard-TOPs, siehe 3.6), plus:
   - „Genehmigung des Protokolls vom …“, verknüpft mit dem letzten Protokoll im Status *versendet*
   - Stadtteil-Themen, die als „für nächste Sitzung“ markiert sind
   - Überfällige Aufgaben als Bericht unter einem eigenen TOP
   - TO-Vorschläge von Vorstandsmitgliedern (Admin übernimmt oder verwirft)
3. **Einladung wird automatisch erzeugt** (Vorlage + Sitzungsdaten + TO) und dem Admin als Entwurf vorgelegt. Admin prüft, passt ggf. an und versendet per E-Mail an alle aktiven Nutzer und Gäste. PDF auf dem OV-Briefbogen hängt an, mit eingescannter Unterschrift des Absenders (falls hinterlegt).
4. **Ladungsfrist:** In den Einstellungen konfigurierbar, **Standard 7 Tage** (bisherige Praxis). Das Tool erinnert den Admin rechtzeitig, wenn die Einladung noch nicht raus ist. Rückmeldefrist für Zu-/Absagen: Standard 2 Tage vor der Sitzung.
5. **Zu-/Absagen:** Jedes Mitglied sagt im Tool zu oder ab (persönlicher Link in der Einladungsmail, funktioniert ohne Login). Ersetzt die bisherige Rückmeldung per E-Mail.

**Tagesordnung im Detail:**
- Zwei Ebenen: TOPs und Unterpunkte (z. B. TOP 1.1). Nummerierung wird automatisch berechnet, Reihenfolge per Drag & Drop.
- TOP-Status: `OFFEN`, `BEHANDELT`, `ABGESETZT`, `VERTAGT`. Ein abgesetzter oder vertagter TOP wird bei der nächsten Sitzung als Vorschlag wieder angeboten.
- Datum und Uhrzeit kommen in Betreff, Brief, Mail und Protokoll aus **einem einzigen Feld**. (In der Einladung vom 19.02.2026 stand im Betreff 18 Uhr, im Text 19 Uhr – das kann so nicht mehr passieren.)
6. **Nach der Sitzung:** Anwesenheit erfassen, Protokoll erstellen (3.3).

Sitzungsstatus: `GEPLANT → EINGELADEN → DURCHGEFÜHRT` (oder `ABGESAGT`).

### 3.3 Protokolle

**Drei Wege zum Protokoll:**

1. **Live während der Sitzung:** Protokollvorlage ist bereits mit Datum, Ort, Anwesenden und TO-Struktur vorbefüllt. Pro TOP ein Textfeld, Beschlüsse und Aufgaben direkt am TOP erfassen. Muss am Laptop und Tablet gut bedienbar sein; automatisches Zwischenspeichern.
2. **Nachträglich aus Transkript** (siehe 3.4).
3. **Nachträglich manuell** (Text einfügen, Struktur folgt der TO).

**Aufbau des Protokolls** (aus dem bisherigen Protokoll übernommen, Vorlage `templates/protokoll.dokument.hbs`):

1. Kopf: Datum, Ort, Beginn/Ende (mit optionaler Unterbrechung, z. B. „Wiedereröffnung 18:15 Uhr“), Sitzungsleitung (Freitext, da sie wechseln kann), Protokollführung, „Einladung vom … per E-Mail“
2. Anwesenheit: Tabelle Name · Funktion · Status (`anwesend`, `entschuldigt`, `nicht anwesend`) – vorbefüllt aus Nutzern/Gästen und den Zu-/Absagen
3. Formalia: Eröffnung, **Beschlussfähigkeit** (ja/nein; Quorum in den Einstellungen konfigurierbar, das Tool zeigt anhand der Anwesenheit einen Hinweis), Wiedereröffnung, Änderungen der Tagesordnung (abgesetzte TOPs werden automatisch erwähnt), Umgang mit dem Protokoll der letzten Sitzung
4. Verlauf je TOP: Stichpunkte („–“) mit Unterpunkten („·“), am Ende optional **Beschluss:** oder **Ergebnis:** (fett)
5. Übersicht „Beschlüsse und Ergebnisse“ (automatisch aus den TOPs)
6. Aufgabentabelle Nr. · Aufgabe · Verantwortlich · Frist (automatisch aus den Aufgaben der Sitzung)
7. Ende der Sitzung, Unterschriftenfelder für zwei Unterzeichner (Standard: Vorsitzender/Protokoll und stellv. Vorsitzender, je Protokoll änderbar)

**Beschlüsse und Ergebnisse:** Gegenstand/Antragstext, Art (`BESCHLUSS` = abgestimmt, `ERGEBNIS` = Feststellung ohne Abstimmung), Ergebnisart (`ANGENOMMEN_EINSTIMMIG`, `ANGENOMMEN_MEHRHEITLICH`, `ABGELEHNT`, `FESTGESTELLT`, `ABGESETZT`, `VERTAGT`, `KENNTNISNAHME`), optional Stimmen ja/nein/Enthaltung, laufende Nummer (z. B. `2026-07`). Aus einem Beschluss können mit einem Klick Aufgaben erzeugt werden.

**Workflow:**

`ENTWURF → VERSENDET → GENEHMIGT`

- *Entwurf:* bearbeitbar durch Admin und Schriftführer.
- *Versendet:* per E-Mail an Vorstand und Gäste (PDF). Inhalt gesperrt; Korrekturen nur als neue Version mit Änderungshinweis. Beim Versand wird der Genehmigungsweg gewählt:
  - **in der Folgesitzung** (Standard): der TOP „Genehmigung des Protokolls“ wird automatisch in die nächste TO aufgenommen; Markieren als genehmigt setzt den Status.
  - **im Umlaufverfahren** (über das Modul Umlaufbeschluss, siehe unten).
- *Genehmigt:* mit Datum und Weg (Sitzung vom … / Umlaufverfahren bis …).

Export: PDF (Briefbogen) und DOCX (gleiche Struktur, für Nachbearbeitung in Word). Nach Genehmigung: Übersendung an die Kreisgeschäftsstelle (LV § 51 Abs. 3).

**Umlaufbeschluss** (Statut § 42 Abs. 3) – für Protokollgenehmigungen und beliebige Beschlüsse zwischen Sitzungen:
1. Admin leitet ein: Beschlusstext, Begründung, Frist (Standard 7 Tage). Alternativ kann eine Sitzung beschließen, ein Umlaufverfahren durchzuführen.
2. Versand an alle **Stimmberechtigten** per E-Mail mit persönlichem Link (Vorlage `umlauf.einleitung`). Optionen: *Zustimmung*, *Ablehnung*, *Enthaltung*, *Widerspruch gegen das Umlaufverfahren*.
3. Das Tool zeigt laufend: Widersprüche (Grenze: mehr als ein Viertel → Verfahren automatisch **unzulässig**, Abbruch und Hinweis „in der nächsten Sitzung behandeln“) und Zustimmungen (Grenze: **Mehrheit aller Stimmberechtigten**).
4. Nach Fristablauf oder sobald das Ergebnis feststeht: Admin stellt das Ergebnis fest; Bekanntgabe an den Vorstand (Vorlage `umlauf.ergebnis`). Nicht abgegebene Stimmen zählen **nie** als Zustimmung.
5. Das Ergebnis wird mit Beschlussnummer gespeichert und in der nächsten Sitzung automatisch unter Formalia/„Bericht über Umlaufbeschlüsse“ aufgeführt. Alle Stimmen werden mit Zeitstempel archiviert.

**Vertraulichkeit:** Protokolle enthalten Aussagen über Personen und innerparteiliche Vorgänge. Sie sind nur für angemeldete Nutzer sichtbar, PDF-Downloads werden im Audit-Log erfasst, Links in Mails führen immer über den Login (bzw. einen persönlichen, ablaufenden Token).

### 3.4 Transkript-Pipeline

**Quellen:**

| Quelle | Format | Verarbeitung |
|---|---|---|
| Handy-Aufnahme | Audio (m4a, mp3, wav) | Transkription auf eigenem Server |
| Plaud o. ä. | Text-/DOCX-Export oder Audio | Text direkt, Audio wie oben |
| Teams | VTT oder DOCX-Transkript | Text direkt (Sprecher werden übernommen) |
| Zoom | VTT/TXT-Transkript | Text direkt |

**Ablauf:**

1. Schriftführer/Admin lädt Datei zur Sitzung hoch und bestätigt per Checkbox: *„Alle Anwesenden haben der Aufnahme zugestimmt.“* (Pflicht).
2. Audio wird mit **faster-whisper** (selbst gehostet, Docker) auf Deutsch transkribiert. Läuft als Hintergrundjob, Fortschritt sichtbar. Audio verlässt den Server dabei nicht.
3. Das Transkript wird zusammen mit TO und Anwesenheitsliste an die **Claude API** übergeben. Ergebnis als strukturierte Daten (JSON):
   - Protokolltext je TOP (sachlich, Ergebnisprotokoll, keine wörtlichen Zitate)
   - erkannte Beschlüsse mit Abstimmungsergebnis
   - erkannte Aufgaben mit Vorschlag für Verantwortlichen und Frist
   - Themen, die keinem TOP zuzuordnen sind („Verschiedenes“)
4. Ergebnis landet als **Entwurf** im Protokoll-Editor. Beschlüsse und Aufgaben werden als Vorschläge angezeigt und erst nach Bestätigung angelegt.
5. **Löschung:** Audio wird nach erfolgreicher Transkription gelöscht. Transkripttext wird gelöscht, sobald das Protokoll *genehmigt* ist (spätestens nach X Tagen, konfigurierbar).

Der Prompt für die Protokollerstellung liegt als bearbeitbare Vorlage in den Einstellungen (Admin); Ausgangsfassung: `templates/prompt-protokollentwurf.md`. Er bildet den Stil des bisherigen Protokolls nach (Ergebnisprotokoll, Funktionen statt nur Namen, Meinungen als „Darstellung von …“ kennzeichnen) und verlangt eine Liste von Unsicherheiten, die im Editor als Prüfhinweise angezeigt werden.

### 3.5 Aufgaben

- Felder: Titel, Beschreibung, verantwortlich (**ein oder mehrere Nutzer** oder Gruppe „Vorstand“ / „alle“), Frist (Datum **oder** Freitext wie „laufend“, „nach Bekanntgabe der Antragsfrist“; Erinnerungen nur bei Datum), Status (`OFFEN`, `IN_ARBEIT`, `ERLEDIGT`), Priorität (optional)
- **Herkunft** wird verknüpft und angezeigt: Sitzung/TOP, Beschluss, Aktion oder Thema
- Ansichten: „Meine Aufgaben“, alle Aufgaben (filterbar nach Person, Status, Herkunft), überfällig
- Kommentare an Aufgaben
- Erinnerungen per E-Mail: 3 Tage vor Frist und bei Überfälligkeit (konfigurierbar)

### 3.6 Vorlagen (vom Tool selbst gepflegt und angewandt)

Vorlagen werden in den Einstellungen verwaltet (Admin) und **automatisch** angewendet. Engine: **Handlebars** mit deutschen Datums-Helfern. Alle Ausgangsvorlagen, die Platzhalter-Referenz und das Layout liegen fertig in `templates/` (siehe `templates/README.md`) und werden per Seed übernommen.

Tonalität laut bisherigen Dokumenten: förmlich, Sie-Form, „Sehr geehrte Damen und Herren“, Anschrift „An die Vorstandsmitglieder und Gäste“; automatische Systemmails (Aufgaben-Erinnerungen) kurz und neutral.

Mitgelieferte Standardvorlagen:

| Vorlage | Wird automatisch genutzt bei |
|---|---|
| Einladung Vorstandssitzung (E-Mail + PDF-Brief) | Sitzung angelegt |
| Einleitung Umlaufverfahren (E-Mail) | Umlaufbeschluss gestartet (auch für Protokollgenehmigung) |
| Ergebnis Umlaufverfahren (E-Mail) | Ergebnis festgestellt |
| Einladung nach Beschlussunfähigkeit (E-Mail + PDF) | Sitzung wegen Beschlussunfähigkeit aufgehoben |
| Standard-Tagesordnung | Sitzung angelegt |
| Protokollvorlage | Sitzung durchgeführt / Protokoll gestartet |
| Protokollversand (E-Mail) | Protokoll versendet |
| Erinnerung Zu-/Absage | X Tage vor Sitzung, an alle ohne Rückmeldung |
| Aufgaben-Erinnerung | Frist naht / überschritten |
| Einladung Aktion / Helferaufruf | Aktion veröffentlicht |
| Absage einer Sitzung | Sitzung abgesagt |

Standard-TOPs (aus der bisherigen Praxis, anpassbar, `templates/standard-tagesordnung.json`): Begrüßung durch den Vorsitzenden (mit 1.1 Bericht aus dem CDU Kreisverband Mannheim) · Genehmigung des Protokolls *(nur wenn eines offen ist)* · Bericht aus dem BBR Seckenheim · Bericht aus dem BBR Friedrichsfeld · Bericht aus dem Gemeinderat · Stand offener Aufgaben *(nur bei überfälligen Aufgaben)* · *[sitzungsspezifische TOPs]* · Termine · Sonstiges.

Vorlagen sind versioniert; ein versendetes Dokument speichert, mit welcher Vorlagenversion es erzeugt wurde.

**Layout:** Der bestehende **Briefbogen** (Kopf mit „Kreisverband Mannheim / Ortsverband Seckenheim-Friedrichsfeld“ und CDU-Logo, Fußzeile mit Anschrift, Kontakt, Spendenkonto und QR-Code) wird als ganzseitiges Hintergrundbild (A4) auf jede PDF-Seite gelegt; Ausgangsdatei `templates/assets/briefbogen.png`, in den Einstellungen austauschbar. Schrift **Inter**, Akzentfarbe **#52B7C1**, Tabellenkopf **#E6F4F5** (`templates/briefbogen.css`). Die Oberfläche der App nutzt dieselben Farben.

**Unterschriften:** Jeder Unterzeichner kann ein Unterschriftsbild hochladen (nur für sich selbst); es wird in Einladungen eingesetzt. Protokolle erhalten Unterschriftslinien zur händischen Unterzeichnung.

### 3.7 Aktionen und Termine

- Arten: Infostand, Plakataktion, Veranstaltung, Bürgergespräch, Sonstiges
- Felder: Titel, Art, Beginn/Ende, Ort, Beschreibung, Partner (Freitext, z. B. andere Parteien/Vereine), Status (`GEPLANT`, `BESTÄTIGT`, `DURCHGEFÜHRT`, `ABGESAGT`)
- **Helferschichten:** Zeitfenster mit benötigter Anzahl; Vorstandsmitglieder tragen sich selbst ein
- Aufgaben an der Aktion (Material, Genehmigung, Presse …)
- Nachbereitung: Notiz, Fotos/Dokumente als Anhang
- **Kalender-Abo (ICS):** persönlicher Feed-Link je Nutzer mit Sitzungen, Aktionen und eigenen Schichten

### 3.8 Stadtteil-Themen

- Felder: Titel, Beschreibung, Kategorie (Verkehr, Schule, Bauen, Sicherheit, Vereine, Sonstiges – anpassbar), Ortsteil (Seckenheim / Friedrichsfeld / beide), Status, Verantwortlicher
- Status: `NEU`, `IN_BEARBEITUNG`, `BEI_STADTRÄTEN`, `IM_BEZIRKSBEIRAT`, `PRESSE`, `ERLEDIGT`, `ZURÜCKGESTELLT`
- **Verlauf (Timeline):** jede Statusänderung, Notiz, Anfrage, Antwort der Verwaltung, Presseartikel als Eintrag mit Datum
- Markierung „für nächste Sitzung“ → erscheint automatisch in der TO
- Anhänge (Fotos, Schreiben, Presseartikel)
- **Bürgeranliegen:** Kontaktdaten der Bürger nur optional und nur mit Einwilligung; automatische Löschung der Kontaktdaten X Monate nach Erledigung

### 3.9 Link-Hub

- Kategorien: Partei (CDUplus, Kreis-/Landesverband), OV-Webseite, Social Media (Instagram, Facebook …), Verwaltung (Stadt Mannheim, Bezirksbeirat), Presse, Sonstiges
- Felder: Titel, URL, Kategorie, Beschreibung, Hinweis „Zugang über …“ (**keine Passwörter speichern**)
- Sortierbar per Drag & Drop (Admin), Suche
- Optional: Redaktionsnotizen je Social-Media-Kanal (wer betreut, Posting-Rhythmus)

### 3.10 Einstellungen (Admin)

OV-Name, Absenderadresse, Logo, Farben, Fußzeile, Ladungsfrist, Erinnerungszeitpunkte, Löschfristen, Vorlagen, Prompt für Protokollerstellung, Nutzerverwaltung (einladen, Rolle ändern, deaktivieren).

---

## 4. Datenmodell (Überblick)

```
User           id, name, email, role (ADMIN|SCHRIFTFUEHRER|VORSTAND|LESEZUGRIFF|GAST),
               functionTitle, votingRight (STIMMBERECHTIGT|BERATEND|OHNE),
               sortOrder, active, loginEnabled, signatureImagePath?,
               icsToken, createdAt
Meeting        id, type, format (PRAESENZ|DIGITAL|HYBRID), title, startsAt, endsAt,
               location, onlineUrl, status (GEPLANT|EINGELADEN|DURCHGEFUEHRT|
               AUFGEHOBEN|ABGESAGT), responseDeadline, invitationSentAt,
               invitationTemplateVersion, urgent, urgencyReason?,
               isRepeatAfterNoQuorum, previousMeetingId?, openedAt?, closedAt?,
               interruptionNote?, chairNote?, quorumPresent?, quorumEligible?,
               quorumReached?, cancelReason?
AgendaItem     id, meetingId, parentId?, position, title, description, status
               (OFFEN|BEHANDELT|ABGESETZT|VERTAGT), topicId?, proposedById?, accepted,
               carriedOverFromId?
Attendance     id, meetingId, userId, response (OFFEN|ZUGESAGT|ABGESAGT), responseToken,
               present (ANWESEND|ANWESEND_DIGITAL|ENTSCHULDIGT|NICHT_ANWESEND)?,
               arrivedAt?, leftAt?, extraGuests (Text)
Minutes        id, meetingId, status, version, changeNote?, recorderName,
               formalities (JSON: eroeffnung, wiedereroeffnung, tagesordnung, letztesProtokoll),
               signers (JSON: [{name, funktion}]), approvalMode (SITZUNG|UMLAUF),
               circulationId?, approvedAtMeetingId?, sentAt, approvedAt,
               sentToOfficeAt?, aiUncertainties (JSON)?
MinutesSection id, minutesId, agendaItemId?, points (JSON: [{text, unterpunkte[]}]),
               outcomeType (BESCHLUSS|ERGEBNIS)?, outcomeText?
Circulation    id, number, subject, text, reason?, minutesId? (bei Protokollgenehmigung),
               initiatedById, initiatedAt, deadline, decidedInMeetingId?,
               status (LAUFEND|ANGENOMMEN|ABGELEHNT|UNZULAESSIG|ABGEBROCHEN),
               eligibleCount, determinedById?, determinedAt?, announcedAt?
CirculationVote id, circulationId, userId, token,
               vote (JA|NEIN|ENTHALTUNG|WIDERSPRUCH)?, comment?, votedAt?
Resolution     id, meetingId, agendaItemId?, number, subject, kind (BESCHLUSS|ERGEBNIS),
               resultType (ANGENOMMEN_EINSTIMMIG|ANGENOMMEN_MEHRHEITLICH|ABGELEHNT|
               FESTGESTELLT|ABGESETZT|VERTAGT|KENNTNISNAHME), votesYes?, votesNo?,
               votesAbstain?
Transcript     id, meetingId, source, filePath?, text?, status, consentConfirmedById,
               consentConfirmedAt, deleteAfter
Task           id, title, description, assigneeGroup (KEINE|VORSTAND|ALLE), dueDate?,
               dueText?, status, priority, meetingId?, agendaItemId?, resolutionId?,
               actionId?, topicId?, createdById
TaskAssignee   taskId, userId
TaskComment    id, taskId, authorId, text, createdAt
Action         id, type, title, startsAt, endsAt, location, description, partners, status
Shift          id, actionId, startsAt, endsAt, needed
ShiftSignup    id, shiftId, userId
Topic          id, title, description, category, district, status, responsibleId,
               forNextMeeting, citizenContact? (verschlüsselt), contactDeleteAfter?
TopicEvent     id, topicId, type, text, date, authorId
Attachment     id, ownerType, ownerId, filePath, mimeType, uploadedById
Link           id, title, url, category, description, accessNote, position
Template       id, key, name, subject, body, version, active
Setting        key, value
AuditLog       id, userId, action, entityType, entityId, diff, createdAt
```

---

## 5. Technik

| Bereich | Wahl |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| UI | Tailwind CSS, shadcn/ui, responsive, als PWA installierbar |
| Datenbank | PostgreSQL 16, Prisma ORM |
| Auth | Auth.js mit E-Mail-Magic-Link (SMTP) |
| Hintergrundjobs | pg-boss (Queue in Postgres): Transkription, KI-Entwurf, E-Mails, Erinnerungen, Löschfristen |
| Transkription | faster-whisper als eigener Docker-Container, Modell konfigurierbar (Deutsch) |
| KI | Anthropic Claude API, Modell per Umgebungsvariable, strukturierte JSON-Ausgabe |
| PDF | HTML-Vorlage → PDF (Playwright/Chromium im Container) |
| DOCX | `docx`-Bibliothek |
| E-Mail | SMTP über das Postfach des OV (manitu) |
| Kalender | ICS-Feed je Nutzer (Token in URL, widerrufbar) |
| Dateien | Lokales Volume auf dem Server |
| Optional | n8n-Webhooks für spätere Automatisierungen |

### Hosting und Betrieb

- Bestehender VPS (Ubuntu 24.04, Docker), **ohne Cloudflare**
- **DNS bei manitu:** A-Record (und ggf. AAAA) für `management.cdu-sf.de` auf die IP des VPS
- **Caddy** als Reverse Proxy mit automatischem HTTPS (Let's Encrypt)
- `docker compose` mit den Diensten: `app`, `db`, `whisper`, `caddy`
- **Backups:** nächtlicher `pg_dump` plus Datei-Volume, verschlüsselt, mit Kopie außerhalb des Servers; Wiederherstellung einmal testen
- Updates: Deployment per Git-Pull + `docker compose up -d --build`, DB-Migrationen über Prisma

---

## 6. Datenschutz und Sicherheit

- **Keine Mitgliederdaten** im Tool. Gespeichert werden nur Daten der Vorstandsmitglieder (Name, E-Mail, Rolle), mit deren Wissen.
- **Aufnahmen:** Upload nur mit bestätigter Zustimmung aller Anwesenden. Audio wird nach Transkription gelöscht, Transkript nach Genehmigung des Protokolls.
- **Audio bleibt auf dem eigenen Server** (lokale Transkription). Nur der Transkripttext wird zur Protokollerstellung an die Claude API übermittelt; das wird in der Oberfläche beim Upload transparent angezeigt.
- **Bürgeranliegen:** Kontaktdaten optional, verschlüsselt gespeichert, automatische Löschung.
- **Link-Hub:** keine Zugangsdaten speichern.
- Rechteprüfung serverseitig, Audit-Log für alle Änderungen, Sessions mit Ablauf, Rate-Limiting beim Login.
- Auftragsverarbeitung: AV-Vertrag mit dem VPS-Hoster und Prüfung der Bedingungen der Claude API klären (siehe offene Punkte).

---

## 7. Benachrichtigungen (E-Mail)

| Anlass | Empfänger |
|---|---|
| Einladung zur Sitzung | alle aktiven Nutzer |
| Erinnerung Zu-/Absage | Nutzer ohne Rückmeldung |
| Ladungsfrist naht, Einladung nicht versendet | Admin |
| Protokoll versendet | alle aktiven Nutzer |
| Neue Aufgabe zugewiesen | Verantwortlicher |
| Aufgabe fällig in 3 Tagen / überfällig | Verantwortlicher |
| Transkript verarbeitet, Entwurf bereit | Uploader |
| Neuer Helferaufruf | alle aktiven Nutzer |

Optional später: wöchentliche Zusammenfassung je Nutzer.

---

## 8. Oberfläche (Hauptnavigation)

`Übersicht` · `Sitzungen` · `Aufgaben` · `Aktionen` · `Themen` · `Links` · (Admin:) `Einstellungen`

Sprache der Oberfläche: Deutsch. Datumsformat `TT.MM.JJJJ`, Zeitzone Europe/Berlin.

---

## 9. Umsetzung in Arbeitspaketen (für Claude Code)

Jedes Paket ist einzeln umsetzbar und testbar. Nach jedem Paket: lokal testen, committen, dann das nächste.

### Phase 1 – Kern

| # | Paket | Ergebnis |
|---|---|---|
| 1.1 | Projekt-Setup | Next.js, Prisma, Docker Compose (app, db), Lint/Tests, Grundlayout mit Navigation |
| 1.2 | Auth und Rollen | Magic-Link-Login, Rollen, Nutzerverwaltung, Rechteprüfung, Audit-Log |
| 1.3 | Link-Hub | Links mit Kategorien, Sortierung, Suche |
| 1.4 | Aufgaben | CRUD, Ansichten, Kommentare, Verknüpfungsfelder |
| 1.5 | Sitzungen und Tagesordnung | Sitzungen, TO mit automatischer Vorbelegung, Zu-/Absagen |
| 1.6 | Vorlagen-Engine und Einladungsversand | Handlebars mit Helfern, Seed aus `templates/`, PDF auf Briefbogen, SMTP-Versand, Zu-/Absage-Links, Ladungsfrist-Erinnerung. Abnahme: Einladung vom 19.02.2026 lässt sich inhaltlich gleichwertig erzeugen |
| 1.7 | Protokolle | Editor (live und nachträglich), Formalia, Beschlussfähigkeit, Beschlüsse/Ergebnisse → Aufgaben, Workflow inkl. Umlaufverfahren, PDF/DOCX. Abnahme: Protokoll vom 26.02.2026 lässt sich strukturgleich erzeugen |
| 1.8 | Deployment | Caddy, Produktivbetrieb auf `management.cdu-sf.de`, Backups |

### Phase 2 – Automatisierung und Aktionen

| # | Paket | Ergebnis |
|---|---|---|
| 2.1 | Job-Queue und Erinnerungen | pg-boss, Aufgaben- und Zusage-Erinnerungen |
| 2.2 | Transkript-Pipeline | Upload (Audio/VTT/DOCX/TXT), whisper-Container, Claude-Entwurf, Vorschläge übernehmen, Löschfristen |
| 2.3 | Aktionen und Helferschichten | Aktionen, Schichten, Eintragen, Anhänge |
| 2.4 | Kalender-Abo | ICS-Feed je Nutzer |

### Phase 3 – Stadtteil

| # | Paket | Ergebnis |
|---|---|---|
| 3.1 | Stadtteil-Themen | Themen, Status, Timeline, Anhänge, „für nächste Sitzung“ → TO |
| 3.2 | Bürgeranliegen | optionale verschlüsselte Kontaktdaten, Löschfristen |
| 3.3 | Dashboard-Ausbau | vollständige Übersicht, ggf. Wochenzusammenfassung |

---

## 10. Offene Punkte

- [x] Ladungsfrist, Quorum, Umlaufverfahren, Niederschrift laut Bundesstatut und LV-Satzung BW (Abschnitt 2a)
- [ ] Gibt es eine Satzung/Geschäftsordnung des Kreisverbands Mannheim oder des OV mit abweichenden Regeln?
- [ ] Wer ist im Vorstand stimmberechtigt? (gewählte Mitglieder laut letzter Wahl, Ehrenvorsitz, Status der Stadträte, kooptierte Gäste ohne Stimmrecht)
- [ ] E-Mail-Adresse der Kreisgeschäftsstelle für die Übersendung der Niederschriften
- [ ] Absender-Postfach bei manitu (z. B. `vorstand@cdu-sf.de`) und SMTP-Zugangsdaten
- [x] Briefbogen, Schrift und Farben (aus der Einladung übernommen)
- [x] Einladungs- und Protokolltexte als Ausgangsbasis (in `templates/` umgesetzt)
- [ ] Unterschriftsbild in guter Auflösung (PNG mit transparentem Hintergrund)
- [ ] Liste der aktuell kooptierten Gäste mit E-Mail-Adressen
- [ ] Liste der Links für den Link-Hub (CDUplus, Webseite, Social-Media-Accounts)
- [ ] Ist der bestehende VPS für faster-whisper ausreichend (CPU/RAM)? Ggf. kleineres Modell oder längere Laufzeit akzeptieren
- [ ] AV-Vertrag Hoster, Bedingungen der Claude API für die Verarbeitung von Sitzungsinhalten
- [ ] Kurze Datenschutzinformation für den Vorstand (was gespeichert wird, Aufnahme-Zustimmung)
