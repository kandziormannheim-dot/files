<?php

/**
 * Unterbau des Kundenportals (site/konto/).
 *
 * Baut auf dem Revolut-Unterbau (Konfiguration, SQLite, Bremse, Mail,
 * Preisliste) und den gemeinsamen Helfern in lib/ auf. Eigene Sitzung
 * „neos_konto“ mit Cookie-Pfad /konto/ — getrennt vom internen Dashboard.
 */

declare(strict_types=1);

define('NEOS_HTML', true);

require dirname(__DIR__, 2) . '/api/revolut/_bootstrap.php';
require dirname(__DIR__, 2) . '/lib/helfer.php';
require dirname(__DIR__, 2) . '/lib/kunden.php';
require dirname(__DIR__, 2) . '/lib/rechnungen.php';
require __DIR__ . '/texte.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/sendungen.php';

if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('X-Robots-Tag: noindex, nofollow');
}

/** Basispfad des Portals in der URL, z. B. „/konto“. */
function kontoBasis(): string
{
    if (defined('NEOS_KONTO_BASIS')) {
        return rtrim((string) NEOS_KONTO_BASIS, '/');
    }
    $skript = (string) ($_SERVER['SCRIPT_NAME'] ?? '/konto/index.php');

    return rtrim(str_replace('\\', '/', dirname($skript)), '/');
}

define('APP_BASIS', kontoBasis());

/** Sitzung mit strengen Cookie-Regeln starten. */
function sitzungStarten(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('neos_konto');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => kontoBasis() . '/',
        'secure' => istHttps(),
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

/** Adresse der Startseite (DE oder EN) relativ zum Portal. */
function startseite(string $anker = ''): string
{
    return url(sprache() === 'en' ? '../en/' : '../') . ($anker !== '' ? $anker : '');
}
