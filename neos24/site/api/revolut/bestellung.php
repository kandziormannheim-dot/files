<?php

/**
 * Bestellung anlegen (POST, JSON) und bei Revolut eine Order eröffnen.
 *
 * Eingabe:
 *   { "sprache": "de", "zielland": "FR", "gewichtsklasse": "2kg", "carrier": "" (optional),
 *     "zusatz": ["versicherung", …] (optional), "abholung": {datum, fenster} (bei Abholung),
 *     "email": "…", "absender": {name, strasse, plz, ort},
 *     "empfaenger": {name, strasse, plz, ort}, "firma": "" (Honigtopf) }
 *
 * Antwort:
 *   { "ok": true, "token": "<Revolut-Order-Token>", "bestellung": "NE-2026-…",
 *     "modus": "sandbox", "betrag": {netto, mwst, brutto, waehrung} }
 *
 * Der Betrag wird ausschließlich aus der Preisliste der Datenbank berechnet
 * (Dashboard → Routingmatrix) — was der Browser schickt, spielt keine Rolle.
 */

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    antworten(200, ['ok' => true, 'dienst' => 'revolut', 'bereit' => zahlungBereit(), 'modus' => checkoutModus()]);
}
nurEigenePost();

if (!zahlungBereit()) {
    error_log('[revolut] Kein Secret Key — Konfiguration unter ' . NEOS_KONFIG_PFAD . ' fehlt oder ist leer');
    antworten(503, ['ok' => false, 'fehler' => 'nicht-eingerichtet']);
}

$daten = eingabeLesen();

if (saeubern($daten['firma'] ?? '') !== '') {
    antworten(200, ['ok' => true, 'token' => '', 'bestellung' => '']); // Honigtopf: Bot lernt nichts
}

// -------------------------------------------------------------------- Eingabe

$sprache = (($daten['sprache'] ?? 'de') === 'en') ? 'en' : 'de';
$email = saeubern($daten['email'] ?? '', 254);

// Bestätigtes Privatkunden-Konto zu dieser E-Mail? Dann gehört die Bestellung ins Portal.
$kundeId = null;
try {
    $st = datenbank()->prepare("SELECT id FROM kunden WHERE email = ? AND art = 'privat' AND email_bestaetigt = 1 AND aktiv = 1");
    $st->execute([mb_strtolower($email)]);
    $kundeId = ($id = $st->fetchColumn()) !== false ? (int) $id : null;
} catch (Throwable) {
    $kundeId = null;
}

if (!begrenzungPruefen('bestellung')) {
    header('Retry-After: ' . (string) (int) konfig()['limit']['fenster']);
    antworten(429, ['ok' => false, 'fehler' => 'zu-viele']);
}

// ---------------------------------------------------------------- Anlegen

try {
    $ergebnis = bestellungAnlegen([
        'sprache' => $sprache,
        'zielland' => $daten['zielland'] ?? '',
        'gewichtsklasse' => $daten['gewichtsklasse'] ?? '2kg',
        'carrier' => $daten['carrier'] ?? '',
        'zusatz' => is_array($daten['zusatz'] ?? null) ? $daten['zusatz'] : [],
        'abholung' => is_array($daten['abholung'] ?? null) ? $daten['abholung'] : [],
        'email' => $email,
        'absender' => $daten['absender'] ?? [],
        'empfaenger' => $daten['empfaenger'] ?? [],
        'kunde_id' => $kundeId,
        'zahlungsart' => 'revolut',
        'angelegt_von' => 'startseite',
    ]);
} catch (Throwable $e) {
    error_log('[revolut] Datenbank: ' . $e->getMessage());
    antworten(500, ['ok' => false, 'fehler' => 'speicher']);
}
if (isset($ergebnis['fehler'])) {
    antworten(422, ['ok' => false, 'fehler' => 'ungueltig', 'felder' => $ergebnis['fehler']]);
}
$bestellung = $ergebnis['bestellung'];

// ------------------------------------------------------------ Revolut-Order

try {
    $token = bestellungRevolutEroeffnen($bestellung);
} catch (Throwable $e) {
    error_log('[revolut] Order anlegen: ' . $e->getMessage());
    bestellungFortschreiben($bestellung, 'fehlgeschlagen', 'revolut.transport', ['fehler' => $e->getMessage()]);
    antworten(502, ['ok' => false, 'fehler' => 'zahlungsdienst']);
}

antworten(200, [
    'ok' => true,
    'token' => $token,
    'bestellung' => $bestellung['ext_ref'],
    'modus' => checkoutModus(),
    'betrag' => ['netto' => (int) $bestellung['netto_cent'], 'mwst' => (int) $bestellung['mwst_cent'], 'brutto' => (int) $bestellung['betrag_cent'], 'waehrung' => $bestellung['waehrung']],
]);
