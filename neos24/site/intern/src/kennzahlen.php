<?php

/**
 * Kennzahlen für die Übersicht — alle aus der Tabelle bestellungen und den
 * Anfragen, nichts geschätzt. Umsatz = bezahlte Bestellungen; Marge =
 * Verkauf netto − Einkauf (Einkauf zum Bestellzeitpunkt aus der Routingmatrix).
 */

declare(strict_types=1);

function kennzahlen(): array
{
    $db = datenbank();
    $heute = gmdate('Y-m-d') . 'T00:00:00Z';
    $tage7 = gmdate('Y-m-d\TH:i:s\Z', time() - 7 * 86400);
    $tage30 = gmdate('Y-m-d\TH:i:s\Z', time() - 30 * 86400);
    $vor30 = gmdate('Y-m-d\TH:i:s\Z', time() - 60 * 86400);

    $zaehle = static function (string $ab) use ($db): int {
        $st = $db->prepare("SELECT COUNT(*) FROM bestellungen WHERE erstellt >= ? AND status NOT IN ('offen','fehlgeschlagen','storniert')");
        $st->execute([$ab]);

        return (int) $st->fetchColumn();
    };
    $summe = static function (string $ab, string $bis = '9999') use ($db): array {
        $st = $db->prepare("SELECT COALESCE(SUM(betrag_cent),0) AS brutto, COALESCE(SUM(netto_cent),0) AS netto, COALESCE(SUM(einkauf_cent),0) AS einkauf, COUNT(*) AS anzahl FROM bestellungen WHERE (status = 'bezahlt' AND bezahlt >= ? AND bezahlt < ?) OR (status = 'beauftragt' AND erstellt >= ? AND erstellt < ?)");
        $st->execute([$ab, $bis, $ab, $bis]);

        return $st->fetch() ?: ['brutto' => 0, 'netto' => 0, 'einkauf' => 0, 'anzahl' => 0];
    };

    $u30 = $summe($tage30);
    $uVor = $summe($vor30, $tage30);
    $statusZeilen = $db->query('SELECT status, COUNT(*) AS n FROM bestellungen GROUP BY status')->fetchAll();
    $status = [];
    foreach ($statusZeilen as $z) {
        $status[$z['status']] = (int) $z['n'];
    }

    $wochen = [];
    for ($i = 7; $i >= 0; $i--) {
        $start = strtotime('monday this week', time() - $i * 7 * 86400);
        $wochen[] = ['ab' => gmdate('Y-m-d\T00:00:00Z', $start), 'bis' => gmdate('Y-m-d\T00:00:00Z', $start + 7 * 86400), 'kw' => (int) gmdate('W', $start), 'anzahl' => 0, 'brutto' => 0];
    }
    $st = $db->prepare("SELECT erstellt, betrag_cent FROM bestellungen WHERE erstellt >= ? AND status NOT IN ('offen','fehlgeschlagen','storniert')");
    $st->execute([$wochen[0]['ab']]);
    foreach ($st as $b) {
        foreach ($wochen as $k => $w) {
            if ($b['erstellt'] >= $w['ab'] && $b['erstellt'] < $w['bis']) {
                $wochen[$k]['anzahl']++;
                $wochen[$k]['brutto'] += (int) $b['betrag_cent'];
                break;
            }
        }
    }

    $st = $db->prepare("SELECT zielland, COUNT(*) AS n, COALESCE(SUM(betrag_cent),0) AS brutto FROM bestellungen WHERE erstellt >= ? AND status NOT IN ('offen','fehlgeschlagen','storniert') GROUP BY zielland ORDER BY n DESC LIMIT 5");
    $st->execute([$tage30]);
    $laender = $st->fetchAll();
    $st = $db->prepare("SELECT COALESCE(carrier, '—') AS carrier, COUNT(*) AS n FROM bestellungen WHERE erstellt >= ? AND status NOT IN ('offen','fehlgeschlagen','storniert') GROUP BY carrier ORDER BY n DESC LIMIT 5");
    $st->execute([$tage30]);
    $carrier = $st->fetchAll();

    $letzte = $db->query('SELECT ext_ref, status, zielland, carrier, betrag_cent, email, erstellt FROM bestellungen ORDER BY id DESC LIMIT 10')->fetchAll();
    $rechnungenOffen = $db->query("SELECT COUNT(*) AS n, COALESCE(SUM(brutto_cent),0) AS brutto FROM rechnungen WHERE status = 'offen'")->fetch() ?: ['n' => 0, 'brutto' => 0];
    $firmenAktiv = (int) $db->query('SELECT COUNT(*) FROM firmen WHERE aktiv = 1')->fetchColumn();
    $anfragenNeu = (int) $db->query("SELECT COUNT(*) FROM anfragen WHERE status = 'neu'")->fetchColumn();
    $anfragenOffen = (int) $db->query("SELECT COUNT(*) FROM anfragen WHERE status IN ('neu','in_bearbeitung')")->fetchColumn();

    return [
        'heute' => $zaehle($heute),
        'tage7' => $zaehle($tage7),
        'tage30' => $zaehle($tage30),
        'umsatz30' => $u30,
        'umsatzVor' => $uVor,
        'marge30' => (int) $u30['netto'] - (int) $u30['einkauf'],
        'status' => $status,
        'gesamt' => array_sum($status),
        'wochen' => $wochen,
        'laender' => $laender,
        'carrier' => $carrier,
        'letzte' => $letzte,
        'rechnungenOffen' => (int) $rechnungenOffen['n'],
        'rechnungenOffenBrutto' => (int) $rechnungenOffen['brutto'],
        'firmenAktiv' => $firmenAktiv,
        'anfragenNeu' => $anfragenNeu,
        'anfragenOffen' => $anfragenOffen,
    ];
}
