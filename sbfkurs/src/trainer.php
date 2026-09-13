<?php

/**
 * Lerntrainer: nächste Frage wählen, Antwort verbuchen, Stand je Frage
 * fortschreiben. Antworten werden gemischt angezeigt; die Permutation liegt
 * in der Sitzung, damit die Auswertung die Katalogreihenfolge zurückrechnet.
 */

declare(strict_types=1);

const TRAINER_MODI = [
    'neu' => 'Neue zuerst',
    'wackelig' => 'Wackelkandidaten',
    'zufall' => 'Zufällig',
    'reihe' => 'Der Reihe nach',
];

/** Stand aller Fragen eines Nutzers in einem Zertifikat, nach frage_id. */
function fragenStandLaden(PDO $db, int $benutzerId, string $zertifikat): array
{
    $abfrage = $db->prepare('SELECT * FROM fragen_stand WHERE benutzer_id = ? AND zertifikat = ?');
    $abfrage->execute([$benutzerId, $zertifikat]);
    $stand = [];
    foreach ($abfrage->fetchAll() as $zeile) {
        $stand[$zeile['frage_id']] = $zeile;
    }

    return $stand;
}

/**
 * Antworten einer Frage mischen. Liefert ['permutation' => [Anzeigeposition
 * => Katalogindex], 'antworten' => [...]]. Ohne Mischen ist die Permutation
 * die Identität — die Auswertung läuft dann denselben Weg.
 */
function antwortenMischen(array $frage, bool $mischen = true): array
{
    $indizes = array_keys($frage['antworten']);
    if ($mischen) {
        shuffle($indizes);
    }
    $antworten = [];
    foreach ($indizes as $i) {
        $antworten[] = $frage['antworten'][$i];
    }

    return ['permutation' => $indizes, 'antworten' => $antworten];
}

/**
 * Die nächste Frage nach Modus und Modul. Modul '' bedeutet alle. Die letzten
 * fünf Fragen der Sitzung werden gemieden, damit nichts sofort wiederkommt.
 */
function naechsteFrage(PDO $db, int $benutzerId, string $zertifikat, array $katalog, string $modul, string $modus, int $ab = 0, int $sicherAb = 2): ?array
{
    $fragen = $katalog['fragen'];
    if ($modul !== '') {
        $fragen = array_filter($fragen, static fn (array $f): bool => $f['modul'] === $modul);
    }
    if ($fragen === []) {
        return null;
    }
    $stand = fragenStandLaden($db, $benutzerId, $zertifikat);
    $zuletzt = $_SESSION['trainer']['zuletzt'] ?? [];

    if ($modus === 'reihe') {
        uasort($fragen, static fn (array $a, array $b): int => ($a['nr'] ?? 0) <=> ($b['nr'] ?? 0));
        foreach ($fragen as $f) {
            if ((int) ($f['nr'] ?? 0) > $ab) {
                return $f;
            }
        }

        return null; // Ende der Reihe
    }

    $kandidaten = [];
    if ($modus === 'wackelig') {
        foreach ($fragen as $id => $f) {
            if (isset($stand[$id]) && (int) $stand[$id]['serie'] < $sicherAb) {
                $kandidaten[$id] = $f;
            }
        }
        if ($kandidaten === []) {
            return null; // alles sicher
        }
    } elseif ($modus === 'neu') {
        foreach ($fragen as $id => $f) {
            if (!isset($stand[$id])) {
                $kandidaten[$id] = $f;
            }
        }
        if ($kandidaten === []) {
            // Alles schon gesehen: dann die wackeligen, sonst alles.
            foreach ($fragen as $id => $f) {
                if ((int) $stand[$id]['serie'] < $sicherAb) {
                    $kandidaten[$id] = $f;
                }
            }
        }
        if ($kandidaten === []) {
            $kandidaten = $fragen;
        }
    } else {
        $kandidaten = $fragen;
    }

    $frisch = array_diff_key($kandidaten, array_flip($zuletzt));
    if ($frisch !== []) {
        $kandidaten = $frisch;
    }
    $ids = array_keys($kandidaten);

    return $kandidaten[$ids[random_int(0, count($ids) - 1)]];
}

