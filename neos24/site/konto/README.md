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
| Neue Sendung | über die Startseite (Checkout, Absender vorbelegt) | im Portal auf Rechnung, Nettopreis aus der Routingmatrix, Label folgt per Mail |
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

## Geschäftskunden: Ablauf

1. Anfrage über das Kontaktformular landet im Dashboard (Kunden & Anfragen).
2. Team klickt „Firmenkonto anlegen“ (Firma, Anschrift, Rechnungs-E-Mail, Inhaber) → Einladung
   per Mail, Anfrage → „Konto angelegt“.
3. Inhaber setzt Passwort, ergänzt unter „Firma“ die Anschrift (Absender), lädt Mitarbeiter ein.
4. Sendungen werden im Portal beauftragt: Status `beauftragt`, `zahlungsart rechnung`,
   Nettopreis, Carrier und Einkaufspreis aus der Routingmatrix zum Zeitpunkt der Buchung.
5. Zum Monatsende erzeugt das Team je Firma die Sammelrechnung (Dashboard → Firma → „Rechnung
   erzeugen“): Nummer `NR-<Jahr>-<lfd. Nummer>`, Sendungen bekommen `rechnung_id`, PDF nach
   `daten/rechnungen/`, Mail an die Rechnungs-E-Mail. Status bezahlt / storniert im Dashboard
   (Stornieren gibt die Sendungen wieder zur Abrechnung frei).

Absender, Bankverbindung und Pflichtangaben der Rechnung stehen in der Konfiguration unter
`firma`; `rechnung.zahlungszielTage` und das Zahlungsziel je Firma bestimmen die Fälligkeit.

## Dateien

```
konto/index.php        Front-Controller, alle Routen
konto/src/bootstrap.php  Sitzung, ansicht(), fehlerSeite(), Basis-URL
konto/src/auth.php     kundeAktuell(), kundeAnmelden(), Guards (business/privat/inhaber)
konto/src/sendungen.php  eigeneBestellungen(), eigeneBestellung(), sendungAnlegen(), kundenVerlauf()
konto/src/texte.php    t() — alle Texte DE/EN
konto/src/views/       Ansichten; assets/konto.css baut auf ../assets/neos.css auf
lib/kunden.php         Konten, Firmen, Anmeldelinks, Einladungs-/Link-Mails
lib/rechnungen.php     Sammelrechnung erzeugen, Nummernkreis, Status
lib/rechnung_pdf.php   PDF mit FPDF (lib/pdf/, vendored)
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
