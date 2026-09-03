<?php

/**
 * Einzige Preisquelle des Privatkunden-Checkouts.
 *
 * Der Browser zeigt Preise nur an; verbindlich ist, was dieser Datei
 * entnommen wird (bestellung.php rechnet den Betrag hier heraus und ignoriert
 * jeden Betrag aus dem Formular). Die Werte müssen mit der Preistabelle in
 * index.html / en/index.html übereinstimmen — bei Änderung beides anpassen.
 *
 * PLATZHALTER: Beispielpreise, abgeleitet aus Dashboard.pdf. Vor Livegang
 * durch die freigegebene Preisliste ersetzen.
 */

declare(strict_types=1);

return [
    'waehrung' => 'EUR',
    'mwstSatz' => 19, // Prozent, für Privatkunden inklusive
    'gewichtsklassen' => [
        '2kg' => ['de' => 'bis 2 kg', 'en' => 'up to 2 kg'],
    ],
    // Nettopreise in Cent je Paket der Gewichtsklasse 2kg.
    'laender' => [
        'DE' => ['name' => ['de' => 'Deutschland', 'en' => 'Germany'],     'carrier' => 'DPD, DHL, GLS',          'laufzeit' => ['de' => '1–2 Werktage', 'en' => '1–2 working days'], 'netto' => 195],
        'PL' => ['name' => ['de' => 'Polen', 'en' => 'Poland'],           'carrier' => 'InPost',                 'laufzeit' => ['de' => '2–3 Werktage', 'en' => '2–3 working days'], 'netto' => 195],
        'NL' => ['name' => ['de' => 'Niederlande', 'en' => 'Netherlands'], 'carrier' => 'PostNL',                 'laufzeit' => ['de' => '1–2 Werktage', 'en' => '1–2 working days'], 'netto' => 210],
        'BE' => ['name' => ['de' => 'Belgien', 'en' => 'Belgium'],        'carrier' => 'bpost',                  'laufzeit' => ['de' => '1–2 Werktage', 'en' => '1–2 working days'], 'netto' => 220],
        'FR' => ['name' => ['de' => 'Frankreich', 'en' => 'France'],      'carrier' => 'Colissimo, Chronopost',  'laufzeit' => ['de' => '2–3 Werktage', 'en' => '2–3 working days'], 'netto' => 240],
        'AT' => ['name' => ['de' => 'Österreich', 'en' => 'Austria'],     'carrier' => 'DPD, Österreichische Post', 'laufzeit' => ['de' => '1–2 Werktage', 'en' => '1–2 working days'], 'netto' => 255],
        'IT' => ['name' => ['de' => 'Italien', 'en' => 'Italy'],          'carrier' => 'GLS, Poste Italiane',    'laufzeit' => ['de' => '2–4 Werktage', 'en' => '2–4 working days'], 'netto' => 285],
        'ES' => ['name' => ['de' => 'Spanien', 'en' => 'Spain'],          'carrier' => 'Correos',                'laufzeit' => ['de' => '2–4 Werktage', 'en' => '2–4 working days'], 'netto' => 295],
        'PT' => ['name' => ['de' => 'Portugal', 'en' => 'Portugal'],      'carrier' => 'CTT',                    'laufzeit' => ['de' => '3–5 Werktage', 'en' => '3–5 working days'], 'netto' => 310],
    ],
];
