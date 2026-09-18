# SBF-Kurs — Online-Kurs für Funk- und Pyro-Zeugnisse

Die Anwendung unter [`sbfkurs/`](../../sbfkurs/) ist eine Lernplattform nach
dem Vorbild der bekannten Online-Kurse zum Sportbootführerschein: Lektionen in
Kapiteln, ein Lerntrainer über den Fragenkatalog, eine Prüfungssimulation mit
Zeitlimit und ein persönlicher Lernstand. Abgedeckt sind sechs Scheine und
Zeugnisse — **SBF See** und **SBF Binnen** (Sportbootführerscheine, mit
gemeinsamem Basisteil), **SRC** (Seefunk UKW), **UBI** (Binnenschifffahrtsfunk),
**FKN** (Pyroschein) und **LRC** (Grenz-/Kurzwelle, Satellit) — dazu die Praxismodule
Funkverkehr-Trainer (Lückentexte, Reihenfolgen), Buchstabiertafel,
Englisch-Übersetzung, Diktat (Meldung nach Sprachausgabe mitschreiben) und ein
nachgebautes UKW-Funkgerät mit DSC-Controller.

Technisch ist sie die Schwester der Womo-Schadensakte
([`docs/womo/`](../womo/README.md)): PHP ohne Framework, SQLite, Konfiguration
außerhalb des Webroots, dieselbe Missbrauchsbremse, kein Composer, keine
Laufzeit-Abhängigkeiten. Neu gegenüber Womo ist ein echtes Kontensystem
(Lernende und Admins, Registrierung mit Einladungscode).

Die Lerninhalte liegen als Markdown und JSON unter `sbfkurs/content/` — wie
sie gepflegt werden, steht im Autorenhandbuch [`INHALTE.md`](INHALTE.md).

## Was heute drin ist — und was noch fehlt

- **Lektionen:** eigene Texte, 8–10 je Zeugnis, fertig.
- **Fragen:** Für **SRC** (Gesamtfragenkatalog 10/2018 plus Anpassungsprüfung),
  **LRC** (Fragenkatalog II, 02/2024) und **SBF Binnen** (08/2023, 300 Fragen)
  sind die amtlichen Kataloge importiert; die Nutzung der SRC/LRC-Lesefassungen
  hat die Fachstelle FVT/ABVT Koblenz freigegeben (vermerkt in `quelle.freigabe`).
  Die 73 Bildfragen des Binnen-Katalogs
  zeigen **eigene, schematisch gezeichnete SVG-Grafiken** (Tafelzeichen,
  Lichter, Sichtzeichen, Schallsignale, Segelskizzen) — nichts ist aus den PDFs
  übernommen; Schallsignale lassen sich anhören. **SBF See, UBI und FKN** haben
  noch je 10–14 selbst formulierte Beispielfragen; ihre Kataloge werden mit
  `werkzeuge/katalog-import.php` aus den PDFs importiert (Anleitung in
  `INHALTE.md`). Solange zeigt die Anwendung dort das Band „Beispielfragen —
  noch nicht der amtliche Katalog“, Prüfungsbögen sind entsprechend verkürzt.
- **Tonspuren als Text:** Diktat-Übungen (SRC, LRC englisch; UBI deutsch) lesen
  eigene Not-, Dringlichkeits- und Sicherheitsmeldungen über die Sprachausgabe
  des Browsers vor; die Textfassung ist immer einblendbar. Das Funkgerät im
  DSC-Simulator hat Sprechtaste, Sendeleistung und antwortende Gegenstelle.
- **Prüfungsregeln** (Fragen je Bogen, Zeit, Bestehensgrenze) stehen je
  Zeugnis in `content/<zert>/zertifikat.json` — nach bestem Wissen, als
  „zu prüfen“ markiert. Vor dem Livegang gegen die aktuelle Prüfungsordnung
  abgleichen.

## Livegang auf dem Plesk-Server (der kurze Weg)

Wie bei Womo gibt es zwei Workflows unter Actions:

1. **„DNS-Eintrag setzen“** — Name `sbfkurs`. Legt A/AAAA für
   `sbfkurs.kandzior.de` an.
