<?php

/**
 * Statistiken und Berichte: Kennzahlen, Zeitreihen, Auswertung je Dimension
 * und freier Pivot (Zeilen × Spalten × Kennzahl) über Bestellungen,
 * Rechnungen, Reklamationen, Guthaben und Sendungsereignisse.
 *
 * Datenbasis: bestellungen mit Status bezahlt/beauftragt (storniert und
 * offen zählen nur in den Status-Auswertungen), Datum = erstellt.
 * Umsatz = netto_cent, Einkauf = einkauf_ist_cent (Ist, sonst Routing),
 * Marge = Umsatz − Einkauf. Sendungen = art sendung + retoure,
 * Nachberechnungen zählen zum Umsatz, nicht zu den Sendungen.
 */

declare(strict_types=1);

const STATISTIK_ZEITRAEUME = ['30' => 'Letzte 30 Tage', '90' => 'Letzte 90 Tage', 'monat' => 'Dieser Monat', 'vormonat' => 'Vormonat', 'quartal' => 'Dieses Quartal', 'jahr' => 'Dieses Jahr', '365' => 'Letzte 12 Monate', 'frei' => 'Von – bis'];

/** Dimensionen für Auswertungen und Pivot: Schlüssel => [Name, SQL-Ausdruck]. */
const STATISTIK_DIMENSIONEN = [
    'monat' => 'Monat',
    'woche' => 'Kalenderwoche',
    'tag' => 'Tag',
    'wochentag' => 'Wochentag',
    'carrier' => 'Carrier',
    'zielland' => 'Zielland',
    'kunde' => 'Kunde',
    'unterkunde' => 'Unterkunde',
    'kundenart' => 'Kundenart',
    'zahlungsart' => 'Zahlungsart',
    'gewichtsklasse' => 'Gewichtsklasse',
    'kategorie' => 'Kategorie',
    'art' => 'Auftragsart',
    'status' => 'Status',
    'versandstatus' => 'Versandstatus',
    'preisliste' => 'Preisliste',
];

/** Kennzahlen: Schlüssel => [Name, Format (anzahl|euro|prozent|tage)]. */
const STATISTIK_KENNZAHLEN = [
    'sendungen' => ['Sendungen', 'anzahl'],
    'umsatz' => ['Umsatz netto', 'euro'],
    'brutto' => ['Umsatz brutto', 'euro'],
    'einkauf' => ['Einkauf', 'euro'],
    'marge' => ['Marge', 'euro'],
    'marge_prozent' => ['Marge %', 'prozent'],
    'durchschnitt' => ['Ø Netto je Sendung', 'euro'],
    'gewicht' => ['Ø Gewicht (kg)', 'kg'],
    'retouren' => ['Retouren', 'anzahl'],
    'nachberechnungen' => ['Nachberechnungen', 'anzahl'],
    'nachberechnung_summe' => ['Nachberechnungen €', 'euro'],
    'storniert' => ['Storniert', 'anzahl'],
    'zugestellt_quote' => ['Zustellquote', 'prozent'],
    'laufzeit' => ['Ø Laufzeit (Tage)', 'tage'],
    'reklamationen' => ['Reklamationen', 'anzahl'],
    'reklamationsquote' => ['Reklamationsquote', 'prozent'],
];

/**
 * Filter aus GET/POST lesen: zeitraum, von, bis, vergleich, firma, kunde,
 * carrier, land, zahlungsart, art. Liefert normalisierte Werte und den
 * Zeitraum als [von, bis) sowie die Vorperiode.
 */
function statistikFilter(array $q): array
{
    $zeitraum = isset(STATISTIK_ZEITRAEUME[$q['zeitraum'] ?? '']) ? (string) $q['zeitraum'] : '30';
    $heute = gmdate('Y-m-d');
    $morgen = gmdate('Y-m-d', time() + 86400);
    switch ($zeitraum) {
        case 'monat': $von = gmdate('Y-m-01'); $bis = $morgen; break;
        case 'vormonat': $von = gmdate('Y-m-01', strtotime('first day of last month')); $bis = gmdate('Y-m-01'); break;
        case 'quartal': $q1 = (int) floor(((int) gmdate('n') - 1) / 3) * 3 + 1; $von = gmdate('Y') . '-' . str_pad((string) $q1, 2, '0', STR_PAD_LEFT) . '-01'; $bis = $morgen; break;
        case 'jahr': $von = gmdate('Y-01-01'); $bis = $morgen; break;
        case 'frei':
            $von = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($q['von'] ?? '')) ? (string) $q['von'] : gmdate('Y-m-d', time() - 30 * 86400);
            $bisTag = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($q['bis'] ?? '')) ? (string) $q['bis'] : $heute;
            if ($bisTag < $von) { $bisTag = $von; }
            $bis = gmdate('Y-m-d', strtotime($bisTag) + 86400);
            break;
        default: $von = gmdate('Y-m-d', time() - ((int) $zeitraum - 1) * 86400); $bis = $morgen;
    }
    $tage = max(1, (int) round((strtotime($bis) - strtotime($von)) / 86400));
    $vorVon = gmdate('Y-m-d', strtotime($von) - $tage * 86400);
    $f = [
        'zeitraum' => $zeitraum, 'von' => $von, 'bis' => $bis, 'bis_anzeige' => gmdate('Y-m-d', strtotime($bis) - 86400), 'tage' => $tage,
        'vor_von' => $vorVon, 'vor_bis' => $von, 'vergleich' => !empty($q['vergleich']),
        'firma' => (int) ($q['firma'] ?? 0), 'kunde' => (int) ($q['kunde'] ?? 0), 'unterkunde' => (int) ($q['unterkunde'] ?? 0),
        'carrier' => saeubern($q['carrier'] ?? '', 60), 'land' => strtoupper(saeubern($q['land'] ?? '', 2)), 'zahlungsart' => in_array($q['zahlungsart'] ?? '', ['revolut', 'guthaben', 'rechnung'], true) ? (string) $q['zahlungsart'] : '',
        'art' => in_array($q['art'] ?? '', ['sendung', 'retoure', 'nachberechnung'], true) ? (string) $q['art'] : '',
    ];
    $f['granularitaet'] = $tage <= 31 ? 'tag' : ($tage <= 120 ? 'woche' : 'monat');

    return $f;
}

