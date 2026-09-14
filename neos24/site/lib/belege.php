<?php

/**
 * Rechnungsarchiv: alle Belege eines Kontos in einer Liste — Sammelrechnungen
 * (Firmen), Einzelrechnungen aus Lexware je bezahlter Bestellung und
 * Nachberechnung, Gutschriften und Nachweise zur Gewichtsabweichung. Die
 * Belege selbst kommen aus Lexware (kein eigener Nachbau); ohne PDF steht der
 * Eintrag mit „wird erstellt“ in der Liste. Genutzt vom Portal (konto/rechnungen)
 * und vom Dashboard (Privatkunde → Belege).
 */

declare(strict_types=1);

const BELEG_ARTEN = ['sammelrechnung', 'rechnung', 'nachberechnung', 'gutschrift', 'nachweis'];

/** Geltungsbereich für Bestellungen (wie konto/src/sendungen.php bereich()), hier ohne Portal-Abhängigkeit. */
function belegBereich(array $kunde): array
{
    if (($kunde['art'] ?? '') === 'business' && (int) ($kunde['firma_id'] ?? 0) > 0) {
        $wo = 'b.firma_id = ?';
        $werte = [(int) $kunde['firma_id']];
        $fest = ($kunde['firmenrolle'] ?? '') !== 'inhaber' ? (int) ($kunde['unterkunde_id'] ?? 0) : 0;
        if ($fest > 0) {
            $wo .= ' AND b.unterkunde_id = ?';
            $werte[] = $fest;
        }

        return [$wo, $werte, $fest];
    }

    return ['b.kunde_id = ? AND b.firma_id IS NULL', [(int) $kunde['id']], 0];
}

/**
 * Belege eines Kontos, neueste zuerst. Jeder Eintrag: art, nummer, datum (ISO),
 * betrag_cent (Gutschrift negativ, Nachweis null), status, bezug (Sendung oder
 * Zeitraum), ext_ref, kundennummer, pdf (Pfad oder ''), datei (Download-Name),
 * pfad (Portal-Pfad relativ zu konto/, ohne PDF-Prüfung) und detail (Portal-Pfad).
 * Liefert ['belege' => [...], 'jahre' => [...], 'summe_cent' => int].
 */
