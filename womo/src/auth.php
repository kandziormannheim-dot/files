<?php

/**
 * Zugänge: die Admin-Sitzung (ein Passwort, kein Kontensystem) und der
 * Vermietungs-Token aus dem Mieter-Link.
 */

declare(strict_types=1);

function adminAngemeldet(): bool
{
    return ($_SESSION['admin'] ?? false) === true;
}

/** Seiten, die nur der Vermieter sehen darf, brechen ohne Anmeldung hierher ab. */
function adminErzwingen(): void
{
    if (!adminAngemeldet()) {
        umleiten('/login');
    }
}

/**
 * Anmeldeversuch prüfen — mit Missbrauchsbremse, damit das eine Passwort
 * nicht durchprobiert werden kann.
 */
function anmelden(array $konfig, string $passwort): bool
{
    if (!begrenzungPruefen($konfig, 'login')) {
        return false;
    }
    if ($konfig['adminPasswortHash'] === ''
        || !password_verify($passwort, (string) $konfig['adminPasswortHash'])
    ) {
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['admin'] = true;

    return true;
}

/**
 * Vermietung zu einem Mieter-Token — nur solange der Link gültig ist:
 * ab einem Tag vor Mietbeginn bis „tokenNachlauf“ Tage nach Mietende,
 * und nie nach der Anonymisierung.
 */
function vermietungAusToken(PDO $db, array $konfig, string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
        return null;
    }
    $abfrage = $db->prepare('SELECT * FROM vermietungen WHERE token = ? AND anonymisiert = 0');
    $abfrage->execute([$token]);
    $vermietung = $abfrage->fetch();
    if ($vermietung === false) {
        return null;
    }

    $heute = date('Y-m-d');
    $ab = date('Y-m-d', strtotime($vermietung['von'] . ' -1 day') ?: 0);
    $bis = date('Y-m-d', strtotime($vermietung['bis'] . ' +' . (int) $konfig['tokenNachlauf'] . ' days') ?: 0);
    if ($heute < $ab || $heute > $bis) {
        return null;
    }

    return $vermietung;
}

/**
 * Darf der Inhaber dieses Tokens diesen Schaden sehen? Ja für eigene
 * Meldungen und für offene bzw. gemeldete Vorschäden — nicht für reparierte
 * Altfälle oder Einträge späterer Vorgänge.
 */
function schadenFuerMieterSichtbar(array $schaden, array $vermietung): bool
{
    if ((int) ($schaden['vermietung_id'] ?? 0) === (int) $vermietung['id']) {
        return true;
    }

    // Werkstattaufträge (etwa Nachrüstungen) sind interne Vorgänge, keine
    // Vorschäden — sie gehen den Mieter nichts an.
    return ($schaden['typ'] ?? 'schaden') === 'schaden'
        && in_array($schaden['status'], ['offen', 'gemeldet'], true)
        && $schaden['erstellt_am'] <= ($vermietung['bis'] . ' 23:59:59');
}
