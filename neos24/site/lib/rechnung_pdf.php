<?php

/**
 * Rechnungs-PDF mit FPDF (vendored, Kernschriften in cp1252 — deshalb läuft
 * jeder Text durch pdfText()). Absender und Bankverbindung kommen aus
 * konfig()['firma']; Pflichtangaben vor Livegang füllen.
 */

declare(strict_types=1);

require_once __DIR__ . '/pdf/fpdf.php';

/** UTF-8 → cp1252 für die FPDF-Kernschriften. */
function pdfText(string $text): string
{
    $umgewandelt = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);

    return $umgewandelt === false ? preg_replace('/[^\x20-\x7E\n]/', '?', $text) ?? '' : $umgewandelt;
}

/** PDF schreiben; liefert den Dateipfad. */
function rechnungPdfErzeugen(array $rechnung, array $firma, array $positionen): string
{
    $k = konfig();
    $abs = $k['firma'];
    $mwstSatz = (int) $k['mwstSatz'];
    $verzeichnis = rtrim((string) $k['daten'], '/') . '/rechnungen';
    if (!is_dir($verzeichnis) && !@mkdir($verzeichnis, 0770, true) && !is_dir($verzeichnis)) {
        throw new RuntimeException('Rechnungsverzeichnis nicht anlegbar: ' . $verzeichnis);
    }
    $pfad = $verzeichnis . '/' . basename((string) $rechnung['pdf_datei']);
    $landName = static fn (string $code): string => preisliste()['laender'][$code]['name']['de'] ?? $code;

    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->SetAutoPageBreak(true, 28);
    $pdf->SetTitle(pdfText('Rechnung ' . $rechnung['nummer']), true);
    $pdf->SetCreator(pdfText('NEOS Kundenportal'));
    $pdf->SetMargins(20, 20, 20);
    $pdf->AddPage();

    // Wortmarke in den vier Markenfarben
    $pdf->SetFont('Helvetica', 'B', 22);
    foreach ([['N', [41, 211, 245]], ['E', [255, 90, 44]], ['O', [244, 237, 32]], ['S', [255, 38, 161]]] as [$buchstabe, $farbe]) {
        $pdf->SetTextColor($farbe[0], $farbe[1], $farbe[2]);
        $pdf->Cell(7, 10, $buchstabe, 0, 0);
    }
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Ln(12);

    // Absenderzeile und Rechnungsanschrift
    $pdf->SetFont('Helvetica', '', 8);
    $pdf->SetTextColor(110, 110, 110);
    $pdf->Cell(0, 5, pdfText(implode(' · ', array_filter([$abs['name'], $abs['strasse'], trim($abs['plz'] . ' ' . $abs['ort'])]))), 0, 1);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Ln(2);
    $pdf->SetFont('Helvetica', '', 10);
    $anschrift = array_filter([$firma['name'], $firma['strasse'], trim($firma['plz'] . ' ' . $firma['ort']), $firma['land'] !== 'DE' ? $landName((string) $firma['land']) : '']);
    $y = $pdf->GetY();
    foreach ($anschrift as $zeile) {
        $pdf->Cell(100, 5, pdfText((string) $zeile), 0, 1);
    }

    // Kopfdaten rechts
    $pdf->SetXY(120, $y);
    $kopf = [
        ['Rechnungsnummer', (string) $rechnung['nummer']],
        ['Rechnungsdatum', datumAnzeigen($rechnung['erstellt'])],
        ['Leistungszeitraum', datumAnzeigen($rechnung['zeitraum_von']) . ' – ' . datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $rechnung['zeitraum_bis']) - 1))],
        ['Fällig am', datumAnzeigen($rechnung['faellig'] . 'T00:00:00Z')],
    ];
    if ((string) $firma['ust_id'] !== '') {
        $kopf[] = ['USt-ID Kunde', (string) $firma['ust_id']];
    }
    foreach ($kopf as [$bez, $wert]) {
        $pdf->SetX(120);
        $pdf->SetFont('Helvetica', '', 8);
        $pdf->SetTextColor(110, 110, 110);
        $pdf->Cell(32, 5, pdfText($bez), 0, 0);
        $pdf->SetFont('Helvetica', 'B', 9);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->Cell(0, 5, pdfText($wert), 0, 1);
    }
    $pdf->SetY(max($pdf->GetY(), $y + 5 * count($anschrift)) + 10);

    $pdf->SetFont('Helvetica', 'B', 16);
    $pdf->Cell(0, 9, pdfText('Rechnung ' . $rechnung['nummer']), 0, 1);
    $pdf->SetFont('Helvetica', '', 9);
    $pdf->SetTextColor(90, 90, 90);
    $pdf->Cell(0, 5, pdfText('Sammelrechnung für Sendungen über das NEOS-Kundenportal. Alle Beträge netto in Euro.'), 0, 1);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Ln(4);

    // Positionen
    $spalten = [['Datum', 20, 'L'], ['Sendung', 30, 'L'], ['Referenz', 30, 'L'], ['Ziel', 30, 'L'], ['Gewicht', 18, 'L'], ['Carrier', 22, 'L'], ['Netto', 20, 'R']];
    $kopfZeile = function () use ($pdf, $spalten): void {
        $pdf->SetFont('Helvetica', 'B', 8);
        $pdf->SetFillColor(246, 247, 250);
        foreach ($spalten as [$name, $breite, $ausrichtung]) {
            $pdf->Cell($breite, 7, pdfText($name), 'B', 0, $ausrichtung, true);
        }
        $pdf->Ln();
    };
    $kopfZeile();
    $pdf->SetFont('Helvetica', '', 8);
    foreach ($positionen as $p) {
        if ($pdf->GetY() > 250) {
            $pdf->AddPage();
            $kopfZeile();
            $pdf->SetFont('Helvetica', '', 8);
        }
        $werte = [
            datumAnzeigen($p['erstellt']),
            (string) $p['ext_ref'],
            mb_substr((string) ($p['referenz'] ?? ''), 0, 18),
            mb_substr($landName((string) $p['zielland']), 0, 18),
            (string) $p['gewichtsklasse'],
            mb_substr((string) ($p['carrier'] ?? ''), 0, 14),
            number_format((int) $p['netto_cent'] / 100, 2, ',', '.'),
        ];
        foreach ($spalten as $i => [$name, $breite, $ausrichtung]) {
            $pdf->Cell($breite, 6, pdfText($werte[$i]), 'B', 0, $ausrichtung);
        }
        $pdf->Ln();
    }

    // Summen
    $pdf->Ln(3);
    $summe = function (string $bez, int $cent, bool $fett = false) use ($pdf): void {
        $pdf->SetFont('Helvetica', $fett ? 'B' : '', $fett ? 10 : 9);
        $pdf->Cell(130, 6, pdfText($bez), 0, 0, 'R');
        $pdf->Cell(40, 6, pdfText(number_format($cent / 100, 2, ',', '.') . ' €'), $fett ? 'T' : 0, 1, 'R');
    };
    $summe('Netto (' . count($positionen) . ' Sendungen)', (int) $rechnung['netto_cent']);
    $summe('zzgl. ' . $mwstSatz . ' % MwSt.', (int) $rechnung['mwst_cent']);
    $summe('Rechnungsbetrag', (int) $rechnung['brutto_cent'], true);
    $pdf->Ln(6);

    $pdf->SetFont('Helvetica', '', 9);
    $pdf->MultiCell(0, 5, pdfText('Bitte überweisen Sie den Rechnungsbetrag bis zum ' . datumAnzeigen($rechnung['faellig'] . 'T00:00:00Z') . ' unter Angabe der Rechnungsnummer ' . $rechnung['nummer'] . '.'));
    if ((string) $abs['iban'] !== '') {
        $pdf->Ln(2);
        $pdf->Cell(0, 5, pdfText('Bankverbindung: ' . implode(' · ', array_filter([$abs['bank'], 'IBAN ' . $abs['iban'], $abs['bic'] !== '' ? 'BIC ' . $abs['bic'] : '']))), 0, 1);
    }

    // Fußzeile — ohne automatischen Seitenumbruch, sonst rutscht sie auf eine neue Seite.
    $pdf->SetAutoPageBreak(false);
    $pdf->SetY(-22);
    $pdf->SetFont('Helvetica', '', 7);
    $pdf->SetTextColor(110, 110, 110);
    $fuss = array_filter([
        $abs['name'], $abs['strasse'], trim($abs['plz'] . ' ' . $abs['ort']),
        $abs['ustId'] !== '' ? 'USt-IdNr. ' . $abs['ustId'] : '',
        $abs['registergericht'] !== '' ? $abs['registergericht'] : '',
        $abs['geschaeftsfuehrung'] !== '' ? 'Geschäftsführung: ' . $abs['geschaeftsfuehrung'] : '',
        $abs['email'], $abs['web'],
    ]);
    $pdf->MultiCell(0, 4, pdfText(implode(' · ', $fuss)), 0, 'C');

    $pdf->Output('F', $pfad);

    return $pfad;
}
