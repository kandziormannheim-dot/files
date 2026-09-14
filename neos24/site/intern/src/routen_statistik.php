<?php

/**
 * Modul „Statistiken & Berichte“: Übersicht mit Kennzahlen, Berichtsseiten
 * (Zeitverlauf, Carrier, Zielländer, Kunden, Finanzen, Reklamationen,
 * Guthaben), freier Pivot-Bericht mit gespeicherten Berichten, Export als
 * CSV/XLSX. Kern in lib/statistik.php, Diagramme in src/diagramme.php.
 * Erwartet $pfad, $methode aus intern/index.php.
 */

declare(strict_types=1);

const STATISTIK_BERICHTE = [
    'zeitverlauf' => 'Zeitverlauf',
    'carrier' => 'Carrier',
    'laender' => 'Zielländer',
    'kunden' => 'Kunden',
    'finanzen' => 'Finanzen',
    'reklamationen' => 'Reklamationen',
    'guthaben' => 'Guthaben',
    'pivot' => 'Pivot-Bericht',
];

if ($pfad === '/statistik' || preg_match('#^/statistik/(zeitverlauf|carrier|laender|kunden|finanzen|reklamationen|guthaben|pivot|export\.csv|export\.xlsx)$#', $pfad, $t) || preg_match('#^/statistik/berichte/(\d+)/loeschen$#', $pfad, $tl)) {
    rechtErzwingen('statistik');
    require_once __DIR__ . '/diagramme.php';
    require_once dirname(__DIR__, 2) . '/lib/versand.php';
    require_once dirname(__DIR__, 2) . '/lib/tabelle_schreiben.php';
    $bericht = $t[1] ?? '';
    $q = $_GET;
    // Gespeicherter Bericht: Konfiguration (Filter + Pivot) übernehmen, eigene Parameter gewinnen
    $gespeichert = null;
    if ((int) ($q['bericht'] ?? 0) > 0) {
        $gespeichert = berichtLaden((int) $q['bericht']);
        if ($gespeichert !== null) {
            $q = array_merge($gespeichert['konfig'], array_filter($q, static fn ($v): bool => $v !== ''));
        }
    }
    $f = statistikFilter($q);
    $pk = [
        'zeilen' => isset(STATISTIK_DIMENSIONEN[$q['zeilen'] ?? '']) ? (string) $q['zeilen'] : 'carrier',
        'spalten' => isset(STATISTIK_DIMENSIONEN[$q['spalten'] ?? '']) ? (string) $q['spalten'] : '',
        'kennzahl' => isset(STATISTIK_KENNZAHLEN[$q['kennzahl'] ?? '']) ? (string) $q['kennzahl'] : 'umsatz',
        'limit' => max(0, min(100, (int) ($q['limit'] ?? 15))),
        'diagramm' => in_array($q['diagramm'] ?? '', ['balken', 'linie', 'ring', 'quer', 'keins'], true) ? (string) $q['diagramm'] : 'balken',
    ];
    if ($pk['spalten'] === $pk['zeilen']) {
        $pk['spalten'] = '';
    }

    if ($methode === 'POST' && isset($tl[1])) {
        rechtErzwingen('statistik', 'bearbeiten');
        $b = berichtLaden((int) $tl[1]);
        if ($b !== null) {
            berichtLoeschen((int) $b['id']);
            protokollieren('bericht.geloescht', 'bericht', (int) $b['id'], ['name' => $b['name']]);
            hinweisSetzen('Bericht „' . $b['name'] . '“ gelöscht.');
        }
        umleiten(url('statistik/pivot'));
    }
    if ($methode === 'POST' && $bericht === 'pivot') {
        rechtErzwingen('statistik', 'bearbeiten');
        try {
            $konfig = statistikQuery($f, $pk);
            $id = feld('bericht_id', 10) !== '' ? (int) feld('bericht_id', 10) : null;
            $id = berichtSpeichern(feld('name', 80), $konfig, benutzerAktuell()['name'] ?? '', $id);
            protokollieren('bericht.gespeichert', 'bericht', $id, ['name' => feld('name', 80)]);
            hinweisSetzen('Bericht „' . feld('name', 80) . '“ gespeichert.');
            umleiten(url('statistik/pivot', ['bericht' => $id]));
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
            umleiten(url('statistik/pivot', statistikQuery($f, $pk)));
        }
    }

    // Export: was = zeitreihe | dimension (dim) | pivot
    if ($bericht === 'export.csv' || $bericht === 'export.xlsx') {
        $was = (string) ($q['was'] ?? 'pivot');
        $kopf = [];
        $zeilen = [];
        $kennzahlenExport = ['sendungen', 'umsatz', 'brutto', 'einkauf', 'marge', 'marge_prozent', 'durchschnitt', 'gewicht', 'retouren', 'nachberechnungen', 'nachberechnung_summe', 'storniert', 'zugestellt_quote', 'laufzeit', 'reklamationen', 'reklamationsquote'];
        if ($was === 'pivot') {
            $p = statistikPivot($f, $pk['zeilen'], $pk['spalten'], $pk['kennzahl'], $pk['limit']);
            $kopf = array_merge([STATISTIK_DIMENSIONEN[$p['zeilen_dim']]], array_values($p['spalten']), $p['spalten_dim'] !== '' ? ['Summe'] : []);
            foreach ($p['zeilen'] as $z => $name) {
                $zeile = [$name];
                foreach (array_keys($p['spalten']) as $s) {
                    $zeile[] = statistikExportWert($p['werte'][$z][$s] ?? null, $p['format']);
                }
                if ($p['spalten_dim'] !== '') {
                    $zeile[] = statistikExportWert($p['zeilen_summe'][$z] ?? null, $p['format']);
                }
                $zeilen[] = $zeile;
            }
            $summe = ['Gesamt'];
            foreach (array_keys($p['spalten']) as $s) {
                $summe[] = statistikExportWert($p['spalten_summe'][$s] ?? null, $p['format']);
            }
            if ($p['spalten_dim'] !== '') {
                $summe[] = statistikExportWert($p['gesamt'], $p['format']);
            }
            $zeilen[] = $summe;
            $dateiname = 'neos-pivot-' . $p['zeilen_dim'] . ($p['spalten_dim'] !== '' ? '-' . $p['spalten_dim'] : '') . '-' . $p['kennzahl'];
        } else {
            $dim = $was === 'zeitreihe' ? $f['granularitaet'] : (isset(STATISTIK_DIMENSIONEN[$q['dim'] ?? '']) ? (string) $q['dim'] : 'carrier');
            $daten = $was === 'zeitreihe' ? statistikZeitreihe($f) : statistikNachDimension($f, $dim, 'umsatz', 0);
            $kopf = array_merge([STATISTIK_DIMENSIONEN[$dim]], array_map(static fn (string $k): string => STATISTIK_KENNZAHLEN[$k][0], $kennzahlenExport));
            foreach ($daten as $z) {
                $zeile = [$z['name']];
                foreach ($kennzahlenExport as $k) {
                    $zeile[] = statistikExportWert($z[$k], STATISTIK_KENNZAHLEN[$k][1]);
                }
                $zeilen[] = $zeile;
            }
            $dateiname = 'neos-statistik-' . $dim;
        }
        $dateiname .= '-' . $f['von'] . '-' . $f['bis_anzeige'];
        if ($bericht === 'export.xlsx') {
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="' . $dateiname . '.xlsx"');
            echo xlsxSchreiben($kopf, $zeilen, 'Statistik');
        } else {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $dateiname . '.csv"');
            echo statistikCsv($kopf, $zeilen);
        }
        exit;
    }

    $gemeinsam = ['f' => $f, 'auswahl' => statistikAuswahl(), 'berichte' => STATISTIK_BERICHTE, 'bericht' => $bericht, 'query' => statistikQuery($f), 'aktiv' => 'statistik'];
    $d = [];
    switch ($bericht) {
        case '':
            $d['k'] = statistikKennzahlen($f);
            $d['zeitreihe'] = statistikZeitreihe($f);
            $d['carrier'] = statistikNachDimension($f, 'carrier', 'sendungen', 6);
            $d['laender'] = statistikNachDimension($f, 'zielland', 'sendungen', 6);
            $d['kunden'] = statistikNachDimension($f, 'kunde', 'umsatz', 6);
            $d['zahlungsarten'] = statistikNachDimension($f, 'zahlungsart', 'umsatz', 0);
            $d['status'] = statistikNachDimension($f, 'versandstatus', 'sendungen', 0);
            ansicht('statistik', $gemeinsam + ['titel' => 'Statistiken', 'd' => $d]);
            // no break — ansicht() beendet
        case 'zeitverlauf':
            $g = in_array($q['granularitaet'] ?? '', ['tag', 'woche', 'monat'], true) ? (string) $q['granularitaet'] : $f['granularitaet'];
            $d['granularitaet'] = $g;
            $d['zeitreihe'] = statistikZeitreihe($f, $g);
            $d['summe'] = statistikZeilenSumme($d['zeitreihe']);
            break;
        case 'carrier':
            $d['zeilen'] = statistikNachDimension($f, 'carrier', 'sendungen', 0);
            $d['summe'] = statistikZeilenSumme($d['zeilen']);
            break;
        case 'laender':
            $d['zeilen'] = statistikNachDimension($f, 'zielland', 'sendungen', 0);
            $d['summe'] = statistikZeilenSumme($d['zeilen']);
            break;
        case 'kunden':
            $d['zeilen'] = statistikNachDimension($f, 'kunde', 'umsatz', 25);
            $d['kundenart'] = statistikNachDimension($f, 'kundenart', 'umsatz', 0);
            $d['unterkunden'] = statistikNachDimension($f, 'unterkunde', 'umsatz', 0);
            $d['preislisten'] = statistikNachDimension($f, 'preisliste', 'umsatz', 0);
            $d['summe'] = statistikZeilenSumme(statistikNachDimension($f, 'kunde', 'umsatz', 0));
            break;
        case 'finanzen':
            $d['zeitreihe'] = statistikZeitreihe($f);
            $d['zahlungsarten'] = statistikNachDimension($f, 'zahlungsart', 'umsatz', 0);
            $d['arten'] = statistikNachDimension($f, 'art', 'umsatz', 0);
            $d['rechnungen'] = statistikRechnungenMonate($f);
            $d['offene_posten'] = statistikOffenePosten($f);
            $d['k'] = statistikKennzahlen($f);
            break;
        case 'reklamationen':
            $d['r'] = statistikReklamationen($f);
            $d['carrier'] = statistikNachDimension($f, 'carrier', 'reklamationen', 0);
            $d['zeitreihe'] = statistikZeitreihe($f);
            break;
        case 'guthaben':
            $d['g'] = statistikGuthaben($f);
            break;
        case 'pivot':
            $d['pivot'] = statistikPivot($f, $pk['zeilen'], $pk['spalten'], $pk['kennzahl'], $pk['limit']);
            $d['pk'] = $pk;
            $d['gespeichert'] = $gespeichert;
            $d['berichte_liste'] = berichteAlle();
            break;
    }
    ansicht('statistik_bericht', $gemeinsam + ['titel' => 'Statistik: ' . STATISTIK_BERICHTE[$bericht], 'd' => $d, 'pk' => $pk]);
}
