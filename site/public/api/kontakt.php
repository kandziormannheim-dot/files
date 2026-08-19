<?php

/**
 * Endpunkt des Kontaktformulars.
 *
 * Nimmt die drei Felder des Formulars als JSON entgegen und schickt sie per
 * E-Mail an den Empfaenger. Kein Drittanbieter: die Anfrage verlaesst den
 * eigenen Server nur auf dem Weg zum Postfach. Genau das sagt die
 * Datenschutzerklaerung zu, und genau deshalb liegt hier ein eigenes Skript
 * statt einer eingebundenen Formular-Schnittstelle.
 *
 * Die Zugangsdaten stehen NICHT hier, sondern in einer Datei eine Ebene
 * oberhalb des Webroots (siehe $konfigPfad). Das hat zwei Gruende: der Deploy
 * ueberschreibt das Webroot mit --delete, und ein Passwort gehoert nicht in
 * ein oeffentliches Verzeichnis. Vorlage und Einrichtung: docs/kontakt/.
 *
 * Selbsttest ohne Absenden:
 *   curl https://kandzior.de/api/kontakt.php
 * Antwortet das mit JSON, laeuft PHP. Kommt Quelltext zurueck, fehlt die
 * PHP-Anbindung im Webserver — dann waere jede Anfrage still verloren.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const ZEILE = "\r\n";

/** Antwort schreiben und beenden. */
function antworten(int $status, array $inhalt): never
{
    http_response_code($status);
    echo json_encode($inhalt, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------------------------------------------------------------- Konfiguration

$konfigPfad = dirname(__DIR__, 2) . '/kontakt-config.php';
$konfig = is_file($konfigPfad) ? require $konfigPfad : null;

$standard = [
    'empfaenger' => '',
    'absender' => '',
    'absenderName' => 'kandzior.de',
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
    'spool' => dirname(__DIR__, 2) . '/spool',
    'limit' => ['anfragen' => 5, 'fenster' => 3600],
    'salz' => '',
];

$konfig = is_array($konfig) ? array_replace_recursive($standard, $konfig) : $standard;
$bereit = $konfig['empfaenger'] !== '' && $konfig['absender'] !== '';

// GET ist der Selbsttest: zeigt, dass PHP laeuft und ob eine Konfiguration
// gefunden wurde. Er verraet keinen einzigen Konfigurationswert.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    antworten(200, ['ok' => true, 'dienst' => 'kontakt', 'bereit' => $bereit]);
}

// ------------------------------------------------------------------- Herkunft

$herkunft = $_SERVER['HTTP_ORIGIN'] ?? '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    if ($herkunft !== '' && herkunftErlaubt($herkunft, $konfig['erlaubteHerkunft'])) {
        header('Access-Control-Allow-Origin: ' . $herkunft);
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
        header('Vary: Origin');
    }
    antworten(204, []);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: GET, POST, OPTIONS');
    antworten(405, ['ok' => false, 'fehler' => 'methode']);
}

/**
 * Stammt die Anfrage von der Seite selbst?
 *
 * Browser schicken bei POST IMMER einen Origin-Kopf, auch bei gleicher
 * Herkunft. Deshalb wird er gegen den eigenen Host geprueft statt gegen eine
 * Liste — sonst muesste die Konfiguration die eigene Adresse kennen, und ein
 * Tippfehler dort legte das Formular still lahm. Die Liste deckt nur noch den
 * Fall ab, dass die Seite unter mehreren Namen erreichbar ist (www und nackte
 * Domain).
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

if (!herkunftErlaubt($herkunft, $konfig['erlaubteHerkunft'])) {
    antworten(403, ['ok' => false, 'fehler' => 'herkunft']);
}
if ($herkunft !== '') {
    header('Access-Control-Allow-Origin: ' . $herkunft);
    header('Vary: Origin');
}

if (!$bereit) {
    error_log('[kontakt] Keine Konfiguration unter ' . $konfigPfad);
    antworten(503, ['ok' => false, 'fehler' => 'nicht-eingerichtet']);
}

// -------------------------------------------------------------------- Eingabe

$roh = file_get_contents('php://input', false, null, 0, 64 * 1024);
$daten = json_decode((string) $roh, true);

if (!is_array($daten)) {
    antworten(400, ['ok' => false, 'fehler' => 'format']);
}

/** Steuerzeichen raus — sie sind der Hebel fuer eingeschmuggelte Kopfzeilen. */
function saeubern(mixed $wert): string
{
    if (!is_string($wert)) {
        return '';
    }
    $wert = str_replace(["\r\n", "\r"], "\n", $wert);
    $wert = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $wert) ?? '';

    return trim($wert);
}

