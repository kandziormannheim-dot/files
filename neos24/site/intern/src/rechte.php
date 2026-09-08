<?php

/**
 * Rollen mit Rechtematrix: je Modul die Rechte sehen / bearbeiten / löschen.
 * Die Systemrolle „Admin“ (rollen.system = 1) hat immer alles und ist weder
 * änderbar noch löschbar. Rechte werden je Anfrage einmal aus der Datenbank
 * gelesen, damit Änderungen des Admins sofort greifen.
 */

declare(strict_types=1);

const MODULE = [
    'uebersicht' => 'Übersicht',
    'bestellungen' => 'Bestellungen & Sendungen',
    'preise' => 'Preise & Zielländer',
    'routing' => 'Routingmatrix',
    'kunden' => 'Kunden & Anfragen',
    'rechnungen' => 'Rechnungen',
    'benutzer' => 'Benutzer & Rollen',
];

const RECHTE = ['sehen' => 'Sehen', 'bearbeiten' => 'Bearbeiten', 'loeschen' => 'Löschen'];

/** Rechtematrix einer Rolle: [modul => [recht => bool]] mit allen Modulen. */
function rechteDerRolle(int $rolleId): array
{
    $matrix = [];
    foreach (MODULE as $modul => $_) {
        $matrix[$modul] = ['sehen' => false, 'bearbeiten' => false, 'loeschen' => false];
    }
    $st = datenbank()->prepare('SELECT modul, sehen, bearbeiten, loeschen FROM rechte WHERE rolle_id = ?');
    $st->execute([$rolleId]);
    foreach ($st as $z) {
        if (isset($matrix[$z['modul']])) {
            $matrix[$z['modul']] = ['sehen' => (bool) $z['sehen'], 'bearbeiten' => (bool) $z['bearbeiten'], 'loeschen' => (bool) $z['loeschen']];
        }
    }

    return $matrix;
}

/** Rechtematrix aus einem Formular speichern; bearbeiten/löschen schließen sehen ein. */
function rechteSpeichern(int $rolleId, array $eingabe): void
{
    $db = datenbank();
    $db->prepare('DELETE FROM rechte WHERE rolle_id = ?')->execute([$rolleId]);
    $st = $db->prepare('INSERT INTO rechte (rolle_id, modul, sehen, bearbeiten, loeschen) VALUES (?, ?, ?, ?, ?)');
    foreach (MODULE as $modul => $_) {
        $r = is_array($eingabe[$modul] ?? null) ? $eingabe[$modul] : [];
        $bearbeiten = !empty($r['bearbeiten']);
        $loeschen = !empty($r['loeschen']);
        $sehen = !empty($r['sehen']) || $bearbeiten || $loeschen;
        if ($sehen) {
            $st->execute([$rolleId, $modul, 1, (int) $bearbeiten, (int) $loeschen]);
        }
    }
}

/** Darf der angemeldete Benutzer das? */
function darf(string $modul, string $recht = 'sehen'): bool
{
    $b = benutzerAktuell();
    if ($b === null || !isset(MODULE[$modul]) || !isset(RECHTE[$recht])) {
        return false;
    }
    if ((int) $b['system'] === 1) {
        return true;
    }
    static $cache = null;
    $cache ??= rechteDerRolle((int) $b['rolle_id']);

    return $cache[$modul][$recht] ?? false;
}

/** Abbruch mit 403, wenn das Recht fehlt. */
function rechtErzwingen(string $modul, string $recht = 'sehen'): void
{
    if (!darf($modul, $recht)) {
        fehlerSeite(403, 'Kein Zugriff', 'Für „' . (MODULE[$modul] ?? $modul) . '“ fehlt dir das Recht „' . (RECHTE[$recht] ?? $recht) . '“. Rechte vergibt ein Admin unter Benutzer & Rollen.');
    }
}

/** Module, die der Benutzer sehen darf (für die Navigation). */
function moduleSichtbar(): array
{
    return array_filter(MODULE, static fn (string $_, string $modul): bool => darf($modul), ARRAY_FILTER_USE_BOTH);
}

/** Alle Rollen mit Benutzerzahl. */
function rollenAlle(): array
{
    return datenbank()->query('SELECT r.*, (SELECT COUNT(*) FROM benutzer b WHERE b.rolle_id = r.id) AS benutzer FROM rollen r ORDER BY r.system DESC, r.name')->fetchAll();
}

function rolleLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT * FROM rollen WHERE id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Systemrolle Admin sicherstellen; liefert ihre ID. */
function adminRolleSicherstellen(): int
{
    $db = datenbank();
    $id = $db->query('SELECT id FROM rollen WHERE system = 1 LIMIT 1')->fetchColumn();
    if ($id !== false) {
        return (int) $id;
    }
    $db->prepare('INSERT INTO rollen (name, beschreibung, system, erstellt) VALUES (?, ?, 1, ?)')
       ->execute(['Admin', 'Alle Rechte in allen Modulen. Systemrolle, nicht änderbar.', jetzt()]);
    $id = (int) $db->lastInsertId();
    $st = $db->prepare('INSERT INTO rechte (rolle_id, modul, sehen, bearbeiten, loeschen) VALUES (?, ?, 1, 1, 1)');
    foreach (MODULE as $modul => $_) {
        $st->execute([$id, $modul]);
    }

    return $id;
}
