<?php

/**
 * Lexware Office (Cloud) — Rechnungen, Gutschriften, Kontakte, Zahlungsstatus.
 *
 * Lexware vergibt die Rechnungsnummern und erzeugt die PDFs. Die Plattform
 * übergibt Sammelrechnungen (Firmen), bezahlte Privatkunden-Bestellungen und
 * Nachberechnungen als Rechnung, Stornos als Gutschrift. Jeder Vorgang läuft
 * über die Warteschlange lexware_auftraege: ein API-Ausfall blockiert nichts,
 * nichts wird doppelt angelegt (Auftrag erst „erledigt“, wenn die Lexware-ID
 * gespeichert ist). Abarbeitung direkt nach dem Vorgang (best effort) und per
 * Cron: php intern/aufgaben.php lexware
 *
 * REST-API (Public API, Bearer-API-Key): /contacts, /invoices, /credit-notes,
 * /files, /payments, /event-subscriptions. Feldnamen entsprechen der
 * Lexware-Office-/lexoffice-Doku; Abweichungen sind hier an einer Stelle
 * korrigierbar. Kundendokumente enthalten keine Lieferantenangaben.
 */

declare(strict_types=1);

class LexwareFehler extends RuntimeException
{
    public function __construct(string $meldung, public readonly int $status = 0, public readonly array $antwort = [])
    {
        parent::__construct($meldung);
    }
}

function lexwareKonfig(): array
{
    return (array) (konfig()['lexware'] ?? []);
}

function lexwareAktiv(): bool
{
    $k = lexwareKonfig();

    return !empty($k['aktiv']) && (string) ($k['apiKey'] ?? '') !== '';
}

function lexwareVerzeichnis(): string
{
    $pfad = rtrim((string) konfig()['daten'], '/') . '/lexware';
    if (!is_dir($pfad) && !@mkdir($pfad, 0770, true) && !is_dir($pfad)) {
        throw new RuntimeException('Verzeichnis nicht anlegbar: ' . $pfad);
    }

    return $pfad;
}

/** Pfad des Lexware-PDFs zu einer Beleg-ID (leer ohne ID). */
function lexwarePdfPfad(string $lexwareId): string
{
    return $lexwareId !== '' ? lexwareVerzeichnis() . '/' . preg_replace('/[^A-Za-z0-9_-]/', '', $lexwareId) . '.pdf' : '';
}

// ------------------------------------------------------------------- HTTP

/**
 * API-Aufruf. Liefert ['status' => int, 'daten' => array, 'roh' => string].
 * Wirft LexwareFehler bei Transportfehlern und Status ≥ 400 (nach einem
 * Wiederholungsversuch bei 429/5xx).
 */
function lexwareAnfrage(string $methode, string $pfad, ?array $daten = null, bool $pdf = false): array
{
    $k = lexwareKonfig();
    if ((string) ($k['apiKey'] ?? '') === '') {
        throw new LexwareFehler('Lexware: kein API-Key konfiguriert');
    }
    $url = rtrim((string) $k['basisUrl'], '/') . '/' . ltrim($pfad, '/');
    for ($versuch = 1; $versuch <= 2; $versuch++) {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new LexwareFehler('curl_init fehlgeschlagen');
        }
        $kopf = ['Authorization: Bearer ' . $k['apiKey'], 'Accept: ' . ($pdf ? 'application/pdf' : 'application/json')];
        $optionen = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $methode, CURLOPT_TIMEOUT => (int) ($k['zeitlimit'] ?? 20), CURLOPT_CONNECTTIMEOUT => 10];
        if ($daten !== null) {
            $kopf[] = 'Content-Type: application/json';
            $optionen[CURLOPT_POSTFIELDS] = json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        $optionen[CURLOPT_HTTPHEADER] = $kopf;
        curl_setopt_array($ch, $optionen);
        $antwort = curl_exec($ch);
        if ($antwort === false) {
            $fehler = curl_error($ch);
            curl_close($ch);
            if ($versuch === 1) {
                usleep(800000);
                continue;
            }
            throw new LexwareFehler('Lexware nicht erreichbar: ' . $fehler);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if (($status === 429 || $status >= 500) && $versuch === 1) {
            usleep(1500000);
            continue;
        }
        $json = $pdf ? [] : (json_decode((string) $antwort, true) ?: []);
        if ($status >= 400) {
            $meldung = (string) ($json['message'] ?? $json['IssueList'][0]['i18nKey'] ?? ('HTTP ' . $status));
            throw new LexwareFehler('Lexware ' . $methode . ' ' . $pfad . ': ' . $meldung, $status, is_array($json) ? $json : []);
        }
        usleep(500000); // höchstens 2 Anfragen je Sekunde

        return ['status' => $status, 'daten' => is_array($json) ? $json : [], 'roh' => (string) $antwort];
    }
    throw new LexwareFehler('Lexware: keine Antwort');
}

