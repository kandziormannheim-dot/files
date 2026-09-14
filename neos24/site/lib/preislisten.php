<?php

/**
 * Kundenpreislisten: je Kunde oder Firma eine eigene Verkaufsmatrix
 * (Land × Gewichtsklasse × Carrier, netto) plus eigene Preise für
 * Zusatzleistungen. Ohne Liste gilt die Routingmatrix (routing.verkauf_cent).
 * Zellen, die in der Liste fehlen, fallen je Liste auf den Standard zurück
 * („standard“) oder werden nicht angeboten („nicht“).
 *
 * Die Liste wird an der Bestellung gespeichert (bestellungen.preisliste_id),
 * damit die Rechnungsprüfung eine Nachberechnung mit denselben Konditionen
 * rechnet, die beim Buchen galten.
 */

declare(strict_types=1);

require_once __DIR__ . '/einkauf_import.php';

function preislisteLaden(int $id): ?array
{
    static $cache = [];
    if ($id <= 0) {
        return null;
    }
    if (!array_key_exists($id, $cache)) {
        $st = datenbank()->prepare('SELECT p.*, f.name AS firma, k.name AS kunde_name, k.email AS kunde_email FROM preislisten p LEFT JOIN firmen f ON f.id = p.firma_id LEFT JOIN kunden k ON k.id = p.kunde_id WHERE p.id = ?');
        $st->execute([$id]);
        $z = $st->fetch();
        $cache[$id] = is_array($z) ? $z : null;
    }

    return $cache[$id];
}

/** Zwischenspeicher leeren (nach Änderungen im Dashboard). */
function preislistenCacheLeeren(): void
{
    angeboteFuer('', '', null, true);
}

/**
 * Aktive Preisliste eines Kontos: Firma vor Kunde. $konto braucht id und/oder
 * firma_id (Portal-Konto, Kunden- oder Firmenzeile, Bestellung).
 */
function preislisteFuerKonto(array $konto): ?int
{
    $db = datenbank();
    $firmaId = (int) ($konto['firma_id'] ?? 0);
    if ($firmaId > 0) {
        $st = $db->prepare('SELECT f.preisliste_id FROM firmen f JOIN preislisten p ON p.id = f.preisliste_id AND p.aktiv = 1 WHERE f.id = ?');
        $st->execute([$firmaId]);
        $id = $st->fetchColumn();

        return $id !== false && (int) $id > 0 ? (int) $id : null;
    }
    $kundeId = (int) ($konto['kunde_id'] ?? $konto['id'] ?? 0);
    if ($kundeId > 0) {
        $st = $db->prepare('SELECT k.preisliste_id FROM kunden k JOIN preislisten p ON p.id = k.preisliste_id AND p.aktiv = 1 WHERE k.id = ?');
        $st->execute([$kundeId]);
        $id = $st->fetchColumn();

        return $id !== false && (int) $id > 0 ? (int) $id : null;
    }

    return null;
}

/** Liste, mit der eine Bestellung gerechnet wurde — sonst die aktuelle Liste des Kunden. */
function preislisteFuerBestellung(array $b): ?int
{
    $id = (int) ($b['preisliste_id'] ?? 0);
    if ($id > 0 && preislisteLaden($id) !== null) {
        return $id;
    }

    return preislisteFuerKonto(['firma_id' => $b['firma_id'] ?? null, 'kunde_id' => $b['kunde_id'] ?? null]);
}

/** Zusatzleistungspreise einer Liste: code => cent. */
function preislisteZusatz(int $id): array
{
    $st = datenbank()->prepare('SELECT code, preis_cent FROM preislisten_zusatz WHERE preisliste_id = ?');
    $st->execute([$id]);
    $aus = [];
    foreach ($st as $z) {
        $aus[(string) $z['code']] = (int) $z['preis_cent'];
    }

    return $aus;
}

/** Alle Zellen einer Liste: [land][gk_id][carrier_id] = cent. */
function preislistePreise(int $id): array
{
    $st = datenbank()->prepare('SELECT land_code, gewichtsklasse_id, carrier_id, netto_cent FROM preislisten_preise WHERE preisliste_id = ?');
    $st->execute([$id]);
    $aus = [];
    foreach ($st as $z) {
        $aus[(string) $z['land_code']][(int) $z['gewichtsklasse_id']][(int) $z['carrier_id']] = (int) $z['netto_cent'];
    }

    return $aus;
}

