<?php

/**
 * Odoo (CRM/Verkauf) — selbst gehostet oder Odoo.sh, Version 14 oder neuer.
 *
 * Zugriff per JSON-RPC (POST {url}/jsonrpc, service "object", Methode
 * "execute_kw") mit dem API-Schlüssel eines technischen Benutzers als
 * Passwort. Abbildung:
 *   Firma / Unterkunde / Privatkunde → res.partner (ref = NEOS-Kundennummer)
 *   Firmenbenutzer                   → res.partner (Ansprechpartner, parent_id)
 *   beauftragte Sendung              → sale.order mit Produktzeile(n), bestätigt
 *   Rechnung                         → Nachricht am Partner (message_post, PDF)
 * Die Buchhaltung bleibt Lexware: es werden keine account.move angelegt.
 * Alle Aufrufe laufen über die Warteschlange in lib/sync.php.
 */

declare(strict_types=1);

class OdooFehler extends RuntimeException
{
}

function odooKonfig(): array
{
    return (array) (konfig()['odoo'] ?? []);
}

function odooAktiv(): bool
{
    $k = odooKonfig();

    return !empty($k['aktiv']) && (string) ($k['url'] ?? '') !== '' && (string) ($k['apiKey'] ?? '') !== '' && (string) ($k['datenbank'] ?? '') !== '';
}

/** Link zu einem Datensatz in der Odoo-Oberfläche (für das Dashboard). */
function odooLink(string $modell, int $id): string
{
    $url = rtrim((string) (odooKonfig()['url'] ?? ''), '/');

    return $url !== '' && $id > 0 ? $url . '/odoo/' . rawurlencode($modell) . '/' . $id : '';
}

// ------------------------------------------------------------------- JSON-RPC

