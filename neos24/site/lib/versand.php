<?php

/**
 * Versand-Kern: Angebote je Zelle der Routingmatrix (alle Carrier statt nur
 * Priorität 1), Zusatzleistungen, Anlage von Sendungen aus Startseite und
 * Kundenportal, Revolut-Order, Guthaben und Aufladungen, Versandstatus mit
 * Sendungsereignissen (Tracking), Adressbuch, Paketvorlagen, Retouren und
 * Reklamationen. Wird von api/revolut/_bootstrap.php eingebunden.
 */

declare(strict_types=1);

require_once __DIR__ . '/carrier.php';

// ------------------------------------------------------------------ Angebote

/**
 * Alle nutzbaren Carrier einer Zelle (Land × Gewichtsklasse) in
 * Prioritätsreihenfolge, je mit Netto, Brutto, Laufzeit und Einkauf.
 * Mit $preislisteId gelten die Preise der Kundenpreisliste (lib/preislisten.php);
 * Zellen ohne Listenpreis fallen je Liste auf den Standard zurück oder entfallen.
 */
function angeboteFuer(string $land, string $gewichtsklasse, ?int $preislisteId = null, bool $cacheLeeren = false): array
{
    static $cache = [];
    if ($cacheLeeren) {
        $cache = [];

        return [];
    }
    $schluessel = $land . '|' . $gewichtsklasse . '|' . (int) $preislisteId;
    if (isset($cache[$schluessel])) {
        return $cache[$schluessel];
    }
    $liste = $preislisteId !== null ? preislisteLaden($preislisteId) : null;
    $st = datenbank()->prepare(<<<'SQL'
        SELECT c.id AS carrier_id, c.name AS carrier, c.volumenfaktor, r.prioritaet, r.laufzeit_de, r.laufzeit_en, r.verkauf_cent, r.einkauf_cent,
               p.netto_cent AS listen_cent
        FROM routing r
        JOIN laender l ON l.code = r.land_code
        JOIN gewichtsklassen g ON g.id = r.gewichtsklasse_id
        JOIN carrier c ON c.id = r.carrier_id
        LEFT JOIN preislisten_preise p ON p.preisliste_id = ? AND p.land_code = r.land_code AND p.gewichtsklasse_id = r.gewichtsklasse_id AND p.carrier_id = r.carrier_id
        WHERE r.land_code = ? AND g.code = ? AND r.aktiv = 1 AND l.aktiv = 1 AND g.aktiv = 1 AND c.aktiv = 1
        ORDER BY r.prioritaet
    SQL);
    $st->execute([$liste !== null ? (int) $liste['id'] : 0, $land, $gewichtsklasse]);
    $angebote = [];
    foreach ($st as $z) {
        if ($z['listen_cent'] !== null) {
            $netto = (int) $z['listen_cent'];
        } elseif ($liste !== null && $liste['fehlend'] === 'nicht') {
            continue;
        } else {
            $netto = (int) $z['verkauf_cent'];
        }
        $brutto = bruttoCent($netto);
        $angebote[] = [
            'carrier' => (string) $z['carrier'],
            'carrier_id' => (int) $z['carrier_id'],
            'prioritaet' => (int) $z['prioritaet'],
            'netto' => $netto,
            'mwst' => $brutto - $netto,
            'brutto' => $brutto,
            'einkauf' => (int) $z['einkauf_cent'],
            'standard' => (int) $z['verkauf_cent'],
            'listenpreis' => $z['listen_cent'] !== null,
            'volumenfaktor' => max(0, (int) ($z['volumenfaktor'] ?? 5000)),
            'laufzeit' => ['de' => (string) $z['laufzeit_de'], 'en' => (string) $z['laufzeit_en']],
            'empfohlen' => $angebote === [],
        ];
    }

    return $cache[$schluessel] = $angebote;
}

/** Volumengewicht in Gramm aus Maßen in cm (L·B·H / Faktor kg); 0 ohne Maße. */
function volumengewichtGramm(array $masse, int $faktor): int
{
    $l = (int) ($masse['l'] ?? 0);
    $b = (int) ($masse['b'] ?? 0);
    $h = (int) ($masse['h'] ?? 0);
    if ($l <= 0 || $b <= 0 || $h <= 0 || $faktor <= 0) {
        return 0;
    }

    return (int) round($l * $b * $h / $faktor * 1000);
}

/** Gewichtsklasse zu einem Gewicht in Gramm: die kleinste, die noch passt. */
function gewichtsklasseFuerGewicht(int $gramm): ?string
{
    foreach (preisliste()['gewichtsklassen'] as $code => $gk) {
        if ((int) $gk['max_gramm'] <= 0 || (int) $gk['max_gramm'] >= $gramm) {
            return (string) $code;
        }
    }

    return null;
}

// ---------------------------------------------------------- Zusatzleistungen

/** Aktive Zusatzleistungen: code, name{de,en}, beschreibung{de,en}, preis (netto Cent) — mit Kundenpreisliste deren Preise. */
function zusatzleistungen(bool $nurAktive = true, ?int $preislisteId = null): array
{
    $sql = 'SELECT * FROM zusatzleistungen' . ($nurAktive ? ' WHERE aktiv = 1' : '') . ' ORDER BY sortierung, id';
    $eigene = $preislisteId !== null ? preislisteZusatz($preislisteId) : [];
    $liste = [];
    foreach (datenbank()->query($sql) as $z) {
        $liste[(string) $z['code']] = [
            'id' => (int) $z['id'],
            'code' => (string) $z['code'],
            'name' => ['de' => (string) $z['name_de'], 'en' => (string) $z['name_en']],
            'beschreibung' => ['de' => (string) $z['beschreibung_de'], 'en' => (string) $z['beschreibung_en']],
            'preis' => $eigene[(string) $z['code']] ?? (int) $z['preis_cent'],
            'standard' => (int) $z['preis_cent'],
            'listenpreis' => isset($eigene[(string) $z['code']]),
            'aktiv' => (int) $z['aktiv'] === 1,
            'sortierung' => (int) $z['sortierung'],
        ];
    }

    return $liste;
}

