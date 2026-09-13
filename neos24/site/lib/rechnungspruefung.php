<?php

/**
 * Rechnungsprüfung für Lieferantenrechnungen (Carrier): CSV mit den
 * abgerechneten Sendungen einlesen, Spalten zuordnen, jede Position der
 * eigenen Bestellung zuordnen und prüfen — berechnetes Gewicht gegen gebuchte
 * Gewichtsklasse, Einkaufspreis gegen Routingmatrix, Duplikate, stornierte
 * Sendungen. Aus dem Befund entsteht die Nachberechnung an den Kunden
 * (Sammelrechnung, Guthaben oder offene Revolut-Zahlung) oder die
 * Beanstandung an den Lieferanten. Das PDF liefert nur die Kopfdaten
 * (Nummer, Datum, Summe) und wird als Beleg abgelegt.
 */

declare(strict_types=1);

const RP_FELDER = [
    'referenz' => 'Unsere Sendungsnummer (NE-…)',
    'sendungsnummer' => 'Carrier-Sendungsnummer',
    'datum' => 'Datum',
    'zielland' => 'Zielland',
    'gewicht' => 'Gewicht',
    'betrag' => 'Betrag netto',
    'zuschlag' => 'Zuschläge',
];

const RP_BEFUNDE = [
    'ok' => 'In Ordnung',
    'gewicht_hoeher' => 'Gewicht höher als gebucht',
    'gewicht_niedriger' => 'Gewicht niedriger als gebucht',
    'preis_abweichung' => 'Preis weicht von der Routingmatrix ab',
    'nicht_zugeordnet' => 'Keine Bestellung gefunden',
    'doppelt' => 'Doppelt abgerechnet',
    'storniert' => 'Bestellung storniert oder unbezahlt',
    'unbekannte_klasse' => 'Gewicht über der höchsten Klasse',
];

const RP_STATUS = [
    'zuordnung' => 'Spalten zuordnen',
    'geprueft' => 'Geprüft',
    'freigegeben' => 'Freigegeben',
    'beanstandet' => 'Beanstandet',
];

// ------------------------------------------------------------------- Dateien

function rpVerzeichnis(): string
{
    $pfad = rtrim((string) konfig()['daten'], '/') . '/lieferantenrechnungen';
    if (!is_dir($pfad)) {
        mkdir($pfad, 0770, true);
    }

    return $pfad;
}

function rpToleranzCent(): int
{
    return (int) (konfig()['rechnungspruefung']['toleranzCent'] ?? 2);
}

// ----------------------------------------------------------------------- CSV

/** CSV-Text in Kopf und Zeilen zerlegen; Trenner wird erkannt (; , Tab |). */
function rpCsvLesen(string $inhalt, string $trenner = ''): array
{
    $inhalt = preg_replace('/^\xEF\xBB\xBF/', '', $inhalt) ?? $inhalt;
    if (!mb_check_encoding($inhalt, 'UTF-8')) {
        $inhalt = mb_convert_encoding($inhalt, 'UTF-8', 'Windows-1252');
    }
    $linien = preg_split('/\r\n|\r|\n/', trim($inhalt)) ?: [];
    $linien = array_values(array_filter($linien, static fn (string $l): bool => trim($l) !== ''));
    if ($linien === []) {
        return ['kopf' => [], 'zeilen' => [], 'trenner' => ';'];
    }
    if ($trenner === '') {
        $beste = ';';
        $max = -1;
        foreach ([';', ',', "\t", '|'] as $t) {
            $n = substr_count($linien[0], $t);
            if ($n > $max) {
                $max = $n;
                $beste = $t;
            }
        }
        $trenner = $beste;
    }
    $kopf = array_map(static fn (string $s): string => trim($s, " \t\"'"), str_getcsv($linien[0], $trenner, '"', '\\'));
    $zeilen = [];
    foreach (array_slice($linien, 1) as $linie) {
        $felder = str_getcsv($linie, $trenner, '"', '\\');
        $zeile = [];
        foreach ($kopf as $i => $name) {
            $zeile[$i] = trim((string) ($felder[$i] ?? ''));
        }
        $zeilen[] = $zeile;
    }

    return ['kopf' => $kopf, 'zeilen' => $zeilen, 'trenner' => $trenner];
}

/** Vorschlag, welche CSV-Spalte welches Feld ist (Index je Feld oder -1). */
function rpSpaltenErkennen(array $kopf, array $zeilen = []): array
{
    $muster = [
        'referenz' => '/referenz|reference|kundenref|customer.?ref|auftrag|order|ref\b/i',
        'sendungsnummer' => '/sendungs?nr|sendungsnummer|tracking|paket|parcel|shipment|barcode|colli|piece/i',
        'datum' => '/datum|date|versand/i',
        'zielland' => '/land|country|dest|ziel/i',
        'gewicht' => '/gewicht|weight|\bkg\b|gramm/i',
        'betrag' => '/betrag|preis|price|amount|netto|net\b|entgelt|kosten|charge|fee|total/i',
        'zuschlag' => '/zuschlag|surcharge|maut|toll|fuel|diesel/i',
    ];
    $aus = array_fill_keys(array_keys(RP_FELDER), -1);
    foreach ($kopf as $i => $name) {
        foreach ($muster as $feld => $regex) {
            if ($aus[$feld] === -1 && preg_match($regex, $name)) {
                $aus[$feld] = $i;
                break;
            }
        }
    }
    // Unsere Nummer steckt oft in irgendeiner Spalte: die mit den meisten NE-Treffern gewinnt.
    $treffer = [];
    foreach (array_slice($zeilen, 0, 50) as $z) {
        foreach ($z as $i => $wert) {
            if (preg_match('/NE-\d{4}-[0-9A-F]{8}/i', (string) $wert)) {
                $treffer[$i] = ($treffer[$i] ?? 0) + 1;
            }
        }
    }
    if ($treffer !== []) {
        arsort($treffer);
        $aus['referenz'] = (int) array_key_first($treffer);
    }

    return $aus;
}

/** Gewichtseinheit raten: Werte über 200 sind Gramm, sonst Kilogramm. */
function rpGewichtEinheitRaten(array $zeilen, int $spalte): string
{
    if ($spalte < 0) {
        return 'kg';
    }
    $max = 0.0;
    foreach (array_slice($zeilen, 0, 200) as $z) {
        $max = max($max, rpZahl((string) ($z[$spalte] ?? '')));
    }

    return $max > 200 ? 'g' : 'kg';
}