2. **„SBF-Kurs einrichten“**
   ([`sbfkurs-einrichten.yml`](../../.github/workflows/sbfkurs-einrichten.yml)) —
   Plesk-Admin-Passwort, Admin-E-Mail, Admin-Passwort der Kursanwendung und
   optional ein Einladungscode. Der Workflow führt zuerst die Tests und die
   Inhaltsprüfung aus (mit kaputten Inhalten wird nichts übertragen), legt die
   Subdomain physisch an (Webroot `sbfkurs-app/public`), überträgt `public/`,
   `src/` und `content/`, schreibt `sbfkurs-config.php` (nur der Passwort-Hash
   landet auf dem Server), holt das Let's-Encrypt-Zertifikat und prüft
   `/status`, Login-Umleitung und Assets. Läuft gefahrlos mehrfach;
   `sbfkurs-daten/` (Datenbank) bleibt unangetastet. Ein erneuter Lauf ist
   zugleich der Deploy-Weg für Updates und setzt bei Bedarf das Admin-Passwort
   neu.

Ohne Einladungscode-Eingabe erzeugt der Workflow einen und zeigt ihn in der
Zusammenfassung des Laufs. Wer keine Selbstregistrierung möchte, gibt `-`
ein: dann legt der Admin die Konten in der Anwendung an oder erzeugt dort
Einmalcodes.

Der Rest beschreibt die Einrichtung von Hand auf einem eigenen nginx-Server.

## Voraussetzungen

- PHP 8.2+ mit `pdo_sqlite` und `mbstring`
- Eine Subdomain mit TLS-Zertifikat
- Für den Katalog-Import auf dem Arbeitsrechner: `pdftotext` (poppler-utils)

## 1. Verzeichnisse und Konfiguration

```bash
/var/www/sbfkurs.kandzior.de/
├── html/               ← Webroot: Inhalt von sbfkurs/public/
├── src/                ← sbfkurs/src/
├── content/            ← sbfkurs/content/
├── sbfkurs-config.php  ← aus sbfkurs/sbfkurs-config.beispiel.php, NICHT im Webroot
└── daten/              ← SQLite, Spool
```

```bash
scp -r sbfkurs/public/* deploy@SERVER:/var/www/sbfkurs.kandzior.de/html/
scp -r sbfkurs/src sbfkurs/content deploy@SERVER:/var/www/sbfkurs.kandzior.de/
scp sbfkurs/sbfkurs-config.beispiel.php deploy@SERVER:/var/www/sbfkurs.kandzior.de/sbfkurs-config.php

# auf dem Server
sudo chown deploy:www-data   /var/www/sbfkurs.kandzior.de/sbfkurs-config.php
sudo chmod 640               /var/www/sbfkurs.kandzior.de/sbfkurs-config.php
sudo mkdir -p                /var/www/sbfkurs.kandzior.de/daten
sudo chown www-data:www-data /var/www/sbfkurs.kandzior.de/daten
sudo chmod 750               /var/www/sbfkurs.kandzior.de/daten
```

`index.php` sucht `src/` und `content/` relativ zu sich
(`dirname(__DIR__)`), also neben dem Webroot — genau so verlegt es das `scp`.

In `sbfkurs-config.php` ausfüllen:

- `adminEmail` und `adminPasswortHash` — Hash erzeugen mit
  `php -r "echo password_hash('DEIN_PASSWORT', PASSWORD_DEFAULT), PHP_EOL;"`.
  Das Konto wird beim ersten Aufruf angelegt; ein geänderter Hash setzt das
  Passwort neu.
- `einladungscode` — leer lassen, wenn sich niemand selbst registrieren soll.
- `daten`, `basisUrl` und ein `salz` aus `openssl rand -hex 32`.

## 2. nginx

```nginx
server {
    server_name sbfkurs.kandzior.de;
    root /var/www/sbfkurs.kandzior.de/html;

    # ... listen/ssl wie bei den übrigen vhosts ...

    location / {
        try_files $uri /index.php$is_args$args;
    }

    location = /index.php {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;  # Version prüfen
    }

    location ~ \.php$ {
        return 404;
    }
}
```

## 3. Prüfen

```bash
curl https://sbfkurs.kandzior.de/status
```

- `{"ok":true,"dienst":"sbfkurs","bereit":true}` → alles steht.
- `"bereit":false` → PHP läuft, aber `sbfkurs-config.php` fehlt oder
  `adminEmail`/`adminPasswortHash`/`daten` sind leer.
- PHP-Quelltext → die PHP-Anbindung fehlt.

Danach `/login` mit dem Admin-Konto, unter „Admin → Inhalte“ den
Inhaltsstatus ansehen (dort stehen dieselben Befunde wie bei
`werkzeuge/katalog-pruefen.php`), unter „Admin → Einladungen“ einen Code
erzeugen und damit ein Lernenden-Konto durchspielen.

## Die zwei Rollen