/** Datum für voucherDate: ISO 8601 mit Millisekunden und Zeitzone. */
function lexwareDatum(?string $iso = null): string
{
    $d = new DateTimeImmutable($iso !== null && $iso !== '' ? $iso : 'now', new DateTimeZone('UTC'));

    return $d->setTimezone(new DateTimeZone('Europe/Berlin'))->format('Y-m-d\TH:i:s.000P');
}

// --------------------------------------------------------------- Kontakte

/** Kontaktdaten für Lexware aus Firma, Unterkunde oder Privatkunde. */
function lexwareKontaktDaten(array $z, string $tabelle): array
{
    $adresse = static fn (array $a): array => array_filter(['street' => (string) ($a['strasse'] ?? ''), 'zip' => (string) ($a['plz'] ?? ''), 'city' => (string) ($a['ort'] ?? ''), 'countryCode' => strtoupper((string) ($a['land'] ?? '') ?: 'DE')], static fn ($v): bool => $v !== '');
    $daten = ['roles' => ['customer' => new stdClass()]];
    if ($tabelle === 'kunden') {
        $abs = json_decode((string) ($z['absender_json'] ?? '{}'), true) ?: [];
        $name = trim((string) ($z['name'] ?? '')) !== '' ? trim((string) $z['name']) : (string) $z['email'];
        $teile = preg_split('/\s+/', $name) ?: [$name];
        $nachname = count($teile) > 1 ? array_pop($teile) : $name;
        $daten['person'] = array_filter(['firstName' => count($teile) > 1 || $nachname !== $name ? implode(' ', $teile) : '', 'lastName' => $nachname], static fn ($v): bool => $v !== '');
        $daten['addresses'] = ['billing' => [$adresse($abs + ['land' => $abs['land'] ?? 'DE'])]];
        $daten['emailAddresses'] = ['private' => [(string) $z['email']]];
        $daten['note'] = 'NEOS Kundennummer ' . $z['kundennummer'];

        return $daten;
    }
    $nummer = (string) ($tabelle === 'unterkunden' ? $z['nummer'] : $z['kundennummer']);
    $daten['company'] = array_filter(['name' => (string) $z['name'], 'vatRegistrationId' => (string) ($z['ust_id'] ?? '')], static fn ($v): bool => $v !== '');
    // Firmenbenutzer als Ansprechpartner (beim Unterkunden nur die ihm zugeordneten, bei der Firma alle ohne Zuordnung)
    $st = datenbank()->prepare("SELECT name, email, firmenrolle FROM kunden WHERE firma_id = ? AND aktiv = 1 AND art = 'business' AND " . ($tabelle === 'unterkunden' ? 'unterkunde_id = ?' : 'unterkunde_id IS NULL') . ' ORDER BY firmenrolle, name LIMIT 20');
    $st->execute($tabelle === 'unterkunden' ? [(int) $z['firma_id'], (int) $z['id']] : [(int) $z['id']]);
    $personen = [];
    foreach ($st->fetchAll() as $i => $b) {
        $teile = preg_split('/\s+/', trim((string) $b['name'])) ?: [];
        $nachname = $teile !== [] ? array_pop($teile) : (string) $b['email'];
        $personen[] = array_filter(['firstName' => implode(' ', $teile), 'lastName' => $nachname, 'emailAddress' => (string) $b['email'], 'primary' => $i === 0], static fn ($v): bool => $v !== '');
    }
    if ($personen !== []) {
        $daten['company']['contactPersons'] = $personen;
    }
    $daten['addresses'] = ['billing' => [$adresse($z)]];
    if ((string) ($z['rechnungs_email'] ?? '') !== '') {
        $daten['emailAddresses'] = ['business' => [(string) $z['rechnungs_email']]];
    }
    $daten['note'] = 'NEOS Kundennummer ' . $nummer . ($tabelle === 'unterkunden' ? ' (Unterkunde von ' . ($z['firma'] ?? '') . ')' : '');

    return $daten;
}

/**
 * Firma, Unterkunde oder Privatkunde als Kunde in Lexware anlegen oder
 * aktualisieren. Speichert Kontakt-ID und die von Lexware vergebene
 * Kundennummer am Datensatz; liefert den Kontakt (id, version, updatedDate,
 * roles.customer.number). $tabelle: firmen | unterkunden | kunden.
 */
