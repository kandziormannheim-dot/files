<?php

/**
 * Vorläufiges NEOS-Versandlabel als PDF (A6 einzeln oder vier je A4-Seite)
 * mit Code-128-Strichcode der Sendungsnummer. Ersetzt das Carrier-Label nur,
 * solange keine Carrier-Anbindung existiert (lib/carrier.php).
 */

declare(strict_types=1);

require_once __DIR__ . '/pdf/fpdf.php';
require_once __DIR__ . '/rechnung_pdf.php'; // pdfText()

/** Code 128 B: Muster je Zeichen (Breiten der Balken und Lücken). */
function code128Muster(): array
{
    return ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
}

/** Strichcode zeichnen (Code 128 B, ASCII 32–126). */
function code128Zeichnen(FPDF $pdf, string $text, float $x, float $y, float $hoehe, float $breite): void
{
    $muster = code128Muster();
    $werte = [104]; // Start B
    $summe = 104;
    $i = 1;
    foreach (str_split($text) as $zeichen) {
        $code = ord($zeichen) - 32;
        if ($code < 0 || $code > 94) {
            $code = 0;
        }
        $werte[] = $code;
        $summe += $code * $i++;
    }
    $werte[] = $summe % 103;
    $werte[] = 106; // Stop
    $module = 0;
    foreach ($werte as $w) {
        $module += array_sum(str_split($muster[$w]));
    }
    $einheit = $breite / $module;
    $pdf->SetFillColor(0, 0, 0);
    $pos = $x;
    foreach ($werte as $w) {
        foreach (str_split($muster[$w]) as $k => $b) {
            $breiteBalken = (int) $b * $einheit;
            if ($k % 2 === 0) {
                $pdf->Rect($pos, $y, $breiteBalken, $hoehe, 'F');
            }
            $pos += $breiteBalken;
        }
    }
}

