# NEOS intern — Dashboard mit Rollen und Rechtematrix

Internes Dashboard für das NEOS-Team unter `neos24.com/intern/`. PHP 8.x ohne Abhängigkeiten,
gleiche Konfiguration und gleiche SQLite-Datenbank wie der Revolut-Checkout
(`api/revolut/`). Startseite und Checkout lesen Preise und Carrier **live** aus dem, was hier
gepflegt wird.

## Module

| Modul | Inhalt |
|---|---|
| **Übersicht** | Bestellungen heute / 7 / 30 Tage, Umsatz brutto und netto, Marge (Verkauf netto − Einkauf), Statusanteile, Sendungen je Kalenderwoche, Top-Zielländer, Top-Carrier, neue Anfragen, letzte Bestellungen — alles aus der Tabelle `bestellungen`, nichts geschätzt |
| **Bestellungen & Sendungen** | Liste mit Status-, Versandstatus- und Abholungsfilter und Suche (Nummer, E-Mail, Referenz, Firma); Detail mit Adressen, Gewicht/Maßen, Zusatzleistungen, Abholtermin, Beträgen, Sendungsverlauf (sieht der Kunde) und internem Verlauf; Versandstatus mit Ort und Text eintragen, Label (PDF) ansehen oder neu erzeugen, Status bei Revolut abfragen, Bestellstatus manuell setzen, löschen (nur offen / fehlgeschlagen / storniert) |
| **Preise & Zielländer** | Zielländer (Code, Name DE/EN, aktiv, Sortierung), Gewichtsklassen (Kürzel, **Kategorie** Brief / Dokumente oder Paket, Name DE/EN, Maximalgewicht), Carrier, Zusatzleistungen (Kürzel, Name und Beschreibung DE/EN, Nettopreis, aktiv) — anlegen, ändern, deaktivieren, löschen (nur ohne Routing-Zeilen) |
| **Routingmatrix** | Zielland × Gewichtsklasse → bis zu drei Carrier mit Priorität 1/2/3, Laufzeit DE/EN, Einkaufs- und Verkaufspreis (netto). **Priorität 1 ist der Carrier, den die Startseite zeigt und der Checkout verkauft.** Fällt er aus (Carrier deaktiviert, Zeile inaktiv), rückt die nächste Priorität nach. Leere Zelle = für diese Gewichtsklasse nicht angeboten. Spalten nach Kategorie gruppiert (Brief / Dokumente, Paket); Ziele außerhalb der EU tragen die Pille „Zoll“. Paletten haben keine Gewichtsklassen — sie laufen nur über Anfragen |
| **Kunden & Anfragen** | Anfragen des Kontaktformulars und **Palettenanfragen** (Pille „Palette“, Eckdaten Anzahl/Art/Gewicht/Abholung/Ziel/Kundennummer in der Nachricht; Status, Notiz, Bearbeiter, „Firmenkonto anlegen“), Firmen (Daten, Benutzer einladen/deaktivieren, Sendungen, Rechnungen, Sammelrechnung erzeugen, Guthaben mit Buchungen) und registrierte Privatkunden (Detail mit Bestellungen, Guthaben, Reklamationen) |
| **Rechnungen** | Alle Sammelrechnungen mit Status offen / bezahlt / storniert, PDF, Positionen; Stornieren gibt die Sendungen wieder zur Abrechnung frei |
| **Reklamationen** | Reklamationen aus dem Kundenportal: Status neu / in Prüfung / anerkannt / erstattet / abgelehnt, Antwort an den Kunden (optional per Mail), Erstattung — wird bei „Erstattet“ einmalig als Guthaben gebucht |
| **Statistiken & Berichte** | Kennzahlen mit Vorperiodenvergleich (Sendungen, Umsatz, Einkauf, Marge, Ø Netto, Zustellquote, Laufzeit, Nachberechnungen, Reklamationen, aktive Kunden, offene Posten), Berichte Zeitverlauf, Carrier, Zielländer, Kunden, Finanzen, Reklamationen, Guthaben mit Diagrammen (Inline-SVG, ohne Abhängigkeiten) und Tabellen, freier **Pivot-Bericht** (Zeilen × Spalten × Kennzahl, Top N, Diagrammart) mit gespeicherten Berichten, Filter Zeitraum/Kunde/Unterkunde/Carrier/Land/Zahlungsart, Export CSV/XLSX — siehe unten |
| **Rechnungsprüfung** | Lieferantenrechnungen der Carrier (PDF + CSV) hochladen, CSV-Spalten zuordnen (Vorschlag, Profil je Carrier), jede Position der eigenen Bestellung zuordnen und prüfen: gewogenes Gewicht gegen gebuchte Gewichtsklasse, Einkaufspreis gegen Routingmatrix, doppelt, storniert, nicht zuzuordnen. Nachberechnung an den Kunden (Firma: nächste Sammelrechnung; Privatkunde: Guthaben, sonst offene Revolut-Zahlung), Gutschrift bei niedrigerem Gewicht, Beanstandung an den Lieferanten als CSV — siehe unten |
| **Benutzer & Rollen** | Benutzer anlegen (Startpasswort wird einmal angezeigt), Rolle und Aktiv-Status ändern, Passwort zurücksetzen, löschen; Rollen mit Rechtematrix; Änderungsprotokoll |

