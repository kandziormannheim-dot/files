<?php

/**
 * Text aus PDF-Dateien ohne Abhängigkeiten: Objekte lesen, Seiten mit ihren
 * Schriften auflösen (ToUnicode-CMaps für eingebettete Schriften mit
 * Identity-H, WinAnsi für Standardschriften), Inhaltsströme dekodieren und
 * die Textoperatoren in Zeilen ordnen. Reicht für Rechnungen aus Excel,
 * Word, Browsern und den meisten Rechnungssystemen; kein OCR, keine
 * verschlüsselten PDFs, keine Objektströme (PDF 1.5+ komprimierte Objekte).
 */

declare(strict_types=1);

function pdfTextLesen(string $datei): string
{
    if (!is_file($datei)) {
        return '';
    }
    $roh = (string) file_get_contents($datei);
    $objekte = [];
    if (preg_match_all('/(?<![\d])(\d+)\s+0\s+obj\b(.*?)endobj/s', $roh, $m, PREG_SET_ORDER)) {
        foreach ($m as $o) {
            $objekte[(int) $o[1]] = $o[2];
        }
    }
    if ($objekte === []) {
        return '';
    }
    $seiten = [];
    foreach ($objekte as $nr => $body) {
        if (preg_match('#/Type\s*/Page\b(?!s)#', $body)) {
            $seiten[] = $nr;
        }
    }
    if ($seiten === []) {
        return '';
    }
    $aus = [];
    foreach ($seiten as $nr) {
        $body = $objekte[$nr];
        $schriften = pdfSchriften($objekte, $body);
        $inhalte = '';
        if (preg_match('#/Contents\s*\[([^\]]*)\]#', $body, $c)) {
            foreach (preg_split('/\s+/', trim($c[1])) ?: [] as $t) {
                if (ctype_digit($t)) {
                    $inhalte .= pdfStrom($objekte, (int) $t) . "\n";
                }
            }
        } elseif (preg_match('#/Contents\s+(\d+)\s+0\s+R#', $body, $c)) {
            $inhalte = pdfStrom($objekte, (int) $c[1]);
        }
        if ($inhalte !== '') {
            $aus[] = pdfInhaltsstromText($inhalte, $schriften);
        }
    }
    $text = implode("\n\f\n", $aus);
    $text = preg_replace('/[ \t]+\n/', "\n", $text) ?? $text;
    $text = preg_replace('/\n{3,}/', "\n\n", $text) ?? $text;

    return $text;
}

/** Dekodierter Strom eines Objekts (nur FlateDecode oder unkomprimiert). */
function pdfStrom(array $objekte, int $nr): string
{
    $body = $objekte[$nr] ?? '';
    if (!preg_match('/stream\r?\n(.*)endstream/s', $body, $m)) {
        return '';
    }
    $daten = $m[1];
    if (preg_match('#/Filter\s*(?:\[\s*)?/FlateDecode#', $body)) {
        $daten = rtrim($daten, "\r\n");
        $ent = @gzuncompress($daten);
        if ($ent === false) {
            $ent = @gzinflate(substr($daten, 2));
        }
        if ($ent === false) {
            return '';
        }
        $daten = $ent;
    } elseif (preg_match('#/Filter#', $body)) {
        return '';
    }

    return $daten;
}

/** Wörterbuch-Wert auflösen: direkter Text oder „N 0 R“. */
function pdfWert(array $objekte, string $body, string $schluessel): string
{
    if (preg_match('#' . preg_quote($schluessel, '#') . '\s+(\d+)\s+0\s+R#', $body, $m)) {
        return $objekte[(int) $m[1]] ?? '';
    }
    if (preg_match('#' . preg_quote($schluessel, '#') . '\s*(<<.*)#s', $body, $m)) {
        return pdfKlammer($m[1]);
    }

    return '';
}

/** Den ersten ausgeglichenen <<…>>-Block liefern. */
function pdfKlammer(string $s): string
{
    $tiefe = 0;
    $len = strlen($s);
    for ($i = 0; $i < $len - 1; $i++) {
        if ($s[$i] === '<' && $s[$i + 1] === '<') {
            $tiefe++;
            $i++;
        } elseif ($s[$i] === '>' && $s[$i + 1] === '>') {
            $tiefe--;
            $i++;
            if ($tiefe === 0) {
                return substr($s, 0, $i + 1);
            }
        }
    }

    return $s;
}

