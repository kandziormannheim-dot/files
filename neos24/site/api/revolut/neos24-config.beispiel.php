<?php

/**
 * Vorlage für die Konfiguration von neos24.com (Revolut-Checkout, Mails,
 * Kontaktformular, internes Dashboard).
 *
 * Diese Datei gehört NICHT ins Webroot und NICHT ins Repository. Sie liegt
 * eine Ebene oberhalb des Webroots:
 *
 *   Webroot:     /var/www/vhosts/neos24.com/httpdocs
 *   Diese Datei: /var/www/vhosts/neos24.com/neos24-config.php
 *   Daten:       /var/www/vhosts/neos24.com/neos24-daten   (SQLite, Bremse)
 *
 * Rechte: Datei 640 (Besitzer deploy, Gruppe Webserver), Datenverzeichnis
 * 750 und dem Webserver gehörend. Lokal lässt sich der Pfad per Umgebungs-
 * variable NEOS_KONFIG überschreiben.
 */

return [
    'revolut' => [
        // 'sandbox' zum Testen, 'prod' für echte Zahlungen. Der Browser lädt
        // dazu passend embed.js von sandbox-merchant.revolut.com bzw.
        // merchant.revolut.com.
        'modus' => 'sandbox',

        // Revolut Business → Merchant API → API keys → Secret key (sk_…).
        // Sandbox und Produktion haben getrennte Schlüssel.
        'geheimerSchluessel' => '',

        // Ausgabe von webhook-einrichten.php (wsk_…). Ohne diesen Wert lehnt
        // webhook.php jede Zustellung ab.
        'webhookSchluessel' => '',

        // Vor Go-live gegen die aktuelle Revolut-Doku prüfen.
        'apiVersion' => '2024-09-01',
    ],

    // Verzeichnis für SQLite und Missbrauchsbremse — außerhalb des Webroots.
    // Enthält Bestellungen UND die Daten des internen Dashboards (Preise,
    // Routing, Anfragen, Benutzer, Rollen, Protokoll).
    'daten' => '/var/www/vhosts/neos24.com/neos24-daten',

    // Mehrwertsteuersatz in Prozent — Privatkundenpreise = netto × (100 + Satz) / 100.
    'mwstSatz' => 19,

    // Internes Dashboard (intern/). Ersten Admin anlegen: php intern/einrichten.php <E-Mail> "Name"
    'intern' => [
        'sitzungsdauer' => 28800,                       // Sekunden ohne Aktivität bis zur Abmeldung (8 h)
        'anmeldung' => ['versuche' => 5, 'sperre' => 900, 'jeIp' => 30], // Fehlversuche je Konto → Sperre (s); Versuche je IP und Stunde
    ],

    // Kundenportal (konto/): Anmeldung per Passwort oder E-Mail-Link.
    'konto' => [
        'sitzungsdauer' => 1209600,                     // 14 Tage ohne Aktivität
        'linkGueltigkeit' => 900,                       // Anmelde-/Registrierungslink in Sekunden
        'einladungGueltigkeit' => 604800,               // Einladung für Firmenbenutzer in Sekunden (7 Tage)
        'anmeldung' => ['versuche' => 5, 'sperre' => 900, 'jeIp' => 30],
    ],

    // Rechnungsabsender für die Sammelrechnungen (Pflichtangaben vor Livegang füllen).
    'firma' => [
        'name' => 'NEOS Logistics UG',
        'strasse' => 'Musterstraße 1', 'plz' => '68159', 'ort' => 'Mannheim', 'land' => 'Deutschland',
        'ustId' => 'DE000000000', 'registergericht' => 'Amtsgericht Mannheim, HRB 000000', 'geschaeftsfuehrung' => 'Vorname Nachname',
        'iban' => 'DE00 0000 0000 0000 0000 00', 'bic' => 'XXXXDEXXXXX', 'bank' => 'Musterbank',
        'email' => 'info@neos24.com', 'web' => 'neos24.com',
    ],
    'rechnung' => ['praefix' => 'NR', 'zahlungszielTage' => 14], // Nummer NR-<Jahr>-0001, Fälligkeit

    // Öffentliche Adresse der Seite ohne Schrägstrich am Ende; wird für die
    // Rücksprung-URL nach 3-D-Secure gebraucht.
    'basisUrl' => 'https://neos24.com',

    // Mails (Bestätigungen, Anmeldelinks, Rechnungen). 'smtp' (empfohlen), 'mail' (lokaler MTA),
    // 'datei' (Textdateien unter daten/mails/ — lokale Entwicklung) oder '' (nur Serverprotokoll).
    'transport' => 'smtp',
    'absender' => 'bestellung@neos24.com',
    'absenderName' => 'NEOS',
    'kopie' => 'info@neos24.com', // bekommt eine Kopie jeder Bestätigung, '' = keine
    'smtp' => [
        'host' => 'mail.neos24.com',
        'port' => 587,
        'benutzer' => 'bestellung@neos24.com',
        'passwort' => 'HIER_DAS_POSTFACH_PASSWORT',
        'verschluesselung' => 'starttls', // 'starttls' oder 'tls'
        'zeitlimit' => 15,
    ],

    // Zusätzlich erlaubte Herkünfte für POST-Anfragen (www und nackte Domain
    // sind über den eigenen Host bereits abgedeckt).
    'erlaubteHerkunft' => [],

    // Missbrauchsbremse je Absender.
    'limit' => ['anfragen' => 10, 'fenster' => 3600],

    // Beliebige lange Zufallskette, einmal setzen: openssl rand -hex 32
    'salz' => 'HIER_EINE_ZUFALLSKETTE',
];
