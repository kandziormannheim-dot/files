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

require_once __DIR__ . '/tabelle_lesen.php';
require_once __DIR__ . '/pdf_text.php';

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

/** Vorschlag, welche CSV-Spalte welches Feld ist (Index je Feld oder -1). Je Feld gewinnt das erste Muster, das irgendeine Spalte trifft. */
function rpSpaltenErkennen(array $kopf, array $zeilen = []): array
{
    $muster = [
        'sendungsnummer' => ['/identcode|sendungs?nr|sendungsnummer|tracking|paketschein|paket-?nr|parcel\s*(no|nr|id)|shipment\s*(no|nr|id)|barcode|awb|waybill/i', '/paket|parcel|shipment|colli|piece/i'],
        'referenz' => ['/shipper.?s?\s*ref|kundenref|customer.?ref|referenz|reference/i', '/auftrag|order|ref\b/i'],
        'datum' => ['/versand|ship\s*date|pu\s*date|pickup|abhol|leistungs/i', '/datum|date/i'],
        'zielland' => ['/dest|ziel|empf|receiver|recipient|to\s*country|delivery\s*country/i', '/\bland\b|country/i'],
        'gewicht' => ['/abr|bill|abgerech|charge|berechn|effekt|effective/i', '/gewicht|weight|\bwgt|\bwt\b|\bkg\b|gramm/i'],
        'betrag' => ['/netto|net\b|total|betrag|amount/i', '/preis|price|entgelt|kosten|charge|fee/i'],
        'zuschlag' => ['/zuschl|surcharge|maut|toll|fuel|diesel|energ/i'],
    ];
    $aus = array_fill_keys(array_keys(RP_FELDER), -1);
    foreach ($muster as $feld => $liste) {
        foreach ($liste as $regex) {
            foreach ($kopf as $i => $name) {
                $treffer = preg_match($regex, $name) === 1;
                if ($feld === 'gewicht' && $treffer && !preg_match('/gewicht|weight|wgt|\bwt\b|kg/i', $name)) {
                    $treffer = false; // „abgerechnet“ nur, wenn es auch ein Gewicht ist
                }
                if ($feld === 'zielland' && $treffer && preg_match('/origin|absender|sender|from/i', $name)) {
                    $treffer = false;
                }
                if ($feld === 'betrag' && $treffer && preg_match('/zuschlag|surcharge|weight|gewicht/i', $name)) {
                    $treffer = false;
                }
                if ($treffer && !in_array($i, $aus, true)) {
                    $aus[$feld] = $i;
                    break 2;
                }
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

/** Text aus einem PDF: pdftotext, wenn vorhanden, sonst eigener Leser (lib/pdf_text.php). */
function rpPdfText(string $datei): string
{
    if (!is_file($datei)) {
        return '';
    }
    $bin = trim((string) @shell_exec('command -v pdftotext 2>/dev/null'));
    if ($bin !== '') {
        $aus = @shell_exec($bin . ' -layout ' . escapeshellarg($datei) . ' - 2>/dev/null');
        if (is_string($aus) && trim($aus) !== '') {
            return $aus;
        }
    }
    try {
        return pdfTextLesen($datei);
    } catch (Throwable $e) {
        error_log('[rechnungspruefung] PDF: ' . $e->getMessage());

        return '';
    }
}

/** Rechnungsnummer, Datum und Nettosumme aus dem PDF-Text raten. */
function rpPdfKopfdaten(string $text): array
{
    $aus = ['nummer' => '', 'datum' => '', 'netto_cent' => 0];
    $etikett = '(?:Rechnungs?-?\s?(?:Nr|Nummer|No)\.?|Invoice\s*(?:No|Number|Nr|#)\.?|Beleg-?Nr\.?|Document\s*No\.?)';
    if (preg_match('/' . $etikett . '\s*:?[ \t]*([A-Z0-9][A-Z0-9\-\/.]{3,})/iu', $text, $m) && !preg_match('/^(from|to|date|period)$/i', $m[1])) {
        $aus['nummer'] = rtrim($m[1], '.');
    } elseif (preg_match('/\b([A-Z]{1,5}-?\d{6,14})\b/', $text, $m)) {
        $aus['nummer'] = $m[1]; // Nummer steht getrennt vom Etikett (Tabellenlayout)
    }
    $datumMuster = '(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})';
    if (preg_match('/(?:Rechnungsdatum|Belegdatum|Datum|Invoice\s*date|Entry\s*date|Date)\s*:?\s*' . $datumMuster . '/iu', $text, $m)) {
        $aus['datum'] = rpDatumNormalisieren($m[1]);
    } elseif (preg_match('/' . $datumMuster . '\s*\n?\s*(?:Entry\s*date|Invoice\s*date|Rechnungsdatum|Datum)/iu', $text, $m)) {
        $aus['datum'] = rpDatumNormalisieren($m[1]);
    } elseif (preg_match('/' . $datumMuster . '/u', $text, $m)) {
        $aus['datum'] = rpDatumNormalisieren($m[1]);
    }
    $kandidaten = [];
    $betrag = '\s*:?\s*(?:EUR|€)?\s*(-?\d[\d.,]*)\s*(?:EUR|€)?';
    if (preg_match_all('/(?:Netto(?:summe|betrag)?|Zwischensumme|Summe\s*netto|Gesamt\s*netto|Subtotal|Net\s*(?:total|amount)|Total\s*net|Total\s*amount|Gesamtbetrag|Rechnungsbetrag|Zahlbetrag|Amount\s*due|Grand\s*total)' . $betrag . '/iu', $text, $m)) {
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
 * $dateien: ['pdf' => tmp-Pfad|null, 'tabelle' => tmp-Pfad, 'tabelle_name' => Originalname]. Liefert die ID.
 */
function rpRechnungAnlegen(int $carrierId, array $dateien, array $kopf, string $von): int
{
    $tabelle = tabelleLesen($dateien['tabelle'], (string) ($dateien['tabelle_name'] ?? ''));
    $blatt = rpBlattWaehlen($tabelle['blaetter']);
    if ($blatt === null) {
        throw new InvalidArgumentException('Die Datei hat kein Blatt mit einer erkennbaren Kopfzeile und Datenzeilen.');
    }
    $db = datenbank();
    $db->prepare('INSERT INTO lieferantenrechnungen (carrier_id, nummer, datum, betrag_netto_cent, status, csv_trenner, spalten_json, pdf_text, hochgeladen_von, erstellt, aktualisiert, blatt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute([$carrierId, '', '', 0, 'zuordnung', $tabelle['blaetter'][$blatt]['trenner'] ?: ';', '{}', '', $von, jetzt(), jetzt(), $tabelle['blaetter'][$blatt]['name']]);
    $id = (int) $db->lastInsertId();
    $ordner = rpVerzeichnis();
    $tabDatei = $id . '.' . ($tabelle['art'] === 'xlsx' ? 'xlsx' : 'csv');
    copy($dateien['tabelle'], $ordner . '/' . $tabDatei);
    $pdfDatei = '';
    $pdfText = '';
    $pdfKopf = ['nummer' => '', 'datum' => '', 'netto_cent' => 0];
    if (!empty($dateien['pdf']) && is_file($dateien['pdf'])) {
        $pdfDatei = $id . '.pdf';
        copy($dateien['pdf'], $ordner . '/' . $pdfDatei);
        $pdfText = rpPdfText($ordner . '/' . $pdfDatei);
        $pdfKopf = rpPdfKopfdaten($pdfText);
    }
    if ((int) $pdfKopf['netto_cent'] <= 0) {
        $pdfKopf['netto_cent'] = rpSummeAusTabelle($tabelle['blaetter']);
    }
    $db->prepare('UPDATE lieferantenrechnungen SET nummer = ?, datum = ?, betrag_netto_cent = ?, datei_pdf = ?, datei_csv = ?, pdf_text = ?, pdf_kopf_json = ? WHERE id = ?')
       ->execute([
           $kopf['nummer'] !== '' ? $kopf['nummer'] : $pdfKopf['nummer'],
           $kopf['datum'] !== '' ? $kopf['datum'] : $pdfKopf['datum'],
           (int) $kopf['netto_cent'] > 0 ? (int) $kopf['netto_cent'] : (int) $pdfKopf['netto_cent'],
           $pdfDatei, $tabDatei, mb_substr($pdfText, 0, 20000), json_encode($pdfKopf, JSON_UNESCAPED_UNICODE), $id,
       ]);

    return $id;
}

/** Blatt mit den Sendungen: das mit den meisten Zeilen, bevorzugt mit Gewichts- und Betragsspalte. */
function rpBlattWaehlen(array $blaetter): ?int
{
    $bestes = null;
    $besteWertung = -1;
    foreach ($blaetter as $i => $b) {
        if ($b['kopf'] === [] || $b['zeilen'] === []) {
            continue;
        }
        $erkannt = rpSpaltenErkennen($b['kopf'], $b['zeilen']);
        $wertung = count($b['zeilen']) + ($erkannt['gewicht'] >= 0 ? 100000 : 0) + ($erkannt['betrag'] >= 0 ? 10000 : 0);
        if ($wertung > $besteWertung) {
            $besteWertung = $wertung;
            $bestes = $i;
        }
    }

    return $bestes;
}

/** Nettosumme aus einem Zusammenfassungsblatt („Total …“-Zeile, größter Betrag). */
function rpSummeAusTabelle(array $blaetter): int
{
    $max = 0;
    foreach ($blaetter as $b) {
        foreach ($b['zeilen'] as $z) {
            if (preg_match('/\b(total|gesamt|summe|netto)\b/i', implode(' ', $z))) {
                foreach ($z as $wert) {
                    if (preg_match('/^-?\d[\d.,]*$/', trim($wert))) {
                        $max = max($max, (int) round(rpZahl($wert) * 100));
                    }
                }
            }
        }
    }

    return $max;
}

/** Tabelle einer Rechnung: alle Blätter plus das gewählte als 'blatt'. */
function rpRechnungTabelle(array $rechnung, string $blattName = ''): array
{
    $datei = rpVerzeichnis() . '/' . $rechnung['datei_csv'];
    $tabelle = is_file($datei) ? tabelleLesen($datei, (string) $rechnung['datei_csv']) : ['art' => 'csv', 'blaetter' => []];
    $gewuenscht = $blattName !== '' ? $blattName : (string) ($rechnung['blatt'] ?? '');
    $index = null;
    foreach ($tabelle['blaetter'] as $i => $b) {
        if ($b['name'] === $gewuenscht) {
            $index = $i;
        }
    }
    $index ??= rpBlattWaehlen($tabelle['blaetter']) ?? 0;
    $tabelle['index'] = $index;
    $tabelle['blatt'] = $tabelle['blaetter'][$index] ?? ['name' => '', 'kopf' => [], 'zeilen' => [], 'trenner' => ';'];

    return $tabelle;
}

/** Zuschlagsblatt: Schlüsselspalte (Sendungsnummer/Referenz) und Betragsspalten erkennen. */
function rpZuschlagErkennen(array $blatt, array $schluesselWerte): ?array
{
    if ($blatt['kopf'] === [] || $blatt['zeilen'] === []) {
        return null;
    }
    $treffer = [];
    foreach ($blatt['kopf'] as $i => $_) {
        $n = 0;
        foreach (array_slice($blatt['zeilen'], 0, 200) as $z) {
            if (isset($schluesselWerte[trim((string) ($z[$i] ?? ''))])) {
                $n++;
            }
        }
        if ($n > 0) {
            $treffer[$i] = $n;
        }
    }
    if ($treffer === []) {
        return null;
    }
    arsort($treffer);
    $schluessel = (int) array_key_first($treffer);
    $betraege = [];
    foreach ($blatt['kopf'] as $i => $name) {
        if ($i !== $schluessel && preg_match('/zuschlag|surcharge|fuel|energy|energie|maut|toll|fee|gebühr|gebuehr/i', $name) && !preg_match('/delivery\s*fee|porto|basis|base|freight/i', $name)) {
            $betraege[] = $i;
        }
    }

    return ['schluessel' => $schluessel, 'betraege' => $betraege];
}

/** Zuordnung übernehmen, Positionen (neu) einlesen und prüfen. */
function rpPositionenImportieren(array $rechnung, array $spalten, string $einheit, string $blattName = '', string $zuschlagBlatt = ''): int
{
    if (($spalten['referenz'] ?? -1) < 0 && ($spalten['sendungsnummer'] ?? -1) < 0) {
        throw new InvalidArgumentException('Bitte mindestens die Spalte mit unserer Sendungsnummer oder der Carrier-Sendungsnummer zuordnen.');
    }
    if (($spalten['gewicht'] ?? -1) < 0 || ($spalten['betrag'] ?? -1) < 0) {
        throw new InvalidArgumentException('Gewicht und Betrag müssen zugeordnet sein — ohne sie gibt es nichts zu prüfen.');
    }
    $tabelle = rpRechnungTabelle($rechnung, $blattName);
    $csv = $tabelle['blatt'];
    $wert = static fn (array $z, string $feld): string => ($spalten[$feld] ?? -1) >= 0 ? (string) ($z[$spalten[$feld]] ?? '') : '';
    // Zuschläge aus einem anderen Blatt je Sendungsnummer/Referenz zusammenrechnen
    $zuschlaege = [];
    $zuschlagInfo = null;
    if ($zuschlagBlatt !== '' && ($spalten['zuschlag'] ?? -1) < 0) {
        foreach ($tabelle['blaetter'] as $b) {
            if ($b['name'] !== $zuschlagBlatt) {
                continue;
            }
            $schluessel = [];
            foreach ($csv['zeilen'] as $z) {
                foreach (['sendungsnummer', 'referenz'] as $f) {
                    $v = trim($wert($z, $f));
                    if ($v !== '') {
                        $schluessel[$v] = true;
                    }
                }
            }
            $zuschlagInfo = rpZuschlagErkennen($b, $schluessel);
            if ($zuschlagInfo !== null) {
                foreach ($b['zeilen'] as $z) {
                    $k = trim((string) ($z[$zuschlagInfo['schluessel']] ?? ''));
                    foreach ($zuschlagInfo['betraege'] as $bi) {
                        $zuschlaege[$k] = ($zuschlaege[$k] ?? 0) + (int) round(rpZahl((string) ($z[$bi] ?? '')) * 100);
                    }
                }
                $zuschlagInfo['blatt'] = $b['name'];
                $zuschlagInfo['spalten'] = array_map(static fn (int $i): string => (string) ($b['kopf'][$i] ?? ''), $zuschlagInfo['betraege']);
            }
        }
    }
    $db = datenbank();
    $db->beginTransaction();
    try {
        $db->prepare('DELETE FROM lieferantenpositionen WHERE rechnung_id = ?')->execute([$rechnung['id']]);
        $st = $db->prepare('INSERT INTO lieferantenpositionen (rechnung_id, zeile, sendungsnummer, referenz, datum, zielland, gewicht_gramm, betrag_cent, zuschlag_cent, roh_json, befund, nachberechnung_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $n = 0;
        foreach ($csv['zeilen'] as $nr => $z) {
            $referenz = trim($wert($z, 'referenz'));
            if (!preg_match('/NE-\d{4}-[0-9A-F]{8}/i', $referenz, $m)) {
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
            $sendungsnummer = trim($wert($z, 'sendungsnummer'));
            $zuschlag = ($spalten['zuschlag'] ?? -1) >= 0 ? (int) round(rpZahl($wert($z, 'zuschlag')) * 100) : (int) ($zuschlaege[$sendungsnummer] ?? $zuschlaege[$referenz] ?? 0);
            $roh = [];
            foreach ($csv['kopf'] as $i => $name) {
                $roh[$name] = $z[$i] ?? '';
            }
            $st->execute([
                $rechnung['id'], $nr + 2, $sendungsnummer, $referenz, rpDatumNormalisieren($wert($z, 'datum')),
                strtoupper(substr(trim($wert($z, 'zielland')), 0, 2)), $gramm,
                (int) round(rpZahl($wert($z, 'betrag')) * 100), $zuschlag,
                json_encode($roh, JSON_UNESCAPED_UNICODE), 'nicht_zugeordnet', 'keine',
            ]);
            $n++;
        }
        $db->prepare("UPDATE lieferantenrechnungen SET spalten_json = ?, gewicht_einheit = ?, blatt = ?, zuschlag_blatt = ?, zuschlag_json = ?, status = 'geprueft', aktualisiert = ? WHERE id = ?")
           ->execute([json_encode($spalten), $einheit, $csv['name'], $zuschlagInfo !== null ? $zuschlagBlatt : '', json_encode($zuschlagInfo ?? new stdClass(), JSON_UNESCAPED_UNICODE), jetzt(), $rechnung['id']]);
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

/** Angebot eines bestimmten Carriers für eine Zelle (Einkauf/Verkauf) — mit Kundenpreisliste deren Verkaufspreis; sonst null. */
function rpAngebot(string $land, string $gk, string $carrier, ?int $preislisteId = null): ?array
{
    foreach (angeboteFuer($land, $gk, $preislisteId) as $a) {
        if (strcasecmp($a['carrier'], $carrier) === 0) {
            return $a;
        }
    }
    if ($preislisteId !== null) {
        // Liste bietet die Zelle nicht an („fehlend = nicht“) — dann zählt trotzdem der Standard
        foreach (angeboteFuer($land, $gk) as $a) {
            if (strcasecmp($a['carrier'], $carrier) === 0) {
                return $a;
            }
        }
    }

    return null;
}

/** Gewichtsdifferenz-Gebühr des Carriers (Cent) aus der Carrier-Tabelle. */
function rpCarrierGebuehr(string $carrier): int
{
    static $cache = [];
    $k = mb_strtolower($carrier);
    if (!isset($cache[$k])) {
        $st = datenbank()->prepare('SELECT gewichtsgebuehr_cent FROM carrier WHERE lower(name) = ?');
        $st->execute([$k]);
        $cache[$k] = max(0, (int) $st->fetchColumn());
    }

    return $cache[$k];
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
            $st = $db->prepare("SELECT * FROM bestellungen WHERE carrier_sendungsnummer = ? AND carrier_sendungsnummer <> '' ORDER BY id LIMIT 1");
            $st->execute([$p['sendungsnummer']]);
            $b = $st->fetch() ?: null;
        }
        if ($b === null && $p['referenz'] !== '') {
            // Kundenreferenz (eigene Auftragsnummer) oder Carrier-Nummer in der Referenzspalte
            $st = $db->prepare("SELECT * FROM bestellungen WHERE (referenz = ? AND referenz <> '') OR (carrier_sendungsnummer = ? AND carrier_sendungsnummer <> '') ORDER BY id DESC LIMIT 1");
            $st->execute([$p['referenz'], $p['referenz']]);
            $b = $st->fetch() ?: null;
        }
        $e = rpPositionBewerten($p, $b, (string) $rechnung['carrier'], $gesehen);
        $db->prepare('UPDATE lieferantenpositionen SET bestellung_id = ?, gk_bestellt = ?, gk_ist = ?, einkauf_soll_cent = ?, differenz_cent = ?, verkauf_bestellt_cent = ?, verkauf_ist_cent = ?, nachberechnung_cent = ?, nachberechnung_status = ?, befund = ?, hinweis = ?, gebuehr_cent = ? WHERE id = ?')
           ->execute([$b['id'] ?? null, $e['gk_bestellt'], $e['gk_ist'], $e['einkauf_soll'], $e['differenz'], $e['verkauf_bestellt'], $e['verkauf_ist'], $e['nachberechnung'], $e['nachberechnung_status'], $e['befund'], $e['hinweis'], $e['gebuehr'], $p['id']]);
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
    $e = ['gk_bestellt' => '', 'gk_ist' => '', 'einkauf_soll' => 0, 'differenz' => 0, 'verkauf_bestellt' => 0, 'verkauf_ist' => 0, 'nachberechnung' => 0, 'nachberechnung_status' => 'keine', 'befund' => 'nicht_zugeordnet', 'hinweis' => '', 'gebuehr' => 0];
    $betrag = (int) $p['betrag_cent'];
    if ($b === null) {
        $e['hinweis'] = $p['referenz'] !== '' ? 'Referenz ' . $p['referenz'] . ($p['sendungsnummer'] !== '' ? ' / Carrier-Nr. ' . $p['sendungsnummer'] : '') . ' passt zu keiner Bestellung.' : ($p['sendungsnummer'] !== '' ? 'Carrier-Nr. ' . $p['sendungsnummer'] . ' ist keiner Bestellung zugeordnet.' : 'Keine Sendungsnummer in der Zeile.');

        return $e;
    }
    $e['gk_bestellt'] = (string) $b['gewichtsklasse'];
    $e['verkauf_bestellt'] = (int) $b['netto_cent'] - (int) $b['zusatz_cent'];
    $e['einkauf_soll'] = (int) $b['einkauf_cent'];
    $land = (string) $b['zielland'];
    // Verkaufspreise mit den Konditionen des Kunden (Preisliste der Bestellung, sonst aktuelle Liste, sonst Standard)
    $preislisteId = preislisteFuerBestellung($b);
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
    // Sicherheitsnetz: zu dieser Sendung gibt es schon eine Nachberechnung (andere Rechnung, gelöschte Rechnung) → nie doppelt nachberechnen
    $st = datenbank()->prepare("SELECT ext_ref FROM bestellungen WHERE nachberechnung_zu = ? AND art = 'nachberechnung' AND status <> 'storniert' AND (? = 0 OR id <> ?) LIMIT 1");
    $st->execute([$b['id'], (int) ($p['nachberechnung_bestellung_id'] ?? 0), (int) ($p['nachberechnung_bestellung_id'] ?? 0)]);
    $vorhanden = $st->fetchColumn();
    if ($vorhanden !== false) {
        $e['befund'] = 'doppelt';
        $e['differenz'] = $betrag;
        $e['hinweis'] = 'Zu dieser Sendung wurde schon nachberechnet (' . $vorhanden . ').';

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
    $carrierName = $carrier !== '' ? $carrier : (string) $b['carrier'];
    $angebotIst = rpAngebot($land, $gkIst, $carrierName, $preislisteId) ?? rpAngebot($land, $gkIst, (string) $b['carrier'], $preislisteId);
    $angebotSoll = rpAngebot($land, $e['gk_bestellt'], $carrierName, $preislisteId) ?? rpAngebot($land, $e['gk_bestellt'], (string) $b['carrier'], $preislisteId);
    if ($rangIst > $rangSoll) {
        $e['befund'] = 'gewicht_hoeher';
        $einkaufIst = $angebotIst['einkauf'] ?? null;
        $e['verkauf_ist'] = (int) ($angebotIst['netto'] ?? 0);
        $e['differenz'] = $einkaufIst !== null ? $betrag - (int) $einkaufIst : 0;
        // Gebühr des Carriers für die Abweichung nur weitergeben, wenn er sie tatsächlich berechnet hat (Zuschlag in der Zeile)
        $e['gebuehr'] = (int) $p['zuschlag_cent'] > 0 ? min((int) $p['zuschlag_cent'], rpCarrierGebuehr($carrierName)) : 0;
        if ($e['verkauf_ist'] > 0) {
            $e['nachberechnung'] = max(0, $e['verkauf_ist'] - $e['verkauf_bestellt']) + ($e['verkauf_ist'] > $e['verkauf_bestellt'] ? $e['gebuehr'] : 0);
            $e['nachberechnung_status'] = $e['nachberechnung'] > 0 ? 'offen' : 'keine';
        } else {
            $hinweise[] = 'Für ' . $gkIst . ' gibt es keinen Verkaufspreis in der Routingmatrix — Nachberechnung bitte manuell.';
        }
        $hinweise[] = 'Gebucht ' . $e['gk_bestellt'] . ' (' . number_format((int) $b['gewicht_gramm'] / 1000, 2, ',', '') . ' kg), gewogen ' . number_format($gramm / 1000, 2, ',', '') . ' kg → ' . $gkIst . ($preislisteId !== null ? ' (Kundenpreisliste)' : '') . '.';
        if ($e['gebuehr'] > 0) {
            $hinweise[] = 'Carrier-Gebühr für die Abweichung ' . euro($e['gebuehr']) . ' wird weitergegeben.';
        }
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
        $zusatzCodes = array_column(json_decode((string) ($b['zusatz_json'] ?? '[]'), true) ?: [], 'code');
        $hinweise[] = 'Zuschläge ' . euro((int) $p['zuschlag_cent']) . ' zusätzlich berechnet' . (in_array('sperrgut', $zusatzCodes, true) ? ' (Sperrgut war gebucht — erwartet)' : '') . '.';
    }
    $e['hinweis'] = implode(' ', $hinweise);

    return $e;
}

/**
 * Nachberechnungen ohne Freigabe buchen, wenn alle Regeln der Konfiguration
 * (rechnungspruefung.auto) erfüllt sind. Alles andere bleibt „offen“ für das
 * Team; der Grund steht im Hinweis. Liefert ['gebucht', 'netto', 'uebersprungen'].
 */
function rpAutomatischBuchen(int $rechnungId, string $von = 'auto'): array
{
    $regeln = (array) (konfig()['rechnungspruefung']['auto'] ?? []);
    $aus = ['gebucht' => 0, 'netto' => 0, 'uebersprungen' => 0];
    if (empty($regeln['aktiv'])) {
        return $aus;
    }
    $rechnung = rpRechnungLaden($rechnungId);
    if ($rechnung === null) {
        return $aus;
    }
    $db = datenbank();
    $jeKunde = [];
    foreach (rpPositionen($rechnungId) as $p) {
        if ($p['nachberechnung_status'] !== 'offen' || (int) $p['nachberechnung_cent'] <= 0 || $p['befund'] !== 'gewicht_hoeher' || (int) ($p['manuell'] ?? 0) === 1) {
            continue;
        }
        $b = bestellungLaden('id', (string) $p['bestellung_id']);
        if ($b === null) {
            continue;
        }
        $grund = '';
        $diff = (int) $p['gewicht_gramm'] - (int) $b['gewicht_gramm'];
        $prozent = (int) $b['gewicht_gramm'] > 0 ? $diff / (int) $b['gewicht_gramm'] * 100 : 100;
        $schluessel = $b['firma_id'] ? 'f' . $b['firma_id'] : ('k' . ($b['kunde_id'] ?: $b['email']));
        $jeKunde[$schluessel] = ($jeKunde[$schluessel] ?? 0) + (int) $p['nachberechnung_cent'];
        if ((int) $b['gewicht_gramm'] <= 0) {
            $grund = 'kein Gewicht an der Bestellung';
        } elseif ($diff < (int) ($regeln['mindestGramm'] ?? 500) || $prozent < (float) ($regeln['mindestProzent'] ?? 10)) {
            $grund = 'Differenz unter ' . (int) ($regeln['mindestGramm'] ?? 500) . ' g bzw. ' . (int) ($regeln['mindestProzent'] ?? 10) . ' %';
        } elseif ((int) $p['nachberechnung_cent'] <= (int) ($regeln['bagatelleCent'] ?? 100)) {
            $grund = 'Bagatelle';
        } elseif ((int) $p['nachberechnung_cent'] > (int) ($regeln['maxPositionCent'] ?? 5000)) {
            $grund = 'über ' . euro((int) ($regeln['maxPositionCent'] ?? 5000)) . ' je Position';
        } elseif ($jeKunde[$schluessel] > (int) ($regeln['maxKundeCent'] ?? 20000)) {
            $grund = 'über ' . euro((int) ($regeln['maxKundeCent'] ?? 20000)) . ' je Kunde auf dieser Rechnung';
        } elseif (str_contains((string) $p['hinweis'], 'abgerechnet von')) {
            $grund = 'Carrier weicht von der Bestellung ab';
        }
        if ($grund !== '') {
            $aus['uebersprungen']++;
            if (!str_contains((string) $p['hinweis'], 'Freigabe nötig')) {
                $db->prepare('UPDATE lieferantenpositionen SET hinweis = ? WHERE id = ?')->execute([trim($p['hinweis'] . ' Freigabe nötig: ' . $grund . '.'), $p['id']]);
            }
            continue;
        }
        try {
            $p['rechnung_nummer'] = $rechnung['nummer'];
            rpNachberechnungBuchen($p, $von);
            $aus['gebucht']++;
            $aus['netto'] += (int) $p['nachberechnung_cent'];
        } catch (Throwable $e) {
            error_log('[rechnungspruefung] Automatik Position ' . $p['id'] . ': ' . $e->getMessage());
            $aus['uebersprungen']++;
        }
    }

    return $aus;
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
    $gebuehr = $betragCent === null ? (int) ($p['gebuehr_cent'] ?? 0) : 0;
    // „lieferantenrechnung“ und „position“ sind interne Bezüge — sie erscheinen in keinem Kundendokument.
    $grund = ['original' => $b['ext_ref'], 'gewicht_gramm' => (int) $p['gewicht_gramm'], 'gk_bestellt' => $p['gk_bestellt'], 'gk_ist' => $p['gk_ist'],
        'verkauf_bestellt' => (int) $p['verkauf_bestellt_cent'], 'verkauf_ist' => (int) $p['verkauf_ist_cent'], 'gebuehr' => $gebuehr,
        'preisliste_id' => preislisteFuerBestellung($b), 'carrier' => (string) $b['carrier'],
        'lieferantenrechnung' => $p['rechnung_nummer'] ?? '', 'position' => (int) $p['id']];
    $ereignis = ['zeit' => jetzt(), 'ereignis' => 'nachberechnung', 'status' => $status, 'von' => $von, 'grund' => $grund];
    $db->prepare(<<<'SQL'
        INSERT INTO bestellungen
            (ext_ref, status, netto_cent, mwst_cent, betrag_cent, waehrung, zielland, gewichtsklasse, carrier, einkauf_cent,
             email, sprache, absender_json, empfaenger_json, ereignisse_json, erstellt, aktualisiert,
             kunde_id, firma_id, zahlungsart, referenz, art, gewicht_gramm, versandstatus, nachberechnung_zu, nachberechnung_json, preisliste_id)
        VALUES (:ref, :status, :netto, :mwst, :brutto, 'EUR', :land, :gk, :carrier, 0, :email, :sprache, :abs, :emp, :ev, :t, :t,
             :kunde, :firma, :zahlungsart, :referenz, 'nachberechnung', :gewicht, 'zugestellt', :zu, :grund, :liste)
    SQL)->execute([
        ':ref' => $extRef, ':status' => $status, ':netto' => $netto, ':mwst' => $brutto - $netto, ':brutto' => $brutto,
        ':land' => $b['zielland'], ':gk' => $p['gk_ist'] ?: $b['gewichtsklasse'], ':carrier' => $b['carrier'], ':email' => $b['email'], ':sprache' => $b['sprache'],
        ':abs' => $b['absender_json'], ':emp' => $b['empfaenger_json'], ':ev' => json_encode([$ereignis], JSON_UNESCAPED_UNICODE), ':t' => jetzt(),
        ':kunde' => $b['kunde_id'], ':firma' => $b['firma_id'], ':zahlungsart' => $zahlungsart, ':referenz' => 'Nachberechnung ' . $b['ext_ref'],
        ':gewicht' => (int) $p['gewicht_gramm'], ':zu' => $b['id'], ':grund' => json_encode($grund, JSON_UNESCAPED_UNICODE), ':liste' => $grund['preisliste_id'],
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
    // Nachweis (PDF) für den Kunden — ohne Lieferantenangaben
    try {
        nachberechnungNachweisErzeugen($neu, bestellungLaden('id', (string) $b['id']) ?? $b);
    } catch (Throwable $e) {
        error_log('[rechnungspruefung] Nachweis: ' . $e->getMessage());
    }
    // Vom Guthaben bezahlt → Rechnung sofort über Lexware; Revolut → nach Zahlung; Firma → Sammelrechnung
    if ($zahlungsart === 'guthaben') {
        lexwareAuftragAnlegen('rechnung', 'bestellungen', (int) $neu['id']);
        lexwareAuftraegeAbarbeiten(3);
    }
    $neu = bestellungLaden('ext_ref', $extRef) ?? $neu;
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

/**
 * Nachberechnung zurücknehmen (Widerspruch anerkannt): Status storniert,
 * bezahlte Beträge als Guthaben zurück, Lexware-Gutschrift zur Rechnung,
 * Position wieder „verzichtet“. Idempotent.
 */
function rpNachberechnungStornieren(array $nb, string $von, string $grund = ''): void
{
    if (($nb['art'] ?? '') !== 'nachberechnung' || $nb['status'] === 'storniert') {
        return;
    }
    $db = datenbank();
    $kunde = ['id' => (int) ($nb['kunde_id'] ?? 0), 'art' => $nb['firma_id'] ? 'business' : 'privat', 'firma_id' => $nb['firma_id']];
    $bezahlt = in_array($nb['status'], ['bezahlt', 'beauftragt'], true);
    if ($bezahlt && $nb['zahlungsart'] === 'guthaben') {
        guthabenBuchen($kunde, 'erstattung', (int) $nb['betrag_cent'], 'Nachberechnung ' . $nb['ext_ref'] . ' zurückgenommen', (int) $nb['id']);
    } elseif ($bezahlt && $nb['zahlungsart'] === 'revolut') {
        guthabenBuchen($kunde, 'erstattung', (int) $nb['betrag_cent'], 'Nachberechnung ' . $nb['ext_ref'] . ' zurückgenommen (Erstattung als Guthaben)', (int) $nb['id']);
    } elseif ($bezahlt && $nb['zahlungsart'] === 'rechnung' && $nb['rechnung_id']) {
        guthabenBuchen($kunde, 'erstattung', (int) $nb['netto_cent'], 'Nachberechnung ' . $nb['ext_ref'] . ' zurückgenommen (bereits abgerechnet)', (int) $nb['id']);
    }
    if ((string) ($nb['lexware_id'] ?? '') !== '' || ($nb['rechnung_id'] && $nb['zahlungsart'] === 'rechnung')) {
        lexwareAuftragAnlegen('gutschrift', 'bestellungen', (int) $nb['id'], ['grund' => $grund]);
    }
    bestellungFortschreiben($nb, 'storniert', 'nachberechnung.storniert', ['von' => $von, 'grund' => $grund]);
    $db->prepare("UPDATE lieferantenpositionen SET nachberechnung_status = 'verzichtet' WHERE nachberechnung_bestellung_id = ?")->execute([$nb['id']]);
    if ($nb['nachberechnung_zu']) {
        $orig = bestellungLaden('id', (string) $nb['nachberechnung_zu']);
        if ($orig !== null) {
            $ereignisse = json_decode((string) $orig['ereignisse_json'], true) ?: [];
            $ereignisse[] = ['zeit' => jetzt(), 'ereignis' => 'nachberechnung.storniert', 'status' => $orig['status'], 'von' => $von, 'nachberechnung' => $nb['ext_ref']];
            $db->prepare('UPDATE bestellungen SET ereignisse_json = ?, aktualisiert = ? WHERE id = ?')->execute([json_encode($ereignisse, JSON_UNESCAPED_UNICODE), jetzt(), $orig['id']]);
        }
    }
    lexwareAuftraegeAbarbeiten(3);
}

/** Erinnerung an offene Nachberechnungen (Revolut) nach erinnerungTage; liefert die Zahl der Mails. */
function rpErinnerungenSenden(): int
{
    $tage = (int) (konfig()['rechnungspruefung']['erinnerungTage'] ?? 14);
    if ($tage <= 0) {
        return 0;
    }
    $db = datenbank();
    $st = $db->prepare("SELECT * FROM bestellungen WHERE art = 'nachberechnung' AND zahlungsart = 'revolut' AND status IN ('offen','angelegt','fehlgeschlagen') AND erinnert IS NULL AND erstellt < ? ORDER BY id");
    $st->execute([gmdate('Y-m-d\TH:i:s\Z', time() - $tage * 86400)]);
    $n = 0;
    foreach ($st->fetchAll() as $nb) {
        $orig = $nb['nachberechnung_zu'] ? bestellungLaden('id', (string) $nb['nachberechnung_zu']) : null;
        try {
            rpErinnerungMail($nb, $orig);
            $db->prepare('UPDATE bestellungen SET erinnert = ?, aktualisiert = ? WHERE id = ?')->execute([jetzt(), jetzt(), $nb['id']]);
            $ereignisse = json_decode((string) $nb['ereignisse_json'], true) ?: [];
            $ereignisse[] = ['zeit' => jetzt(), 'ereignis' => 'nachberechnung.erinnert', 'status' => $nb['status']];
            $db->prepare('UPDATE bestellungen SET ereignisse_json = ? WHERE id = ?')->execute([json_encode($ereignisse, JSON_UNESCAPED_UNICODE), $nb['id']]);
            $n++;
        } catch (Throwable $e) {
            error_log('[rechnungspruefung] Erinnerung ' . $nb['ext_ref'] . ': ' . $e->getMessage());
        }
    }

    return $n;
}

function rpErinnerungMail(array $nb, ?array $original): void
{
    $sprache = $nb['sprache'] === 'en' ? 'en' : 'de';
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $abs = json_decode((string) $nb['absender_json'], true) ?: [];
    $orig = (string) ($original['ext_ref'] ?? '');
    $link = $basis . '/konto/bestellungen/' . $nb['ext_ref'] . '/bezahlen' . ($sprache === 'en' ? '?sprache=en' : '');
    $anhaenge = nachberechnungNachweisPfad($nb) !== '' ? [['name' => 'NEOS-Nachweis-' . $nb['ext_ref'] . '.pdf', 'datei' => nachberechnungNachweisPfad($nb)]] : [];
    if ($sprache === 'en') {
        $betreff = 'Reminder: weight adjustment for NEOS shipment ' . $orig . ' is still open';
        $text = "Hello " . ($abs['name'] ?? '') . ",\n\nthe weight adjustment for shipment " . $orig . ' (' . betragFormat((int) $nb['betrag_cent'], 'en') . ") is still open.\n\nPlease settle it in the portal: " . $link . "\n\nThe record explaining the adjustment is attached. If you disagree, you can object in the portal.\n\nNEOS Logistics UG · info@neos24.com";
    } else {
        $betreff = 'Erinnerung: Gewichtsnachberechnung zu NEOS-Sendung ' . $orig . ' ist noch offen';
        $text = "Hallo " . ($abs['name'] ?? '') . ",\n\ndie Gewichtsnachberechnung zur Sendung " . $orig . ' (' . betragFormat((int) $nb['betrag_cent'], 'de') . ") ist noch offen.\n\nBitte begleiche sie im Portal: " . $link . "\n\nDer Nachweis zur Nachberechnung hängt an. Wenn du anderer Meinung bist, kannst du im Portal widersprechen.\n\nNEOS Logistics UG · info@neos24.com";
    }
    mailSenden((string) $nb['email'], $betreff, $text, $anhaenge);
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

/**
 * Mail zur Nachberechnung — nennt weder Lieferant noch Lieferantenrechnung,
 * nur den Carrier als denjenigen, der gewogen hat. Anhang: Nachweis (PDF) und,
 * sobald vorhanden, die Rechnung aus Lexware.
 */
function rpNachberechnungMail(array $neu, array $original, array $grund): void
{
    $sprache = $neu['sprache'] === 'en' ? 'en' : 'de';
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $abs = json_decode((string) $original['absender_json'], true) ?: [];
    $pfad = $neu['firma_id'] ? 'sendungen' : 'bestellungen';
    $kg = number_format((int) $grund['gewicht_gramm'] / 1000, 2, $sprache === 'en' ? '.' : ',', '');
    $frist = (int) (konfig()['rechnungspruefung']['widerspruchTage'] ?? 14);
    $gebuehr = (int) ($grund['gebuehr'] ?? 0);
    $anhaenge = [];
    if (nachberechnungNachweisPfad($neu) !== '') {
        $anhaenge[] = ['name' => 'NEOS-Nachweis-' . $neu['ext_ref'] . '.pdf', 'datei' => nachberechnungNachweisPfad($neu)];
    }
    $rechnungPdf = lexwarePdfPfad((string) ($neu['lexware_id'] ?? ''));
    if ($rechnungPdf !== '' && is_file($rechnungPdf)) {
        $anhaenge[] = ['name' => 'NEOS-Rechnung-' . ($neu['lexware_nummer'] ?: $neu['ext_ref']) . '.pdf', 'datei' => $rechnungPdf];
    }
    if ($sprache === 'en') {
        $betreff = 'Weight adjustment for NEOS shipment ' . $original['ext_ref'];
        $zeilen = ['Hello ' . ($abs['name'] ?? '') . ',', '',
            'the carrier weighed shipment ' . $original['ext_ref'] . ' at ' . $kg . ' kg. It was booked in weight class ' . $grund['gk_bestellt'] . ', the measured weight falls into class ' . $grund['gk_ist'] . '. We charge the difference between the shipping prices of both classes according to your price terms.',
            '', 'Difference net: ' . betragFormat((int) $neu['netto_cent'], 'en') . ($gebuehr > 0 ? ' (incl. carrier fee for the deviation ' . betragFormat($gebuehr, 'en') . ')' : ''), 'Difference incl. VAT: ' . betragFormat((int) $neu['betrag_cent'], 'en'), ''];
        $zeilen[] = match ($neu['zahlungsart']) {
            'rechnung' => 'The amount appears as a separate line on your next collective invoice.',
            'guthaben' => 'The amount has been debited from your NEOS credit.' . ($rechnungPdf !== '' ? ' The invoice is attached.' : ' The invoice follows separately.'),
            default => 'Please settle the amount in the portal: ' . $basis . '/konto/' . $pfad . '/' . $neu['ext_ref'] . '/bezahlen?sprache=en — the invoice follows after payment.',
        };
        array_push($zeilen, '', 'The attached record explains the calculation. If you disagree, you can object in the portal within ' . $frist . ' days: ' . $basis . '/konto/' . $pfad . '/' . $neu['ext_ref'] . '?sprache=en', '', 'Tip: weigh parcels before booking — the class is chosen from the weight you enter.', '', 'NEOS Logistics UG · info@neos24.com');
    } else {
        $betreff = 'Gewichtsnachberechnung zu NEOS-Sendung ' . $original['ext_ref'];
        $zeilen = ['Hallo ' . ($abs['name'] ?? '') . ',', '',
            'der Carrier hat die Sendung ' . $original['ext_ref'] . ' mit ' . $kg . ' kg gewogen. Gebucht war die Gewichtsklasse ' . $grund['gk_bestellt'] . ', das gemessene Gewicht fällt in die Klasse ' . $grund['gk_ist'] . '. Wir berechnen die Differenz der Versandpreise beider Klassen nach deinen Preiskonditionen.',
            '', 'Differenz netto: ' . betragFormat((int) $neu['netto_cent'], 'de') . ($gebuehr > 0 ? ' (inkl. Carrier-Gebühr für die Abweichung ' . betragFormat($gebuehr, 'de') . ')' : ''), 'Differenz inkl. MwSt.: ' . betragFormat((int) $neu['betrag_cent'], 'de'), ''];
        $zeilen[] = match ($neu['zahlungsart']) {
            'rechnung' => 'Der Betrag erscheint als eigene Position auf deiner nächsten Sammelrechnung.',
            'guthaben' => 'Der Betrag wurde von deinem NEOS-Guthaben abgebucht.' . ($rechnungPdf !== '' ? ' Die Rechnung hängt an.' : ' Die Rechnung folgt separat.'),
            default => 'Bitte begleiche den Betrag im Portal: ' . $basis . '/konto/' . $pfad . '/' . $neu['ext_ref'] . '/bezahlen — die Rechnung folgt nach der Zahlung.',
        };
        array_push($zeilen, '', 'Der angehängte Nachweis erklärt die Berechnung. Wenn du anderer Meinung bist, kannst du innerhalb von ' . $frist . ' Tagen im Portal widersprechen: ' . $basis . '/konto/' . $pfad . '/' . $neu['ext_ref'], '', 'Tipp: Pakete vor der Buchung wiegen — die Klasse ergibt sich aus dem eingegebenen Gewicht.', '', 'NEOS Logistics UG · info@neos24.com');
    }
    mailSenden((string) $neu['email'], $betreff, implode("\n", $zeilen), $anhaenge);
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

// ------------------------------------------------------------------ Postfach

/** Carrier-ID zu einer Absenderadresse laut konfig()['postfach']['absender'] (Adresse oder Domain). */
function rpCarrierFuerAbsender(string $email): ?int
{
    $karte = (array) (konfig()['postfach']['absender'] ?? []);
    $domain = substr(strrchr($email, '@') ?: '', 1);
    $name = null;
    foreach ($karte as $schluessel => $carrier) {
        $s = mb_strtolower(trim((string) $schluessel));
        if ($s === $email || ($s !== '' && ($s === $domain || $s === '@' . $domain || str_ends_with($email, $s)))) {
            $name = (string) $carrier;
            break;
        }
    }
    if ($name === null) {
        return null;
    }
    $st = datenbank()->prepare('SELECT id FROM carrier WHERE lower(name) = ?');
    $st->execute([mb_strtolower($name)]);
    $id = $st->fetchColumn();

    return $id !== false ? (int) $id : null;
}

/**
 * Ungelesene Mails aus dem Postfach holen, Carrier-Rechnungen (PDF + CSV/XLSX)
 * anlegen, mit gespeichertem Profil prüfen und die Automatik laufen lassen.
 * Liefert Zähler und ein Protokoll; eine Zusammenfassung geht an konfig()['kopie'].
 */
function rpPostfachVerarbeiten(): array
{
    require_once __DIR__ . '/postfach.php';
    $p = (array) (konfig()['postfach'] ?? []);
    $aus = ['mails' => 0, 'rechnungen' => 0, 'geprueft' => 0, 'uebersprungen' => 0, 'protokoll' => []];
    if ((string) ($p['host'] ?? '') === '') {
        return $aus;
    }
    $imap = new ImapVerbindung((string) $p['host'], (int) ($p['port'] ?? 993), 30, (bool) ($p['tls'] ?? ((int) ($p['port'] ?? 993) !== 143)));
    try {
        $imap->login((string) $p['benutzer'], (string) $p['passwort']);
        $imap->select((string) ($p['ordner'] ?: 'INBOX'));
        foreach ($imap->ungelesen() as $uid) {
            $aus['mails']++;
            $roh = $imap->holen($uid);
            $mail = mimeZerlegen($roh);
            $von = mimeAbsender((string) ($mail['kopf']['from'] ?? ''));
            $betreff = mimeWortDekodieren((string) ($mail['kopf']['subject'] ?? ''));
            $carrierId = rpCarrierFuerAbsender($von);
            if ($carrierId === null) {
                $aus['uebersprungen']++;
                $aus['protokoll'][] = 'übersprungen (Absender ' . $von . ' keinem Carrier zugeordnet): ' . $betreff;
                continue; // bleibt ungelesen, damit das Team sie sieht
            }
            $pdf = null;
            $tabelle = null;
            foreach ($mail['anhaenge'] as $a) {
                $endung = strtolower(pathinfo($a['name'], PATHINFO_EXTENSION));
                if ($pdf === null && ($endung === 'pdf' || str_starts_with($a['inhalt'], '%PDF'))) {
                    $pdf = $a;
                } elseif ($tabelle === null && in_array($endung, ['csv', 'xlsx', 'xlsm', 'txt'], true)) {
                    $tabelle = $a;
                }
            }
            if ($tabelle === null) {
                $aus['uebersprungen']++;
                $aus['protokoll'][] = 'übersprungen (keine CSV/XLSX im Anhang): ' . $betreff;
                $imap->gelesen($uid);
                continue;
            }
            $tmpTab = tempnam(sys_get_temp_dir(), 'neos-tab');
            file_put_contents($tmpTab, $tabelle['inhalt']);
            $tmpPdf = null;
            $nummer = '';
            if ($pdf !== null) {
                $tmpPdf = tempnam(sys_get_temp_dir(), 'neos-pdf');
                file_put_contents($tmpPdf, $pdf['inhalt']);
                $nummer = (string) rpPdfKopfdaten(rpPdfText($tmpPdf))['nummer'];
            }
            try {
                if ($nummer !== '') {
                    $st = datenbank()->prepare('SELECT id FROM lieferantenrechnungen WHERE carrier_id = ? AND nummer = ?');
                    $st->execute([$carrierId, $nummer]);
                    if ($st->fetchColumn() !== false) {
                        $aus['uebersprungen']++;
                        $aus['protokoll'][] = 'übersprungen (Rechnung ' . $nummer . ' schon vorhanden): ' . $betreff;
                        $imap->gelesen($uid);
                        continue;
                    }
                }
                $id = rpRechnungAnlegen($carrierId, ['tabelle' => $tmpTab, 'tabelle_name' => $tabelle['name'], 'pdf' => $tmpPdf], ['nummer' => '', 'datum' => '', 'netto_cent' => 0], 'postfach');
                $aus['rechnungen']++;
                $r = rpRechnungLaden($id);
                $tab = rpRechnungTabelle($r);
                $spalten = rpProfilAnwenden(rpProfilFuerCarrier($carrierId), $tab['blatt']['kopf']);
                $zeile = 'Rechnung #' . $id . ' (' . ($r['nummer'] ?: 'ohne Nummer') . ', ' . euro((int) $r['betrag_netto_cent']) . ') aus „' . $betreff . '“';
                if ($spalten !== null && ($spalten['gewicht'] ?? -1) >= 0 && ($spalten['betrag'] ?? -1) >= 0) {
                    $profil = rpProfilFuerCarrier($carrierId);
                    $n = rpPositionenImportieren($r, $spalten, (string) ($profil['gewicht_einheit'] ?? 'kg'), $tab['blatt']['name'], (string) ($r['zuschlag_blatt'] ?? ''));
                    $z = rpZusammenfassung($id);
                    $auto = rpAutomatischBuchen($id, 'auto (Postfach)');
                    $aus['geprueft']++;
                    $zeile .= ': ' . $n . ' Positionen geprüft, ' . ($z['positionen'] - (int) ($z['befunde']['ok']['n'] ?? 0)) . ' auffällig, Nachberechnung offen ' . euro($z['nachberechnung_offen']) . ', automatisch gebucht ' . $auto['gebucht'] . ' (' . euro($auto['netto']) . '), Beanstandung ' . euro($z['beanstandung']);
                } else {
                    $zeile .= ': Spalten im Dashboard zuordnen (kein Profil für diesen Carrier)';
                }
                $aus['protokoll'][] = $zeile;
                $imap->gelesen($uid);
                if ((string) ($p['erledigtOrdner'] ?? '') !== '') {
                    try {
                        $imap->kopieren($uid, (string) $p['erledigtOrdner']);
                    } catch (Throwable $e) {
                        $aus['protokoll'][] = 'Kopie in ' . $p['erledigtOrdner'] . ' fehlgeschlagen: ' . $e->getMessage();
                    }
                }
            } finally {
                @unlink($tmpTab);
                if ($tmpPdf !== null) {
                    @unlink($tmpPdf);
                }
            }
        }
    } finally {
        $imap->logout();
    }
    $kopie = (string) (konfig()['kopie'] ?? '');
    if ($kopie !== '' && $aus['rechnungen'] > 0) {
        $basis = rtrim((string) konfig()['basisUrl'], '/');
        mailSenden($kopie, 'Rechnungsprüfung: ' . $aus['rechnungen'] . ' Carrier-Rechnung(en) aus dem Postfach', "Aus dem Postfach eingelesen:\n\n" . implode("\n", $aus['protokoll']) . "\n\nDashboard: " . $basis . "/intern/rechnungspruefung\n");
    }

    return $aus;
}
