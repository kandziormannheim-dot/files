<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

$werkzeug = dirname(__DIR__) . '/werkzeuge/katalog-import.php';
$profile = dirname(__DIR__) . '/werkzeuge/import-profile';

function importAufrufen(string $profil, array $dateien, string $ziel, string $optionen = ''): array
{
    global $werkzeug;
    $eingaben = implode(' ', array_map(static fn (string $d): string => '--txt ' . escapeshellarg($d), $dateien));
    $befehl = sprintf('%s %s --profil %s %s --ziel %s %s 2>&1', escapeshellarg(PHP_BINARY), escapeshellarg($werkzeug), escapeshellarg($profil), $eingaben, escapeshellarg($ziel), $optionen);
    exec($befehl, $ausgabe, $code);
    $fragen = [];
    foreach ((jsonLesen($ziel) ?? [])['fragen'] ?? [] as $f) {
        $fragen[$f['id']] = $f;
    }

    return ['code' => $code, 'ausgabe' => implode(' | ', $ausgabe), 'katalog' => jsonLesen($ziel) ?? [], 'fragen' => $fragen];
}

// ------------------------------------------------------------------------
// 1. Funk-Katalog im Tabellenlayout (SRC 2018), Text wie ihn pdf-text.py liefert:
//    Kennung vor der ersten Zeile, Verweis „[N]“ irgendwo in der Zeile.
$verzeichnis = sys_get_temp_dir() . '/sbfkurs-import-' . bin2hex(random_bytes(4));
mkdir("$verzeichnis/src", 0700, true);
jsonSchreiben("$verzeichnis/src/zertifikat.json", ['id' => 'src', 'titel' => 'SRC', 'pruefung' => ['fragenProBogen' => 4, 'zeitMinuten' => 5, 'mindestRichtig' => 3]]);
jsonSchreiben("$verzeichnis/src/lektionen.json", ['lektionen' => [['slug' => '01-gmdss', 'titel' => 'GMDSS'], ['slug' => '10-pruefung', 'titel' => 'Prüfung']]]);
mkdir("$verzeichnis/src/lektionen", 0700, true);
file_put_contents("$verzeichnis/src/lektionen/01-gmdss.md", "Text");
file_put_contents("$verzeichnis/src/lektionen/10-pruefung.md", "Text");
// Bestehende Datei mit Hinweis, der beim Zusammenführen überleben soll, und einer Beispielfrage, die weichen muss
jsonSchreiben("$verzeichnis/src/fragen.json", ['zertifikat' => 'src', 'quelle' => ['amtlich' => false], 'module' => [['id' => 'gmdss', 'titel' => 'G']], 'fragen' => [
    ['id' => 'src-001', 'nr' => 1, 'modul' => 'gmdss', 'text' => 'alt', 'antworten' => ['a', 'b', 'c', 'd'], 'richtig' => 0, 'hinweis' => 'Bleibt erhalten', 'beispiel' => false],
    ['id' => 'src-099', 'nr' => 99, 'modul' => 'gmdss', 'text' => 'Beispiel', 'antworten' => ['a', 'b', 'c', 'd'], 'richtig' => 0, 'beispiel' => true],
]]);

