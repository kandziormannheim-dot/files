<?php

/**
 * Gemeinsamer Unterbau: Konfiguration laden, Datenbank öffnen, Schema
 * sicherstellen, Sitzung starten, Admin-Konto einspielen.
 *
 * Die Konfiguration liegt — wie bei Kontaktformular und Womo — eine Ebene
 * oberhalb des Webroots (sbfkurs-config.php). Für die lokale Entwicklung und
 * die Tests darf sie über die Umgebungsvariable SBFKURS_KONFIG angegeben werden.
 */

declare(strict_types=1);

require __DIR__ . '/helpers.php';
require __DIR__ . '/markdown.php';
require __DIR__ . '/inhalte.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/fortschritt.php';
require __DIR__ . '/trainer.php';
require __DIR__ . '/pruefung.php';
require __DIR__ . '/uebungen.php';

/** Konfiguration mit Vorgaben zusammenführen. */
function konfigLaden(): array
{
    $pfad = getenv('SBFKURS_KONFIG') ?: dirname(__DIR__, 2) . '/sbfkurs-config.php';
    // Im Normalbetrieb liegt public/ als Webroot unter dem vhost-Verzeichnis
    // und die Config eine Ebene darüber.
    if (!is_file($pfad)) {
        $pfad = dirname($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__) . '/public') . '/sbfkurs-config.php';
    }

    $konfig = is_file($pfad) ? require $pfad : null;

    $standard = [
        'titel' => 'SBF-Kurs',
        'adminEmail' => '',
        'adminPasswortHash' => '',
        'einladungscode' => '',
        'daten' => '',
        'basisUrl' => '',
        'erlaubteHerkunft' => [],
        'limit' => ['anfragen' => 10, 'fenster' => 3600],
        'sperreVersuche' => 10,
        'sperreMinuten' => 15,
        'sitzungStunden' => 8,
        'salz' => '',
        // Nur für Tests: anderes Inhaltsverzeichnis.
        'inhalte' => '',
    ];

    $konfig = is_array($konfig) ? array_replace_recursive($standard, $konfig) : $standard;
    $konfig['bereit'] = $konfig['daten'] !== ''
        && $konfig['adminEmail'] !== ''
        && $konfig['adminPasswortHash'] !== '';

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

/** Wurzel der Inhalte (content/) — liegt neben src/, nie im Webroot. */
function inhaltePfad(array $konfig): string
{
    $pfad = (string) ($konfig['inhalte'] ?? '');

    return $pfad !== '' ? rtrim($pfad, '/') : dirname(__DIR__) . '/content';
}

