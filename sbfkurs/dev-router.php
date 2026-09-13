<?php

/**
 * Mini-Router für die lokale Entwicklung mit PHPs eingebautem Server:
 *
 *   SBFKURS_KONFIG=/pfad/zu/test-config.php php -S 127.0.0.1:8092 sbfkurs/dev-router.php
 *
 * Vorhandene Dateien (CSS, JS) unter public/ liefert der Router selbst aus —
 * unabhängig davon, aus welchem Verzeichnis der Server gestartet wurde.
 * Alles andere geht an den Front-Controller, wie Apache und nginx es im
 * Betrieb auch tun.
 */

declare(strict_types=1);

$pfad = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$wurzel = __DIR__ . '/public';
$datei = realpath($wurzel . $pfad);

if ($pfad !== '/' && $datei !== false && is_file($datei) && str_starts_with($datei, $wurzel . '/') && !str_ends_with($datei, '.php')) {
    $typen = ['css' => 'text/css', 'js' => 'text/javascript', 'png' => 'image/png', 'svg' => 'image/svg+xml', 'ico' => 'image/x-icon', 'woff2' => 'font/woff2'];
    $endung = strtolower(pathinfo($datei, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($typen[$endung] ?? 'application/octet-stream'));
    header('Content-Length: ' . (string) filesize($datei));
    readfile($datei);
    exit;
}

$_SERVER['DOCUMENT_ROOT'] = $wurzel;
require $wurzel . '/index.php';
