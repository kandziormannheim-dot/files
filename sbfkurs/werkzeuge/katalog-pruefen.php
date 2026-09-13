#!/usr/bin/env php
<?php

/**
 * Alle Inhalte prüfen — dieselbe Validierung wie die Admin-Seite „Inhalte“.
 *
 *   php sbfkurs/werkzeuge/katalog-pruefen.php [--streng] [src ubi …]
 *
 * Exit-Code 1 bei Fehlern; mit --streng zählen auch Warnungen.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

$argumente = array_slice($argv, 1);
$streng = in_array('--streng', $argumente, true);
$gewuenscht = array_values(array_filter($argumente, static fn (string $a): bool => !str_starts_with($a, '--')));

$konfig = ['inhalte' => getenv('SBFKURS_INHALTE') ?: dirname(__DIR__) . '/content'];
$zertifikate = zertifikateLaden($konfig);
if ($gewuenscht !== []) {
    $zertifikate = array_intersect_key($zertifikate, array_flip($gewuenscht));
}
if ($zertifikate === []) {
    fwrite(STDERR, "Keine Zertifikate gefunden unter {$konfig['inhalte']}.\n");
    exit(1);
}

$fehlerGesamt = 0;
$warnungenGesamt = 0;
foreach ($zertifikate as $kennung => $z) {
    $befund = katalogPruefen($konfig, $kennung);
    $katalog = fragenLaden($konfig, $kennung);
    printf(
        "%-4s %-45s %2d Lektionen %4d Fragen %2d Fehler %2d Warnungen\n",
        $kennung,
        mb_substr($z['titel'], 0, 45),
        count(lektionenLaden($konfig, $kennung)),
        count($katalog['fragen']),
        count($befund['fehler']),
        count($befund['warnungen'])
    );
    foreach ($befund['fehler'] as $f) {
        echo "     FEHLER   $f\n";
    }
    foreach ($befund['warnungen'] as $w) {
        echo "     Warnung  $w\n";
    }
    $fehlerGesamt += count($befund['fehler']);
    $warnungenGesamt += count($befund['warnungen']);
}

// Gemeinsame Inhalte
$tafel = buchstabiertafelLaden($konfig);
if (count($tafel['buchstaben']) !== 26 || count($tafel['ziffern']) !== 10) {
    echo "     FEHLER   gemeinsam/buchstabiertafel.json: 26 Buchstaben und 10 Ziffern erwartet.\n";
    $fehlerGesamt++;
}
$dsc = dscSzenarienLaden($konfig);
foreach ($dsc['szenarien'] as $s) {
    if (empty($s['id']) || empty($s['titel']) || empty($s['erwartet']) || !is_array($s['erwartet'])) {
        echo "     FEHLER   dsc/szenarien.json: Szenario ohne id, titel oder erwartet.\n";
        $fehlerGesamt++;
    }
}

echo "\n$fehlerGesamt Fehler, $warnungenGesamt Warnungen.\n";
exit($fehlerGesamt > 0 || ($streng && $warnungenGesamt > 0) ? 1 : 0);