function belegeFuerKonto(array $kunde, ?int $jahr = null, string $suche = '', string $art = ''): array
{
    $db = datenbank();
    [$wo, $werte, $fest] = belegBereich($kunde);
    $business = ($kunde['art'] ?? '') === 'business';
    $liste = $business ? 'sendungen' : 'bestellungen';
    $belege = [];
    // Sammelrechnungen der Firma (bei fester Zuordnung nur die des Unterkunden)
    if ($business) {
        $st = $db->prepare(RECHNUNG_SELECT . ' WHERE r.firma_id = ?' . ($fest > 0 ? ' AND r.unterkunde_id = ?' : '') . ' ORDER BY r.id DESC');
        $st->execute($fest > 0 ? [(int) $kunde['firma_id'], $fest] : [(int) $kunde['firma_id']]);
        foreach ($st->fetchAll() as $r) {
            $entwurf = str_starts_with((string) $r['nummer'], 'ENTWURF-');
            $pdf = rechnungPfad($r);
            $bis = gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1);
            $belege[] = ['art' => 'sammelrechnung', 'nummer' => $entwurf ? '' : (string) $r['nummer'], 'datum' => (string) $r['erstellt'], 'betrag_cent' => (int) $r['brutto_cent'], 'status' => (string) $r['status'],
                'bezug' => datumAnzeigen($r['zeitraum_von']) . ' – ' . datumAnzeigen($bis), 'ext_ref' => '', 'kundennummer' => (string) ($r['kundennummer'] ?? ''), 'empfaenger' => (string) ($r['unterkunde'] ?: ''),
                'pdf' => is_file($pdf) ? $pdf : '', 'datei' => 'NEOS-Rechnung-' . $r['nummer'] . '.pdf', 'pfad' => 'rechnungen/' . rawurlencode((string) $r['nummer']) . '.pdf', 'detail' => 'rechnungen/' . rawurlencode((string) $r['nummer']), 'id' => (int) $r['id']];
        }
    }
    // Einzelrechnungen (Lexware) je Bestellung, Gutschriften und Nachweise
    $st = $db->prepare("SELECT b.*, u.nummer AS unterkunde_nummer, f.kundennummer AS firma_kundennummer, k.kundennummer AS kunde_kundennummer FROM bestellungen b LEFT JOIN unterkunden u ON u.id = b.unterkunde_id LEFT JOIN firmen f ON f.id = b.firma_id LEFT JOIN kunden k ON k.id = b.kunde_id WHERE $wo AND (b.lexware_id <> '' OR b.beleg_datei <> '' OR b.nachberechnung_json LIKE '%lexware_gutschrift_id%') ORDER BY b.id DESC");
    $st->execute($werte);
    foreach ($st->fetchAll() as $b) {
        $nummer = (string) ($b['unterkunde_nummer'] ?: ($b['firma_kundennummer'] ?: ($b['kunde_kundennummer'] ?? '')));
        $nb = json_decode((string) ($b['nachberechnung_json'] ?? '{}'), true) ?: [];
        $nachberechnung = ($b['art'] ?? 'sendung') === 'nachberechnung';
        $betrag = $business ? (int) $b['netto_cent'] : (int) $b['betrag_cent'];
        if ((string) $b['lexware_id'] !== '') {
            $pdf = lexwarePdfPfad((string) $b['lexware_id']);
            $belege[] = ['art' => $nachberechnung ? 'nachberechnung' : 'rechnung', 'nummer' => (string) $b['lexware_nummer'], 'datum' => (string) ($b['bezahlt'] ?: $b['aktualisiert']), 'betrag_cent' => $betrag,
                'status' => $b['status'] === 'storniert' ? 'storniert' : 'bezahlt', 'bezug' => (string) $b['ext_ref'], 'ext_ref' => (string) $b['ext_ref'], 'kundennummer' => $nummer, 'empfaenger' => '',
                'pdf' => is_file($pdf) ? $pdf : '', 'datei' => 'NEOS-Rechnung-' . ($b['lexware_nummer'] ?: $b['ext_ref']) . '.pdf', 'pfad' => $liste . '/' . $b['ext_ref'] . '/rechnung.pdf', 'detail' => $liste . '/' . $b['ext_ref'], 'id' => (int) $b['id']];
        }
        if (!empty($nb['lexware_gutschrift_id'])) {
            $pdf = lexwarePdfPfad((string) $nb['lexware_gutschrift_id']);
            $belege[] = ['art' => 'gutschrift', 'nummer' => (string) ($nb['lexware_gutschrift_nummer'] ?? ''), 'datum' => (string) $b['aktualisiert'], 'betrag_cent' => -$betrag, 'status' => 'gutschrift',
                'bezug' => (string) $b['ext_ref'], 'ext_ref' => (string) $b['ext_ref'], 'kundennummer' => $nummer, 'empfaenger' => '',
                'pdf' => is_file($pdf) ? $pdf : '', 'datei' => 'NEOS-Gutschrift-' . ($nb['lexware_gutschrift_nummer'] ?? $b['ext_ref']) . '.pdf', 'pfad' => $liste . '/' . $b['ext_ref'] . '/gutschrift.pdf', 'detail' => $liste . '/' . $b['ext_ref'], 'id' => (int) $b['id']];
        }
        if ((string) $b['beleg_datei'] !== '') {
            $pdf = nachberechnungNachweisPfad($b);
            $belege[] = ['art' => 'nachweis', 'nummer' => (string) $b['ext_ref'], 'datum' => (string) $b['erstellt'], 'betrag_cent' => null, 'status' => (string) $b['status'],
                'bezug' => (string) ($nb['original'] ?? $b['ext_ref']), 'ext_ref' => (string) $b['ext_ref'], 'kundennummer' => $nummer, 'empfaenger' => '',
                'pdf' => $pdf !== '' && is_file($pdf) ? $pdf : '', 'datei' => 'NEOS-Nachweis-' . $b['ext_ref'] . '.pdf', 'pfad' => $liste . '/' . $b['ext_ref'] . '/nachweis.pdf', 'detail' => $liste . '/' . $b['ext_ref'], 'id' => (int) $b['id']];
        }
    }
    usort($belege, static fn (array $a, array $b): int => strcmp($b['datum'], $a['datum']));
    $jahre = array_values(array_unique(array_map(static fn (array $x): string => substr($x['datum'], 0, 4), $belege)));
    rsort($jahre);
    $suche = mb_strtolower(trim($suche));
    $belege = array_values(array_filter($belege, static function (array $x) use ($jahr, $suche, $art): bool {
        if ($jahr !== null && (int) substr($x['datum'], 0, 4) !== $jahr) {
            return false;
        }
        if ($art !== '' && $x['art'] !== $art) {
            return false;
        }

        return $suche === '' || str_contains(mb_strtolower($x['nummer'] . ' ' . $x['bezug'] . ' ' . $x['ext_ref'] . ' ' . $x['kundennummer'] . ' ' . $x['empfaenger']), $suche);
    }));
    $summe = 0;
    foreach ($belege as $x) {
        if ($x['betrag_cent'] !== null && $x['status'] !== 'storniert') {
            $summe += (int) $x['betrag_cent'];
        }
    }

    return ['belege' => $belege, 'jahre' => $jahre, 'summe_cent' => $summe];
}

/** Datei eines Beleg-PDFs zu einer Bestellung: rechnung | gutschrift | nachweis (leer, wenn nicht vorhanden). */
function belegDateiFuerBestellung(array $b, string $art): string
{
    if ($art === 'nachweis') {
        return nachberechnungNachweisPfad($b);
    }
    if ($art === 'gutschrift') {
        $nb = json_decode((string) ($b['nachberechnung_json'] ?? '{}'), true) ?: [];

        return lexwarePdfPfad((string) ($nb['lexware_gutschrift_id'] ?? ''));
    }

    return lexwarePdfPfad((string) ($b['lexware_id'] ?? ''));
}
