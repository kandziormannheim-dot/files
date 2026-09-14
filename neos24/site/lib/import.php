<?php

/**
 * Sendungsimport aus Tabellen (CSV/XLSX, siehe tabelleLesen()):
 * tolerante Spaltennamen, Gewichts- und Länderparser, Trockenprüfung wie
 * bestellungAnlegen(), Referenz-Dubletten, Fehlerbericht.
 */

declare(strict_types=1);

/** Zielfeld => akzeptierte Spaltennamen (normalisiert: klein, ohne Umlaute, Leer-/Sonderzeichen). */
const IMPORT_SYNONYME = [
    'zielland' => ['zielland', 'land', 'country', 'ziel', 'destination', 'laendercode', 'iso'],
    'gewicht_kg' => ['gewichtkg', 'gewicht', 'kg', 'weight', 'weightkg', 'gewichtinkg'],
    'gewicht_g' => ['gewichtg', 'gramm', 'g', 'grams', 'weightg', 'gewichtgramm'],
    'name' => ['name', 'empfaenger', 'empfaengername', 'recipient', 'kontakt', 'contact', 'ansprechpartner', 'kunde', 'customer'],
    'firma' => ['firma', 'company', 'unternehmen', 'firmenname', 'companyname'],
    'strasse' => ['strasse', 'street', 'adresse', 'address', 'strassehausnummer', 'address1', 'adresse1', 'anschrift'],
    'plz' => ['plz', 'zip', 'zipcode', 'postcode', 'postalcode', 'postleitzahl'],
    'ort' => ['ort', 'stadt', 'city', 'town'],
    'email' => ['email', 'mail', 'emailadresse', 'emailaddress'],
    'telefon' => ['telefon', 'tel', 'phone', 'telephone', 'telefonnummer', 'mobil', 'mobile'],
    'referenz' => ['referenz', 'ref', 'reference', 'auftrag', 'auftragsnummer', 'order', 'ordernumber', 'orderid', 'bestellnummer', 'kundenreferenz'],
    'carrier' => ['carrier', 'dienstleister', 'versender', 'service', 'transporteur'],
    'zusatz' => ['zusatz', 'zusatzleistungen', 'extras', 'optionen', 'options', 'services'],
    'unterkunde' => ['unterkunde', 'kostenstelle', 'standort', 'subaccount', 'costcentre', 'costcenter', 'kundennummer'],
];

const IMPORT_PFLICHT = ['zielland', 'gewicht', 'name', 'strasse', 'plz', 'ort'];

/** Reihenfolge der Fehlercodes für Anzeige und Bericht. */
const IMPORT_FEHLER = ['gewicht', 'zielland', 'carrier', 'name', 'strasse', 'plz', 'ort', 'email', 'abholung', 'unterkunde', 'dublette', 'dublette_datei'];

/** Spaltenname normalisieren: „Gewicht (kg)“ → gewichtkg, „Straße“ → strasse. */
function importSpaltenname(string $s): string
{
    $s = mb_strtolower(trim($s));
    $s = str_replace(['ä', 'ö', 'ü', 'ß', 'é', 'è'], ['ae', 'oe', 'ue', 'ss', 'e', 'e'], $s);

    return preg_replace('/[^a-z0-9]/', '', $s) ?? '';
}

/** Kopfzeile → [feld => spaltenindex]; das erste passende Synonym gewinnt. */
function importKopfZuordnen(array $kopf): array
{
    $index = [];
    foreach ($kopf as $i => $k) {
        $n = importSpaltenname((string) $k);
        if ($n === '') {
            continue;
        }
        foreach (IMPORT_SYNONYME as $feld => $namen) {
            if (in_array($n, $namen, true) && !isset($index[$feld])) {
                $index[$feld] = (int) $i;
                break;
            }
        }
    }

    return $index;
}