/** Filter als Query-Array (für Links und Exporte). */
function statistikQuery(array $f, array $mehr = []): array
{
    $q = ['zeitraum' => $f['zeitraum']];
    if ($f['zeitraum'] === 'frei') { $q['von'] = $f['von']; $q['bis'] = $f['bis_anzeige']; }
    if ($f['vergleich']) { $q['vergleich'] = 1; }
    foreach (['firma', 'kunde', 'unterkunde', 'carrier', 'land', 'zahlungsart', 'art'] as $k) {
        if ($f[$k] !== '' && $f[$k] !== 0) { $q[$k] = $f[$k]; }
    }

    return $q + $mehr;
}

/** WHERE-Teil für Bestellungen (Alias b) ohne Zeitraum; $gueltig: nur bezahlt/beauftragt. */
function statistikWo(array $f, bool $gueltig = true, bool $mitArt = true): array
{
    $wo = ['1 = 1'];
    $w = [];
    if ($gueltig) { $wo[] = "b.status IN ('bezahlt', 'beauftragt')"; }
    if ($f['firma'] > 0) { $wo[] = 'b.firma_id = ?'; $w[] = $f['firma']; }
    if ($f['kunde'] > 0) { $wo[] = 'b.kunde_id = ?'; $w[] = $f['kunde']; }
    if ($f['unterkunde'] > 0) { $wo[] = 'b.unterkunde_id = ?'; $w[] = $f['unterkunde']; }
    if ($f['carrier'] !== '') { $wo[] = 'b.carrier = ?'; $w[] = $f['carrier']; }
    if ($f['land'] !== '') { $wo[] = 'b.zielland = ?'; $w[] = $f['land']; }
    if ($f['zahlungsart'] !== '') { $wo[] = 'b.zahlungsart = ?'; $w[] = $f['zahlungsart']; }
    if ($mitArt && $f['art'] !== '') { $wo[] = 'b.art = ?'; $w[] = $f['art']; }

    return [implode(' AND ', $wo), $w];
}

/** SELECT-Ausdrücke der Kennzahlen (Aggregat über Bestellungen b). */
function statistikAggregate(): string
{
    return <<<'SQL'
        SUM(CASE WHEN b.art IN ('sendung', 'retoure') THEN 1 ELSE 0 END) AS sendungen,
        COALESCE(SUM(b.netto_cent), 0) AS umsatz,
        COALESCE(SUM(b.betrag_cent), 0) AS brutto,
        COALESCE(SUM(CASE WHEN b.einkauf_ist_cent > 0 THEN b.einkauf_ist_cent ELSE b.einkauf_cent END), 0) AS einkauf,
        SUM(CASE WHEN b.art = 'retoure' THEN 1 ELSE 0 END) AS retouren,
        SUM(CASE WHEN b.art = 'nachberechnung' THEN 1 ELSE 0 END) AS nachberechnungen,
        COALESCE(SUM(CASE WHEN b.art = 'nachberechnung' THEN b.netto_cent ELSE 0 END), 0) AS nachberechnung_summe,
        COALESCE(SUM(CASE WHEN b.art IN ('sendung', 'retoure') THEN b.gewicht_gramm ELSE 0 END), 0) AS gewicht_summe,
        SUM(CASE WHEN b.art IN ('sendung', 'retoure') AND b.versandstatus = 'zugestellt' THEN 1 ELSE 0 END) AS zugestellt,
        SUM(CASE WHEN b.art IN ('sendung', 'retoure') AND b.versandstatus IN ('zugestellt', 'problem', 'retoure') THEN 1 ELSE 0 END) AS abgeschlossen,
        COALESCE(SUM((SELECT julianday(MIN(e2.zeit)) - julianday(MIN(e1.zeit)) FROM sendungsereignisse e1 JOIN sendungsereignisse e2 ON e2.bestellung_id = e1.bestellung_id AND e2.code = 'zugestellt' WHERE e1.bestellung_id = b.id AND e1.code IN ('uebergeben', 'label'))), 0) AS laufzeit_summe,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM sendungsereignisse e2 WHERE e2.bestellung_id = b.id AND e2.code = 'zugestellt') AND EXISTS (SELECT 1 FROM sendungsereignisse e1 WHERE e1.bestellung_id = b.id AND e1.code IN ('uebergeben', 'label')) THEN 1 ELSE 0 END) AS laufzeit_anzahl,
        (SELECT COUNT(*) FROM reklamationen r WHERE r.bestellung_id IN (SELECT id FROM bestellungen x WHERE x.id = b.id)) AS reklamationen_zeile
    SQL;
}