function lexwareKontaktSichern(array $z, string $tabelle = 'firmen'): array
{
    if (!in_array($tabelle, ['firmen', 'unterkunden', 'kunden'], true)) {
        throw new LexwareFehler('Unbekannte Tabelle für Lexware-Kontakt: ' . $tabelle);
    }
    $id = (string) ($z['lexware_kontakt_id'] ?? '');
    $daten = lexwareKontaktDaten($z, $tabelle);
    $kontakt = null;
    if ($id !== '') {
        try {
            $alt = lexwareAnfrage('GET', '/contacts/' . rawurlencode($id))['daten'];
            $daten['version'] = (int) ($alt['version'] ?? 0);
            lexwareAnfrage('PUT', '/contacts/' . rawurlencode($id), $daten);
            $kontakt = lexwareAnfrage('GET', '/contacts/' . rawurlencode($id))['daten'];
        } catch (LexwareFehler $e) {
            if ($e->status !== 404) {
                throw $e;
            }
            $id = '';
        }
    }
    if ($id === '') {
        $daten['version'] = 0;
        $antwort = lexwareAnfrage('POST', '/contacts', $daten)['daten'];
        $id = (string) ($antwort['id'] ?? '');
        if ($id === '') {
            throw new LexwareFehler('Lexware: Kontakt ohne ID angelegt');
        }
        $kontakt = lexwareAnfrage('GET', '/contacts/' . rawurlencode($id))['daten'];
    }
    $nummer = (string) ($kontakt['roles']['customer']['number'] ?? '');
    datenbank()->prepare("UPDATE $tabelle SET lexware_kontakt_id = ?, lexware_kundennummer = CASE WHEN ? <> '' THEN ? ELSE lexware_kundennummer END WHERE id = ?")->execute([$id, $nummer, $nummer, $z['id']]);

    return ['id' => $id, 'version' => (int) ($kontakt['version'] ?? 0), 'updatedDate' => (string) ($kontakt['updatedDate'] ?? ''), 'nummer' => $nummer];
}

/** Kontakt-ID des Rechnungsempfängers (Unterkunde oder Firma) — legt ihn bei Bedarf an. */
function lexwareKontaktFuerEmpfaenger(array $empfaenger): string
{
    if ($empfaenger['lexware_kontakt_id'] !== '') {
        return (string) $empfaenger['lexware_kontakt_id'];
    }
    $zeile = $empfaenger['tabelle'] === 'unterkunden' ? $empfaenger['unterkunde'] : $empfaenger['firma'];

    return (string) lexwareKontaktSichern($zeile, $empfaenger['tabelle'])['id'];
}

/** Rechnungsadresse ohne Kontakt (Privatkunden) aus einer Adresse der Bestellung. */
function lexwareAdresse(array $a): array
{
    return array_filter([
        'name' => trim((string) ($a['name'] ?? '')) !== '' ? (string) $a['name'] : 'Kunde',
        'supplement' => (string) ($a['firma'] ?? ''),
        'street' => (string) ($a['strasse'] ?? ''),
        'zip' => (string) ($a['plz'] ?? ''),
        'city' => (string) ($a['ort'] ?? ''),
        'countryCode' => strtoupper((string) ($a['land'] ?? '')) ?: 'DE',
    ], static fn ($v): bool => $v !== '');
}

// ------------------------------------------------------------- Belege

/**
 * Rechnung anlegen und finalisieren. $kopf: address (Array) oder contactId,
 * taxType ('net'|'gross'), datum (ISO), zahlungsziel (Tage), titel, einleitung,
 * schluss, leistung_von/leistung_bis (ISO), vermerk. $positionen: [['name',
 * 'beschreibung', 'menge', 'einheit', 'cent' (netto bzw. brutto je taxType)]].
 * Liefert ['id', 'nummer', 'status'].
 */
function lexwareRechnungAnlegen(array $kopf, array $positionen): array
{
    $k = lexwareKonfig();
    $mwst = (int) konfig()['mwstSatz'];
    $brutto = ($kopf['taxType'] ?? 'net') === 'gross';
    $items = [];
    foreach ($positionen as $p) {
        $items[] = [
            'type' => 'custom',
            'name' => mb_substr((string) $p['name'], 0, 255),
            'description' => mb_substr((string) ($p['beschreibung'] ?? ''), 0, 2000),
            'quantity' => (float) ($p['menge'] ?? 1),
            'unitName' => (string) ($p['einheit'] ?? 'Stück'),
            'unitPrice' => ['currency' => 'EUR', ($brutto ? 'grossAmount' : 'netAmount') => round((int) $p['cent'] / 100, 2), 'taxRatePercentage' => $mwst],
        ];
    }
    $daten = [
        'archived' => false,
        'voucherDate' => lexwareDatum($kopf['datum'] ?? null),
        'address' => isset($kopf['contactId']) ? ['contactId' => (string) $kopf['contactId']] : (array) ($kopf['address'] ?? []),
        'lineItems' => $items,
        'totalPrice' => ['currency' => 'EUR'],
        'taxConditions' => ['taxType' => $brutto ? 'gross' : 'net'],
        'paymentConditions' => ['paymentTermLabel' => (string) ($kopf['zahlungsbedingung'] ?? ('Zahlbar innerhalb von ' . (int) ($kopf['zahlungsziel'] ?? $k['zahlungsziel'] ?? 14) . ' Tagen ohne Abzug.')), 'paymentTermDuration' => (int) ($kopf['zahlungsziel'] ?? $k['zahlungsziel'] ?? 14)],
        'shippingConditions' => isset($kopf['leistung_von'], $kopf['leistung_bis']) && $kopf['leistung_von'] !== $kopf['leistung_bis']
            ? ['shippingDate' => lexwareDatum($kopf['leistung_von']), 'shippingEndDate' => lexwareDatum($kopf['leistung_bis']), 'shippingType' => 'serviceperiod']
            : ['shippingDate' => lexwareDatum($kopf['leistung_von'] ?? $kopf['datum'] ?? null), 'shippingType' => 'service'],
        'title' => (string) ($kopf['titel'] ?? 'Rechnung'),
        'introduction' => (string) ($kopf['einleitung'] ?? $k['einleitung'] ?? ''),
        'remark' => trim((string) ($kopf['vermerk'] ?? '') . "\n" . (string) ($k['schlusstext'] ?? '')),
    ];
    $antwort = lexwareAnfrage('POST', '/invoices?finalize=true', $daten)['daten'];
    $id = (string) ($antwort['id'] ?? '');
    if ($id === '') {
        throw new LexwareFehler('Lexware: Rechnung ohne ID angelegt', 0, $antwort);
    }
    $beleg = lexwareAnfrage('GET', '/invoices/' . rawurlencode($id))['daten'];

    return ['id' => $id, 'nummer' => (string) ($beleg['voucherNumber'] ?? ''), 'status' => (string) ($beleg['voucherStatus'] ?? 'open')];
}