/**
 * Matrix für den Editor: je Land und Gewichtsklasse alle Routing-Zeilen der Zelle
 * mit Standard-Verkauf, Einkauf und Listenpreis (null = nicht gesetzt).
 */
function preislisteMatrix(int $id): array
{
    $db = datenbank();
    $liste = preislistePreise($id);
    $zellen = [];
    $zeilen = $db->query(<<<'SQL'
        SELECT r.land_code, r.gewichtsklasse_id, r.carrier_id, r.prioritaet, r.verkauf_cent, r.einkauf_cent, r.aktiv, c.name AS carrier
        FROM routing r JOIN carrier c ON c.id = r.carrier_id JOIN laender l ON l.code = r.land_code JOIN gewichtsklassen g ON g.id = r.gewichtsklasse_id
        WHERE l.aktiv = 1 AND g.aktiv = 1 AND c.aktiv = 1
        ORDER BY r.land_code, r.gewichtsklasse_id, r.prioritaet
    SQL);
    foreach ($zeilen as $z) {
        $zellen[(string) $z['land_code']][(int) $z['gewichtsklasse_id']][] = [
            'carrier_id' => (int) $z['carrier_id'], 'carrier' => (string) $z['carrier'], 'prioritaet' => (int) $z['prioritaet'], 'aktiv' => (int) $z['aktiv'] === 1,
            'standard' => (int) $z['verkauf_cent'], 'einkauf' => (int) $z['einkauf_cent'],
            'liste' => $liste[(string) $z['land_code']][(int) $z['gewichtsklasse_id']][(int) $z['carrier_id']] ?? null,
        ];
    }

    return $zellen;
}

/**
 * Liste anlegen (genau eine je Konto) und alle aktiven Routing-Zeilen mit
 * Verkauf × (1 + Prozent/100) übernehmen. Liefert die ID.
 */
function preislisteAnlegen(?int $kundeId, ?int $firmaId, string $name, float $prozent, string $von, string $fehlend = 'standard'): int
{
    if (($kundeId ?? 0) <= 0 && ($firmaId ?? 0) <= 0) {
        throw new InvalidArgumentException('Preisliste braucht einen Kunden oder eine Firma.');
    }
    $db = datenbank();
    $st = $db->prepare('SELECT id FROM preislisten WHERE ' . ($firmaId ? 'firma_id = ?' : 'kunde_id = ?'));
    $st->execute([$firmaId ?: $kundeId]);
    if ($st->fetchColumn() !== false) {
        throw new InvalidArgumentException('Dieses Konto hat schon eine Preisliste.');
    }
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO preislisten (name, kunde_id, firma_id, fehlend, aktiv, erstellt, aktualisiert, aktualisiert_von) VALUES (?, ?, ?, ?, 1, ?, ?, ?)')
           ->execute([$name !== '' ? $name : 'Kundenpreisliste', $firmaId ? null : $kundeId, $firmaId ?: null, $fehlend === 'nicht' ? 'nicht' : 'standard', jetzt(), jetzt(), $von]);
        $id = (int) $db->lastInsertId();
        $einfuegen = $db->prepare('INSERT INTO preislisten_preise (preisliste_id, land_code, gewichtsklasse_id, carrier_id, netto_cent) VALUES (?, ?, ?, ?, ?)');
        foreach ($db->query('SELECT land_code, gewichtsklasse_id, carrier_id, verkauf_cent FROM routing WHERE aktiv = 1') as $r) {
            $einfuegen->execute([$id, $r['land_code'], $r['gewichtsklasse_id'], $r['carrier_id'], (int) round((int) $r['verkauf_cent'] * (1 + $prozent / 100))]);
        }
        $db->prepare('UPDATE ' . ($firmaId ? 'firmen' : 'kunden') . ' SET preisliste_id = ?, aktualisiert = ? WHERE id = ?')->execute([$id, jetzt(), $firmaId ?: $kundeId]);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    preislistenCacheLeeren();

    return $id;
}

