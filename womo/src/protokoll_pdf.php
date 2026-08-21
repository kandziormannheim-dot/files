<?php

/**
 * Erzeugt das Übergabe-/Rückgabeprotokoll als PDF (FPDF, vendored).
 *
 * FPDF arbeitet mit den PDF-Kernschriften in cp1252 — deshalb läuft jeder
 * Text durch pdfText(). Für Deutsch und Englisch reicht das vollständig.
 */

declare(strict_types=1);

require_once __DIR__ . '/pdf/fpdf.php';

/** UTF-8 → cp1252 für die FPDF-Kernschriften. */
function pdfText(string $text): string
{
    $umgewandelt = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);

    return $umgewandelt === false ? preg_replace('/[^\x20-\x7E\n]/', '?', $text) ?? '' : $umgewandelt;
}

/**
 * Protokoll-PDF bauen und im Datenverzeichnis ablegen.
 * Liefert den Dateinamen (relativ zum pdf/-Unterordner).
 *
 * @param array $protokoll   Zeile aus protokolle (Unterschriften schon gesetzt)
 * @param array $vermietung  Zeile aus vermietungen
 * @param array $vorschaeden Schäden, die vor diesem Protokoll dokumentiert waren
 * @param array $neue        Schäden dieses Protokolls, je mit 'fotos'-Liste
 */
