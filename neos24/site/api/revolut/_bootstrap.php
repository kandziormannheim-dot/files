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

if (PHP_SAPI !== 'cli') {
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
function begrenzungPruefen(string $bereich): bool
{
    $konfig = konfig();
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
    if (count($zeiten) >= (int) $konfig['limit']['anfragen']) {
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

    return $db;
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

function preisliste(): array
{
    static $preise = null;
    $preise ??= require __DIR__ . '/preise.php';

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
    if (!isset($p['laender'][$land]) || !isset($p['gewichtsklassen'][$gewichtsklasse])) {
        return null;
    }
    $netto = (int) $p['laender'][$land]['netto'];
    $brutto = bruttoCent($netto);

    return ['netto' => $netto, 'mwst' => $brutto - $netto, 'brutto' => $brutto, 'waehrung' => (string) $p['waehrung']];
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
