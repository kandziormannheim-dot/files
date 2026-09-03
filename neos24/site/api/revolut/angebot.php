<?php

/**
 * Preisliste für das Formular (GET). Der Browser nutzt sie zur Anzeige;
 * verbindlich rechnet bestellung.php. Liefert außerdem den Checkout-Modus
 * (sandbox/prod) und ob die Zahlung eingerichtet ist.
 *
 *   GET api/revolut/angebot.php?sprache=de|en
 */

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    antworten(405, ['ok' => false, 'fehler' => 'methode']);
}

$sprache = (($_GET['sprache'] ?? 'de') === 'en') ? 'en' : 'de';
$p = preisliste();
$laender = [];
foreach ($p['laender'] as $code => $land) {
    $preis = preisFuer((string) $code, '2kg');
    $laender[] = [
        'code' => $code,
        'name' => $land['name'][$sprache],
        'carrier' => $land['carrier'],
        'laufzeit' => $land['laufzeit'][$sprache],
        'netto' => $preis['netto'],
        'mwst' => $preis['mwst'],
        'brutto' => $preis['brutto'],
    ];
}

antworten(200, [
    'ok' => true,
    'dienst' => 'revolut',
    'bereit' => zahlungBereit(),
    'modus' => checkoutModus(),
    'waehrung' => $p['waehrung'],
    'mwst' => (int) $p['mwstSatz'],
    'gewichtsklassen' => array_map(static fn (array $g): string => $g[$sprache], $p['gewichtsklassen']),
    'laender' => $laender,
]);