Jeder Angemeldete kann unter „Mein Konto“ sein Passwort ändern und seine Rechte sehen.

## Rechnungsprüfung

Ablauf: **Hochladen** (Carrier wählen, Tabelle als CSV oder XLSX Pflicht, PDF als Beleg —
Rechnungsnummer, Datum und Nettosumme werden aus dem PDF gelesen: `pdftotext`, wenn installiert,
sonst der eigene Leser `lib/pdf_text.php`, der auch eingebettete Schriften mit ToUnicode-Tabellen
auflöst; fehlt die Summe im PDF, kommt sie aus einem „Total“-Blatt der Tabelle; alles von Hand
korrigierbar) → **Spalten zuordnen** (bei XLSX wird das Blatt mit den Sendungen erkannt, weitere
Blätter sind als Reiter wählbar; Zuschläge auf einem zweiten Blatt — etwa der Energiezuschlag je
Paket — werden über die Sendungsnummer je Position dazugerechnet; Trennzeichen und Spalten werden
erkannt, unsere Nummer `NE-…` auch mitten in einer Referenzspalte; die Zuordnung wird je Carrier
als Profil gemerkt) → **Zuordnung zur Bestellung** über unsere Nummer, die Carrier-Sendungsnummer
(`carrier_sendungsnummer`, kommt mit der Carrier-Anbindung) oder die Kundenreferenz → **Prüfung**
je Zeile:

| Befund | Bedeutung | Folge |
|---|---|---|
| In Ordnung | Klasse stimmt, Betrag = Einkauf laut Routingmatrix (± Toleranz `rechnungspruefung.toleranzCent`) | — |
| Gewicht höher | gewogene Klasse über der gebuchten | **Nachberechnung** = Verkauf(tatsächliche Klasse) − Verkauf(gebucht), netto; Betrag vor dem Buchen änderbar |
| Gewicht niedriger | gewogene Klasse unter der gebuchten | optional **Gutschrift** der Differenz als Guthaben |
| Preis weicht ab | Betrag ≠ Einkauf der Routingmatrix | Beanstandung |
| Doppelt | Sendung schon auf dieser oder einer früheren Rechnung | Beanstandung |
| Storniert / unbezahlt | Bestellung nicht bezahlt oder beauftragt | Beanstandung |
| Nicht zugeordnet | keine Bestellung zur Nummer | von Hand zuordnen (Bestellnummer eintragen) oder Beanstandung |
| Gewicht über der höchsten Klasse | keine Klasse passt | Nachberechnung mit Betrag von Hand |

