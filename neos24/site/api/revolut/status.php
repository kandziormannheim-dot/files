<?php

/**
 * Status einer Bestellung (GET ?id=NE-…). Der Browser fragt ihn nach dem
 * Revolut-Popup ab. Steht die Bestellung noch auf „angelegt“, wird der
 * Zustand direkt bei Revolut nachgeschlagen — falls der Webhook noch
 * unterwegs ist. Gibt keine Adressdaten heraus.
 */

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    antworten(405, ['ok' => false, 'fehler' => 'methode']);
}

$id = strtoupper(saeubern($_GET['id'] ?? '', 40));
if (preg_match('/^NE-\d{4}-[0-9A-F]{8}$/', $id) !== 1) {
    antworten(400, ['ok' => false, 'fehler' => 'format']);
}
if (!begrenzungPruefen('status')) {
    antworten(429, ['ok' => false, 'fehler' => 'zu-viele']);
}

try {
    $bestellung = bestellungLaden('ext_ref', $id);
} catch (Throwable $e) {
    error_log('[revolut] Datenbank: ' . $e->getMessage());
    antworten(500, ['ok' => false, 'fehler' => 'speicher']);
}
if ($bestellung === null) {
    antworten(404, ['ok' => false, 'fehler' => 'unbekannt']);
}

if (in_array($bestellung['status'], ['angelegt', 'autorisiert'], true) && (string) $bestellung['revolut_id'] !== '' && zahlungBereit()) {
    try {
        $antwort = revolutAnfrage('GET', '/api/orders/' . rawurlencode((string) $bestellung['revolut_id']));
        $status = statusAusRevolut((string) ($antwort['daten']['state'] ?? ''));
        if ($antwort['status'] === 200 && $status !== null && $status !== $bestellung['status']) {
            $bestellung = bestellungFortschreiben($bestellung, $status, 'revolut.abgleich', ['state' => $antwort['daten']['state']]);
        }
    } catch (Throwable $e) {
        error_log('[revolut] Abgleich: ' . $e->getMessage()); // Nicht schlimm — der Webhook kommt.
    }
}

$email = (string) $bestellung['email'];
$at = strrpos($email, '@');
$maskiert = $at === false ? '' : mb_substr($email, 0, 1) . '***' . substr($email, $at);

antworten(200, [
    'ok' => true,
    'bestellung' => $bestellung['ext_ref'],
    'status' => $bestellung['status'],
    'bezahlt' => $bestellung['bezahlt'],
    'betrag' => [
        'netto' => (int) $bestellung['netto_cent'],
        'mwst' => (int) $bestellung['mwst_cent'],
        'brutto' => (int) $bestellung['betrag_cent'],
        'waehrung' => $bestellung['waehrung'],
    ],
    'email' => $maskiert,
]);