/** Aggregatzeile in Kennzahlen umrechnen (abgeleitete Werte). */
function statistikAbleiten(array $z): array
{
    $sendungen = (int) ($z['sendungen'] ?? 0);
    $umsatz = (int) ($z['umsatz'] ?? 0);
    $einkauf = (int) ($z['einkauf'] ?? 0);
    $abgeschlossen = (int) ($z['abgeschlossen'] ?? 0);
    $laufzeitN = (int) ($z['laufzeit_anzahl'] ?? 0);

    return [
        'sendungen' => $sendungen, 'umsatz' => $umsatz, 'brutto' => (int) ($z['brutto'] ?? 0), 'einkauf' => $einkauf,
        'marge' => $umsatz - $einkauf, 'marge_prozent' => $umsatz > 0 ? round(($umsatz - $einkauf) * 100 / $umsatz, 1) : 0.0,
        'durchschnitt' => $sendungen > 0 ? (int) round(($umsatz - (int) ($z['nachberechnung_summe'] ?? 0)) / $sendungen) : 0,
        'gewicht' => $sendungen > 0 ? round((int) ($z['gewicht_summe'] ?? 0) / $sendungen / 1000, 2) : 0.0,
        'retouren' => (int) ($z['retouren'] ?? 0), 'nachberechnungen' => (int) ($z['nachberechnungen'] ?? 0), 'nachberechnung_summe' => (int) ($z['nachberechnung_summe'] ?? 0),
        'storniert' => (int) ($z['storniert'] ?? 0),
        'zugestellt_quote' => $abgeschlossen > 0 ? round((int) ($z['zugestellt'] ?? 0) * 100 / $abgeschlossen, 1) : 0.0,
        'laufzeit' => $laufzeitN > 0 ? round((float) ($z['laufzeit_summe'] ?? 0) / $laufzeitN, 1) : 0.0,
        'reklamationen' => (int) ($z['reklamationen'] ?? 0),
        'reklamationsquote' => $sendungen > 0 ? round((int) ($z['reklamationen'] ?? 0) * 100 / $sendungen, 1) : 0.0,
    ];
}

/** Kennzahlen eines Zeitraums (Reklamationen und Stornos je Zeitraum getrennt gezählt). */
function statistikSumme(array $f, string $von, string $bis): array
{
    $db = datenbank();
    [$wo, $w] = statistikWo($f);
    $st = $db->prepare('SELECT ' . statistikAggregate() . ' FROM bestellungen b WHERE ' . $wo . ' AND b.erstellt >= ? AND b.erstellt < ?');
    $st->execute(array_merge($w, [$von, $bis]));
    $z = $st->fetch() ?: [];
    unset($z['reklamationen_zeile']);
    [$woAlle, $wAlle] = statistikWo($f, false);
    $st = $db->prepare("SELECT COUNT(*) FROM bestellungen b WHERE $woAlle AND b.status = 'storniert' AND b.erstellt >= ? AND b.erstellt < ?");
    $st->execute(array_merge($wAlle, [$von, $bis]));
    $z['storniert'] = (int) $st->fetchColumn();
    $st = $db->prepare("SELECT COUNT(*) FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id WHERE $woAlle AND r.erstellt >= ? AND r.erstellt < ?");
    $st->execute(array_merge($wAlle, [$von, $bis]));
    $z['reklamationen'] = (int) $st->fetchColumn();

    return statistikAbleiten($z);
}

/** Kennzahlen des Zeitraums, optional mit Vorperiode und Veränderung in Prozent. */
function statistikKennzahlen(array $f): array
{
    $jetzt = statistikSumme($f, $f['von'], $f['bis']);
    $aus = ['jetzt' => $jetzt, 'vor' => null, 'delta' => []];
    if ($f['vergleich']) {
        $vor = statistikSumme($f, $f['vor_von'], $f['vor_bis']);
        $aus['vor'] = $vor;
        foreach ($jetzt as $k => $v) {
            $alt = (float) ($vor[$k] ?? 0);
            $aus['delta'][$k] = $alt != 0.0 ? round(((float) $v - $alt) * 100 / abs($alt), 1) : null;
        }
    }
    $db = datenbank();
    [$wo, $w] = statistikWo($f, false, false);
    $st = $db->prepare("SELECT COUNT(DISTINCT COALESCE(b.firma_id, -b.kunde_id)) FROM bestellungen b WHERE $wo AND b.status IN ('bezahlt','beauftragt') AND b.erstellt >= ? AND b.erstellt < ?");
    $st->execute(array_merge($w, [$f['von'], $f['bis']]));
    $aus['kunden_aktiv'] = (int) $st->fetchColumn();
    $st = $db->prepare("SELECT COUNT(*) AS n, COALESCE(SUM(brutto_cent), 0) AS brutto, SUM(CASE WHEN faellig < ? THEN brutto_cent ELSE 0 END) AS ueberfaellig FROM rechnungen WHERE status = 'offen'" . ($f['firma'] > 0 ? ' AND firma_id = ?' : ''));
    $st->execute(array_merge([gmdate('Y-m-d')], $f['firma'] > 0 ? [$f['firma']] : []));
    $aus['offene_posten'] = $st->fetch() ?: ['n' => 0, 'brutto' => 0, 'ueberfaellig' => 0];

    return $aus;
}

