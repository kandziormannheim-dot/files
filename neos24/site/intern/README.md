# NEOS intern — Dashboard mit Rollen und Rechtematrix

Internes Dashboard für das NEOS-Team unter `neos24.com/intern/`. PHP 8.x ohne Abhängigkeiten,
gleiche Konfiguration und gleiche SQLite-Datenbank wie der Revolut-Checkout
(`api/revolut/`). Startseite und Checkout lesen Preise und Carrier **live** aus dem, was hier
gepflegt wird.

## Module

| Modul | Inhalt |
|---|---|
| **Übersicht** | Bestellungen heute / 7 / 30 Tage, Umsatz brutto und netto, Marge (Verkauf netto − Einkauf), Statusanteile, Sendungen je Kalenderwoche, Top-Zielländer, Top-Carrier, neue Anfragen, letzte Bestellungen — alles aus der Tabelle `bestellungen`, nichts geschätzt |
| **Bestellungen & Sendungen** | Liste mit Statusfilter und Suche, Detail mit Adressen, Beträgen und Ereignisverlauf; Status bei Revolut abfragen, Status manuell setzen (bezahlt / storniert), Label-Auftrag vermerken, löschen (nur offen / fehlgeschlagen / storniert) |
| **Preise & Zielländer** | Zielländer (Code, Name DE/EN, aktiv, Sortierung), Gewichtsklassen (Kürzel, Name DE/EN, Maximalgewicht), Carrier — anlegen, ändern, deaktivieren, löschen (nur ohne Routing-Zeilen) |
| **Routingmatrix** | Zielland × Gewichtsklasse → bis zu drei Carrier mit Priorität 1/2/3, Laufzeit DE/EN, Einkaufs- und Verkaufspreis (netto). **Priorität 1 ist der Carrier, den die Startseite zeigt und der Checkout verkauft.** Fällt er aus (Carrier deaktiviert, Zeile inaktiv), rückt die nächste Priorität nach. Leere Zelle = für diese Gewichtsklasse nicht angeboten |
| **Kunden & Anfragen** | Anfragen des Kontaktformulars (Status, Notiz, Bearbeiter, „Firmenkonto anlegen“), Firmen (Daten, Benutzer einladen/deaktivieren, Sendungen, Rechnungen, Sammelrechnung erzeugen) und registrierte Privatkunden |
| **Rechnungen** | Alle Sammelrechnungen mit Status offen / bezahlt / storniert, PDF, Positionen; Stornieren gibt die Sendungen wieder zur Abrechnung frei |
| **Benutzer & Rollen** | Benutzer anlegen (Startpasswort wird einmal angezeigt), Rolle und Aktiv-Status ändern, Passwort zurücksetzen, löschen; Rollen mit Rechtematrix; Änderungsprotokoll |

Jeder Angemeldete kann unter „Mein Konto“ sein Passwort ändern und seine Rechte sehen.

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
`anfragen`, `benutzer`, `rollen`, `rechte`, `protokoll`; dazu die des Kundenportals `kunden`,
`firmen`, `anmeldelinks`, `rechnungen` (siehe `konto/README.md`); das Schema legt `datenbank()` in
`api/revolut/_bootstrap.php` an. Beim ersten Start ohne Länder wird `api/revolut/preise.php`
einmalig als Saatgut übernommen (Länder, Gewichtsklasse 2 kg, Carrier, Routing-Zeilen mit
Einkauf 0). Danach ist die Datenbank die einzige Preisquelle.

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
