<?php

/**
 * Einfacher XLSX-Schreiber ohne Abhängigkeiten: ein Blatt, Kopfzeile fett,
 * Zellen als Inline-Zeichenketten (Zahlen bleiben Zahlen). Für Vorlagen
 * und kleine Exporte — kein Ersatz für eine Tabellenkalkulation.
 */

declare(strict_types=1);

/** Liefert die XLSX-Datei als Zeichenkette. $zeilen: Listen von Zellwerten (string|int|float|null). */
function xlsxSchreiben(array $kopf, array $zeilen, string $blattName = 'Tabelle1'): string
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('ZipArchive fehlt — PHP-Erweiterung zip aktivieren.');
    }
    $x = static fn (string $s): string => htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $zelle = static function (int $zeile, int $spalte, mixed $wert, bool $fett) use ($x): string {
        $ref = xlsxSpaltenName($spalte) . $zeile;
        if ($wert === null || $wert === '') {
            return '';
        }
        if (is_int($wert) || is_float($wert)) {
            return '<c r="' . $ref . '"' . ($fett ? ' s="1"' : '') . '><v>' . $wert . '</v></c>';
        }

        return '<c r="' . $ref . '" t="inlineStr"' . ($fett ? ' s="1"' : '') . '><is><t xml:space="preserve">' . $x((string) $wert) . '</t></is></c>';
    };
    $rows = '';
    $alle = array_merge([$kopf], $zeilen);
    foreach ($alle as $i => $z) {
        $rows .= '<row r="' . ($i + 1) . '">';
        foreach (array_values($z) as $j => $w) {
            $rows .= $zelle($i + 1, $j + 1, $w, $i === 0);
        }
        $rows .= '</row>';
    }
    $breiten = '';
    foreach (array_values($kopf) as $j => $k) {
        $b = max(12, min(40, mb_strlen((string) $k) + 4));
        $breiten .= '<col min="' . ($j + 1) . '" max="' . ($j + 1) . '" width="' . $b . '" customWidth="1"/>';
    }
    $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' . $breiten . '</cols><sheetData>' . $rows . '</sheetData></worksheet>';
    $teile = [
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
        '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' . $x(mb_substr($blattName, 0, 31)) . '" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'xl/styles.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>',
        'xl/worksheets/sheet1.xml' => $sheet,
    ];
    $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
    $zip = new ZipArchive();
    if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('XLSX konnte nicht geschrieben werden.');
    }
    foreach ($teile as $name => $inhalt) {
        $zip->addFromString($name, $inhalt);
    }
    $zip->close();
    $daten = (string) file_get_contents($tmp);
    @unlink($tmp);

    return $daten;
}

/** 1 → A, 27 → AA */
function xlsxSpaltenName(int $n): string
{
    $s = '';
    while ($n > 0) {
        $n--;
        $s = chr(65 + $n % 26) . $s;
        $n = intdiv($n, 26);
    }

    return $s;
}