/** Kopfdaten ändern. */
function preislisteEinstellungen(int $id, string $name, string $fehlend, string $notiz, bool $aktiv, string $von): void
{
    datenbank()->prepare('UPDATE preislisten SET name = ?, fehlend = ?, notiz = ?, aktiv = ?, aktualisiert = ?, aktualisiert_von = ? WHERE id = ?')
        ->execute([$name !== '' ? $name : 'Kundenpreisliste', $fehlend === 'nicht' ? 'nicht' : 'standard', $notiz, $aktiv ? 1 : 0, jetzt(), $von, $id]);
    preislistenCacheLeeren();
}

/**
 * Zellen setzen: $zellen = [['land' => 'DE', 'gk_id' => 3, 'carrier_id' => 1, 'cent' => 450|null]].
 * null oder leer löscht die Zelle (dann gilt „fehlend“). Liefert Zähler.
 */
function preislistePreiseSetzen(int $id, array $zellen, string $von): array
{
    $db = datenbank();
    $zaehler = ['gesetzt' => 0, 'geloescht' => 0];
    $upsert = $db->prepare('INSERT INTO preislisten_preise (preisliste_id, land_code, gewichtsklasse_id, carrier_id, netto_cent) VALUES (?, ?, ?, ?, ?) ON CONFLICT (preisliste_id, land_code, gewichtsklasse_id, carrier_id) DO UPDATE SET netto_cent = excluded.netto_cent');
    $loeschen = $db->prepare('DELETE FROM preislisten_preise WHERE preisliste_id = ? AND land_code = ? AND gewichtsklasse_id = ? AND carrier_id = ?');
    $db->beginTransaction();
    try {
        foreach ($zellen as $z) {
            $land = strtoupper((string) ($z['land'] ?? ''));
            $gkId = (int) ($z['gk_id'] ?? 0);
            $carrierId = (int) ($z['carrier_id'] ?? 0);
            if (!preg_match('/^[A-Z]{2}$/', $land) || $gkId <= 0 || $carrierId <= 0) {
                continue;
            }
            if ($z['cent'] === null) {
                $loeschen->execute([$id, $land, $gkId, $carrierId]);
                $zaehler['geloescht'] += $loeschen->rowCount();
            } else {
                $upsert->execute([$id, $land, $gkId, $carrierId, max(0, (int) $z['cent'])]);
                $zaehler['gesetzt']++;
            }
        }
        $db->prepare('UPDATE preislisten SET aktualisiert = ?, aktualisiert_von = ? WHERE id = ?')->execute([jetzt(), $von, $id]);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    preislistenCacheLeeren();

    return $zaehler;
}

/** Zusatzleistungspreise setzen: code => cent|null (null = Standardpreis). */
function preislisteZusatzSetzen(int $id, array $preise, string $von): void
{
    $db = datenbank();
    $upsert = $db->prepare('INSERT INTO preislisten_zusatz (preisliste_id, code, preis_cent) VALUES (?, ?, ?) ON CONFLICT (preisliste_id, code) DO UPDATE SET preis_cent = excluded.preis_cent');
    $loeschen = $db->prepare('DELETE FROM preislisten_zusatz WHERE preisliste_id = ? AND code = ?');
    foreach ($preise as $code => $cent) {
        $code = (string) $code;
        if (!preg_match('/^[a-z0-9_]{2,20}$/', $code)) {
            continue;
        }
        if ($cent === null) {
            $loeschen->execute([$id, $code]);
        } else {
            $upsert->execute([$id, $code, max(0, (int) $cent)]);
        }
    }
    $db->prepare('UPDATE preislisten SET aktualisiert = ?, aktualisiert_von = ? WHERE id = ?')->execute([jetzt(), $von, $id]);
    preislistenCacheLeeren();
}

/**
 * Preismatrix (einkaufMatrixLesen) in die Liste übernehmen: je Land und Gewichtsgrenze
 * der Carrier mit Priorität 1 der Zelle (oder alle Carrier der Zelle, wenn $alleCarrier).
 * Liefert Zähler: gesetzt, ohne_klasse, ohne_route.
 */
function preislisteImportieren(int $id, array $matrix, string $von, bool $alleCarrier = false): array
{
    $db = datenbank();
    $zaehler = ['gesetzt' => 0, 'ohne_klasse' => 0, 'ohne_route' => 0];
    $klassen = [];
    foreach ($matrix['klassen'] as $g) {
        $k = einkaufKlasseFuer((int) $g, false);
        $klassen[(int) $g] = $k !== null ? (int) $k['id'] : null;
    }
    $routen = $db->prepare('SELECT carrier_id FROM routing WHERE land_code = ? AND gewichtsklasse_id = ? AND aktiv = 1 ORDER BY prioritaet');
    $zellen = [];
    foreach ($matrix['zeilen'] as $z) {
        foreach ($z['preise'] as $g => $cent) {
            $gkId = $klassen[(int) $g] ?? null;
            if ($gkId === null) {
                $zaehler['ohne_klasse']++;
                continue;
            }
            $routen->execute([$z['code'], $gkId]);
            $carrier = $routen->fetchAll(PDO::FETCH_COLUMN);
            if ($carrier === []) {
                $zaehler['ohne_route']++;
                continue;
            }
            foreach ($alleCarrier ? $carrier : [$carrier[0]] as $carrierId) {
                $zellen[] = ['land' => $z['code'], 'gk_id' => $gkId, 'carrier_id' => (int) $carrierId, 'cent' => (int) $cent];
            }
        }
    }
    $ergebnis = preislistePreiseSetzen($id, $zellen, $von);
    $zaehler['gesetzt'] = $ergebnis['gesetzt'];

    return $zaehler;
}

/** Liste löschen; das Konto rechnet wieder mit der Routingmatrix. */
function preislisteLoeschen(int $id): void
{
    $db = datenbank();
    $db->prepare('UPDATE firmen SET preisliste_id = NULL WHERE preisliste_id = ?')->execute([$id]);
    $db->prepare('UPDATE kunden SET preisliste_id = NULL WHERE preisliste_id = ?')->execute([$id]);
    $db->prepare('DELETE FROM preislisten_preise WHERE preisliste_id = ?')->execute([$id]);
    $db->prepare('DELETE FROM preislisten_zusatz WHERE preisliste_id = ?')->execute([$id]);
    $db->prepare('DELETE FROM preislisten WHERE id = ?')->execute([$id]);
    preislistenCacheLeeren();
}

/**
 * Preistabelle in der Form von preisliste(), aber mit den Konditionen einer
 * Kundenpreisliste (Portal → Preise). Ohne Liste identisch mit preisliste().
 */
function preislisteFuerAnzeige(?int $preislisteId): array
{
    $p = preisliste();
    if ($preislisteId === null) {
        return $p;
    }
    foreach ($p['laender'] as $code => $land) {
        $klassen = [];
        foreach ($p['gewichtsklassen'] as $gkCode => $_) {
            $angebote = angeboteFuer((string) $code, (string) $gkCode, $preislisteId);
            if ($angebote === []) {
                continue;
            }
            $erste = $angebote[0];
            $klassen[$gkCode] = ['carrier' => $erste['carrier'], 'fallback' => array_column(array_slice($angebote, 1), 'carrier'), 'laufzeit' => $erste['laufzeit'], 'netto' => $erste['netto'], 'einkauf' => $erste['einkauf'], 'listenpreis' => $erste['listenpreis']];
        }
        if ($klassen === []) {
            unset($p['laender'][$code]);
            continue;
        }
        $erste = reset($klassen);
        $p['laender'][$code]['klassen'] = $klassen;
        $p['laender'][$code]['carrier'] = $erste['carrier'];
        $p['laender'][$code]['laufzeit'] = $erste['laufzeit'];
        $p['laender'][$code]['netto'] = $erste['netto'];
    }
    $p['preisliste'] = preislisteLaden($preislisteId);

    return $p;
}

/** Alle Listen mit Konto und Zellenzahl (Dashboard-Übersicht). */
function preislistenAlle(): array
{
    return datenbank()->query(<<<'SQL'
        SELECT p.*, f.name AS firma, k.name AS kunde_name, k.email AS kunde_email,
               (SELECT COUNT(*) FROM preislisten_preise x WHERE x.preisliste_id = p.id) AS zellen
        FROM preislisten p LEFT JOIN firmen f ON f.id = p.firma_id LEFT JOIN kunden k ON k.id = p.kunde_id
        ORDER BY p.aktiv DESC, p.id DESC
    SQL)->fetchAll();
}
