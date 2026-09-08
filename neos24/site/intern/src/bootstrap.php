<?php

/**
 * Unterbau des internen Dashboards (site/intern/).
 *
 * Baut auf dem Revolut-Unterbau auf (gleiche Konfiguration, gleiche SQLite-
 * Datenbank, Bremse, Mail, Revolut-Client) und ergänzt Sitzung, Anmeldung,
 * Rollen/Rechte, Datenzugriff für Preise/Routing und Kennzahlen. Bewusst
 * NICHT eingebunden wird womo/ — die Helfernamen kollidieren.
 */

declare(strict_types=1);

define('NEOS_INTERN', true);

require dirname(__DIR__, 2) . '/api/revolut/_bootstrap.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/rechte.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/preise.php';
require __DIR__ . '/kennzahlen.php';

if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('X-Robots-Tag: noindex, nofollow');
}

/** Basispfad des Dashboards in der URL, z. B. „/intern“. */
function internBasis(): string
{
    if (defined('NEOS_INTERN_BASIS')) {
        return rtrim((string) NEOS_INTERN_BASIS, '/');
    }
    $skript = (string) ($_SERVER['SCRIPT_NAME'] ?? '/intern/index.php');

    return rtrim(str_replace('\\', '/', dirname($skript)), '/');
}

/** Sitzung mit strengen Cookie-Regeln starten (Anmeldung und CSRF). */
function sitzungStarten(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('neos_intern');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => internBasis() . '/',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** Eine Ansicht im Seitenrahmen ausgeben und beenden. */
function ansicht(string $name, array $daten = []): never
{
    extract($daten, EXTR_SKIP);
    $inhaltDatei = __DIR__ . '/views/' . $name . '.php';
    require __DIR__ . '/views/layout.php';
    exit;
}

/** Fehlerseite (403/404) im Seitenrahmen. */
function fehlerSeite(int $code, string $titel, string $text): never
{
    http_response_code($code);
    ansicht('fehler', ['titel' => $titel, 'code' => $code, 'text' => $text, 'aktiv' => '']);
}