Eine gebuchte Nachberechnung ist eine eigene Bestellung (`art = nachberechnung`, verweist auf
das Original) ohne Label: bei Firmen `zahlungsart rechnung`, Status `beauftragt` → sie erscheint
als Position „Gewichtsnachberechnung zu NE-…“ auf der nächsten Sammelrechnung; bei Privatkunden
vom Guthaben, wenn es reicht (Rechnung sofort über Lexware), sonst als offene Revolut-Zahlung
mit Link im Portal (Rechnung nach der Zahlung). Die Differenz wird **mit der Preisliste des
Kunden** gerechnet (Liste der Bestellung, sonst aktuelle Liste des Kontos, sonst Routingmatrix);
hat der Carrier für die Abweichung einen Zuschlag berechnet, kommt die in „Preise & Zielländer“
je Carrier hinterlegte **Gewichtsgebühr** dazu (höchstens der berechnete Zuschlag). Der Kunde
bekommt eine Mail mit dem **Nachweis Gewichtsabweichung** (PDF, `lib/nachberechnung_pdf.php`,
abgelegt unter `daten/nachberechnungen/`): Sendung, gebuchte und gewogene Klasse, Preise laut
seiner Liste, Differenz, Widerspruchshinweis. **Kundendokumente und Mails nennen weder den
Lieferanten noch dessen Rechnungsnummer** — nur den Carrier, weil er gewogen hat; die
Lieferantenrechnung steht ausschließlich im internen Bestell-Detail. Die Originalbestellung
speichert das Carrier-Gewicht, den tatsächlichen Einkauf und die Carrier-Sendungsnummer (Marge).
Zu jeder Sendung gibt es höchstens eine aktive Nachberechnung (Sicherheitsnetz gegen doppelte
Buchung, auch über gelöschte Rechnungen hinweg). „Beanstandung CSV“ exportiert alle
beanstandeten Zeilen für den Lieferanten; eine erhaltene **Gutschrift des Lieferanten** wird an
der Rechnung vermerkt (Betrag, Nummer, Datum). Dateien liegen im Datenverzeichnis unter
`lieferantenrechnungen/`.

### Automatische Nachberechnung

Nach jeder Prüfung (Upload, „Neu prüfen“, Postfach) bucht `rpAutomatischBuchen()` Positionen mit
Befund „Gewicht höher“ ohne Freigabe, wenn alle Regeln aus `rechnungspruefung.auto` erfüllt sind:
Differenz mindestens `mindestGramm` **und** `mindestProzent` des gebuchten Gewichts, Betrag über
`bagatelleCent` und höchstens `maxPositionCent`, Summe je Kunde auf der Rechnung höchstens
`maxKundeCent`, kein Carrier-Wechsel, keine Handzuordnung. Alles andere bleibt „offen“ mit dem
Grund im Hinweis („Freigabe nötig: …“) und wird wie bisher einzeln oder mit „Alle offenen
Nachberechnungen buchen“ freigegeben. `aktiv => false` schaltet die Automatik ab.

### Widerspruch, Storno, Erinnerung

Der Kunde kann im Portal innerhalb von `rechnungspruefung.widerspruchTage` widersprechen; das
erzeugt eine Reklamation der Art „Widerspruch Nachberechnung“. Im Reklamations-Detail nimmt
„Nachberechnung zurücknehmen“ die Nachberechnung zurück: Status `storniert`, bezahlte Beträge
zurück aufs Guthaben, Gutschrift an Lexware, Position wieder „verzichtet“, Antwort per Mail.
`php intern/aufgaben.php erinnern` (Cron) erinnert Privatkunden an offene Revolut-Nachberechnungen
nach `erinnerungTage` — genau einmal (`bestellungen.erinnert`).

### Carrier-Rechnungen aus dem Postfach

`php intern/aufgaben.php postfach` holt ungelesene Mails per IMAP (TLS, LOGIN; eigener Client in
`lib/postfach.php`, PHP braucht keine imap-Erweiterung), ordnet den Absender über
`postfach.absender` (Adresse oder Domain → Carrier-Name) zu, legt aus PDF + CSV/XLSX die
Lieferantenrechnung an, prüft sie mit dem gespeicherten Spaltenprofil des Carriers und lässt die
Automatik laufen. Doppelte Rechnungsnummern werden übersprungen, Mails ohne Tabelle oder von
unbekannten Absendern bleiben (ungelesen) liegen; ohne Profil wartet die Rechnung unter „Spalten
zuordnen“. Verarbeitete Mails werden als gelesen markiert und nach `erledigtOrdner` kopiert; eine
Zusammenfassung geht an `kopie`.

### Kundenpreislisten