/** SQL-Ausdruck einer Dimension. */
function statistikDimensionSql(string $dim): string
{
    return match ($dim) {
        'monat' => "substr(b.erstellt, 1, 7)",
        'woche' => "strftime('%Y', b.erstellt) || '-W' || substr('0' || ((strftime('%j', date(b.erstellt, '-3 days', 'weekday 4')) - 1) / 7 + 1), -2)",
        'tag' => 'substr(b.erstellt, 1, 10)',
        'wochentag' => "strftime('%w', b.erstellt)",
        'carrier' => "COALESCE(NULLIF(b.carrier, ''), '—')",
        'zielland' => 'b.zielland',
        'kunde' => "COALESCE(f.name, k.name, b.email)",
        'unterkunde' => "COALESCE(u.nummer || ' ' || u.name, COALESCE(f.name, '—') || ' (Hauptfirma)')",
        'kundenart' => "CASE WHEN b.firma_id IS NOT NULL THEN 'Geschäftskunde' ELSE 'Privatkunde' END",
        'zahlungsart' => 'b.zahlungsart',
        'gewichtsklasse' => 'b.gewichtsklasse',
        'kategorie' => "COALESCE(b.kategorie, 'paket')",
        'art' => 'b.art',
        'status' => 'b.status',
        'versandstatus' => 'b.versandstatus',
        'preisliste' => "COALESCE(p.name, 'Standard')",
        default => "'—'",
    };
}

/** Anzeigename eines Dimensionswerts. */
function statistikDimensionName(string $dim, string $wert): string
{
    static $laender = null;
    if ($dim === 'zielland') {
        $laender ??= preisliste()['laender'];
        return isset($laender[$wert]) ? $wert . ' ' . (string) ($laender[$wert]['name']['de'] ?? '') : $wert;
    }
    if ($dim === 'wochentag') {
        return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][(int) $wert] ?? $wert;
    }
    if ($dim === 'zahlungsart') {
        return ['rechnung' => 'Rechnung', 'guthaben' => 'Guthaben', 'revolut' => 'Revolut'][$wert] ?? $wert;
    }
    if ($dim === 'art') {
        return ['sendung' => 'Sendung', 'retoure' => 'Retoure', 'nachberechnung' => 'Nachberechnung'][$wert] ?? $wert;
    }
    if ($dim === 'kategorie') {
        return kategorieName($wert);
    }
    if ($dim === 'versandstatus' && defined('VERSANDSTATUS')) {
        return VERSANDSTATUS[$wert]['de'] ?? $wert;
    }
    if ($dim === 'monat' && preg_match('/^(\d{4})-(\d{2})$/', $wert, $m)) {
        return ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][(int) $m[2] - 1] . ' ' . $m[1];
    }
    if ($dim === 'tag' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $wert)) {
        return datumAnzeigen($wert . 'T00:00:00Z');
    }

    return $wert;
}

/** Sortierung: Zeitdimensionen chronologisch, sonst nach Kennzahl absteigend. */
function statistikDimensionZeitlich(string $dim): bool
{
    return in_array($dim, ['monat', 'woche', 'tag', 'wochentag'], true);
}

/**
 * Auswertung je Dimension: Zeilen mit 'schluessel', 'name' und allen
 * Kennzahlen; sortiert nach $sortierung (Kennzahl) absteigend bzw.
 * chronologisch; $limit = 0 für alle. Storniert/Reklamationen je Zeile.
 */
