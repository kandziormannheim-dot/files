<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

$konfig = testKonfig();

// Normalisierung und Toleranz
pruefeGleich('MAYDAY SEEADLER', textNormieren('  mayday,  Seeadler! '), 'Normalisierung: Groß, Satzzeichen, Leerraum');
pruefeGleich(1.0, eingabeBewerten('mayday', ['MAYDAY']), 'exakter Treffer');
pruefeGleich(0.5, eingabeBewerten('SEADLER', ['SEEADLER']), 'ein Tippfehler bei langem Wort: halber Punkt');
pruefeGleich(0.0, eingabeBewerten('PAN', ['MAYDAY']), 'kein Treffer');
pruefeGleich(0.0, eingabeBewerten('OVR', ['OVER']), 'kurze Wörter ohne Toleranz');
pruefeGleich(1.0, eingabeBewerten('2 nm south of kiel lighthouse', ['2 NM SOUTH OF KIEL LIGHTHOUSE', 'x']), 'eine von mehreren Lösungen');

// Lückentext
$uebung = ['text' => "{{1}} {{1}} {{1}}\nTHIS IS {{2}}\n{{3}}", 'luecken' => ['1' => ['loesung' => ['MAYDAY']], '2' => ['loesung' => ['SEEADLER']], '3' => ['loesung' => ['OVER']]]];
$e = lueckentextAuswerten($uebung, ['1' => 'Mayday', '2' => 'SEADLER', '3' => '']);
pruefeGleich(6, $e['maximal'], 'drei Lücken → sechs halbe Punkte');
pruefeGleich(3, $e['punkte'], '1 + 0,5 + 0 Punkte → 3 halbe');
pruefeGleich(['1', '2', '3'], $e['nummern'], 'Nummern ohne Wiederholung');

// Reihenfolge
$r = reihenfolgeAuswerten(['loesung' => [0, 1, 2, 3]], [0, 2, 1, 3]);
pruefeGleich(2, $r['punkte'], 'Reihenfolge: zwei Positionen richtig');
pruefeGleich(4, reihenfolgeAuswerten(['loesung' => [0, 1, 2, 3]], [0, 1, 2, 3])['punkte'], 'alles richtig');

// Englisch
$u = ['schluesselwoerter' => [['Container'], ['treibt', 'treibend'], ['Gefahr']], 'mindestTreffer' => 2];
$en = englischAuswerten($u, 'Ein Container ist treibend, Position unbekannt.');
pruefeGleich(2, $en['anzahl'], 'zwei Schlüsselwörter, eines per Variante');
pruefeGleich('richtig', $en['vorschlag'], 'Mindesttreffer erreicht → richtig');
pruefeGleich('falsch', englischAuswerten($u, 'nichts')['vorschlag'], 'kein Treffer → falsch');
pruefeGleich('teilweise', englischAuswerten($u, 'Gefahr!')['vorschlag'], 'ein Treffer → teilweise');

// Buchstabieren
$tafel = buchstabiertafelLaden($konfig);
$aufgabe = ['richtung' => 'buchstabieren', 'wort' => 'AJ1', 'codewoerter' => ['Alfa', 'Juliett', 'Unaone']];
$b = buchstabierAuswerten($tafel, $aufgabe, 'Alpha Juliet one');
pruefeGleich(3, $b['punkte'], 'Alpha/Alfa, Juliet/Juliett und One/Unaone werden akzeptiert');
$b = buchstabierAuswerten($tafel, $aufgabe, 'Alfa Bravo');
pruefeGleich(1, $b['punkte'], 'falsche und fehlende Codewörter zählen nicht');
$lesen = ['richtung' => 'lesen', 'wort' => 'KIEL', 'codewoerter' => ['Kilo', 'India', 'Echo', 'Lima']];
pruefeGleich(1, buchstabierAuswerten($tafel, $lesen, 'kiel')['punkte'], 'Lesen: Wort erkannt');
pruefeGleich(0, buchstabierAuswerten($tafel, $lesen, 'kiev')['punkte'], 'Lesen: falsches Wort');
$zufall = buchstabierAufgabe($tafel);
pruefeGleich(mb_strlen($zufall['wort']), count($zufall['codewoerter']), 'Aufgabe: ein Codewort je Zeichen');

// Speichern und Praxisstand
$db = testDb($konfig);
$benutzerId = benutzerAnlegen($db, 'u@test.invalid', 'U', 'Passwort1234');
uebungErgebnisSpeichern($db, $benutzerId, 'src', 'funkverkehr', 'x', 3, 6);
uebungErgebnisSpeichern($db, $benutzerId, 'src', 'funkverkehr', 'x', 6, 6);
$stand = praxisStand($db, $konfig, $benutzerId, 'src', 'funkverkehr');
pruefeGleich(100, $stand['beste']['x']['beste'], 'bestes Ergebnis zählt');
pruefeGleich(2, $stand['beste']['x']['versuche'], 'Versuche gezählt');

exit(testErgebnis());