Jede Firma und jeder Privatkunde kann eine eigene Verkaufsmatrix haben (Kunden & Anfragen → Firma
bzw. Privatkunde → „Preisliste anlegen“): sie startet als Kopie der Routingmatrix mit
Auf-/Abschlag in Prozent, danach lassen sich einzelne Zellen (Land × Klasse × Carrier, netto)
und Zusatzleistungspreise ändern oder aus XLSX/CSV importieren (gleiche Form wie die
Einkaufspreisliste; Preis gilt für Priorität 1 der Zelle oder alle Carrier). Zellen ohne eigenen
Preis zeigen je Liste den Standardpreis oder werden nicht angeboten. Das Portal rechnet mit der
Liste (Angebote, Preise-Seite, CSV-Import), jede Bestellung merkt sich `preisliste_id`, und die
Rechnungsprüfung rechnet Nachberechnungen mit denselben Konditionen. Tabellen `preislisten`,
`preislisten_preise`, `preislisten_zusatz`; `lib/preislisten.php`.

### Kundennummern und Unterkunden

Jede Firma und jeder registrierte Privatkunde bekommt beim Anlegen eine Kundennummer aus dem
Zähler der Plattform (`kundennummer.praefix` + fortlaufende Zahl ab `kundennummer.start`, z. B.
`K-100001`; `lib/kundennummern.php`, Tabelle `zaehler`). Bestehende Konten bekommen sie beim ersten
Start nachträglich in Reihenfolge ihrer Anlage. Firmenbenutzer haben keine eigene Nummer — sie
gehören zur Firma. Die Nummer steht in allen Listen, auf Rechnung, Nachweis und Mails und ist im
Dashboard suchbar (Kunden, Bestellungen).

Unter einer Firma legt das Team **Unterkunden** an (Firma → „Unterkunden“ → „Unterkunde anlegen“):
weitere Unternehmen der Gruppe oder Standorte mit Nummer `K-100001-01`, `-02` … Jeder Unterkunde
ist eigener Rechnungsempfänger — eigene Anschrift, USt-ID, Rechnungs-E-Mail, optional eigenes
Zahlungsziel und eigene Preisliste (sonst gilt die Firma) — mit eigenem Kontakt in Lexware und
Odoo. Sendungen tragen `bestellungen.unterkunde_id`: Inhaber wählen im Portal je Sendung
„Abrechnen für“, Mitarbeiter mit fester Zuordnung (Firma → Benutzer → Auswahl) buchen nur für
ihren Unterkunden und sehen nur dessen Sendungen und Rechnungen. Die Sammelrechnung wird je
Empfänger erzeugt (Firma → „Abrechnen für“ bzw. Seite des Unterkunden) und enthält nur dessen
Sendungen; Retouren und Nachberechnungen übernehmen den Unterkunden der Originalsendung.
Guthaben und Paketvorlagen bleiben je Firma; das Adressbuch ist je Benutzer, freigegebene Adressen gelten firmenweit. Tabelle `unterkunden`, Funktionen in `lib/kunden.php`
(`unterkundeAnlegen`, `rechnungsempfaenger`).

**Benutzergruppen:** Firmen legen im Portal Gruppen mit Rechten je Bereich an (Versand, Lager,
Retouren, Buchhaltung, Verwaltung — sehen/bearbeiten; Tabelle `benutzergruppen`, Spalte
`kunden.gruppe_id`, Vorlagen je Firma). Benutzer ohne Gruppe und Inhaber haben alle Rechte. Die
Firmenseite zeigt die Gruppen mit Rechten (Karte „Benutzergruppen“, nur lesend) und je Benutzer
eine Gruppen-Pille plus Auswahl (`was=gruppe`); die Einladung kann eine Gruppe vorgeben.

## Statistiken und Berichte

Modul „Statistiken & Berichte“ (`/statistik`, eigenes Recht `statistik`; Berichte speichern und
löschen braucht „bearbeiten“). Kern in `lib/statistik.php`, Diagramme in `intern/src/diagramme.php`
(Balken, Linien, Ringe, Ranglisten als Inline-SVG mit Werten als Tooltip), Routen in
`intern/src/routen_statistik.php`.