function protokollPdfErzeugen(
    array $konfig,
    array $protokoll,
    array $vermietung,
    array $vorschaeden,
    array $neue
): string {
    $sprache = ($vermietung['sprache'] ?? 'de') === 'en' ? 'en' : 'de';
    $titel = t($sprache, 'protokoll.' . $protokoll['typ']);

    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->SetAutoPageBreak(true, 20);
    $pdf->SetTitle(pdfText($titel), true);
    $pdf->SetCreator(pdfText('Womo-Schadensakte'));
    $pdf->AddPage();

    // ------------------------------------------------------------- Kopfbereich
    $pdf->SetFont('Helvetica', 'B', 18);
    $pdf->Cell(0, 10, pdfText($titel), 0, 1);
    $pdf->SetFont('Helvetica', '', 10);
    $pdf->SetTextColor(90, 90, 90);
    $pdf->Cell(0, 6, pdfText($konfig['fahrzeugName']
        . ($konfig['kennzeichen'] !== '' ? ' — ' . $konfig['kennzeichen'] : '')), 0, 1);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Ln(4);

    $zeile = static function (string $bezeichnung, string $wert) use ($pdf): void {
        $pdf->SetFont('Helvetica', 'B', 10);
        $pdf->Cell(48, 6, pdfText($bezeichnung), 0, 0);
        $pdf->SetFont('Helvetica', '', 10);
        $pdf->MultiCell(0, 6, pdfText($wert));
    };

    $zeile(t($sprache, 'protokoll.mieter'), (string) $vermietung['name']);
    $zeile(
        t($sprache, 'protokoll.zeitraum'),
        datumAnzeigen($vermietung['von']) . ' – ' . datumAnzeigen($vermietung['bis'])
    );
    $zeile(t($sprache, 'protokoll.datum'), zeitAnzeigen($protokoll['erstellt_am']));
    if ((string) $protokoll['km_stand'] !== '') {
        $zeile(t($sprache, 'protokoll.km'), (string) $protokoll['km_stand']);
    }
    if ((string) $protokoll['bemerkung'] !== '') {
        $zeile(t($sprache, 'protokoll.bemerkung'), (string) $protokoll['bemerkung']);
    }
    $pdf->Ln(4);

    // ------------------------------------------------------------- Vorschäden
    $pdf->SetFont('Helvetica', 'B', 12);
    $pdf->Cell(0, 8, pdfText(t($sprache, 'protokoll.vorschaeden')), 0, 1);
    $pdf->SetFont('Helvetica', '', 10);
    if ($vorschaeden === []) {
        $pdf->Cell(0, 6, pdfText(t($sprache, 'vorschaeden.keine')), 0, 1);
    } else {
        foreach ($vorschaeden as $schaden) {
            $pdf->MultiCell(0, 5.5, pdfText(sprintf(
                "- %s (%s, %s): %s",
                zonenName((string) $schaden['zone'], $sprache),
                statusName((string) $schaden['status'], $sprache),
                datumAnzeigen((string) $schaden['erstellt_am']),
                (string) $schaden['beschreibung']
            )));
        }
    }
    $pdf->Ln(4);

    // ------------------------------------------------------ Neue Schäden + Fotos
    $pdf->SetFont('Helvetica', 'B', 12);
    $pdf->Cell(0, 8, pdfText(t($sprache, 'protokoll.neue')), 0, 1);
    if ($neue === []) {
        $pdf->SetFont('Helvetica', '', 10);
        $pdf->Cell(0, 6, pdfText(t($sprache, 'protokoll.keine_neuen')), 0, 1);
    }
    $fotoOrdner = datenPfad($konfig, 'fotos');
    foreach ($neue as $nr => $schaden) {
        $pdf->SetFont('Helvetica', 'B', 10);
        $pdf->MultiCell(0, 6, pdfText(sprintf(
            '%d. %s — %s',
            $nr + 1,
            zonenName((string) $schaden['zone'], $sprache),
            zeitAnzeigen((string) $schaden['erstellt_am'])
        )));
        $pdf->SetFont('Helvetica', '', 10);
        $pdf->MultiCell(0, 5.5, pdfText((string) $schaden['beschreibung']));

        // Fotos zweispaltig, jedes höchstens 80 mm breit.
        $x = $pdf->GetX();
        $spalte = 0;
        foreach ($schaden['fotos'] ?? [] as $foto) {
            $pfad = $fotoOrdner . '/' . $foto['datei'];
            if (!is_file($pfad)) {
                continue;
            }
            [$px, $py] = getimagesize($pfad) ?: [4, 3];
            $breite = 80.0;
            $hoehe = $breite * $py / max(1, $px);
            if ($pdf->GetY() + $hoehe > 275) {
                $pdf->AddPage();
                $spalte = 0;
            }
            $pdf->Image($pfad, $x + $spalte * 90, $pdf->GetY() + 2, $breite);
            if ($spalte === 1 || $foto === end($schaden['fotos'])) {
                $pdf->SetY($pdf->GetY() + $hoehe + 4);
                $spalte = 0;
            } else {
                $spalte = 1;
            }
        }
        $pdf->Ln(3);
    }
    $pdf->Ln(6);

    // ---------------------------------------------------------- Unterschriften
    if ($pdf->GetY() > 220) {
        $pdf->AddPage();
    }
    $unterschriftOrdner = datenPfad($konfig, 'unterschriften');
    $y = $pdf->GetY();
    $felder = [
        ['unterschrift_mieter', t($sprache, 'protokoll.unterschrift_mieter'), 10],
        ['unterschrift_vermieter', t($sprache, 'protokoll.unterschrift_vermieter'), 105],
    ];
    foreach ($felder as [$spalteName, $bezeichnung, $x]) {
        $datei = (string) $protokoll[$spalteName];
        $pfad = $unterschriftOrdner . '/' . $datei;
        if ($datei !== '' && is_file($pfad)) {
            $pdf->Image($pfad, (float) $x, $y, 70);
        }
        $pdf->SetXY((float) $x, $y + 28);
        $pdf->Cell(80, 5, '', 'T', 0);
        $pdf->SetXY((float) $x, $y + 33);
        $pdf->SetFont('Helvetica', '', 9);
        $pdf->Cell(80, 5, pdfText($bezeichnung), 0, 0);
    }
    $pdf->SetY($y + 42);
    $pdf->SetFont('Helvetica', '', 9);
    $pdf->SetTextColor(90, 90, 90);
    $pdf->Cell(0, 5, pdfText(
        t($sprache, 'protokoll.abgeschlossen') . ': ' . zeitAnzeigen(gmdate('Y-m-d H:i:s'))
    ), 0, 1);

    $name = sprintf(
        'protokoll-%d-%s-%s.pdf',
        (int) $protokoll['id'],
        $protokoll['typ'],
        gmdate('Ymd-His')
    );
    $pdf->Output('F', datenPfad($konfig, 'pdf') . '/' . $name);

    return $name;
}
