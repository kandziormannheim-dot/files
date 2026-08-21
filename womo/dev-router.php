<?php

/**
 * Mini-Router für die lokale Entwicklung mit PHPs eingebautem Server:
 *
 *   WOMO_KONFIG=/pfad/zu/test-config.php php -S 127.0.0.1:8091 womo/dev-router.php
 *
 * Vorhandene Dateien (CSS, JS) liefert der Server direkt aus, alles andere
 * geht an den Front-Controller — wie es nginx im Betrieb auch macht.
 */

declare(strict_types=1);

$pfad = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$wurzel = __DIR__ . '/public';

if ($pfad !== '/' && is_file($wurzel . $pfad)) {
    return false;
}

$_SERVER['DOCUMENT_ROOT'] = $wurzel;
require $wurzel . '/index.php';
