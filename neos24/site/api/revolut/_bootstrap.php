<?php

/**
 * Gemeinsamer Unterbau der Revolut-Endpunkte (Privatkunden-Checkout).
 *
 * Wird von angebot.php, bestellung.php, status.php, webhook.php und dem
 * CLI-Skript webhook-einrichten.php eingebunden. Enthält: JSON-Antworten,
 * Konfiguration, SQLite-Zugriff, Herkunftsprüfung, Missbrauchsbremse, den
 * HTTP-Client zur Revolut Merchant API, Preisrechnung, Statuspflege und
 * Mailversand.
 *
 * Konfiguration mit Geheimnissen liegt NICHT im Webroot, sondern eine Ebene
 * darüber (siehe NEOS_KONFIG_PFAD, Vorlage: neos24-config.beispiel.php).
 * Muster wie bei site/public/api/kontakt.php und womo/.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli' && !defined('NEOS_INTERN')) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

const ZEILE = "\r\n";

/** Webroot ist neos24/site; die Konfiguration liegt eine Ebene darüber. */
const NEOS_WEBROOT = __DIR__ . '/../..';
const NEOS_KONFIG_PFAD = NEOS_WEBROOT . '/../neos24-config.php';

/** Antwort schreiben und beenden. */
function antworten(int $status, array $inhalt): never
{
    http_response_code($status);
    echo json_encode($inhalt, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------------------------------------------------------------- Konfiguration

function konfig(): array
{
    static $konfig = null;
    if ($konfig !== null) {
        return $konfig;
    }

    $pfad = getenv('NEOS_KONFIG') ?: NEOS_KONFIG_PFAD;
    $eigene = is_file($pfad) ? require $pfad : null;

    $standard = [
        'revolut' => [
            'modus' => 'sandbox',            // 'sandbox' oder 'prod'
            'geheimerSchluessel' => '',      // Merchant API Secret Key (sk_…)
            'webhookSchluessel' => '',       // Signing Secret des Webhooks (wsk_…)
            'apiVersion' => '2024-09-01',    // Revolut-Api-Version — gegen aktuelle Doku prüfen
            'basis' => [
                'sandbox' => 'https://sandbox-merchant.revolut.com',
                'prod' => 'https://merchant.revolut.com',
            ],
            'zeitlimit' => 15,
            'zeitstempelToleranz' => 300,    // Sekunden, Webhook-Zeitstempel
        ],
        'daten' => NEOS_WEBROOT . '/../neos24-daten',
        'mwstSatz' => 19,                   // Prozent, Privatkundenpreise inklusive
        'intern' => [                       // Internes Dashboard (site/intern/)
            'sitzungsdauer' => 28800,       // Sekunden ohne Aktivität, bis die Anmeldung verfällt
            'anmeldung' => ['versuche' => 5, 'sperre' => 900, 'jeIp' => 30], // Fehlversuche je Konto, Sperre in Sekunden, Versuche je IP und Stunde
        ],
        'basisUrl' => '',
        'absender' => '',
        'absenderName' => 'NEOS',
        'kopie' => '',
        'transport' => '',                  // 'smtp', 'mail' oder '' (nur Protokoll)
        'smtp' => [
            'host' => '', 'port' => 587, 'benutzer' => '', 'passwort' => '',
            'verschluesselung' => 'starttls', 'zeitlimit' => 15,
        ],
        'erlaubteHerkunft' => [],
        'limit' => ['anfragen' => 10, 'fenster' => 3600],
        'salz' => '',
    ];

    $konfig = is_array($eigene) ? array_replace_recursive($standard, $eigene) : $standard;
    $konfig['revolut']['modus'] = $konfig['revolut']['modus'] === 'prod' ? 'prod' : 'sandbox';

    return $konfig;
}

/** Ist die Zahlung eingerichtet (Secret Key vorhanden)? */
function zahlungBereit(): bool
{
    return (string) konfig()['revolut']['geheimerSchluessel'] !== '';
}

function jetzt(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

// ------------------------------------------------------------------- Herkunft

/**
 * Stammt die Anfrage von der Seite selbst? Verglichen wird gegen den eigenen
 * Host; die Liste deckt nur zusätzliche Namen (www / nackte Domain) ab.
 */
function herkunftErlaubt(string $herkunft, array $erlaubte): bool
{
    if ($herkunft === '' || $herkunft === 'null') {
        return $herkunft === ''; // Kein Kopf: etwa curl. Erlaubt.
    }
    if (in_array($herkunft, $erlaubte, true)) {
        return true;
    }
    $teile = parse_url($herkunft);
    if (!is_array($teile) || !isset($teile['host'])) {
        return false;
    }
    $autoritaet = $teile['host'] . (isset($teile['port']) ? ':' . $teile['port'] : '');

    return strcasecmp($autoritaet, (string) ($_SERVER['HTTP_HOST'] ?? '')) === 0;
}

/** Nur POST von der eigenen Seite; OPTIONS für Preflight beantworten. */
function nurEigenePost(): void
{
    $herkunft = $_SERVER['HTTP_ORIGIN'] ?? '';
    $methode = $_SERVER['REQUEST_METHOD'] ?? '';
    $erlaubte = konfig()['erlaubteHerkunft'];

    if ($methode === 'OPTIONS') {
        if ($herkunft !== '' && herkunftErlaubt($herkunft, $erlaubte)) {
            header('Access-Control-Allow-Origin: ' . $herkunft);
            header('Access-Control-Allow-Methods: POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type');
            header('Access-Control-Max-Age: 86400');
            header('Vary: Origin');
        }
        antworten(204, []);
    }
    if ($methode !== 'POST') {
        header('Allow: POST, OPTIONS');
        antworten(405, ['ok' => false, 'fehler' => 'methode']);
    }
    if (!herkunftErlaubt($herkunft, $erlaubte)) {
        antworten(403, ['ok' => false, 'fehler' => 'herkunft']);
    }
    if ($herkunft !== '') {
        header('Access-Control-Allow-Origin: ' . $herkunft);
        header('Vary: Origin');
    }
}

/** JSON-Körper lesen (max. 64 KiB). */
function eingabeLesen(): array
{
    $roh = file_get_contents('php://input', false, null, 0, 64 * 1024);
    $daten = json_decode((string) $roh, true);
    if (!is_array($daten)) {
        antworten(400, ['ok' => false, 'fehler' => 'format']);
    }

    return $daten;
}

/** Steuerzeichen raus, Whitespace trimmen. */
function saeubern(mixed $wert, int $max = 200): string
{
    if (!is_string($wert)) {
        return '';
    }
    $wert = str_replace(["\r\n", "\r"], "\n", $wert);
    $wert = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $wert) ?? '';

    return mb_substr(trim($wert), 0, $max);
}

// ------------------------------------------------------------------ Begrenzung

/**
 * Zählung je Absender im Datenverzeichnis. IP nur als Streuwert mit täglich
 * wechselndem Salz — bremst Missbrauch, verfolgt niemanden.
 */
function begrenzungPruefen(string $bereich, ?int $maxAnfragen = null): bool
{
    $konfig = konfig();
    $maxAnfragen ??= (int) $konfig['limit']['anfragen'];
    $spool = rtrim((string) $konfig['daten'], '/') . '/spool';
    if (!is_dir($spool) && !@mkdir($spool, 0770, true) && !is_dir($spool)) {
        error_log('[revolut] Spool-Verzeichnis nicht anlegbar: ' . $spool);

        return true;
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') {
        return true;
    }
    $schluessel = hash('sha256', $bereich . '|' . $ip . '|' . gmdate('Y-m-d') . '|' . (string) $konfig['salz']);
    $datei = $spool . '/' . $schluessel . '.json';
    $jetzt = time();
    $fenster = (int) $konfig['limit']['fenster'];

    if (random_int(1, 50) === 1) {
        foreach (glob($spool . '/*.json') ?: [] as $alt) {
            if (@filemtime($alt) < $jetzt - max($fenster, 86400)) {
                @unlink($alt);
            }
        }
    }
    $zeiten = [];
    if (is_file($datei)) {
        $inhalt = json_decode((string) @file_get_contents($datei), true);
        if (is_array($inhalt)) {
            $zeiten = array_filter($inhalt, static fn ($z): bool => is_int($z) && $z > $jetzt - $fenster);
        }
    }
    if (count($zeiten) >= $maxAnfragen) {
        return false;
    }
    $zeiten[] = $jetzt;
    @file_put_contents($datei, json_encode(array_values($zeiten)), LOCK_EX);

    return true;
}

// ------------------------------------------------------------------- Datenbank

function datenbank(): PDO
{
    static $db = null;
    if ($db instanceof PDO) {
        return $db;
    }
    $verzeichnis = rtrim((string) konfig()['daten'], '/');
    if (!is_dir($verzeichnis) && !@mkdir($verzeichnis, 0770, true) && !is_dir($verzeichnis)) {
        throw new RuntimeException('Datenverzeichnis nicht anlegbar: ' . $verzeichnis);
    }
    $db = new PDO('sqlite:' . $verzeichnis . '/bestellungen.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA busy_timeout=5000');
    $db->exec('PRAGMA foreign_keys=ON');
    schemaAnlegen($db);

    return $db;
}

/**
 * Schema: Bestellungen des Checkouts plus die Tabellen des internen
 * Dashboards (Preise/Routing, Anfragen, Benutzer/Rollen, Protokoll).
 * Alles CREATE TABLE IF NOT EXISTS; nachträgliche Spalten per table_info.
 */
function schemaAnlegen(PDO $db): void
{
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS bestellungen (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            ext_ref        TEXT NOT NULL UNIQUE,
            revolut_id     TEXT UNIQUE,
            status         TEXT NOT NULL DEFAULT 'offen',
            netto_cent     INTEGER NOT NULL,
            mwst_cent      INTEGER NOT NULL,
            betrag_cent    INTEGER NOT NULL,
            waehrung       TEXT NOT NULL DEFAULT 'EUR',
            zielland       TEXT NOT NULL,
            gewichtsklasse TEXT NOT NULL,
            email          TEXT NOT NULL,
            sprache        TEXT NOT NULL DEFAULT 'de',
            absender_json  TEXT NOT NULL,
            empfaenger_json TEXT NOT NULL,
            ereignisse_json TEXT NOT NULL DEFAULT '[]',
            erstellt       TEXT NOT NULL,
            aktualisiert   TEXT NOT NULL,
            bezahlt        TEXT
        )
    SQL);
    $db->exec('CREATE INDEX IF NOT EXISTS bestellungen_status ON bestellungen (status, erstellt)');

    // Nachträgliche Spalten (CREATE TABLE IF NOT EXISTS greift dann nicht mehr).
    $spalten = array_column($db->query('PRAGMA table_info(bestellungen)')->fetchAll(), 'name');
    if (!in_array('carrier', $spalten, true)) {
        $db->exec('ALTER TABLE bestellungen ADD COLUMN carrier TEXT');
    }
    if (!in_array('einkauf_cent', $spalten, true)) {
        $db->exec('ALTER TABLE bestellungen ADD COLUMN einkauf_cent INTEGER NOT NULL DEFAULT 0');
    }

    // Preise & Zielländer, Routingmatrix
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS laender (
            code       TEXT PRIMARY KEY,
            name_de    TEXT NOT NULL,
            name_en    TEXT NOT NULL,
            aktiv      INTEGER NOT NULL DEFAULT 1,
            sortierung INTEGER NOT NULL DEFAULT 100
        );
        CREATE TABLE IF NOT EXISTS gewichtsklassen (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            code       TEXT NOT NULL UNIQUE,
            name_de    TEXT NOT NULL,
            name_en    TEXT NOT NULL,
            max_gramm  INTEGER NOT NULL DEFAULT 0,
            aktiv      INTEGER NOT NULL DEFAULT 1,
            sortierung INTEGER NOT NULL DEFAULT 100
        );
        CREATE TABLE IF NOT EXISTS carrier (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT NOT NULL UNIQUE,
            aktiv INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS routing (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            land_code         TEXT NOT NULL REFERENCES laender(code),
            gewichtsklasse_id INTEGER NOT NULL REFERENCES gewichtsklassen(id),
            carrier_id        INTEGER NOT NULL REFERENCES carrier(id),
            prioritaet        INTEGER NOT NULL,
            laufzeit_de       TEXT NOT NULL DEFAULT '',
            laufzeit_en       TEXT NOT NULL DEFAULT '',
            einkauf_cent      INTEGER NOT NULL DEFAULT 0,
            verkauf_cent      INTEGER NOT NULL DEFAULT 0,
            aktiv             INTEGER NOT NULL DEFAULT 1,
            aktualisiert      TEXT NOT NULL,
            aktualisiert_von  TEXT NOT NULL DEFAULT '',
            UNIQUE (land_code, gewichtsklasse_id, prioritaet)
        );
    SQL);

    // Kunden & Anfragen (Kontaktformular)
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS anfragen (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            art           TEXT NOT NULL DEFAULT 'business',
            name          TEXT NOT NULL,
            firma         TEXT NOT NULL DEFAULT '',
            email         TEXT NOT NULL,
            volumen       TEXT NOT NULL DEFAULT '',
            nachricht     TEXT NOT NULL DEFAULT '',
            sprache       TEXT NOT NULL DEFAULT 'de',
            status        TEXT NOT NULL DEFAULT 'neu',
            notiz         TEXT NOT NULL DEFAULT '',
            bearbeiter_id INTEGER,
            erstellt      TEXT NOT NULL,
            aktualisiert  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS anfragen_status ON anfragen (status, erstellt);
    SQL);

    // Benutzer, Rollen, Rechte, Protokoll
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS rollen (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL UNIQUE,
            beschreibung TEXT NOT NULL DEFAULT '',
            system       INTEGER NOT NULL DEFAULT 0,
            erstellt     TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rechte (
            rolle_id   INTEGER NOT NULL REFERENCES rollen(id) ON DELETE CASCADE,
            modul      TEXT NOT NULL,
            sehen      INTEGER NOT NULL DEFAULT 0,
            bearbeiten INTEGER NOT NULL DEFAULT 0,
            loeschen   INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (rolle_id, modul)
        );
        CREATE TABLE IF NOT EXISTS benutzer (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            email                 TEXT NOT NULL UNIQUE,
            name                  TEXT NOT NULL,
            passwort_hash         TEXT NOT NULL,
            rolle_id              INTEGER NOT NULL REFERENCES rollen(id),
            aktiv                 INTEGER NOT NULL DEFAULT 1,
            muss_passwort_aendern INTEGER NOT NULL DEFAULT 0,
            fehlversuche          INTEGER NOT NULL DEFAULT 0,
            gesperrt_bis          TEXT,
            letzte_anmeldung      TEXT,
            erstellt              TEXT NOT NULL,
            aktualisiert          TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS protokoll (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            benutzer_id   INTEGER,
            benutzer_name TEXT NOT NULL DEFAULT '',
            aktion        TEXT NOT NULL,
            objekt        TEXT NOT NULL DEFAULT '',
            objekt_id     TEXT NOT NULL DEFAULT '',
            details_json  TEXT NOT NULL DEFAULT '{}',
            zeit          TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS protokoll_zeit ON protokoll (zeit);
    SQL);

    preiseSaeen($db);
}

/**
 * Einmaliges Saatgut: Solange keine Länder angelegt sind, werden Länder,
 * Gewichtsklasse, Carrier und Routing-Zeilen aus preise.php übernommen.
 * Danach ist die Datenbank (Dashboard → Routingmatrix) die einzige Quelle.
 */
function preiseSaeen(PDO $db): void
{
    if ((int) $db->query('SELECT COUNT(*) FROM laender')->fetchColumn() > 0) {
        return;
    }
    $saat = require __DIR__ . '/preise.php';
    $jetzt = jetzt();
    $db->beginTransaction();
    try {
        $gkIds = [];
        $sort = 10;
        foreach ($saat['gewichtsklassen'] as $code => $gk) {
            $db->prepare('INSERT INTO gewichtsklassen (code, name_de, name_en, max_gramm, aktiv, sortierung) VALUES (?, ?, ?, ?, 1, ?)')
               ->execute([$code, $gk['de'], $gk['en'], $gk['max_gramm'] ?? 0, $sort]);
            $gkIds[$code] = (int) $db->lastInsertId();
            $sort += 10;
        }
        $carrierIds = [];
        $carrierId = static function (string $name) use ($db, &$carrierIds): int {
            if (!isset($carrierIds[$name])) {
                $db->prepare('INSERT INTO carrier (name, aktiv) VALUES (?, 1)')->execute([$name]);
                $carrierIds[$name] = (int) $db->lastInsertId();
            }

            return $carrierIds[$name];
        };
        $sort = 10;
        foreach ($saat['laender'] as $code => $land) {
            $db->prepare('INSERT INTO laender (code, name_de, name_en, aktiv, sortierung) VALUES (?, ?, ?, 1, ?)')
               ->execute([$code, $land['name']['de'], $land['name']['en'], $sort]);
            $sort += 10;
            $namen = array_values(array_filter(array_map('trim', explode(',', (string) $land['carrier']))));
            foreach ($gkIds as $gkId) {
                foreach (array_slice($namen, 0, 3) as $i => $name) {
                    $db->prepare(<<<'SQL'
                        INSERT INTO routing (land_code, gewichtsklasse_id, carrier_id, prioritaet, laufzeit_de, laufzeit_en,
                                             einkauf_cent, verkauf_cent, aktiv, aktualisiert, aktualisiert_von)
                        VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?, 'saatgut')
                    SQL)->execute([$code, $gkId, $carrierId($name), $i + 1, $land['laufzeit']['de'], $land['laufzeit']['en'], (int) $land['netto'], $jetzt]);
                }
            }
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}

function bestellungLaden(string $spalte, string $wert): ?array
{
    if (!in_array($spalte, ['ext_ref', 'revolut_id'], true)) {
        throw new InvalidArgumentException('Unbekannte Spalte');
    }
    $st = datenbank()->prepare("SELECT * FROM bestellungen WHERE $spalte = :w LIMIT 1");
    $st->execute([':w' => $wert]);
    $zeile = $st->fetch();

    return is_array($zeile) ? $zeile : null;
}

/**
 * Status setzen, Ereignis anhängen. Bei erstmaligem Übergang auf „bezahlt“
 * wird nachBezahlung() angestoßen (Mail + Label-Auftrag). Idempotent: ein
 * zweites ORDER_COMPLETED löst nichts erneut aus.
 */
function bestellungFortschreiben(array $bestellung, string $status, string $ereignis, array $details = []): array
{
    $ereignisse = json_decode((string) $bestellung['ereignisse_json'], true);
    $ereignisse = is_array($ereignisse) ? $ereignisse : [];
    $ereignisse[] = ['zeit' => jetzt(), 'ereignis' => $ereignis, 'status' => $status] + $details;

    $warBezahlt = $bestellung['status'] === 'bezahlt';
    // Ein endgültiger Status wird nicht mehr durch einen früheren überschrieben.
    $rang = ['offen' => 0, 'angelegt' => 1, 'autorisiert' => 2, 'bezahlt' => 3, 'fehlgeschlagen' => 3, 'storniert' => 3];
    $neuerStatus = ($rang[$status] ?? 0) >= ($rang[$bestellung['status']] ?? 0) ? $status : $bestellung['status'];

    $st = datenbank()->prepare(
        'UPDATE bestellungen SET status = :s, ereignisse_json = :e, aktualisiert = :a,
            bezahlt = COALESCE(bezahlt, :b) WHERE id = :id'
    );
    $st->execute([
        ':s' => $neuerStatus,
        ':e' => json_encode($ereignisse, JSON_UNESCAPED_UNICODE),
        ':a' => jetzt(),
        ':b' => $neuerStatus === 'bezahlt' ? jetzt() : null,
        ':id' => $bestellung['id'],
    ]);
    $bestellung = bestellungLaden('ext_ref', (string) $bestellung['ext_ref']) ?? $bestellung;

    if (!$warBezahlt && $bestellung['status'] === 'bezahlt') {
        nachBezahlung($bestellung);
    }

    return $bestellung;
}

// ---------------------------------------------------------------------- Preise

/**
 * Preisliste aus der Datenbank (Dashboard → Preise & Zielländer, Routingmatrix).
 *
 * Form je Land: name{de,en}, klassen[gkCode] = {carrier, fallback[], laufzeit{de,en},
 * netto, einkauf}, dazu carrier/laufzeit/netto der ersten (kleinsten) aktiven
 * Gewichtsklasse als „ab“-Wert für Tabelle und Formular. Gezeigt wird je Zelle
 * der aktive Carrier mit der niedrigsten Priorität; die weiteren sind Fallback.
 */
function preisliste(): array
{
    static $preise = null;
    if ($preise !== null) {
        return $preise;
    }
    $db = datenbank();
    $klassen = [];
    foreach ($db->query('SELECT * FROM gewichtsklassen WHERE aktiv = 1 ORDER BY sortierung, id') as $gk) {
        $klassen[$gk['code']] = ['de' => $gk['name_de'], 'en' => $gk['name_en'], 'id' => (int) $gk['id'], 'max_gramm' => (int) $gk['max_gramm']];
    }
    $laender = [];
    $zeilen = $db->query(<<<'SQL'
        SELECT l.code, l.name_de, l.name_en, g.code AS gk, c.name AS carrier,
               r.laufzeit_de, r.laufzeit_en, r.verkauf_cent, r.einkauf_cent, r.prioritaet
        FROM routing r
        JOIN laender l ON l.code = r.land_code
        JOIN gewichtsklassen g ON g.id = r.gewichtsklasse_id
        JOIN carrier c ON c.id = r.carrier_id
        WHERE r.aktiv = 1 AND l.aktiv = 1 AND g.aktiv = 1 AND c.aktiv = 1
        ORDER BY l.sortierung, l.code, g.sortierung, g.id, r.prioritaet
    SQL);
    foreach ($zeilen as $z) {
        $code = (string) $z['code'];
        $laender[$code] ??= ['name' => ['de' => $z['name_de'], 'en' => $z['name_en']], 'carrier' => '', 'laufzeit' => ['de' => '', 'en' => ''], 'netto' => 0, 'klassen' => []];
        if (!isset($laender[$code]['klassen'][$z['gk']])) {
            $laender[$code]['klassen'][$z['gk']] = [
                'carrier' => (string) $z['carrier'],
                'fallback' => [],
                'laufzeit' => ['de' => (string) $z['laufzeit_de'], 'en' => (string) $z['laufzeit_en']],
                'netto' => (int) $z['verkauf_cent'],
                'einkauf' => (int) $z['einkauf_cent'],
            ];
        } else {
            $laender[$code]['klassen'][$z['gk']]['fallback'][] = (string) $z['carrier'];
        }
    }
    foreach ($laender as $code => $land) {
        foreach ($klassen as $gkCode => $_) {
            if (isset($land['klassen'][$gkCode])) {
                $erste = $land['klassen'][$gkCode];
                $laender[$code]['carrier'] = $erste['carrier'];
                $laender[$code]['laufzeit'] = $erste['laufzeit'];
                $laender[$code]['netto'] = $erste['netto'];
                break;
            }
        }
    }
    $preise = [
        'waehrung' => 'EUR',
        'mwstSatz' => (int) konfig()['mwstSatz'],
        'gewichtsklassen' => $klassen,
        'laender' => $laender,
    ];

    return $preise;
}

/** Brutto aus Netto, kaufmännisch auf den Cent gerundet. */
function bruttoCent(int $nettoCent): int
{
    return (int) round($nettoCent * (100 + (int) preisliste()['mwstSatz']) / 100);
}

/** Preis für Zielland und Gewichtsklasse, oder null wenn nicht angeboten. */
function preisFuer(string $land, string $gewichtsklasse): ?array
{
    $p = preisliste();
    $zelle = $p['laender'][$land]['klassen'][$gewichtsklasse] ?? null;
    if ($zelle === null || !isset($p['gewichtsklassen'][$gewichtsklasse])) {
        return null;
    }
    $netto = (int) $zelle['netto'];
    $brutto = bruttoCent($netto);

    return [
        'netto' => $netto,
        'mwst' => $brutto - $netto,
        'brutto' => $brutto,
        'waehrung' => (string) $p['waehrung'],
        'carrier' => (string) $zelle['carrier'],
        'einkauf' => (int) $zelle['einkauf'],
    ];
}

// --------------------------------------------------------------- Revolut-Client

/**
 * Aufruf der Merchant API. Gibt ['status' => HTTP-Code, 'daten' => Array]
 * zurück; Transportfehler werfen eine RuntimeException.
 */
function revolutAnfrage(string $methode, string $pfad, ?array $koerper = null): array
{
    $r = konfig()['revolut'];
    $url = rtrim((string) $r['basis'][$r['modus']], '/') . $pfad;
    $kopf = [
        'Authorization: Bearer ' . $r['geheimerSchluessel'],
        'Revolut-Api-Version: ' . $r['apiVersion'],
        'Accept: application/json',
    ];
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('curl_init fehlgeschlagen');
    }
    $optionen = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $methode,
        CURLOPT_TIMEOUT => (int) $r['zeitlimit'],
        CURLOPT_CONNECTTIMEOUT => 10,
    ];
    if ($koerper !== null) {
        $kopf[] = 'Content-Type: application/json';
        $optionen[CURLOPT_POSTFIELDS] = json_encode($koerper, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    $optionen[CURLOPT_HTTPHEADER] = $kopf;
    curl_setopt_array($ch, $optionen);
    $antwort = curl_exec($ch);
    if ($antwort === false) {
        $fehler = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Revolut nicht erreichbar: ' . $fehler);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $daten = json_decode((string) $antwort, true);

    return ['status' => $status, 'daten' => is_array($daten) ? $daten : []];
}

/** Revolut-Bestellstatus auf unsere Statuswerte abbilden. */
function statusAusRevolut(string $state): ?string
{
    return match (strtolower($state)) {
        'pending', 'processing' => 'angelegt',
        'authorised', 'authorized' => 'autorisiert',
        'completed' => 'bezahlt',
        'cancelled', 'canceled' => 'storniert',
        'failed' => 'fehlgeschlagen',
        default => null,
    };
}

/** Modus, den der Browser für embed.js braucht ('sandbox' | 'prod'). */
function checkoutModus(): string
{
    return konfig()['revolut']['modus'];
}

// ------------------------------------------------------------- Nach der Zahlung

/**
 * Läuft genau einmal je Bestellung, sobald sie bezahlt ist: Bestätigung an
 * den Kunden, Kopie an das Postfach, Label-Auftrag vermerken.
 *
 * HIER HAKT SPÄTER DIE CARRIER-ANBINDUNG EIN: labelBeauftragen() legt heute
 * nur einen Auftrag in ereignisse_json ab. Sobald eine Label-API existiert,
 * wird dort das Label erzeugt und als PDF/QR an den Kunden geschickt.
 */
function nachBezahlung(array $bestellung): void
{
    try {
        labelBeauftragen($bestellung);
    } catch (Throwable $e) {
        error_log('[revolut] Label-Auftrag fehlgeschlagen: ' . $e->getMessage());
    }
    try {
        bestaetigungSenden($bestellung);
    } catch (Throwable $e) {
        error_log('[revolut] Bestätigungsmail fehlgeschlagen: ' . $e->getMessage());
    }
}

function labelBeauftragen(array $bestellung): void
{
    $ereignisse = json_decode((string) $bestellung['ereignisse_json'], true) ?: [];
    $ereignisse[] = ['zeit' => jetzt(), 'ereignis' => 'label.beauftragt', 'status' => $bestellung['status'], 'hinweis' => 'Carrier-Anbindung folgt'];
    $st = datenbank()->prepare('UPDATE bestellungen SET ereignisse_json = :e, aktualisiert = :a WHERE id = :id');
    $st->execute([':e' => json_encode($ereignisse, JSON_UNESCAPED_UNICODE), ':a' => jetzt(), ':id' => $bestellung['id']]);
}

function betragFormat(int $cent, string $sprache): string
{
    $zahl = number_format($cent / 100, 2, $sprache === 'de' ? ',' : '.', $sprache === 'de' ? '.' : ',');

    return '€' . $zahl;
}

function bestaetigungSenden(array $bestellung): void
{
    $konfig = konfig();
    $sprache = $bestellung['sprache'] === 'en' ? 'en' : 'de';
    $land = preisliste()['laender'][$bestellung['zielland']]['name'][$sprache] ?? $bestellung['zielland'];
    $empfaenger = json_decode((string) $bestellung['empfaenger_json'], true) ?: [];
    $absender = json_decode((string) $bestellung['absender_json'], true) ?: [];

    if ($sprache === 'de') {
        $betreff = 'Deine NEOS-Bestellung ' . $bestellung['ext_ref'] . ' ist bezahlt';
        $koerper = implode("\n", [
            'Hallo ' . ($absender['name'] ?? '') . ',',
            '',
            'danke — deine Zahlung ist bei uns angekommen.',
            '',
            'Bestellung:  ' . $bestellung['ext_ref'],
            'Zielland:    ' . $land,
            'Empfänger:   ' . ($empfaenger['name'] ?? '') . ', ' . ($empfaenger['strasse'] ?? '') . ', ' . ($empfaenger['plz'] ?? '') . ' ' . ($empfaenger['ort'] ?? ''),
            'Betrag:      ' . betragFormat((int) $bestellung['betrag_cent'], 'de') . ' inkl. ' . preisliste()['mwstSatz'] . ' % MwSt.',
            '',
            'Dein Versandlabel bekommst du in einer zweiten E-Mail, sobald es erzeugt ist.',
            '',
            'NEOS Logistics UG · info@neos24.com',
        ]);
    } else {
        $betreff = 'Your NEOS order ' . $bestellung['ext_ref'] . ' is paid';
        $koerper = implode("\n", [
            'Hello ' . ($absender['name'] ?? '') . ',',
            '',
            'thank you — your payment has arrived.',
            '',
            'Order:       ' . $bestellung['ext_ref'],
            'Destination: ' . $land,
            'Recipient:   ' . ($empfaenger['name'] ?? '') . ', ' . ($empfaenger['strasse'] ?? '') . ', ' . ($empfaenger['plz'] ?? '') . ' ' . ($empfaenger['ort'] ?? ''),
            'Amount:      ' . betragFormat((int) $bestellung['betrag_cent'], 'en') . ' incl. ' . preisliste()['mwstSatz'] . '% VAT',
            '',
            'Your shipping label follows in a second email as soon as it is generated.',
            '',
            'NEOS Logistics UG · info@neos24.com',
        ]);
    }

    mailSenden((string) $bestellung['email'], $betreff, $koerper);
    if ((string) $konfig['kopie'] !== '') {
        mailSenden((string) $konfig['kopie'], '[Kopie] ' . $betreff, $koerper);
    }
}

// ------------------------------------------------------------------------ Mail

function kopfKodieren(string $wert): string
{
    return preg_match('/^[\x20-\x7E]*$/', $wert) === 1 ? $wert : '=?UTF-8?B?' . base64_encode($wert) . '?=';
}

function mailSenden(string $an, string $betreff, string $koerper): void
{
    $konfig = konfig();
    $transport = (string) $konfig['transport'];
    if ($transport === '' || (string) $konfig['absender'] === '') {
        error_log('[revolut] Mail (kein Transport) an ' . $an . ': ' . $betreff);

        return;
    }
    $domaene = substr(strrchr((string) $konfig['absender'], '@') ?: '@neos24.com', 1);
    $kopf = [
        'From: ' . kopfKodieren((string) $konfig['absenderName']) . ' <' . $konfig['absender'] . '>',
        'To: <' . $an . '>',
        'Subject: ' . kopfKodieren($betreff),
        'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domaene . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        'Auto-Submitted: auto-generated',
    ];
    $rohmail = implode(ZEILE, $kopf) . ZEILE . ZEILE . chunk_split(base64_encode($koerper), 76, ZEILE);

    if ($transport === 'mail') {
        $rest = array_filter($kopf, static fn (string $z): bool => !str_starts_with($z, 'Subject: ') && !str_starts_with($z, 'To: '));
        if (!mail($an, kopfKodieren($betreff), chunk_split(base64_encode($koerper), 76, ZEILE), implode(ZEILE, $rest))) {
            throw new RuntimeException('mail() lehnte die Nachricht ab');
        }

        return;
    }
    perSmtpSenden($konfig, (string) $konfig['absender'], $an, $rohmail);
}

function smtpLesen($verbindung, array $erwartet, string $schritt): void
{
    $antwort = '';
    while (($zeile = fgets($verbindung, 8192)) !== false) {
        $antwort .= $zeile;
        if (strlen($zeile) < 4 || $zeile[3] !== '-') {
            break;
        }
    }
    if ($antwort === '') {
        throw new RuntimeException($schritt . ': keine Antwort');
    }
    if (!in_array((int) substr($antwort, 0, 3), $erwartet, true)) {
        throw new RuntimeException($schritt . ': ' . trim($antwort));
    }
}

function smtpSchreiben($verbindung, string $befehl): void
{
    if (fwrite($verbindung, $befehl . ZEILE) === false) {
        throw new RuntimeException('Schreiben fehlgeschlagen');
    }
}

function perSmtpSenden(array $konfig, string $von, string $an, string $rohmail): void
{
    $s = $konfig['smtp'];
    $zeitlimit = (int) ($s['zeitlimit'] ?? 15);
    $schema = ($s['verschluesselung'] ?? 'starttls') === 'tls' ? 'ssl://' : 'tcp://';
    $verbindung = @stream_socket_client($schema . $s['host'] . ':' . (int) $s['port'], $nummer, $meldung, $zeitlimit, STREAM_CLIENT_CONNECT);
    if ($verbindung === false) {
        throw new RuntimeException('Verbindung: ' . $meldung);
    }
    stream_set_timeout($verbindung, $zeitlimit);
    try {
        smtpLesen($verbindung, [220], 'Begrüßung');
        smtpSchreiben($verbindung, 'EHLO ' . gethostname());
        smtpLesen($verbindung, [250], 'EHLO');
        if (($s['verschluesselung'] ?? 'starttls') === 'starttls') {
            smtpSchreiben($verbindung, 'STARTTLS');
            smtpLesen($verbindung, [220], 'STARTTLS');
            if (!stream_socket_enable_crypto($verbindung, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('TLS-Aufbau fehlgeschlagen');
            }
            smtpSchreiben($verbindung, 'EHLO ' . gethostname());
            smtpLesen($verbindung, [250], 'EHLO nach TLS');
        }
        if (($s['benutzer'] ?? '') !== '') {
            smtpSchreiben($verbindung, 'AUTH PLAIN ' . base64_encode("\0" . $s['benutzer'] . "\0" . $s['passwort']));
            smtpLesen($verbindung, [235], 'Anmeldung');
        }
        smtpSchreiben($verbindung, 'MAIL FROM:<' . $von . '>');
        smtpLesen($verbindung, [250], 'MAIL FROM');
        smtpSchreiben($verbindung, 'RCPT TO:<' . $an . '>');
        smtpLesen($verbindung, [250, 251], 'RCPT TO');
        smtpSchreiben($verbindung, 'DATA');
        smtpLesen($verbindung, [354], 'DATA');
        $sicher = preg_replace('/^\./m', '..', $rohmail) ?? $rohmail;
        smtpSchreiben($verbindung, $sicher . ZEILE . '.');
        smtpLesen($verbindung, [250], 'Übergabe');
        smtpSchreiben($verbindung, 'QUIT');
    } finally {
        fclose($verbindung);
    }
}
