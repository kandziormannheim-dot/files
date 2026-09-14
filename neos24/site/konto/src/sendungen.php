<?php

/**
 * Bestellungen und Sendungen aus Sicht eines Kunden. Jede Abfrage filtert
 * auf das Konto (Privatkunde: kunde_id) bzw. die Firma (Geschäftskunde:
 * firma_id) — das ist die Grenze „jeder sieht nur seine Daten“.
 */

declare(strict_types=1);

/**
 * WHERE-Bedingung und Werte für den Geltungsbereich des Kunden. Ein
 * Mitarbeiter mit fest zugeordnetem Unterkunden sieht nur dessen Sendungen;
 * Inhaber sehen alles und können mit $unterkunde filtern (>0 = Unterkunde,
 * -1 = nur Hauptfirma).
 */
function bereich(array $kunde, ?int $unterkunde = null): array
{
    if ($kunde['art'] === 'business' && (int) $kunde['firma_id'] > 0) {
        $wo = 'b.firma_id = ?';
        $werte = [(int) $kunde['firma_id']];
        $fest = festerUnterkunde($kunde);
        if ($fest > 0) {
            $wo .= ' AND b.unterkunde_id = ?';
            $werte[] = $fest;
        } elseif ($unterkunde !== null && $unterkunde > 0) {
            $wo .= ' AND b.unterkunde_id = ?';
            $werte[] = $unterkunde;
        } elseif ($unterkunde !== null && $unterkunde < 0) {
            $wo .= ' AND b.unterkunde_id IS NULL';
        }

        return [$wo, $werte];
    }

    return ['b.kunde_id = ? AND b.firma_id IS NULL', [(int) $kunde['id']]];
}

/** Fest zugeordneter Unterkunde eines Mitarbeiters (0 = keiner bzw. Inhaber wählt frei). */
function festerUnterkunde(array $kunde): int
{
    return ($kunde['firmenrolle'] ?? '') !== 'inhaber' ? (int) ($kunde['unterkunde_id'] ?? 0) : 0;
}

/** Eigene Bestellungen, neueste zuerst; liefert [zeilen, gesamt]. */
function eigeneBestellungen(array $kunde, int $limit = 50, int $offset = 0, string $status = '', string $suche = '', ?int $unterkunde = null): array
{
    [$wo, $werte] = bereich($kunde, $unterkunde);
    if ($status !== '') {
        $wo .= ' AND b.status = ?';
        $werte[] = $status;
    }
    if ($suche !== '') {
        $wo .= ' AND (b.ext_ref LIKE ? OR b.referenz LIKE ? OR b.empfaenger_json LIKE ?)';
        array_push($werte, '%' . $suche . '%', '%' . $suche . '%', '%' . $suche . '%');
    }
    $db = datenbank();
    $st = $db->prepare('SELECT COUNT(*) FROM bestellungen b WHERE ' . $wo);
    $st->execute($werte);
    $gesamt = (int) $st->fetchColumn();
    $st = $db->prepare('SELECT b.*, k.name AS angelegt_von, u.nummer AS unterkunde_nummer, u.name AS unterkunde FROM bestellungen b LEFT JOIN kunden k ON k.id = b.kunde_id LEFT JOIN unterkunden u ON u.id = b.unterkunde_id WHERE ' . $wo . ' ORDER BY b.id DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
    $st->execute($werte);

    return [$st->fetchAll(), $gesamt];
}

/** Eine eigene Bestellung — null, wenn sie nicht zum Konto gehört. */
function eigeneBestellung(array $kunde, string $extRef): ?array
{
    [$wo, $werte] = bereich($kunde);
    $st = datenbank()->prepare('SELECT b.*, k.name AS angelegt_von, r.nummer AS rechnung_nummer, u.nummer AS unterkunde_nummer, u.name AS unterkunde FROM bestellungen b LEFT JOIN kunden k ON k.id = b.kunde_id LEFT JOIN rechnungen r ON r.id = b.rechnung_id LEFT JOIN unterkunden u ON u.id = b.unterkunde_id WHERE b.ext_ref = ? AND ' . $wo);
    $st->execute(array_merge([$extRef], $werte));
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Verlauf für Kunden: nur Statuswechsel und Label, ohne interne Details. */
function kundenVerlauf(array $bestellung): array
{
    $ereignisse = json_decode((string) $bestellung['ereignisse_json'], true) ?: [];
    $verlauf = [];
    $letzter = null;
    foreach ($ereignisse as $ev) {
        $status = (string) ($ev['status'] ?? '');
        $ereignis = (string) ($ev['ereignis'] ?? '');
        if ($ereignis === 'label.beauftragt') {
            $verlauf[] = ['zeit' => $ev['zeit'] ?? '', 'text' => sprache() === 'en' ? 'Label requested' : 'Label beauftragt'];
            continue;
        }
        if ($status === '' || $status === $letzter || in_array($ereignis, ['intern.sync', 'revolut.transport'], true)) {
            continue;
        }
        $letzter = $status;
        $verlauf[] = ['zeit' => $ev['zeit'] ?? '', 'text' => statusName($status, sprache())];
    }

    return $verlauf;
}

/** Kennzahlen einer Firma für die Übersicht. */
function firmaKennzahlen(int $firmaId): array
{
    $db = datenbank();
    [$von, $bis] = monatsZeitraum(gmdate('Y-m'));
    $st = $db->prepare("SELECT COUNT(*) AS n, COALESCE(SUM(netto_cent),0) AS netto FROM bestellungen WHERE firma_id = ? AND status = 'beauftragt' AND erstellt >= ? AND erstellt < ?");
    $st->execute([$firmaId, $von, $bis]);
    $monat = $st->fetch() ?: ['n' => 0, 'netto' => 0];
    $st = $db->prepare("SELECT COUNT(*) AS n, COALESCE(SUM(brutto_cent),0) AS brutto FROM rechnungen WHERE firma_id = ? AND status = 'offen'");
    $st->execute([$firmaId]);
    $offen = $st->fetch() ?: ['n' => 0, 'brutto' => 0];

    return ['monat' => (int) $monat['n'], 'netto' => (int) $monat['netto'], 'offen' => (int) $offen['n'], 'offen_brutto' => (int) $offen['brutto']];
}