$e = importAufrufen("$profile/elwis-src.json", [__DIR__ . '/fixtures/katalog-muster-src.txt'], "$verzeichnis/src/fragen.json", '--zusammenfuehren --stand 2018-10');
pruefeGleich(0, $e['code'], 'SRC-Import läuft durch: ' . $e['ausgabe']);
$fragen = $e['fragen'];
pruefeGleich(4, count($fragen), 'vier Fragen erkannt');
pruefeGleich('Wofür steht die Abkürzung GMDSS?', $fragen['src-001']['text'] ?? null, 'Verweis „[1]“ am Zeilenende entfernt');
pruefeGleich('Welches Funkzeugnis ist für die Bedienung einer UKW-Seefunkanlage mit DSC mindestens erforderlich?', $fragen['src-002']['text'] ?? null, 'Verweis nach der Nummer entfernt, Silbentrennung und Fortsetzungszeile zusammengezogen');
pruefeGleich('Beschränkt gültiges Funkbetriebszeugnis (Short Range Certificate [SRC])', $fragen['src-002']['antworten'][0] ?? null, 'mehrzeilige Antwort; „[SRC]“ ist kein Verweis');
pruefe(str_contains($fragen['src-003']['text'] ?? '', 'Sicherheits- und Anrufkanal im UKW-Seefunk?'), 'Verweis mitten im Fragetext entfernt, Fortsetzung angehängt');
pruefeGleich(['Kanal 16', 'Kanal 70', 'Kanal 06', 'Kanal 13'], $fragen['src-003']['antworten'] ?? null, 'Antworten „1)“ bis „4)“ in Reihenfolge');
pruefeGleich('gmdss', $fragen['src-001']['modul'] ?? null, 'Modul nach Fragennummer (1–23 → gmdss)');
pruefeGleich('gmdss', $fragen['src-004']['modul'] ?? null, 'Überschrift II schließt nur ab — Modul kommt aus modulNachNummer');
pruefeGleich('01-gmdss', $fragen['src-003']['lektion'] ?? null, 'Lektion je Modul zugeordnet');
pruefeGleich('Bleibt erhalten', $fragen['src-001']['hinweis'] ?? null, 'Hinweis beim Zusammenführen übernommen');
pruefe(!isset($fragen['src-099']), 'Beispielfrage verworfen');
pruefe(!empty($fragen['src-004']['pruefen']), 'Frage mit drei Antworten und Bildverweis als „prüfen“ markiert');
pruefeGleich(true, $e['katalog']['quelle']['amtlich'] ?? null, 'Quelle als amtlich markiert');
pruefeGleich('2018-10', $e['katalog']['quelle']['stand'] ?? null, 'Stand übernommen');
$bericht = jsonLesen("$verzeichnis/src/import-bericht.json") ?? [];
pruefe(isset($bericht['pruefen']['src-004']), 'Bericht nennt die zu prüfende Frage');
$alleTexte = implode(' ', array_map(static fn (array $f): string => $f['text'] . ' ' . implode(' ', $f['antworten']), $fragen));
pruefe(!str_contains($alleTexte, 'Alle Rechte') && !str_contains($alleTexte, 'Stand:') && !str_contains($alleTexte, 'GMDSS)'), 'Kopf-/Fußzeilen und Überschriftenrest entfernt');
pruefe(!preg_match('/\[\d+\]/', $alleTexte), 'kein Verweis „[N]“ mehr im Katalog');

// 2. Zweiter Katalog mit --anhaengen: eigenes Modul, Nummern per nummerOffset, Hauptkatalog bleibt
$e2 = importAufrufen("$profile/elwis-src-anpassung.json", [__DIR__ . '/fixtures/katalog-muster-src-anpassung.txt'], "$verzeichnis/src/fragen.json", '--anhaengen --stand 2011-10');
pruefeGleich(0, $e2['code'], 'Anpassungs-Import läuft durch: ' . $e2['ausgabe']);
pruefeGleich(6, count($e2['fragen']), 'vier Hauptfragen plus zwei angehängte');
pruefeGleich('anpassung', $e2['fragen']['src-501']['modul'] ?? null, 'Nummer 1 + Offset 500 → src-501 im Modul anpassung');
pruefeGleich('Medico-Gespräch', $e2['fragen']['src-502']['antworten'][0] ?? null, 'Inline-Antworten „1.“ bis „4.“ von der Fragennummer unterschieden');
pruefe(!str_contains($e2['fragen']['src-502']['antworten'][3] ?? '', 'FACHSTELLE'), 'Fußzeile nicht an die letzte Antwort geklebt');
pruefeGleich('10-pruefung', $e2['fragen']['src-501']['lektion'] ?? null, 'Lektion je Modul für den angehängten Katalog');
pruefeGleich('Wofür steht die Abkürzung GMDSS?', $e2['fragen']['src-001']['text'] ?? null, 'Hauptkatalog unverändert erhalten');
pruefeGleich(['gmdss', 'funkeinrichtungen', 'dsc', 'ukw', 'betriebsverfahren', 'navtex', 'sar', 'anpassung'], array_column($e2['katalog']['module'] ?? [], 'id'), 'Modulliste zusammengeführt');
pruefeGleich('2018-10', $e2['katalog']['quelle']['stand'] ?? null, 'Stand des Hauptkatalogs bleibt beim Anhängen');