$name = saeubern($daten['name'] ?? '');
$email = saeubern($daten['email'] ?? '');
$nachricht = saeubern($daten['message'] ?? '');
$falle = saeubern($daten['company'] ?? '');

// Honigtopf gefuellt: still "Erfolg" melden. Ein Bot soll nichts lernen.
if ($falle !== '') {
    antworten(200, ['ok' => true]);
}

$einzeilig = static fn (string $s): bool => !str_contains($s, "\n");

$fehler = [];
if (mb_strlen($name) < 2 || mb_strlen($name) > 100 || !$einzeilig($name)) {
    $fehler[] = 'name';
}
if (
    mb_strlen($email) > 254
    || !$einzeilig($email)
    || filter_var($email, FILTER_VALIDATE_EMAIL) === false
) {
    $fehler[] = 'email';
}
if (mb_strlen($nachricht) < 10 || mb_strlen($nachricht) > 5000) {
    $fehler[] = 'message';
}

if ($fehler !== []) {
    antworten(422, ['ok' => false, 'fehler' => 'ungueltig', 'felder' => $fehler]);
}

// ------------------------------------------------------------------ Begrenzung

/**
 * Einfache Zaehlung je Absender. Die IP wird nur als Streuwert mit taeglich
 * wechselndem Salz abgelegt, nie im Klartext — sie soll Missbrauch bremsen,
 * nicht Besucher nachverfolgen.
 */
function begrenzungPruefen(array $konfig): bool
{
    $spool = (string) $konfig['spool'];
    if ($spool === '') {
        return true;
    }
    if (!is_dir($spool) && !@mkdir($spool, 0770, true) && !is_dir($spool)) {
        error_log('[kontakt] Spool-Verzeichnis nicht anlegbar: ' . $spool);

        return true; // Lieber senden als grundlos abweisen.
    }

    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') {
        return true;
    }

    $schluessel = hash('sha256', $ip . '|' . gmdate('Y-m-d') . '|' . (string) $konfig['salz']);
    $datei = $spool . '/' . $schluessel . '.json';
    $jetzt = time();
    $fenster = (int) $konfig['limit']['fenster'];

    // Gelegentlich aufraeumen, damit das Verzeichnis nicht unbegrenzt waechst.
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
            $zeiten = array_filter(
                $inhalt,
                static fn ($z): bool => is_int($z) && $z > $jetzt - $fenster
            );
        }
    }

    if (count($zeiten) >= (int) $konfig['limit']['anfragen']) {
        return false;
    }

    $zeiten[] = $jetzt;
    @file_put_contents($datei, json_encode(array_values($zeiten)), LOCK_EX);

    return true;
}

if (!begrenzungPruefen($konfig)) {
    header('Retry-After: ' . (string) (int) $konfig['limit']['fenster']);
    antworten(429, ['ok' => false, 'fehler' => 'zu-viele']);
}

// ------------------------------------------------------------------ Nachricht

/** Kopfzeilenwert nach RFC 2047 kodieren, wenn er nicht rein ASCII ist. */
function kopfKodieren(string $wert): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $wert) === 1) {
        return $wert;
    }

    return '=?UTF-8?B?' . base64_encode($wert) . '?=';
}

$domaene = substr(strrchr($konfig['absender'], '@') ?: '@kandzior.de', 1);

$betreff = 'Anfrage über kandzior.de – ' . $name;

$koerper = implode("\n", [
    'Neue Anfrage über das Kontaktformular auf kandzior.de.',
    '',
    'Name:    ' . $name,
    'E-Mail:  ' . $email,
    'Zeit:    ' . gmdate('d.m.Y H:i') . ' UTC',
    '',
    str_repeat('-', 60),
    '',
    $nachricht,
    '',
    str_repeat('-', 60),
    '',
    'Antworten geht direkt auf diese Mail — der Absender steht im Reply-To.',
    '',
]);

