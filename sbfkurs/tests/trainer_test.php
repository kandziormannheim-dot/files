<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

$konfig = testKonfig();
$db = testDb($konfig);
testSitzung();
$benutzerId = benutzerAnlegen($db, 't@test.invalid', 'T', 'Passwort1234');

$katalog = ['zertifikat' => 'tt', 'quelle' => [], 'module' => [['id' => 'a', 'titel' => 'A'], ['id' => 'b', 'titel' => 'B']], 'fragen' => []];
for ($i = 1; $i <= 6; $i++) {
    $id = sprintf('tt-%03d', $i);
    $katalog['fragen'][$id] = ['id' => $id, 'nr' => $i, 'modul' => $i <= 4 ? 'a' : 'b', 'text' => "Frage $i", 'antworten' => ['r', 'f1', 'f2', 'f3'], 'richtig' => 0, 'hinweis' => 'h', 'lektion' => null, 'beispiel' => false];
}

// Mischen und zurückrechnen
$gemischt = antwortenMischen($katalog['fragen']['tt-001']);
pruefeGleich(['f1', 'f2', 'f3', 'r'], (function (array $a): array { sort($a); return $a; })($gemischt['antworten']), 'Mischen behält alle Antworten');
$pos = array_search(0, $gemischt['permutation'], true);
pruefeGleich('r', $gemischt['antworten'][$pos], 'Permutation zeigt auf die richtige Antwort');
$ungemischt = antwortenMischen($katalog['fragen']['tt-001'], false);
pruefeGleich([0, 1, 2, 3], $ungemischt['permutation'], 'ohne Mischen Identität');

// Modus reihe
$f = naechsteFrage($db, $benutzerId, 'tt', $katalog, '', 'reihe', 0);
pruefeGleich('tt-001', $f['id'], 'reihe beginnt bei Nr. 1');
$f = naechsteFrage($db, $benutzerId, 'tt', $katalog, '', 'reihe', 4);
pruefeGleich('tt-005', $f['id'], 'reihe ab 4 liefert Nr. 5');
pruefe(naechsteFrage($db, $benutzerId, 'tt', $katalog, '', 'reihe', 6) === null, 'reihe endet nach der letzten');
pruefe(naechsteFrage($db, $benutzerId, 'tt', $katalog, 'b', 'reihe', 0)['modul'] === 'b', 'Modulfilter greift');
pruefe(naechsteFrage($db, $benutzerId, 'tt', $katalog, 'zz', 'zufall') === null, 'unbekanntes Modul liefert nichts');

// Wackelig ist anfangs leer
pruefe(naechsteFrage($db, $benutzerId, 'tt', $katalog, '', 'wackelig') === null, 'ohne Übung keine Wackelkandidaten');

// Antwort verbuchen: richtig, dann falsch
$g = trainerFrageVorbereiten($katalog['fragen']['tt-001'], true);
$posRichtig = array_search(0, $g['permutation'], true);
$a = antwortVerbuchen($db, $benutzerId, 'tt', $katalog, 'tt-001', $posRichtig, 'neu');
pruefe($a !== null && $a['richtig'], 'richtige Antwort erkannt');
pruefeGleich($posRichtig, $a['richtigePosition'], 'richtige Anzeigeposition zurückgegeben');
pruefe(antwortVerbuchen($db, $benutzerId, 'tt', $katalog, 'tt-001', 0, 'neu') === null, 'ohne vorbereitete Frage wird nichts verbucht');

$g = trainerFrageVorbereiten($katalog['fragen']['tt-001'], true);
$posFalsch = array_search(2, $g['permutation'], true);
$a = antwortVerbuchen($db, $benutzerId, 'tt', $katalog, 'tt-001', $posFalsch, 'neu');
pruefe($a !== null && !$a['richtig'], 'falsche Antwort erkannt');
$stand = fragenStandLaden($db, $benutzerId, 'tt');
pruefeGleich(1, (int) $stand['tt-001']['richtig_anzahl'], 'richtig gezählt');
pruefeGleich(1, (int) $stand['tt-001']['falsch_anzahl'], 'falsch gezählt');
pruefeGleich(0, (int) $stand['tt-001']['serie'], 'Serie bricht bei Fehler auf 0');

// Serie steigt
for ($i = 0; $i < 2; $i++) {
    $g = trainerFrageVorbereiten($katalog['fragen']['tt-001'], true);
    antwortVerbuchen($db, $benutzerId, 'tt', $katalog, 'tt-001', array_search(0, $g['permutation'], true), 'neu');
}
$stand = fragenStandLaden($db, $benutzerId, 'tt');
pruefeGleich(2, (int) $stand['tt-001']['serie'], 'zwei richtige in Folge');

// Modus neu bevorzugt Ungeübte
$gesehen = [];
for ($i = 0; $i < 20; $i++) {
    $f = naechsteFrage($db, $benutzerId, 'tt', $katalog, '', 'neu');
    $gesehen[$f['id']] = true;
}
pruefe(!isset($gesehen['tt-001']), 'neu meidet die schon sichere Frage');

// Wackelig nach einer falschen Antwort
$g = trainerFrageVorbereiten($katalog['fragen']['tt-002'], true);
antwortVerbuchen($db, $benutzerId, 'tt', $katalog, 'tt-002', array_search(3, $g['permutation'], true), 'neu');
$f = naechsteFrage($db, $benutzerId, 'tt', $katalog, '', 'wackelig');
pruefeGleich('tt-002', $f['id'], 'wackelig liefert die falsch beantwortete Frage');

$statistik = trainerStatistik($db, $benutzerId, 'tt', $katalog, 2);
pruefeGleich(4, $statistik['module']['a']['gesamt'], 'Statistik: gesamt je Modul');
pruefeGleich(2, $statistik['module']['a']['geuebt'], 'Statistik: geübt');
pruefeGleich(1, $statistik['module']['a']['sicher'], 'Statistik: sicher');
pruefeGleich(1, $statistik['module']['a']['wackelig'], 'Statistik: wackelig');
pruefeGleich('tt-002', $statistik['wackelkandidaten'][0]['id'], 'Wackelkandidat gelistet');

exit(testErgebnis());
