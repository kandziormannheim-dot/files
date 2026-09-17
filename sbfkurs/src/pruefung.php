<?php

/**
 * Prüfungssimulation: Bogen zusammenstellen (amtlich oder nach
 * Modulzusammensetzung), Lauf speichern, Zeit prüfen, bewerten. Die
 * Serverzeit ist maßgeblich; der Timer im Browser ist nur Anzeige.
 */

declare(strict_types=1);

/** Kulanz in Sekunden zwischen Ablauf des Timers und „überzogen“. */
const PRUEFUNG_KULANZ = 60;

/**
 * Bogen erzeugen. $wunsch: 'zufall', 'amtlich' (irgendein Bogen) oder
 * 'amtlich-N'. Liefert ['bogen' => …, 'fragen' => [['frage_id', 'reihenfolge'], …],
 * 'verkuerzt' => bool, 'aufgefuellt' => bool].
 */
function bogenErzeugen(array $zertifikat, array $katalog, array $boegen, string $wunsch = 'zufall'): array
{
    $regeln = $zertifikat['pruefung'];
    $soll = (int) $regeln['fragenProBogen'];
    $fragen = $katalog['fragen'];
    $gewaehlt = [];
    $bogenName = 'zufall';
    $aufgefuellt = false;

    if ($boegen !== [] && str_starts_with($wunsch, 'amtlich')) {
        $nr = (int) substr($wunsch, 8);
        if (!isset($boegen[$nr])) {
            $nummern = array_keys($boegen);
            $nr = $nummern[random_int(0, count($nummern) - 1)];
        }
        $nachNr = [];
        foreach ($fragen as $id => $f) {
            if (isset($f['nr'])) {
                $nachNr[(int) $f['nr']] = $id;
            }
        }
        foreach ($boegen[$nr] as $fnr) {
            if (!isset($nachNr[$fnr])) {
                throw new RuntimeException("Bogen $nr verweist auf Frage Nr. $fnr, die es nicht gibt.");
            }
            $gewaehlt[] = $nachNr[$fnr];
        }
        $bogenName = 'amtlich-' . $nr;
    } else {
        $zusammensetzung = $regeln['zusammensetzung'];
        if ($zusammensetzung === []) {
            // Gleichmäßig über alle Module
            $module = array_column($katalog['module'], 'id');
            $je = $module === [] ? $soll : intdiv($soll, count($module));
            foreach ($module as $m) {
                $zusammensetzung[$m] = $je;
            }
            $rest = $soll - array_sum($zusammensetzung);
            if ($rest > 0 && $module !== []) {
                $zusammensetzung[$module[0]] += $rest;
            }
        }
        foreach ($zusammensetzung as $modul => $anzahl) {
            $ids = array_keys(array_filter($fragen, static fn (array $f): bool => $f['modul'] === $modul));
            shuffle($ids);
            $gewaehlt = array_merge($gewaehlt, array_slice($ids, 0, (int) $anzahl));
        }
        // Hat ein Modul zu wenige Fragen (Beispielkatalog!), aus dem Rest auffüllen.
        if (count($gewaehlt) < $soll) {
            $rest = array_diff(array_keys($fragen), $gewaehlt);
            shuffle($rest);
            $fehlend = $soll - count($gewaehlt);
            $nachschub = array_slice($rest, 0, $fehlend);
            $aufgefuellt = $nachschub !== [];
            $gewaehlt = array_merge($gewaehlt, $nachschub);
        }
        if (!empty($regeln['fragenMischen'])) {
            shuffle($gewaehlt);
        }
    }

    $eintraege = [];
    foreach ($gewaehlt as $id) {
        $gemischt = antwortenMischen($fragen[$id], !empty($regeln['antwortenMischen']));
        $eintraege[] = ['frage_id' => $id, 'reihenfolge' => $gemischt['permutation']];
    }

    return [
        'bogen' => $bogenName,
        'fragen' => $eintraege,
        'verkuerzt' => count($eintraege) < $soll,
        'aufgefuellt' => $aufgefuellt,
    ];
}