| Wer | Weg | Darf |
|---|---|---|
| Lernende | `/registrieren` mit Einladungscode oder vom Admin angelegt | alle freigeschalteten Kurse lesen, üben, Prüfungen ablegen; eigenen Namen und Passwort ändern |
| Admin | Konto aus der Konfiguration oder per Rolle | zusätzlich: Konten anlegen, sperren, Passwörter zurücksetzen (Übergangspasswort, Wechsel erzwungen), löschen; Einmalcodes; Inhaltsstatus; nicht freigeschaltete Kurse sehen |

Ein Passwort-Reset per E-Mail gibt es bewusst nicht: die Anwendung verschickt
keine Mails. Vergessene Passwörter setzt der Admin zurück.

## Sicherheit

- Passwörter nur als `password_hash`-Streuwert; Mindestlänge 10.
- Anmeldung: Missbrauchsbremse je Absender **und** Kontosperre nach
  `sperreVersuche` Fehlversuchen für `sperreMinuten`; die Fehlermeldung ist
  für unbekannte Adresse, falsches Passwort und Sperre dieselbe.
- Jeder POST mit CSRF-Wert und Herkunftsprüfung; Registrierung mit Honigtopf.
- `Content-Security-Policy` ohne Inline-Skripte und -Styles — alles
  Dynamische (Prüfungs-Timer, DSC-Szenarien) läuft über `data-`-Attribute
  in `assets/app.js` und `assets/dsc.js`.
- Sitzung `sbfkurs_sitzung`: HttpOnly, SameSite=Lax, Secure bei HTTPS, Ablauf
  nach `sitzungStunden` ohne Aktivität. Ein laufender Prüfungsversuch bleibt
  serverseitig gespeichert; maßgeblich für die Zeit ist der Server, nicht der
  Browser.
- Lektionen und Bilder werden nur über Slugs aus dem Index geladen — kein
  Pfad aus der URL erreicht das Dateisystem.

## Datenschutz

Gespeichert werden E-Mail, Anzeigename, Passwort-Streuwert und der Lernstand
(gelesene Lektionen, Trainer-Antworten, Prüfungsläufe, Übungsergebnisse).
Keine IP-Adressen im Klartext, keine Dienste Dritter. Der Admin löscht ein
Konto samt Lernstand vollständig (Kaskade in der Datenbank). Der Text unter
`/datenschutz` kommt aus `content/gemeinsam/rechtliches/datenschutz.md`;
Impressum und Verantwortlicher sind dort noch als `PLATZHALTER` markiert.

## Sicherung

`daten/sbfkurs.sqlite` wegsichern — sonst nichts. Der `spool/` darf fehlen.
Die Inhalte liegen im Repository.

## Lokal entwickeln und testen

```bash
# Testkonfiguration anlegen (Pfade anpassen)
cat > /tmp/sbfkurs-test-config.php <<'PHP'
<?php
return [
    'adminEmail' => 'admin@example.org',
    'adminPasswortHash' => password_hash('AdminPasswort123', PASSWORD_DEFAULT),
    'einladungscode' => 'TEST',
    'daten' => '/tmp/sbfkurs-daten',
    'basisUrl' => 'http://127.0.0.1:8092',
    'salz' => 'testsalz',
];
PHP
mkdir -p /tmp/sbfkurs-daten
SBFKURS_KONFIG=/tmp/sbfkurs-test-config.php php -S 127.0.0.1:8092 sbfkurs/dev-router.php
```

Der Mini-Router liefert CSS und JS aus `public/` selbst aus und gibt alles
andere an `public/index.php` — egal, aus welchem Verzeichnis der Server
gestartet wurde.

Tests ohne Framework:

```bash
php sbfkurs/tests/lauf.php                    # Markdown, Katalog, Auth, Trainer, Prüfung, Übungen, Import
php sbfkurs/werkzeuge/katalog-pruefen.php     # alle Inhalte validieren
```

Der Browser-Durchlauf `sbfkurs/tests/ablauf.mjs` (Playwright, Chromium)
registriert ein Konto, liest eine Lektion, übt im Trainer, legt eine Prüfung
ab, macht je eine Übung jedes Praxismoduls und spielt ein DSC-Szenario durch:

```bash
PW_MODUL=/pfad/zu/node_modules/playwright/package.json node sbfkurs/tests/ablauf.mjs
```

Playwright ist bewusst nicht im Repository installiert; `PW_MODUL` zeigt auf
eine Installation, `CHROME` optional auf ein Chromium. `SCREENSHOTS=<ordner>`
legt zusätzlich Bildschirmfotos bei 375 und 1280 px ab.
