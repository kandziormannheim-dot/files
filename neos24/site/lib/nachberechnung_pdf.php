<?php

/**
 * Nachweis zur Gewichtsnachberechnung als PDF (FPDF, Kernschriften): erklärt
 * dem Kunden, was gebucht war, was der Carrier gewogen hat und wie sich die
 * Differenz nach seiner Preisliste ergibt. Anlage zur Rechnung (Lexware) und
 * Anhang der Mail. Enthält keine Angaben zum Lieferanten — nur den Carrier
 * der Sendung, weil er die Wiegung vorgenommen hat.
 */

declare(strict_types=1);

require_once __DIR__ . '/pdf/fpdf.php';
require_once __DIR__ . '/rechnung_pdf.php'; // pdfText()

function nachberechnungVerzeichnis(): string
{
    $pfad = rtrim((string) konfig()['daten'], '/') . '/nachberechnungen';
    if (!is_dir($pfad) && !@mkdir($pfad, 0770, true) && !is_dir($pfad)) {
        throw new RuntimeException('Verzeichnis nicht anlegbar: ' . $pfad);
    }

    return $pfad;
}

/** Pfad des Nachweises einer Nachberechnung (leer, wenn keiner erzeugt wurde). */
function nachberechnungNachweisPfad(array $nb): string
{
    $datei = (string) ($nb['beleg_datei'] ?? '');

    return $datei !== '' ? nachberechnungVerzeichnis() . '/' . basename($datei) : '';
}

/** Nachweis erzeugen und an der Nachberechnung vermerken; liefert den Pfad. */
function nachberechnungNachweisErzeugen(array $nb, array $original): string
{
    $datei = 'Nachweis-' . $nb['ext_ref'] . '.pdf';
    $pfad = nachberechnungVerzeichnis() . '/' . $datei;
    file_put_contents($pfad, nachberechnungNachweisPdf($nb, $original));
    datenbank()->prepare('UPDATE bestellungen SET beleg_datei = ? WHERE id = ?')->execute([$datei, $nb['id']]);

    return $pfad;
}

