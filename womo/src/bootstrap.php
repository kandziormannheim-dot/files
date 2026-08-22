<?php

/**
 * Gemeinsamer Unterbau: Konfiguration laden, Datenbank öffnen, Schema
 * sicherstellen, Sitzung starten.
 *
 * Die Konfiguration liegt — wie beim Kontaktformular — eine Ebene oberhalb
 * des Webroots (womo-config.php). Für die lokale Entwicklung darf sie
 * alternativ über die Umgebungsvariable WOMO_KONFIG angegeben werden.
 */

declare(strict_types=1);

require __DIR__ . '/helpers.php';
require __DIR__ . '/i18n.php';
require __DIR__ . '/mailer.php';
require __DIR__ . '/fotos.php';

/** Konfiguration mit Vorgaben zusammenführen. */
function konfigLaden(): array
{
    $pfad = getenv('WOMO_KONFIG') ?: dirname(__DIR__, 2) . '/womo-config.php';
    // Im Normalbetrieb liegt public/ als Webroot unter dem vhost-Verzeichnis
    // und die Config eine Ebene darüber.
    if (!is_file($pfad)) {
        $pfad = dirname($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__) . '/public') . '/womo-config.php';
    }

    $konfig = is_file($pfad) ? require $pfad : null;

    $standard = [
        'fahrzeugName' => 'Wohnmobil',
        'kennzeichen' => '',
        'adminPasswortHash' => '',
        'daten' => '',
        'empfaenger' => '',
        'absender' => '',
        'absenderName' => 'Womo-Schadensakte',
        'basisUrl' => '',
        'transport' => 'smtp',
        'smtp' => [
            'host' => '',
            'port' => 587,
            'benutzer' => '',
            'passwort' => '',
            'verschluesselung' => 'starttls',
            'zeitlimit' => 15,
        ],
        'erlaubteHerkunft' => [],
        'limit' => ['anfragen' => 10, 'fenster' => 3600],
        'salz' => '',
        'tokenNachlauf' => 7,
        'aufbewahrungJahre' => 3,
    ];

    $konfig = is_array($konfig) ? array_replace_recursive($standard, $konfig) : $standard;
    $konfig['bereit'] = $konfig['daten'] !== '' && $konfig['adminPasswortHash'] !== '';

    return $konfig;
}

/** Unterverzeichnis im Datenverzeichnis sicherstellen und zurückgeben. */
function datenPfad(array $konfig, string $unterordner = ''): string
{
    $pfad = rtrim((string) $konfig['daten'], '/');
    if ($unterordner !== '') {
        $pfad .= '/' . $unterordner;
    }
    if (!is_dir($pfad) && !@mkdir($pfad, 0770, true) && !is_dir($pfad)) {
        throw new RuntimeException('Datenverzeichnis nicht anlegbar: ' . $pfad);
    }

    return $pfad;
}

/** Datenbank öffnen; das Schema wird bei jedem Start abgeglichen. */
function dbOeffnen(array $konfig): PDO
{
    $db = new PDO('sqlite:' . datenPfad($konfig) . '/womo.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA journal_mode = WAL');

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS vermietungen (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            email         TEXT NOT NULL DEFAULT '',
            telefon       TEXT NOT NULL DEFAULT '',
            von           TEXT NOT NULL,             -- Datum JJJJ-MM-TT
            bis           TEXT NOT NULL,
            sprache       TEXT NOT NULL DEFAULT 'de', -- 'de' oder 'en'
            token         TEXT UNIQUE,                -- NULL nach Anonymisierung
            status        TEXT NOT NULL DEFAULT 'angelegt', -- angelegt|laufend|abgeschlossen
            anonymisiert  INTEGER NOT NULL DEFAULT 0,
            erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
        )
        SQL);

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS schaeden (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            vermietung_id INTEGER REFERENCES vermietungen(id), -- NULL: eigene Akte oder QR-Meldung
            protokoll_id  INTEGER,                             -- gesetzt, wenn im Protokoll erfasst
            typ           TEXT NOT NULL DEFAULT 'schaden',     -- schaden|werkstattauftrag
            zone          TEXT NOT NULL,
            beschreibung  TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'offen',       -- offen|gemeldet|repariert
            kosten_cent   INTEGER,
            werkstatt     TEXT NOT NULL DEFAULT '',
            verursacher   TEXT NOT NULL DEFAULT '',
            notiz         TEXT NOT NULL DEFAULT '',            -- intern, Mieter sieht sie nie
            quelle        TEXT NOT NULL DEFAULT 'admin',       -- admin|mieter|qr
            erstellt_am   TEXT NOT NULL DEFAULT (datetime('now')),
            aktualisiert_am TEXT NOT NULL DEFAULT (datetime('now'))
        )
        SQL);

    // Bestehende Datenbanken nachziehen: die Spalte typ kam später dazu
    // (CREATE TABLE IF NOT EXISTS greift dann nicht mehr).
    $spalten = array_column($db->query('PRAGMA table_info(schaeden)')->fetchAll(), 'name');
    if (!in_array('typ', $spalten, true)) {
        $db->exec("ALTER TABLE schaeden ADD COLUMN typ TEXT NOT NULL DEFAULT 'schaden'");
    }

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS fotos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            schaden_id  INTEGER NOT NULL REFERENCES schaeden(id) ON DELETE CASCADE,
            datei       TEXT NOT NULL,
            erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
        )
        SQL);

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS protokolle (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            vermietung_id          INTEGER NOT NULL REFERENCES vermietungen(id),
            typ                    TEXT NOT NULL,               -- uebergabe|rueckgabe
            status                 TEXT NOT NULL DEFAULT 'entwurf', -- entwurf|abgeschlossen
            km_stand               TEXT NOT NULL DEFAULT '',
            bemerkung              TEXT NOT NULL DEFAULT '',
            unterschrift_mieter    TEXT NOT NULL DEFAULT '',    -- Dateiname
            unterschrift_vermieter TEXT NOT NULL DEFAULT '',
            pdf_datei              TEXT NOT NULL DEFAULT '',
            erstellt_am            TEXT NOT NULL DEFAULT (datetime('now')),
            abgeschlossen_am       TEXT
        )
        SQL);

    return $db;
}

/** Sitzung mit strengen Cookie-Regeln starten (für Admin-Anmeldung und CSRF). */
function sitzungStarten(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('womo_sitzung');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== ''),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