/** Fehlende Pflichtspalten (Gewicht zählt als vorhanden, wenn kg- oder g-Spalte da ist). */
function importFehlendeSpalten(array $index): array
{
    $fehlt = [];
    foreach (IMPORT_PFLICHT as $f) {
        if ($f === 'gewicht' ? !isset($index['gewicht_kg']) && !isset($index['gewicht_g']) : !isset($index[$f])) {
            $fehlt[] = $f;
        }
    }

    return $fehlt;
}

/**
 * Gewicht in Gramm: „1,2“ / „1.2 kg“ / „1200 g“ / „1.200 g“ / „1200“; ohne
 * Einheit gilt ab 100 als Gramm, darunter als Kilogramm. $inGramm: Spalte ist
 * ausdrücklich eine Gramm-Spalte.
 */
function importGewichtGramm(string $roh, bool $inGramm = false): int
{
    $s = strtolower(str_replace([' ', "\u{a0}"], '', trim($roh)));
    if ($s === '' || !preg_match('/^([0-9][0-9.,]*)(kg|kilo|kilogramm|g|gr|gramm)?$/', $s, $m)) {
        return 0;
    }
    $zahl = $m[1];
    $einheit = $m[2] ?? '';
    $gramm = $inGramm || in_array($einheit, ['g', 'gr', 'gramm'], true);
    if ($gramm) {
        // Tausenderpunkte/-kommas fallen weg: 1.200 g = 1200 g
        return (int) preg_replace('/\D/', '', $zahl);
    }
    // Kilogramm: letztes Trennzeichen ist das Dezimalzeichen
    $dezimal = max((int) strrpos($zahl, ','), (int) strrpos($zahl, '.'));
    if ($dezimal > 0) {
        $ganz = preg_replace('/\D/', '', substr($zahl, 0, $dezimal)) ?? '0';
        $bruch = preg_replace('/\D/', '', substr($zahl, $dezimal + 1)) ?? '';
        $wert = (float) ($ganz . '.' . $bruch);
    } else {
        $wert = (float) $zahl;
    }
    if ($einheit === '' && $wert >= 100) {
        return (int) round($wert); // ohne Einheit und groß: Gramm
    }

    return (int) round($wert * 1000);
}

/** Ländercode: ISO-2 oder Name (DE/EN) aus der Preisliste; '' wenn unbekannt. */
function importLandCode(string $roh, array $laender): string
{
    $s = trim($roh);
    if ($s === '') {
        return '';
    }
    $code = strtoupper($s);
    if (strlen($code) === 2 && isset($laender[$code])) {
        return $code;
    }
    $alias = ['deutschland' => 'DE', 'germany' => 'DE', 'oesterreich' => 'AT', 'österreich' => 'AT', 'austria' => 'AT', 'schweiz' => 'CH', 'switzerland' => 'CH', 'frankreich' => 'FR', 'france' => 'FR',
        'niederlande' => 'NL', 'netherlands' => 'NL', 'holland' => 'NL', 'belgien' => 'BE', 'belgium' => 'BE', 'italien' => 'IT', 'italy' => 'IT', 'spanien' => 'ES', 'spain' => 'ES', 'polen' => 'PL', 'poland' => 'PL',
        'grossbritannien' => 'GB', 'großbritannien' => 'GB', 'uk' => 'GB', 'united kingdom' => 'GB', 'vereinigtes koenigreich' => 'GB', 'england' => 'GB', 'usa' => 'US', 'vereinigte staaten' => 'US', 'united states' => 'US', 'tschechien' => 'CZ', 'czechia' => 'CZ', 'czech republic' => 'CZ'];
    $klein = mb_strtolower($s);
    if (isset($alias[$klein]) && isset($laender[$alias[$klein]])) {
        return $alias[$klein];
    }
    foreach ($laender as $c => $l) {
        foreach ((array) ($l['name'] ?? []) as $name) {
            if (strcasecmp((string) $name, $s) === 0) {
                return (string) $c;
            }
        }
    }

    return strlen($code) === 2 ? $code : '';
}