/** Prüfung anlegen und ID liefern; eine offene Prüfung desselben Zertifikats wird fortgesetzt. */
function pruefungStarten(PDO $db, int $benutzerId, string $zertifikat, array $z, array $katalog, array $boegen, string $wunsch): int
{
    $offen = $db->prepare('SELECT id FROM pruefungen WHERE benutzer_id = ? AND zertifikat = ? AND abgegeben_am IS NULL ORDER BY id DESC LIMIT 1');
    $offen->execute([$benutzerId, $zertifikat]);
    if (($id = $offen->fetchColumn()) !== false) {
        return (int) $id;
    }

    $bogen = bogenErzeugen($z, $katalog, $boegen, $wunsch);
    $regeln = $z['pruefung'];
    $regeln['verkuerzt'] = $bogen['verkuerzt'];
    $regeln['aufgefuellt'] = $bogen['aufgefuellt'];
    unset($regeln['weitereTeile']);

    $db->beginTransaction();
    $db->prepare('INSERT INTO pruefungen (benutzer_id, zertifikat, bogen, fragen_json, zeitlimit_sek, gesamt, regeln_json)
                  VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $benutzerId,
            $zertifikat,
            $bogen['bogen'],
            json_encode($bogen['fragen'], JSON_UNESCAPED_UNICODE),
            (int) $regeln['zeitMinuten'] * 60,
            count($bogen['fragen']),
            json_encode($regeln, JSON_UNESCAPED_UNICODE),
        ]);
    $id = (int) $db->lastInsertId();
    $einfuegen = $db->prepare('INSERT INTO pruefung_antworten (pruefung_id, position, frage_id) VALUES (?, ?, ?)');
    foreach ($bogen['fragen'] as $i => $eintrag) {
        $einfuegen->execute([$id, $i + 1, $eintrag['frage_id']]);
    }
    $db->commit();
    fortschrittBeruehren($db, $benutzerId, $zertifikat);

    return $id;
}

/** Prüfung eines Nutzers laden — nur die eigene. */
function pruefungLaden(PDO $db, int $benutzerId, int $id): ?array
{
    $abfrage = $db->prepare('SELECT * FROM pruefungen WHERE id = ? AND benutzer_id = ?');
    $abfrage->execute([$id, $benutzerId]);
    $p = $abfrage->fetch();
    if ($p === false) {
        return null;
    }
    $p['fragen'] = json_decode((string) $p['fragen_json'], true) ?: [];
    $p['regeln'] = json_decode((string) $p['regeln_json'], true) ?: [];
    $antworten = $db->prepare('SELECT * FROM pruefung_antworten WHERE pruefung_id = ? ORDER BY position');
    $antworten->execute([$id]);
    $p['antworten'] = [];
    foreach ($antworten->fetchAll() as $a) {
        $p['antworten'][(int) $a['position']] = $a;
    }

    return $p;
}

/** Unix-Zeit, zu der die Prüfung endet. */
function pruefungEnde(array $pruefung): int
{
    return (int) strtotime($pruefung['gestartet_am'] . ' UTC') + (int) $pruefung['zeitlimit_sek'];
}

function restzeitSekunden(array $pruefung): int
{
    return pruefungEnde($pruefung) - time();
}

/**
 * Bewerten. $eingaben: [position => Anzeigeindex]. Liefert den Ergebnis-
 * Datensatz; verändert nichts in der Datenbank.
 */
function pruefungBewerten(array $pruefung, array $eingaben, array $katalog, ?int $jetzt = null): array
{
    $jetzt ??= time();
    $regeln = $pruefung['regeln'];
    $richtig = 0;
    $antworten = [];
    foreach ($pruefung['fragen'] as $i => $eintrag) {
        $position = $i + 1;
        $frage = $katalog['fragen'][$eintrag['frage_id']] ?? null;
        $gegeben = null;
        $istRichtig = false;
        if ($frage !== null && isset($eingaben[$position]) && $eingaben[$position] !== '') {
            $anzeige = (int) $eingaben[$position];
            if (isset($eintrag['reihenfolge'][$anzeige])) {
                $gegeben = (int) $eintrag['reihenfolge'][$anzeige];
                $istRichtig = $gegeben === (int) $frage['richtig'];
            }
        }
        if ($istRichtig) {
            $richtig++;
        }
        $antworten[$position] = ['frage_id' => $eintrag['frage_id'], 'gegeben' => $gegeben, 'richtig' => $istRichtig];
    }
    $gesamt = count($pruefung['fragen']);
    $mindest = (int) ($regeln['mindestRichtig'] ?? 0);
    // Verkürzter Bogen (Beispielkatalog): Schwelle anteilig
    if ($gesamt > 0 && $gesamt < (int) ($regeln['fragenProBogen'] ?? $gesamt)) {
        $mindest = (int) ceil($mindest * $gesamt / (int) $regeln['fragenProBogen']);
    }
    $ueberzogen = $jetzt > pruefungEnde($pruefung) + PRUEFUNG_KULANZ;

    return [
        'richtig' => $richtig,
        'gesamt' => $gesamt,
        'mindest' => $mindest,
        'bestanden' => $richtig >= $mindest,
        'ueberzogen' => $ueberzogen,
        'dauer' => max(0, $jetzt - (int) strtotime($pruefung['gestartet_am'] . ' UTC')),
        'antworten' => $antworten,
    ];
}