/** Datenbank öffnen; das Schema wird bei jedem Start abgeglichen. */
function dbOeffnen(array $konfig): PDO
{
    $db = new PDO('sqlite:' . datenPfad($konfig) . '/sbfkurs.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA journal_mode = WAL');

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS benutzer (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            email                   TEXT NOT NULL UNIQUE COLLATE NOCASE,
            name                    TEXT NOT NULL DEFAULT '',
            passwort_hash           TEXT NOT NULL,
            rolle                   TEXT NOT NULL DEFAULT 'lerner',  -- lerner|admin
            aktiv                   INTEGER NOT NULL DEFAULT 1,
            passwort_wechsel_noetig INTEGER NOT NULL DEFAULT 0,
            fehlversuche            INTEGER NOT NULL DEFAULT 0,
            gesperrt_bis            TEXT,                             -- UTC, nach zu vielen Fehlversuchen
            erstellt_am             TEXT NOT NULL DEFAULT (datetime('now')),
            letzte_anmeldung        TEXT
        )
        SQL);

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS fortschritt (
            benutzer_id      INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
            zertifikat       TEXT NOT NULL,
            aktuelle_lektion TEXT NOT NULL DEFAULT '',
            gestartet_am     TEXT NOT NULL DEFAULT (datetime('now')),
            aktualisiert_am  TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (benutzer_id, zertifikat)
        )
        SQL);

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS lektion_gelesen (
            benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
            zertifikat  TEXT NOT NULL,
            lektion     TEXT NOT NULL,
            gelesen_am  TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (benutzer_id, zertifikat, lektion)
        )
        SQL);

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS trainer_antworten (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
            zertifikat  TEXT NOT NULL,
            frage_id    TEXT NOT NULL,
            gegeben     INTEGER NOT NULL,           -- Index im Katalog (nach Rückmischung)
            richtig     INTEGER NOT NULL,
            modus       TEXT NOT NULL DEFAULT 'neu',
            erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
        )
        SQL);
    $db->exec('CREATE INDEX IF NOT EXISTS idx_trainer_antworten_nutzer
               ON trainer_antworten (benutzer_id, zertifikat, erstellt_am)');

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS fragen_stand (
            benutzer_id    INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
            zertifikat     TEXT NOT NULL,
            frage_id       TEXT NOT NULL,
            richtig_anzahl INTEGER NOT NULL DEFAULT 0,
            falsch_anzahl  INTEGER NOT NULL DEFAULT 0,
            serie          INTEGER NOT NULL DEFAULT 0, -- richtige in Folge
            zuletzt_am     TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (benutzer_id, zertifikat, frage_id)
        )
        SQL);

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS pruefungen (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            benutzer_id   INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
            zertifikat    TEXT NOT NULL,
            bogen         TEXT NOT NULL DEFAULT 'zufall',   -- 'zufall' oder 'amtlich-3'
            fragen_json   TEXT NOT NULL,                    -- [{frage_id, reihenfolge:[…]}, …]
            zeitlimit_sek INTEGER NOT NULL,
            gestartet_am  TEXT NOT NULL DEFAULT (datetime('now')),
            abgegeben_am  TEXT,
            ueberzogen    INTEGER NOT NULL DEFAULT 0,
            richtig       INTEGER,
            gesamt        INTEGER NOT NULL,
            bestanden     INTEGER,
            regeln_json   TEXT NOT NULL                     -- Schnappschuss der Regeln beim Start
        )
        SQL);
    $db->exec('CREATE INDEX IF NOT EXISTS idx_pruefungen_nutzer
               ON pruefungen (benutzer_id, zertifikat, gestartet_am)');

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS pruefung_antworten (
            pruefung_id INTEGER NOT NULL REFERENCES pruefungen(id) ON DELETE CASCADE,
            position    INTEGER NOT NULL,
            frage_id    TEXT NOT NULL,
            gegeben     INTEGER,                            -- Katalog-Index oder NULL
            richtig     INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (pruefung_id, position)
        )
        SQL);

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS uebung_ergebnisse (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            benutzer_id  INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
            zertifikat   TEXT NOT NULL DEFAULT '',          -- '' für zertifikatsübergreifend
            modul        TEXT NOT NULL,                     -- funkverkehr|buchstabieren|englisch|dsc
            uebung_id    TEXT NOT NULL,
            punkte       INTEGER NOT NULL,
            maximal      INTEGER NOT NULL,
            details_json TEXT NOT NULL DEFAULT '{}',
            erstellt_am  TEXT NOT NULL DEFAULT (datetime('now'))
        )
        SQL);
    $db->exec('CREATE INDEX IF NOT EXISTS idx_uebung_ergebnisse_nutzer
               ON uebung_ergebnisse (benutzer_id, zertifikat, modul)');

    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS einladungen (
            code           TEXT PRIMARY KEY,
            bemerkung      TEXT NOT NULL DEFAULT '',
            verbraucht_von INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
            erstellt_am    TEXT NOT NULL DEFAULT (datetime('now')),
            verbraucht_am  TEXT
        )
        SQL);

    adminKontoSicherstellen($db, $konfig);

    return $db;
}

/**
 * Das Admin-Konto aus der Konfiguration anlegen bzw. dessen Passwort-Hash
 * nachziehen. So setzt ein erneuter Lauf des Einrichtungs-Workflows das
 * Admin-Passwort neu, ohne die übrigen Konten anzufassen.
 */
function adminKontoSicherstellen(PDO $db, array $konfig): void
{
    $email = (string) $konfig['adminEmail'];
    $hash = (string) $konfig['adminPasswortHash'];
    if ($email === '' || $hash === '') {
        return;
    }

    $abfrage = $db->prepare('SELECT id, passwort_hash, rolle FROM benutzer WHERE email = ?');
    $abfrage->execute([$email]);
    $vorhanden = $abfrage->fetch();

    if ($vorhanden === false) {
        $db->prepare("INSERT INTO benutzer (email, name, passwort_hash, rolle) VALUES (?, 'Admin', ?, 'admin')")
            ->execute([$email, $hash]);

        return;
    }
    if ($vorhanden['passwort_hash'] !== $hash || $vorhanden['rolle'] !== 'admin') {
        $db->prepare("UPDATE benutzer SET passwort_hash = ?, rolle = 'admin', aktiv = 1,
                      fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?")
            ->execute([$hash, (int) $vorhanden['id']]);
    }
}

/** Sitzung mit strengen Cookie-Regeln starten. */
function sitzungStarten(array $konfig): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('sbfkurs_sitzung');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== ''),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Inaktivitätsablauf: nach so vielen Stunden ohne Anfrage ist die
    // Anmeldung weg, der Prüfungslauf bleibt serverseitig gespeichert.
    $jetzt = time();
    $grenze = (int) $konfig['sitzungStunden'] * 3600;
    if (isset($_SESSION['zuletzt']) && $grenze > 0 && $jetzt - (int) $_SESSION['zuletzt'] > $grenze) {
        session_unset();
    }
    $_SESSION['zuletzt'] = $jetzt;
}