/** Roher JSON-RPC-Aufruf; liefert das "result". */
function odooRpc(string $dienst, string $methode, array $argumente): mixed
{
    $k = odooKonfig();
    $url = rtrim((string) $k['url'], '/') . '/jsonrpc';
    $nutzlast = ['jsonrpc' => '2.0', 'method' => 'call', 'id' => random_int(1, 999999999), 'params' => ['service' => $dienst, 'method' => $methode, 'args' => $argumente]];
    for ($versuch = 1; $versuch <= 2; $versuch++) {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new OdooFehler('curl_init fehlgeschlagen');
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => (int) ($k['zeitlimit'] ?? 20), CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_POSTFIELDS => json_encode($nutzlast, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        $antwort = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $fehler = curl_error($ch);
        curl_close($ch);
        if ($antwort === false || $status >= 500) {
            if ($versuch === 1) {
                usleep(800000);
                continue;
            }
            throw new OdooFehler('Odoo nicht erreichbar: ' . ($fehler !== '' ? $fehler : 'HTTP ' . $status));
        }
        $json = json_decode((string) $antwort, true);
        if (!is_array($json)) {
            throw new OdooFehler('Odoo: keine JSON-Antwort (HTTP ' . $status . ')');
        }
        if (isset($json['error'])) {
            $e = $json['error'];
            $meldung = (string) ($e['data']['message'] ?? $e['message'] ?? 'Fehler');
            throw new OdooFehler('Odoo ' . $methode . ': ' . mb_substr(trim($meldung), 0, 300));
        }

        return $json['result'] ?? null;
    }
    throw new OdooFehler('Odoo: keine Antwort');
}

/** Benutzer-ID (uid) — einmal je Prozess. */
function odooUid(): int
{
    static $uid = null;
    if ($uid !== null) {
        return $uid;
    }
    $k = odooKonfig();
    $ergebnis = odooRpc('common', 'authenticate', [(string) $k['datenbank'], (string) $k['benutzer'], (string) $k['apiKey'], []]);
    if (!is_int($ergebnis) || $ergebnis <= 0) {
        throw new OdooFehler('Odoo: Anmeldung fehlgeschlagen (Datenbank, Benutzer oder API-Key)');
    }

    return $uid = $ergebnis;
}

/** execute_kw auf ein Modell. */
function odooAusfuehren(string $modell, string $methode, array $args = [], array $kwargs = []): mixed
{
    $k = odooKonfig();
    if ((int) ($k['companyId'] ?? 0) > 0 && !isset($kwargs['context'])) {
        $kwargs['context'] = ['allowed_company_ids' => [(int) $k['companyId']], 'force_company' => (int) $k['companyId']];
    }

    return odooRpc('object', 'execute_kw', [(string) $k['datenbank'], odooUid(), (string) $k['apiKey'], $modell, $methode, $args, $kwargs === [] ? new stdClass() : $kwargs]);
}

function odooSuchen(string $modell, array $domain, array $felder, int $limit = 80, string $sortierung = ''): array
{
    $kw = ['fields' => $felder, 'limit' => $limit];
    if ($sortierung !== '') {
        $kw['order'] = $sortierung;
    }
    $aus = odooAusfuehren($modell, 'search_read', [$domain], $kw);

    return is_array($aus) ? $aus : [];
}

function odooLesen(string $modell, int $id, array $felder): ?array
{
    $aus = odooAusfuehren($modell, 'read', [[$id]], ['fields' => $felder]);

    return is_array($aus) && isset($aus[0]) && is_array($aus[0]) ? $aus[0] : null;
}

function odooAnlegen(string $modell, array $werte): int
{
    $id = odooAusfuehren($modell, 'create', [$werte]);
    if (is_array($id)) {
        $id = $id[0] ?? 0;
    }
    if (!is_int($id) || $id <= 0) {
        throw new OdooFehler('Odoo: ' . $modell . ' ohne ID angelegt');
    }

    return $id;
}

function odooAendern(string $modell, int $id, array $werte): void
{
    odooAusfuehren($modell, 'write', [[$id], $werte]);
}

/** Land-ID zu ISO-Code (gecacht). */
function odooLandId(string $code): ?int
{
    static $cache = [];
    $code = strtoupper($code) ?: 'DE';
    if (!array_key_exists($code, $cache)) {
        $t = odooSuchen('res.country', [['code', '=', $code]], ['id'], 1);
        $cache[$code] = isset($t[0]['id']) ? (int) $t[0]['id'] : null;
    }

    return $cache[$code];
}

/** Werte eines Odoo-Felds lesbar machen (many2one kommt als [id, name]). */
function odooWert(mixed $w): string
{
    if (is_array($w)) {
        return (string) ($w[1] ?? $w[0] ?? '');
    }

    return $w === false || $w === null ? '' : (string) $w;
}

// ------------------------------------------------------------------- Partner

/**
 * Partnerwerte für Firma, Unterkunde, Privatkunde oder Firmenbenutzer.
 * $tabelle: firmen | unterkunden | kunden. Liefert [werte, suchdomain].
 */
function odooPartnerWerte(string $tabelle, array $z): array
{
    $adresse = static fn (array $a): array => array_filter([
        'street' => (string) ($a['strasse'] ?? ''), 'zip' => (string) ($a['plz'] ?? ''), 'city' => (string) ($a['ort'] ?? ''),
        'country_id' => odooLandId((string) ($a['land'] ?? 'DE')),
    ], static fn ($v): bool => $v !== '' && $v !== null);
    if ($tabelle === 'firmen') {
        $w = ['name' => (string) $z['name'], 'is_company' => true, 'company_type' => 'company', 'customer_rank' => 1, 'ref' => (string) $z['kundennummer'],
            'vat' => (string) $z['ust_id'] !== '' ? (string) $z['ust_id'] : false, 'email' => (string) $z['rechnungs_email'] !== '' ? (string) $z['rechnungs_email'] : false, 'active' => (int) $z['aktiv'] === 1,
            'comment' => 'NEOS Kundennummer ' . $z['kundennummer'] . ' · Zahlungsziel ' . (int) $z['zahlungsziel_tage'] . ' Tage'] + $adresse($z);

        return [$w, [['ref', '=', (string) $z['kundennummer']]]];
    }
    if ($tabelle === 'unterkunden') {
        $firma = firmaLaden((int) $z['firma_id']);
        $w = ['name' => (string) $z['name'], 'is_company' => true, 'company_type' => 'company', 'customer_rank' => 1, 'ref' => (string) $z['nummer'],
            'vat' => (string) $z['ust_id'] !== '' ? (string) $z['ust_id'] : false, 'email' => (string) $z['rechnungs_email'] !== '' ? (string) $z['rechnungs_email'] : false, 'active' => (int) $z['aktiv'] === 1,
            'comment' => 'NEOS Unterkunde ' . $z['nummer'] . ' von ' . ($firma['name'] ?? '') . ($z['notiz'] !== '' ? ' · ' . $z['notiz'] : '')] + $adresse($z);
        $eltern = $firma !== null ? odooElternId('firmen', $firma) : 0;
        if ($eltern > 0) {
            $w['parent_id'] = $eltern;
        }

        return [$w, [['ref', '=', (string) $z['nummer']]]];
    }
    // kunden: Privatkunde mit eigener Nummer oder Firmenbenutzer als Ansprechpartner
    if ($z['art'] === 'privat') {
        $abs = json_decode((string) ($z['absender_json'] ?? '{}'), true) ?: [];
        $w = ['name' => (string) $z['name'] !== '' ? (string) $z['name'] : (string) $z['email'], 'is_company' => false, 'company_type' => 'person', 'customer_rank' => 1,
            'ref' => (string) $z['kundennummer'], 'email' => (string) $z['email'], 'active' => (int) $z['aktiv'] === 1, 'lang' => $z['sprache'] === 'en' ? 'en_US' : 'de_DE',
            'comment' => 'NEOS Privatkunde ' . $z['kundennummer']] + $adresse($abs + ['land' => $abs['land'] ?? 'DE']);

        return [$w, [['ref', '=', (string) $z['kundennummer']]]];
    }
    $eltern = null;
    if ((int) ($z['unterkunde_id'] ?? 0) > 0) {
        $u = unterkundeLaden((int) $z['unterkunde_id']);
        $eltern = $u !== null ? odooElternId('unterkunden', $u) ?: null : null;
    }
    if ($eltern === null) {
        $firma = firmaLaden((int) $z['firma_id']);
        $eltern = $firma !== null ? odooElternId('firmen', $firma) ?: null : null;
    }
    $w = ['name' => (string) $z['name'] !== '' ? (string) $z['name'] : (string) $z['email'], 'is_company' => false, 'company_type' => 'person', 'type' => 'contact',
        'email' => (string) $z['email'], 'function' => $z['firmenrolle'] === 'inhaber' ? 'Inhaber (NEOS-Portal)' : 'Mitarbeiter (NEOS-Portal)', 'active' => (int) $z['aktiv'] === 1, 'lang' => $z['sprache'] === 'en' ? 'en_US' : 'de_DE'];
    if ($eltern !== null) {
        $w['parent_id'] = $eltern;
    }

    return [$w, [['email', '=', (string) $z['email']], ['parent_id', '=', $eltern ?? 0]]];
}

/** Odoo-ID des übergeordneten Partners (Firma oder Unterkunde) — legt ihn bei Bedarf zuerst an, damit die Hierarchie stimmt. */
function odooElternId(string $tabelle, array $zeile): int
{
    if ((int) ($zeile['odoo_id'] ?? 0) > 0) {
        return (int) $zeile['odoo_id'];
    }
    try {
        return syncPartnerSichern('odoo', $tabelle, $zeile);
    } catch (Throwable $e) {
        error_log('[odoo] Elternpartner ' . $tabelle . '#' . $zeile['id'] . ': ' . $e->getMessage());

        return 0;
    }
}

/** Partner anlegen oder aktualisieren; liefert die Odoo-ID. */
function odooPartnerSichern(string $tabelle, array $z): int
{
    [$werte, $domain] = odooPartnerWerte($tabelle, $z);
    $id = (int) ($z['odoo_id'] ?? 0);
    if ($id <= 0) {
        $treffer = odooSuchen('res.partner', array_merge([['active', 'in', [true, false]]], $domain), ['id'], 1);
        $id = isset($treffer[0]['id']) ? (int) $treffer[0]['id'] : 0;
    }
    if ($id > 0) {
        odooAendern('res.partner', $id, $werte);
    } else {
        $id = odooAnlegen('res.partner', $werte);
    }

    return $id;
}

/** Felder, die aus Odoo zurückgeholt werden (Partner → lokale Spalten). */
const ODOO_PARTNER_FELDER = ['name', 'street', 'zip', 'city', 'country_id', 'vat', 'email', 'write_date', 'ref', 'parent_id', 'active'];

/** Partner-Daten aus Odoo in lokale Feldnamen übersetzen. */
function odooPartnerNachLokal(string $tabelle, array $p): array
{
    $land = is_array($p['country_id'] ?? null) ? odooLandCode((int) $p['country_id'][0]) : '';
    $aus = ['name' => odooWert($p['name'] ?? ''), 'strasse' => odooWert($p['street'] ?? ''), 'plz' => odooWert($p['zip'] ?? ''), 'ort' => odooWert($p['city'] ?? '')];
    if ($land !== '') {
        $aus['land'] = $land;
    }
    if ($tabelle === 'kunden') {
        return $aus + ['email' => odooWert($p['email'] ?? '')];
    }

    return $aus + ['ust_id' => odooWert($p['vat'] ?? ''), 'rechnungs_email' => odooWert($p['email'] ?? '')];
}

function odooLandCode(int $id): string
{
    static $cache = [];
    if (!array_key_exists($id, $cache)) {
        $l = odooLesen('res.country', $id, ['code']);
        $cache[$id] = strtoupper((string) ($l['code'] ?? ''));
    }

    return $cache[$id];
}

/** Zeitstempel aus Odoo (UTC, „Y-m-d H:i:s“) ins ISO-Format der Plattform. */
function odooZeit(string $wert): string
{
    $t = strtotime($wert . ' UTC');

    return $t === false ? '' : gmdate('Y-m-d\TH:i:s\Z', $t);
}

// ------------------------------------------------------------- Verkaufsaufträge

/** Produkt für Versandzeilen (interne Referenz aus der Konfiguration), wird bei Bedarf angelegt. */
function odooProduktId(): int
{
    static $id = null;
    if ($id !== null) {
        return $id;
    }
    $ref = (string) (odooKonfig()['produktVersand'] ?? 'NEOS-VERSAND');
    $t = odooSuchen('product.product', [['default_code', '=', $ref]], ['id'], 1);
    if (isset($t[0]['id'])) {
        return $id = (int) $t[0]['id'];
    }

    return $id = odooAnlegen('product.product', ['name' => 'Paketversand (NEOS)', 'default_code' => $ref, 'type' => 'service', 'sale_ok' => true, 'purchase_ok' => false, 'list_price' => 0.0]);
}

/** Partner-ID des Rechnungsempfängers einer Bestellung (Unterkunde, Firma, Privatkunde) — legt ihn bei Bedarf an. */
function odooPartnerFuerBestellung(array $b): int
{
    if ((int) ($b['unterkunde_id'] ?? 0) > 0) {
        $u = unterkundeLaden((int) $b['unterkunde_id']);
        if ($u !== null) {
            return (int) $u['odoo_id'] > 0 ? (int) $u['odoo_id'] : syncPartnerSichern('odoo', 'unterkunden', $u);
        }
    }
    if ((int) ($b['firma_id'] ?? 0) > 0) {
        $f = firmaLaden((int) $b['firma_id']);
        if ($f !== null) {
            return (int) $f['odoo_id'] > 0 ? (int) $f['odoo_id'] : syncPartnerSichern('odoo', 'firmen', $f);
        }
    }
    if ((int) ($b['kunde_id'] ?? 0) > 0) {
        $k = kundeLaden((int) $b['kunde_id']);
        if ($k !== null && $k['art'] === 'privat') {
            return (int) $k['odoo_id'] > 0 ? (int) $k['odoo_id'] : syncPartnerSichern('odoo', 'kunden', $k);
        }
    }
    // Gast-Checkout ohne Konto: Partner aus der Bestelladresse
    $abs = json_decode((string) $b['absender_json'], true) ?: [];
    $t = odooSuchen('res.partner', [['email', '=', (string) $b['email']]], ['id'], 1);
    if (isset($t[0]['id'])) {
        return (int) $t[0]['id'];
    }

    return odooAnlegen('res.partner', array_filter(['name' => (string) ($abs['name'] ?? $b['email']), 'email' => (string) $b['email'], 'street' => (string) ($abs['strasse'] ?? ''), 'zip' => (string) ($abs['plz'] ?? ''),
        'city' => (string) ($abs['ort'] ?? ''), 'country_id' => odooLandId((string) ($abs['land'] ?? 'DE')), 'customer_rank' => 1, 'comment' => 'NEOS Gastbestellung'], static fn ($v): bool => $v !== '' && $v !== null));
}

/** Beauftragte oder bezahlte Sendung als bestätigten Verkaufsauftrag anlegen; Storno → Auftrag stornieren. */
function odooAuftragSichern(array $b): array
{
    $id = (int) ($b['odoo_id'] ?? 0);
    if ($b['status'] === 'storniert') {
        if ($id > 0) {
            try {
                odooAusfuehren('sale.order', 'action_cancel', [[$id]]);
            } catch (OdooFehler $e) {
                error_log('[odoo] Storno ' . $b['ext_ref'] . ': ' . $e->getMessage());
            }
        }

        return ['id' => $id, 'nummer' => (string) ($b['odoo_nummer'] ?? '')];
    }
    if (!in_array($b['status'], ['beauftragt', 'bezahlt'], true)) {
        throw new OdooFehler('Bestellung ' . $b['ext_ref'] . ' ist nicht beauftragt');
    }
    if ($id > 0) {
        $o = odooLesen('sale.order', $id, ['name']);

        return ['id' => $id, 'nummer' => (string) ($o['name'] ?? $b['odoo_nummer'] ?? '')];
    }
    $treffer = odooSuchen('sale.order', [['client_order_ref', '=', (string) $b['ext_ref']]], ['id', 'name'], 1);
    if (isset($treffer[0]['id'])) {
        return ['id' => (int) $treffer[0]['id'], 'nummer' => (string) $treffer[0]['name']];
    }
    $partner = odooPartnerFuerBestellung($b);
    $produkt = odooProduktId();
    $zeile = lexwareZeileFuerBestellung($b);
    $zeilen = [[0, 0, ['product_id' => $produkt, 'name' => $zeile['name'] . "\n" . $zeile['beschreibung'], 'product_uom_qty' => 1, 'price_unit' => round(((int) $b['netto_cent'] - (int) ($b['zusatz_cent'] ?? 0)) / 100, 2)]]];
    if (($b['art'] ?? 'sendung') === 'nachberechnung') {
        $zeilen = [[0, 0, ['product_id' => $produkt, 'name' => $zeile['name'] . "\n" . $zeile['beschreibung'], 'product_uom_qty' => 1, 'price_unit' => round((int) $b['netto_cent'] / 100, 2)]]];
    } else {
        foreach (json_decode((string) ($b['zusatz_json'] ?? '[]'), true) ?: [] as $z) {
            $zeilen[] = [0, 0, ['product_id' => $produkt, 'name' => 'Zusatzleistung: ' . ($z['name']['de'] ?? $z['code']), 'product_uom_qty' => 1, 'price_unit' => round((int) ($z['preis'] ?? 0) / 100, 2)]];
        }
    }
    $werte = ['partner_id' => $partner, 'client_order_ref' => (string) $b['ext_ref'], 'origin' => 'neos24.com', 'date_order' => gmdate('Y-m-d H:i:s', strtotime((string) $b['erstellt'])), 'order_line' => $zeilen,
        'note' => 'NEOS Sendung ' . $b['ext_ref'] . ($b['referenz'] !== '' ? ' · Referenz ' . $b['referenz'] : '') . ' · Zahlung: ' . $b['zahlungsart']];
    $id = odooAnlegen('sale.order', $werte);
    try {
        odooAusfuehren('sale.order', 'action_confirm', [[$id]]);
    } catch (OdooFehler $e) {
        error_log('[odoo] Bestätigen ' . $b['ext_ref'] . ': ' . $e->getMessage());
    }
    $o = odooLesen('sale.order', $id, ['name']);

    return ['id' => $id, 'nummer' => (string) ($o['name'] ?? '')];
}

// ------------------------------------------------------------ Rechnungsinfo

/** Rechnung als Nachricht (mit PDF) am Partner hinterlegen; liefert die Nachrichten-ID. */
function odooRechnungsInfo(array $r): int
{
    $e = rechnungsempfaenger($r);
    $zeile = $e['tabelle'] === 'unterkunden' ? $e['unterkunde'] : $e['firma'];
    $partner = (int) ($zeile['odoo_id'] ?? 0) > 0 ? (int) $zeile['odoo_id'] : syncPartnerSichern('odoo', $e['tabelle'], $zeile);
    $status = ['offen' => 'offen', 'bezahlt' => 'bezahlt', 'storniert' => 'storniert'][$r['status']] ?? $r['status'];
    $text = '<p><b>NEOS Rechnung ' . htmlspecialchars((string) $r['nummer']) . '</b> — ' . htmlspecialchars($status) . '</p><p>Kundennummer ' . htmlspecialchars($e['kundennummer']) . '<br>Zeitraum ' . datumAnzeigen($r['zeitraum_von']) . ' – ' . datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1))
        . '<br>Netto ' . euro((int) $r['netto_cent']) . ' · Brutto ' . euro((int) $r['brutto_cent']) . '<br>Fällig ' . datumAnzeigen($r['faellig'] . 'T00:00:00Z') . '</p>';
    $anhaenge = [];
    $pdf = rechnungPfad($r);
    if (is_file($pdf) && !empty(odooKonfig()['rechnungsInfo'])) {
        $anhaenge[] = ['NEOS-Rechnung-' . $r['nummer'] . '.pdf', base64_encode((string) file_get_contents($pdf))];
    }
    $kw = ['body' => $text, 'message_type' => 'comment', 'subtype_xmlid' => 'mail.mt_note'];
    if ($anhaenge !== []) {
        $kw['attachments'] = $anhaenge;
    }
    $id = odooAusfuehren('res.partner', 'message_post', [[$partner]], $kw);

    return is_int($id) ? $id : (is_array($id) ? (int) ($id[0] ?? 0) : 0);
}