/** Zahl aus „4,50“, „4.50“, „1.234,56“, „1,234.56“, „4,5 kg“. */
function rpZahl(string $text): float
{
    $t = preg_replace('/[^\d,.\-]/', '', $text) ?? '';
    if ($t === '' || $t === '-') {
        return 0.0;
    }
    $k = strrpos($t, ',');
    $p = strrpos($t, '.');
    if ($k !== false && $p !== false) {
        $t = $k > $p ? str_replace('.', '', $t) : str_replace(',', '', $t);
        $t = str_replace(',', '.', $t);
    } elseif ($k !== false) {
        $t = substr_count($t, ',') > 1 ? str_replace(',', '', $t) : str_replace(',', '.', $t);
    } elseif ($p !== false && substr_count($t, '.') > 1) {
        $t = str_replace('.', '', $t);
    }

    return (float) $t;
}

function rpDatumNormalisieren(string $text): string
{
    if (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $text, $m)) {
        return $m[1] . '-' . $m[2] . '-' . $m[3];
    }
    if (preg_match('/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/', $text, $m)) {
        $jahr = strlen($m[3]) === 2 ? '20' . $m[3] : $m[3];

        return sprintf('%s-%02d-%02d', $jahr, (int) $m[2], (int) $m[1]);
    }
    if (preg_match('#(\d{1,2})/(\d{1,2})/(\d{4})#', $text, $m)) {
        return sprintf('%s-%02d-%02d', $m[3], (int) $m[2], (int) $m[1]);
    }

    return '';
}

// ----------------------------------------------------------------------- PDF

/** Text aus einem PDF: pdftotext, wenn vorhanden, sonst eigener Leser für einfache Dateien. */
function rpPdfText(string $datei): string
{
    if (!is_file($datei)) {
        return '';
    }
    $bin = trim((string) @shell_exec('command -v pdftotext 2>/dev/null'));
    if ($bin !== '' && function_exists('exec')) {
        $aus = @shell_exec($bin . ' -layout ' . escapeshellarg($datei) . ' - 2>/dev/null');
        if (is_string($aus) && trim($aus) !== '') {
            return $aus;
        }
    }
    $roh = (string) file_get_contents($datei);
    $text = '';
    if (preg_match_all('/<<(.*?)>>\s*stream\r?\n(.*?)\r?\nendstream/s', $roh, $treffer, PREG_SET_ORDER)) {
        foreach ($treffer as $t) {
            $daten = $t[2];
            if (str_contains($t[1], 'FlateDecode')) {
                $ent = @gzuncompress($daten);
                if ($ent === false) {
                    $ent = @gzinflate(substr($daten, 2));
                }
                if ($ent === false) {
                    continue;
                }
                $daten = $ent;
            }
            if (str_contains($t[1], '/Image') || !str_contains($daten, 'BT')) {
                continue;
            }
            $text .= rpPdfInhaltsstrom($daten) . "\n";
        }
    }

    return $text;
}

/** Textoperatoren (Tj, TJ, ', ") eines Inhaltsstroms in lesbaren Text wandeln. */
function rpPdfInhaltsstrom(string $strom): string
{
    $aus = '';
    $laenge = strlen($strom);
    $i = 0;
    $lesenString = static function (string $s, int &$i): string {
        // $s[$i] === '('
        $tiefe = 0;
        $wert = '';
        for (; $i < strlen($s); $i++) {
            $c = $s[$i];
            if ($c === '\\') {
                $i++;
                $n = $s[$i] ?? '';
                if (ctype_digit($n)) {
                    $okt = $n;
                    while (strlen($okt) < 3 && ctype_digit($s[$i + 1] ?? '')) {
                        $okt .= $s[++$i];
                    }
                    $wert .= chr((int) octdec($okt));
                } else {
                    $wert .= ['n' => "\n", 'r' => "\r", 't' => "\t", 'b' => "\x08", 'f' => "\x0C"][$n] ?? $n;
                }
                continue;
            }
            if ($c === '(') {
                $tiefe++;
                if ($tiefe === 1) {
                    continue;
                }
            }
            if ($c === ')') {
                $tiefe--;
                if ($tiefe === 0) {
                    $i++;

                    return $wert;
                }
            }
            $wert .= $c;
        }

        return $wert;
    };
    while ($i < $laenge) {
        $c = $strom[$i];
        if ($c === '(') {
            $aus .= $lesenString($strom, $i);
            continue;
        }
        if ($c === '<' && ($strom[$i + 1] ?? '') !== '<') {
            $ende = strpos($strom, '>', $i);
            if ($ende === false) {
                break;
            }
            $hex = preg_replace('/[^0-9a-fA-F]/', '', substr($strom, $i + 1, $ende - $i - 1)) ?? '';
            $aus .= (string) hex2bin(strlen($hex) % 2 ? $hex . '0' : $hex);
            $i = $ende + 1;
            continue;
        }
        if ($c === '[') {
            // TJ-Array: Zahlen unter -200 sind Wortabstände
            $i++;
            while ($i < $laenge && $strom[$i] !== ']') {
                if ($strom[$i] === '(') {
                    $aus .= $lesenString($strom, $i);
                } elseif (preg_match('/\G\s*(-?\d+(?:\.\d+)?)/', $strom, $m, 0, $i)) {
                    if ((float) $m[1] < -200) {
                        $aus .= ' ';
                    }
                    $i += strlen($m[0]);
                } else {
                    $i++;
                }
            }
            $i++;
            continue;
        }
        if (preg_match('/\G(T\*|Td|TD|Tm|ET|\'|")/', $strom, $m, 0, $i)) {
            $aus .= "\n";
            $i += strlen($m[0]);
            continue;
        }
        $i++;
    }
    $aus = preg_replace('/[ \t]+\n/', "\n", $aus) ?? $aus;
    $aus = preg_replace('/\n{2,}/', "\n", $aus) ?? $aus;
    if (!mb_check_encoding($aus, 'UTF-8')) {
        $aus = mb_convert_encoding($aus, 'UTF-8', 'Windows-1252');
    }

    return $aus;
}