- **Datenbasis:** bezahlte und beauftragte Bestellungen nach Bestelldatum. Sendungen = Sendungen und
  Retouren; Nachberechnungen zählen zum Umsatz, nicht zu den Sendungen. Umsatz = netto, Einkauf =
  Ist-Einkauf aus der Rechnungsprüfung (sonst Routingmatrix), Marge = Umsatz − Einkauf. Zustellquote
  bezogen auf abgeschlossene Sendungen (zugestellt, Problem, Rücksendung), Laufzeit von der Übergabe
  (bzw. Label) bis zur Zustellung aus den Sendungsereignissen, Reklamationen nach Eingangsdatum.
- **Filter** gelten für alle Berichte: Zeitraum (30/90 Tage, Monat, Vormonat, Quartal, Jahr,
  12 Monate, von–bis), Kunde, Unterkunde, Carrier, Zielland, Zahlungsart, Auftragsart, „Vorperiode
  vergleichen“ (gleich langer Zeitraum davor, Veränderung in Prozent je Kennzahl, grün/rot je nach
  Richtung). Die Auflösung der Zeitreihe folgt dem Zeitraum (Tag, Woche, Monat) und ist im Bericht
  „Zeitverlauf“ wählbar.
- **Berichte:** Übersicht (Kennzahlen, Zeitverlauf, Carrier, Länder, Top-Kunden, Zahlungsarten,
  Versandstatus), Zeitverlauf (Sendungen, Umsatz, Einkauf, Marge, Zustellquote, Laufzeit, Retouren,
  Nachberechnungen, Reklamationen je Periode), Carrier und Zielländer (Rangliste, Marge, Laufzeit,
  Vergleichstabelle), Kunden (Top 25, Geschäfts-/Privatkunden, Preislisten, Unterkunden), Finanzen
  (Umsatz/Einkauf/Marge, Zahlungs- und Auftragsarten, Sammelrechnungen je Monat, offene Posten je
  Kunde mit Überfälligkeit), Reklamationen (Art, Status, Quote je Carrier, Bearbeitungsdauer,
  Verlauf), Guthaben (Bestand, Aufladungen je Monat, Buchungen nach Art).
- **Pivot-Bericht:** Zeilen-Dimension × optionale Spalten-Dimension × Kennzahl — Dimensionen Kategorie, Monat,
  Kalenderwoche, Tag, Wochentag, Carrier, Zielland, Kunde, Unterkunde, Kundenart, Zahlungsart,
  Gewichtsklasse, Auftragsart, Status, Versandstatus, Preisliste; Kennzahlen Sendungen, Umsatz netto
  und brutto, Einkauf, Marge, Marge %, Ø Netto, Ø Gewicht, Retouren, Nachberechnungen (Anzahl und €),
  Storniert, Zustellquote, Ø Laufzeit, Reklamationen, Reklamationsquote; Top N mit Sammelzeile
  „Übrige“, Diagramm als Balken, Linie, Rangliste oder Ring, Heatmap in der Tabelle. Berichte lassen
  sich mit Filter und Konfiguration speichern (Tabelle `berichte`), laden (eigene Parameter in der
  URL überschreiben die gespeicherten) und aktualisieren.
- **Export:** jede Tabelle als CSV (Semikolon, UTF-8 mit BOM) oder Excel (`lib/tabelle_schreiben.php`),
  Beträge in Euro, Prozent und Tage als Zahlen.

## Lexware Office

