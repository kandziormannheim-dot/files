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

// Importierte amtliche Kataloge: Umfang, Module, Bilder, Schallsignale
$src = fragenLaden($konfig, 'src');
pruefeGleich(217, count($src['fragen']), 'SRC: 180 Katalogfragen + 37 Anpassungsfragen');
pruefe(!$src['beispielhaft'], 'SRC: amtlich, keine Beispielfragen mehr');
pruefe(str_contains($src['quelle']['freigabe'], 'FVT/ABVT Koblenz'), 'SRC: Freigabe der Fachstelle festgehalten');
pruefe(str_contains(fragenLaden($konfig, 'lrc')['quelle']['freigabe'], 'FVT/ABVT Koblenz'), 'LRC: Freigabe der Fachstelle festgehalten');
pruefeGleich('', fragenLaden($konfig, 'see')['quelle']['freigabe'], 'Ohne Freigabe bleibt das Feld leer');
pruefeGleich(56, count(array_filter($src['fragen'], static fn (array $f): bool => $f['modul'] === 'sar')), 'SRC: Abschnitt VII (SAR) hat 56 Fragen');
pruefeGleich(76, count(fragenLaden($konfig, 'lrc')['fragen']), 'LRC: 76 Fragen');
$binnen = fragenLaden($konfig, 'binnen');
pruefeGleich(300, count($binnen['fragen']), 'Binnen: 300 Fragen');
pruefeGleich(73, count(array_filter($binnen['fragen'], static fn (array $f): bool => !empty($f['bild']))), 'Binnen: 73 Bildfragen mit eigener SVG');
pruefeGleich(9, count(array_filter($binnen['fragen'], static fn (array $f): bool => !empty($f['schall']))), 'Binnen: neun Fragen mit Schallsignal');
pruefeGleich('lk', $binnen['fragen']['binnen-162']['schall'] ?? null, 'Binnen 162: ein langer, ein kurzer Ton');
pruefe(str_starts_with(bildAltText($konfig, 'binnen', $binnen['fragen']['binnen-017']), 'Tafelzeichen: roter Rahmen'), 'Alt-Text kommt aus dem SVG-Titel');
pruefeGleich('Abbildung zur Frage', bildAltText($konfig, 'binnen', ['bild' => 'gibtsnicht.svg']), 'Alt-Text-Rückfall ohne Datei');
pruefeGleich('Eigener Text', bildAltText($konfig, 'binnen', ['bild' => '017.svg', 'bildText' => 'Eigener Text']), 'bildText der Frage hat Vorrang');
foreach (['src', 'lrc', 'ubi'] as $k) {
    pruefe(count(uebungenLaden($konfig, $k, 'diktat')) >= 3, "„{$k}“: mindestens drei Diktat-Übungen");
}
$dsc = dscSzenarienLaden($konfig);
pruefe(count(array_filter($dsc['szenarien'], static fn (array $s): bool => in_array('ubi', (array) ($s['zertifikat'] ?? ['ubi']), true))) >= 2, 'DSC: Szenarien für den Binnenfunk');
$mitAntwort = array_filter($dsc['szenarien'], static fn (array $s): bool => array_filter($s['erwartet'], static fn (array $e): bool => $e['aktion'] === 'ptt' && !empty($e['sprechtext'])) !== []);
pruefeGleich(count($dsc['szenarien']), count($mitAntwort), 'DSC: jedes Szenario hat einen Sprechfunk-Schritt mit Wortlaut');

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