/** Gültige Codes herausfiltern und Summe netto bilden. */
function zusatzBerechnen(array $codes, ?int $preislisteId = null): array
{
    $alle = zusatzleistungen(true, $preislisteId);
    $gewaehlt = [];
    $summe = 0;
    foreach (array_unique(array_map('strval', $codes)) as $code) {
        if (isset($alle[$code])) {
            $gewaehlt[] = ['code' => $code, 'name' => $alle[$code]['name'], 'preis' => $alle[$code]['preis']];
            $summe += $alle[$code]['preis'];
        }
    }

    return ['liste' => $gewaehlt, 'netto' => $summe];
}

// ------------------------------------------------------------- Versandstatus

const VERSANDSTATUS = [
    'angelegt' => ['de' => 'Sendung angelegt', 'en' => 'Shipment created'],
    'bezahlt' => ['de' => 'Zahlung eingegangen', 'en' => 'Payment received'],
    'label' => ['de' => 'Label erstellt', 'en' => 'Label created'],
    'abholung' => ['de' => 'Abholung beauftragt', 'en' => 'Pickup booked'],
    'uebergeben' => ['de' => 'An Carrier übergeben', 'en' => 'Handed to carrier'],
    'unterwegs' => ['de' => 'Unterwegs', 'en' => 'In transit'],
    'zustellung' => ['de' => 'In Zustellung', 'en' => 'Out for delivery'],
    'zugestellt' => ['de' => 'Zugestellt', 'en' => 'Delivered'],
    'retoure' => ['de' => 'Rücksendung', 'en' => 'Returned'],
    'problem' => ['de' => 'Zustellproblem', 'en' => 'Delivery issue'],
    'storniert' => ['de' => 'Storniert', 'en' => 'Cancelled'],
];

function versandstatusName(string $code, string $sprache = 'de'): string
{
    return VERSANDSTATUS[$code][$sprache === 'en' ? 'en' : 'de'] ?? ucfirst($code);
}

