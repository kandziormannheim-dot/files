<?php

/**
 * Webhook-Empfänger für Lexware Office (Event-Subscriptions, POST).
 *
 * Lexware schickt bei Statuswechseln ein JSON wie
 *   { "organizationId": "…", "eventType": "invoice.status.changed", "resourceId": "…", "eventDate": "…" }
 * Der Nutzlast wird nicht vertraut: verarbeitet wird nur die resourceId, und
 * der Beleg wird über die API nachgeladen (lexwareWebhookVerarbeiten). Ist
 * lexware.webhookGeheimnis gesetzt, muss es als Query-Parameter „g“ mitkommen
 * (die Callback-URL wird dann mit ?g=… registriert).
 */

declare(strict_types=1);

require __DIR__ . '/../revolut/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    antworten(200, ['ok' => true, 'dienst' => 'lexware-webhook', 'bereit' => lexwareAktiv()]);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: GET, POST');
    antworten(405, ['ok' => false, 'fehler' => 'methode']);
}
$geheimnis = (string) (konfig()['lexware']['webhookGeheimnis'] ?? '');
if ($geheimnis !== '' && !hash_equals($geheimnis, (string) ($_GET['g'] ?? ''))) {
    antworten(401, ['ok' => false, 'fehler' => 'geheimnis']);
}
if (!lexwareAktiv()) {
    antworten(503, ['ok' => false, 'fehler' => 'nicht-eingerichtet']);
}
$daten = json_decode((string) file_get_contents('php://input', false, null, 0, 64 * 1024), true);
if (!is_array($daten)) {
    antworten(400, ['ok' => false, 'fehler' => 'format']);
}
try {
    lexwareWebhookVerarbeiten(['resourceId' => saeubern($daten['resourceId'] ?? '', 80), 'eventType' => saeubern($daten['eventType'] ?? '', 60)]);
} catch (Throwable $e) {
    error_log('[lexware] Webhook: ' . $e->getMessage());
    antworten(500, ['ok' => false, 'fehler' => 'verarbeitung']);
}
antworten(200, ['ok' => true]);