/** Rechnungsnummer, Datum und Nettosumme aus dem PDF-Text raten. */
function rpPdfKopfdaten(string $text): array
{
    $aus = ['nummer' => '', 'datum' => '', 'netto_cent' => 0];
    if (preg_match('/(?:Rechnungs?-?\s?(?:Nr|Nummer|No)\.?|Invoice\s*(?:No|Number|#)\.?|Beleg-?Nr\.?)\s*:?\s*([A-Z0-9][A-Z0-9\-\/.]{2,})/iu', $text, $m)) {
        $aus['nummer'] = rtrim($m[1], '.');
    }
    if (preg_match('/(?:Rechnungsdatum|Datum|Invoice\s*date|Date)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/iu', $text, $m)) {
        $aus['datum'] = rpDatumNormalisieren($m[1]);
    }
    $kandidaten = [];
    if (preg_match_all('/(?:Netto(?:summe|betrag)?|Zwischensumme|Summe\s*netto|Gesamt\s*netto|Subtotal|Net\s*(?:total|amount)|Total\s*net)\s*:?\s*(?:EUR|€)?\s*(-?[\d.,]+)\s*(?:EUR|€)?/iu', $text, $m)) {
        foreach ($m[1] as $z) {
            $kandidaten[] = (int) round(rpZahl($z) * 100);
        }
    }
    if ($kandidaten !== []) {
        $aus['netto_cent'] = max($kandidaten);
    }

    return $aus;
}

// ------------------------------------------------------------------- Profile

