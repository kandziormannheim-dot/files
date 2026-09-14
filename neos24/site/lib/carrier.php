<?php

/**
 * Schnittstelle zur Carrier-Anbindung — heute Stubs.
 *
 * HIER HAKT DIE ECHTE ANBINDUNG EIN (DPD, DHL, GLS, InPost, …): Label
 * erzeugen, Abholung buchen, Tracking abrufen. Solange keine API angebunden
 * ist, liefert labelBeauftragen() ein vorläufiges NEOS-Label (lib/label_pdf.php),
 * Abholungen werden nur vermerkt und Tracking-Ereignisse pflegt das Team im
 * Dashboard.
 */

declare(strict_types=1);

/**
 * Label beim Carrier anfordern. Liefert ['datei' => Pfad, 'sendungsnummer' => …]
 * oder null, wenn kein Carrier angebunden ist (dann entsteht das NEOS-Label).
 */
function carrierLabelAnfordern(array $bestellung): ?array
{
    return null;
}

/** Abholung beim Carrier buchen. Ohne Anbindung nur ein Vermerk. */
function carrierAbholungBuchen(array $bestellung, array $abholung): void
{
    error_log('[carrier] Abholung vorgemerkt für ' . $bestellung['ext_ref'] . ' am ' . ($abholung['datum'] ?? '?') . ' (' . ($abholung['fenster'] ?? '') . ') — Carrier-Anbindung folgt');
}

/**
 * Tracking-Ereignisse beim Carrier abrufen. Liefert eine Liste
 * [['code' => 'unterwegs', 'zeit' => ISO, 'ort' => '…'], …] oder [] ohne Anbindung.
 */
function carrierTrackingAbrufen(array $bestellung): array
{
    return [];
}
