<?php

/**
 * Bestellungen und Sendungen aus Sicht eines Kunden. Jede Abfrage filtert
 * auf das Konto (Privatkunde: kunde_id) bzw. die Firma (Geschäftskunde:
 * firma_id) — das ist die Grenze „jeder sieht nur seine Daten“.
 */

declare(strict_types=1);

/** WHERE-Bedingung und Werte für den Geltungsbereich des Kunden. */
function bereich(array $kunde): array
{
    if ($kunde['art'] === 'business' && (int) $kunde['firma_id'] > 0) {
        return ['b.firma_id = ?', [(int) $kunde['firma_id']]];
    }

    return ['b.kunde_id = ? AND b.firma_id IS NULL', [(int) $kunde['id']]];
}

/** Eigene Bestellungen, neueste zuerst; liefert [zeilen, gesamt]. */
function eigeneBestellungen(array $kunde, int $limit = 50, int $offset = 0, string $status = '', string $suche = ''): array
{
    [$wo, $werte] = bereich($kunde);
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
    $st = $db->prepare('SELECT b.*, k.name AS angelegt_von FROM bestellungen b LEFT JOIN kunden k ON k.id = b.kunde_id WHERE ' . $wo . ' ORDER BY b.id DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
    $st->execute($werte);

    return [$st->fetchAll(), $gesamt];
}

/** Eine eigene Bestellung — null, wenn sie nicht zum Konto gehört. */
function eigeneBestellung(array $kunde, string $extRef): ?array
{
    [$wo, $werte] = bereich($kunde);
    $st = datenbank()->prepare('SELECT b.*, k.name AS angelegt_von, r.nummer AS rechnung_nummer FROM bestellungen b LEFT JOIN kunden k ON k.id = b.kunde_id LEFT JOIN rechnungen r ON r.id = b.rechnung_id WHERE b.ext_ref = ? AND ' . $wo);
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

/**
 * Sendung auf Rechnung anlegen. Liefert ['bestellung' => …] oder
 * ['fehler' => [feldnamen]]. Preis ausschließlich aus der Routingmatrix.
 */
function sendungAnlegen(array $kunde, array $firma, array $eingabe): array
{
    $sprache = sprache();
    $zielland = strtoupper(saeubern($eingabe['zielland'] ?? '', 2));
    $gk = saeubern($eingabe['gewichtsklasse'] ?? '', 12);
    $empfaenger = [
        'name' => saeubern($eingabe['name'] ?? '', 100),
        'strasse' => saeubern($eingabe['strasse'] ?? '', 120),
        'plz' => saeubern($eingabe['plz'] ?? '', 12),
        'ort' => saeubern($eingabe['ort'] ?? '', 80),
    ];
    $empfaengerEmail = saeubern($eingabe['email'] ?? '', 254);
    $referenz = saeubern($eingabe['referenz'] ?? '', 60);
    $absender = ['name' => (string) $firma['name'], 'strasse' => (string) $firma['strasse'], 'plz' => (string) $firma['plz'], 'ort' => (string) $firma['ort']];

    $fehler = [];
    $preis = preisFuer($zielland, $gk);
    if ($preis === null) {
        $fehler[] = 'zielland';
    }
    if (mb_strlen($empfaenger['name']) < 2) {
        $fehler[] = 'name';
    }
    if (mb_strlen($empfaenger['strasse']) < 3) {
        $fehler[] = 'strasse';
    }
    if (mb_strlen($empfaenger['plz']) < 3) {
        $fehler[] = 'plz';
    }
    if (mb_strlen($empfaenger['ort']) < 2) {
        $fehler[] = 'ort';
    }
    if ($empfaengerEmail !== '' && filter_var($empfaengerEmail, FILTER_VALIDATE_EMAIL) === false) {
        $fehler[] = 'email';
    }
    if ($absender['strasse'] === '' || $absender['ort'] === '') {
        $fehler[] = 'absender';
    }
    if ($fehler !== []) {
        return ['fehler' => $fehler];
    }
    if ($empfaengerEmail !== '') {
        $empfaenger['email'] = $empfaengerEmail;
    }

    $db = datenbank();
    $extRef = 'NE-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $db->prepare(<<<'SQL'
        INSERT INTO bestellungen
            (ext_ref, status, netto_cent, mwst_cent, betrag_cent, waehrung, zielland, gewichtsklasse, carrier, einkauf_cent,
             email, sprache, absender_json, empfaenger_json, ereignisse_json, erstellt, aktualisiert,
             kunde_id, firma_id, zahlungsart, referenz)
        VALUES
            (:ref, 'beauftragt', :netto, :mwst, :brutto, :w, :land, :gk, :carrier, :einkauf, :email, :sprache, :abs, :emp, :ev, :t, :t,
             :kunde, :firma, 'rechnung', :referenz)
    SQL)->execute([
        ':ref' => $extRef,
        ':netto' => $preis['netto'],
        ':mwst' => $preis['mwst'],
        ':brutto' => $preis['brutto'],
        ':w' => $preis['waehrung'],
        ':land' => $zielland,
        ':gk' => $gk,
        ':carrier' => $preis['carrier'],
        ':einkauf' => $preis['einkauf'],
        ':email' => (string) $kunde['email'],
        ':sprache' => $sprache,
        ':abs' => json_encode($absender, JSON_UNESCAPED_UNICODE),
        ':emp' => json_encode($empfaenger, JSON_UNESCAPED_UNICODE),
        ':ev' => json_encode([['zeit' => jetzt(), 'ereignis' => 'konto.beauftragt', 'status' => 'beauftragt', 'von' => $kunde['name']]], JSON_UNESCAPED_UNICODE),
        ':t' => jetzt(),
        ':kunde' => (int) $kunde['id'],
        ':firma' => (int) $firma['id'],
        ':referenz' => $referenz,
    ]);
    $bestellung = bestellungLaden('ext_ref', $extRef);
    try {
        labelBeauftragen($bestellung);
    } catch (Throwable $e) {
        error_log('[konto] Label-Auftrag: ' . $e->getMessage());
    }
    try {
        sendungBestaetigen($bestellung, $kunde, $firma, $preis);
    } catch (Throwable $e) {
        error_log('[konto] Bestätigungsmail: ' . $e->getMessage());
    }

    return ['bestellung' => bestellungLaden('ext_ref', $extRef)];
}

function sendungBestaetigen(array $bestellung, array $kunde, array $firma, array $preis): void
{
    $sprache = sprache();
    $land = preisliste()['laender'][$bestellung['zielland']]['name'][$sprache] ?? $bestellung['zielland'];
    $emp = json_decode((string) $bestellung['empfaenger_json'], true) ?: [];
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    if ($sprache === 'en') {
        $betreff = 'NEOS shipment ' . $bestellung['ext_ref'] . ' booked';
        $koerper = implode("\n", [
            'Hello ' . $kunde['name'] . ',',
            '',
            'your shipment for ' . $firma['name'] . ' is booked.',
            '',
            'Shipment:    ' . $bestellung['ext_ref'] . ((string) $bestellung['referenz'] !== '' ? ' (' . $bestellung['referenz'] . ')' : ''),
            'Destination: ' . $land . ', ' . $bestellung['gewichtsklasse'],
            'Recipient:   ' . ($emp['name'] ?? '') . ', ' . ($emp['strasse'] ?? '') . ', ' . ($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''),
            'Carrier:     ' . $bestellung['carrier'],
            'Net price:   ' . euro((int) $preis['netto'], 'en') . ' (invoiced monthly)',
            '',
            'The shipping label follows in a second email as soon as it is generated.',
            'Portal: ' . $basis . '/konto/sendungen/' . $bestellung['ext_ref'],
            '',
            'NEOS Logistics UG · info@neos24.com',
        ]);
    } else {
        $betreff = 'NEOS-Sendung ' . $bestellung['ext_ref'] . ' beauftragt';
        $koerper = implode("\n", [
            'Hallo ' . $kunde['name'] . ',',
            '',
            'deine Sendung für ' . $firma['name'] . ' ist beauftragt.',
            '',
            'Sendung:     ' . $bestellung['ext_ref'] . ((string) $bestellung['referenz'] !== '' ? ' (' . $bestellung['referenz'] . ')' : ''),
            'Zielland:    ' . $land . ', ' . $bestellung['gewichtsklasse'],
            'Empfänger:   ' . ($emp['name'] ?? '') . ', ' . ($emp['strasse'] ?? '') . ', ' . ($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''),
            'Carrier:     ' . $bestellung['carrier'],
            'Preis netto: ' . euro((int) $preis['netto']) . ' (Abrechnung mit der Monatsrechnung)',
            '',
            'Das Versandlabel folgt in einer zweiten E-Mail, sobald es erzeugt ist.',
            'Portal: ' . $basis . '/konto/sendungen/' . $bestellung['ext_ref'],
            '',
            'NEOS Logistics UG · info@neos24.com',
        ]);
    }
    mailSenden((string) $kunde['email'], $betreff, $koerper);
}
