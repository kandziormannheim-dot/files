<?php

/**
 * Handgriffe nur für das Dashboard; alles Allgemeine (Maskierung, URLs,
 * CSRF, Geld- und Zeitformate) liegt in ../../lib/helfer.php.
 */

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/helfer.php';

/** Anfragestatus lesbar. */
function anfrageStatusName(string $status): string
{
    return match ($status) {
        'neu' => 'Neu',
        'in_bearbeitung' => 'In Bearbeitung',
        'konto_angelegt' => 'Konto angelegt',
        'erledigt' => 'Erledigt',
        default => ucfirst($status),
    };
}

/** Rechnungsstatus lesbar. */
function rechnungStatusName(string $status): string
{
    return match ($status) {
        'offen' => 'Offen',
        'bezahlt' => 'Bezahlt',
        'storniert' => 'Storniert',
        default => ucfirst($status),
    };
}

/** Änderung ins Protokoll schreiben (wer, wann, was). */
function protokollieren(string $aktion, string $objekt = '', string|int $objektId = '', array $details = [], ?array $wer = null): void
{
    $b = $wer ?? (function_exists('benutzerAktuell') ? benutzerAktuell() : null);
    try {
        datenbank()->prepare('INSERT INTO protokoll (benutzer_id, benutzer_name, aktion, objekt, objekt_id, details_json, zeit) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$b['id'] ?? null, (string) ($b['name'] ?? 'system'), $aktion, $objekt, (string) $objektId, json_encode($details, JSON_UNESCAPED_UNICODE), jetzt()]);
    } catch (Throwable $e) {
        error_log('[intern] Protokoll: ' . $e->getMessage());
    }
}