function statistikNachDimension(array $f, string $dim, string $sortierung = 'umsatz', int $limit = 0, string $von = '', string $bis = ''): array
{
    if (!isset(STATISTIK_DIMENSIONEN[$dim])) { $dim = 'carrier'; }
    $von = $von !== '' ? $von : $f['von'];
    $bis = $bis !== '' ? $bis : $f['bis'];
    $db = datenbank();
    $ausdruck = statistikDimensionSql($dim);
    $joins = 'LEFT JOIN firmen f ON f.id = b.firma_id LEFT JOIN kunden k ON k.id = b.kunde_id LEFT JOIN unterkunden u ON u.id = b.unterkunde_id LEFT JOIN preislisten p ON p.id = b.preisliste_id';
    $nurGueltig = !in_array($dim, ['status'], true);
    [$wo, $w] = statistikWo($f, $nurGueltig);
    $st = $db->prepare("SELECT $ausdruck AS schluessel, " . statistikAggregate() . ", SUM(CASE WHEN b.status = 'storniert' THEN 1 ELSE 0 END) AS storniert FROM bestellungen b $joins WHERE $wo AND b.erstellt >= ? AND b.erstellt < ? GROUP BY schluessel");
    $st->execute(array_merge($w, [$von, $bis]));
    $zeilen = [];
    foreach ($st->fetchAll() as $z) {
        unset($z['reklamationen_zeile']);
        $z['reklamationen'] = 0;
        $zeilen[(string) $z['schluessel']] = $z;
    }
    // Reklamationen je Dimensionswert (nach Bestelldatum der Sendung)
    [$woAlle, $wAlle] = statistikWo($f, false);
    $st = $db->prepare("SELECT $ausdruck AS schluessel, COUNT(*) AS n FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id $joins WHERE $woAlle AND r.erstellt >= ? AND r.erstellt < ? GROUP BY schluessel");
    $st->execute(array_merge($wAlle, [$von, $bis]));
    foreach ($st->fetchAll() as $z) {
        if (isset($zeilen[(string) $z['schluessel']])) {
            $zeilen[(string) $z['schluessel']]['reklamationen'] = (int) $z['n'];
        }
    }
    $aus = [];
    foreach ($zeilen as $schluessel => $z) {
        $aus[] = ['schluessel' => (string) $schluessel, 'name' => statistikDimensionName($dim, (string) $schluessel)] + statistikAbleiten($z);
    }
    if (statistikDimensionZeitlich($dim)) {
        usort($aus, static fn (array $a, array $b): int => strcmp($a['schluessel'], $b['schluessel']));
    } else {
        $sortierung = isset(STATISTIK_KENNZAHLEN[$sortierung]) ? $sortierung : 'umsatz';
        usort($aus, static fn (array $a, array $b): int => $b[$sortierung] <=> $a[$sortierung]);
    }
    if ($limit > 0 && count($aus) > $limit) {
        $rest = array_slice($aus, $limit);
        $aus = array_slice($aus, 0, $limit);
        $summe = statistikZeilenSumme($rest);
        $aus[] = ['schluessel' => '', 'name' => 'Übrige (' . count($rest) . ')'] + $summe;
    }

    return $aus;
}

/** Zeilen einer Auswertung addieren (abgeleitete Kennzahlen neu berechnen). */
function statistikZeilenSumme(array $zeilen): array
{
    $s = ['sendungen' => 0, 'umsatz' => 0, 'brutto' => 0, 'einkauf' => 0, 'retouren' => 0, 'nachberechnungen' => 0, 'nachberechnung_summe' => 0, 'storniert' => 0, 'reklamationen' => 0, 'gewicht_summe' => 0, 'zugestellt' => 0, 'abgeschlossen' => 0, 'laufzeit_summe' => 0.0, 'laufzeit_anzahl' => 0];
    foreach ($zeilen as $z) {
        foreach (['sendungen', 'umsatz', 'brutto', 'einkauf', 'retouren', 'nachberechnungen', 'nachberechnung_summe', 'storniert', 'reklamationen'] as $k) {
            $s[$k] += (int) ($z[$k] ?? 0);
        }
        $n = (int) ($z['sendungen'] ?? 0);
        $s['gewicht_summe'] += (int) round((float) ($z['gewicht'] ?? 0) * 1000 * $n);
        $abg = (int) round($n * (float) ($z['zugestellt_quote'] ?? 0) / 100);
        $s['zugestellt'] += $abg;
        $s['abgeschlossen'] += (float) ($z['zugestellt_quote'] ?? 0) > 0 ? $n : 0;
        if ((float) ($z['laufzeit'] ?? 0) > 0) {
            $s['laufzeit_summe'] += (float) $z['laufzeit'] * $n;
            $s['laufzeit_anzahl'] += $n;
        }
    }

    return statistikAbleiten($s);
}

/** Zeitreihe nach Granularität des Filters (Lücken werden mit Nullzeilen gefüllt). */
function statistikZeitreihe(array $f, string $granularitaet = ''): array
{
    $g = in_array($granularitaet, ['tag', 'woche', 'monat'], true) ? $granularitaet : $f['granularitaet'];
    $zeilen = statistikNachDimension($f, $g);
    $nachSchluessel = array_column($zeilen, null, 'schluessel');
    $aus = [];
    $t = strtotime($f['von']);
    $ende = strtotime($f['bis']);
    $leer = statistikAbleiten([]);
    while ($t < $ende) {
        if ($g === 'monat') { $s = gmdate('Y-m', $t); $t = strtotime('+1 month', strtotime(gmdate('Y-m-01', $t))); }
        elseif ($g === 'woche') { $s = gmdate('o-\WW', $t); $t += 7 * 86400; }
        else { $s = gmdate('Y-m-d', $t); $t += 86400; }
        $aus[] = $nachSchluessel[$s] ?? (['schluessel' => $s, 'name' => statistikDimensionName($g, $s)] + $leer);
    }

    return $aus;
}

/**
 * Pivot: Zeilen-Dimension × Spalten-Dimension (optional) → eine Kennzahl.
 * Liefert ['zeilen' => [schluessel => name], 'spalten' => [schluessel => name],
 * 'werte' => [zeile][spalte] => Wert, 'zeilen_summe', 'spalten_summe', 'gesamt'].
 */
