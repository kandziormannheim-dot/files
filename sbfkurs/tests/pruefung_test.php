<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

$konfig = testKonfig();
$db = testDb($konfig);
testSitzung();
$benutzerId = benutzerAnlegen($db, 'p@test.invalid', 'P', 'Passwort1234');

// Künstlicher Katalog mit genug Fragen je Modul
$z = zertifikatNormieren(['id' => 'tt', 'pruefung' => ['fragenProBogen' => 6, 'zeitMinuten' => 1, 'mindestRichtig' => 4, 'zusammensetzung' => ['a' => 4, 'b' => 2]]]);
$katalog = ['zertifikat' => 'tt', 'quelle' => ['amtlich' => true], 'module' => [['id' => 'a', 'titel' => 'A'], ['id' => 'b', 'titel' => 'B']], 'fragen' => []];
for ($i = 1; $i <= 12; $i++) {
    $id = sprintf('tt-%03d', $i);
    $katalog['fragen'][$id] = ['id' => $id, 'nr' => $i, 'modul' => $i <= 8 ? 'a' : 'b', 'text' => "Frage $i", 'antworten' => ['r', 'f1', 'f2', 'f3'], 'richtig' => 0, 'hinweis' => '', 'lektion' => null, 'beispiel' => false];
}

// Zufallsbogen nach Zusammensetzung
$bogen = bogenErzeugen($z, $katalog, [], 'zufall');
pruefeGleich(6, count($bogen['fragen']), 'Zufallsbogen hat fragenProBogen Fragen');
$ids = array_column($bogen['fragen'], 'frage_id');
pruefeGleich(6, count(array_unique($ids)), 'keine Frage doppelt');
$ausA = count(array_filter($ids, static fn (string $id): bool => $katalog['fragen'][$id]['modul'] === 'a'));
pruefeGleich(4, $ausA, 'vier Fragen aus Modul a');
pruefe(!$bogen['verkuerzt'] && !$bogen['aufgefuellt'], 'weder verkürzt noch aufgefüllt');
foreach ($bogen['fragen'] as $e) {
    pruefe(count($e['reihenfolge']) === 4 && array_sum($e['reihenfolge']) === 6, 'Permutation ist vollständig') ;
    break;
}

// Amtlicher Bogen
$boegen = [3 => [2, 4, 6, 8, 10, 12]];
$amtlich = bogenErzeugen($z, $katalog, $boegen, 'amtlich-3');
pruefeGleich('amtlich-3', $amtlich['bogen'], 'amtlicher Bogen wird benannt');
pruefeGleich(['tt-002', 'tt-004', 'tt-006', 'tt-008', 'tt-010', 'tt-012'], array_column($amtlich['fragen'], 'frage_id'), 'amtlicher Bogen liefert genau die Nummern in Reihenfolge');
$irgendein = bogenErzeugen($z, $katalog, $boegen, 'amtlich');
pruefeGleich('amtlich-3', $irgendein['bogen'], 'amtlich ohne Nummer wählt einen vorhandenen Bogen');

// Zu wenige Fragen: auffüllen und verkürzen
$klein = $katalog;
$klein['fragen'] = array_slice($katalog['fragen'], 0, 3, true);
$kleinBogen = bogenErzeugen($z, $klein, [], 'zufall');
pruefeGleich(3, count($kleinBogen['fragen']), 'kleiner Katalog: Bogen verkürzt');
pruefe($kleinBogen['verkuerzt'], 'verkuerzt-Kennzeichen gesetzt');
$mittel = $katalog;
$mittel['fragen'] = array_filter($katalog['fragen'], static fn (array $f): bool => $f['modul'] === 'a');
$mittelBogen = bogenErzeugen($z, $mittel, [], 'zufall');
pruefeGleich(6, count($mittelBogen['fragen']), 'fehlendes Modul wird aus dem Rest aufgefüllt');
pruefe($mittelBogen['aufgefuellt'], 'aufgefuellt-Kennzeichen gesetzt');