/** PDF-Inhalt (Bytes). */
function nachberechnungNachweisPdf(array $nb, array $original): string
{
    $k = konfig();
    $abs = $k['firma'];
    $sprache = ($nb['sprache'] ?? 'de') === 'en' ? 'en' : 'de';
    $en = $sprache === 'en';
    $grund = json_decode((string) ($nb['nachberechnung_json'] ?? '{}'), true) ?: [];
    $kunde = json_decode((string) $original['absender_json'], true) ?: [];
    $firma = $original['firma_id'] ? firmaLaden((int) $original['firma_id']) : null;
    $empfaenger = json_decode((string) $original['empfaenger_json'], true) ?: [];
    $mwstSatz = (int) $k['mwstSatz'];
    $kg = static fn (int $gramm): string => number_format($gramm / 1000, 2, $en ? '.' : ',', $en ? ',' : '.') . ' kg';
    $eur = static fn (int $cent): string => number_format($cent / 100, 2, $en ? '.' : ',', $en ? ',' : '.') . ' €';
    $klasseName = static function (string $code) use ($sprache): string {
        $gk = preisliste()['gewichtsklassen'][$code] ?? null;

        return $gk !== null ? $gk[$sprache] . ' (' . $code . ')' : $code;
    };
    $landName = preisliste()['laender'][$original['zielland']]['name'][$sprache] ?? $original['zielland'];
    $gebuehr = (int) ($grund['gebuehr'] ?? 0);
    $verkaufBestellt = (int) ($grund['verkauf_bestellt'] ?? 0);
    $verkaufIst = (int) ($grund['verkauf_ist'] ?? 0);
    $differenz = (int) $nb['netto_cent'] - $gebuehr;
    $frist = (int) ($k['rechnungspruefung']['widerspruchTage'] ?? 14);
    $basis = rtrim((string) $k['basisUrl'], '/');

    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->SetAutoPageBreak(true, 28);
    $pdf->SetTitle(pdfText(($en ? 'Weight deviation record ' : 'Nachweis Gewichtsabweichung ') . $nb['ext_ref']), true);
    $pdf->SetCreator(pdfText('NEOS Kundenportal'));
    $pdf->SetMargins(20, 20, 20);
    $pdf->AddPage();

    $pdf->SetFont('Helvetica', 'B', 22);
    foreach ([['N', [41, 211, 245]], ['E', [255, 90, 44]], ['O', [244, 237, 32]], ['S', [255, 38, 161]]] as [$buchstabe, $farbe]) {
        $pdf->SetTextColor($farbe[0], $farbe[1], $farbe[2]);
        $pdf->Cell(7, 10, $buchstabe, 0, 0);
    }
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Ln(12);

    $pdf->SetFont('Helvetica', '', 8);
    $pdf->SetTextColor(110, 110, 110);
    $pdf->Cell(0, 5, pdfText(implode(' · ', array_filter([$abs['name'], $abs['strasse'], trim($abs['plz'] . ' ' . $abs['ort'])]))), 0, 1);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Ln(2);
    $pdf->SetFont('Helvetica', '', 10);
    $anschrift = $firma !== null
        ? array_filter([$firma['name'], $firma['strasse'], trim($firma['plz'] . ' ' . $firma['ort'])])
        : array_filter([$kunde['name'] ?? '', $kunde['firma'] ?? '', $kunde['strasse'] ?? '', trim(($kunde['plz'] ?? '') . ' ' . ($kunde['ort'] ?? ''))]);
    $y = $pdf->GetY();
    foreach ($anschrift as $zeile) {
        $pdf->Cell(100, 5, pdfText((string) $zeile), 0, 1);
    }
    $pdf->SetXY(120, $y);
    $kopf = [
        [$en ? 'Record no.' : 'Beleg-Nr.', (string) $nb['ext_ref']],
        [$en ? 'Date' : 'Datum', datumAnzeigen($nb['erstellt'], $sprache)],
        [$en ? 'Shipment' : 'Sendung', (string) $original['ext_ref']],
    ];
    if ((string) $original['referenz'] !== '') {
        $kopf[] = [$en ? 'Your reference' : 'Ihre Referenz', (string) $original['referenz']];
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
    $pdf->Cell(0, 9, pdfText($en ? 'Weight deviation record' : 'Nachweis Gewichtsabweichung'), 0, 1);
    $pdf->SetFont('Helvetica', '', 9.5);
    $pdf->SetTextColor(60, 60, 60);
    $pdf->MultiCell(0, 5, pdfText($en
        ? 'The carrier weighed the parcel during transport. The measured weight is higher than the weight entered when booking, so the shipment falls into a higher weight class. We charge the difference between the shipping prices of the two classes according to your price terms.'
        : 'Der Carrier hat das Paket beim Transport gewogen. Das gemessene Gewicht liegt über dem bei der Buchung angegebenen Gewicht, deshalb fällt die Sendung in eine höhere Gewichtsklasse. Wir berechnen die Differenz zwischen den Versandpreisen beider Klassen nach Ihren Preiskonditionen.'));
    $pdf->SetTextColor(0, 0, 0);
    $pdf->Ln(4);

    // Sendung
    $tabelle = static function (array $zeilen) use ($pdf): void {
        foreach ($zeilen as [$bez, $wert, $fett]) {
            $pdf->SetFont('Helvetica', '', 9);
            $pdf->SetTextColor(90, 90, 90);
            $pdf->Cell(70, 6.5, pdfText($bez), 'B', 0);
            $pdf->SetFont('Helvetica', $fett ? 'B' : '', 9);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->Cell(0, 6.5, pdfText($wert), 'B', 1, 'R');
        }
    };
    $pdf->SetFont('Helvetica', 'B', 10);
    $pdf->Cell(0, 7, pdfText($en ? 'Shipment' : 'Sendung'), 0, 1);
    $tabelle([
        [$en ? 'Shipment number' : 'Sendungsnummer', (string) $original['ext_ref'], false],
        [$en ? 'Booked on' : 'Gebucht am', datumAnzeigen($original['erstellt'], $sprache), false],
        [$en ? 'Destination' : 'Zielland', $landName . ', ' . ($empfaenger['ort'] ?? ''), false],
        [$en ? 'Carrier' : 'Carrier', (string) ($original['carrier'] ?? ''), false],
        [$en ? 'Carrier shipment no.' : 'Carrier-Sendungsnummer', (string) ($original['carrier_sendungsnummer'] ?: '—'), false],
    ]);
    $pdf->Ln(5);

    // Gewicht
    $pdf->SetFont('Helvetica', 'B', 10);
    $pdf->Cell(0, 7, pdfText($en ? 'Weight' : 'Gewicht'), 0, 1);
    $tabelle([
        [$en ? 'Weight entered when booking' : 'Angegebenes Gewicht bei der Buchung', (int) $original['gewicht_gramm'] > 0 ? $kg((int) $original['gewicht_gramm']) : '—', false],
        [$en ? 'Booked weight class' : 'Gebuchte Gewichtsklasse', $klasseName((string) ($grund['gk_bestellt'] ?? $original['gewichtsklasse'])), false],
        [$en ? 'Weight measured by the carrier' : 'Vom Carrier gemessenes Gewicht', $kg((int) ($grund['gewicht_gramm'] ?? 0)), true],
        [$en ? 'Applicable weight class' : 'Zutreffende Gewichtsklasse', $klasseName((string) ($grund['gk_ist'] ?? $nb['gewichtsklasse'])), true],
    ]);
    $pdf->Ln(5);

    // Berechnung
    $pdf->SetFont('Helvetica', 'B', 10);
    $pdf->Cell(0, 7, pdfText($en ? 'Calculation (net, per your price terms)' : 'Berechnung (netto, nach Ihren Preiskonditionen)'), 0, 1);
    $zeilen = [];
    if ($verkaufIst > 0) {
        $zeilen[] = [$en ? 'Shipping price of the applicable class' : 'Versandpreis der zutreffenden Klasse', $eur($verkaufIst), false];
        $zeilen[] = [$en ? 'Shipping price of the booked class (already charged)' : 'Versandpreis der gebuchten Klasse (bereits berechnet)', '− ' . $eur($verkaufBestellt), false];
    }
    $zeilen[] = [$en ? 'Difference' : 'Differenz', $eur($differenz), $gebuehr === 0];
    if ($gebuehr > 0) {
        $zeilen[] = [$en ? 'Carrier fee for weight deviation' : 'Gebühr des Carriers für die Gewichtsabweichung', $eur($gebuehr), false];
    }
    $zeilen[] = [$en ? 'Adjustment net' : 'Nachberechnung netto', $eur((int) $nb['netto_cent']), true];
    if (!$original['firma_id']) {
        $zeilen[] = [($en ? 'VAT ' : 'MwSt. ') . $mwstSatz . ' %', $eur((int) $nb['mwst_cent']), false];
        $zeilen[] = [$en ? 'Adjustment gross' : 'Nachberechnung brutto', $eur((int) $nb['betrag_cent']), true];
    }
    $tabelle($zeilen);
    $pdf->Ln(5);

    $pdf->SetFont('Helvetica', '', 9);
    $zahlung = match ((string) $nb['zahlungsart']) {
        'rechnung' => $en ? 'The amount is invoiced as a separate line on your next collective invoice.' : 'Der Betrag wird als eigene Position auf Ihrer nächsten Sammelrechnung berechnet.',
        'guthaben' => $en ? 'The amount was debited from your NEOS credit; you receive a separate invoice.' : 'Der Betrag wurde von Ihrem NEOS-Guthaben abgebucht; Sie erhalten dazu eine gesonderte Rechnung.',
        default => $en ? 'Please settle the amount in the customer portal; the invoice follows after payment.' : 'Bitte begleichen Sie den Betrag im Kundenportal; die Rechnung folgt nach der Zahlung.',
    };
    $pdf->MultiCell(0, 5, pdfText($zahlung));
    $pdf->Ln(2);
    $pdf->MultiCell(0, 5, pdfText($en
        ? 'Objection: if you believe the measurement is wrong, you can object in the customer portal within ' . $frist . ' days of this record (' . $basis . '/konto/). Please add evidence such as a weighing record or a photo of the scale. Tip: weigh parcels before booking — the weight class is chosen from the weight you enter.'
        : 'Widerspruch: Halten Sie die Messung für falsch, können Sie innerhalb von ' . $frist . ' Tagen ab diesem Beleg im Kundenportal widersprechen (' . $basis . '/konto/). Bitte fügen Sie Belege bei, etwa ein Wiegeprotokoll oder ein Foto der Waage. Tipp: Pakete vor der Buchung wiegen — die Gewichtsklasse ergibt sich aus dem eingegebenen Gewicht.'));

    $pdf->SetAutoPageBreak(false);
    $pdf->SetY(-22);
    $pdf->SetFont('Helvetica', '', 7);
    $pdf->SetTextColor(110, 110, 110);
    $fuss = array_filter([$abs['name'], $abs['strasse'], trim($abs['plz'] . ' ' . $abs['ort']), $abs['ustId'] !== '' ? 'USt-IdNr. ' . $abs['ustId'] : '', $abs['email'], $abs['web']]);
    $pdf->MultiCell(0, 4, pdfText(implode(' · ', $fuss)), 0, 'C');

    return $pdf->Output('S');
}