/** Gutschrift anlegen und finalisieren (gleiche Form wie Rechnung). */
function lexwareGutschriftAnlegen(array $kopf, array $positionen): array
{
    $k = lexwareKonfig();
    $mwst = (int) konfig()['mwstSatz'];
    $brutto = ($kopf['taxType'] ?? 'net') === 'gross';
    $items = [];
    foreach ($positionen as $p) {
        $items[] = ['type' => 'custom', 'name' => mb_substr((string) $p['name'], 0, 255), 'description' => mb_substr((string) ($p['beschreibung'] ?? ''), 0, 2000), 'quantity' => 1, 'unitName' => 'Stück',
            'unitPrice' => ['currency' => 'EUR', ($brutto ? 'grossAmount' : 'netAmount') => round((int) $p['cent'] / 100, 2), 'taxRatePercentage' => $mwst]];
    }
    $daten = [
        'archived' => false,
        'voucherDate' => lexwareDatum($kopf['datum'] ?? null),
        'address' => isset($kopf['contactId']) ? ['contactId' => (string) $kopf['contactId']] : (array) ($kopf['address'] ?? []),
        'lineItems' => $items,
        'totalPrice' => ['currency' => 'EUR'],
        'taxConditions' => ['taxType' => $brutto ? 'gross' : 'net'],
        'title' => (string) ($kopf['titel'] ?? 'Gutschrift'),
        'introduction' => (string) ($kopf['einleitung'] ?? ''),
        'remark' => trim((string) ($kopf['vermerk'] ?? '') . "\n" . (string) ($k['schlusstext'] ?? '')),
    ];
    $antwort = lexwareAnfrage('POST', '/credit-notes?finalize=true', $daten)['daten'];
    $id = (string) ($antwort['id'] ?? '');
    if ($id === '') {
        throw new LexwareFehler('Lexware: Gutschrift ohne ID angelegt', 0, $antwort);
    }
    $beleg = lexwareAnfrage('GET', '/credit-notes/' . rawurlencode($id))['daten'];

    return ['id' => $id, 'nummer' => (string) ($beleg['voucherNumber'] ?? ''), 'status' => (string) ($beleg['voucherStatus'] ?? 'open')];
}

/** PDF eines Belegs holen und ablegen; liefert den Pfad. */
function lexwarePdfHolen(string $art, string $id): string
{
    $pfad = lexwarePdfPfad($id);
    $dokument = lexwareAnfrage('GET', '/' . ($art === 'gutschrift' ? 'credit-notes' : 'invoices') . '/' . rawurlencode($id) . '/document')['daten'];
    $dateiId = (string) ($dokument['documentFileId'] ?? '');
    if ($dateiId === '') {
        throw new LexwareFehler('Lexware: kein Dokument zum Beleg ' . $id);
    }
    $inhalt = lexwareAnfrage('GET', '/files/' . rawurlencode($dateiId), null, true)['roh'];
    if (!str_starts_with($inhalt, '%PDF')) {
        throw new LexwareFehler('Lexware: Datei ist kein PDF');
    }
    file_put_contents($pfad, $inhalt);

    return $pfad;
}

/** Zahlungsstatus eines Belegs: ['status' => 'openRevenue'|'paid'|…, 'offen_cent', 'bezahlt_am']. */
function lexwareZahlungsstatus(string $id): array
{
    $z = lexwareAnfrage('GET', '/payments/' . rawurlencode($id))['daten'];

    return ['status' => (string) ($z['paymentStatus'] ?? ''), 'offen_cent' => (int) round((float) ($z['openAmount'] ?? 0) * 100), 'bezahlt_am' => (string) ($z['paidDate'] ?? ''), 'beleg_status' => (string) ($z['voucherStatus'] ?? '')];
}