/** Schriften einer Seite: Ressourcenname → ['bytes' => 1|2, 'map' => [code => utf8]|null]. */
function pdfSchriften(array $objekte, string $seite): array
{
    $ressourcen = pdfWert($objekte, $seite, '/Resources');
    $fontDict = pdfWert($objekte, $ressourcen, '/Font');
    $aus = [];
    if ($fontDict === '' || !preg_match_all('#/([A-Za-z0-9_.+-]+)\s+(\d+)\s+0\s+R#', $fontDict, $m, PREG_SET_ORDER)) {
        return $aus;
    }
    foreach ($m as $f) {
        $font = $objekte[(int) $f[2]] ?? '';
        $eintrag = ['bytes' => 1, 'map' => null, 'breiten' => [], 'standard' => 500];
        if (preg_match('#/Subtype\s*/Type0#', $font) || preg_match('#/Encoding\s*/Identity-H#', $font)) {
            $eintrag['bytes'] = 2;
            if (preg_match('#/DescendantFonts\s*\[\s*(\d+)\s+0\s+R#', $font, $d) || preg_match('#/DescendantFonts\s+(\d+)\s+0\s+R#', $font, $d)) {
                $cid = $objekte[(int) $d[1]] ?? '';
                if (preg_match('#/DescendantFonts\s+\d+\s+0\s+R#', $font) && preg_match('#\[\s*(\d+)\s+0\s+R#', $cid, $d2)) {
                    $cid = $objekte[(int) $d2[1]] ?? '';
                }
                if (preg_match('#/DW\s+(\d+)#', $cid, $dw)) {
                    $eintrag['standard'] = (int) $dw[1];
                } else {
                    $eintrag['standard'] = 1000;
                }
                $eintrag['breiten'] = pdfCidBreiten(pdfWert($objekte, $cid, '/W') ?: (preg_match('#/W\s*(\[.*?\])\s*/#s', $cid, $w) ? $w[1] : ''));
            }
        } else {
            $erstes = preg_match('#/FirstChar\s+(\d+)#', $font, $fc) ? (int) $fc[1] : 0;
            $breiten = pdfWert($objekte, $font, '/Widths');
            if ($breiten === '' && preg_match('#/Widths\s*(\[[^\]]*\])#', $font, $w)) {
                $breiten = $w[1];
            }
            if ($breiten !== '' && preg_match_all('/-?\d+(?:\.\d+)?/', $breiten, $zahlen)) {
                foreach ($zahlen[0] as $i => $z) {
                    $eintrag['breiten'][$erstes + $i] = (int) round((float) $z);
                }
            }
            if (preg_match('#/MissingWidth\s+(\d+)#', pdfWert($objekte, $font, '/FontDescriptor'), $mw)) {
                $eintrag['standard'] = (int) $mw[1];
            }
        }
        if (preg_match('#/ToUnicode\s+(\d+)\s+0\s+R#', $font, $tu)) {
            $cmap = pdfStrom($objekte, (int) $tu[1]);
            if ($cmap !== '') {
                [$map, $bytes] = pdfCmap($cmap);
                $eintrag['map'] = $map;
                if ($bytes > 0) {
                    $eintrag['bytes'] = $bytes;
                }
            }
        }
        $aus[$f[1]] = $eintrag;
    }

    return $aus;
}