function statistikPivot(array $f, string $zeilenDim, string $spaltenDim, string $kennzahl, int $limit = 15): array
{
    if (!isset(STATISTIK_DIMENSIONEN[$zeilenDim])) { $zeilenDim = 'carrier'; }
    if ($spaltenDim !== '' && (!isset(STATISTIK_DIMENSIONEN[$spaltenDim]) || $spaltenDim === $zeilenDim)) { $spaltenDim = ''; }
    if (!isset(STATISTIK_KENNZAHLEN[$kennzahl])) { $kennzahl = 'umsatz'; }
    $db = datenbank();
    $joins = 'LEFT JOIN firmen f ON f.id = b.firma_id LEFT JOIN kunden k ON k.id = b.kunde_id LEFT JOIN unterkunden u ON u.id = b.unterkunde_id LEFT JOIN preislisten p ON p.id = b.preiliste_id';
    $joins = str_replace('preiliste_id', 'preisliste_id', $joins);
    $za = statistikDimensionSql($zeilenDim);
    $sa = $spaltenDim !== '' ? statistikDimensionSql($spaltenDim) : "'gesamt'";
    $nurGueltig = $zeilenDim !== 'status' && $spaltenDim !== 'status';
    [$wo, $w] = statistikWo($f, $nurGueltig);
    $st = $db->prepare("SELECT $za AS z, $sa AS s, " . statistikAggregate() . ", SUM(CASE WHEN b.status = 'storniert' THEN 1 ELSE 0 END) AS storniert FROM bestellungen b $joins WHERE $wo AND b.erstellt >= ? AND b.erstellt < ? GROUP BY z, s");
    $st->execute(array_merge($w, [$f['von'], $f['bis']]));
    $roh = [];
    foreach ($st->fetchAll() as $r) {
        unset($r['reklamationen_zeile']);
        $r['reklamationen'] = 0;
        $roh[(string) $r['z']][(string) $r['s']] = $r;
    }
    if (in_array($kennzahl, ['reklamationen', 'reklamationsquote'], true)) {
        [$woAlle, $wAlle] = statistikWo($f, false);
        $st = $db->prepare("SELECT $za AS z, $sa AS s, COUNT(*) AS n FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id $joins WHERE $woAlle AND r.erstellt >= ? AND r.erstellt < ? GROUP BY z, s");
        $st->execute(array_merge($wAlle, [$f['von'], $f['bis']]));
        foreach ($st->fetchAll() as $r) {
            if (isset($roh[(string) $r['z']][(string) $r['s']])) {
                $roh[(string) $r['z']][(string) $r['s']]['reklamationen'] = (int) $r['n'];
            }
        }
    }
    // Zeilen sortieren (zeitlich oder nach Kennzahl), begrenzen
    $zeilenSummen = [];
    foreach ($roh as $z => $spalten) {
        $zeilenSummen[$z] = statistikZeilenSumme(array_map('statistikAbleiten', $spalten));
    }
    $zeilenKeys = array_map('strval', array_keys($zeilenSummen));
    if (statistikDimensionZeitlich($zeilenDim)) {
        sort($zeilenKeys);
    } else {
        usort($zeilenKeys, static fn (string $a, string $b): int => $zeilenSummen[$b][$kennzahl] <=> $zeilenSummen[$a][$kennzahl]);
    }
    $rest = [];
    if ($limit > 0 && count($zeilenKeys) > $limit) {
        $rest = array_slice($zeilenKeys, $limit);
        $zeilenKeys = array_slice($zeilenKeys, 0, $limit);
    }
    $spaltenKeys = [];
    foreach ($roh as $spalten) {
        foreach (array_keys($spalten) as $s) { $spaltenKeys[(string) $s] = true; }
    }
    $spaltenKeys = array_map('strval', array_keys($spaltenKeys));
    if ($spaltenDim !== '' && statistikDimensionZeitlich($spaltenDim)) {
        sort($spaltenKeys);
    } elseif ($spaltenDim !== '') {
        $spaltenSummen = [];
        foreach ($spaltenKeys as $s) {
            $spaltenSummen[$s] = statistikZeilenSumme(array_map('statistikAbleiten', array_filter(array_column($roh, $s))));
        }
        usort($spaltenKeys, static fn (string $a, string $b): int => $spaltenSummen[$b][$kennzahl] <=> $spaltenSummen[$a][$kennzahl]);
        if (count($spaltenKeys) > 12) {
            $spaltenKeys = array_slice($spaltenKeys, 0, 12);
        }
    }
    $werte = [];
    $zeilenSumme = [];
    foreach ($zeilenKeys as $z) {
        foreach ($spaltenKeys as $s) {
            $werte[$z][$s] = isset($roh[$z][$s]) ? statistikAbleiten($roh[$z][$s])[$kennzahl] : null;
        }
        $zeilenSumme[$z] = $zeilenSummen[$z][$kennzahl];
    }
    if ($rest !== []) {
        $restZeilen = [];
        foreach ($rest as $z) {
            foreach ($spaltenKeys as $s) {
                if (isset($roh[$z][$s])) { $restZeilen[$s][] = statistikAbleiten($roh[$z][$s]); }
            }
        }
        $z = '__rest';
        foreach ($spaltenKeys as $s) {
            $werte[$z][$s] = isset($restZeilen[$s]) ? statistikZeilenSumme($restZeilen[$s])[$kennzahl] : null;
        }
        $zeilenSumme[$z] = statistikZeilenSumme(array_map(static fn ($k) => $zeilenSummen[$k], $rest))[$kennzahl];
        $zeilenKeys[] = $z;
    }
    $spaltenSumme = [];
    foreach ($spaltenKeys as $s) {
        $spaltenSumme[$s] = statistikZeilenSumme(array_map('statistikAbleiten', array_filter(array_column($roh, $s))))[$kennzahl];
    }
    $gesamt = statistikZeilenSumme(array_map('statistikAbleiten', array_merge(...array_values(array_map('array_values', $roh)) ?: [[]])))[$kennzahl] ?? 0;
    $zeilenNamen = [];
    foreach ($zeilenKeys as $z) {
        $zeilenNamen[$z] = $z === '__rest' ? 'Übrige (' . count($rest) . ')' : statistikDimensionName($zeilenDim, $z);
    }
    $spaltenNamen = [];
    foreach ($spaltenKeys as $s) {
        $spaltenNamen[$s] = $spaltenDim === '' ? STATISTIK_KENNZAHLEN[$kennzahl][0] : statistikDimensionName($spaltenDim, $s);
    }

    return ['zeilen' => $zeilenNamen, 'spalten' => $spaltenNamen, 'werte' => $werte, 'zeilen_summe' => $zeilenSumme, 'spalten_summe' => $spaltenSumme, 'gesamt' => $gesamt, 'kennzahl' => $kennzahl, 'zeilen_dim' => $zeilenDim, 'spalten_dim' => $spaltenDim, 'format' => STATISTIK_KENNZAHLEN[$kennzahl][1]];
}