/** Ereignis an eine Sendung hängen (Tracking-Zeile) und ggf. den Versandstatus setzen. */
function sendungsereignis(int $bestellungId, string $code, string $ort = '', string $quelle = 'system', string $benutzer = '', ?string $textDe = null, ?string $textEn = null, bool $statusSetzen = true): void
{
    $db = datenbank();
    $db->prepare('INSERT INTO sendungsereignisse (bestellung_id, zeit, code, text_de, text_en, ort, quelle, benutzer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute([$bestellungId, jetzt(), $code, $textDe ?? versandstatusName($code, 'de'), $textEn ?? versandstatusName($code, 'en'), $ort, $quelle, $benutzer]);
    if ($statusSetzen && isset(VERSANDSTATUS[$code]) && $code !== 'bezahlt') {
        $db->prepare('UPDATE bestellungen SET versandstatus = ?, aktualisiert = ? WHERE id = ?')->execute([$code, jetzt(), $bestellungId]);
    }
}

function sendungsereignisse(int $bestellungId): array
{
    $st = datenbank()->prepare('SELECT * FROM sendungsereignisse WHERE bestellung_id = ? ORDER BY zeit, id');
    $st->execute([$bestellungId]);

    return $st->fetchAll();
}

/** Öffentliche Sendungsverfolgung: Nummer + PLZ des Empfängers als Schutz vor Durchprobieren. */
function trackingOeffentlich(string $extRef, string $plz): ?array
{
    $b = bestellungLaden('ext_ref', strtoupper(trim($extRef)));
    if ($b === null) {
        return null;
    }
    $emp = json_decode((string) $b['empfaenger_json'], true) ?: [];
    if (preg_replace('/\s+/', '', (string) ($emp['plz'] ?? '')) !== preg_replace('/\s+/', '', $plz)) {
        return null;
    }
    $sprache = $b['sprache'] === 'en' ? 'en' : 'de';

    return [
        'nummer' => $b['ext_ref'],
        'versandstatus' => $b['versandstatus'],
        'status_text' => versandstatusName((string) $b['versandstatus'], $sprache),
        'zielland' => $b['zielland'],
        'carrier' => $b['carrier'],
        'empfaenger_ort' => $emp['ort'] ?? '',
        'ereignisse' => array_map(static fn (array $e): array => ['zeit' => $e['zeit'], 'text' => $e[$sprache === 'en' ? 'text_en' : 'text_de'], 'ort' => $e['ort']], sendungsereignisse((int) $b['id'])),
    ];
}

// ------------------------------------------------------------------ Guthaben

/** Geltungsbereich des Guthabens: Firma bei Geschäftskunden, sonst das Konto. */
function guthabenBereich(array $kunde): array
{
    if (($kunde['art'] ?? '') === 'business' && (int) ($kunde['firma_id'] ?? 0) > 0) {
        return ['firma_id = ?', [(int) $kunde['firma_id']], null, (int) $kunde['firma_id']];
    }

    return ['kunde_id = ? AND firma_id IS NULL', [(int) $kunde['id']], (int) $kunde['id'], null];
}

function guthabenStand(array $kunde): int
{
    [$wo, $werte] = guthabenBereich($kunde);
    $st = datenbank()->prepare('SELECT COALESCE(SUM(betrag_cent),0) FROM guthaben_buchungen WHERE ' . $wo);
    $st->execute($werte);

    return (int) $st->fetchColumn();
}

function guthabenBuchungen(array $kunde, int $limit = 50): array
{
    [$wo, $werte] = guthabenBereich($kunde);
    $wo = 'g.' . str_replace(' AND ', ' AND g.', $wo);
    $st = datenbank()->prepare('SELECT g.*, b.ext_ref FROM guthaben_buchungen g LEFT JOIN bestellungen b ON b.id = g.bestellung_id WHERE ' . $wo . ' ORDER BY g.id DESC LIMIT ' . $limit);
    $st->execute($werte);

    return $st->fetchAll();
}

/** Buchung schreiben; Verbrauch ist negativ. Liefert den neuen Stand. */
function guthabenBuchen(array $kunde, string $art, int $betragCent, string $text, ?int $bestellungId = null, ?int $aufladungId = null): int
{
    [, , $kundeId, $firmaId] = guthabenBereich($kunde);
    datenbank()->prepare('INSERT INTO guthaben_buchungen (kunde_id, firma_id, art, betrag_cent, bestellung_id, aufladung_id, text, zeit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$kundeId, $firmaId, $art, $betragCent, $bestellungId, $aufladungId, $text, jetzt()]);

    return guthabenStand($kunde);
}

// ---------------------------------------------------------------- Aufladungen

function aufladungLaden(string $spalte, string $wert): ?array
{
    if (!in_array($spalte, ['ext_ref', 'revolut_id', 'id'], true)) {
        throw new InvalidArgumentException('Unbekannte Spalte');
    }
    $st = datenbank()->prepare("SELECT * FROM aufladungen WHERE $spalte = ? LIMIT 1");
    $st->execute([$wert]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Aufladung anlegen und Revolut-Order eröffnen; liefert ['aufladung', 'token']. */
function aufladungAnlegen(array $kunde, int $betragCent, string $sprache): array
{
    if ($betragCent < 500 || $betragCent > 500000) {
        throw new InvalidArgumentException('betrag');
    }
    if (!zahlungBereit()) {
        throw new RuntimeException('nicht-eingerichtet');
    }
    [, , $kundeId, $firmaId] = guthabenBereich($kunde);
    $db = datenbank();
    $extRef = 'NG-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $db->prepare('INSERT INTO aufladungen (ext_ref, kunde_id, firma_id, betrag_cent, status, sprache, erstellt) VALUES (?, ?, ?, ?, ?, ?, ?)')
       ->execute([$extRef, $kundeId, $firmaId, $betragCent, 'offen', $sprache, jetzt()]);
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $antwort = revolutOrderEroeffnen([
        'amount' => $betragCent,
        'currency' => 'EUR',
        'description' => ($sprache === 'en' ? 'NEOS credit top-up ' : 'NEOS Guthaben-Aufladung ') . $extRef,
        'merchant_order_ext_ref' => $extRef,
        'capture_mode' => 'automatic',
        'customer' => ['email' => (string) $kunde['email'], 'full_name' => (string) $kunde['name']],
        'redirect_url' => $basis !== '' ? $basis . '/konto/guthaben?aufladung=' . $extRef . ($sprache === 'en' ? '&sprache=en' : '') : null,
    ]);
    $db->prepare('UPDATE aufladungen SET revolut_id = ? WHERE ext_ref = ?')->execute([$antwort['id'], $extRef]);

    return ['aufladung' => aufladungLaden('ext_ref', $extRef), 'token' => $antwort['token']];
}

/** Status einer Aufladung setzen; „bezahlt“ bucht das Guthaben genau einmal. */
function aufladungFortschreiben(array $aufladung, string $status): array
{
    if ($aufladung['status'] === 'bezahlt') {
        return $aufladung;
    }
    $db = datenbank();
    $db->prepare('UPDATE aufladungen SET status = ?, bezahlt = COALESCE(bezahlt, ?) WHERE id = ?')
       ->execute([$status, $status === 'bezahlt' ? jetzt() : null, $aufladung['id']]);
    if ($status === 'bezahlt') {
        $kunde = ['id' => (int) ($aufladung['kunde_id'] ?? 0), 'art' => $aufladung['firma_id'] ? 'business' : 'privat', 'firma_id' => $aufladung['firma_id']];
        guthabenBuchen($kunde, 'aufladung', (int) $aufladung['betrag_cent'], 'Aufladung ' . $aufladung['ext_ref'], null, (int) $aufladung['id']);
    }

    return aufladungLaden('id', (string) $aufladung['id']) ?? $aufladung;
}

// -------------------------------------------------------------- Revolut-Order

/** Order bei Revolut eröffnen; liefert ['id', 'token', 'state'] oder wirft. */
function revolutOrderEroeffnen(array $order): array
{
    if (empty($order['redirect_url'])) {
        unset($order['redirect_url']);
    }
    $antwort = revolutAnfrage('POST', '/api/orders', $order);
    $token = (string) ($antwort['daten']['token'] ?? '');
    $id = (string) ($antwort['daten']['id'] ?? '');
    if ($antwort['status'] < 200 || $antwort['status'] >= 300 || $token === '' || $id === '') {
        error_log('[revolut] Order abgelehnt (HTTP ' . $antwort['status'] . '): ' . json_encode($antwort['daten']));
        throw new RuntimeException('zahlungsdienst');
    }

    return ['id' => $id, 'token' => $token, 'state' => (string) ($antwort['daten']['state'] ?? '')];
}

// ------------------------------------------------------------------ Sendungen

/**
 * Sendung anlegen — gemeinsamer Weg für Startseiten-Checkout, Kundenportal
 * (Privat und Business), CSV-Import und Retouren.
 *
 * $p: sprache, zielland, gewichtsklasse (oder gewicht_gramm), carrier (optional,
 *     sonst Priorität 1), zusatz [codes], masse {l,b,h}, email, absender{}, empfaenger{},
 *     referenz, kunde_id, firma_id, zahlungsart ('revolut'|'rechnung'|'guthaben'),
 *     art ('sendung'|'retoure'), retoure_zu, abholung {datum, von, bis},
 *     versicherung_wert_cent, nachnahme_cent, angelegt_von, adresse_speichern (bool)
 *
 * Liefert ['bestellung' => …] oder ['fehler' => [feldnamen]].
 */
function bestellungAnlegen(array $p): array
{
    $sprache = ($p['sprache'] ?? 'de') === 'en' ? 'en' : 'de';
    $zielland = strtoupper(saeubern($p['zielland'] ?? '', 2));
    $gewicht = max(0, (int) ($p['gewicht_gramm'] ?? 0));
    $masse = ['l' => (int) (($p['masse'] ?? [])['l'] ?? 0), 'b' => (int) (($p['masse'] ?? [])['b'] ?? 0), 'h' => (int) (($p['masse'] ?? [])['h'] ?? 0)];
    $carrier = saeubern($p['carrier'] ?? '', 60);
    $preislisteId = isset($p['preisliste_id']) && (int) $p['preisliste_id'] > 0 ? (int) $p['preisliste_id'] : null;
    $gk = saeubern($p['gewichtsklasse'] ?? '', 12);
    // Volumengewicht (L·B·H / Faktor des Carriers) hebt die Klasse an, wenn es das reale Gewicht übersteigt.
    $volumen = 0;
    if ($gk === '' && $gewicht > 0) {
        $vorlaeufig = (string) gewichtsklasseFuerGewicht($gewicht);
        $faktor = 5000;
        foreach ($vorlaeufig !== '' ? angeboteFuer($zielland, $vorlaeufig, $preislisteId) : [] as $a) {
            if ($carrier === '' || $a['carrier'] === $carrier) {
                $faktor = (int) $a['volumenfaktor'];
                break;
            }
        }
        $volumen = volumengewichtGramm($masse, $faktor);
        $gk = (string) gewichtsklasseFuerGewicht(max($gewicht, $volumen));
    }
    if ($gk === '') {
        $gk = (string) array_key_first(preisliste()['gewichtsklassen']);
    }
    $zahlungsart = in_array($p['zahlungsart'] ?? '', ['revolut', 'rechnung', 'guthaben'], true) ? $p['zahlungsart'] : 'revolut';
    $art = ($p['art'] ?? 'sendung') === 'retoure' ? 'retoure' : 'sendung';
    $email = saeubern($p['email'] ?? '', 254);
    $adresse = static fn (mixed $roh): array => [
        'name' => saeubern(($roh ?? [])['name'] ?? '', 100),
        'firma' => saeubern(($roh ?? [])['firma'] ?? '', 100),
        'strasse' => saeubern(($roh ?? [])['strasse'] ?? '', 120),
        'plz' => saeubern(($roh ?? [])['plz'] ?? '', 12),
        'ort' => saeubern(($roh ?? [])['ort'] ?? '', 80),
        'land' => strtoupper(saeubern(($roh ?? [])['land'] ?? '', 2)),
        'email' => saeubern(($roh ?? [])['email'] ?? '', 254),
        'telefon' => saeubern(($roh ?? [])['telefon'] ?? '', 40),
    ];
    $absender = $adresse($p['absender'] ?? null);
    $empfaenger = $adresse($p['empfaenger'] ?? null);
    $empfaenger['land'] = $zielland;
    $zusatz = zusatzBerechnen(is_array($p['zusatz'] ?? null) ? $p['zusatz'] : [], $preislisteId);
    $abholung = null;
    $codes = array_column($zusatz['liste'], 'code');

    $fehler = [];
    $angebote = angeboteFuer($zielland, $gk, $preislisteId);
    $angebot = null;
    foreach ($angebote as $a) {
        if ($carrier === '' || $a['carrier'] === $carrier) {
            $angebot = $a;
            break;
        }
    }
    if ($angebot === null) {
        $fehler[] = $angebote === [] ? 'zielland' : 'carrier';
    }
    if ($gewicht > 0) {
        $max = (int) (preisliste()['gewichtsklassen'][$gk]['max_gramm'] ?? 0);
        if ($max > 0 && max($gewicht, $volumen) > $max) {
            $fehler[] = 'gewicht';
        }
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
        if ($a['email'] !== '' && filter_var($a['email'], FILTER_VALIDATE_EMAIL) === false) {
            $fehler[] = $rolle . '.email';
        }
    }
    if (in_array('abholung', $codes, true)) {
        $datum = saeubern(($p['abholung'] ?? [])['datum'] ?? '', 10);
        $zeit = strtotime($datum . ' 00:00:00 UTC');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum) || $zeit === false || $zeit < strtotime('tomorrow UTC') || (int) gmdate('N', $zeit) > 5) {
            $fehler[] = 'abholung';
        } else {
            $fenster = saeubern(($p['abholung'] ?? [])['fenster'] ?? '9-13', 6);
            $abholung = ['datum' => $datum, 'fenster' => in_array($fenster, ['9-13', '13-17'], true) ? $fenster : '9-13'];
        }
    }
    $versicherungWert = in_array('versicherung', $codes, true) ? max(0, (int) ($p['versicherung_wert_cent'] ?? 0)) : 0;
    $nachnahme = in_array('nachnahme', $codes, true) ? max(0, (int) ($p['nachnahme_cent'] ?? 0)) : 0;
    if (in_array('nachnahme', $codes, true) && $nachnahme <= 0) {
        $fehler[] = 'nachnahme';
    }
    if ($fehler !== []) {
        return ['fehler' => array_values(array_unique($fehler))];
    }

    $netto = $angebot['netto'] + $zusatz['netto'];
    $brutto = bruttoCent($netto);
    $kundeId = isset($p['kunde_id']) && (int) $p['kunde_id'] > 0 ? (int) $p['kunde_id'] : null;
    $firmaId = isset($p['firma_id']) && (int) $p['firma_id'] > 0 ? (int) $p['firma_id'] : null;
    // Unterkunde (Rechnungsempfänger innerhalb der Firma) nur, wenn er zur Firma gehört und aktiv ist
    $unterkundeId = null;
    if ($firmaId !== null && isset($p['unterkunde_id']) && (int) $p['unterkunde_id'] > 0) {
        $u = unterkundeLaden((int) $p['unterkunde_id']);
        $unterkundeId = $u !== null && (int) $u['firma_id'] === $firmaId && (int) $u['aktiv'] === 1 ? (int) $u['id'] : null;
    }
    $status = $zahlungsart === 'revolut' ? 'offen' : 'beauftragt';
    $kontoFuerGuthaben = ['id' => $kundeId ?? 0, 'art' => $firmaId ? 'business' : 'privat', 'firma_id' => $firmaId];
    if ($zahlungsart === 'guthaben' && guthabenStand($kontoFuerGuthaben) < $brutto) {
        return ['fehler' => ['guthaben']];
    }

    $db = datenbank();
    $extRef = ($art === 'retoure' ? 'NR-' : 'NE-') . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4)));
    if ($art === 'retoure') {
        $extRef = 'NE-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4))); // gleiche Nummernform, Kennzeichnung über art
    }
    $ereignis = ['zeit' => jetzt(), 'ereignis' => 'angelegt', 'status' => $status, 'von' => (string) ($p['angelegt_von'] ?? '')];
    if ($volumen > $gewicht) {
        $ereignis['volumengewicht_gramm'] = $volumen;
    }
    $db->prepare(<<<'SQL'
        INSERT INTO bestellungen
            (ext_ref, status, netto_cent, mwst_cent, betrag_cent, waehrung, zielland, gewichtsklasse, carrier, einkauf_cent,
             email, sprache, absender_json, empfaenger_json, ereignisse_json, erstellt, aktualisiert,
             kunde_id, firma_id, zahlungsart, referenz, art, retoure_zu, gewicht_gramm, masse_json, zusatz_json, zusatz_cent,
             versandstatus, abholung_json, versicherung_cent, nachnahme_cent, preisliste_id, volumen_gramm, unterkunde_id)
        VALUES
            (:ref, :status, :netto, :mwst, :brutto, 'EUR', :land, :gk, :carrier, :einkauf, :email, :sprache, :abs, :emp, :ev, :t, :t,
             :kunde, :firma, :zahlungsart, :referenz, :art, :retoure_zu, :gewicht, :masse, :zusatz, :zusatz_cent, 'angelegt', :abholung, :vers, :nn, :liste, :volumen, :unterkunde)
    SQL)->execute([
        ':ref' => $extRef, ':status' => $status, ':netto' => $netto, ':mwst' => $brutto - $netto, ':brutto' => $brutto,
        ':land' => $zielland, ':gk' => $gk, ':carrier' => $angebot['carrier'], ':einkauf' => $angebot['einkauf'],
        ':email' => $email, ':sprache' => $sprache,
        ':abs' => json_encode($absender, JSON_UNESCAPED_UNICODE), ':emp' => json_encode($empfaenger, JSON_UNESCAPED_UNICODE),
        ':ev' => json_encode([$ereignis], JSON_UNESCAPED_UNICODE), ':t' => jetzt(),
        ':kunde' => $kundeId, ':firma' => $firmaId, ':zahlungsart' => $zahlungsart, ':referenz' => saeubern($p['referenz'] ?? '', 60),
        ':art' => $art, ':retoure_zu' => isset($p['retoure_zu']) ? (int) $p['retoure_zu'] : null,
        ':gewicht' => $gewicht, ':masse' => json_encode($masse), ':zusatz' => json_encode($zusatz['liste'], JSON_UNESCAPED_UNICODE), ':zusatz_cent' => $zusatz['netto'],
        ':abholung' => json_encode($abholung ?? new stdClass()), ':vers' => $versicherungWert, ':nn' => $nachnahme,
        ':liste' => $preislisteId, ':volumen' => $volumen, ':unterkunde' => $unterkundeId,
    ]);
    $bestellung = bestellungLaden('ext_ref', $extRef);
    sendungsereignis((int) $bestellung['id'], 'angelegt', '', 'system', (string) ($p['angelegt_von'] ?? ''));

    if ($zahlungsart === 'guthaben') {
        guthabenBuchen($kontoFuerGuthaben, 'verbrauch', -$brutto, ($art === 'retoure' ? 'Retoure ' : 'Sendung ') . $extRef, (int) $bestellung['id']);
        $bestellung = bestellungFortschreiben($bestellung, 'beauftragt', 'guthaben.belastet', ['betrag' => $brutto]);
        if ($firmaId === null) {
            // Privatkunde vom Guthaben: Rechnung über Lexware (Firmen: Sammelrechnung)
            lexwareAuftragAnlegen('rechnung', 'bestellungen', (int) $bestellung['id']);
            lexwareAuftraegeAbarbeiten(3);
        }
    }
    if ($zahlungsart !== 'revolut') {
        nachBeauftragung($bestellung);
        try {
            beauftragungSenden(bestellungLaden('ext_ref', $extRef));
        } catch (Throwable $e) {
            error_log('[versand] Bestätigungsmail: ' . $e->getMessage());
        }
        syncMarkieren('bestellungen', (int) $bestellung['id'], ['auftrag']);
    }
    if (!empty($p['adresse_speichern']) && ($kundeId || $firmaId)) {
        adresseSpeichern(['id' => $kundeId ?? 0, 'art' => $firmaId ? 'business' : 'privat', 'firma_id' => $firmaId], 'empfaenger', $empfaenger);
    }

    return ['bestellung' => bestellungLaden('ext_ref', $extRef)];
}

