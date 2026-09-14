<?php

/**
 * Tabellen einlesen ohne Abhängigkeiten: CSV (Trenner wird erkannt) und
 * XLSX (ZipArchive + XML: Blätter, geteilte Zeichenketten, Inline-Strings).
 * Liefert je Blatt Kopfzeile und Datenzeilen; die Kopfzeile ist die erste
 * Zeile mit mindestens zwei gefüllten Zellen (Titelzeilen davor fallen weg).
 */

declare(strict_types=1);

/** ['art' => 'csv'|'xlsx', 'blaetter' => [['name', 'kopf', 'zeilen', 'trenner']]] */
function tabelleLesen(string $datei, string $dateiname = ''): array
{
    $name = $dateiname !== '' ? $dateiname : $datei;
    $endung = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $magic = (string) file_get_contents($datei, false, null, 0, 4);
    if ($endung === 'xlsx' || $endung === 'xlsm' || str_starts_with($magic, "PK\x03\x04")) {
        return ['art' => 'xlsx', 'blaetter' => xlsxLesen($datei)];
    }
    if ($endung === 'xls' && !str_starts_with($magic, "PK")) {
        throw new InvalidArgumentException('Altes Excel-Format (.xls) wird nicht gelesen — bitte als .xlsx oder .csv speichern.');
    }
    $csv = csvTextLesen((string) file_get_contents($datei));

    return ['art' => 'csv', 'blaetter' => [['name' => 'CSV', 'kopf' => $csv['kopf'], 'zeilen' => $csv['zeilen'], 'trenner' => $csv['trenner']]]];
}

/** CSV-Text: Kopf, Zeilen, erkannter Trenner. */
function csvTextLesen(string $inhalt, string $trenner = ''): array
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
    $alle = [];
    foreach ($linien as $linie) {
        $alle[] = array_map(static fn (string $s): string => trim($s, " \t\"'"), str_getcsv($linie, $trenner, '"', '\\'));
    }
    [$kopf, $zeilen] = tabelleKopfFinden($alle);

    return ['kopf' => $kopf, 'zeilen' => $zeilen, 'trenner' => $trenner];
}

/** Erste Zeile mit ≥ 2 gefüllten Zellen ist der Kopf; alles davor fällt weg. */
function tabelleKopfFinden(array $alle): array
{
    foreach ($alle as $i => $zeile) {
        if (count(array_filter($zeile, static fn (string $z): bool => trim($z) !== '')) >= 2) {
            $kopf = [];
            foreach ($zeile as $k => $name) {
                $kopf[$k] = trim($name) !== '' ? trim($name) : 'Spalte ' . ($k + 1);
            }
            $zeilen = [];
            foreach (array_slice($alle, $i + 1) as $z) {
                $z = array_values($z);
                if (count(array_filter($z, static fn (string $v): bool => trim($v) !== '')) === 0) {
                    continue;
                }
                $voll = [];
                foreach ($kopf as $k => $_) {
                    $voll[$k] = trim((string) ($z[$k] ?? ''));
                }
                $zeilen[] = $voll;
            }

            return [array_values($kopf), $zeilen];
        }
    }

    return [[], []];
}

/** Alle Blätter einer XLSX-Datei. */
function xlsxLesen(string $datei): array
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('ZipArchive fehlt — PHP-Erweiterung zip aktivieren oder CSV hochladen.');
    }
    $zip = new ZipArchive();
    if ($zip->open($datei) !== true) {
        throw new InvalidArgumentException('Die XLSX-Datei lässt sich nicht öffnen.');
    }
    $lesen = static fn (string $pfad): string => (string) ($zip->getFromName($pfad) ?: '');
    $strings = [];
    $ss = $lesen('xl/sharedStrings.xml');
    if ($ss !== '') {
        $xml = @simplexml_load_string($ss);
        if ($xml !== false) {
            foreach ($xml->si as $si) {
                $strings[] = xlsxText($si);
            }
        }
    }
    $rels = [];
    $relXml = @simplexml_load_string($lesen('xl/_rels/workbook.xml.rels'));
    if ($relXml !== false) {
        foreach ($relXml->Relationship as $r) {
            $ziel = (string) $r['Target'];
            $rels[(string) $r['Id']] = str_starts_with($ziel, '/') ? ltrim($ziel, '/') : 'xl/' . $ziel;
        }
    }
    $blaetter = [];
    $wb = @simplexml_load_string($lesen('xl/workbook.xml'));
    if ($wb !== false) {
        $wb->registerXPathNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        foreach ($wb->xpath('//m:sheets/m:sheet') ?: [] as $sheet) {
            $attr = $sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships');
            $rid = (string) ($attr['id'] ?? '');
            $pfad = $rels[$rid] ?? '';
            if ($pfad === '') {
                continue;
            }
            $alle = xlsxBlatt($lesen($pfad), $strings);
            [$kopf, $zeilen] = tabelleKopfFinden($alle);
            $blaetter[] = ['name' => trim((string) $sheet['name']), 'kopf' => $kopf, 'zeilen' => $zeilen, 'trenner' => ''];
        }
    }
    $zip->close();
    if ($blaetter === []) {
        throw new InvalidArgumentException('Die XLSX-Datei enthält keine lesbaren Blätter.');
    }

    return $blaetter;
}

function xlsxText(SimpleXMLElement $el): string
{
    $aus = '';
    foreach ($el->xpath('.//*[local-name()="t"]') ?: [] as $t) {
        $aus .= (string) $t;
    }

    return $aus;
}

/** Zellen eines Blatts als Zeilen (Spaltenbuchstaben → Index, Lücken gefüllt). */
function xlsxBlatt(string $xml, array $strings): array
{
    if ($xml === '') {
        return [];
    }
    $doc = @simplexml_load_string($xml);
    if ($doc === false) {
        return [];
    }
    $doc->registerXPathNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $zeilen = [];
    foreach ($doc->xpath('//m:sheetData/m:row') ?: [] as $row) {
        $zeile = [];
        $maxSpalte = -1;
        foreach ($row->c as $c) {
            $ref = (string) $c['r'];
            $spalte = xlsxSpaltenIndex(preg_replace('/\d+/', '', $ref) ?? '');
            $typ = (string) $c['t'];
            $wert = '';
            if ($typ === 's') {
                $wert = $strings[(int) $c->v] ?? '';
            } elseif ($typ === 'inlineStr') {
                $wert = xlsxText($c);
            } elseif (isset($c->v)) {
                $wert = (string) $c->v;
                if ($typ !== 'str' && $typ !== 'b' && is_numeric($wert) && str_contains($wert, 'E')) {
                    $wert = rtrim(rtrim(number_format((float) $wert, 6, '.', ''), '0'), '.');
                }
            }
            $zeile[$spalte] = $wert;
            $maxSpalte = max($maxSpalte, $spalte);
        }
        $voll = [];
        for ($k = 0; $k <= $maxSpalte; $k++) {
            $voll[$k] = $zeile[$k] ?? '';
        }
        $zeilen[] = $voll;
    }

    return $zeilen;
}

function xlsxSpaltenIndex(string $buchstaben): int
{
    $n = 0;
    foreach (str_split(strtoupper($buchstaben)) as $b) {
        $n = $n * 26 + (ord($b) - 64);
    }

    return max(0, $n - 1);
}