// ------------------------------------------------------------ Warteschlange

/** Auftrag anlegen (idempotent je Art und Bezug, solange er nicht erledigt ist). Ohne aktives Lexware: nichts. */
function lexwareAuftragAnlegen(string $art, string $tabelle, int $id, array $daten = []): ?int
{
    if (!lexwareAktiv() || !in_array($art, ['rechnung', 'gutschrift', 'status'], true) || !in_array($tabelle, ['rechnungen', 'bestellungen'], true)) {
        return null;
    }
    if ($art === 'rechnung' && $tabelle === 'bestellungen' && empty(lexwareKonfig()['privatkunden'])) {
        return null;
    }
    $db = datenbank();
    $st = $db->prepare("SELECT id FROM lexware_auftraege WHERE art = ? AND bezug_tabelle = ? AND bezug_id = ? AND status <> 'verworfen' ORDER BY id DESC LIMIT 1");
    $st->execute([$art, $tabelle, $id]);
    $vorhanden = $st->fetchColumn();
    if ($vorhanden !== false) {
        return (int) $vorhanden;
    }
    $db->prepare('INSERT INTO lexware_auftraege (art, bezug_tabelle, bezug_id, status, daten_json, erstellt) VALUES (?, ?, ?, ?, ?, ?)')
       ->execute([$art, $tabelle, $id, 'offen', json_encode($daten, JSON_UNESCAPED_UNICODE), jetzt()]);

    return (int) $db->lastInsertId();
}

/** Offene Aufträge abarbeiten; liefert ['erledigt', 'fehler']. Fehlgeschlagene werden bis zu 6-mal erneut versucht. */
function lexwareAuftraegeAbarbeiten(int $max = 20): array
{
    $aus = ['erledigt' => 0, 'fehler' => 0];
    if (!lexwareAktiv()) {
        return $aus;
    }
    $db = datenbank();
    $st = $db->prepare("SELECT * FROM lexware_auftraege WHERE status IN ('offen','fehler') AND versuche < 6 ORDER BY id LIMIT " . max(1, $max));
    $st->execute();
    foreach ($st->fetchAll() as $auftrag) {
        try {
            lexwareAuftragAusfuehren($auftrag);
            $db->prepare("UPDATE lexware_auftraege SET status = 'erledigt', versuche = versuche + 1, fehler_text = '', erledigt = ? WHERE id = ?")->execute([jetzt(), $auftrag['id']]);
            $aus['erledigt']++;
        } catch (Throwable $e) {
            $db->prepare("UPDATE lexware_auftraege SET status = 'fehler', versuche = versuche + 1, fehler_text = ? WHERE id = ?")->execute([mb_substr($e->getMessage(), 0, 1000), $auftrag['id']]);
            error_log('[lexware] Auftrag ' . $auftrag['id'] . ' (' . $auftrag['art'] . ' ' . $auftrag['bezug_tabelle'] . ' ' . $auftrag['bezug_id'] . '): ' . $e->getMessage());
            $aus['fehler']++;
        }
    }

    return $aus;
}

function lexwareAuftragAusfuehren(array $auftrag): void
{
    $daten = json_decode((string) $auftrag['daten_json'], true) ?: [];
    if ($auftrag['bezug_tabelle'] === 'rechnungen') {
        $r = rechnungLaden((int) $auftrag['bezug_id']);
        if ($r === null) {
            return;
        }
        if ($auftrag['art'] === 'rechnung') {
            lexwareSammelrechnungUebergeben($r);
        } elseif ($auftrag['art'] === 'status') {
            lexwareRechnungStatusAbgleichen($r);
        }

        return;
    }
    $b = bestellungLaden('id', (string) $auftrag['bezug_id']);
    if ($b === null) {
        return;
    }
    if ($auftrag['art'] === 'rechnung') {
        lexwareBestellungUebergeben($b);
    } elseif ($auftrag['art'] === 'gutschrift') {
        lexwareGutschriftFuerBestellung($b, (string) ($daten['grund'] ?? ''));
    }
}

// -------------------------------------------------------- Übergabe der Belege

