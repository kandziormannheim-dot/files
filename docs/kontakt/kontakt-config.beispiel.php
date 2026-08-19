<?php

/**
 * Vorlage für die Konfiguration des Kontaktformulars.
 *
 * Diese Datei gehört NICHT ins Webroot und NICHT ins Repository. Sie kommt
 * eine Ebene oberhalb des Webroots zu liegen:
 *
 *   Webroot (HETZNER_PATH):  /var/www/kandzior.de/html
 *   Diese Datei:             /var/www/kandzior.de/kontakt-config.php
 *
 * Zwei Gründe: der Deploy überträgt mit --delete und würde sie im Webroot bei
 * jedem Lauf löschen, und ein SMTP-Passwort hat in einem öffentlich
 * ausgelieferten Verzeichnis nichts zu suchen.
 *
 * Rechte setzen, damit nur der Webserver liest:
 *   sudo chown deploy:www-data /var/www/kandzior.de/kontakt-config.php
 *   sudo chmod 640            /var/www/kandzior.de/kontakt-config.php
 */

return [
    // Wohin die Anfragen gehen.
    'empfaenger' => 'mail@kandzior.de',

    // Wer als Absender steht. MUSS eine eigene Adresse sein, nicht die des
    // Besuchers — sonst scheitert die Zustellung an SPF und DKIM, weil der
    // Server nicht für dessen Domain senden darf. Die Adresse des Besuchers
    // steht im Reply-To, „Antworten" trifft also trotzdem die richtige Person.
    'absender' => 'website@kandzior.de',
    'absenderName' => 'kandzior.de',

    // 'smtp'  — Versand über ein echtes Postfach. Empfohlen.
    // 'mail'  — PHPs mail() über einen lokalen MTA. Nur, wenn auf dem Server
    //           einer läuft UND ausgehender Port 25 offen ist. Bei Hetzner
    //           Cloud ist der für neue Konten gesperrt, dann scheitert das
    //           still — deshalb ist 'smtp' die Voreinstellung.
    'transport' => 'smtp',

    'smtp' => [
        'host' => 'mail.your-server.de',   // Postausgangsserver des Anbieters
        'port' => 587,                      // 587 = STARTTLS, 465 = TLS
        'benutzer' => 'website@kandzior.de',
        'passwort' => 'HIER_DAS_POSTFACH_PASSWORT',
        'verschluesselung' => 'starttls',   // 'starttls' oder 'tls'
        'zeitlimit' => 15,
    ],

    // Zusätzlich erlaubte Herkünfte.
    //
    // Der Normalfall braucht hier nichts: das Skript vergleicht den
    // Origin-Kopf mit dem eigenen Host und lässt Übereinstimmung durch.
    // (Browser schicken bei POST immer einen Origin-Kopf, auch bei gleicher
    // Herkunft — deshalb wird verglichen statt aufgelistet.)
    //
    // Nötig wird die Liste nur, wenn die Seite unter mehreren Namen läuft und
    // NICHT auf einen davon umgeleitet wird: dann ist www gegenüber der
    // nackten Domain eine fremde Herkunft. Sauberer ist eine Umleitung im
    // Webserver; die Liste ist der Notnagel.
    'erlaubteHerkunft' => [
        'https://kandzior.de',
        'https://www.kandzior.de',
    ],

    // Verzeichnis für die Missbrauchsbremse. Ebenfalls außerhalb des Webroots.
    //   sudo mkdir -p /var/www/kandzior.de/spool
    //   sudo chown www-data:www-data /var/www/kandzior.de/spool
    //   sudo chmod 750 /var/www/kandzior.de/spool
    'spool' => '/var/www/kandzior.de/spool',
    'limit' => [
        'anfragen' => 5,      // so viele Anfragen
        'fenster' => 3600,    // in so vielen Sekunden, je Absender
    ],

    // Beliebige lange Zeichenkette. Sie geht in den Streuwert ein, mit dem die
    // Absender-IP für die Missbrauchsbremse abgelegt wird — die IP selbst wird
    // nie gespeichert. Einmal setzen, danach nicht mehr ändern:
    //   openssl rand -hex 32
    'salz' => 'HIER_EINE_ZUFALLSKETTE',
];
