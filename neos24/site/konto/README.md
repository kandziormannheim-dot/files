# NEOS Kundenportal — eigenes Konto, nur eigene Daten

Kundenportal unter `neos24.com/konto/` für Privat- und Geschäftskunden. PHP 8.x ohne
Abhängigkeiten, gleiche Konfiguration und Datenbank wie Checkout und internes Dashboard
(`api/revolut/`, `intern/`), gemeinsame Helfer in `lib/`. Deutsch und Englisch (`?sprache=en`,
gemerkt in Sitzung und Konto).

## Was Kunden sehen

| | Privatkunde | Geschäftskunde (Firmenkonto) |
|---|---|---|
| Konto entsteht | selbst über „Registrieren“ (E-Mail wird per Link bestätigt) | vom NEOS-Team im Dashboard freigeschaltet, Inhaber per Einladung |
| Bestellungen / Sendungen | alle Bestellungen, die mit der bestätigten E-Mail bezahlt wurden | alle Sendungen der Firma, von allen Firmenbenutzern |
| Neue Sendung | im Portal (oder über die Startseite): Carrier-Vergleich, Zusatzleistungen, Abholung; Zahlung per Revolut oder Guthaben | im Portal: Carrier-Vergleich, Zusatzleistungen, Abholung; auf Rechnung oder vom Guthaben |
| Labels | NEOS-Label (PDF A6) je Sendung, Sammeldruck A4 aus der Liste | wie links |
| Tracking | Verlauf in der Sendung; öffentlich unter `konto/tracking` (Nummer + PLZ des Empfängers) | wie links |
| Adressbuch, Paketvorlagen | Empfänger- und Absenderadressen, Vorlagen mit Gewicht, Maßen, Zusatzleistungen | wie links, firmenweit |
| CSV-Import | — | viele Sendungen auf einmal: Vorschau mit Preis je Zeile, dann beauftragen |
| Guthaben | Aufladen per Revolut, Sendungen davon bezahlen, Erstattungen landen hier | wie links, firmenweit |
| Retoure, Reklamation | Rücksendung mit einem Klick (Adressen getauscht); Reklamation mit Art, Beschreibung, Betrag | wie links |
| Preise | Startseite (brutto) | Netto-Preisliste im Portal |
| Rechnungen | — (Revolut-Beleg) | monatliche Sammelrechnung als PDF, Positionen im Detail |
| Benutzer | — | Inhaber lädt Mitarbeiter ein, deaktiviert sie; Mitarbeiter sehen Sendungen und Rechnungen, nicht Benutzer und Firmendaten |
| Einstellungen | Name, Sprache, Passwort, Absenderadresse, Konto schließen | Name, Sprache, Passwort, Konto schließen; Inhaber: Firmendaten |

## Anmeldung

- **Passwort** (optional): bcrypt, mindestens 10 Zeichen, Sperre nach 5 Fehlversuchen für
  15 Minuten, Bremse je IP (`konto.anmeldung`).
- **Anmeldelink** ohne Passwort: 32 Zufallsbytes, in der Datenbank nur als SHA-256, 15 Minuten
  gültig, einmalig (`konto.linkGueltigkeit`). Die Antwort auf „Link schicken“ ist immer gleich —
  ob es das Konto gibt oder nicht.
- **Registrierung** (nur Privatkunden): Name + E-Mail → Bestätigungslink → Konto aktiv, alle
  Bestellungen dieser E-Mail werden zugeordnet, danach optional Passwort setzen. Bei bereits
  vergebener E-Mail geht ein normaler Anmeldelink raus.
- **Einladung** (Geschäftskunden): 7 Tage gültig (`konto.einladungGueltigkeit`), Zweck
  Inhaber oder Mitarbeiter, führt zum Passwort-Setzen.
- **Passwort vergessen**: Link mit Zweck „Passwort“, dann neues Passwort ohne altes.
- Sitzung `neos_konto` mit Cookie-Pfad `/konto/`, httponly, SameSite Lax, Secure bei HTTPS,
  Ablauf nach 14 Tagen ohne Aktivität (`konto.sitzungsdauer`); CSRF in jedem Formular;
  Herkunftsprüfung bei POST.

## Datentrennung

Alles läuft über `src/sendungen.php`. Jede Abfrage bekommt den angemeldeten Kunden und filtert
**immer** — Privatkunde `kunde_id = ?`, Geschäftskunde `firma_id = ?`. Eine fremde Bestellnummer
ergibt 404, ein fremdes Rechnungs-PDF 404, eine Firmenfunktion für Privatkunden 403, die
Benutzerverwaltung für Mitarbeiter 403. Rechnungs-PDFs liegen außerhalb des Webroots
(`daten/rechnungen/`) und werden nur über `konto/rechnungen/{Nummer}.pdf` nach Firmenprüfung
ausgeliefert. Der Verlauf einer Sendung zeigt nur Statuswechsel und Label, keine internen Notizen
oder Revolut-Rohdaten.