// 3. SBF Binnen (Inline-Layout, ELWIS-Webdruck): Bilder und Schallsignale aus dem Profil
mkdir("$verzeichnis/binnen/bilder", 0700, true);
jsonSchreiben("$verzeichnis/binnen/zertifikat.json", ['id' => 'binnen', 'titel' => 'SBF Binnen', 'pruefung' => ['fragenProBogen' => 4, 'zeitMinuten' => 5, 'mindestRichtig' => 3]]);
jsonSchreiben("$verzeichnis/binnen/lektionen.json", ['lektionen' => []]);
file_put_contents("$verzeichnis/binnen/bilder/004.svg", '<svg xmlns="http://www.w3.org/2000/svg"><title>Kurzer Ton</title></svg>');
$e3 = importAufrufen("$profile/elwis-sbf-binnen.json", [__DIR__ . '/fixtures/katalog-muster-sbf-binnen.txt'], "$verzeichnis/binnen/fragen.json", '--stand 2023-08');
pruefeGleich(0, $e3['code'], 'Binnen-Import läuft durch: ' . $e3['ausgabe']);
pruefeGleich(4, count($e3['fragen']), 'vier Fragen über den Seitenumbruch hinweg');
pruefeGleich('004.svg', $e3['fragen']['binnen-004']['bild'] ?? null, 'Bild aus dem Profil zugeordnet');
pruefeGleich('k', $e3['fragen']['binnen-004']['schall'] ?? null, 'Schallsignal aus dem Profil zugeordnet');
pruefe(empty($e3['fragen']['binnen-004']['pruefen']), 'Bildfrage mit zugeordnetem Bild ist nicht „zu prüfen“');
pruefeGleich('Wie lang ist die Dauer eines kurzen Tons ( )?', $e3['fragen']['binnen-004']['text'] ?? null, 'Bildlücke im Fragetext bleibt lesbar');
pruefeGleich('basis', $e3['fragen']['binnen-003']['modul'] ?? null, 'Nummern 1–72 → Basisfragen');
$binnenTexte = implode(' ', array_map(static fn (array $f): string => $f['text'] . ' ' . implode(' ', $f['antworten']), $e3['fragen']));
pruefe(!str_contains($binnenTexte, 'ELWIS') && !str_contains($binnenTexte, 'von 3') && !str_contains($binnenTexte, 'Sie sind hier'), 'Webdruck-Kopfzeilen entfernt');

// 4. Mehrere Eingabedateien und Modulzuordnung nach Fragennummer (SBF See)
mkdir("$verzeichnis/see", 0700, true);
jsonSchreiben("$verzeichnis/see/zertifikat.json", ['id' => 'see', 'titel' => 'SBF See', 'pruefung' => ['fragenProBogen' => 4, 'zeitMinuten' => 5, 'mindestRichtig' => 3, 'zusammensetzung' => ['basis' => 2, 'see' => 2], 'mindestRichtigJeModul' => ['basis' => 1, 'see' => 2]]]);
jsonSchreiben("$verzeichnis/see/lektionen.json", ['lektionen' => []]);
$e4 = importAufrufen("$profile/elwis-sbf-see.json", [__DIR__ . '/fixtures/katalog-muster-sbf-basis.txt', __DIR__ . '/fixtures/katalog-muster-sbf-see.txt'], "$verzeichnis/see/fragen.json");
pruefeGleich(0, $e4['code'], 'SBF-Import aus zwei Dateien läuft durch: ' . $e4['ausgabe']);
$see = $e4['fragen'];
pruefeGleich(4, count($see), 'Fragen beider Dateien übernommen');
pruefeGleich('basis', $see['see-001']['modul'] ?? null, 'Nr. 1 → Basisfragen');
pruefeGleich('see', $see['see-073']['modul'] ?? null, 'Nr. 73 → spezifische Fragen See');
pruefe(str_contains($see['see-073']['text'] ?? '', 'in Fahrt?'), 'eingerückte Fortsetzungszeile angehängt');

// Aufräumen
foreach (['src/lektionen', 'src', 'binnen/bilder', 'binnen', 'see'] as $d) {
    foreach (glob("$verzeichnis/$d/*") ?: [] as $datei) {
        if (is_file($datei)) {
            unlink($datei);
        }
    }
    rmdir("$verzeichnis/$d");
}
rmdir($verzeichnis);

exit(testErgebnis());
