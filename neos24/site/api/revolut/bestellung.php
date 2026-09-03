<?php

/**
 * Bestellung anlegen (POST, JSON) und bei Revolut eine Order eröffnen.
 *
 * Eingabe:
 *   { "sprache": "de", "zielland": "FR", "gewichtsklasse": "2kg",
 *     "email": "…", "absender": {name, strasse, plz, ort},
 *     "empfaenger": {name, strasse, plz, ort}, "firma": "" (Honigtopf) }
 *
 * Antwort:
 *   { "ok": true, "token": "<Revolut-Order-Token>", "bestellung": "NE-2026-…",
 *     "modus": "sandbox", "betrag": {netto, mwst, brutto, waehrung} }
 *
 * Der Betrag wird ausschließlich aus preise.php berechnet — was der Browser
 * schickt, spielt keine Rolle.
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
$zielland = strtoupper(saeubern($daten['zielland'] ?? '', 2));
$gewichtsklasse = saeubern($daten['gewichtsklasse'] ?? '2kg', 10);
$email = saeubern($daten['email'] ?? '', 254);

function adresseLesen(mixed $roh): array
{
    $roh = is_array($roh) ? $roh : [];

    return [
        'name' => saeubern($roh['name'] ?? '', 100),
        'strasse' => saeubern($roh['strasse'] ?? '', 120),
        'plz' => saeubern($roh['plz'] ?? '', 12),
        'ort' => saeubern($roh['ort'] ?? '', 80),
    ];
}

$absender = adresseLesen($daten['absender'] ?? null);
$empfaenger = adresseLesen($daten['empfaenger'] ?? null);

$fehler = [];
$preis = preisFuer($zielland, $gewichtsklasse);
if ($preis === null) {
    $fehler[] = 'zielland';
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $fehler[] = 'email';
}
foreach (['absender' => $absender, 'empfaenger' => $empfaenger] as $rolle => $a) {
    if (mb_strlen($a['name']) < 2) {
        $fehler[] = $rolle . '.name';
    }
    if (mb_strlen($a['strasse']) < 3) {
        $fehler[] = $rolle . '.strasse';
    }
    if (mb_strlen($a['plz']) < 3) {
        $fehler[] = $rolle . '.plz';
    }
    if (mb_strlen($a['ort']) < 2) {
        $fehler[] = $rolle . '.ort';
    }
}
if ($fehler !== []) {
    antworten(422, ['ok' => false, 'fehler' => 'ungueltig', 'felder' => $fehler]);
}

if (!begrenzungPruefen('bestellung')) {
    header('Retry-After: ' . (string) (int) konfig()['limit']['fenster']);
    antworten(429, ['ok' => false, 'fehler' => 'zu-viele']);
}

// ---------------------------------------------------------------- Anlegen

try {
    $db = datenbank();
    $extRef = 'NE-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $st = $db->prepare(<<<'SQL'
        INSERT INTO bestellungen
            (ext_ref, status, netto_cent, mwst_cent, betrag_cent, waehrung, zielland, gewichtsklasse,
             email, sprache, absender_json, empfaenger_json, ereignisse_json, erstellt, aktualisiert)
        VALUES
            (:ref, 'offen', :netto, :mwst, :brutto, :w, :land, :gk, :email, :sprache, :abs, :emp, :ev, :t, :t)
    SQL);
    $st->execute([
        ':ref' => $extRef,
        ':netto' => $preis['netto'],
        ':mwst' => $preis['mwst'],
        ':brutto' => $preis['brutto'],
        ':w' => $preis['waehrung'],
        ':land' => $zielland,
        ':gk' => $gewichtsklasse,
        ':email' => $email,
        ':sprache' => $sprache,
        ':abs' => json_encode($absender, JSON_UNESCAPED_UNICODE),
        ':emp' => json_encode($empfaenger, JSON_UNESCAPED_UNICODE),
        ':ev' => json_encode([['zeit' => jetzt(), 'ereignis' => 'angelegt', 'status' => 'offen']]),
        ':t' => jetzt(),
    ]);
    $bestellung = bestellungLaden('ext_ref', $extRef);
} catch (Throwable $e) {
    error_log('[revolut] Datenbank: ' . $e->getMessage());
    antworten(500, ['ok' => false, 'fehler' => 'speicher']);
}

// ------------------------------------------------------------ Revolut-Order

$landName = preisliste()['laender'][$zielland]['name'][$sprache];
$beschreibung = $sprache === 'de'
    ? 'NEOS Paket nach ' . $landName . ', ' . preisliste()['gewichtsklassen'][$gewichtsklasse]['de'] . ' (' . $extRef . ')'
    : 'NEOS parcel to ' . $landName . ', ' . preisliste()['gewichtsklassen'][$gewichtsklasse]['en'] . ' (' . $extRef . ')';

$order = [
    'amount' => $preis['brutto'],           // Minor units (Cent)
    'currency' => $preis['waehrung'],
    'description' => $beschreibung,
    'merchant_order_ext_ref' => $extRef,
    'capture_mode' => 'automatic',
    'customer' => ['email' => $email, 'full_name' => $absender['name']],
];
$basisUrl = rtrim((string) konfig()['basisUrl'], '/');
if ($basisUrl !== '') {
    $order['redirect_url'] = $basisUrl . ($sprache === 'en' ? '/en/?customer=private' : '/?kunde=privat') . '&bestellung=' . $extRef . '#paket';
}

try {
    $antwort = revolutAnfrage('POST', '/api/orders', $order);
} catch (Throwable $e) {
    error_log('[revolut] Order anlegen: ' . $e->getMessage());
    bestellungFortschreiben($bestellung, 'fehlgeschlagen', 'revolut.transport', ['fehler' => $e->getMessage()]);
    antworten(502, ['ok' => false, 'fehler' => 'zahlungsdienst']);
}

$token = (string) ($antwort['daten']['token'] ?? '');
$revolutId = (string) ($antwort['daten']['id'] ?? '');
if ($antwort['status'] < 200 || $antwort['status'] >= 300 || $token === '' || $revolutId === '') {
    error_log('[revolut] Order abgelehnt (HTTP ' . $antwort['status'] . '): ' . json_encode($antwort['daten']));
    bestellungFortschreiben($bestellung, 'fehlgeschlagen', 'revolut.abgelehnt', ['http' => $antwort['status'], 'code' => $antwort['daten']['code'] ?? null]);
    antworten(502, ['ok' => false, 'fehler' => 'zahlungsdienst']);
}

$db->prepare('UPDATE bestellungen SET revolut_id = :r, aktualisiert = :a WHERE id = :id')
   ->execute([':r' => $revolutId, ':a' => jetzt(), ':id' => $bestellung['id']]);
$bestellung = bestellungFortschreiben(bestellungLaden('ext_ref', $extRef), 'angelegt', 'revolut.angelegt', ['state' => $antwort['daten']['state'] ?? null]);

antworten(200, [
    'ok' => true,
    'token' => $token,
    'bestellung' => $extRef,
    'modus' => checkoutModus(),
    'betrag' => $preis,
]);
