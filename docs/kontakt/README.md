# Kontaktformular — Einrichtung

Das Formular auf der Startseite schickt seine drei Felder als JSON an
`/api/kontakt.php`. Das Skript liegt unter
[`site/public/api/kontakt.php`](../../site/public/api/kontakt.php), landet über
den Astro-Build in `dist/api/` und wird vom Deploy mit übertragen.

Kein Drittanbieter ist beteiligt: die Anfrage verlässt den eigenen Server nur
auf dem Weg ins Postfach. Genau das sagt die Datenschutzerklärung zu.

Zu tun sind vier Dinge — danach ist das Formular scharf.

## 1. Konfiguration anlegen

[`kontakt-config.beispiel.php`](kontakt-config.beispiel.php) auf den Server
kopieren, **eine Ebene oberhalb des Webroots**:

```bash
# lokal
scp docs/kontakt/kontakt-config.beispiel.php \
    deploy@SERVER:/var/www/kandzior.de/kontakt-config.php

# auf dem Server
sudo chown deploy:www-data /var/www/kandzior.de/kontakt-config.php
sudo chmod 640            /var/www/kandzior.de/kontakt-config.php
sudo -u www-data mkdir -p /var/www/kandzior.de/spool
sudo chmod 750            /var/www/kandzior.de/spool
```

Warum oberhalb: der Deploy überträgt mit `--delete` und würde die Datei im
Webroot bei jedem Lauf löschen. Und ein SMTP-Passwort gehört nicht in ein
öffentlich ausgeliefertes Verzeichnis.

Dann in der Datei ausfüllen: `smtp.host`, `smtp.benutzer`, `smtp.passwort` und
ein `salz` aus `openssl rand -hex 32`.

## 2. Absenderadresse

`absender` muss eine **eigene** Adresse sein, nicht die des Besuchers. Trägt
der Server die Besucheradresse als Absender ein, scheitert die Zustellung an
SPF und DKIM — die fremde Domain hat diesen Server nicht autorisiert. Landet
die Mail trotzdem, dann im Spam.

Die Besucheradresse steht im `Reply-To`. „Antworten" trifft also die richtige
Person, ohne dass irgendwo gelogen wird.

Zwei Einträge im DNS erhöhen die Zustellrate deutlich:

- **SPF** — der Postausgangsserver des Anbieters muss im `TXT`-Eintrag von
  `kandzior.de` stehen, z. B. `v=spf1 include:_spf.your-server.de ~all`.
- **DKIM** — beim Mailanbieter aktivieren, den ausgegebenen Schlüssel als
  `TXT` hinterlegen.

## 3. PHP im Webserver freischalten

Die Site ist statisch; PHP wird **nur** für diese eine Datei gebraucht.

`sudo apt install php-fpm` und dann in nginx:

```nginx
location = /api/kontakt.php {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;  # Version prüfen
}

# Alles andere unter /api/ bleibt zu.
location /api/ {
    return 404;
}
```

Bewusst `location = /api/kontakt.php` statt `location ~ \.php$`: nur diese eine
Datei wird ausgeführt, alles andere kann gar nicht erst zum Interpreter
gelangen.

Bei Apache mit `mod_php` oder `php-fpm` über `SetHandler` genügt, dass PHP für
das Verzeichnis aktiv ist.

## 4. Prüfen

**Läuft PHP?**

```bash
curl https://kandzior.de/api/kontakt.php
```

- `{"ok":true,"dienst":"kontakt","bereit":true}` → alles steht.
- `{"ok":true,...,"bereit":false}` → PHP läuft, die Konfigurationsdatei wurde
  nicht gefunden. Pfad und Rechte prüfen.
- PHP-Quelltext → die PHP-Anbindung fehlt. **In diesem Zustand nicht live
  gehen**: der Browser bekäme ein HTTP 200 und das Formular … meldete früher
  Erfolg. Seit dieser Änderung prüft es zusätzlich, ob die Antwort `ok: true`
  enthält, und zeigt sonst den Fehlschlag mit E-Mail-Ausweichweg.

**Kommt eine Mail an?** Formular auf der Seite ausfüllen und abschicken. Kommt
nichts, steht die Ursache im Serverprotokoll:

```bash
sudo tail -f /var/log/nginx/error.log | grep kontakt
```

Das Skript protokolliert die Ursache dort (`[kontakt] Versand fehlgeschlagen:
…`) und schickt sie **nicht** an den Browser — der Besucher soll keine
Serverinterna sehen.

## Was das Skript sonst noch tut

- **Honigtopf.** Ist das für Menschen unsichtbare Feld `company` gefüllt, meldet
  das Skript Erfolg und sendet nichts. Ein Bot bekommt keine Rückmeldung, aus
  der er lernen kann.
- **Missbrauchsbremse.** Fünf Anfragen je Stunde und Absender. Die IP wird dafür
  nur als Streuwert mit täglich wechselndem Salz abgelegt, nie im Klartext, und
  spätestens nach einem Tag gelöscht.
- **Kopfzeilen-Einschub.** Zeilenumbrüche und Steuerzeichen werden entfernt,
  bevor irgendein Wert in eine Kopfzeile wandert.
- **Herkunft.** Der `Origin`-Kopf wird gegen den eigenen Host geprüft; fremde
  Herkünfte werden abgewiesen. Browser senden diesen Kopf bei `POST` immer,
  auch bei gleicher Herkunft — deshalb wird verglichen statt aufgelistet, und
  die Voreinstellung funktioniert ohne Konfiguration. Läuft die Seite unter
  mehreren Namen ohne Umleitung, gehören die weiteren in `erlaubteHerkunft`.
- **Grenzen.** Name 2–100 Zeichen, Nachricht 10–5000, Rumpf höchstens 64 KB.

## Wenn kein eigener Versand gewünscht ist

Der Endpunkt ist austauschbar: `formEndpoint` in
[`site/src/content/site.json`](../../site/src/content/site.json) auf eine andere
URL zeigen lassen, die auf `POST` mit `{"ok":true}` antwortet. Ein
Fremdanbieter wäre dann allerdings Auftragsverarbeiter — die
Datenschutzerklärung sagt derzeit ausdrücklich, dass die Formulardaten nicht an
Dritte gehen, und müsste ergänzt werden.
