<?php

/**
 * Lernstand: gelesene Lektionen, sichere Fragen, Prüfungsversuche und
 * Praxis-Ergebnisse zu einer Zahl und einer Ampel verdichten.
 */

declare(strict_types=1);

/** Kurs-Zeile anlegen bzw. die zuletzt geöffnete Lektion merken. */
function fortschrittBeruehren(PDO $db, int $benutzerId, string $zertifikat, ?string $lektion = null): void
{
    $db->prepare("INSERT INTO fortschritt (benutzer_id, zertifikat) VALUES (?, ?)
                  ON CONFLICT(benutzer_id, zertifikat) DO UPDATE SET aktualisiert_am = datetime('now')")
        ->execute([$benutzerId, $zertifikat]);
    if ($lektion !== null) {
        $db->prepare('UPDATE fortschritt SET aktuelle_lektion = ? WHERE benutzer_id = ? AND zertifikat = ?')
            ->execute([$lektion, $benutzerId, $zertifikat]);
    }
}

/** Lektion als gelesen markieren (mehrfach unschädlich). */
function lektionGelesen(PDO $db, int $benutzerId, string $zertifikat, string $lektion): void
{
    $db->prepare('INSERT OR IGNORE INTO lektion_gelesen (benutzer_id, zertifikat, lektion) VALUES (?, ?, ?)')
        ->execute([$benutzerId, $zertifikat, $lektion]);
    fortschrittBeruehren($db, $benutzerId, $zertifikat, $lektion);
}

/** Slugs der gelesenen Lektionen. */
function gelesetLektionen(PDO $db, int $benutzerId, string $zertifikat): array
{
    $abfrage = $db->prepare('SELECT lektion FROM lektion_gelesen WHERE benutzer_id = ? AND zertifikat = ?');
    $abfrage->execute([$benutzerId, $zertifikat]);

    return array_column($abfrage->fetchAll(), 'lektion');
}

/**
 * Der Lernstand eines Nutzers in einem Zertifikat. Prozent gewichtet:
 * 40 % Lektionen, 40 % sichere Fragen, 20 % bestandene Prüfungen.
 */
function lernstandBerechnen(PDO $db, array $konfig, int $benutzerId, string $zertifikat, ?array $z = null): array
{
    $z ??= zertifikatLaden($konfig, $zertifikat);
    if ($z === null) {
        return ['prozent' => 0, 'ampel' => 'rot'];
    }
    $lektionen = lektionenLaden($konfig, $zertifikat);
    $gelesen = gelesetLektionen($db, $benutzerId, $zertifikat);
    $gelesen = array_values(array_intersect($gelesen, array_keys($lektionen)));

    $katalog = fragenLaden($konfig, $zertifikat);
    $stand = fragenStandLaden($db, $benutzerId, $zertifikat);
    $sicherAb = (int) $z['trainer']['sicherAb'];
    $geuebt = 0;
    $sicher = 0;
    foreach ($katalog['fragen'] as $id => $frage) {
        if (isset($stand[$id])) {
            $geuebt++;
            if ((int) $stand[$id]['serie'] >= $sicherAb) {
                $sicher++;
            }
        }
    }

    $abfrage = $db->prepare('SELECT id, gestartet_am, abgegeben_am, richtig, gesamt, bestanden, ueberzogen, bogen
                             FROM pruefungen WHERE benutzer_id = ? AND zertifikat = ? AND abgegeben_am IS NOT NULL
                             ORDER BY abgegeben_am DESC LIMIT 5');
    $abfrage->execute([$benutzerId, $zertifikat]);
    $letzte = $abfrage->fetchAll();
    $zaehler = $db->prepare('SELECT COUNT(*) AS versuche, COALESCE(SUM(bestanden), 0) AS bestanden
                             FROM pruefungen WHERE benutzer_id = ? AND zertifikat = ? AND abgegeben_am IS NOT NULL');
    $zaehler->execute([$benutzerId, $zertifikat]);
    $pruefungen = $zaehler->fetch() ?: ['versuche' => 0, 'bestanden' => 0];

    $praxis = [];
    foreach ($z['praxis'] as $modul) {
        $praxis[$modul] = praxisStand($db, $konfig, $benutzerId, $zertifikat, $modul);
    }

    $offen = $db->prepare('SELECT id FROM pruefungen WHERE benutzer_id = ? AND zertifikat = ? AND abgegeben_am IS NULL ORDER BY id DESC LIMIT 1');
    $offen->execute([$benutzerId, $zertifikat]);

    $aktuell = $db->prepare('SELECT aktuelle_lektion FROM fortschritt WHERE benutzer_id = ? AND zertifikat = ?');
    $aktuell->execute([$benutzerId, $zertifikat]);
    $aktuelleLektion = (string) ($aktuell->fetchColumn() ?: '');
    // Die nächste ungelesene Lektion als Vorschlag, sonst die zuletzt geöffnete.
    $naechste = null;
    foreach ($lektionen as $slug => $l) {
        if (!in_array($slug, $gelesen, true)) {
            $naechste = $slug;
            break;
        }
    }
    $naechste ??= $aktuelleLektion !== '' && isset($lektionen[$aktuelleLektion]) ? $aktuelleLektion : array_key_first($lektionen);

    $anteilLektionen = count($lektionen) > 0 ? count($gelesen) / count($lektionen) : 0;
    $anteilFragen = count($katalog['fragen']) > 0 ? $sicher / count($katalog['fragen']) : 0;
    $letzteDrei = array_slice($letzte, 0, 3);
    $bestandeneDrei = count(array_filter($letzteDrei, static fn (array $p): bool => (int) $p['bestanden'] === 1));
    $anteilPruefungen = $letzteDrei === [] ? 0 : $bestandeneDrei / 3;
    $prozent = (int) round(($anteilLektionen * 0.4 + $anteilFragen * 0.4 + $anteilPruefungen * 0.2) * 100);

    $ampel = 'rot';
    if ($anteilLektionen >= 1 && $anteilFragen >= 0.9 && $bestandeneDrei === 3) {
        $ampel = 'gruen';
    } elseif ($anteilLektionen >= 0.4) {
        $ampel = 'gelb';
    }

    return [
        'zertifikat' => $z,
        'lektionen' => ['gelesen' => count($gelesen), 'gesamt' => count($lektionen), 'slugs' => $gelesen],
        'fragen' => ['geuebt' => $geuebt, 'sicher' => $sicher, 'gesamt' => count($katalog['fragen'])],
        'pruefungen' => ['versuche' => (int) $pruefungen['versuche'], 'bestanden' => (int) $pruefungen['bestanden'], 'letzte' => $letzte],
        'offenePruefung' => ($id = $offen->fetchColumn()) ? (int) $id : null,
        'praxis' => $praxis,
        'naechsteLektion' => $naechste,
        'prozent' => $prozent,
        'ampel' => $ampel,
        'beispielhaft' => $katalog['beispielhaft'],
    ];
}

/** Erledigte Übungen eines Praxismoduls: bestes Ergebnis ≥ 80 % zählt. */
function praxisStand(PDO $db, array $konfig, int $benutzerId, string $zertifikat, string $modul): array
{
    $uebergreifend = in_array($modul, ['buchstabieren', 'dsc'], true);
    $abfrage = $db->prepare('SELECT uebung_id, MAX(punkte * 100.0 / maximal) AS beste, COUNT(*) AS versuche
                             FROM uebung_ergebnisse WHERE benutzer_id = ? AND zertifikat = ? AND modul = ?
                             GROUP BY uebung_id');
    $abfrage->execute([$benutzerId, $uebergreifend ? '' : $zertifikat, $modul]);
    $beste = [];
    foreach ($abfrage->fetchAll() as $zeile) {
        $beste[$zeile['uebung_id']] = ['beste' => (int) round((float) $zeile['beste']), 'versuche' => (int) $zeile['versuche']];
    }

    if ($modul === 'buchstabieren') {
        // Kein fester Aufgabenvorrat: zehn Runden mit ≥ 80 % gelten als erledigt.
        $runden = count(array_filter($beste, static fn (array $b): bool => $b['beste'] >= 80));

        return ['erledigt' => min($runden, 10), 'gesamt' => 10, 'beste' => $beste];
    }
    if ($modul === 'dsc') {
        $szenarien = array_filter(
            dscSzenarienLaden($konfig)['szenarien'],
            static fn (array $s): bool => !isset($s['zertifikat']) || in_array($zertifikat, (array) $s['zertifikat'], true)
        );
        $ids = array_column($szenarien, 'id');
    } else {
        $ids = array_keys(uebungenLaden($konfig, $zertifikat, $modul));
    }
    $erledigt = 0;
    foreach ($ids as $id) {
        if (isset($beste[$id]) && $beste[$id]['beste'] >= 80) {
            $erledigt++;
        }
    }

    return ['erledigt' => $erledigt, 'gesamt' => count($ids), 'beste' => $beste];
}

/** Karten fürs Dashboard: alle sichtbaren Zertifikate mit Lernstand. */
function dashboardDaten(PDO $db, array $konfig, array $benutzer): array
{
    $karten = [];
    foreach (zertifikateLaden($konfig, !istAdmin($benutzer)) as $kennung => $z) {
        $karten[$kennung] = lernstandBerechnen($db, $konfig, (int) $benutzer['id'], $kennung, $z);
    }

    return $karten;
}
