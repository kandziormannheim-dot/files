<?php

/**
 * Vorlage für die Konfiguration des Womo-Schadensformulars.
 *
 * Diese Datei gehört NICHT ins Webroot und NICHT ins Repository. Sie kommt —
 * wie beim Kontaktformular — eine Ebene oberhalb des Webroots zu liegen:
 *
 *   Webroot:     /var/www/womo.kandzior.de/html
 *   Diese Datei: /var/www/womo.kandzior.de/womo-config.php
 *   Daten:       /var/www/womo.kandzior.de/daten   (SQLite, Fotos, PDFs)
 *
 * Rechte setzen, damit nur der Webserver liest bzw. schreibt:
 *   sudo chown deploy:www-data /var/www/womo.kandzior.de/womo-config.php
 *   sudo chmod 640             /var/www/womo.kandzior.de/womo-config.php
 *   sudo mkdir -p              /var/www/womo.kandzior.de/daten
 *   sudo chown www-data:www-data /var/www/womo.kandzior.de/daten
 *   sudo chmod 750             /var/www/womo.kandzior.de/daten
 */

return [
    // Anzeigename des Fahrzeugs — steht in Überschriften, Mails und im PDF.
    'fahrzeugName' => 'Wohnmobil',

    // Kennzeichen fürs Protokoll. Leer lassen, wenn es nicht erscheinen soll.
    'kennzeichen' => '',

    // Streuwert des Admin-Passworts. Erzeugen mit:
    //   php -r "echo password_hash('DEIN_PASSWORT', PASSWORD_DEFAULT), PHP_EOL;"
    'adminPasswortHash' => '',

    // Verzeichnis für Datenbank, Fotos, Unterschriften, PDFs und die
    // Missbrauchsbremse. MUSS außerhalb des Webroots liegen und dem
    // Webserver gehören (siehe oben).
    'daten' => '/var/www/womo.kandzior.de/daten',

    // Wohin Benachrichtigungen und die Vermieter-Ausfertigung des
    // Protokoll-PDFs gehen.
    'empfaenger' => 'mail@kandzior.de',

    // Absender der System-Mails. MUSS eine eigene Adresse sein — die
    // Begründung steht in docs/kontakt/README.md (SPF/DKIM).
    'absender' => 'womo@kandzior.de',
    'absenderName' => 'Womo-Schadensakte',

    // Öffentliche Adresse der Anwendung, ohne Schrägstrich am Ende. Wird für
    // die Mieter-Links in Mails und für den QR-Code gebraucht.
    'basisUrl' => 'https://womo.kandzior.de',

    // 'smtp' — Versand über ein echtes Postfach (empfohlen).
    // 'mail' — PHPs mail() über einen lokalen MTA.
    // ''     — kein Versand: Mails werden nur ins Serverprotokoll geschrieben.
    //          Praktisch für die lokale Entwicklung.
    'transport' => 'smtp',

    'smtp' => [
        'host' => 'mail.your-server.de',
        'port' => 587,
        'benutzer' => 'womo@kandzior.de',
        'passwort' => 'HIER_DAS_POSTFACH_PASSWORT',
        'verschluesselung' => 'starttls', // 'starttls' oder 'tls'
        'zeitlimit' => 15,
    ],

    // Zusätzlich erlaubte Herkünfte für POST-Anfragen. Der Normalfall braucht
    // hier nichts — verglichen wird gegen den eigenen Host.
    'erlaubteHerkunft' => [],

    // Missbrauchsbremse für die öffentlichen Formulare (QR-Meldung, Login).
    'limit' => [
        'anfragen' => 10,   // so viele Anfragen
        'fenster' => 3600,  // in so vielen Sekunden, je Absender
    ],

    // Beliebige lange Zufallskette, einmal setzen, danach nicht mehr ändern:
    //   openssl rand -hex 32
    'salz' => 'HIER_EINE_ZUFALLSKETTE',

    // Wie viele Tage nach Mietende der Mieter-Link noch funktioniert
    // (Nachmeldungen, Protokoll-Abruf).
    'tokenNachlauf' => 7,

    // Nach so vielen Jahren ab Mietende schlägt das System die Löschung der
    // Mieterdaten vor (Regelverjährung § 195 BGB: drei Jahre).
    'aufbewahrungJahre' => 3,
];
