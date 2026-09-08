<?php

/**
 * Preisliste für Startseite und Formular (GET), live aus der Datenbank
 * (Dashboard → Routingmatrix). Der Browser nutzt sie zur Anzeige der
 * Preistabelle und des Checkouts; verbindlich rechnet bestellung.php.
 * Liefert außerdem den Checkout-Modus (sandbox/prod) und ob die Zahlung
 * eingerichtet ist.
 *
 *   GET api/revolut/angebot.php?sprache=de|en
 *
 * Je Land: netto/mwst/brutto/carrier/laufzeit der kleinsten Gewichtsklasse
 * („ab“) plus `klassen` mit denselben Feldern je Gewichtsklasse.
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
    $klassen = [];
    foreach ($land['klassen'] as $gk => $zelle) {
        $preis = preisFuer((string) $code, (string) $gk);
        if ($preis === null) {
            continue;
        }
        $klassen[$gk] = [
            'carrier' => $zelle['carrier'],
            'laufzeit' => $zelle['laufzeit'][$sprache],
            'netto' => $preis['netto'],
            'mwst' => $preis['mwst'],
            'brutto' => $preis['brutto'],
        ];
    }
    if ($klassen === []) {
        continue;
    }
    $erste = reset($klassen);
    $laender[] = [
        'code' => $code,
        'name' => $land['name'][$sprache],
        'carrier' => $erste['carrier'],
        'laufzeit' => $erste['laufzeit'],
        'netto' => $erste['netto'],
        'mwst' => $erste['mwst'],
        'brutto' => $erste['brutto'],
        'klassen' => $klassen,
    ];
}

header('Cache-Control: public, max-age=300');
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