Ist `lexware.aktiv` mit API-Key gesetzt, vergibt Lexware Office die Rechnungsnummern und erzeugt
die PDFs (`lib/lexware.php`): Sammelrechnungen der Firmen und Unterkunden (Kontakt des
Rechnungsempfängers in Lexware, netto, dessen Zahlungsziel, je Sendung eine Zeile, Kundennummer
in der Einleitung), bezahlte Privatkunden-Bestellungen (registrierte Kunden mit eigenem Kontakt,
Gäste mit Adresse; brutto, Vermerk „bezahlt per Revolut/Guthaben“) und Nachberechnungen als
Rechnung, Stornos als Gutschrift. Kontakte legt die Synchronisation an (siehe unten); die von
Lexware vergebene Kundennummer (`roles.customer.number`, nur lesbar) wird als
`lexware_kundennummer` gespeichert und in der Karte „Systeme“ gezeigt. Jeder Vorgang landet in der Warteschlange `lexware_auftraege` und wird sofort (best
effort) sowie per Cron `php intern/aufgaben.php lexware` abgearbeitet — ein Ausfall der API
blockiert nichts, nichts wird doppelt angelegt. Rechnungen zeigen unter „Rechnungen“ Lexware-Nummer
und -Status; fehlgeschlagene Übergaben stehen in der Warteschlange (Übersicht-Kachel) und lassen
sich nachholen. Der Zahlungsstatus kommt per Cron (`/payments`) oder Webhook
(`api/lexware/webhook.php`, Abonnements anlegen mit `php intern/aufgaben.php lexware einrichten
<Basis-URL>`; die Nutzlast wird nie direkt verwendet, der Beleg wird nachgeladen). Ohne Lexware
bleibt es bei eigener Nummer `NR-…` und eigenem PDF. Kunden sehen alle Belege — Sammelrechnungen,
Einzelrechnungen, Gutschriften, Nachweise — im Portal unter „Rechnungen“ (`lib/belege.php`); die
Privatkunden-Akte zeigt dieselbe Liste in der Karte „Belege“. Belege und Mails an Kunden enthalten keine
Lieferantenangaben. Vor Go-live die Feldnamen gegen die aktuelle Lexware-Doku prüfen
(`developers.lexware.io`); Basis-URL `lexware.basisUrl`.

## Synchronisation mit Lexware Office und Odoo

Modul „Synchronisation“ (`/sync`, eigenes Recht). Kundenstammdaten laufen in beide Richtungen
(`lib/sync.php`, Warteschlange `sync_auftraege`, Konflikte `sync_konflikte`):

- **Hinrichtung:** Jede Änderung an Firma, Unterkunde, Privatkunde oder Firmenbenutzer
  (`syncMarkieren()` in `firmaAnlegen/Aktualisieren`, `kundeAnlegen/Aktualisieren`,
  `unterkundeAnlegen/Aktualisieren`) legt je aktivem System einen Auftrag an, der sofort (best
  effort) und per Cron `php intern/aufgaben.php sync` abgearbeitet wird. Lexware: Firmen und
  Unterkunden als Firmenkontakt mit den Benutzern als Ansprechpartnern, Privatkunden als
  Personenkontakt. Odoo (`lib/odoo.php`, JSON-RPC mit API-Key, Odoo 14 oder neuer, selbst gehostet
  oder Odoo.sh): Firma, Unterkunde (`parent_id` = Firma) und Privatkunde als `res.partner` mit
  `ref` = Kundennummer, Firmenbenutzer als Ansprechpartner; beauftragte oder bezahlte Sendungen
  als bestätigte Verkaufsaufträge (`sale.order`, Produkt `odoo.produktVersand`, Storno →
  storniert); Rechnungen als Notiz mit PDF am Partner — gebucht wird nur in Lexware, Odoo bekommt
  keine `account.move`.
- **Rückrichtung:** Der Cron holt geänderte Partner aus Odoo (`write_date`) und Kontakte aus
  Lexware (`version`/`updatedDate`) höchstens alle `sync.abholenMinuten` (Rückholung läuft vor der
  Warteschlange). Regel: **die jüngere Änderung gewinnt**. Änderten beide Seiten seit dem letzten
  Abgleich, gewinnt die jüngere, und das Feld landet als Konflikt im Modul (erledigen nach
  Prüfung). Übernommene Werte werden an das jeweils andere System weitergereicht. Webhooks
  beschleunigen das: `api/lexware/webhook.php` (Ereignis `contact.changed`, Abo per `aufgaben.php
  lexware einrichten`) und `api/odoo/webhook.php` (Odoo: Automatisierte Aktion → Webhook auf
  `res.partner`; Geheimnis `odoo.webhookGeheimnis` als Parameter `g`). Nutzlasten werden nie direkt
  übernommen, der Datensatz wird immer nachgeladen. Neue Partner, die nur in Odoo angelegt wurden,
  werden nicht importiert — Kunden entstehen in der Plattform, damit sie Nummer und Zugang haben.
  E-Mail-Änderungen an Privatkunden werden nur übernommen, wenn die Adresse gültig und frei ist
  (sie ist der Anmeldename).