`konto/ich` liefert dem Checkout der Startseite (`assets/checkout.js`) Name, E-Mail und
Absenderadresse eines angemeldeten Privatkunden zur Vorbelegung — nur mit gültiger Sitzung.

## Sendungen: Carrier-Vergleich, Zusatzleistungen, Zahlung

Das Formular „Neue Sendung“ (`konto/sendungen/neu`, beide Kundengruppen) zeigt zu Zielland und
Gewicht **alle aktiven Carrier** der Routingmatrix-Zelle mit Nettopreis, Bruttopreis und
Laufzeit; Priorität 1 ist als „Empfohlen“ vorausgewählt (`angeboteFuer()` in `lib/versand.php`).
Das Gewicht in kg wird der kleinsten passenden Gewichtsklasse zugeordnet
(`gewichtsklasseFuerGewicht()`, Maximalgewicht je Klasse aus dem Dashboard). Zusatzleistungen
(Versicherung mit Warenwert, Abholung mit Werktag ab morgen und Zeitfenster, Nachnahme mit
Betrag, SMS) kommen aus der Tabelle `zusatzleistungen`, die das Dashboard unter „Preise“ pflegt.
Die Summe (Porto + Zusatz = netto, MwSt., brutto) rechnet `konto.js` live und der Server beim
Anlegen verbindlich (`bestellungAnlegen()`).

Zahlungsarten: **Revolut** (Privatkunden; Popup auf `…/bezahlen`, Rücksprung nach 3-D-Secure
mit `?zurueck=1`, Statusabgleich über `…/status`), **Guthaben** (beide; Prepaid, Aufladung per
Revolut unter `konto/guthaben` als `NG-`-Order, Webhook und Statusabfrage buchen einmalig) und
**Rechnung** (Geschäftskunden; Sammelrechnung). Sendungen auf Rechnung oder vom Guthaben sind
sofort `beauftragt`, bekommen Label und Abholungs-Ereignis und eine Bestätigungsmail.

Der **Versandstatus** (`versandstatus`, Ereignisse in `sendungsereignisse`) läuft getrennt vom
Bestell-/Zahlungsstatus: angelegt → bezahlt → Label erstellt → Abholung beauftragt → an Carrier
übergeben → unterwegs → in Zustellung → zugestellt (oder Rücksendung, Zustellproblem,
storniert). Bis zur Carrier-Anbindung (`lib/carrier.php`, Stubs) pflegt das Team die Stufen im
Dashboard; das öffentliche Tracking zeigt denselben Verlauf.

**Reklamationen** (Art, Beschreibung, geforderter Betrag) bearbeitet das Team im Dashboard;
eine Erstattung wird dem Guthaben gutgeschrieben und der Kunde per Mail informiert.
**Nachberechnungen** aus der Rechnungsprüfung des Dashboards (Carrier hat schwerer gewogen als
gebucht) erscheinen als eigene Position „Nachberechnung“ mit Erklärung (gewogenes Gewicht,
gebuchte und tatsächliche Klasse), dem **Nachweis Gewichtsabweichung** als PDF
(`…/nachweis.pdf`) und der Rechnung aus Lexware (`…/rechnung.pdf`, sobald vorhanden). Die
Differenz folgt der Preisliste des Kunden. Innerhalb der Widerspruchsfrist
(`rechnungspruefung.widerspruchTage`) kann der Kunde direkt am Beleg **widersprechen**
(Reklamation „Widerspruch Nachberechnung“); nimmt das Team die Nachberechnung zurück, zeigt das
Portal das an und bezahlte Beträge kommen als Guthaben zurück. Firmen sehen Nachberechnungen auf
der nächsten Sammelrechnung, Privatkunden zahlen sie vom Guthaben oder per Revolut (Erinnerung
nach `erinnerungTage`). **Retouren** sind eigene Bestellungen (`art = retoure`, `retoure_zu`)
mit getauschten Adressen zum Preis der Routingmatrix.

**Kundenpreislisten:** hat das Team für die Firma oder den Privatkunden eine eigene Preisliste
angelegt, zeigen Formular, „Preise“ und CSV-Import diese Konditionen (Zusatzleistungen
eingeschlossen); die Bestellung merkt sich die Liste.

**Vorbeugung gegen Gewichtsnachberechnungen:** Aus den Maßen rechnet das Formular das
**Volumengewicht** (L × B × H ÷ Faktor des Carriers, Standard 5000) und hebt die Gewichtsklasse
an, wenn es das reale Gewicht übersteigt — live in `konto.js` und verbindlich in
`bestellungAnlegen()` (`volumen_gramm`). Lag das vom Carrier gemessene Gewicht bei den letzten
Sendungen im Schnitt deutlich über der Angabe (≥ 300 g oder ≥ 15 %), zeigt das Formular einen
Warnhinweis und verlangt die Bestätigung „Gewicht geprüft“. Labels für Klassen über 10 kg bzw.
20 kg tragen das Gewichtssymbol.

