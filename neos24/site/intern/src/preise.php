<?php

/**
 * Datenzugriff für Preise & Zielländer und die Routingmatrix.
 * Die Preisliste selbst (für Startseite und Checkout) liefert preisliste()
 * im Revolut-Unterbau aus denselben Tabellen.
 */

declare(strict_types=1);

function laenderAlle(): array
{
    return datenbank()->query('SELECT l.*, (SELECT COUNT(*) FROM routing r WHERE r.land_code = l.code) AS routen FROM laender l ORDER BY l.sortierung, l.code')->fetchAll();
}

function gewichtsklassenAlle(): array
{
    return datenbank()->query('SELECT g.*, (SELECT COUNT(*) FROM routing r WHERE r.gewichtsklasse_id = g.id) AS routen FROM gewichtsklassen g ORDER BY g.sortierung, g.id')->fetchAll();
}

function carrierAlle(): array
{
    return datenbank()->query('SELECT c.*, (SELECT COUNT(*) FROM routing r WHERE r.carrier_id = c.id) AS routen FROM carrier c ORDER BY c.aktiv DESC, c.name')->fetchAll();
}

function gewichtsklasseNachCode(string $code): ?array
{
    $st = datenbank()->prepare('SELECT * FROM gewichtsklassen WHERE code = ?');
    $st->execute([$code]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function landLaden(string $code): ?array
{
    $st = datenbank()->prepare('SELECT * FROM laender WHERE code = ?');
    $st->execute([$code]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/**
 * Matrix für die Übersicht: [landCode][gkCode] = ['carrier' => Prio-1-Name,
 * 'verkauf' => Cent, 'einkauf' => Cent, 'anzahl' => aktive Zeilen, 'aktiv' => bool].
 */
function routingMatrix(): array
{
    $matrix = [];
    $zeilen = datenbank()->query(<<<'SQL'
        SELECT r.land_code, g.code AS gk, c.name AS carrier, r.prioritaet, r.verkauf_cent, r.einkauf_cent, r.aktiv, c.aktiv AS carrier_aktiv
        FROM routing r JOIN gewichtsklassen g ON g.id = r.gewichtsklasse_id JOIN carrier c ON c.id = r.carrier_id
        ORDER BY r.land_code, g.sortierung, r.prioritaet
    SQL);
    foreach ($zeilen as $z) {
        $zelle = &$matrix[$z['land_code']][$z['gk']];
        $zelle ??= ['carrier' => null, 'verkauf' => null, 'einkauf' => null, 'anzahl' => 0, 'fallback' => []];
        $nutzbar = (int) $z['aktiv'] === 1 && (int) $z['carrier_aktiv'] === 1;
        if ($nutzbar) {
            $zelle['anzahl']++;
            if ($zelle['carrier'] === null) {
                $zelle['carrier'] = $z['carrier'];
                $zelle['verkauf'] = (int) $z['verkauf_cent'];
                $zelle['einkauf'] = (int) $z['einkauf_cent'];
            } else {
                $zelle['fallback'][] = $z['carrier'];
            }
        }
        unset($zelle);
    }

    return $matrix;
}

/** Die bis zu drei Zeilen einer Zelle, nach Priorität. */
function routingZelle(string $land, int $gkId): array
{
    $st = datenbank()->prepare('SELECT r.*, c.name AS carrier FROM routing r JOIN carrier c ON c.id = r.carrier_id WHERE r.land_code = ? AND r.gewichtsklasse_id = ? ORDER BY r.prioritaet');
    $st->execute([$land, $gkId]);

    return $st->fetchAll();
}

/**
 * Zelle speichern: $zeilen = [prio => ['carrier_id' => int, 'laufzeit_de', 'laufzeit_en',
 * 'einkauf_cent', 'verkauf_cent', 'aktiv']]. Leere Priorität = Zeile entfällt.
 */
function routingZelleSpeichern(string $land, int $gkId, array $zeilen, string $von): void
{
    $db = datenbank();
    $db->beginTransaction();
    try {
        $db->prepare('DELETE FROM routing WHERE land_code = ? AND gewichtsklasse_id = ?')->execute([$land, $gkId]);
        $st = $db->prepare(<<<'SQL'
            INSERT INTO routing (land_code, gewichtsklasse_id, carrier_id, prioritaet, laufzeit_de, laufzeit_en,
                                 einkauf_cent, verkauf_cent, aktiv, aktualisiert, aktualisiert_von)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        SQL);
        foreach ($zeilen as $prio => $z) {
            $st->execute([$land, $gkId, $z['carrier_id'], $prio, $z['laufzeit_de'], $z['laufzeit_en'], $z['einkauf_cent'], $z['verkauf_cent'], $z['aktiv'] ? 1 : 0, jetzt(), $von]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}