/** Kennzahl formatieren. */
function statistikFormat(float|int|null $wert, string $format): string
{
    if ($wert === null) { return '—'; }
    return match ($format) {
        'euro' => euro((int) round($wert)),
        'prozent' => number_format((float) $wert, 1, ',', '.') . ' %',
        'tage' => number_format((float) $wert, 1, ',', '.') . ' T',
        'kg' => number_format((float) $wert, 2, ',', '.') . ' kg',
        default => number_format((int) $wert, 0, ',', '.'),
    };
}

// ----------------------------------------------------- weitere Auswertungen

/** Offene Posten je Firma (Rechnungen offen, überfällig). */
function statistikOffenePosten(array $f): array
{
    $st = datenbank()->prepare("SELECT f.id, f.name, f.kundennummer, COUNT(*) AS n, SUM(r.brutto_cent) AS brutto, SUM(CASE WHEN r.faellig < ? THEN r.brutto_cent ELSE 0 END) AS ueberfaellig, MIN(r.faellig) AS aelteste FROM rechnungen r JOIN firmen f ON f.id = r.firma_id WHERE r.status = 'offen'" . ($f['firma'] > 0 ? ' AND r.firma_id = ?' : '') . ' GROUP BY f.id ORDER BY ueberfaellig DESC, brutto DESC');
    $st->execute(array_merge([gmdate('Y-m-d')], $f['firma'] > 0 ? [$f['firma']] : []));

    return $st->fetchAll();
}

/** Rechnungen je Monat: gestellt, bezahlt, offen (Brutto). */
function statistikRechnungenMonate(array $f): array
{
    $st = datenbank()->prepare("SELECT substr(erstellt, 1, 7) AS monat, COUNT(*) AS n, SUM(brutto_cent) AS brutto, SUM(CASE WHEN status = 'bezahlt' THEN brutto_cent ELSE 0 END) AS bezahlt, SUM(CASE WHEN status = 'offen' THEN brutto_cent ELSE 0 END) AS offen, SUM(CASE WHEN status = 'storniert' THEN brutto_cent ELSE 0 END) AS storniert FROM rechnungen WHERE erstellt >= ? AND erstellt < ?" . ($f['firma'] > 0 ? ' AND firma_id = ?' : '') . ' GROUP BY monat ORDER BY monat');
    $st->execute(array_merge([$f['von'], $f['bis']], $f['firma'] > 0 ? [$f['firma']] : []));

    return $st->fetchAll();
}

/** Reklamationen nach Art und Status mit Beträgen. */
function statistikReklamationen(array $f): array
{
    $db = datenbank();
    [$wo, $w] = statistikWo($f, false, false);
    $aus = [];
    foreach (['art', 'status'] as $g) {
        $st = $db->prepare("SELECT r.$g AS schluessel, COUNT(*) AS n, COALESCE(SUM(r.betrag_cent), 0) AS betrag, COALESCE(SUM(r.erstattung_cent), 0) AS erstattung FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id WHERE $wo AND r.erstellt >= ? AND r.erstellt < ? GROUP BY r.$g ORDER BY n DESC");
        $st->execute(array_merge($w, [$f['von'], $f['bis']]));
        $aus[$g] = $st->fetchAll();
    }
    $st = $db->prepare("SELECT COUNT(*) AS n, COALESCE(SUM(r.betrag_cent), 0) AS betrag, COALESCE(SUM(r.erstattung_cent), 0) AS erstattung, SUM(CASE WHEN r.status IN ('neu', 'in_pruefung') THEN 1 ELSE 0 END) AS offen, AVG(CASE WHEN r.status IN ('erstattet', 'anerkannt', 'abgelehnt') THEN julianday(r.aktualisiert) - julianday(r.erstellt) END) AS dauer FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id WHERE $wo AND r.erstellt >= ? AND r.erstellt < ?");
    $st->execute(array_merge($w, [$f['von'], $f['bis']]));
    $aus['summe'] = $st->fetch() ?: ['n' => 0, 'betrag' => 0, 'erstattung' => 0, 'offen' => 0, 'dauer' => null];

    return $aus;
}

