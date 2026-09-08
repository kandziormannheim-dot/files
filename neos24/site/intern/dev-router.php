<?php

/**
 * Mini-Router für die lokale Entwicklung mit PHPs eingebautem Server.
 * Liefert die ganze Seite (site/) aus; /intern/… geht an das Dashboard,
 * /konto/… an das Kundenportal:
 *
 *   NEOS_KONFIG=/pfad/zu/test-config.php php -S 127.0.0.1:8901 -t neos24/site neos24/site/intern/dev-router.php
 *
 * Dann: http://127.0.0.1:8901/ (Startseite), /intern/ (Dashboard), /konto/ (Portal).
 */

declare(strict_types=1);

$pfad = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$wurzel = dirname(__DIR__);

foreach (['intern' => 'NEOS_INTERN_BASIS', 'konto' => 'NEOS_KONTO_BASIS'] as $app => $konstante) {
    if ($pfad === '/' . $app || str_starts_with($pfad, '/' . $app . '/')) {
        $datei = $wurzel . $pfad;
        if ($pfad !== '/' . $app . '/' && is_file($datei) && !str_starts_with($pfad, '/' . $app . '/src/') && !str_ends_with($pfad, '.php')) {
            return false;
        }
        define($konstante, '/' . $app);
        $_SERVER['DOCUMENT_ROOT'] = $wurzel;
        $_SERVER['SCRIPT_NAME'] = '/' . $app . '/index.php';
        require $wurzel . '/' . $app . '/index.php';
        exit;
    }
}

if ($pfad === '/' || $pfad === '') {
    readfile($wurzel . '/index.html');
    exit;
}
if ($pfad === '/en' || $pfad === '/en/') {
    readfile($wurzel . '/en/index.html');
    exit;
}

return false;