function rpProfilFuerCarrier(int $carrierId): ?array
{
    $st = datenbank()->prepare('SELECT * FROM rechnungsprofile WHERE carrier_id = ? ORDER BY id DESC LIMIT 1');
    $st->execute([$carrierId]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function rpProfilSpeichern(int $carrierId, array $spalten, string $einheit, array $kopf): void
{
    $db = datenbank();
    $db->prepare('DELETE FROM rechnungsprofile WHERE carrier_id = ?')->execute([$carrierId]);
    // Zuordnung nach Spaltennamen merken, nicht nach Position — Spaltenreihenfolge darf sich ändern.
    $nachName = [];
    foreach ($spalten as $feld => $i) {
        $nachName[$feld] = $i >= 0 ? (string) ($kopf[$i] ?? '') : '';
    }
    $db->prepare('INSERT INTO rechnungsprofile (carrier_id, spalten_json, gewicht_einheit, erstellt) VALUES (?, ?, ?, ?)')
       ->execute([$carrierId, json_encode($nachName, JSON_UNESCAPED_UNICODE), $einheit, jetzt()]);
}

/** Profil auf einen Kopf anwenden: Spaltennamen → Indizes. */
function rpProfilAnwenden(?array $profil, array $kopf): ?array
{
    if ($profil === null) {
        return null;
    }
    $namen = json_decode((string) $profil['spalten_json'], true) ?: [];
    $aus = array_fill_keys(array_keys(RP_FELDER), -1);
    $gefunden = 0;
    foreach ($namen as $feld => $name) {
        if ($name === '' || !isset($aus[$feld])) {
            continue;
        }
        $i = array_search($name, $kopf, true);
        if ($i !== false) {
            $aus[$feld] = (int) $i;
            $gefunden++;
        }
    }

    return $gefunden > 0 ? $aus : null;
}

// ---------------------------------------------------------------- Rechnungen

function rpRechnungLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT r.*, c.name AS carrier FROM lieferantenrechnungen r LEFT JOIN carrier c ON c.id = r.carrier_id WHERE r.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function rpRechnungenAlle(string $status = ''): array
{
    $sql = <<<'SQL'
        SELECT r.*, c.name AS carrier,
               (SELECT COUNT(*) FROM lieferantenpositionen p WHERE p.rechnung_id = r.id) AS positionen,
               (SELECT COALESCE(SUM(p.betrag_cent + p.zuschlag_cent),0) FROM lieferantenpositionen p WHERE p.rechnung_id = r.id) AS summe_cent,
               (SELECT COUNT(*) FROM lieferantenpositionen p WHERE p.rechnung_id = r.id AND p.befund <> 'ok') AS auffaellig,
               (SELECT COALESCE(SUM(p.nachberechnung_cent),0) FROM lieferantenpositionen p WHERE p.rechnung_id = r.id AND p.nachberechnung_status = 'offen') AS nachberechnung_offen
        FROM lieferantenrechnungen r LEFT JOIN carrier c ON c.id = r.carrier_id
    SQL;
    $werte = [];
    if ($status !== '' && isset(RP_STATUS[$status])) {
        $sql .= ' WHERE r.status = ?';
        $werte[] = $status;
    }
    $st = datenbank()->prepare($sql . ' ORDER BY r.id DESC LIMIT 200');
    $st->execute($werte);

    return $st->fetchAll();
}

/**
 * Hochgeladene Dateien ablegen und die Rechnung anlegen (Status „zuordnung“).
 * $dateien: ['pdf' => tmp-Pfad|null, 'csv' => tmp-Pfad]. Liefert die ID.
 */
function rpRechnungAnlegen(int $carrierId, array $dateien, array $kopf, string $von): int
{
    $csv = (string) file_get_contents($dateien['csv']);
    $gelesen = rpCsvLesen($csv);
    if (count($gelesen['kopf']) < 2 || $gelesen['zeilen'] === []) {
        throw new InvalidArgumentException('Die CSV-Datei hat keine erkennbare Kopfzeile oder keine Datenzeilen.');
    }
    $db = datenbank();
    $db->prepare('INSERT INTO lieferantenrechnungen (carrier_id, nummer, datum, betrag_netto_cent, status, csv_trenner, spalten_json, pdf_text, hochgeladen_von, erstellt, aktualisiert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute([$carrierId, '', '', 0, 'zuordnung', $gelesen['trenner'], '{}', '', $von, jetzt(), jetzt()]);
    $id = (int) $db->lastInsertId();
    $ordner = rpVerzeichnis();
    $csvDatei = $id . '.csv';
    file_put_contents($ordner . '/' . $csvDatei, $csv);
    $pdfDatei = '';
    $pdfText = '';
    $pdfKopf = ['nummer' => '', 'datum' => '', 'netto_cent' => 0];
    if (!empty($dateien['pdf']) && is_file($dateien['pdf'])) {
        $pdfDatei = $id . '.pdf';
        copy($dateien['pdf'], $ordner . '/' . $pdfDatei);
        $pdfText = rpPdfText($ordner . '/' . $pdfDatei);
        $pdfKopf = rpPdfKopfdaten($pdfText);
    }
    $db->prepare('UPDATE lieferantenrechnungen SET nummer = ?, datum = ?, betrag_netto_cent = ?, datei_pdf = ?, datei_csv = ?, pdf_text = ?, pdf_kopf_json = ? WHERE id = ?')
       ->execute([
           $kopf['nummer'] !== '' ? $kopf['nummer'] : $pdfKopf['nummer'],
           $kopf['datum'] !== '' ? $kopf['datum'] : $pdfKopf['datum'],
           (int) $kopf['netto_cent'] > 0 ? (int) $kopf['netto_cent'] : (int) $pdfKopf['netto_cent'],
           $pdfDatei, $csvDatei, mb_substr($pdfText, 0, 20000), json_encode($pdfKopf, JSON_UNESCAPED_UNICODE), $id,
       ]);

    return $id;
}

function rpRechnungCsv(array $rechnung): array
{
    $datei = rpVerzeichnis() . '/' . $rechnung['datei_csv'];

    return rpCsvLesen(is_file($datei) ? (string) file_get_contents($datei) : '', (string) $rechnung['csv_trenner']);
}

/** Zuordnung übernehmen, Positionen (neu) einlesen und prüfen. */
function rpPositionenImportieren(array $rechnung, array $spalten, string $einheit): int
{
    if (($spalten['referenz'] ?? -1) < 0 && ($spalten['sendungsnummer'] ?? -1) < 0) {
        throw new InvalidArgumentException('Bitte mindestens die Spalte mit unserer Sendungsnummer oder der Carrier-Sendungsnummer zuordnen.');
    }
    if (($spalten['gewicht'] ?? -1) < 0 || ($spalten['betrag'] ?? -1) < 0) {
        throw new InvalidArgumentException('Gewicht und Betrag müssen zugeordnet sein — ohne sie gibt es nichts zu prüfen.');
    }
    $csv = rpRechnungCsv($rechnung);
    $db = datenbank();
    $db->beginTransaction();
    try {
        $db->prepare('DELETE FROM lieferantenpositionen WHERE rechnung_id = ?')->execute([$rechnung['id']]);
        $st = $db->prepare('INSERT INTO lieferantenpositionen (rechnung_id, zeile, sendungsnummer, referenz, datum, zielland, gewicht_gramm, betrag_cent, zuschlag_cent, roh_json, befund, nachberechnung_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $wert = static fn (array $z, string $feld): string => ($spalten[$feld] ?? -1) >= 0 ? (string) ($z[$spalten[$feld]] ?? '') : '';
        $n = 0;
        foreach ($csv['zeilen'] as $nr => $z) {
            $referenz = $wert($z, 'referenz');
            if (!preg_match('/NE-\d{4}-[0-9A-F]{8}/i', $referenz, $m)) {
                // Nummer irgendwo in der Zeile?
                foreach ($z as $feld) {
                    if (preg_match('/NE-\d{4}-[0-9A-F]{8}/i', (string) $feld, $m)) {
                        break;
                    }
                }
            }
            $referenz = isset($m[0]) ? strtoupper($m[0]) : $referenz;
            unset($m);
            $gewicht = rpZahl($wert($z, 'gewicht'));
            $gramm = (int) round($einheit === 'g' ? $gewicht : $gewicht * 1000);
            $roh = [];
            foreach ($csv['kopf'] as $i => $name) {
                $roh[$name] = $z[$i] ?? '';
            }
            $st->execute([
                $rechnung['id'], $nr + 2, $wert($z, 'sendungsnummer'), $referenz, rpDatumNormalisieren($wert($z, 'datum')),
                strtoupper(substr(trim($wert($z, 'zielland')), 0, 2)), $gramm,
                (int) round(rpZahl($wert($z, 'betrag')) * 100), (int) round(rpZahl($wert($z, 'zuschlag')) * 100),
                json_encode($roh, JSON_UNESCAPED_UNICODE), 'nicht_zugeordnet', 'keine',
            ]);
            $n++;
        }
        $nachName = [];
        $db->prepare("UPDATE lieferantenrechnungen SET spalten_json = ?, gewicht_einheit = ?, status = 'geprueft', aktualisiert = ? WHERE id = ?")
           ->execute([json_encode($spalten), $einheit, jetzt(), $rechnung['id']]);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    rpRechnungPruefen((int) $rechnung['id']);

    return $n;
}

// ------------------------------------------------------------------- Prüfung

function rpPositionen(int $rechnungId, string $befund = ''): array
{
    $sql = 'SELECT p.*, b.ext_ref, b.status AS bestellung_status, b.zielland AS b_zielland, b.gewichtsklasse AS b_gk, b.gewicht_gramm AS b_gewicht, b.carrier AS b_carrier, b.netto_cent AS b_netto, b.zusatz_cent AS b_zusatz, b.einkauf_cent AS b_einkauf, b.firma_id, b.kunde_id, b.email AS b_email, b.art AS b_art, nb.ext_ref AS nachberechnung_ref FROM lieferantenpositionen p LEFT JOIN bestellungen b ON b.id = p.bestellung_id LEFT JOIN bestellungen nb ON nb.id = p.nachberechnung_bestellung_id WHERE p.rechnung_id = ?';
    $werte = [$rechnungId];
    if ($befund !== '' && isset(RP_BEFUNDE[$befund])) {
        $sql .= ' AND p.befund = ?';
        $werte[] = $befund;
    }
    $st = datenbank()->prepare($sql . ' ORDER BY p.zeile');
    $st->execute($werte);

    return $st->fetchAll();
}

function rpPositionLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT p.*, r.carrier_id, r.nummer AS rechnung_nummer FROM lieferantenpositionen p JOIN lieferantenrechnungen r ON r.id = p.rechnung_id WHERE p.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Rang einer Gewichtsklasse (Reihenfolge der Preisliste). */
function rpKlassenRang(string $code): int
{
    $i = array_search($code, array_keys(preisliste()['gewichtsklassen']), true);

    return $i === false ? -1 : (int) $i;
}

/** Angebot eines bestimmten Carriers für eine Zelle (Einkauf/Verkauf), sonst null. */
function rpAngebot(string $land, string $gk, string $carrier): ?array
{
    foreach (angeboteFuer($land, $gk) as $a) {
        if (strcasecmp($a['carrier'], $carrier) === 0) {
            return $a;
        }
    }

    return null;
}

/** Alle Positionen einer Rechnung zuordnen und bewerten. Gebuchte Nachberechnungen bleiben unberührt. */
function rpRechnungPruefen(int $rechnungId): array
{
    $rechnung = rpRechnungLaden($rechnungId);
    if ($rechnung === null) {
        throw new InvalidArgumentException('Rechnung nicht gefunden.');
    }
    $db = datenbank();
    // Schon auf anderen Rechnungen abgerechnete Sendungen zählen als doppelt
    $gesehen = [];
    $st = $db->prepare("SELECT DISTINCT bestellung_id FROM lieferantenpositionen WHERE rechnung_id <> ? AND bestellung_id IS NOT NULL AND befund NOT IN ('doppelt', 'nicht_zugeordnet')");
    $st->execute([$rechnungId]);
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $gesehen[(int) $id] = true;
    }
    foreach (rpPositionen($rechnungId) as $p) {
        if (in_array($p['nachberechnung_status'], ['gebucht', 'gutschrift'], true)) {
            $gesehen[(int) $p['bestellung_id']] = true;
            continue;
        }
        $b = null;
        if ((int) $p['bestellung_id'] > 0 && (int) ($p['manuell'] ?? 0) === 1) {
            $b = bestellungLaden('id', (string) $p['bestellung_id']);
        } elseif ($p['referenz'] !== '' && preg_match('/^NE-\d{4}-[0-9A-F]{8}$/', $p['referenz'])) {
            $b = bestellungLaden('ext_ref', $p['referenz']);
        }
        if ($b === null && $p['sendungsnummer'] !== '') {
            $st = $db->prepare('SELECT * FROM bestellungen WHERE carrier_sendungsnummer = ? LIMIT 1');
            $st->execute([$p['sendungsnummer']]);
            $b = $st->fetch() ?: null;
        }
        $e = rpPositionBewerten($p, $b, (string) $rechnung['carrier'], $gesehen);
        $db->prepare('UPDATE lieferantenpositionen SET bestellung_id = ?, gk_bestellt = ?, gk_ist = ?, einkauf_soll_cent = ?, differenz_cent = ?, verkauf_bestellt_cent = ?, verkauf_ist_cent = ?, nachberechnung_cent = ?, nachberechnung_status = ?, befund = ?, hinweis = ? WHERE id = ?')
           ->execute([$b['id'] ?? null, $e['gk_bestellt'], $e['gk_ist'], $e['einkauf_soll'], $e['differenz'], $e['verkauf_bestellt'], $e['verkauf_ist'], $e['nachberechnung'], $e['nachberechnung_status'], $e['befund'], $e['hinweis'], $p['id']]);
        if ($b !== null) {
            $gesehen[(int) $b['id']] = true;
        }
    }
    $db->prepare("UPDATE lieferantenrechnungen SET aktualisiert = ? WHERE id = ?")->execute([jetzt(), $rechnungId]);

    return rpZusammenfassung($rechnungId);
}

/** Bewertung einer Position gegen die Bestellung; reine Rechnung ohne Schreibzugriff. */
function rpPositionBewerten(array $p, ?array $b, string $carrier, array $gesehen): array
{
    $tol = rpToleranzCent();
    $e = ['gk_bestellt' => '', 'gk_ist' => '', 'einkauf_soll' => 0, 'differenz' => 0, 'verkauf_bestellt' => 0, 'verkauf_ist' => 0, 'nachberechnung' => 0, 'nachberechnung_status' => 'keine', 'befund' => 'nicht_zugeordnet', 'hinweis' => ''];
    $betrag = (int) $p['betrag_cent'];
    if ($b === null) {
        $e['hinweis'] = $p['referenz'] !== '' ? 'Nummer ' . $p['referenz'] . ' gibt es nicht.' : 'Keine NEOS-Sendungsnummer in der Zeile.';

        return $e;
    }
    $e['gk_bestellt'] = (string) $b['gewichtsklasse'];
    $e['verkauf_bestellt'] = (int) $b['netto_cent'] - (int) $b['zusatz_cent'];
    $e['einkauf_soll'] = (int) $b['einkauf_cent'];
    $land = (string) $b['zielland'];
    if (isset($gesehen[(int) $b['id']])) {
        $e['befund'] = 'doppelt';
        $e['differenz'] = $betrag;
        $e['hinweis'] = 'Sendung ist schon auf einer Rechnung abgerechnet.';

        return $e;
    }
    if (!in_array($b['status'], ['bezahlt', 'beauftragt'], true) || $b['art'] === 'nachberechnung') {
        $e['befund'] = 'storniert';
        $e['differenz'] = $betrag;
        $e['hinweis'] = 'Bestellstatus: ' . statusName((string) $b['status']) . '.';

        return $e;
    }
    $hinweise = [];
    if ($b['carrier'] !== null && $carrier !== '' && strcasecmp((string) $b['carrier'], $carrier) !== 0) {
        $hinweise[] = 'Bestellt über ' . $b['carrier'] . ', abgerechnet von ' . $carrier . '.';
    }
    $gramm = (int) $p['gewicht_gramm'];
    $gkIst = $gramm > 0 ? gewichtsklasseFuerGewicht($gramm) : $e['gk_bestellt'];
    if ($gkIst === null) {
        $e['befund'] = 'unbekannte_klasse';
        $e['gk_ist'] = '';
        $e['differenz'] = $betrag - $e['einkauf_soll'];
        $e['hinweis'] = 'Gewicht ' . number_format($gramm / 1000, 2, ',', '') . ' kg liegt über der höchsten Gewichtsklasse. ' . implode(' ', $hinweise);

        return $e;
    }
    $e['gk_ist'] = $gkIst;
    $rangIst = rpKlassenRang($gkIst);
    $rangSoll = rpKlassenRang($e['gk_bestellt']);
    $angebotIst = rpAngebot($land, $gkIst, $carrier !== '' ? $carrier : (string) $b['carrier']) ?? rpAngebot($land, $gkIst, (string) $b['carrier']);
    $angebotSoll = rpAngebot($land, $e['gk_bestellt'], $carrier !== '' ? $carrier : (string) $b['carrier']) ?? rpAngebot($land, $e['gk_bestellt'], (string) $b['carrier']);
    if ($rangIst > $rangSoll) {
        $e['befund'] = 'gewicht_hoeher';
        $einkaufIst = $angebotIst['einkauf'] ?? null;
        $e['verkauf_ist'] = (int) ($angebotIst['netto'] ?? 0);
        $e['differenz'] = $einkaufIst !== null ? $betrag - (int) $einkaufIst : 0;
        if ($e['verkauf_ist'] > 0) {
            $e['nachberechnung'] = max(0, $e['verkauf_ist'] - $e['verkauf_bestellt']);
            $e['nachberechnung_status'] = $e['nachberechnung'] > 0 ? 'offen' : 'keine';
        } else {
            $hinweise[] = 'Für ' . $gkIst . ' gibt es keinen Verkaufspreis in der Routingmatrix — Nachberechnung bitte manuell.';
        }
        $hinweise[] = 'Gebucht ' . $e['gk_bestellt'] . ' (' . number_format((int) $b['gewicht_gramm'] / 1000, 2, ',', '') . ' kg), gewogen ' . number_format($gramm / 1000, 2, ',', '') . ' kg → ' . $gkIst . '.';
        if ($einkaufIst !== null && abs($e['differenz']) > $tol) {
            $hinweise[] = 'Lieferant berechnet ' . euro($betrag) . ' statt ' . euro((int) $einkaufIst) . ' laut Routingmatrix.';
        }
    } elseif ($rangIst < $rangSoll) {
        $e['befund'] = 'gewicht_niedriger';
        $e['verkauf_ist'] = (int) ($angebotIst['netto'] ?? 0);
        $e['differenz'] = isset($angebotIst['einkauf']) ? $betrag - (int) $angebotIst['einkauf'] : $betrag - $e['einkauf_soll'];
        $hinweise[] = 'Gewogen ' . number_format($gramm / 1000, 2, ',', '') . ' kg → ' . $gkIst . ', gebucht war ' . $e['gk_bestellt'] . '. Gutschrift möglich: ' . euro(max(0, $e['verkauf_bestellt'] - $e['verkauf_ist'])) . '.';
    } else {
        $e['verkauf_ist'] = $e['verkauf_bestellt'];
        $soll = $angebotSoll['einkauf'] ?? $e['einkauf_soll'];
        $e['differenz'] = $betrag - (int) $soll;
        if (abs($e['differenz']) > $tol) {
            $e['befund'] = 'preis_abweichung';
            $hinweise[] = 'Berechnet ' . euro($betrag) . ', erwartet ' . euro((int) $soll) . ' (Einkauf laut Routingmatrix' . ((int) $soll !== $e['einkauf_soll'] ? ', zum Bestellzeitpunkt ' . euro($e['einkauf_soll']) : '') . ').';
        } else {
            $e['befund'] = 'ok';
        }
    }
    if ((int) $p['zuschlag_cent'] > 0) {
        $hinweise[] = 'Zuschläge ' . euro((int) $p['zuschlag_cent']) . ' zusätzlich berechnet.';
    }
    $e['hinweis'] = implode(' ', $hinweise);

    return $e;
}

function rpZusammenfassung(int $rechnungId): array
{
    $db = datenbank();
    $st = $db->prepare('SELECT befund, COUNT(*) AS n, COALESCE(SUM(betrag_cent + zuschlag_cent),0) AS betrag, COALESCE(SUM(differenz_cent),0) AS differenz FROM lieferantenpositionen WHERE rechnung_id = ? GROUP BY befund');
    $st->execute([$rechnungId]);
    $befunde = [];
    foreach ($st as $z) {
        $befunde[$z['befund']] = ['n' => (int) $z['n'], 'betrag' => (int) $z['betrag'], 'differenz' => (int) $z['differenz']];
    }
    $st = $db->prepare("SELECT COUNT(*) AS n, COALESCE(SUM(betrag_cent + zuschlag_cent),0) AS summe, COALESCE(SUM(CASE WHEN nachberechnung_status = 'offen' THEN nachberechnung_cent ELSE 0 END),0) AS nb_offen, COALESCE(SUM(CASE WHEN nachberechnung_status = 'gebucht' THEN nachberechnung_cent ELSE 0 END),0) AS nb_gebucht, COALESCE(SUM(CASE WHEN befund IN ('preis_abweichung','doppelt','storniert','nicht_zugeordnet') OR ABS(differenz_cent) > ? THEN differenz_cent ELSE 0 END),0) AS beanstandung, SUM(CASE WHEN befund IN ('preis_abweichung','doppelt','storniert','nicht_zugeordnet') OR ABS(differenz_cent) > ? THEN 1 ELSE 0 END) AS beanstandungen FROM lieferantenpositionen WHERE rechnung_id = ?");
    $tol = rpToleranzCent();
    $st->execute([$tol, $tol, $rechnungId]);
    $s = $st->fetch() ?: [];

    return ['befunde' => $befunde, 'positionen' => (int) ($s['n'] ?? 0), 'summe' => (int) ($s['summe'] ?? 0), 'nachberechnung_offen' => (int) ($s['nb_offen'] ?? 0), 'nachberechnung_gebucht' => (int) ($s['nb_gebucht'] ?? 0), 'beanstandung' => (int) ($s['beanstandung'] ?? 0), 'beanstandungen' => (int) ($s['beanstandungen'] ?? 0)];
}

/** Position von Hand einer Bestellung zuordnen und neu bewerten. */
function rpPositionZuordnen(array $p, string $extRef): void
{
    $b = bestellungLaden('ext_ref', strtoupper(trim($extRef)));
    if ($b === null) {
        throw new InvalidArgumentException('Bestellung ' . $extRef . ' gibt es nicht.');
    }
    datenbank()->prepare('UPDATE lieferantenpositionen SET bestellung_id = ?, referenz = ?, manuell = 1 WHERE id = ?')->execute([$b['id'], $b['ext_ref'], $p['id']]);
    rpRechnungPruefen((int) $p['rechnung_id']);
}

// ------------------------------------------------------------ Nachberechnung

/**
 * Nachberechnung an den Kunden buchen: eigene Bestellung (art nachberechnung)
 * mit dem Differenzbetrag netto. Firma → auf Rechnung (nächste Sammelrechnung);
 * Privatkunde → vom Guthaben, sonst offene Revolut-Zahlung. Mail an den Kunden.
 */
function rpNachberechnungBuchen(array $p, string $von, ?int $betragCent = null): array
{
    $b = bestellungLaden('id', (string) $p['bestellung_id']);
    if ($b === null || $p['nachberechnung_status'] === 'gebucht') {
        throw new InvalidArgumentException('Position ist nicht zugeordnet oder schon gebucht.');
    }
    $netto = $betragCent ?? (int) $p['nachberechnung_cent'];
    if ($netto <= 0) {
        throw new InvalidArgumentException('Kein Nachberechnungsbetrag.');
    }
    $brutto = bruttoCent($netto);
    $db = datenbank();
    $kunde = ['id' => (int) ($b['kunde_id'] ?? 0), 'art' => $b['firma_id'] ? 'business' : 'privat', 'firma_id' => $b['firma_id']];
    if ($b['firma_id']) {
        $zahlungsart = 'rechnung';
        $status = 'beauftragt';
    } elseif ((int) ($b['kunde_id'] ?? 0) > 0 && guthabenStand($kunde) >= $brutto) {
        $zahlungsart = 'guthaben';
        $status = 'beauftragt';
    } else {
        $zahlungsart = 'revolut';
        $status = 'offen';
    }
    $extRef = 'NE-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $grund = ['original' => $b['ext_ref'], 'gewicht_gramm' => (int) $p['gewicht_gramm'], 'gk_bestellt' => $p['gk_bestellt'], 'gk_ist' => $p['gk_ist'], 'lieferantenrechnung' => $p['rechnung_nummer'] ?? '', 'position' => (int) $p['id']];
    $ereignis = ['zeit' => jetzt(), 'ereignis' => 'nachberechnung', 'status' => $status, 'von' => $von, 'grund' => $grund];
    $db->prepare(<<<'SQL'
        INSERT INTO bestellungen
            (ext_ref, status, netto_cent, mwst_cent, betrag_cent, waehrung, zielland, gewichtsklasse, carrier, einkauf_cent,
             email, sprache, absender_json, empfaenger_json, ereignisse_json, erstellt, aktualisiert,
             kunde_id, firma_id, zahlungsart, referenz, art, gewicht_gramm, versandstatus, nachberechnung_zu, nachberechnung_json)
        VALUES (:ref, :status, :netto, :mwst, :brutto, 'EUR', :land, :gk, :carrier, 0, :email, :sprache, :abs, :emp, :ev, :t, :t,
             :kunde, :firma, :zahlungsart, :referenz, 'nachberechnung', :gewicht, 'zugestellt', :zu, :grund)
    SQL)->execute([
        ':ref' => $extRef, ':status' => $status, ':netto' => $netto, ':mwst' => $brutto - $netto, ':brutto' => $brutto,
        ':land' => $b['zielland'], ':gk' => $p['gk_ist'] ?: $b['gewichtsklasse'], ':carrier' => $b['carrier'], ':email' => $b['email'], ':sprache' => $b['sprache'],
        ':abs' => $b['absender_json'], ':emp' => $b['empfaenger_json'], ':ev' => json_encode([$ereignis], JSON_UNESCAPED_UNICODE), ':t' => jetzt(),
        ':kunde' => $b['kunde_id'], ':firma' => $b['firma_id'], ':zahlungsart' => $zahlungsart, ':referenz' => 'Nachberechnung ' . $b['ext_ref'],
        ':gewicht' => (int) $p['gewicht_gramm'], ':zu' => $b['id'], ':grund' => json_encode($grund, JSON_UNESCAPED_UNICODE),
    ]);
    $neu = bestellungLaden('ext_ref', $extRef);
    if ($zahlungsart === 'guthaben') {
        guthabenBuchen($kunde, 'verbrauch', -$brutto, 'Nachberechnung ' . $b['ext_ref'] . ' (' . $extRef . ')', (int) $neu['id']);
    }
    // Originalbestellung: tatsächliches Gewicht und Einkauf vermerken
    $ereignisse = json_decode((string) $b['ereignisse_json'], true) ?: [];
    $ereignisse[] = ['zeit' => jetzt(), 'ereignis' => 'nachberechnung.gebucht', 'status' => $b['status'], 'von' => $von, 'nachberechnung' => $extRef, 'gewicht_gramm' => (int) $p['gewicht_gramm']];
    $db->prepare('UPDATE bestellungen SET gewicht_carrier_gramm = ?, einkauf_ist_cent = ?, carrier_sendungsnummer = CASE WHEN carrier_sendungsnummer = ? THEN ? ELSE carrier_sendungsnummer END, ereignisse_json = ?, aktualisiert = ? WHERE id = ?')
       ->execute([(int) $p['gewicht_gramm'], (int) $p['betrag_cent'] + (int) $p['zuschlag_cent'], '', (string) $p['sendungsnummer'], json_encode($ereignisse, JSON_UNESCAPED_UNICODE), jetzt(), $b['id']]);
    $db->prepare("UPDATE lieferantenpositionen SET nachberechnung_cent = ?, nachberechnung_status = 'gebucht', nachberechnung_bestellung_id = ? WHERE id = ?")->execute([$netto, $neu['id'], $p['id']]);
    try {
        rpNachberechnungMail($neu, $b, $grund);
    } catch (Throwable $e) {
        error_log('[rechnungspruefung] Mail: ' . $e->getMessage());
    }

    return $neu;
}

/** Position ohne Nachberechnung schließen. */
function rpNachberechnungVerzichten(array $p): void
{
    datenbank()->prepare("UPDATE lieferantenpositionen SET nachberechnung_status = 'verzichtet' WHERE id = ? AND nachberechnung_status <> 'gebucht'")->execute([$p['id']]);
}

/** Gutschrift bei niedrigerem Gewicht: Differenz brutto als Guthaben. */
function rpGutschriftBuchen(array $p, string $von): int
{
    $b = bestellungLaden('id', (string) $p['bestellung_id']);
    if ($b === null || $p['befund'] !== 'gewicht_niedriger') {
        throw new InvalidArgumentException('Gutschrift nur bei niedrigerem Gewicht.');
    }
    $netto = max(0, (int) $p['verkauf_bestellt_cent'] - (int) $p['verkauf_ist_cent']);
    if ($netto <= 0) {
        throw new InvalidArgumentException('Kein Gutschriftbetrag.');
    }
    $brutto = $b['firma_id'] ? $netto : bruttoCent($netto);
    $kunde = ['id' => (int) ($b['kunde_id'] ?? 0), 'art' => $b['firma_id'] ? 'business' : 'privat', 'firma_id' => $b['firma_id']];
    guthabenBuchen($kunde, 'erstattung', $brutto, 'Gutschrift Gewicht ' . $b['ext_ref'] . ' (' . $p['gk_bestellt'] . ' → ' . $p['gk_ist'] . ')', (int) $b['id']);
    datenbank()->prepare("UPDATE lieferantenpositionen SET nachberechnung_cent = ?, nachberechnung_status = 'gutschrift' WHERE id = ?")->execute([-$brutto, $p['id']]);
    datenbank()->prepare('UPDATE bestellungen SET gewicht_carrier_gramm = ?, einkauf_ist_cent = ?, aktualisiert = ? WHERE id = ?')->execute([(int) $p['gewicht_gramm'], (int) $p['betrag_cent'] + (int) $p['zuschlag_cent'], jetzt(), $b['id']]);

    return $brutto;
}

function rpNachberechnungMail(array $neu, array $original, array $grund): void
{
    $sprache = $neu['sprache'] === 'en' ? 'en' : 'de';
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $abs = json_decode((string) $original['absender_json'], true) ?: [];
    $pfad = $neu['firma_id'] ? 'sendungen' : 'bestellungen';
    $kg = number_format((int) $grund['gewicht_gramm'] / 1000, 2, $sprache === 'en' ? '.' : ',', '');
    if ($sprache === 'en') {
        $betreff = 'Weight adjustment for NEOS shipment ' . $original['ext_ref'];
        $zeilen = ['Hello ' . ($abs['name'] ?? '') . ',', '',
            'the carrier weighed shipment ' . $original['ext_ref'] . ' at ' . $kg . ' kg. It was booked in weight class ' . $grund['gk_bestellt'] . ', the measured weight falls into class ' . $grund['gk_ist'] . '.',
            '', 'Difference net: ' . betragFormat((int) $neu['netto_cent'], 'en'), 'Difference incl. VAT: ' . betragFormat((int) $neu['betrag_cent'], 'en'), ''];
        $zeilen[] = match ($neu['zahlungsart']) {
            'rechnung' => 'The amount appears as a separate line on your next collective invoice.',
            'guthaben' => 'The amount has been debited from your NEOS credit.',
            default => 'Please settle the amount in the portal: ' . $basis . '/konto/' . $pfad . '/' . $neu['ext_ref'] . '/bezahlen?sprache=en',
        };
        array_push($zeilen, '', 'Tip: weigh parcels before booking — the class is chosen from the weight you enter.', '', 'NEOS Logistics UG · info@neos24.com');
    } else {
        $betreff = 'Gewichtsnachberechnung zu NEOS-Sendung ' . $original['ext_ref'];
        $zeilen = ['Hallo ' . ($abs['name'] ?? '') . ',', '',
            'der Carrier hat die Sendung ' . $original['ext_ref'] . ' mit ' . $kg . ' kg gewogen. Gebucht war die Gewichtsklasse ' . $grund['gk_bestellt'] . ', das gemessene Gewicht fällt in die Klasse ' . $grund['gk_ist'] . '.',
            '', 'Differenz netto: ' . betragFormat((int) $neu['netto_cent'], 'de'), 'Differenz inkl. MwSt.: ' . betragFormat((int) $neu['betrag_cent'], 'de'), ''];
        $zeilen[] = match ($neu['zahlungsart']) {
            'rechnung' => 'Der Betrag erscheint als eigene Position auf deiner nächsten Sammelrechnung.',
            'guthaben' => 'Der Betrag wurde von deinem NEOS-Guthaben abgebucht.',
            default => 'Bitte begleiche den Betrag im Portal: ' . $basis . '/konto/' . $pfad . '/' . $neu['ext_ref'] . '/bezahlen',
        };
        array_push($zeilen, '', 'Tipp: Pakete vor der Buchung wiegen — die Klasse ergibt sich aus dem eingegebenen Gewicht.', '', 'NEOS Logistics UG · info@neos24.com');
    }
    mailSenden((string) $neu['email'], $betreff, implode("\n", $zeilen));
}

// -------------------------------------------------------------- Beanstandung

/** Beanstandung an den Lieferanten als CSV (Semikolon, UTF-8 mit BOM für Excel). */
function rpBeanstandungCsv(array $rechnung): string
{
    $tol = rpToleranzCent();
    $zeilen = ["\xEF\xBB\xBF" . implode(';', ['Rechnung', 'Zeile', 'Carrier-Sendungsnummer', 'NEOS-Sendung', 'Zielland', 'Gewicht kg', 'Gewichtsklasse', 'Berechnet EUR', 'Erwartet EUR', 'Differenz EUR', 'Befund', 'Hinweis'])];
    foreach (rpPositionen((int) $rechnung['id']) as $p) {
        $beanstandet = in_array($p['befund'], ['preis_abweichung', 'doppelt', 'storniert', 'nicht_zugeordnet'], true) || abs((int) $p['differenz_cent']) > $tol;
        if (!$beanstandet) {
            continue;
        }
        $erwartet = (int) $p['betrag_cent'] + (int) $p['zuschlag_cent'] - (int) $p['differenz_cent'];
        $felder = [$rechnung['nummer'], (string) $p['zeile'], $p['sendungsnummer'], $p['referenz'], $p['zielland'] ?: ($p['b_zielland'] ?? ''), number_format((int) $p['gewicht_gramm'] / 1000, 2, ',', ''), $p['gk_ist'] ?: $p['gk_bestellt'],
            number_format(((int) $p['betrag_cent'] + (int) $p['zuschlag_cent']) / 100, 2, ',', ''), number_format($erwartet / 100, 2, ',', ''), number_format((int) $p['differenz_cent'] / 100, 2, ',', ''), RP_BEFUNDE[$p['befund']] ?? $p['befund'], $p['hinweis']];
        $zeilen[] = implode(';', array_map(static fn (string $f): string => '"' . str_replace('"', '""', $f) . '"', $felder));
    }

    return implode("\r\n", $zeilen) . "\r\n";
}