/** Guthaben: Aufladungen je Monat, Buchungen nach Art, Bestand. */
function statistikGuthaben(array $f): array
{
    $db = datenbank();
    $st = $db->prepare("SELECT substr(bezahlt, 1, 7) AS monat, COUNT(*) AS n, SUM(betrag_cent) AS betrag FROM aufladungen WHERE status = 'bezahlt' AND bezahlt >= ? AND bezahlt < ?" . ($f['firma'] > 0 ? ' AND firma_id = ?' : '') . ' GROUP BY monat ORDER BY monat');
    $st->execute(array_merge([$f['von'], $f['bis']], $f['firma'] > 0 ? [$f['firma']] : []));
    $aufladungen = $st->fetchAll();
    $st = $db->prepare('SELECT art, COUNT(*) AS n, SUM(betrag_cent) AS betrag FROM guthaben_buchungen WHERE zeit >= ? AND zeit < ?' . ($f['firma'] > 0 ? ' AND firma_id = ?' : '') . ' GROUP BY art ORDER BY n DESC');
    $st->execute(array_merge([$f['von'], $f['bis']], $f['firma'] > 0 ? [$f['firma']] : []));
    $buchungen = $st->fetchAll();
    $st = $db->prepare('SELECT COALESCE(SUM(betrag_cent), 0) FROM guthaben_buchungen' . ($f['firma'] > 0 ? ' WHERE firma_id = ?' : ''));
    $st->execute($f['firma'] > 0 ? [$f['firma']] : []);

    return ['aufladungen' => $aufladungen, 'buchungen' => $buchungen, 'bestand' => (int) $st->fetchColumn()];
}

/** Auswahlwerte für die Filterleiste. */
function statistikAuswahl(): array
{
    $db = datenbank();

    return [
        'firmen' => $db->query('SELECT id, name, kundennummer FROM firmen ORDER BY name')->fetchAll(),
        'privat' => $db->query("SELECT id, name, kundennummer FROM kunden WHERE art = 'privat' AND aktiv = 1 ORDER BY name")->fetchAll(),
        'unterkunden' => $db->query('SELECT id, firma_id, nummer, name FROM unterkunden ORDER BY nummer')->fetchAll(),
        'carrier' => array_column($db->query("SELECT DISTINCT carrier FROM bestellungen WHERE carrier <> '' ORDER BY carrier")->fetchAll(), 'carrier'),
        'laender' => array_column($db->query('SELECT DISTINCT zielland FROM bestellungen ORDER BY zielland')->fetchAll(), 'zielland'),
    ];
}

// ----------------------------------------------------- gespeicherte Berichte

function berichteAlle(): array
{
    return datenbank()->query('SELECT * FROM berichte ORDER BY name')->fetchAll();
}

function berichtLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT * FROM berichte WHERE id = ?');
    $st->execute([$id]);
    $z = $st->fetch();
    if (!is_array($z)) { return null; }
    $z['konfig'] = json_decode((string) $z['konfig_json'], true) ?: [];

    return $z;
}

function berichtSpeichern(string $name, array $konfig, string $von, ?int $id = null): int
{
    $name = trim($name);
    if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
        throw new InvalidArgumentException('Bitte einen Berichtsnamen mit 2 bis 80 Zeichen angeben.');
    }
    $db = datenbank();
    if ($id !== null && berichtLaden($id) !== null) {
        $db->prepare('UPDATE berichte SET name = ?, konfig_json = ?, aktualisiert = ? WHERE id = ?')->execute([$name, json_encode($konfig), jetzt(), $id]);

        return $id;
    }
    $db->prepare('INSERT INTO berichte (name, konfig_json, erstellt_von, erstellt, aktualisiert) VALUES (?, ?, ?, ?, ?)')->execute([$name, json_encode($konfig), $von, jetzt(), jetzt()]);

    return (int) $db->lastInsertId();
}

function berichtLoeschen(int $id): void
{
    datenbank()->prepare('DELETE FROM berichte WHERE id = ?')->execute([$id]);
}

/** Tabelle (Kopf + Zeilen) als CSV mit BOM und Semikolon. */
function statistikCsv(array $kopf, array $zeilen): string
{
    $z = static fn ($v): string => '"' . str_replace('"', '""', (string) $v) . '"';
    $aus = [implode(';', array_map($z, $kopf))];
    foreach ($zeilen as $zeile) {
        $aus[] = implode(';', array_map($z, $zeile));
    }

    return "\xEF\xBB\xBF" . implode("\n", $aus) . "\n";
}

/** Kennzahlwert für den Export (Cent → Euro als Zahl, Prozent als Zahl). */
function statistikExportWert(float|int|null $wert, string $format): float|int|string
{
    if ($wert === null) { return ''; }
    return match ($format) {
        'euro' => round($wert / 100, 2),
        'prozent', 'tage', 'kg' => (float) $wert,
        default => (int) $wert,
    };
}
