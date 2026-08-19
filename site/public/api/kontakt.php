<?php
/**
 * Kontaktformular-Endpunkt für kandzior.de (Plesk/PHP, Hosting Hetzner).
 *
 * Nimmt die JSON-Anfrage des Formulars entgegen ({name, email, message})
 * und stellt sie per Mail an den Postfachinhaber zu. Kein Drittanbieter,
 * die Daten verlassen den eigenen Server nur Richtung eigenes Postfach —
 * das ist die Zusage aus der Datenschutzerklärung.
 *
 * Sicherheit:
 * - Nur POST, nur JSON, Größenlimit.
 * - E-Mail-Validierung serverseitig (der Client prüft nur fürs UI).
 * - Keine Nutzereingaben in Mail-KOPFZEILEN außer der geprüften
 *   Reply-To-Adresse — Header-Injection ist damit ausgeschlossen.
 * - Honeypot: Füllt ein Automat das unsichtbare Feld, wird Erfolg
 *   gemeldet, aber nichts versendet.
 */

declare(strict_types=1);

const EMPFAENGER = 'mail@kandzior.de';
const ABSENDER   = 'formular@kandzior.de'; // Muss auf der Domain existieren oder als Absender erlaubt sein.
const MAX_BYTES  = 20000;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo '{"error":"method"}';
    exit;
}

$roh = file_get_contents('php://input', false, null, 0, MAX_BYTES + 1);
if ($roh === false || strlen($roh) > MAX_BYTES) {
    http_response_code(413);
    echo '{"error":"size"}';
    exit;
}

$daten = json_decode($roh, true);
if (!is_array($daten)) {
    http_response_code(400);
    echo '{"error":"json"}';
    exit;
}

$name    = trim((string)($daten['name'] ?? ''));
$email   = trim((string)($daten['email'] ?? ''));
$message = trim((string)($daten['message'] ?? ''));
$falle   = trim((string)($daten['company'] ?? '')); // Honeypot, falls mitgesendet

if ($falle !== '') {
    // Automat: freundlich zustimmen, nichts tun.
    echo '{}';
    exit;
}

if ($name === '' || $message === '' || mb_strlen($name) > 200 || mb_strlen($message) > 8000) {
    http_response_code(422);
    echo '{"error":"fields"}';
    exit;
}

$email = filter_var($email, FILTER_VALIDATE_EMAIL);
if ($email === false || preg_match('/[\r\n]/', $email)) {
    http_response_code(422);
    echo '{"error":"email"}';
    exit;
}

// Kopfzeilen: ausschließlich feste Werte plus die validierte Adresse.
$betreff = 'Anfrage über kandzior.de';
$kopf = [
    'From: kandzior.de Formular <' . ABSENDER . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
];

// Name nur im TEXT, nie im Header — so kann er enthalten, was er will.
$rumpf = "Neue Anfrage über das Kontaktformular\n"
    . "-------------------------------------\n"
    . 'Name:    ' . $name . "\n"
    . 'E-Mail:  ' . $email . "\n"
    . 'Zeit:    ' . gmdate('Y-m-d H:i') . " UTC\n\n"
    . $message . "\n";

$ok = mail(
    EMPFAENGER,
    '=?UTF-8?B?' . base64_encode($betreff) . '?=',
    $rumpf,
    implode("\r\n", $kopf)
);

if (!$ok) {
    http_response_code(500);
    echo '{"error":"mail"}';
    exit;
}

echo '{}';