/** Abgeben: bewerten und speichern. Ein zweites Abgeben ändert nichts. */
function pruefungAbgeben(PDO $db, array $pruefung, array $eingaben, array $katalog): array
{
    if ($pruefung['abgegeben_am'] !== null) {
        return pruefungErgebnis($pruefung);
    }
    $ergebnis = pruefungBewerten($pruefung, $eingaben, $katalog);

    $db->beginTransaction();
    $db->prepare("UPDATE pruefungen SET abgegeben_am = datetime('now'), richtig = ?, bestanden = ?, ueberzogen = ?
                  WHERE id = ? AND abgegeben_am IS NULL")
        ->execute([$ergebnis['richtig'], $ergebnis['bestanden'] ? 1 : 0, $ergebnis['ueberzogen'] ? 1 : 0, (int) $pruefung['id']]);
    $update = $db->prepare('UPDATE pruefung_antworten SET gegeben = ?, richtig = ? WHERE pruefung_id = ? AND position = ?');
    foreach ($ergebnis['antworten'] as $position => $a) {
        $update->execute([$a['gegeben'], $a['richtig'] ? 1 : 0, (int) $pruefung['id'], $position]);
    }
    $db->commit();

    return $ergebnis;
}

/** Ergebnis einer bereits abgegebenen Prüfung aus den gespeicherten Daten. */
function pruefungErgebnis(array $pruefung): array
{
    $regeln = $pruefung['regeln'];
    $gesamt = (int) $pruefung['gesamt'];
    $mindest = (int) ($regeln['mindestRichtig'] ?? 0);
    if ($gesamt > 0 && $gesamt < (int) ($regeln['fragenProBogen'] ?? $gesamt)) {
        $mindest = (int) ceil($mindest * $gesamt / (int) $regeln['fragenProBogen']);
    }
    $antworten = [];
    foreach ($pruefung['antworten'] as $position => $a) {
        $antworten[$position] = ['frage_id' => $a['frage_id'], 'gegeben' => $a['gegeben'] === null ? null : (int) $a['gegeben'], 'richtig' => (int) $a['richtig'] === 1];
    }
    $dauer = $pruefung['abgegeben_am'] !== null
        ? (int) strtotime($pruefung['abgegeben_am'] . ' UTC') - (int) strtotime($pruefung['gestartet_am'] . ' UTC')
        : 0;

    return [
        'richtig' => (int) $pruefung['richtig'],
        'gesamt' => $gesamt,
        'mindest' => $mindest,
        'bestanden' => (int) $pruefung['bestanden'] === 1,
        'ueberzogen' => (int) $pruefung['ueberzogen'] === 1,
        'dauer' => max(0, $dauer),
        'antworten' => $antworten,
    ];
}

/** Alle abgegebenen Prüfungen eines Nutzers in einem Zertifikat, neueste zuerst. */
function pruefungenVerlauf(PDO $db, int $benutzerId, string $zertifikat): array
{
    $abfrage = $db->prepare('SELECT * FROM pruefungen WHERE benutzer_id = ? AND zertifikat = ? AND abgegeben_am IS NOT NULL ORDER BY abgegeben_am DESC LIMIT 20');
    $abfrage->execute([$benutzerId, $zertifikat]);

    return $abfrage->fetchAll();
}