- **Dashboard:** Karte „Systeme“ an Firma, Unterkunde und Privatkunde (Kundennummer,
  Lexware-Kundennummer, Odoo-Partner mit Link, „Jetzt abgleichen“), Modul `/sync` mit Warteschlange,
  Konflikten, „Alle Kunden neu übergeben“ (nach Einrichtung eines Systems) und „Jetzt aus den
  Systemen holen“, Kachel in der Übersicht; Bestellung und Rechnung zeigen Odoo-Auftrag bzw. Notiz.

### Einkaufspreise importieren

Unter Routingmatrix → „Einkaufspreise importieren“ lässt sich die Preisliste eines Carriers als
XLSX oder CSV einlesen (Zeilen = Länder in Deutsch, Englisch oder ISO-Code, Spalten =
Gewichtsgrenzen wie „<5kg“). Die Vorschau zeigt je Zelle den neuen Einkauf und den bisherigen
Wert; beim Übernehmen bekommen bestehende Routing-Zeilen des Carriers den neuen Einkauf (der
Verkauf bleibt), fehlende Zeilen werden mit Verkauf = Einkauf + Aufschlag angelegt, fehlende
Gewichtsklassen (z. B. 1, 3, 15, 25 kg) entstehen automatisch, 30 kg trifft die Klasse bis
31,5 kg, unbekannte Länder kommen inaktiv dazu. Zellen, deren Verkauf nicht über dem Einkauf
liegt, werden gemeldet.

## Rechte

Jeder Benutzer hat genau eine Rolle. Eine Rolle hat je Modul die Rechte **Sehen**, **Bearbeiten**
und **Löschen**; Bearbeiten und Löschen schließen Sehen ein. Die Navigation zeigt nur Module mit
Sehen; ein fehlendes Recht führt auf eine 403-Seite, auch bei direktem Aufruf einer Aktion.

- **Admin** ist eine Systemrolle mit allen Rechten. Sie ist nicht änderbar und nicht löschbar; der
  letzte aktive Admin kann weder deaktiviert noch gelöscht noch umgehängt werden.
- Rechte werden bei jeder Anfrage aus der Datenbank gelesen — eine Änderung gilt für den
  Betroffenen ab seiner nächsten Seite.
- Rollen mit zugeordneten Benutzern lassen sich nicht löschen; erst umhängen.
- Jede schreibende Aktion landet im Änderungsprotokoll (wer, wann, was), erreichbar über
  Benutzer & Rollen.

Beispielrollen: „Support“ (Übersicht sehen, Bestellungen sehen + bearbeiten, Kunden sehen),
„Pricing“ (Preise und Routing sehen + bearbeiten), „Buchhaltung“ (Übersicht, Bestellungen, Kunden
sehen; Rechnungen sehen + bearbeiten).

## Einrichtung

1. Konfiguration wie für den Checkout: `neos24-config.php` eine Ebene oberhalb des Webroots
   (Vorlage `api/revolut/neos24-config.beispiel.php`). Neu darin der Block `intern`
   (Sitzungsdauer, Anmeldebremse) und `mwstSatz`.
2. Ersten Admin auf dem Server anlegen:
   ```bash
   php intern/einrichten.php admin@neos24.com "Vorname Nachname"
   ```
   Das Skript gibt ein Startpasswort aus; beim ersten Anmelden wird ein eigenes verlangt.
3. `https://neos24.com/intern/login` öffnen. Apache braucht `mod_rewrite` (Plesk-Standard); die
   `.htaccess` leitet alles auf `index.php`. Ohne Rewrite funktioniert `intern/index.php?pfad=/…`.
4. Weitere Benutzer und Rollen im Dashboard anlegen — kein Serverzugriff mehr nötig.

Selbsttest ohne Anmeldung: `intern/status` liefert `{"ok":true,"dienst":"intern","konfiguriert":true}`.

## Sicherheit

