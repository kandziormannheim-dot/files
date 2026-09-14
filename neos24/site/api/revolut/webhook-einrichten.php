<?php

/**
 * Webhook bei Revolut registrieren — nur von der Kommandozeile.
 *
 *   php api/revolut/webhook-einrichten.php https://neos24.com/api/revolut/webhook.php
 *
 * Meldet die URL mit den Ereignissen an, die webhook.php versteht, und gibt
 * das Signing Secret aus. Dieses Secret gehört als 'webhookSchluessel' in
 * die Konfiguration (neos24-config.php). Läuft im Modus der Konfiguration
 * (sandbox oder prod) — für beide Modi je einmal ausführen.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/_bootstrap.php';

$url = $argv[1] ?? '';
if (filter_var($url, FILTER_VALIDATE_URL) === false || !str_starts_with($url, 'https://')) {
    fwrite(STDERR, "Aufruf: php webhook-einrichten.php https://<domain>/api/revolut/webhook.php\n");
    exit(2);
}
if (!zahlungBereit()) {
    fwrite(STDERR, 'Kein Secret Key in ' . NEOS_KONFIG_PFAD . "\n");
    exit(2);
}

$antwort = revolutAnfrage('POST', '/api/1.0/webhooks', [
    'url' => $url,
    'events' => ['ORDER_COMPLETED', 'ORDER_AUTHORISED', 'ORDER_PAYMENT_AUTHENTICATED', 'ORDER_PAYMENT_DECLINED', 'ORDER_PAYMENT_FAILED', 'ORDER_CANCELLED'],
]);

if ($antwort['status'] < 200 || $antwort['status'] >= 300) {
    fwrite(STDERR, 'Revolut antwortet mit HTTP ' . $antwort['status'] . ': ' . json_encode($antwort['daten']) . "\n");
    exit(1);
}

echo 'Modus:          ', checkoutModus(), "\n";
echo 'Webhook-ID:     ', (string) ($antwort['daten']['id'] ?? '?'), "\n";
echo 'Signing Secret: ', (string) ($antwort['daten']['signing_secret'] ?? '(nicht in der Antwort — im Revolut-Dashboard nachsehen)'), "\n";
echo "\nDas Secret als 'webhookSchluessel' in neos24-config.php eintragen.\n";