/** Nach Beauftragung (Rechnung/Guthaben) und nach Zahlung: Label, Abholung, Ereignisse. */
function nachBeauftragung(array $bestellung): void
{
    if (($bestellung['art'] ?? 'sendung') === 'nachberechnung') {
        return; // kein Label, keine Abholung — reine Geldposition
    }
    try {
        labelBeauftragen($bestellung);
    } catch (Throwable $e) {
        error_log('[versand] Label-Auftrag: ' . $e->getMessage());
    }
    $abholung = json_decode((string) ($bestellung['abholung_json'] ?? '{}'), true) ?: [];
    if (!empty($abholung['datum'])) {
        try {
            carrierAbholungBuchen($bestellung, $abholung);
            sendungsereignis((int) $bestellung['id'], 'abholung', '', 'system', '', 'Abholung beauftragt für ' . datumLesbar($abholung['datum']) . ', ' . str_replace('-', '–', $abholung['fenster']) . ' Uhr', 'Pickup booked for ' . datumLesbar($abholung['datum'], 'en') . ', ' . str_replace('-', '–', $abholung['fenster']) . ' h', false);
        } catch (Throwable $e) {
            error_log('[versand] Abholung: ' . $e->getMessage());
        }
    }
}

/** Bestätigung für Sendungen auf Rechnung oder vom Guthaben (bei Revolut: bestaetigungSenden() nach Zahlung). */
function beauftragungSenden(array $bestellung): void
{
    $sprache = $bestellung['sprache'] === 'en' ? 'en' : 'de';
    $land = preisliste()['laender'][$bestellung['zielland']]['name'][$sprache] ?? $bestellung['zielland'];
    $emp = json_decode((string) $bestellung['empfaenger_json'], true) ?: [];
    $abs = json_decode((string) $bestellung['absender_json'], true) ?: [];
    $abholung = json_decode((string) ($bestellung['abholung_json'] ?? '{}'), true) ?: [];
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $pfad = $bestellung['firma_id'] ? 'sendungen' : 'bestellungen';
    $retoure = $bestellung['art'] === 'retoure';
    $rechnung = $bestellung['zahlungsart'] === 'rechnung';
    $referenz = (string) $bestellung['referenz'] !== '' ? ' (' . $bestellung['referenz'] . ')' : '';
    $tracking = $basis . '/konto/tracking?nr=' . $bestellung['ext_ref'] . '&plz=' . rawurlencode((string) ($emp['plz'] ?? ''));
    if ($sprache === 'en') {
        $betreff = 'NEOS ' . ($retoure ? 'return' : 'shipment') . ' ' . $bestellung['ext_ref'] . ' booked';
        $zeilen = [
            'Hello ' . ($abs['name'] ?? '') . ',',
            '',
            'your ' . ($retoure ? 'return' : 'shipment') . ' is booked.',
            '',
            'Shipment:    ' . $bestellung['ext_ref'] . $referenz,
            'Destination: ' . $land . ', ' . $bestellung['gewichtsklasse'],
            'Recipient:   ' . ($emp['name'] ?? '') . ', ' . ($emp['strasse'] ?? '') . ', ' . ($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''),
            'Carrier:     ' . $bestellung['carrier'],
            $rechnung ? 'Net price:   ' . betragFormat((int) $bestellung['netto_cent'], 'en') . ' (monthly invoice)' : 'Amount:      ' . betragFormat((int) $bestellung['betrag_cent'], 'en') . ' incl. VAT, debited from your credit',
        ];
        if (!empty($abholung['datum'])) {
            $zeilen[] = 'Pickup:      ' . datumLesbar($abholung['datum'], 'en') . ', ' . str_replace('-', '–', (string) ($abholung['fenster'] ?? '')) . ' h';
        }
        array_push($zeilen, '', 'Label (PDF) and tracking in the portal: ' . $basis . '/konto/' . $pfad . '/' . $bestellung['ext_ref'] . '?sprache=en', 'Tracking: ' . $tracking . '&sprache=en', '', 'NEOS Logistics UG · info@neos24.com');
    } else {
        $betreff = 'NEOS-' . ($retoure ? 'Retoure' : 'Sendung') . ' ' . $bestellung['ext_ref'] . ' beauftragt';
        $zeilen = [
            'Hallo ' . ($abs['name'] ?? '') . ',',
            '',
            'deine ' . ($retoure ? 'Retoure' : 'Sendung') . ' ist beauftragt.',
            '',
            'Sendung:     ' . $bestellung['ext_ref'] . $referenz,
            'Zielland:    ' . $land . ', ' . $bestellung['gewichtsklasse'],
            'Empfänger:   ' . ($emp['name'] ?? '') . ', ' . ($emp['strasse'] ?? '') . ', ' . ($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''),
            'Carrier:     ' . $bestellung['carrier'],
            $rechnung ? 'Preis netto: ' . betragFormat((int) $bestellung['netto_cent'], 'de') . ' (Abrechnung mit der Monatsrechnung)' : 'Betrag:      ' . betragFormat((int) $bestellung['betrag_cent'], 'de') . ' inkl. MwSt., vom Guthaben abgebucht',
        ];
        if (!empty($abholung['datum'])) {
            $zeilen[] = 'Abholung:    ' . datumLesbar($abholung['datum']) . ', ' . str_replace('-', '–', (string) ($abholung['fenster'] ?? '')) . ' Uhr';
        }
        array_push($zeilen, '', 'Label (PDF) und Verlauf im Portal: ' . $basis . '/konto/' . $pfad . '/' . $bestellung['ext_ref'], 'Sendungsverfolgung: ' . $tracking, '', 'NEOS Logistics UG · info@neos24.com');
    }
    mailSenden((string) $bestellung['email'], $betreff, implode("\n", $zeilen), rechnungAnhangFuerBestellung($bestellung));
    $kopie = (string) (konfig()['kopie'] ?? '');
    if ($kopie !== '') {
        mailSenden($kopie, '[Kopie] ' . $betreff, implode("\n", $zeilen));
    }
}

