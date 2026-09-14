<?php

/**
 * Webhook-Empfänger für Odoo (Automatisierte Aktion → Webhook, POST JSON).
 *
 * Odoo schickt bei Änderungen an res.partner ein JSON mit mindestens
 *   { "_model": "res.partner", "id": 42, ... }   (Odoo 17 Webhook-Aktion)
 * oder { "model": "res.partner", "id": 42 } (eigene Server-Aktion). Der
 * Nutzlast wird nicht vertraut: verarbeitet wird nur die ID, der Partner
 * wird über die API nachgeladen (syncAbholenEinzeln). Ist
 * odoo.webhookGeheimnis gesetzt, muss es als Query-Parameter „g“ mitkommen.
 */

declare(strict_types=1);

require __DIR__ . '/../revolut/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    antworten(200, ['ok' => true, 'dienst' => 'odoo-webhook', 'bereit' => odooAktiv()]);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: GET, POST');
    antworten(405, ['ok' => false, 'fehler' => 'methode']);
}
$geheimnis = (string) (konfig()['odoo']['webhookGeheimnis'] ?? '');
if ($geheimnis !== '' && !hash_equals($geheimnis, (string) ($_GET['g'] ?? ''))) {
    antworten(401, ['ok' => false, 'fehler' => 'geheimnis']);
}
if (!odooAktiv()) {
    antworten(503, ['ok' => false, 'fehler' => 'nicht-eingerichtet']);
}
$daten = json_decode((string) file_get_contents('php://input', false, null, 0, 64 * 1024), true);
if (!is_array($daten)) {
    antworten(400, ['ok' => false, 'fehler' => 'format']);
}
$modell = saeubern($daten['_model'] ?? $daten['model'] ?? 'res.partner', 40);
$id = (int) ($daten['id'] ?? $daten['_id'] ?? 0);
if ($modell !== 'res.partner' || $id <= 0) {
    antworten(200, ['ok' => true, 'ignoriert' => true]);
}
try {
    $gefunden = syncAbholenEinzeln('odoo', (string) $id);
} catch (Throwable $e) {
    error_log('[odoo] Webhook: ' . $e->getMessage());
    antworten(500, ['ok' => false, 'fehler' => 'verarbeitung']);
}
antworten(200, ['ok' => true, 'bekannt' => $gefunden]);
