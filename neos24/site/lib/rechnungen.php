<?php

/**
 * Sammelrechnungen für Geschäftskunden: Sendungen auf Rechnung eines
 * Zeitraums werden zu einer Rechnung mit fortlaufender Nummer zusammengefasst,
 * als PDF ins Datenverzeichnis geschrieben und per Mail angekündigt.
 */

declare(strict_types=1);

require_once __DIR__ . '/rechnung_pdf.php';

const RECHNUNG_SELECT = 'SELECT r.*, f.name AS firma, f.kundennummer AS firma_kundennummer, u.name AS unterkunde, u.nummer AS unterkunde_nummer, COALESCE(u.nummer, f.kundennummer) AS kundennummer FROM rechnungen r JOIN firmen f ON f.id = r.firma_id LEFT JOIN unterkunden u ON u.id = r.unterkunde_id';

function rechnungLaden(int $id): ?array
{
    $st = datenbank()->prepare(RECHNUNG_SELECT . ' WHERE r.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function rechnungNachNummer(string $nummer): ?array
{
    $st = datenbank()->prepare(RECHNUNG_SELECT . ' WHERE r.nummer = ?');
    $st->execute([$nummer]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Rechnungen einer Firma, optional nur die eines Unterkunden (0 = alle, -1 = nur Hauptfirma). */
function rechnungenDerFirma(int $firmaId, int $unterkundeId = 0): array
{
    $sql = str_replace('SELECT r.*,', 'SELECT r.*, (SELECT COUNT(*) FROM bestellungen b WHERE b.rechnung_id = r.id) AS positionen,', RECHNUNG_SELECT) . ' WHERE r.firma_id = ?';
    $werte = [$firmaId];
    if ($unterkundeId > 0) {
        $sql .= ' AND r.unterkunde_id = ?';
        $werte[] = $unterkundeId;
    } elseif ($unterkundeId < 0) {
        $sql .= ' AND r.unterkunde_id IS NULL';
    }
    $st = datenbank()->prepare($sql . ' ORDER BY r.id DESC');
    $st->execute($werte);

    return $st->fetchAll();
}

function rechnungenAlle(string $status = ''): array
{
    $sql = str_replace('SELECT r.*,', 'SELECT r.*, (SELECT COUNT(*) FROM bestellungen b WHERE b.rechnung_id = r.id) AS positionen,', RECHNUNG_SELECT);
    if ($status !== '') {
        $st = datenbank()->prepare($sql . ' WHERE r.status = ? ORDER BY r.id DESC');
        $st->execute([$status]);

        return $st->fetchAll();
    }

    return datenbank()->query($sql . ' ORDER BY r.id DESC')->fetchAll();
}

/** Sendungen einer Rechnung. */
function rechnungPositionen(int $rechnungId): array
{
    $st = datenbank()->prepare('SELECT * FROM bestellungen WHERE rechnung_id = ? ORDER BY erstellt, id');
    $st->execute([$rechnungId]);

    return $st->fetchAll();
}

/** Noch nicht abgerechnete Sendungen einer Firma im Zeitraum [von, bis) — je Rechnungsempfänger (Hauptfirma oder ein Unterkunde). */
function offenePositionen(int $firmaId, string $von, string $bis, ?int $unterkundeId = null): array
{
    $st = datenbank()->prepare("SELECT * FROM bestellungen WHERE firma_id = ? AND zahlungsart = 'rechnung' AND status = 'beauftragt' AND rechnung_id IS NULL AND erstellt >= ? AND erstellt < ? AND " . ($unterkundeId ? 'unterkunde_id = ?' : 'unterkunde_id IS NULL') . ' ORDER BY erstellt, id');
    $st->execute($unterkundeId ? [$firmaId, $von, $bis, $unterkundeId] : [$firmaId, $von, $bis]);

    return $st->fetchAll();
}

/** Zeitraum eines Monats „YYYY-MM“ als [von, bis) in ISO-UTC. */
function monatsZeitraum(string $monat): ?array
{
    if (!preg_match('/^(\d{4})-(\d{2})$/', $monat, $t) || (int) $t[2] < 1 || (int) $t[2] > 12) {
        return null;
    }
    $von = new DateTimeImmutable($t[1] . '-' . $t[2] . '-01T00:00:00', new DateTimeZone('Europe/Berlin'));
    $bis = $von->modify('+1 month');

    return [
        $von->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),
        $bis->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),
    ];
}

/** Nächste Nummer im Jahr, innerhalb der laufenden Transaktion. */
function rechnungNummerNeu(PDO $db, int $jahr): string
{
    $praefix = (string) konfig()['rechnung']['praefix'];
    $st = $db->prepare('SELECT nummer FROM rechnungen WHERE nummer LIKE ? ORDER BY nummer DESC LIMIT 1');
    $st->execute([$praefix . '-' . $jahr . '-%']);
    $letzte = (string) $st->fetchColumn();
    $lfd = $letzte !== '' ? (int) substr($letzte, strrpos($letzte, '-') + 1) + 1 : 1;

    return sprintf('%s-%d-%04d', $praefix, $jahr, $lfd);
}

/** Pfad des Rechnungs-PDFs: aus Lexware (daten/lexware/) oder eigenes (daten/rechnungen/). */
function rechnungPfad(array $rechnung): string
{
    if ((string) ($rechnung['lexware_id'] ?? '') !== '') {
        return lexwarePdfPfad((string) $rechnung['lexware_id']);
    }

    return rtrim((string) konfig()['daten'], '/') . '/rechnungen/' . basename((string) $rechnung['pdf_datei']);
}

/**
 * Rechnung für eine Firma und einen Zeitraum erzeugen: Positionen sammeln,
 * Nummer vergeben, Sendungen verknüpfen, PDF schreiben, Mail ankündigen.
 * Wirft InvalidArgumentException, wenn nichts abzurechnen ist.
 */
function rechnungErzeugen(int $firmaId, string $von, string $bis, string $erstelltVon, ?int $unterkundeId = null): array
{
    $firma = firmaLaden($firmaId);
    if ($firma === null) {
        throw new InvalidArgumentException('Firma nicht gefunden.');
    }
    if ($unterkundeId !== null) {
        $u = unterkundeLaden($unterkundeId);
        if ($u === null || (int) $u['firma_id'] !== $firmaId) {
            throw new InvalidArgumentException('Unterkunde gehört nicht zu dieser Firma.');
        }
    }
    $empfaenger = rechnungsempfaenger(['firma_id' => $firmaId, 'unterkunde_id' => $unterkundeId]);
    $positionen = offenePositionen($firmaId, $von, $bis, $unterkundeId);
    if ($positionen === []) {
        throw new InvalidArgumentException('Im Zeitraum gibt es keine offenen Sendungen auf Rechnung' . ($unterkundeId ? ' für ' . $empfaenger['name'] : '') . '.');
    }
    $netto = 0;
    foreach ($positionen as $p) {
        $netto += (int) $p['netto_cent'];
    }
    $mwst = (int) round($netto * (int) konfig()['mwstSatz'] / 100);
    $faellig = gmdate('Y-m-d', time() + (int) $empfaenger['zahlungsziel_tage'] * 86400);

    $db = datenbank();
    $lexware = lexwareAktiv();
    $db->beginTransaction();
    try {
        // Mit Lexware vergibt Lexware die Nummer; bis dahin ein Platzhalter, den das Portal als „wird erstellt“ zeigt.
        $nummer = $lexware ? 'ENTWURF-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(2)) : rechnungNummerNeu($db, (int) gmdate('Y'));
        $db->prepare(<<<'SQL'
            INSERT INTO rechnungen (nummer, firma_id, unterkunde_id, zeitraum_von, zeitraum_bis, netto_cent, mwst_cent, brutto_cent, status, faellig, pdf_datei, erstellt, erstellt_von)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?, ?, ?)
        SQL)->execute([$nummer, $firmaId, $unterkundeId, $von, $bis, $netto, $mwst, $netto + $mwst, $faellig, $lexware ? '' : $nummer . '.pdf', jetzt(), $erstelltVon]);
        $id = (int) $db->lastInsertId();
        $st = $db->prepare('UPDATE bestellungen SET rechnung_id = ?, aktualisiert = ? WHERE id = ? AND rechnung_id IS NULL');
        foreach ($positionen as $p) {
            $st->execute([$id, jetzt(), $p['id']]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    $rechnung = rechnungLaden($id);
    if ($lexware) {
        // Nummer, PDF und Mail kommen mit der Übergabe an Lexware (sofort, sonst per aufgaben.php lexware)
        lexwareAuftragAnlegen('rechnung', 'rechnungen', $id);
        lexwareAuftraegeAbarbeiten(3);
        syncMarkieren('rechnungen', $id, ['rechnung']);

        return rechnungLaden($id) ?? $rechnung;
    }
    rechnungPdfErzeugen($rechnung, $empfaenger, $positionen);
    try {
        rechnungMailSenden($rechnung, $firma);
    } catch (Throwable $e) {
        error_log('[rechnung] Mail fehlgeschlagen: ' . $e->getMessage());
    }
    syncMarkieren('rechnungen', $id, ['rechnung']);

    return $rechnung;
}

/** Status setzen; „storniert“ gibt die Sendungen wieder zur Abrechnung frei. */
function rechnungStatusSetzen(array $rechnung, string $status): void
{
    if (!in_array($status, ['offen', 'bezahlt', 'storniert'], true)) {
        throw new InvalidArgumentException('Unbekannter Status.');
    }
    $db = datenbank();
    $db->prepare('UPDATE rechnungen SET status = ? WHERE id = ?')->execute([$status, $rechnung['id']]);
    if ($status === 'storniert') {
        $db->prepare('UPDATE bestellungen SET rechnung_id = NULL, aktualisiert = ? WHERE rechnung_id = ?')->execute([jetzt(), $rechnung['id']]);
    }
    if ($status !== (string) $rechnung['status']) {
        syncMarkieren('rechnungen', (int) $rechnung['id'], ['rechnung']);
    }
}

/** Rechnungsmail an den Rechnungsempfänger (Unterkunde oder Firma), sonst an den Inhaber. */
function rechnungMailSenden(array $rechnung, array $firma): void
{
    $empfaenger = rechnungsempfaenger($rechnung + ['firma_id' => $firma['id']]);
    $an = (string) $empfaenger['rechnungs_email'];
    if ($an === '') {
        $st = datenbank()->prepare("SELECT email FROM kunden WHERE firma_id = ? AND firmenrolle = 'inhaber' AND aktiv = 1 LIMIT 1");
        $st->execute([$firma['id']]);
        $an = (string) $st->fetchColumn();
    }
    if ($an === '') {
        return;
    }
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    $betreff = 'NEOS Rechnung ' . $rechnung['nummer'];
    $pdf = rechnungPfad($rechnung);
    $anhaenge = is_file($pdf) ? [['name' => 'NEOS-Rechnung-' . $rechnung['nummer'] . '.pdf', 'datei' => $pdf]] : [];
    // Nachweise zu Nachberechnungen auf dieser Rechnung als weitere Anlagen
    foreach (rechnungPositionen((int) $rechnung['id']) as $p) {
        if (($p['art'] ?? '') === 'nachberechnung' && nachberechnungNachweisPfad($p) !== '' && is_file(nachberechnungNachweisPfad($p))) {
            $anhaenge[] = ['name' => 'NEOS-Nachweis-' . $p['ext_ref'] . '.pdf', 'datei' => nachberechnungNachweisPfad($p)];
        }
    }
    $koerper = implode("\n", [
        'Guten Tag,',
        '',
        'für ' . $empfaenger['name'] . ' liegt eine neue Rechnung vor' . ($anhaenge !== [] ? ' (PDF im Anhang)' : '') . '.',
        '',
        'Kundennummer: ' . $empfaenger['kundennummer'],
        'Rechnung:     ' . $rechnung['nummer'],
        'Zeitraum:     ' . datumAnzeigen($rechnung['zeitraum_von']) . ' – ' . datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $rechnung['zeitraum_bis']) - 1)),
        'Netto:        ' . euro((int) $rechnung['netto_cent']),
        'MwSt.:        ' . euro((int) $rechnung['mwst_cent']),
        'Brutto:       ' . euro((int) $rechnung['brutto_cent']),
        'Fällig am:    ' . datumAnzeigen($rechnung['faellig'] . 'T00:00:00Z'),
        '',
        'PDF und alle Sendungen im Kundenportal: ' . $basis . '/konto/rechnungen',
        '',
        'NEOS Logistics UG · info@neos24.com',
    ]);
    mailSenden($an, $betreff, $koerper, $anhaenge);
}