function datumLesbar(string $datum, string $sprache = 'de'): string
{
    $t = strtotime($datum . ' 00:00:00 UTC');

    return $t === false ? $datum : ($sprache === 'en' ? gmdate('d/m/Y', $t) : gmdate('d.m.Y', $t));
}

/** Revolut-Order für eine offene Bestellung eröffnen; liefert Token. */
function bestellungRevolutEroeffnen(array $bestellung): string
{
    $sprache = $bestellung['sprache'] === 'en' ? 'en' : 'de';
    $landName = preisliste()['laender'][$bestellung['zielland']]['name'][$sprache] ?? $bestellung['zielland'];
    $gkName = preisliste()['gewichtsklassen'][$bestellung['gewichtsklasse']][$sprache] ?? $bestellung['gewichtsklasse'];
    $absender = json_decode((string) $bestellung['absender_json'], true) ?: [];
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $rueck = null;
    if ($basis !== '') {
        $rueck = $bestellung['kunde_id']
            ? $basis . '/konto/bestellungen/' . $bestellung['ext_ref'] . '/bezahlen?zurueck=1' . ($sprache === 'en' ? '&sprache=en' : '')
            : $basis . ($sprache === 'en' ? '/en/?customer=private' : '/?kunde=privat') . '&bestellung=' . $bestellung['ext_ref'] . '#paket';
    }
    $antwort = revolutOrderEroeffnen([
        'amount' => (int) $bestellung['betrag_cent'],
        'currency' => (string) $bestellung['waehrung'],
        'description' => $sprache === 'de' ? 'NEOS Paket nach ' . $landName . ', ' . $gkName . ' (' . $bestellung['ext_ref'] . ')' : 'NEOS parcel to ' . $landName . ', ' . $gkName . ' (' . $bestellung['ext_ref'] . ')',
        'merchant_order_ext_ref' => (string) $bestellung['ext_ref'],
        'capture_mode' => 'automatic',
        'customer' => ['email' => (string) $bestellung['email'], 'full_name' => (string) ($absender['name'] ?? '')],
        'redirect_url' => $rueck,
    ]);
    datenbank()->prepare('UPDATE bestellungen SET revolut_id = :r, aktualisiert = :a WHERE id = :id')
        ->execute([':r' => $antwort['id'], ':a' => jetzt(), ':id' => $bestellung['id']]);
    bestellungFortschreiben(bestellungLaden('ext_ref', (string) $bestellung['ext_ref']), 'angelegt', 'revolut.angelegt', ['state' => $antwort['state']]);

    return $antwort['token'];
}