/** Ein Label (A6-Fläche) an Position zeichnen. */
function labelZeichnen(FPDF $pdf, array $b, float $x0, float $y0): void
{
    $abs = json_decode((string) $b['absender_json'], true) ?: [];
    $emp = json_decode((string) $b['empfaenger_json'], true) ?: [];
    $land = preisliste()['laender'][$b['zielland']]['name']['de'] ?? $b['zielland'];
    $zusatz = json_decode((string) ($b['zusatz_json'] ?? '[]'), true) ?: [];
    $breite = 105;
    $hoehe = 148;
    $pdf->SetDrawColor(180, 180, 180);
    $pdf->Rect($x0, $y0, $breite, $hoehe);

    // Kopf: Wortmarke, Carrier, Zielland
    $pdf->SetXY($x0 + 5, $y0 + 4);
    $pdf->SetFont('Helvetica', 'B', 14);
    foreach ([['N', [41, 211, 245]], ['E', [255, 90, 44]], ['O', [244, 237, 32]], ['S', [255, 38, 161]]] as [$buchstabe, $farbe]) {
        $pdf->SetTextColor($farbe[0], $farbe[1], $farbe[2]);
        $pdf->Cell(4.5, 7, $buchstabe, 0, 0);
    }
    $pdf->SetTextColor(0, 0, 0);
    $pdf->SetFont('Helvetica', 'B', 11);
    $pdf->SetXY($x0 + 40, $y0 + 4);
    $pdf->Cell($breite - 45, 7, pdfText((string) $b['carrier']), 0, 0, 'R');
    $pdf->SetFont('Helvetica', '', 7);
    $pdf->SetTextColor(100, 100, 100);
    $pdf->SetXY($x0 + 5, $y0 + 11);
    $pdf->Cell($breite - 10, 4, pdfText(($b['art'] === 'retoure' ? 'RETOURE · ' : '') . 'Vorläufiges Label — das Carrier-Label folgt mit der Anbindung'), 0, 0);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Line($x0 + 5, $y0 + 16, $x0 + $breite - 5, $y0 + 16);

    // Absender klein
    $pdf->SetXY($x0 + 5, $y0 + 18);
    $pdf->SetFont('Helvetica', '', 7);
    $pdf->SetTextColor(90, 90, 90);
    $pdf->Cell($breite - 10, 4, pdfText('Absender: ' . implode(', ', array_filter([$abs['name'] ?? '', $abs['strasse'] ?? '', trim(($abs['plz'] ?? '') . ' ' . ($abs['ort'] ?? ''))]))), 0, 0);
    $pdf->SetTextColor(0, 0, 0);

    // Empfänger groß
    $pdf->SetXY($x0 + 5, $y0 + 26);
    $pdf->SetFont('Helvetica', '', 7);
    $pdf->SetTextColor(100, 100, 100);
    $pdf->Cell(0, 4, pdfText('EMPFÄNGER'), 0, 1);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->SetFont('Helvetica', 'B', 13);
    $pdf->SetX($x0 + 5);
    $pdf->Cell($breite - 10, 7, pdfText((string) ($emp['name'] ?? '')), 0, 1);
    $pdf->SetFont('Helvetica', '', 11);
    if (($emp['firma'] ?? '') !== '') {
        $pdf->SetX($x0 + 5);
        $pdf->Cell($breite - 10, 6, pdfText((string) $emp['firma']), 0, 1);
    }
    $pdf->SetX($x0 + 5);
    $pdf->Cell($breite - 10, 6, pdfText((string) ($emp['strasse'] ?? '')), 0, 1);
    $pdf->SetFont('Helvetica', 'B', 13);
    $pdf->SetX($x0 + 5);
    $pdf->Cell($breite - 10, 7, pdfText(trim(($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''))), 0, 1);
    $pdf->SetFont('Helvetica', 'B', 11);
    $pdf->SetX($x0 + 5);
    $pdf->Cell($breite - 10, 6, pdfText(strtoupper($land) . ' · ' . $b['zielland']), 0, 1);

    // Kasten mit Gewicht, Leistungen, Referenz
    $y = $y0 + 78;
    $pdf->SetFont('Helvetica', '', 8);
    $pdf->SetXY($x0 + 5, $y);
    $zeilen = [
        kategorieName((string) ($b['kategorie'] ?? 'paket')) . ' · Gewichtsklasse ' . $b['gewichtsklasse'] . ((int) $b['gewicht_gramm'] > 0 ? ' · ' . number_format((int) $b['gewicht_gramm'] / 1000, 2, ',', '') . ' kg' : ''),
        $zusatz !== [] ? 'Leistungen: ' . implode(', ', array_map(static fn (array $z): string => $z['name']['de'] ?? $z['code'], $zusatz)) : '',
        (string) $b['referenz'] !== '' ? 'Referenz: ' . $b['referenz'] : '',
        (int) $b['nachnahme_cent'] > 0 ? 'Nachnahme: ' . number_format((int) $b['nachnahme_cent'] / 100, 2, ',', '.') . ' EUR' : '',
    ];
    foreach (array_filter($zeilen) as $zeile) {
        $pdf->SetX($x0 + 5);
        $pdf->Cell($breite - 10, 4.5, pdfText($zeile), 0, 1);
    }
    // Gewichtssymbol ab 10 kg bzw. 20 kg (Carrier verlangen die Kennzeichnung schwerer Pakete)
    $maxGramm = (int) (preisliste()['gewichtsklassen'][$b['gewichtsklasse']]['max_gramm'] ?? 0);
    $schwer = max($maxGramm, (int) $b['gewicht_gramm']);
    if ($schwer > 10000) {
        $pdf->SetFillColor(0, 0, 0);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('Helvetica', 'B', 11);
        $pdf->SetXY($x0 + $breite - 33, $y0 + 78);
        $pdf->Cell(28, 9, pdfText($schwer > 20000 ? '> 20 kg' : '> 10 kg'), 0, 0, 'C', true);
        $pdf->SetTextColor(0, 0, 0);
    }

    // Strichcode
    code128Zeichnen($pdf, (string) $b['ext_ref'], $x0 + 10, $y0 + 108, 22, $breite - 20);
    $pdf->SetFont('Helvetica', 'B', 11);
    $pdf->SetXY($x0 + 5, $y0 + 131);
    $pdf->Cell($breite - 10, 6, pdfText((string) $b['ext_ref']), 0, 0, 'C');
    $pdf->SetFont('Helvetica', '', 6.5);
    $pdf->SetTextColor(120, 120, 120);
    $pdf->SetXY($x0 + 5, $y0 + 139);
    $pdf->Cell($breite - 10, 4, pdfText('neos24.com · Sendungsverfolgung mit Nummer und PLZ des Empfängers'), 0, 0, 'C');
    $pdf->SetTextColor(0, 0, 0);
}

/** PDF-Inhalt: A6 je Sendung oder A4 mit vier Labels je Seite. */
function labelPdf(array $bestellungen, string $format = 'a6'): string
{
    $pdf = $format === 'a4' ? new FPDF('P', 'mm', 'A4') : new FPDF('P', 'mm', [105, 148]);
    $pdf->SetAutoPageBreak(false);
    $pdf->SetMargins(0, 0, 0);
    $pdf->SetTitle(pdfText('NEOS Label'), true);
    $pdf->SetCreator(pdfText('NEOS Kundenportal'));
    if ($format === 'a4') {
        $plaetze = [[0, 0], [105, 0], [0, 148.5], [105, 148.5]];
        foreach (array_values($bestellungen) as $i => $b) {
            if ($i % 4 === 0) {
                $pdf->AddPage();
            }
            [$x, $y] = $plaetze[$i % 4];
            labelZeichnen($pdf, $b, $x, $y);
        }
    } else {
        foreach ($bestellungen as $b) {
            $pdf->AddPage();
            labelZeichnen($pdf, $b, 0, 0);
        }
    }

    return $pdf->Output('S');
}