// Prüfung starten, bewerten, abgeben
$id = pruefungStarten($db, $benutzerId, 'tt', $z, $katalog, [], 'zufall');
pruefeGleich($id, pruefungStarten($db, $benutzerId, 'tt', $z, $katalog, [], 'zufall'), 'zweiter Start setzt die offene Prüfung fort');
$p = pruefungLaden($db, $benutzerId, $id);
pruefe($p !== null && count($p['antworten']) === 6, 'Prüfung mit Platzhalter-Antworten geladen');
pruefe(pruefungLaden($db, $benutzerId + 1, $id) === null, 'fremde Prüfung ist nicht ladbar');
pruefeGleich(60, (int) $p['zeitlimit_sek'], 'Zeitlimit aus zeitMinuten');
pruefe(restzeitSekunden($p) > 50 && restzeitSekunden($p) <= 60, 'Restzeit läuft ab dem Start');

// Alle richtig: Anzeigeposition der Originalantwort 0 finden
$eingaben = [];
foreach ($p['fragen'] as $i => $e) {
    $eingaben[$i + 1] = (string) array_search(0, $e['reihenfolge'], true);
}
$ergebnis = pruefungBewerten($p, $eingaben, $katalog);
pruefeGleich(6, $ergebnis['richtig'], 'Rückmischung: alle richtig');
pruefe($ergebnis['bestanden'] && !$ergebnis['ueberzogen'], 'bestanden, nicht überzogen');

// Drei falsch, eine unbeantwortet
$teil = $eingaben;
$teil[1] = (string) array_search(1, $p['fragen'][0]['reihenfolge'], true);
$teil[2] = (string) array_search(2, $p['fragen'][1]['reihenfolge'], true);
unset($teil[3]);
$ergebnis = pruefungBewerten($p, $teil, $katalog);
pruefeGleich(3, $ergebnis['richtig'], 'falsche und fehlende Antworten zählen nicht');
pruefe(!$ergebnis['bestanden'], 'unter der Schwelle nicht bestanden');
pruefe($ergebnis['antworten'][3]['gegeben'] === null, 'unbeantwortet bleibt null');

// Zeitüberschreitung
$spaet = pruefungBewerten($p, $eingaben, $katalog, pruefungEnde($p) + PRUEFUNG_KULANZ + 1);
pruefe($spaet['ueberzogen'], 'nach Ablauf plus Kulanz gilt überzogen');
$knapp = pruefungBewerten($p, $eingaben, $katalog, pruefungEnde($p) + 10);
pruefe(!$knapp['ueberzogen'], 'innerhalb der Kulanz nicht überzogen');

// Abgabe ist idempotent
$erg1 = pruefungAbgeben($db, $p, $teil, $katalog);
$p2 = pruefungLaden($db, $benutzerId, $id);
pruefe($p2['abgegeben_am'] !== null && (int) $p2['richtig'] === 3, 'Abgabe speichert das Ergebnis');
$erg2 = pruefungAbgeben($db, $p2, $eingaben, $katalog);
pruefeGleich(3, $erg2['richtig'], 'zweite Abgabe ändert nichts');
pruefeGleich(3, pruefungErgebnis(pruefungLaden($db, $benutzerId, $id))['richtig'], 'gespeichertes Ergebnis stimmt');

// Verkürzter Bogen: Schwelle anteilig
$klein = $katalog;
$klein['fragen'] = array_slice($katalog['fragen'], 0, 3, true);
$kid = pruefungStarten($db, $benutzerId, 'tt', $z, $klein, [], 'zufall');
$kp = pruefungLaden($db, $benutzerId, $kid);
$kerg = pruefungBewerten($kp, [], $klein);
pruefeGleich(2, $kerg['mindest'], 'verkürzter Bogen: Schwelle anteilig (4/6 von 3 → 2)');

exit(testErgebnis());