// ------------------------------------------------------------------ Adressen

function adressenBereich(array $kunde): array
{
    if (($kunde['art'] ?? '') === 'business' && (int) ($kunde['firma_id'] ?? 0) > 0) {
        return ['firma_id = ?', [(int) $kunde['firma_id']], null, (int) $kunde['firma_id']];
    }

    return ['kunde_id = ? AND firma_id IS NULL', [(int) $kunde['id']], (int) $kunde['id'], null];
}

function adressenAlle(array $kunde, string $art = ''): array
{
    [$wo, $werte] = adressenBereich($kunde);
    if ($art !== '') {
        $wo .= ' AND art = ?';
        $werte[] = $art;
    }
    $st = datenbank()->prepare('SELECT * FROM adressen WHERE ' . $wo . ' ORDER BY standard DESC, name');
    $st->execute($werte);

    return $st->fetchAll();
}

function adresseLaden(array $kunde, int $id): ?array
{
    [$wo, $werte] = adressenBereich($kunde);
    $st = datenbank()->prepare('SELECT * FROM adressen WHERE id = ? AND ' . $wo);
    $st->execute(array_merge([$id], $werte));
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Adresse anlegen oder (gleicher Name + Straße + PLZ) aktualisieren; liefert die ID. */
function adresseSpeichern(array $kunde, string $art, array $a, ?int $id = null, bool $standard = false): int
{
    [$wo, $werte, $kundeId, $firmaId] = adressenBereich($kunde);
    $art = $art === 'absender' ? 'absender' : 'empfaenger';
    $db = datenbank();
    if ($id === null) {
        $st = $db->prepare('SELECT id FROM adressen WHERE art = ? AND name = ? AND strasse = ? AND plz = ? AND ' . $wo);
        $st->execute(array_merge([$art, $a['name'] ?? '', $a['strasse'] ?? '', $a['plz'] ?? ''], $werte));
        $vorhanden = $st->fetchColumn();
        $id = $vorhanden !== false ? (int) $vorhanden : null;
    }
    if ($standard) {
        $db->prepare('UPDATE adressen SET standard = 0 WHERE art = ? AND ' . $wo)->execute(array_merge([$art], $werte));
    }
    $felder = [$a['name'] ?? '', $a['firma'] ?? '', $a['strasse'] ?? '', $a['plz'] ?? '', $a['ort'] ?? '', strtoupper((string) ($a['land'] ?? 'DE')) ?: 'DE', $a['email'] ?? '', $a['telefon'] ?? '', $standard ? 1 : 0];
    if ($id !== null) {
        $db->prepare('UPDATE adressen SET name = ?, firma = ?, strasse = ?, plz = ?, ort = ?, land = ?, email = ?, telefon = ?, standard = CASE WHEN ? = 1 THEN 1 ELSE standard END WHERE id = ? AND ' . $wo)
           ->execute(array_merge($felder, [$id], $werte));

        return $id;
    }
    $db->prepare('INSERT INTO adressen (kunde_id, firma_id, art, name, firma, strasse, plz, ort, land, email, telefon, standard, erstellt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute(array_merge([$kundeId, $firmaId, $art], $felder, [jetzt()]));

    return (int) $db->lastInsertId();
}

function adresseLoeschen(array $kunde, int $id): void
{
    [$wo, $werte] = adressenBereich($kunde);
    datenbank()->prepare('DELETE FROM adressen WHERE id = ? AND ' . $wo)->execute(array_merge([$id], $werte));
}

// ------------------------------------------------------------- Paketvorlagen

function vorlagenAlle(array $kunde): array
{
    [$wo, $werte] = adressenBereich($kunde);
    $st = datenbank()->prepare('SELECT * FROM paketvorlagen WHERE ' . $wo . ' ORDER BY name');
    $st->execute($werte);

    return $st->fetchAll();
}

function vorlageLaden(array $kunde, int $id): ?array
{
    [$wo, $werte] = adressenBereich($kunde);
    $st = datenbank()->prepare('SELECT * FROM paketvorlagen WHERE id = ? AND ' . $wo);
    $st->execute(array_merge([$id], $werte));
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function vorlageSpeichern(array $kunde, array $v, ?int $id = null): int
{
    [$wo, $werte, $kundeId, $firmaId] = adressenBereich($kunde);
    $db = datenbank();
    $felder = [$v['name'], (int) $v['gewicht_gramm'], (int) $v['laenge_cm'], (int) $v['breite_cm'], (int) $v['hoehe_cm'], json_encode(array_values($v['zusatz'] ?? []))];
    if ($id !== null) {
        $db->prepare('UPDATE paketvorlagen SET name = ?, gewicht_gramm = ?, laenge_cm = ?, breite_cm = ?, hoehe_cm = ?, zusatz_json = ? WHERE id = ? AND ' . $wo)->execute(array_merge($felder, [$id], $werte));

        return $id;
    }
    $db->prepare('INSERT INTO paketvorlagen (kunde_id, firma_id, name, gewicht_gramm, laenge_cm, breite_cm, hoehe_cm, zusatz_json, erstellt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute(array_merge([$kundeId, $firmaId], $felder, [jetzt()]));

    return (int) $db->lastInsertId();
}

function vorlageLoeschen(array $kunde, int $id): void
{
    [$wo, $werte] = adressenBereich($kunde);
    datenbank()->prepare('DELETE FROM paketvorlagen WHERE id = ? AND ' . $wo)->execute(array_merge([$id], $werte));
}

// ------------------------------------------------------------------- Retouren

/** Rücksendung zu einer zugestellten Sendung: Empfänger und Absender tauschen. */
function retoureAnlegen(array $kunde, array $original, string $zahlungsart, string $von): array
{
    $abs = json_decode((string) $original['absender_json'], true) ?: [];
    $emp = json_decode((string) $original['empfaenger_json'], true) ?: [];
    $zielland = strtoupper((string) ($abs['land'] ?? '')) ?: 'DE';

    return bestellungAnlegen([
        'sprache' => $original['sprache'],
        'zielland' => $zielland,
        'gewichtsklasse' => $original['gewichtsklasse'],
        'gewicht_gramm' => (int) $original['gewicht_gramm'],
        'email' => $kunde['email'],
        'absender' => $emp,
        'empfaenger' => $abs,
        'referenz' => 'Retoure ' . $original['ext_ref'],
        'kunde_id' => $kunde['id'],
        'firma_id' => $kunde['firma_id'] ?? null,
        'unterkunde_id' => $original['unterkunde_id'] ?? null,
        'preisliste_id' => preislisteFuerKonto(['firma_id' => $kunde['firma_id'] ?? null, 'kunde_id' => $kunde['id'], 'unterkunde_id' => $original['unterkunde_id'] ?? null]),
        'zahlungsart' => $zahlungsart,
        'art' => 'retoure',
        'retoure_zu' => (int) $original['id'],
        'angelegt_von' => $von,
    ]);
}

// -------------------------------------------------------------- Reklamationen

const REKLAMATION_ARTEN = [
    'beschaedigung' => ['de' => 'Beschädigung', 'en' => 'Damage'],
    'verlust' => ['de' => 'Verlust', 'en' => 'Loss'],
    'verspaetung' => ['de' => 'Verspätung', 'en' => 'Delay'],
    'falschzustellung' => ['de' => 'Falschzustellung', 'en' => 'Misdelivery'],
    'nachberechnung' => ['de' => 'Widerspruch Nachberechnung', 'en' => 'Objection to weight adjustment'],
    'sonstiges' => ['de' => 'Sonstiges', 'en' => 'Other'],
];
const REKLAMATION_STATUS = [
    'neu' => ['de' => 'Neu', 'en' => 'New'],
    'in_pruefung' => ['de' => 'In Prüfung', 'en' => 'Under review'],
    'anerkannt' => ['de' => 'Anerkannt', 'en' => 'Accepted'],
    'erstattet' => ['de' => 'Erstattet', 'en' => 'Refunded'],
    'abgelehnt' => ['de' => 'Abgelehnt', 'en' => 'Declined'],
];

function reklamationAnlegen(array $kunde, array $bestellung, string $art, string $beschreibung, int $betragCent): int
{
    if (!isset(REKLAMATION_ARTEN[$art]) || mb_strlen($beschreibung) < 10) {
        throw new InvalidArgumentException('eingabe');
    }
    [, , $kundeId, $firmaId] = adressenBereich($kunde);
    $db = datenbank();
    $db->prepare('INSERT INTO reklamationen (bestellung_id, kunde_id, firma_id, art, beschreibung, betrag_cent, status, antwort, erstellt, aktualisiert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute([(int) $bestellung['id'], $kundeId, $firmaId, $art, $beschreibung, max(0, $betragCent), 'neu', '', jetzt(), jetzt()]);
    $id = (int) $db->lastInsertId();
    sendungsereignis((int) $bestellung['id'], 'reklamation', '', 'kunde', (string) $kunde['name'], 'Reklamation eingereicht (' . REKLAMATION_ARTEN[$art]['de'] . ')', 'Claim submitted (' . REKLAMATION_ARTEN[$art]['en'] . ')', false);

    return $id;
}

function reklamationenDesKunden(array $kunde): array
{
    [$wo, $werte] = adressenBereich($kunde);
    $wo = str_replace(['kunde_id', 'firma_id'], ['r.kunde_id', 'r.firma_id'], $wo);
    $st = datenbank()->prepare('SELECT r.*, b.ext_ref, b.zielland FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id WHERE ' . $wo . ' ORDER BY r.id DESC');
    $st->execute($werte);

    return $st->fetchAll();
}

function reklamationLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT r.*, b.ext_ref, b.zielland, b.email, b.carrier, b.betrag_cent AS bestellung_cent, b.sprache, k.name AS kunde_name, k.email AS kunde_email, f.name AS firma_name FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id LEFT JOIN kunden k ON k.id = r.kunde_id LEFT JOIN firmen f ON f.id = r.firma_id WHERE r.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Antwort des Teams an den Kunden mailen (Sprache der Bestellung). */
function reklamationAntwortSenden(array $r): void
{
    $sprache = ($r['sprache'] ?? 'de') === 'en' ? 'en' : 'de';
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $statusName = REKLAMATION_STATUS[$r['status']][$sprache] ?? $r['status'];
    $an = (string) ($r['kunde_email'] ?: $r['email']);
    if ($sprache === 'en') {
        $betreff = 'Your claim for NEOS shipment ' . $r['ext_ref'] . ': ' . $statusName;
        $zeilen = ['Hello ' . ($r['kunde_name'] ?? '') . ',', '', 'we have looked into your claim for shipment ' . $r['ext_ref'] . '.', '', 'Status: ' . $statusName];
        if ((int) $r['erstattung_cent'] > 0) {
            $zeilen[] = 'Refund: ' . betragFormat((int) $r['erstattung_cent'], 'en') . ' credited to your NEOS account balance';
        }
        array_push($zeilen, '', $r['antwort'], '', 'Claims in the portal: ' . $basis . '/konto/reklamationen?sprache=en', '', 'NEOS Logistics UG · info@neos24.com');
    } else {
        $betreff = 'Deine Reklamation zu NEOS-Sendung ' . $r['ext_ref'] . ': ' . $statusName;
        $zeilen = ['Hallo ' . ($r['kunde_name'] ?? '') . ',', '', 'wir haben deine Reklamation zur Sendung ' . $r['ext_ref'] . ' geprüft.', '', 'Status: ' . $statusName];
        if ((int) $r['erstattung_cent'] > 0) {
            $zeilen[] = 'Erstattung: ' . betragFormat((int) $r['erstattung_cent'], 'de') . ' als Guthaben auf deinem NEOS-Konto';
        }
        array_push($zeilen, '', $r['antwort'], '', 'Reklamationen im Portal: ' . $basis . '/konto/reklamationen', '', 'NEOS Logistics UG · info@neos24.com');
    }
    mailSenden($an, $betreff, implode("\n", $zeilen));
}

/** Status setzen; „erstattet“ bucht den anerkannten Betrag als Guthaben. */
function reklamationFortschreiben(array $r, string $status, string $antwort, int $erstattungCent, string $bearbeiter): void
{
    if (!isset(REKLAMATION_STATUS[$status])) {
        throw new InvalidArgumentException('status');
    }
    $db = datenbank();
    $db->prepare('UPDATE reklamationen SET status = ?, antwort = ?, erstattung_cent = ?, bearbeiter = ?, aktualisiert = ? WHERE id = ?')
       ->execute([$status, $antwort, $erstattungCent, $bearbeiter, jetzt(), $r['id']]);
    if ($status === 'erstattet' && $erstattungCent > 0 && (int) ($r['erstattet_gebucht'] ?? 0) === 0) {
        $kunde = ['id' => (int) ($r['kunde_id'] ?? 0), 'art' => $r['firma_id'] ? 'business' : 'privat', 'firma_id' => $r['firma_id']];
        guthabenBuchen($kunde, 'erstattung', $erstattungCent, 'Erstattung Reklamation #' . $r['id'] . ' (' . $r['ext_ref'] . ')', (int) $r['bestellung_id']);
        $db->prepare('UPDATE reklamationen SET erstattet_gebucht = 1 WHERE id = ?')->execute([$r['id']]);
    }
}