**Rechnungen:** Mit Lexware Office vergibt Lexware die Rechnungsnummer; das Portal zeigt die
Lexware-Nummer und liefert das Lexware-PDF (Sammelrechnungen unter „Rechnungen“, Privatkunden je
bezahlter Bestellung „Rechnung (PDF)“ im Bestell-Detail). Bis die Übergabe erfolgt ist, steht
„wird erstellt“.

## Geschäftskunden: Ablauf

1. Anfrage über das Kontaktformular landet im Dashboard (Kunden & Anfragen).
2. Team klickt „Firmenkonto anlegen“ (Firma, Anschrift, Rechnungs-E-Mail, Inhaber) → Einladung
   per Mail, Anfrage → „Konto angelegt“.
3. Inhaber setzt Passwort, ergänzt unter „Firma“ die Anschrift (Absender), lädt Mitarbeiter ein.
4. Sendungen werden im Portal beauftragt: Status `beauftragt`, `zahlungsart rechnung`,
   Nettopreis, Carrier und Einkaufspreis aus der Routingmatrix zum Zeitpunkt der Buchung.
5. Zum Monatsende erzeugt das Team je Firma die Sammelrechnung (Dashboard → Firma → „Rechnung
   erzeugen“): mit Lexware Office vergibt Lexware Nummer und PDF (Kontakt der Firma, netto,
   Zahlungsziel), sonst Nummer `NR-<Jahr>-<lfd. Nummer>` und PDF nach `daten/rechnungen/`;
   Sendungen bekommen `rechnung_id`, Mail mit PDF (und Nachweisen zu Nachberechnungen) an die
   Rechnungs-E-Mail. Status bezahlt kommt aus Lexware (Cron/Webhook) oder wird im Dashboard
   gesetzt; Stornieren gibt die Sendungen wieder zur Abrechnung frei.

Absender, Bankverbindung und Pflichtangaben der Rechnung stehen in der Konfiguration unter
`firma`; `rechnung.zahlungszielTage` und das Zahlungsziel je Firma bestimmen die Fälligkeit.

## Dateien

```
konto/index.php        Front-Controller, alle Routen
konto/src/bootstrap.php  Sitzung, ansicht(), fehlerSeite(), Basis-URL
konto/src/auth.php     kundeAktuell(), kundeAnmelden(), Guards (business/privat/inhaber)
konto/src/sendungen.php  eigeneBestellungen(), eigeneBestellung(), kundenVerlauf(), firmaKennzahlen()
konto/src/routen_versand.php  Neue Sendung, Bezahlen (Revolut/Guthaben), Labels, Tracking, Retoure, Reklamation,
                       Adressbuch, Paketvorlagen, CSV-Import, Guthaben
konto/src/texte.php    t() — alle Texte DE/EN (texte_versand.php: Versandfunktionen)
konto/src/views/       Ansichten; assets/konto.css baut auf ../assets/neos.css auf; assets/konto.js
                       (Angebote, Summen, Zusatzleistungen, Sammeldruck, Revolut-Popup, Aufladung)
lib/versand.php        Angebote je Zelle, Zusatzleistungen, bestellungAnlegen(), Guthaben und Aufladungen,
                       Versandstatus/Ereignisse, Tracking, Adressbuch, Vorlagen, Retouren, Reklamationen
lib/carrier.php        Carrier-Schnittstelle (Label, Abholung, Tracking) — noch Stubs
lib/label_pdf.php      NEOS-Label (Code 128) als PDF, A6 einzeln oder A4 vierfach
lib/kunden.php         Konten, Firmen, Anmeldelinks, Einladungs-/Link-Mails
lib/rechnungen.php     Sammelrechnung erzeugen, Nummernkreis, Status (mit Lexware: Übergabe statt eigener Nummer)
lib/rechnung_pdf.php   PDF mit FPDF (lib/pdf/, vendored) — Rückfallebene ohne Lexware
lib/preislisten.php    Kundenpreislisten (je Konto eine Matrix), Anzeige- und Angebotsfunktionen
lib/nachberechnung_pdf.php  Nachweis Gewichtsabweichung (PDF) zur Nachberechnung
lib/lexware.php        Lexware Office: Kontakte, Rechnungen, Gutschriften, PDFs, Zahlungsstatus, Warteschlange
```

## Lokal ausprobieren

```bash
# Testkonfiguration: Mails als Textdateien unter daten/mails/ (Transport 'datei')
cat > /tmp/neos-test-config.php <<'PHP'
<?php return ['daten' => '/tmp/neos-daten', 'transport' => 'datei', 'salz' => 'test', 'basisUrl' => 'http://127.0.0.1:8901'];
PHP
NEOS_KONFIG=/tmp/neos-test-config.php php neos24/site/intern/einrichten.php admin@example.com "Test Admin"
NEOS_KONFIG=/tmp/neos-test-config.php php -S 127.0.0.1:8901 -t neos24/site neos24/site/intern/dev-router.php
# http://127.0.0.1:8901/konto/registrieren → Link aus /tmp/neos-daten/mails/*.txt öffnen
```

Screenshots zur Abnahme: `../screenshots/konto-*.png` (1280 und 375 px, DE und EN).
