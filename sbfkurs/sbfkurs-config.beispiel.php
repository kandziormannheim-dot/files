<?php

/**
 * Vorlage für die Konfiguration des SBF-Kurses.
 *
 * Diese Datei gehört NICHT ins Webroot und NICHT ins Repository. Sie liegt —
 * wie bei Kontaktformular und Womo-Schadensakte — eine Ebene oberhalb des
 * Webroots:
 *
 *   Webroot:     /var/www/sbfkurs.kandzior.de/html        (= sbfkurs/public)
 *   Code:        /var/www/sbfkurs.kandzior.de/src
 *   Inhalte:     /var/www/sbfkurs.kandzior.de/content
 *   Diese Datei: /var/www/sbfkurs.kandzior.de/sbfkurs-config.php
 *   Daten:       /var/www/sbfkurs.kandzior.de/daten         (SQLite, Spool)
 *
 * Rechte setzen, damit nur der Webserver liest bzw. schreibt:
 *   sudo chown deploy:www-data   /var/www/sbfkurs.kandzior.de/sbfkurs-config.php
 *   sudo chmod 640               /var/www/sbfkurs.kandzior.de/sbfkurs-config.php
 *   sudo mkdir -p                /var/www/sbfkurs.kandzior.de/daten
 *   sudo chown www-data:www-data /var/www/sbfkurs.kandzior.de/daten
 *   sudo chmod 750               /var/www/sbfkurs.kandzior.de/daten
 */

return [
    // Name, der in Kopfzeile und Seitentitel steht.
    'titel' => 'SBF-Kurs',

    // Das erste Admin-Konto. Wird beim Start angelegt, falls es fehlt; ein
    // geänderter Hash setzt das Passwort des Kontos neu.
    // Hash erzeugen: php -r "echo password_hash('DEIN_PASSWORT', PASSWORD_DEFAULT), PHP_EOL;"
    'adminEmail' => 'mail@kandzior.de',
    'adminPasswortHash' => '',

    // Einladungscode für die Selbstregistrierung. Leer lassen, wenn sich
    // niemand selbst registrieren darf (dann legt der Admin Konten an).
    // Zusätzlich gibt es Einmalcodes, die der Admin in der Anwendung erzeugt.
    'einladungscode' => '',

    // Verzeichnis für Datenbank und Missbrauchsbremse. MUSS außerhalb des
    // Webroots liegen und dem Webserver gehören (siehe oben).
    'daten' => '/var/www/sbfkurs.kandzior.de/daten',

    // Öffentliche Adresse der Anwendung, ohne Schrägstrich am Ende.
    'basisUrl' => 'https://sbfkurs.kandzior.de',

    // Zusätzlich erlaubte Herkünfte für POST-Anfragen. Der Normalfall braucht
    // hier nichts — verglichen wird gegen den eigenen Host.
    'erlaubteHerkunft' => [],

    // Missbrauchsbremse für Anmeldung und Registrierung.
    'limit' => [
        'anfragen' => 10,   // so viele Versuche
        'fenster' => 3600,  // in so vielen Sekunden, je Absender
    ],

    // Nach so vielen Fehlversuchen wird ein Konto für 'sperreMinuten' gesperrt.
    'sperreVersuche' => 10,
    'sperreMinuten' => 15,

    // Sitzung endet nach so vielen Stunden ohne Aktivität.
    'sitzungStunden' => 8,

    // Beliebige lange Zufallskette, einmal setzen, danach nicht mehr ändern:
    //   openssl rand -hex 32
    'salz' => 'HIER_EINE_ZUFALLSKETTE',
];
