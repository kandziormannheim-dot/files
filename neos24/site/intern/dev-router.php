<?php

/**
 * Mini-Router für die lokale Entwicklung mit PHPs eingebautem Server.
 * Liefert die ganze Seite (site/) aus, /intern/… geht an den Front-Controller:
 *
 *   NEOS_KONFIG=/pfad/zu/test-config.php php -S 127.0.0.1:8901 neos24/site/intern/dev-router.php
 *
 * Dann: http://127.0.0.1:8901/ (Startseite), http://127.0.0.1:8901/intern/ (Dashboard).
 */

declare(strict_types=1);

$pfad = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$wurzel = dirname(__DIR__);

if ($pfad === '/intern' || str_starts_with($pfad, '/intern/')) {
    $datei = $wurzel . $pfad;
    if ($pfad !== '/intern/' && is_file($datei) && !str_starts_with($pfad, '/intern/src/') && !str_ends_with($pfad, '.php')) {
        return false;
    }
    define('NEOS_INTERN_BASIS', '/intern');
    $_SERVER['DOCUMENT_ROOT'] = $wurzel;
    $_SERVER['SCRIPT_NAME'] = '/intern/index.php';
    require __DIR__ . '/index.php';
    exit;
}

if ($pfad === '/' || $pfad === '') {
    $_SERVER['REQUEST_URI'] = '/index.html';
    readfile($wurzel . '/index.html');
    exit;
}
if ($pfad === '/en' || $pfad === '/en/') {
    readfile($wurzel . '/en/index.html');
    exit;
}

return false;
