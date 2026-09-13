<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

// Import gegen ein Text-Fixture, das die vermutete ELWIS-Struktur nachstellt.
$verzeichnis = sys_get_temp_dir() . '/sbfkurs-import-' . bin2hex(random_bytes(4));
mkdir("$verzeichnis/src", 0700, true);
// Minimales zertifikat.json, damit die Validierung läuft
jsonSchreiben("$verzeichnis/src/zertifikat.json", ['id' => 'src', 'titel' => 'SRC', 'pruefung' => ['fragenProBogen' => 4, 'zeitMinuten' => 5, 'mindestRichtig' => 3]]);
jsonSchreiben("$verzeichnis/src/lektionen.json", ['lektionen' => []]);
// Bestehende Datei mit Hinweis, der beim Zusammenführen überleben soll
jsonSchreiben("$verzeichnis/src/fragen.json", ['zertifikat' => 'src', 'quelle' => ['amtlich' => false], 'module' => [['id' => 'grundlagen', 'titel' => 'G']], 'fragen' => [
    ['id' => 'src-001', 'nr' => 1, 'modul' => 'grundlagen', 'text' => 'alt', 'antworten' => ['a', 'b', 'c', 'd'], 'richtig' => 0, 'hinweis' => 'Bleibt erhalten', 'beispiel' => false],
    ['id' => 'src-099', 'nr' => 99, 'modul' => 'grundlagen', 'text' => 'Beispiel', 'antworten' => ['a', 'b', 'c', 'd'], 'richtig' => 0, 'beispiel' => true],
]]);

$befehl = sprintf(
    '%s %s --profil %s --txt %s --ziel %s --zusammenfuehren --stand 2023-08 2>&1',
    escapeshellarg(PHP_BINARY),
    escapeshellarg(dirname(__DIR__) . '/werkzeuge/katalog-import.php'),
    escapeshellarg(dirname(__DIR__) . '/werkzeuge/import-profile/elwis-src.json'),
    escapeshellarg(__DIR__ . '/fixtures/katalog-muster.txt'),
    escapeshellarg("$verzeichnis/src/fragen.json")
);
exec($befehl, $ausgabe, $code);
pruefeGleich(0, $code, 'Import läuft durch: ' . implode(' | ', $ausgabe));

$katalog = jsonLesen("$verzeichnis/src/fragen.json") ?? [];
$fragen = [];
foreach ($katalog['fragen'] ?? [] as $f) {
    $fragen[$f['id']] = $f;
}
pruefeGleich(4, count($fragen), 'vier Fragen erkannt');
pruefeGleich('grundlagen', $fragen['src-001']['modul'] ?? null, 'Modul 1 zugeordnet');
pruefeGleich('verkehrsabwicklung', $fragen['src-003']['modul'] ?? null, 'Modulwechsel erkannt');
pruefeGleich('Welches Funkzeugnis ist für die Bedienung einer UKW-Seefunkanlage mit DSC mindestens erforderlich?', $fragen['src-002']['text'] ?? null, 'Silbentrennung und Fortsetzungszeile zusammengezogen');
pruefeGleich('Kanal 16', $fragen['src-003']['antworten'][0] ?? null, 'Antworten in Reihenfolge');
pruefe(str_contains($fragen['src-003']['text'] ?? '', 'Anrufkanal im UKW-Seefunk?'), 'mehrzeiliger Fragetext');
pruefeGleich('Bleibt erhalten', $fragen['src-001']['hinweis'] ?? null, 'Hinweis beim Zusammenführen übernommen');
pruefe(!isset($fragen['src-099']), 'Beispielfrage verworfen');
pruefe(!empty($fragen['src-004']['pruefen']), 'Frage mit drei Antworten und Bildverweis als „prüfen“ markiert');
pruefeGleich(true, $katalog['quelle']['amtlich'] ?? null, 'Quelle als amtlich markiert');
pruefeGleich('2023-08', $katalog['quelle']['stand'] ?? null, 'Stand übernommen');
$bericht = jsonLesen("$verzeichnis/src/import-bericht.json") ?? [];
pruefe(isset($bericht['pruefen']['src-004']), 'Bericht nennt die zu prüfende Frage');
pruefe(!str_contains(implode(' ', array_column($fragen, 'text')), 'Seite 1'), 'Kopf-/Fußzeilen entfernt');

// Aufräumen
foreach (glob("$verzeichnis/src/*") ?: [] as $d) { unlink($d); }
rmdir("$verzeichnis/src");
rmdir($verzeichnis);

exit(testErgebnis());
