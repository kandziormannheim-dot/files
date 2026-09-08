<?php

/**
 * Kontaktformular der Startseite → Anfrage in der Datenbank (Dashboard →
 * Kunden & Anfragen) plus Benachrichtigung ans Postfach.
 *
 *   POST api/anfrage.php   als JSON (fetch aus neos.js) oder als klassisches
 *                          Formular (ohne JS; Antwort ist eine Umleitung
 *                          zurück zur Seite mit ?gesendet=1 bzw. ?sent=1).
 *
 * Felder: name, email (Business) / email_privat (Privatkunden), firma,
 * volumen, nachricht, art (business|privat), sprache (de|en), webseite
 * (Honigtopf — muss leer bleiben). Herkunft, Bremse und Säuberung wie beim
 * Checkout (api/revolut/_bootstrap.php).
 */

declare(strict_types=1);

require __DIR__ . '/revolut/_bootstrap.php';

$methode = $_SERVER['REQUEST_METHOD'] ?? '';
if ($methode === 'GET') {
    antworten(200, ['ok' => true, 'dienst' => 'anfrage']);
}
nurEigenePost();

$istJson = str_contains(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json');
$daten = $istJson ? eingabeLesen() : $_POST;

$sprache = (($daten['sprache'] ?? 'de') === 'en') ? 'en' : 'de';
$art = (($daten['art'] ?? 'business') === 'privat') ? 'privat' : 'business';
$zurueck = ($sprache === 'en' ? '../en/?sent=1' : '../?gesendet=1') . ($art === 'privat' ? ($sprache === 'en' ? '&customer=private' : '&kunde=privat') : '') . ($sprache === 'en' ? '#contact' : '#kontakt');

/** Antwort je nach Aufrufart: JSON oder Umleitung zurück zur Seite. */
$fertig = static function (int $status, array $inhalt) use ($istJson, $zurueck): never {
    if ($istJson) {
        antworten($status, $inhalt);
    }
    $ziel = $zurueck;
    if (!($inhalt['ok'] ?? false)) {
        $ziel = str_replace(['gesendet=1', 'sent=1'], ['fehler=' . rawurlencode((string) ($inhalt['fehler'] ?? 'unbekannt')), 'error=' . rawurlencode((string) ($inhalt['fehler'] ?? 'unknown'))], $ziel);
    }
    header('Location: ' . $ziel, true, 303);
    exit;
};

if (saeubern($daten['webseite'] ?? '') !== '') {
    $fertig(200, ['ok' => true]); // Honigtopf: Bot lernt nichts
}

$name = saeubern($daten['name'] ?? '', 100);
$email = saeubern($daten['email'] ?? '', 254);
if ($email === '') {
    $email = saeubern($daten['email_privat'] ?? '', 254);
}
$firma = $art === 'business' ? saeubern($daten['firma'] ?? '', 120) : '';
$volumen = $art === 'business' ? saeubern($daten['volumen'] ?? '', 40) : '';
$nachricht = saeubern($daten['nachricht'] ?? '', 4000);

$fehler = [];
if (mb_strlen($name) < 2) {
    $fehler[] = 'name';
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $fehler[] = 'email';
}
if ($fehler !== []) {
    $fertig(422, ['ok' => false, 'fehler' => 'ungueltig', 'felder' => $fehler]);
}
if (!begrenzungPruefen('anfrage')) {
    header('Retry-After: ' . (string) (int) konfig()['limit']['fenster']);
    $fertig(429, ['ok' => false, 'fehler' => 'zu-viele']);
}

try {
    $db = datenbank();
    $db->prepare('INSERT INTO anfragen (art, name, firma, email, volumen, nachricht, sprache, status, erstellt, aktualisiert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute([$art, $name, $firma, mb_strtolower($email), $volumen, $nachricht, $sprache, 'neu', jetzt(), jetzt()]);
    $id = (int) $db->lastInsertId();
} catch (Throwable $e) {
    error_log('[anfrage] Datenbank: ' . $e->getMessage());
    $fertig(500, ['ok' => false, 'fehler' => 'speicher']);
}

// Benachrichtigung ans Postfach (Kopie-Adresse, sonst Absender). Fehler hier
// verhindern nicht die Annahme — die Anfrage steht im Dashboard.
$konfig = konfig();
$an = (string) ($konfig['kopie'] !== '' ? $konfig['kopie'] : $konfig['absender']);
if ($an !== '') {
    $intern = rtrim((string) $konfig['basisUrl'], '/') . '/intern/kunden/anfragen/' . $id;
    $betreff = ($art === 'privat' ? 'Privatkunden-Anfrage' : 'Business-Anfrage') . ' von ' . $name . ($firma !== '' ? ' (' . $firma . ')' : '');
    $koerper = implode("\n", [
        'Neue Anfrage über neos24.com (' . strtoupper($sprache) . ', ' . ($art === 'privat' ? 'Privatkunde' : 'Business') . ')',
        '',
        'Name:      ' . $name,
        'Firma:     ' . ($firma !== '' ? $firma : '—'),
        'E-Mail:    ' . $email,
        'Volumen:   ' . ($volumen !== '' ? $volumen : '—'),
        '',
        'Nachricht:',
        $nachricht !== '' ? $nachricht : '(keine)',
        '',
        'Im Dashboard: ' . $intern,
    ]);
    try {
        mailSenden($an, $betreff, $koerper);
    } catch (Throwable $e) {
        error_log('[anfrage] Benachrichtigung fehlgeschlagen: ' . $e->getMessage());
    }
}

$fertig(200, ['ok' => true, 'id' => $id]);