/**
 * Zeilen trocken prüfen — dieselbe Validierung wie bestellungAnlegen(), ohne
 * anzulegen. Liefert je Zeile ['nr', 'roh', 'p', 'gk', 'preis', 'fehler',
 * 'unterkunde_id']; 'fehler' sind Codes aus IMPORT_FEHLER.
 */
function importZeilenPruefen(array $kunde, array $kopf, array $zeilen, array $unterkunden, int $festerUnterkunde, bool $dublettenErlauben = false, int $maxZeilen = 500): array
{
    $index = importKopfZuordnen($kopf);
    $laender = preisliste()['laender'];
    $preislisteId = preislisteFuerKonto($kunde);
    $firmaId = (int) ($kunde['firma_id'] ?? 0);
    $referenzen = [];
    foreach (array_slice($zeilen, 0, $maxZeilen) as $nr => $z) {
        if (isset($index['referenz'])) {
            $r = trim((string) ($z[$index['referenz']] ?? ''));
            if ($r !== '') {
                $referenzen[] = $r;
            }
        }
    }
    $vergeben = $dublettenErlauben || $firmaId === 0 ? [] : importReferenzDubletten($firmaId, $referenzen);
    $gesehen = [];
    $vorschau = [];
    foreach (array_slice($zeilen, 0, $maxZeilen) as $nr => $z) {
        if (array_filter($z, static fn ($v): bool => trim((string) $v) !== '') === []) {
            continue;
        }
        $w = static fn (string $feld): string => isset($index[$feld]) ? trim((string) ($z[$index[$feld]] ?? '')) : '';
        $gramm = isset($index['gewicht_g']) && $w('gewicht_g') !== '' ? importGewichtGramm($w('gewicht_g'), true) : importGewichtGramm($w('gewicht_kg'));
        $zusatz = array_values(array_filter(array_map(static fn (string $s): string => strtolower(trim($s)), preg_split('/[,;|]/', $w('zusatz')) ?: [])));
        $p = [
            'zielland' => importLandCode($w('zielland'), $laender), 'gewicht_gramm' => $gramm, 'carrier' => $w('carrier'), 'zusatz' => $zusatz,
            'empfaenger' => ['name' => $w('name'), 'firma' => $w('firma'), 'strasse' => $w('strasse'), 'plz' => $w('plz'), 'ort' => $w('ort'), 'email' => $w('email'), 'telefon' => $w('telefon')],
            'referenz' => mb_substr($w('referenz'), 0, 60),
        ];
        $fehler = [];
        $gk = $gramm > 0 ? gewichtsklasseFuerGewicht($gramm) : null;
        if ($gk === null) {
            $fehler[] = 'gewicht';
        }
        $preis = $gk !== null && $p['zielland'] !== '' ? preisFuer($p['zielland'], $gk, $p['carrier'], $preislisteId) : null;
        if ($preis === null && ($gk !== null || $p['zielland'] === '')) {
            $fehler[] = $p['zielland'] !== '' && $p['carrier'] !== '' ? 'carrier' : 'zielland';
        }
        foreach (['name' => 2, 'strasse' => 3, 'plz' => 3, 'ort' => 2] as $f => $min) {
            if (mb_strlen($p['empfaenger'][$f]) < $min) {
                $fehler[] = $f;
            }
        }
        if ($p['empfaenger']['email'] !== '' && filter_var($p['empfaenger']['email'], FILTER_VALIDATE_EMAIL) === false) {
            $fehler[] = 'email';
        }
        if (in_array('abholung', $zusatz, true)) {
            $fehler[] = 'abholung'; // Abholtermin gibt es im Import nicht — einzeln anlegen
        }
        // Spalte „unterkunde“: Nummer (K-100001-02) oder Name eines aktiven Unterkunden; feste Zuordnung gewinnt
        $unterkundeId = 0;
        $uWunsch = $w('unterkunde');
        if ($festerUnterkunde > 0) {
            $unterkundeId = $festerUnterkunde;
        } elseif ($uWunsch !== '') {
            foreach ($unterkunden as $u) {
                if (strcasecmp((string) $u['nummer'], $uWunsch) === 0 || strcasecmp((string) $u['name'], $uWunsch) === 0) {
                    $unterkundeId = (int) $u['id'];
                }
            }
            if ($unterkundeId === 0) {
                $fehler[] = 'unterkunde';
            }
        }
        if ($p['referenz'] !== '') {
            $schluessel = mb_strtolower($p['referenz']);
            if (isset($vergeben[$schluessel])) {
                $fehler[] = 'dublette';
            } elseif (isset($gesehen[$schluessel]) && !$dublettenErlauben) {
                $fehler[] = 'dublette_datei';
            }
            $gesehen[$schluessel] = true;
        }
        $vorschau[] = ['nr' => (int) $nr + 2, 'roh' => array_map(static fn ($v): string => (string) $v, array_values($z)), 'p' => $p, 'gk' => $gk, 'preis' => $preis, 'fehler' => $fehler, 'unterkunde_id' => $unterkundeId];
    }

    return $vorschau;
}