/** Beschreibung einer Sendung als Rechnungszeile (kein Lieferant, Carrier nur als Leistung). */
function lexwareZeileFuerBestellung(array $b): array
{
    $sprache = ($b['sprache'] ?? 'de') === 'en' ? 'en' : 'de';
    $land = preisliste()['laender'][$b['zielland']]['name']['de'] ?? $b['zielland'];
    $gk = preisliste()['gewichtsklassen'][$b['gewichtsklasse']]['de'] ?? $b['gewichtsklasse'];
    $emp = json_decode((string) $b['empfaenger_json'], true) ?: [];
    if (($b['art'] ?? 'sendung') === 'nachberechnung') {
        $g = json_decode((string) ($b['nachberechnung_json'] ?? '{}'), true) ?: [];
        $kg = number_format((int) ($g['gewicht_gramm'] ?? 0) / 1000, 2, ',', '');

        return ['name' => 'Gewichtsnachberechnung zu Sendung ' . ($g['original'] ?? ''), 'beschreibung' => 'Gebucht ' . ($g['gk_bestellt'] ?? '') . ', vom Carrier gewogen ' . $kg . ' kg → ' . ($g['gk_ist'] ?? '') . '. Differenz der Versandpreise laut Preisliste' . ((int) ($g['gebuehr'] ?? 0) > 0 ? ' zzgl. Carrier-Gebühr für die Abweichung ' . number_format((int) $g['gebuehr'] / 100, 2, ',', '') . ' €' : '') . '. Nachweis liegt im Kundenportal.'];
    }
    $zeilen = [($b['art'] === 'retoure' ? 'Rücksendung ' : 'Paketversand ') . $land . ', ' . $gk . ' · ' . ($b['carrier'] ?? ''), 'Sendung ' . $b['ext_ref'] . ((string) $b['referenz'] !== '' ? ', Ihre Referenz ' . $b['referenz'] : '') . ' · Empfänger ' . trim(($emp['name'] ?? '') . ', ' . ($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''))];
    $zusatz = json_decode((string) ($b['zusatz_json'] ?? '[]'), true) ?: [];
    if ($zusatz !== []) {
        $zeilen[] = 'Zusatzleistungen: ' . implode(', ', array_map(static fn (array $z): string => $z['name']['de'] ?? $z['code'], $zusatz));
    }
    unset($sprache);

    return ['name' => $zeilen[0], 'beschreibung' => implode("\n", array_slice($zeilen, 1))];
}

/** Sammelrechnung einer Firma an Lexware übergeben: Nummer, Status, PDF übernehmen, Mail anstoßen. */
function lexwareSammelrechnungUebergeben(array $r): void
{
    if ((string) ($r['lexware_id'] ?? '') !== '') {
        if (!is_file(lexwarePdfPfad((string) $r['lexware_id']))) {
            lexwarePdfHolen('rechnung', (string) $r['lexware_id']);
        }

        return;
    }
    $firma = firmaLaden((int) $r['firma_id']);
    if ($firma === null) {
        throw new LexwareFehler('Firma der Rechnung fehlt');
    }
    $empfaenger = rechnungsempfaenger($r);
    $kontaktId = lexwareKontaktFuerEmpfaenger($empfaenger);
    $positionen = [];
    foreach (rechnungPositionen((int) $r['id']) as $p) {
        $positionen[] = lexwareZeileFuerBestellung($p) + ['cent' => (int) $p['netto_cent']];
    }
    if ($positionen === []) {
        throw new LexwareFehler('Rechnung ohne Positionen');
    }
    $bis = gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1);
    $einleitung = trim((string) (lexwareKonfig()['einleitung'] ?? ''));
    $beleg = lexwareRechnungAnlegen([
        'contactId' => $kontaktId, 'taxType' => 'net', 'datum' => (string) $r['erstellt'],
        'zahlungsziel' => (int) $empfaenger['zahlungsziel_tage'], 'leistung_von' => (string) $r['zeitraum_von'], 'leistung_bis' => $bis,
        'titel' => 'Rechnung', 'einleitung' => trim('Kundennummer ' . $empfaenger['kundennummer'] . ($empfaenger['tabelle'] === 'unterkunden' ? ' (' . $empfaenger['name'] . ', ' . $firma['name'] . ')' : '') . "\n" . $einleitung),
        'vermerk' => 'Sammelrechnung für Sendungen über das NEOS-Kundenportal im Zeitraum ' . datumAnzeigen($r['zeitraum_von']) . ' – ' . datumAnzeigen($bis) . '.',
    ], $positionen);
    $db = datenbank();
    $nummer = $beleg['nummer'] !== '' ? $beleg['nummer'] : $r['nummer'];
    $st = $db->prepare('SELECT id FROM rechnungen WHERE nummer = ? AND id <> ?');
    $st->execute([$nummer, $r['id']]);
    if ($st->fetchColumn() !== false) {
        $nummer = $nummer . '-' . $r['id'];
    }
    $db->prepare('UPDATE rechnungen SET lexware_id = ?, lexware_nummer = ?, lexware_status = ?, nummer = ? WHERE id = ?')->execute([$beleg['id'], $beleg['nummer'], $beleg['status'], $nummer, $r['id']]);
    try {
        $pfad = lexwarePdfHolen('rechnung', $beleg['id']);
        $db->prepare('UPDATE rechnungen SET lexware_pdf = ?, pdf_datei = ? WHERE id = ?')->execute([basename($pfad), basename($pfad), $r['id']]);
    } catch (Throwable $e) {
        error_log('[lexware] PDF ' . $beleg['id'] . ': ' . $e->getMessage());
    }
    $r = rechnungLaden((int) $r['id']) ?? $r;
    try {
        rechnungMailSenden($r, $firma);
    } catch (Throwable $e) {
        error_log('[lexware] Rechnungsmail: ' . $e->getMessage());
    }
}