/** /W-Array eines CID-Fonts: „c [w1 w2 …]“ und „cfirst clast w“. */
function pdfCidBreiten(string $w): array
{
    $aus = [];
    $w = trim($w);
    if ($w === '') {
        return $aus;
    }
    $w = trim($w, "[] \n\r\t");
    $i = 0;
    $len = strlen($w);
    $tokens = [];
    while ($i < $len) {
        if (preg_match('/\G\s*(-?\d+(?:\.\d+)?|\[|\])/', $w, $m, 0, $i)) {
            $tokens[] = $m[1];
            $i += strlen($m[0]);
        } else {
            $i++;
        }
    }
    $n = count($tokens);
    for ($k = 0; $k < $n; $k++) {
        if (!is_numeric($tokens[$k])) {
            continue;
        }
        $start = (int) $tokens[$k];
        if (($tokens[$k + 1] ?? '') === '[') {
            $j = $k + 2;
            $c = $start;
            while ($j < $n && $tokens[$j] !== ']') {
                $aus[$c++] = (int) round((float) $tokens[$j]);
                $j++;
            }
            $k = $j;
        } elseif (is_numeric($tokens[$k + 1] ?? '') && is_numeric($tokens[$k + 2] ?? '')) {
            $ende = (int) $tokens[$k + 1];
            $breite = (int) round((float) $tokens[$k + 2]);
            if ($ende - $start < 65536) {
                for ($c = $start; $c <= $ende; $c++) {
                    $aus[$c] = $breite;
                }
            }
            $k += 2;
        }
    }

    return $aus;
}

/** ToUnicode-CMap → [code => utf8-Text], Bytes je Code. */
function pdfCmap(string $cmap): array
{
    $map = [];
    $bytes = 0;
    if (preg_match('/begincodespacerange\s*<([0-9A-Fa-f]+)>/', $cmap, $m)) {
        $bytes = (int) (strlen($m[1]) / 2);
    }
    $utf8 = static function (string $hex): string {
        $hex = strlen($hex) % 4 === 0 ? $hex : str_pad($hex, (int) (ceil(strlen($hex) / 4) * 4), '0', STR_PAD_LEFT);
        $s = (string) hex2bin($hex);

        return (string) @mb_convert_encoding($s, 'UTF-8', 'UTF-16BE');
    };
    if (preg_match_all('/beginbfchar(.*?)endbfchar/s', $cmap, $bloecke)) {
        foreach ($bloecke[1] as $block) {
            if (preg_match_all('/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/', $block, $p, PREG_SET_ORDER)) {
                foreach ($p as $z) {
                    $map[hexdec($z[1])] = $utf8($z[2]);
                }
            }
        }
    }
    if (preg_match_all('/beginbfrange(.*?)endbfrange/s', $cmap, $bloecke)) {
        foreach ($bloecke[1] as $block) {
            if (preg_match_all('/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([^\]]*)\])/', $block, $p, PREG_SET_ORDER)) {
                foreach ($p as $z) {
                    $von = hexdec($z[1]);
                    $bis = hexdec($z[2]);
                    if ($bis - $von > 65535) {
                        continue;
                    }
                    if (isset($z[5]) && $z[5] !== '') {
                        preg_match_all('/<([0-9A-Fa-f]+)>/', $z[5], $liste);
                        foreach ($liste[1] as $i => $hex) {
                            $map[$von + $i] = $utf8($hex);
                        }
                    } else {
                        $start = hexdec($z[4]);
                        for ($c = $von; $c <= $bis; $c++) {
                            $map[$c] = $utf8(str_pad(dechex($start + $c - $von), 4, '0', STR_PAD_LEFT));
                        }
                    }
                }
            }
        }
    }

    return [$map, $bytes];
}

/** Bytes einer Zeichenkette mit der Schrift in Text wandeln. */
function pdfZeichen(string $bytes, ?array $schrift): string
{
    if ($schrift === null || $schrift['map'] === null) {
        if ($schrift !== null && $schrift['bytes'] === 2) {
            return ''; // unbekannte Zweibyte-Schrift ohne ToUnicode: nicht lesbar
        }
        $s = (string) @mb_convert_encoding($bytes, 'UTF-8', 'Windows-1252');

        return $s;
    }
    $aus = '';
    $n = $schrift['bytes'];
    $len = strlen($bytes);
    for ($i = 0; $i + $n <= $len; $i += $n) {
        $code = $n === 2 ? (ord($bytes[$i]) << 8) + ord($bytes[$i + 1]) : ord($bytes[$i]);
        $aus .= $schrift['map'][$code] ?? ($n === 1 ? (string) @mb_convert_encoding($bytes[$i], 'UTF-8', 'Windows-1252') : '');
    }

    return $aus;
}

