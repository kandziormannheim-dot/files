# Womo-Schadensakte — Einrichtung

Die Anwendung unter [`womo/`](../../womo/) dokumentiert Schäden am Wohnmobil:
Übergabe- und Rückgabeprotokolle mit beidseitiger Unterschrift und PDF-Versand,
Schadensmeldungen der Mieter über einen persönlichen Link, spontane Meldungen
über einen QR-Code im Fahrzeug — und die laufende private Schadensakte mit
Status, Kosten und Werkstatt.

Technisch ist sie der große Bruder des Kontaktformulars
([`docs/kontakt/`](../kontakt/README.md)): PHP ohne Framework, SQLite statt
Fremddienst, Konfiguration außerhalb des Webroots, dieselbe Missbrauchsbremse,
derselbe SMTP-Versand. Kein Composer, keine Laufzeit-Abhängigkeiten — FPDF
liegt gebündelt in `womo/src/pdf/`.

## Voraussetzungen

- PHP 8.2+ mit `pdo_sqlite`, `gd` und `mbstring`
  (`sudo apt install php-fpm php-sqlite3 php-gd php-mbstring`)
- Eine Subdomain, z. B. `womo.kandzior.de`, mit TLS-Zertifikat

## 1. Verzeichnisse und Konfiguration

```bash
# Struktur auf dem Server
/var/www/womo.kandzior.de/
├── html/            ← Webroot: Inhalt von womo/public/
├── src/             ← womo/src/
├── womo-config.php  ← aus womo/womo-config.beispiel.php, NICHT im Webroot
└── daten/           ← SQLite, Fotos, Unterschriften, PDFs, Spool
```

```bash
scp -r womo/public/* deploy@SERVER:/var/www/womo.kandzior.de/html/
scp -r womo/src      deploy@SERVER:/var/www/womo.kandzior.de/
scp womo/womo-config.beispiel.php deploy@SERVER:/var/www/womo.kandzior.de/womo-config.php

# auf dem Server
sudo chown deploy:www-data /var/www/womo.kandzior.de/womo-config.php
sudo chmod 640             /var/www/womo.kandzior.de/womo-config.php
sudo mkdir -p              /var/www/womo.kandzior.de/daten
sudo chown www-data:www-data /var/www/womo.kandzior.de/daten
sudo chmod 750             /var/www/womo.kandzior.de/daten
```

Wichtig: `index.php` sucht `src/` relativ zu sich (`dirname(__DIR__).'/src'`).
Liegt das Webroot wie oben unter `html/`, gehört `src/` daneben — genau so
verlegt es das `scp` oben.

In `womo-config.php` ausfüllen:

- `adminPasswortHash` — erzeugen mit
  `php -r "echo password_hash('DEIN_PASSWORT', PASSWORD_DEFAULT), PHP_EOL;"`
- `daten`, `empfaenger`, `absender`, `basisUrl`
- `smtp.*` und ein `salz` aus `openssl rand -hex 32` — beides wie beim
  Kontaktformular (dort steht auch die SPF/DKIM-Begründung)

## 2. nginx

Alles läuft durch `index.php`; keine andere PHP-Datei ist erreichbar:

```nginx
server {
    server_name womo.kandzior.de;
    root /var/www/womo.kandzior.de/html;

    # ... listen/ssl wie bei den übrigen vhosts ...

    client_max_body_size 80m;   # bis zu 6 Fotos je Meldung

    location / {
        try_files $uri /index.php$is_args$args;
    }

    location = /index.php {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;  # Version prüfen
    }

    # Jede andere .php-Datei kann gar nicht erst zum Interpreter gelangen.
    location ~ \.php$ {
        return 404;
    }
}
```

In `/etc/php/*/fpm/php.ini` die Upload-Grenzen anheben:
`upload_max_filesize = 15M`, `post_max_size = 80M`.

## 3. Prüfen

```bash
curl https://womo.kandzior.de/status
```

- `{"ok":true,"dienst":"womo","bereit":true}` → alles steht.
- `"bereit":false` → PHP läuft, aber `womo-config.php` fehlt oder
  `adminPasswortHash`/`daten` sind leer.
- PHP-Quelltext → die PHP-Anbindung fehlt. In diesem Zustand nicht verwenden.

Danach im Browser anmelden (`/login`), eine Test-Vermietung anlegen und ein
Übergabeprotokoll bis zum PDF durchspielen — kommt die Mail nicht an, steht
die Ursache im Serverprotokoll (`[womo] …`), nie beim Besucher.

## 4. QR-Code ins Fahrzeug

Der QR-Code zeigt schlicht auf `https://womo.kandzior.de/qr` (englische
Oberfläche: `…/qr?lang=en`). Erzeugen z. B. mit:

```bash
qrencode -o qr-womo.png -s 10 "https://womo.kandzior.de/qr"
```

Ausdrucken, laminieren, in den Innenraum kleben. Meldungen darüber landen als
„unzugeordnet“ auf dem Dashboard und werden dort einer Vermietung — oder der
eigenen Akte — zugeordnet.

## Die drei Zugänge

| Wer | Weg | Darf |
|---|---|---|
| Vermieter | `/login`, ein Admin-Passwort | alles: Akte, Vermietungen, Protokolle, Kosten, Notizen |
| Mieter | `/m/<token>` aus der Vermietung, gültig ab 1 Tag vor Mietbeginn bis `tokenNachlauf` Tage nach Mietende | offene Vorschäden sehen, eigene Schäden melden (Foto Pflicht), eigene Protokoll-PDFs abrufen — nie Kosten, Notizen oder frühere Mieter |
| Jedermann | `/qr` | einen Schaden mit Foto und Namen melden (Honigtopf + Missbrauchsbremse) |

## Datenschutz

- **Fotos** werden serverseitig neu kodiert — EXIF-Daten inklusive
  GPS-Position sind damit entfernt; Originaldateien werden nie gespeichert.
- **Löschfrist:** `aufbewahrungJahre` (Vorgabe 3, Regelverjährung) nach
  Mietende markiert das Dashboard die Vermietung. „Anonymisieren“ entfernt
  Name, Kontakt, Token, Unterschriften und Protokoll-PDFs unwiderruflich;
  die Schäden bleiben ohne Personenbezug in der Fahrzeugakte.
- **Missbrauchsbremse** wie beim Kontaktformular: IP nur als Streuwert mit
  täglich wechselndem Salz, spätestens nach einem Tag gelöscht.

## Sicherung

Es reicht, `daten/` wegzusichern — dort liegt alles: `womo.sqlite`, `fotos/`,
`unterschriften/`, `pdf/`. Der `spool/` darf fehlen.

## Lokal entwickeln

```bash
WOMO_KONFIG=/pfad/zu/test-config.php php -S 127.0.0.1:8091 dev-router.php
```

mit einem Mini-Router, der vorhandene Dateien direkt ausliefert und alles
andere an `womo/public/index.php` gibt. In der Test-Konfiguration
`'transport' => ''` setzen: Mails werden dann nur ins Protokoll geschrieben.