- Passwörter mit `password_hash` (bcrypt), Mindestlänge 10; Startpasswörter erzwingen den Wechsel.
- Anmeldebremse zweistufig: je IP (Standard 30 Versuche pro Stunde, `intern.anmeldung.jeIp`) und
  je Konto (5 Fehlversuche → 15 Minuten Sperre, `intern.anmeldung.versuche` / `sperre`). Die
  Fehlermeldung verrät nicht, ob eine E-Mail existiert. „Passwort zurücksetzen“ hebt eine Sperre auf.
- Sitzung `neos_intern`: httponly, SameSite Lax, Secure bei HTTPS, Ablauf nach
  `intern.sitzungsdauer` Sekunden ohne Aktivität (Standard 8 h), neue Sitzungs-ID beim Login.
- CSRF-Token in jedem Formular; POST nur mit passender Herkunft (`Origin`).
- `X-Frame-Options: DENY`, `X-Robots-Tag: noindex`, kein Caching; `src/` und die Skripte
  `einrichten.php` / `dev-router.php` sind per `.htaccess` nicht abrufbar.
- Deaktivierte Benutzer werden mit der nächsten Anfrage abgemeldet.

## Daten

Alles liegt in `bestellungen.sqlite` im Datenverzeichnis (`daten` in der Konfiguration, außerhalb
des Webroots). Tabellen des Dashboards: `laender`, `gewichtsklassen`, `carrier`, `routing`,
`anfragen`, `benutzer`, `rollen`, `rechte`, `protokoll`, `zaehler`, `sync_auftraege`,
`sync_konflikte`; dazu die des Kundenportals `kunden`, `firmen`, `unterkunden`, `anmeldelinks`,
`rechnungen`, `zusatzleistungen`, `sendungsereignisse`, `adressen`, `paketvorlagen`,
`guthaben_buchungen`, `aufladungen`, `reklamationen` (siehe `konto/README.md`);
das Schema legt `datenbank()` in `api/revolut/_bootstrap.php` an. Beim ersten Start ohne Länder
wird `api/revolut/preise.php` einmalig als Saatgut übernommen (Länder weltweit — EU-Kernländer plus
Schweiz, Großbritannien, Türkei, USA, Kanada, VAE, China, Japan, Australien als Platzhalterpreise —,
Gewichtsklassen Brief 50 g / 500 g / 2 kg und Paket 2 bis 31,5 kg mit Aufschlag, Carrier,
Routing-Zeilen mit Einkauf 0, vier Zusatzleistungen). Danach ist die Datenbank die einzige
Preisquelle. Bestehende Datenbanken ergänzt `kategorienNachtragen()` einmalig um die Briefklassen
(Routing aus der kleinsten Paketklasse je Land mit Abschlag), die fehlenden weltweiten Ziele und
schaltet die Ziele der Saat frei, die schon inaktiv vorhanden waren (z. B. aus einem Einkaufsimport).

Die Startseite holt sich Preise über `api/revolut/angebot.php` (Cache 5 Minuten) und baut die
Preistabelle und die Checkout-Auswahl damit neu; ohne PHP bleiben die Werte im Markup als
Fallback. `api/revolut/bestellung.php` rechnet den Betrag ausschließlich aus der Datenbank und
speichert Carrier und Einkaufspreis zum Bestellzeitpunkt (Grundlage der Marge).

## Lokal ausprobieren

```bash
# Testkonfiguration mit eigenem Datenverzeichnis, ohne Mailversand
cat > /tmp/neos-test-config.php <<'PHP'
<?php return ['daten' => '/tmp/neos-daten', 'transport' => '', 'salz' => 'test'];
PHP
NEOS_KONFIG=/tmp/neos-test-config.php php neos24/site/intern/einrichten.php admin@example.com "Test Admin"
NEOS_KONFIG=/tmp/neos-test-config.php php -S 127.0.0.1:8901 -t neos24/site neos24/site/intern/dev-router.php
# http://127.0.0.1:8901/intern/  (Dashboard)   http://127.0.0.1:8901/  (Startseite mit Live-Preisen)
```

Screenshots zur Abnahme: `../screenshots/intern-*.png` (1280 und 375 px).

Gemeinsame Helfer (Maskierung, URLs, CSRF, Formate) liegen in `../lib/helfer.php` und werden auch vom Kundenportal genutzt.