/** Bezahlte Privatkunden-Bestellung oder Nachberechnung als Rechnung an Lexware übergeben. */
function lexwareBestellungUebergeben(array $b): void
{
    if ((string) ($b['lexware_id'] ?? '') !== '') {
        if (!is_file(lexwarePdfPfad((string) $b['lexware_id']))) {
            lexwarePdfHolen('rechnung', (string) $b['lexware_id']);
        }

        return;
    }
    if ($b['firma_id']) {
        return; // Firmen bekommen Sammelrechnungen
    }
    if (!in_array($b['status'], ['bezahlt', 'beauftragt'], true)) {
        throw new LexwareFehler('Bestellung ' . $b['ext_ref'] . ' ist nicht bezahlt');
    }
    $abs = json_decode((string) $b['absender_json'], true) ?: [];
    $kunde = $b['kunde_id'] ? kundeLaden((int) $b['kunde_id']) : null;
    $positionen = [];
    if (($b['art'] ?? 'sendung') === 'nachberechnung') {
        $positionen[] = lexwareZeileFuerBestellung($b) + ['cent' => (int) $b['betrag_cent']];
    } else {
        $positionen[] = lexwareZeileFuerBestellung($b) + ['cent' => bruttoCent((int) $b['netto_cent'] - (int) $b['zusatz_cent'])];
        foreach (json_decode((string) ($b['zusatz_json'] ?? '[]'), true) ?: [] as $z) {
            $positionen[] = ['name' => 'Zusatzleistung: ' . ($z['name']['de'] ?? $z['code']), 'beschreibung' => 'zur Sendung ' . $b['ext_ref'], 'cent' => bruttoCent((int) ($z['preis'] ?? 0))];
        }
    }
    $zahlung = $b['zahlungsart'] === 'guthaben' ? 'Bezahlt aus NEOS-Guthaben' : 'Bezahlt per Revolut am ' . datumAnzeigen($b['bezahlt'] ?? $b['aktualisiert']);
    $kopf = [
        'taxType' => 'gross', 'datum' => (string) ($b['bezahlt'] ?? $b['aktualisiert']), 'zahlungsziel' => 0,
        'zahlungsbedingung' => $zahlung . ' — es ist keine Zahlung mehr offen.',
        'leistung_von' => (string) $b['erstellt'], 'titel' => 'Rechnung', 'vermerk' => $zahlung . '. Bestellnummer ' . $b['ext_ref'] . '.',
    ];
    if ($kunde !== null && $kunde['art'] === 'privat') {
        // Registrierter Privatkunde: eigener Kontakt in Lexware (mit Kundennummer)
        $kopf['contactId'] = $kunde['lexware_kontakt_id'] !== '' ? (string) $kunde['lexware_kontakt_id'] : (string) lexwareKontaktSichern($kunde, 'kunden')['id'];
        $kopf['einleitung'] = trim('Kundennummer ' . $kunde['kundennummer'] . "\n" . trim((string) (lexwareKonfig()['einleitung'] ?? '')));
    } else {
        $kopf['address'] = lexwareAdresse($abs + ['name' => $abs['name'] ?? ($kunde['name'] ?? ''), 'land' => $abs['land'] ?? 'DE']);
    }
    $beleg = lexwareRechnungAnlegen($kopf, $positionen);
    $db = datenbank();
    $db->prepare('UPDATE bestellungen SET lexware_id = ?, lexware_nummer = ?, lexware_status = ?, aktualisiert = ? WHERE id = ?')->execute([$beleg['id'], $beleg['nummer'], $beleg['status'], jetzt(), $b['id']]);
    try {
        lexwarePdfHolen('rechnung', $beleg['id']);
    } catch (Throwable $e) {
        error_log('[lexware] PDF ' . $beleg['id'] . ': ' . $e->getMessage());
    }
}