/** Frage für die Anzeige vorbereiten und die Permutation in der Sitzung ablegen. */
function trainerFrageVorbereiten(array $frage, bool $mischen): array
{
    $gemischt = antwortenMischen($frage, $mischen);
    $_SESSION['trainer']['aktuell'] = ['frage_id' => $frage['id'], 'permutation' => $gemischt['permutation']];

    return $gemischt;
}

/**
 * Antwort aus dem Formular auswerten und verbuchen. Liefert die Auflösung
 * oder null, wenn keine passende Frage in der Sitzung liegt.
 */
function antwortVerbuchen(PDO $db, int $benutzerId, string $zertifikat, array $katalog, string $frageId, int $gewaehlt, string $modus): ?array
{
    $aktuell = $_SESSION['trainer']['aktuell'] ?? null;
    if ($aktuell === null || $aktuell['frage_id'] !== $frageId || !isset($katalog['fragen'][$frageId])) {
        return null;
    }
    $frage = $katalog['fragen'][$frageId];
    $permutation = $aktuell['permutation'];
    if (!isset($permutation[$gewaehlt])) {
        return null;
    }
    $original = (int) $permutation[$gewaehlt];
    $richtig = $original === (int) $frage['richtig'];

    $db->beginTransaction();
    $db->prepare('INSERT INTO trainer_antworten (benutzer_id, zertifikat, frage_id, gegeben, richtig, modus) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$benutzerId, $zertifikat, $frageId, $original, $richtig ? 1 : 0, $modus]);
    $db->prepare("INSERT INTO fragen_stand (benutzer_id, zertifikat, frage_id, richtig_anzahl, falsch_anzahl, serie)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(benutzer_id, zertifikat, frage_id) DO UPDATE SET
                      richtig_anzahl = richtig_anzahl + excluded.richtig_anzahl,
                      falsch_anzahl = falsch_anzahl + excluded.falsch_anzahl,
                      serie = CASE WHEN excluded.serie = 0 THEN 0 ELSE serie + 1 END,
                      zuletzt_am = datetime('now')")
        ->execute([$benutzerId, $zertifikat, $frageId, $richtig ? 1 : 0, $richtig ? 0 : 1, $richtig ? 1 : 0]);
    $db->commit();
    fortschrittBeruehren($db, $benutzerId, $zertifikat);

    $zuletzt = $_SESSION['trainer']['zuletzt'] ?? [];
    $zuletzt[] = $frageId;
    $_SESSION['trainer']['zuletzt'] = array_slice($zuletzt, -5);
    unset($_SESSION['trainer']['aktuell']);

    // Position der richtigen Antwort in der angezeigten Reihenfolge
    $richtigePosition = array_search((int) $frage['richtig'], $permutation, true);

    return [
        'frage' => $frage,
        'richtig' => $richtig,
        'gewaehlt' => $gewaehlt,
        'richtigePosition' => $richtigePosition === false ? 0 : (int) $richtigePosition,
        'permutation' => $permutation,
    ];
}

/** Statistik je Modul: gesamt / geübt / sicher / wackelig, dazu die Wackelkandidaten. */
function trainerStatistik(PDO $db, int $benutzerId, string $zertifikat, array $katalog, int $sicherAb): array
{
    $stand = fragenStandLaden($db, $benutzerId, $zertifikat);
    $module = [];
    foreach ($katalog['module'] as $m) {
        $module[$m['id']] = ['titel' => $m['titel'] ?? $m['id'], 'gesamt' => 0, 'geuebt' => 0, 'sicher' => 0, 'wackelig' => 0];
    }
    $wackelkandidaten = [];
    foreach ($katalog['fragen'] as $id => $f) {
        if (!isset($module[$f['modul']])) {
            continue;
        }
        $module[$f['modul']]['gesamt']++;
        if (!isset($stand[$id])) {
            continue;
        }
        $module[$f['modul']]['geuebt']++;
        if ((int) $stand[$id]['serie'] >= $sicherAb) {
            $module[$f['modul']]['sicher']++;
        } else {
            $module[$f['modul']]['wackelig']++;
            $wackelkandidaten[] = $f + ['stand' => $stand[$id]];
        }
    }
    usort($wackelkandidaten, static fn (array $a, array $b): int => ($b['stand']['falsch_anzahl'] <=> $a['stand']['falsch_anzahl']) ?: (($a['nr'] ?? 0) <=> ($b['nr'] ?? 0)));

    return ['module' => $module, 'wackelkandidaten' => $wackelkandidaten];
}