$kopf = [
    'From: ' . kopfKodieren((string) $konfig['absenderName']) . ' <' . $konfig['absender'] . '>',
    'To: <' . $konfig['empfaenger'] . '>',
    'Reply-To: ' . kopfKodieren($name) . ' <' . $email . '>',
    'Subject: ' . kopfKodieren($betreff),
    'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domaene . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    'Auto-Submitted: auto-generated',
];

$rohmail = implode(ZEILE, $kopf) . ZEILE . ZEILE
    . chunk_split(base64_encode($koerper), 76, ZEILE);

// -------------------------------------------------------------------- Versand

/** Eine SMTP-Antwort lesen; mehrzeilige Antworten werden zusammengefasst. */
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

function perSmtpSenden(array $konfig, string $rohmail): void
{
    $s = $konfig['smtp'];
    $zeitlimit = (int) ($s['zeitlimit'] ?? 15);
    $schema = ($s['verschluesselung'] ?? 'starttls') === 'tls' ? 'ssl://' : 'tcp://';

    $verbindung = @stream_socket_client(
        $schema . $s['host'] . ':' . (int) $s['port'],
        $nummer,
        $meldung,
        $zeitlimit,
        STREAM_CLIENT_CONNECT
    );
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
            if (!stream_socket_enable_crypto(
                $verbindung,
                true,
                STREAM_CRYPTO_METHOD_TLS_CLIENT
            )) {
                throw new RuntimeException('TLS-Aufbau fehlgeschlagen');
            }
            smtpSchreiben($verbindung, 'EHLO ' . gethostname());
            smtpLesen($verbindung, [250], 'EHLO nach TLS');
        }

        if (($s['benutzer'] ?? '') !== '') {
            smtpSchreiben($verbindung, 'AUTH PLAIN ' . base64_encode(
                "\0" . $s['benutzer'] . "\0" . $s['passwort']
            ));
            smtpLesen($verbindung, [235], 'Anmeldung');
        }

        smtpSchreiben($verbindung, 'MAIL FROM:<' . $konfig['absender'] . '>');
        smtpLesen($verbindung, [250], 'MAIL FROM');
        smtpSchreiben($verbindung, 'RCPT TO:<' . $konfig['empfaenger'] . '>');
        smtpLesen($verbindung, [250, 251], 'RCPT TO');
        smtpSchreiben($verbindung, 'DATA');
        smtpLesen($verbindung, [354], 'DATA');

        // Punkt am Zeilenanfang verdoppeln, sonst endet die Mail dort.
        $sicher = preg_replace('/^\./m', '..', $rohmail) ?? $rohmail;
        smtpSchreiben($verbindung, $sicher . ZEILE . '.');
        smtpLesen($verbindung, [250], 'Übergabe');

        smtpSchreiben($verbindung, 'QUIT');
    } finally {
        fclose($verbindung);
    }
}

function perMailFunktionSenden(array $konfig, string $rohmail): void
{
    // mail() will Betreff und Kopfzeilen getrennt — hier wird die fertige
    // Rohmail wieder aufgeteilt.
    [$kopfteil, $koerper] = explode(ZEILE . ZEILE, $rohmail, 2);
    $zeilen = explode(ZEILE, $kopfteil);
    $betreff = '';
    $rest = [];
    foreach ($zeilen as $zeile) {
        if (str_starts_with($zeile, 'Subject: ')) {
            $betreff = substr($zeile, 9);
        } elseif (str_starts_with($zeile, 'To: ')) {
            continue;
        } else {
            $rest[] = $zeile;
        }
    }
    if (!mail($konfig['empfaenger'], $betreff, $koerper, implode(ZEILE, $rest))) {
        throw new RuntimeException('mail() lehnte die Nachricht ab');
    }
}

try {
    if (($konfig['transport'] ?? 'smtp') === 'mail') {
        perMailFunktionSenden($konfig, $rohmail);
    } else {
        perSmtpSenden($konfig, $rohmail);
    }
} catch (Throwable $e) {
    // Die Ursache gehoert ins Serverprotokoll, nicht zum Besucher. Der
    // bekommt die Fehlermeldung des Formulars samt E-Mail-Ausweichweg.
    error_log('[kontakt] Versand fehlgeschlagen: ' . $e->getMessage());
    antworten(502, ['ok' => false, 'fehler' => 'versand']);
}

antworten(200, ['ok' => true]);