/** Text und Vorschub (in 1/1000 em) einer Zeichenkette. */
function pdfZeichenMitBreite(string $bytes, ?array $schrift): array
{
    $text = pdfZeichen($bytes, $schrift);
    $n = $schrift['bytes'] ?? 1;
    $breite = 0;
    $len = strlen($bytes);
    for ($i = 0; $i + $n <= $len; $i += $n) {
        $code = $n === 2 ? (ord($bytes[$i]) << 8) + ord($bytes[$i + 1]) : ord($bytes[$i]);
        $breite += $schrift['breiten'][$code] ?? ($schrift['standard'] ?? 500);
    }

    return [$text, $breite];
}

/** Textoperatoren eines Inhaltsstroms in Zeilen ordnen. */
function pdfInhaltsstromText(string $strom, array $schriften): string
{
    $aus = '';
    $len = strlen($strom);
    $i = 0;
    $schrift = null;
    $groesse = 10.0;
    $skala = 1.0;
    $y = null;
    $xEnde = null;
    $operanden = [];
    $lesenString = static function (string $s, int &$i): string {
        $tiefe = 0;
        $wert = '';
        $len = strlen($s);
        for (; $i < $len; $i++) {
            $c = $s[$i];
            if ($c === '\\') {
                $i++;
                $n = $s[$i] ?? '';
                if (ctype_digit($n)) {
                    $okt = $n;
                    while (strlen($okt) < 3 && ctype_digit($s[$i + 1] ?? '')) {
                        $okt .= $s[++$i];
                    }
                    $wert .= chr((int) octdec($okt) & 255);
                } elseif ($n === "\n" || $n === "\r") {
                    // Zeilenfortsetzung
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
    $lesenHex = static function (string $s, int &$i): string {
        $ende = strpos($s, '>', $i);
        if ($ende === false) {
            $i = strlen($s);

            return '';
        }
        $hex = preg_replace('/[^0-9a-fA-F]/', '', substr($s, $i + 1, $ende - $i - 1)) ?? '';
        $i = $ende + 1;

        return (string) hex2bin(strlen($hex) % 2 ? $hex . '0' : $hex);
    };
    $neueZeile = static function () use (&$aus, &$xEnde): void {
        if ($aus !== '' && !str_ends_with($aus, "\n")) {
            $aus .= "\n";
        }
        $xEnde = null;
    };
    /* $pos: Textanfang im Nutzerraum, $xEnde: Ende des letzten Textes. Ein Wortabstand
       entsteht, wenn der neue Text deutlich hinter dem Ende des vorigen beginnt. */
    $pos = null;
    $ausgeben = function (string $text, int $breite) use (&$aus, &$xEnde, &$groesse, &$skala, &$pos): void {
        $em = $groesse * $skala;
        if ($text !== '') {
            if ($pos !== null && $xEnde !== null && $pos - $xEnde > $em * 0.18 && $aus !== '' && !str_ends_with($aus, "\n") && !str_ends_with($aus, ' ')) {
                $aus .= ' ';
            }
            if ($pos !== null && $xEnde !== null && $pos - $xEnde < -$em * 2 && $aus !== '' && !str_ends_with($aus, "\n")) {
                $aus .= "\n"; // Sprung weit nach links auf derselben Höhe: neue Spalte/Zeile
            }
            $aus .= $text;
        }
        $vorschub = $breite / 1000 * $em;
        if ($pos !== null) {
            $xEnde = $pos + $vorschub;
            $pos = $xEnde;
        } elseif ($xEnde !== null) {
            $xEnde += $vorschub;
        }
    };
    $zeilenStart = 0.0;
    while ($i < $len) {
        $c = $strom[$i];
        if ($c === '(') {
            $operanden[] = ['s', $lesenString($strom, $i)];
            continue;
        }
        if ($c === '<' && ($strom[$i + 1] ?? '') !== '<') {
            $operanden[] = ['s', $lesenHex($strom, $i)];
            continue;
        }
        if ($c === '<' && ($strom[$i + 1] ?? '') === '<') {
            $dict = pdfKlammer(substr($strom, $i, 4000));
            $i += strlen($dict);
            continue;
        }
        if ($c === '[') {
            $i++;
            $teile = [];
            while ($i < $len && $strom[$i] !== ']') {
                if ($strom[$i] === '(') {
                    $teile[] = ['s', $lesenString($strom, $i)];
                } elseif ($strom[$i] === '<') {
                    $teile[] = ['s', $lesenHex($strom, $i)];
                } elseif (preg_match('/\G\s*(-?\d*\.?\d+)/', $strom, $m, 0, $i)) {
                    $teile[] = ['n', (float) $m[1]];
                    $i += strlen($m[0]);
                } else {
                    $i++;
                }
            }
            $i++;
            $operanden[] = ['a', $teile];
            continue;
        }
        if ($c === '%') {
            $ende = strpos($strom, "\n", $i);
            $i = $ende === false ? $len : $ende + 1;
            continue;
        }
        if (preg_match('/\G(-?\d*\.?\d+)/', $strom, $m, 0, $i)) {
            $operanden[] = ['n', (float) $m[1]];
            $i += strlen($m[0]);
            continue;
        }
        if ($c === '/') {
            if (preg_match('/\G\/([^\s\/\[\]<>(){}%]*)/', $strom, $m, 0, $i)) {
                $operanden[] = ['name', $m[1]];
                $i += strlen($m[0]);
                continue;
            }
        }
        if (preg_match('/\G([A-Za-z\'"*]{1,3})/', $strom, $m, 0, $i)) {
            $op = $m[1];
            $i += strlen($op);
            switch ($op) {
                case 'Tf':
                    $name = $operanden[count($operanden) - 2][1] ?? '';
                    $schrift = is_string($name) ? ($schriften[$name] ?? null) : null;
                    $groesse = abs((float) ($operanden[count($operanden) - 1][1] ?? 10)) ?: 10.0;
                    break;
                case 'Tj':
                    [$text, $breite] = pdfZeichenMitBreite((string) ($operanden[count($operanden) - 1][1] ?? ''), $schrift);
                    $ausgeben($text, $breite);
                    break;
                case "'":
                case '"':
                    $neueZeile();
                    [$text, $breite] = pdfZeichenMitBreite((string) ($operanden[count($operanden) - 1][1] ?? ''), $schrift);
                    $ausgeben($text, $breite);
                    break;
                case 'TJ':
                    $teile = $operanden[count($operanden) - 1][1] ?? [];
                    if (is_array($teile)) {
                        foreach ($teile as $t) {
                            if ($t[0] === 's') {
                                [$text, $breite] = pdfZeichenMitBreite($t[1], $schrift);
                                $ausgeben($text, $breite);
                            } else {
                                $ausgeben('', (int) round(-$t[1]));
                            }
                        }
                    }
                    break;
                case 'Td':
                case 'TD':
                    $ty = (float) ($operanden[count($operanden) - 1][1] ?? 0);
                    $tx = (float) ($operanden[count($operanden) - 2][1] ?? 0);
                    if (abs($ty) > $groesse * 0.3) {
                        $neueZeile();
                        $zeilenStart += $tx * $skala;
                        $pos = $zeilenStart;
                        $y = $y !== null ? $y + $ty * $skala : null;
                    } else {
                        $zeilenStart += $tx * $skala;
                        $pos = $zeilenStart;
                    }
                    break;
                case 'Tm':
                    $ny = (float) ($operanden[count($operanden) - 1][1] ?? 0);
                    $nx = (float) ($operanden[count($operanden) - 2][1] ?? 0);
                    $skala = abs((float) ($operanden[count($operanden) - 6][1] ?? 1)) ?: 1.0;
                    if ($y === null || abs($ny - $y) > $groesse * $skala * 0.3) {
                        $neueZeile();
                    }
                    $y = $ny;
                    $pos = $nx;
                    $zeilenStart = $nx;
                    break;
                case 'T*':
                    $neueZeile();
                    $pos = $zeilenStart;
                    break;
                case 'ET':
                    $pos = null; // Zeilenwechsel entscheidet die Höhe des nächsten Textobjekts
                    break;
                case 'BT':
                    $pos = null;
                    $zeilenStart = 0.0;
                    $skala = 1.0;
                    break;
            }
            $operanden = [];
            continue;
        }
        $i++;
    }

    return $aus;
}
