<?php

/**
 * Webhook-Empfänger für Revolut (POST).
 *
 * Revolut schickt bei Statuswechseln ein JSON wie
 *   { "event": "ORDER_COMPLETED", "order_id": "…", "merchant_order_ext_ref": "NE-…" }
 * und signiert es: Kopf „Revolut-Signature: v1=<hex>“ (mehrere kommagetrennt)
 * und „Revolut-Request-Timestamp: <ms>“. Signiert wird HMAC-SHA256 über
 * „v1.<timestamp>.<rohbody>“ mit dem Signing Secret des Webhooks.
 *
 * Ohne gültige Signatur passiert nichts. Unbekannte Bestellungen und
 * unbekannte Ereignisse werden protokolliert und mit 200 quittiert, damit
 * Revolut nicht endlos erneut zustellt.
 */

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    antworten(200, ['ok' => true, 'dienst' => 'revolut-webhook', 'bereit' => (string) konfig()['revolut']['webhookSchluessel'] !== '']);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: GET, POST');
    antworten(405, ['ok' => false, 'fehler' => 'methode']);
}

$geheimnis = (string) konfig()['revolut']['webhookSchluessel'];
if ($geheimnis === '') {
    error_log('[revolut] Webhook ohne Signing Secret aufgerufen — webhook-einrichten.php ausführen');
    antworten(503, ['ok' => false, 'fehler' => 'nicht-eingerichtet']);
}

$roh = (string) file_get_contents('php://input', false, null, 0, 256 * 1024);
$signaturKopf = (string) ($_SERVER['HTTP_REVOLUT_SIGNATURE'] ?? '');
$zeitstempel = (string) ($_SERVER['HTTP_REVOLUT_REQUEST_TIMESTAMP'] ?? '');

/** Signatur prüfen: Zeitstempel frisch, HMAC über "v1.<ts>.<body>" stimmt. */
function signaturGueltig(string $roh, string $signaturKopf, string $zeitstempel, string $geheimnis): bool
{
    if ($signaturKopf === '' || preg_match('/^\d{10,16}$/', $zeitstempel) !== 1) {
        return false;
    }
    $sekunden = strlen($zeitstempel) > 10 ? (int) ((int) $zeitstempel / 1000) : (int) $zeitstempel;
    if (abs(time() - $sekunden) > (int) konfig()['revolut']['zeitstempelToleranz']) {
        return false;
    }
    $erwartet = hash_hmac('sha256', 'v1.' . $zeitstempel . '.' . $roh, $geheimnis);
    foreach (explode(',', $signaturKopf) as $teil) {
        $teil = trim($teil);
        if (str_starts_with($teil, 'v1=') && hash_equals($erwartet, strtolower(substr($teil, 3)))) {
            return true;
        }
    }

    return false;
}

if (!signaturGueltig($roh, $signaturKopf, $zeitstempel, $geheimnis)) {
    error_log('[revolut] Webhook mit ungültiger Signatur abgewiesen');
    antworten(401, ['ok' => false, 'fehler' => 'signatur']);
}

$daten = json_decode($roh, true);
if (!is_array($daten)) {
    antworten(400, ['ok' => false, 'fehler' => 'format']);
}

$ereignis = strtoupper(saeubern($daten['event'] ?? '', 60));
$orderId = saeubern($daten['order_id'] ?? '', 80);
$extRef = strtoupper(saeubern($daten['merchant_order_ext_ref'] ?? '', 40));

$statusJeEreignis = [
    'ORDER_COMPLETED' => 'bezahlt',
    'ORDER_AUTHORISED' => 'autorisiert',
    'ORDER_PAYMENT_AUTHENTICATED' => 'angelegt',
    'ORDER_PAYMENT_FAILED' => 'fehlgeschlagen',
    'ORDER_PAYMENT_DECLINED' => 'fehlgeschlagen',
    'ORDER_CANCELLED' => 'storniert',
];

try {
    $bestellung = null;
    if ($orderId !== '') {
        $bestellung = bestellungLaden('revolut_id', $orderId);
    }
    if ($bestellung === null && $extRef !== '') {
        $bestellung = bestellungLaden('ext_ref', $extRef);
    }
    if ($bestellung === null) {
        error_log('[revolut] Webhook für unbekannte Bestellung: ' . $ereignis . ' ' . $orderId . ' ' . $extRef);
        antworten(200, ['ok' => true, 'hinweis' => 'unbekannt']);
    }
    if (!isset($statusJeEreignis[$ereignis])) {
        bestellungFortschreiben($bestellung, (string) $bestellung['status'], 'webhook.' . strtolower($ereignis ?: 'unbekannt'));
        antworten(200, ['ok' => true, 'hinweis' => 'ignoriert']);
    }
    bestellungFortschreiben($bestellung, $statusJeEreignis[$ereignis], 'webhook.' . strtolower($ereignis), ['order_id' => $orderId]);
} catch (Throwable $e) {
    error_log('[revolut] Webhook-Verarbeitung: ' . $e->getMessage());
    antworten(500, ['ok' => false, 'fehler' => 'speicher']); // 5xx: Revolut stellt erneut zu
}

antworten(200, ['ok' => true]);