/** Gutschrift zu einer stornierten Nachberechnung/Bestellung. */
function lexwareGutschriftFuerBestellung(array $b, string $grund = ''): void
{
    $daten = json_decode((string) ($b['nachberechnung_json'] ?? '{}'), true) ?: [];
    if (!empty($daten['lexware_gutschrift_id'])) {
        return;
    }
    $firma = $b['firma_id'] ? firmaLaden((int) $b['firma_id']) : null;
    $abs = json_decode((string) $b['absender_json'], true) ?: [];
    $kopf = ['datum' => jetzt(), 'titel' => 'Gutschrift', 'vermerk' => 'Gutschrift zu ' . ($b['lexware_nummer'] ?: 'Position ' . $b['ext_ref']) . ($grund !== '' ? ': ' . $grund : '.')];
    if ($firma !== null) {
        $kopf['contactId'] = lexwareKontaktFuerEmpfaenger(rechnungsempfaenger($b));
        $kopf['taxType'] = 'net';
        $cent = (int) $b['netto_cent'];
    } else {
        $kunde = $b['kunde_id'] ? kundeLaden((int) $b['kunde_id']) : null;
        if ($kunde !== null && $kunde['art'] === 'privat' && $kunde['lexware_kontakt_id'] !== '') {
            $kopf['contactId'] = (string) $kunde['lexware_kontakt_id'];
        } else {
            $kopf['address'] = lexwareAdresse($abs);
        }
        $kopf['taxType'] = 'gross';
        $cent = (int) $b['betrag_cent'];
    }
    $zeile = lexwareZeileFuerBestellung($b);
    $beleg = lexwareGutschriftAnlegen($kopf, [['name' => 'Gutschrift: ' . $zeile['name'], 'beschreibung' => $zeile['beschreibung'], 'cent' => $cent]]);
    $daten['lexware_gutschrift_id'] = $beleg['id'];
    $daten['lexware_gutschrift_nummer'] = $beleg['nummer'];
    datenbank()->prepare('UPDATE bestellungen SET nachberechnung_json = ?, lexware_status = ?, aktualisiert = ? WHERE id = ?')->execute([json_encode($daten, JSON_UNESCAPED_UNICODE), 'gutschrift', jetzt(), $b['id']]);
    try {
        lexwarePdfHolen('gutschrift', $beleg['id']);
    } catch (Throwable $e) {
        error_log('[lexware] Gutschrift-PDF: ' . $e->getMessage());
    }
}

// ----------------------------------------------------------- Statusabgleich

/** Zahlungsstatus einer Sammelrechnung aus Lexware übernehmen. */
function lexwareRechnungStatusAbgleichen(array $r): void
{
    if ((string) ($r['lexware_id'] ?? '') === '' || $r['status'] !== 'offen') {
        return;
    }
    $z = lexwareZahlungsstatus((string) $r['lexware_id']);
    datenbank()->prepare('UPDATE rechnungen SET lexware_status = ? WHERE id = ?')->execute([$z['status'] ?: $z['beleg_status'], $r['id']]);
    if (in_array($z['status'], ['paid', 'balanced'], true) || $z['beleg_status'] === 'paid' || ($z['status'] !== '' && $z['offen_cent'] <= 0)) {
        rechnungStatusSetzen($r, 'bezahlt');
    } elseif ($z['beleg_status'] === 'voided') {
        rechnungStatusSetzen($r, 'storniert');
    }
}

/** Alle offenen Sammelrechnungen mit Lexware-Beleg abgleichen; liefert die Zahl der Änderungen. */
function lexwareStatusAbgleichen(): int
{
    if (!lexwareAktiv()) {
        return 0;
    }
    $n = 0;
    foreach (datenbank()->query("SELECT * FROM rechnungen WHERE status = 'offen' AND lexware_id <> ''")->fetchAll() as $r) {
        try {
            lexwareRechnungStatusAbgleichen($r);
            $neu = rechnungLaden((int) $r['id']);
            if ($neu !== null && $neu['status'] !== $r['status']) {
                $n++;
            }
        } catch (Throwable $e) {
            error_log('[lexware] Abgleich ' . $r['nummer'] . ': ' . $e->getMessage());
        }
    }

    return $n;
}

/** Webhook-Abonnements anlegen (invoice.status.changed, payment.changed, contact.changed); liefert die Antworten. */
function lexwareEinrichten(string $callbackUrl): array
{
    $aus = [];
    foreach (['invoice.status.changed', 'payment.changed', 'contact.changed'] as $ereignis) {
        $aus[$ereignis] = lexwareAnfrage('POST', '/event-subscriptions', ['eventType' => $ereignis, 'callbackUrl' => $callbackUrl])['daten'];
    }

    return $aus;
}

/** Webhook-Nutzlast verarbeiten: nie der Nutzlast trauen, immer den Beleg bzw. Kontakt nachladen. */
function lexwareWebhookVerarbeiten(array $nutzlast): void
{
    $id = (string) ($nutzlast['resourceId'] ?? '');
    if ($id === '' || !lexwareAktiv()) {
        return;
    }
    if (str_starts_with((string) ($nutzlast['eventType'] ?? ''), 'contact.')) {
        syncAbholenEinzeln('lexware', $id);

        return;
    }
    $st = datenbank()->prepare('SELECT * FROM rechnungen WHERE lexware_id = ?');
    $st->execute([$id]);
    $r = $st->fetch();
    if (is_array($r)) {
        lexwareRechnungStatusAbgleichen($r);
    }
}

/** Anzahl fehlgeschlagener/offener Aufträge für die Übersicht. */
function lexwareAuftraegeOffen(): array
{
    $z = datenbank()->query("SELECT SUM(CASE WHEN status = 'fehler' THEN 1 ELSE 0 END) AS fehler, SUM(CASE WHEN status = 'offen' THEN 1 ELSE 0 END) AS offen FROM lexware_auftraege")->fetch() ?: [];

    return ['fehler' => (int) ($z['fehler'] ?? 0), 'offen' => (int) ($z['offen'] ?? 0)];
}
