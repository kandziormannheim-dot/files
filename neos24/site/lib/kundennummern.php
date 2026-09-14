<?php

/**
 * Kundennummern vergibt die Plattform selbst (Konfiguration „kundennummer“):
 * fortlaufend aus dem Zähler, z. B. K-100001 — je Firma und je Privatkunde
 * eine. Unterkunden einer Firma hängen die Laufnummer an: K-100001-01.
 * Firmenbenutzer haben keine eigene Nummer; sie gehören zur Firma bzw. zum
 * Unterkunden. Lexware vergibt zusätzlich seine eigene Nummer (nur lesbar),
 * Odoo bekommt die NEOS-Nummer als interne Referenz (res.partner.ref).
 */

declare(strict_types=1);

/** Nächsten Wert eines Zählers atomar holen (innerhalb oder außerhalb einer Transaktion). */
function zaehlerNaechster(PDO $db, string $name, int $start): int
{
    $db->prepare('INSERT INTO zaehler (name, wert) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET wert = wert + 1')->execute([$name, $start]);
    $st = $db->prepare('SELECT wert FROM zaehler WHERE name = ?');
    $st->execute([$name]);

    return (int) $st->fetchColumn();
}

/** Neue Kundennummer, z. B. „K-100001“. */
function kundennummerNeu(?PDO $db = null): string
{
    $k = (array) (konfig()['kundennummer'] ?? []);

    return (string) ($k['praefix'] ?? 'K-') . zaehlerNaechster($db ?? datenbank(), 'kundennummer', (int) ($k['start'] ?? 100001));
}

/** Nummer eines Unterkunden aus Firmen-Nummer und Laufnummer: „K-100001-01“. */
function unterkundenNummer(string $kundennummer, int $laufnummer): string
{
    return $kundennummer . '-' . str_pad((string) $laufnummer, 2, '0', STR_PAD_LEFT);
}

/** Sieht der Text wie eine Kundennummer aus (für die Suche im Dashboard)? */
function istKundennummer(string $text): bool
{
    $praefix = preg_quote((string) (konfig()['kundennummer']['praefix'] ?? 'K-'), '/');

    return preg_match('/^' . $praefix . '\d{3,}(-\d{2})?$/i', trim($text)) === 1;
}

/**
 * Migration: Firmen und Privatkunden ohne Nummer bekommen in ID-Reihenfolge
 * eine. Läuft bei jedem Schema-Lauf und ist danach ein Leerlauf.
 */
function kundennummernNachtragen(PDO $db): void
{
    $offen = (int) $db->query("SELECT (SELECT COUNT(*) FROM firmen WHERE kundennummer = '') + (SELECT COUNT(*) FROM kunden WHERE art = 'privat' AND kundennummer = '')")->fetchColumn();
    if ($offen === 0) {
        return;
    }
    $zeilen = [];
    foreach ($db->query("SELECT 'firmen' AS tabelle, id, erstellt FROM firmen WHERE kundennummer = '' UNION ALL SELECT 'kunden', id, erstellt FROM kunden WHERE art = 'privat' AND kundennummer = ''")->fetchAll() as $z) {
        $zeilen[] = $z;
    }
    usort($zeilen, static fn (array $a, array $b): int => [$a['erstellt'], $a['tabelle'], (int) $a['id']] <=> [$b['erstellt'], $b['tabelle'], (int) $b['id']]);
    $db->beginTransaction();
    try {
        foreach ($zeilen as $z) {
            $tabelle = $z['tabelle'] === 'firmen' ? 'firmen' : 'kunden';
            $db->prepare("UPDATE $tabelle SET kundennummer = ? WHERE id = ? AND kundennummer = ''")->execute([kundennummerNeu($db), (int) $z['id']]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}
