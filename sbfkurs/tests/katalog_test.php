<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

$konfig = testKonfig();

// Die echten Inhalte sind fehlerfrei
foreach (zertifikateLaden($konfig) as $kennung => $z) {
    $befund = katalogPruefen($konfig, $kennung);
    pruefeGleich([], $befund['fehler'], "Inhalte „{$kennung}“ ohne Fehler");
    $summe = array_sum($z['pruefung']['zusammensetzung']);
    pruefeGleich((int) $z['pruefung']['fragenProBogen'], $summe, "„{$kennung}“: Zusammensetzung ergibt fragenProBogen");
    pruefe(count(lektionenLaden($konfig, $kennung)) >= 8, "„{$kennung}“: mindestens acht Lektionen");
    pruefe(count(fragenLaden($konfig, $kennung)['fragen']) >= 10, "„{$kennung}“: mindestens zehn Fragen");
}
pruefeGleich(['src', 'ubi', 'fkn', 'lrc', 'see', 'binnen'], array_keys(zertifikateLaden($konfig)), 'Reihenfolge der Zertifikate');

$tafel = buchstabiertafelLaden($konfig);
pruefeGleich(26, count($tafel['buchstaben']), 'Buchstabiertafel vollständig');

// Ein absichtlich kaputter Katalog liefert die erwarteten Befunde
$kaputt = sys_get_temp_dir() . '/sbfkurs-kaputt-' . bin2hex(random_bytes(4));
mkdir("$kaputt/xx/lektionen", 0700, true);
jsonSchreiben("$kaputt/xx/zertifikat.json", ['id' => 'xx', 'titel' => 'Kaputt', 'pruefung' => ['fragenProBogen' => 4, 'zeitMinuten' => 5, 'mindestRichtig' => 5, 'zusammensetzung' => ['a' => 2, 'gibtsnicht' => 1]]]);
jsonSchreiben("$kaputt/xx/lektionen.json", ['lektionen' => [['slug' => 'fehlt', 'titel' => 'Fehlt']]]);
jsonSchreiben("$kaputt/xx/fragen.json", ['module' => [['id' => 'a', 'titel' => 'A']], 'fragen' => [
    ['id' => 'xx-001', 'nr' => 1, 'modul' => 'a', 'text' => 'Frage?', 'antworten' => ['x', 'y', 'z'], 'richtig' => 5],
    ['id' => 'falsch', 'nr' => 1, 'modul' => 'b', 'text' => '', 'antworten' => ['x'], 'richtig' => 0],
]]);
$befund = katalogPruefen(['inhalte' => $kaputt], 'xx');
$text = implode("\n", $befund['fehler']);
pruefe(str_contains($text, 'Datei fehlt'), 'fehlende Lektionsdatei erkannt');
pruefe(str_contains($text, 'keine vorhandene Antwort'), 'ungültiger richtig-Index erkannt');
pruefe(str_contains($text, 'passt nicht zum Muster'), 'falsches id-Muster erkannt');
pruefe(str_contains($text, 'nicht definiert'), 'unbekanntes Modul erkannt');
pruefe(str_contains($text, 'weniger als zwei Antworten'), 'zu wenige Antworten erkannt');
pruefe(str_contains($text, 'leerer Fragetext'), 'leerer Fragetext erkannt');
pruefe(str_contains($text, 'doppelt'), 'doppelte Nummer erkannt');
pruefe(str_contains($text, 'unbekanntes Modul „gibtsnicht“'), 'Zusammensetzung mit unbekanntem Modul erkannt');
pruefe(str_contains($text, 'mindestRichtig ist größer'), 'mindestRichtig > fragenProBogen erkannt');
pruefe(str_contains($text, 'Zusammensetzung ergibt 3'), 'Summe der Zusammensetzung geprüft');
pruefe(in_array('Frage „xx-001“: 3 statt 4 Antworten.', $befund['warnungen'], true), 'drei Antworten sind nur eine Warnung');
array_map('unlink', glob("$kaputt/xx/*.json") ?: []);
rmdir("$kaputt/xx/lektionen");
rmdir("$kaputt/xx");
rmdir($kaputt);

exit(testErgebnis());
