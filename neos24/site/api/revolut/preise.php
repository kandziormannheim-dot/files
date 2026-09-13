<?php

/**
 * NUR NOCH SAATGUT. Wird einmalig von preiseSaeen() in _bootstrap.php in die
 * Datenbank übernommen, solange dort keine Länder angelegt sind. Danach ist
 * die Datenbank die einzige Preisquelle — gepflegt im internen Dashboard
 * (intern/ → Preise & Zielländer, Routingmatrix). Änderungen an dieser Datei
 * wirken auf eine bestehende Datenbank nicht mehr.
 *
 * Aus „carrier“ werden beim Säen die Prioritäten 1–3 der Routingmatrix
 * (erster Name = Priorität 1 = auf der Startseite gezeigt), „netto“ wird der
 * Verkaufspreis, der Einkaufspreis startet bei 0.
 *
 * PLATZHALTER: Beispielpreise, abgeleitet aus Dashboard.pdf.
 */

declare(strict_types=1);

return [
    // Aufschlag je Klasse in Cent auf den Nettopreis des Landes (nur für das Säen).
    'gewichtsklassen' => [
        '2kg' => ['de' => 'bis 2 kg', 'en' => 'up to 2 kg', 'max_gramm' => 2000, 'aufschlag' => 0],
        '5kg' => ['de' => 'bis 5 kg', 'en' => 'up to 5 kg', 'max_gramm' => 5000, 'aufschlag' => 180],
        '10kg' => ['de' => 'bis 10 kg', 'en' => 'up to 10 kg', 'max_gramm' => 10000, 'aufschlag' => 390],
        '20kg' => ['de' => 'bis 20 kg', 'en' => 'up to 20 kg', 'max_gramm' => 20000, 'aufschlag' => 690],
        '31kg' => ['de' => 'bis 31,5 kg', 'en' => 'up to 31.5 kg', 'max_gramm' => 31500, 'aufschlag' => 1090],
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