/** Referenzen, zu denen die Firma in den letzten 30 Tagen schon eine (nicht stornierte) Sendung hat: [kleingeschrieben => ext_ref]. */
function importReferenzDubletten(int $firmaId, array $referenzen, int $tage = 30): array
{
    $referenzen = array_values(array_unique(array_filter($referenzen)));
    if ($referenzen === []) {
        return [];
    }
    $aus = [];
    $seit = gmdate('Y-m-d\TH:i:s\Z', time() - $tage * 86400);
    foreach (array_chunk($referenzen, 200) as $teil) {
        $platz = implode(',', array_fill(0, count($teil), '?'));
        $st = datenbank()->prepare('SELECT referenz, ext_ref FROM bestellungen WHERE firma_id = ? AND erstellt >= ? AND status <> ? AND referenz IN (' . $platz . ')');
        $st->execute(array_merge([$firmaId, $seit, 'storniert'], $teil));
        foreach ($st->fetchAll() as $z) {
            $aus[mb_strtolower((string) $z['referenz'])] = (string) $z['ext_ref'];
        }
    }

    return $aus;
}

/** Fehlerzeilen als CSV (Originalspalten + Spalte „fehler“ mit lesbaren Texten). */
function importFehlerCsv(array $kopf, array $vorschau, callable $text): string
{
    $zelle = static fn ($v): string => '"' . str_replace('"', '""', (string) $v) . '"';
    $zeilen = [implode(';', array_map($zelle, array_merge(['zeile'], $kopf, ['fehler'])))];
    foreach ($vorschau as $z) {
        if ($z['fehler'] === []) {
            continue;
        }
        $roh = array_pad($z['roh'], count($kopf), '');
        $zeilen[] = implode(';', array_map($zelle, array_merge([$z['nr']], array_slice($roh, 0, count($kopf)), [implode(' | ', array_map($text, $z['fehler']))])));
    }

    return "\xEF\xBB\xBF" . implode("\n", $zeilen) . "\n";
}

/** Vorlagenzeilen (Kopf + zwei Beispiele) für CSV und XLSX. */
function importVorlage(string $unterkundeNummer = ''): array
{
    return [
        'kopf' => ['zielland', 'gewicht_kg', 'name', 'firma', 'strasse', 'plz', 'ort', 'email', 'telefon', 'referenz', 'carrier', 'zusatz', 'unterkunde'],
        'zeilen' => [
            ['FR', '1,2', 'Marie Curie', '', 'Rue de Rivoli 2', '75001', 'Paris', 'marie@example.com', '', 'AUF-1001', '', 'versicherung', ''],
            ['DE', '4,5', 'Hans Meier', 'Meier GmbH', 'Hauptstr. 3', '10115', 'Berlin', '', '', 'AUF-1002', 'DPD', '', $unterkundeNummer],
        ],
    ];
}
