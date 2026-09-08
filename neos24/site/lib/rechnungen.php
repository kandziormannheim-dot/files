<?php

/**
 * Sammelrechnungen für Geschäftskunden: Sendungen auf Rechnung eines
 * Zeitraums werden zu einer Rechnung mit fortlaufender Nummer zusammengefasst,
 * als PDF ins Datenverzeichnis geschrieben und per Mail angekündigt.
 */

declare(strict_types=1);

require_once __DIR__ . '/rechnung_pdf.php';

function rechnungLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT r.*, f.name AS firma FROM rechnungen r JOIN firmen f ON f.id = r.firma_id WHERE r.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function rechnungNachNummer(string $nummer): ?array
{
    $st = datenbank()->prepare('SELECT r.*, f.name AS firma FROM rechnungen r JOIN firmen f ON f.id = r.firma_id WHERE r.nummer = ?');
    $st->execute([$nummer]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function rechnungenDerFirma(int $firmaId): array
{
    $st = datenbank()->prepare('SELECT r.*, (SELECT COUNT(*) FROM bestellungen b WHERE b.rechnung_id = r.id) AS positionen FROM rechnungen r WHERE r.firma_id = ? ORDER BY r.id DESC');
    $st->execute([$firmaId]);

    return $st->fetchAll();
}

function rechnungenAlle(string $status = ''): array
{
    $sql = 'SELECT r.*, f.name AS firma, (SELECT COUNT(*) FROM bestellungen b WHERE b.rechnung_id = r.id) AS positionen FROM rechnungen r JOIN firmen f ON f.id = r.firma_id';
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

/** Noch nicht abgerechnete Sendungen einer Firma im Zeitraum [von, bis). */
function offenePositionen(int $firmaId, string $von, string $bis): array
{
    $st = datenbank()->prepare("SELECT * FROM bestellungen WHERE firma_id = ? AND zahlungsart = 'rechnung' AND status = 'beauftragt' AND rechnung_id IS NULL AND erstellt >= ? AND erstellt < ? ORDER BY erstellt, id");
    $st->execute([$firmaId, $von, $bis]);

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

function rechnungPfad(array $rechnung): string
{
    return rtrim((string) konfig()['daten'], '/') . '/rechnungen/' . basename((string) $rechnung['pdf_datei']);
}

/**
 * Rechnung für eine Firma und einen Zeitraum erzeugen: Positionen sammeln,
 * Nummer vergeben, Sendungen verknüpfen, PDF schreiben, Mail ankündigen.
 * Wirft InvalidArgumentException, wenn nichts abzurechnen ist.
 */
function rechnungErzeugen(int $firmaId, string $von, string $bis, string $erstelltVon): array
{
    $firma = firmaLaden($firmaId);
    if ($firma === null) {
        throw new InvalidArgumentException('Firma nicht gefunden.');
    }
    $positionen = offenePositionen($firmaId, $von, $bis);
    if ($positionen === []) {
        throw new InvalidArgumentException('Im Zeitraum gibt es keine offenen Sendungen auf Rechnung.');
    }
    $netto = 0;
    foreach ($positionen as $p) {
        $netto += (int) $p['netto_cent'];
    }
    $mwst = (int) round($netto * (int) konfig()['mwstSatz'] / 100);
    $faellig = gmdate('Y-m-d', time() + (int) $firma['zahlungsziel_tage'] * 86400);

    $db = datenbank();
    $db->beginTransaction();
    try {
        $nummer = rechnungNummerNeu($db, (int) gmdate('Y'));
        $db->prepare(<<<'SQL'
            INSERT INTO rechnungen (nummer, firma_id, zeitraum_von, zeitraum_bis, netto_cent, mwst_cent, brutto_cent, status, faellig, pdf_datei, erstellt, erstellt_von)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?, ?, ?)
        SQL)->execute([$nummer, $firmaId, $von, $bis, $netto, $mwst, $netto + $mwst, $faellig, $nummer . '.pdf', jetzt(), $erstelltVon]);
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
    rechnungPdfErzeugen($rechnung, $firma, $positionen);
    try {
        rechnungMailSenden($rechnung, $firma);
    } catch (Throwable $e) {
        error_log('[rechnung] Mail fehlgeschlagen: ' . $e->getMessage());
    }

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
}

function rechnungMailSenden(array $rechnung, array $firma): void
{
    $an = (string) $firma['rechnungs_email'];
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
    $koerper = implode("\n", [
        'Guten Tag,',
        '',
        'für ' . $firma['name'] . ' liegt eine neue Rechnung vor.',
        '',
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
    mailSenden($an, $betreff, $koerper);
}
