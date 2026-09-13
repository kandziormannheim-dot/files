#!/usr/bin/env php
<?php

/**
 * Alle Tests ausführen: jede *_test.php-Datei läuft in einem eigenen
 * PHP-Prozess, damit Sitzungs- und Funktionszustand nicht überlappen.
 *
 *   php sbfkurs/tests/lauf.php [muster]
 */

declare(strict_types=1);

$muster = $argv[1] ?? '';
$dateien = glob(__DIR__ . '/*_test.php') ?: [];
$fehl = 0;
foreach ($dateien as $datei) {
    if ($muster !== '' && !str_contains(basename($datei), $muster)) {
        continue;
    }
    echo "== " . basename($datei) . "\n";
    passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($datei), $code);
    if ($code !== 0) {
        $fehl++;
    }
    echo "\n";
}
echo $fehl === 0 ? "Alle Testdateien bestanden.\n" : "$fehl Testdatei(en) fehlgeschlagen.\n";
exit($fehl === 0 ? 0 : 1);
