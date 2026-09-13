<?php

/**
 * Einkaufspreise eines Carriers aus einer Preismatrix (XLSX/CSV: Zeilen =
 * Länder, Spalten = Gewichtsgrenzen „<5kg“ / „5 kg“) in die Routingmatrix
 * übernehmen. Fehlende Gewichtsklassen und Länder werden angelegt (Länder
 * inaktiv, bis das Team sie freischaltet); neue Routing-Zeilen bekommen
 * einen Verkaufspreis aus Einkauf + Aufschlag.
 */

declare(strict_types=1);

require_once __DIR__ . '/tabelle_lesen.php';

const EINKAUF_LAENDER = [
    'GERMANY' => 'DE', 'DEUTSCHLAND' => 'DE', 'AUSTRIA' => 'AT', 'ÖSTERREICH' => 'AT', 'OESTERREICH' => 'AT', 'BELGIUM' => 'BE', 'BELGIEN' => 'BE',
    'BULGARIA' => 'BG', 'BULGARIEN' => 'BG', 'CROATIA' => 'HR', 'KROATIEN' => 'HR', 'CYPRUS' => 'CY', 'ZYPERN' => 'CY', 'CZECH REPUBLIC' => 'CZ', 'CZECHIA' => 'CZ', 'CZECH REP' => 'CZ', 'TSCHECHIEN' => 'CZ',
    'DENMARK' => 'DK', 'DÄNEMARK' => 'DK', 'DAENEMARK' => 'DK', 'ESTONIA' => 'EE', 'ESTLAND' => 'EE', 'FINLAND' => 'FI', 'FINNLAND' => 'FI', 'FRANCE' => 'FR', 'FRANKREICH' => 'FR',
    'GREECE' => 'GR', 'GRIECHENLAND' => 'GR', 'HUNGARY' => 'HU', 'UNGARN' => 'HU', 'IRELAND' => 'IE', 'IRLAND' => 'IE', 'ITALY' => 'IT', 'ITALIEN' => 'IT',
    'LATVIA' => 'LV', 'LETTLAND' => 'LV', 'LITHUANIA' => 'LT', 'LITAUEN' => 'LT', 'LUXEMBOURG' => 'LU', 'LUXEMBURG' => 'LU', 'MALTA' => 'MT',
    'NETHERLANDS' => 'NL', 'NIEDERLANDE' => 'NL', 'POLAND' => 'PL', 'POLEN' => 'PL', 'PORTUGAL' => 'PT', 'ROMANIA' => 'RO', 'RUMÄNIEN' => 'RO', 'RUMAENIEN' => 'RO',
    'SLOVAKIA' => 'SK', 'SLOWAKEI' => 'SK', 'SLOVENIA' => 'SI', 'SLOWENIEN' => 'SI', 'SPAIN' => 'ES', 'SPANIEN' => 'ES', 'SWEDEN' => 'SE', 'SCHWEDEN' => 'SE',
    'SWITZERLAND' => 'CH', 'SCHWEIZ' => 'CH', 'UNITED KINGDOM' => 'GB', 'GREAT BRITAIN' => 'GB', 'GROSSBRITANNIEN' => 'GB', 'GROßBRITANNIEN' => 'GB', 'UK' => 'GB',
    'LIECHTENSTEIN' => 'LI', 'MONACO' => 'MC', 'SAN MARINO' => 'SM', 'NORWAY' => 'NO', 'NORWEGEN' => 'NO', 'ICELAND' => 'IS', 'ISLAND' => 'IS', 'TURKEY' => 'TR', 'TÜRKEI' => 'TR', 'TUERKEI' => 'TR',
    'ANDORRA' => 'AD', 'VATICAN' => 'VA', 'SERBIA' => 'RS', 'SERBIEN' => 'RS', 'BOSNIA AND HERZEGOVINA' => 'BA', 'BOSNIEN' => 'BA', 'ALBANIA' => 'AL', 'ALBANIEN' => 'AL',
    'NORTH MACEDONIA' => 'MK', 'MONTENEGRO' => 'ME', 'UKRAINE' => 'UA', 'MOLDOVA' => 'MD', 'USA' => 'US', 'UNITED STATES' => 'US', 'CANADA' => 'CA', 'KANADA' => 'CA',
];

const EINKAUF_LAENDERNAMEN = [
    'DE' => ['Deutschland', 'Germany'], 'AT' => ['Österreich', 'Austria'], 'BE' => ['Belgien', 'Belgium'], 'BG' => ['Bulgarien', 'Bulgaria'], 'HR' => ['Kroatien', 'Croatia'], 'CY' => ['Zypern', 'Cyprus'],
    'CZ' => ['Tschechien', 'Czech Republic'], 'DK' => ['Dänemark', 'Denmark'], 'EE' => ['Estland', 'Estonia'], 'FI' => ['Finnland', 'Finland'], 'FR' => ['Frankreich', 'France'], 'GR' => ['Griechenland', 'Greece'],
    'HU' => ['Ungarn', 'Hungary'], 'IE' => ['Irland', 'Ireland'], 'IT' => ['Italien', 'Italy'], 'LV' => ['Lettland', 'Latvia'], 'LT' => ['Litauen', 'Lithuania'], 'LU' => ['Luxemburg', 'Luxembourg'], 'MT' => ['Malta', 'Malta'],
    'NL' => ['Niederlande', 'Netherlands'], 'PL' => ['Polen', 'Poland'], 'PT' => ['Portugal', 'Portugal'], 'RO' => ['Rumänien', 'Romania'], 'SK' => ['Slowakei', 'Slovakia'], 'SI' => ['Slowenien', 'Slovenia'],
    'ES' => ['Spanien', 'Spain'], 'SE' => ['Schweden', 'Sweden'], 'CH' => ['Schweiz', 'Switzerland'], 'GB' => ['Großbritannien', 'United Kingdom'], 'LI' => ['Liechtenstein', 'Liechtenstein'], 'MC' => ['Monaco', 'Monaco'],
    'SM' => ['San Marino', 'San Marino'], 'NO' => ['Norwegen', 'Norway'], 'IS' => ['Island', 'Iceland'], 'TR' => ['Türkei', 'Turkey'], 'AD' => ['Andorra', 'Andorra'], 'VA' => ['Vatikan', 'Vatican'], 'RS' => ['Serbien', 'Serbia'],
    'BA' => ['Bosnien und Herzegowina', 'Bosnia and Herzegovina'], 'AL' => ['Albanien', 'Albania'], 'MK' => ['Nordmazedonien', 'North Macedonia'], 'ME' => ['Montenegro', 'Montenegro'], 'UA' => ['Ukraine', 'Ukraine'], 'MD' => ['Moldau', 'Moldova'], 'US' => ['USA', 'United States'], 'CA' => ['Kanada', 'Canada'],
];

/** Ländername (EN/DE/ISO) → ISO-2, auch über die Namen der eigenen Länderliste. */
function einkaufLandCode(string $name): string
{
    $n = mb_strtoupper(trim($name));
    if (preg_match('/^[A-Z]{2}$/', $n)) {
        return $n;
    }
    if (isset(EINKAUF_LAENDER[$n])) {
        return EINKAUF_LAENDER[$n];
    }
    static $eigene = null;
    if ($eigene === null) {
        $eigene = [];
        foreach (datenbank()->query('SELECT code, name_de, name_en FROM laender') as $l) {
            $eigene[mb_strtoupper((string) $l['name_de'])] = (string) $l['code'];
            $eigene[mb_strtoupper((string) $l['name_en'])] = (string) $l['code'];
        }
    }

    return $eigene[$n] ?? '';
}

/**
 * Preismatrix aus einem Blatt lesen: ['klassen' => [gramm…], 'zeilen' => [['name', 'code', 'preise' => [gramm => cent]]], 'unbekannt' => [namen]].
 * Die Kopfzeile ist die erste mit mindestens zwei Gewichtsgrenzen („<5kg“, „5 kg“, „bis 10 kg“).
 */
function einkaufMatrixLesen(array $blatt): array
{
    $alle = array_merge([$blatt['kopf']], $blatt['zeilen']);
    $klassen = [];
    $kopfIndex = null;
    $gewichtAus = static function (string $s): int {
        return preg_match('/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i', $s, $m) ? (int) round(rpZahl($m[1]) * (strtolower($m[2]) === 'g' ? 1 : 1000)) : 0;
    };
    foreach ($alle as $i => $zeile) {
        $treffer = [];
        foreach ($zeile as $k => $wert) {
            $g = $gewichtAus((string) $wert);
            if ($g > 0) {
                $treffer[$k] = $g;
            }
        }
        if (count($treffer) >= 2) {
            $klassen = $treffer;
            $kopfIndex = $i;
            break;
        }
    }
    if ($kopfIndex === null) {
        throw new InvalidArgumentException('Keine Kopfzeile mit Gewichtsgrenzen gefunden (z. B. „<5kg“, „10 kg“).');
    }
    $zeilen = [];
    $unbekannt = [];
    foreach (array_slice($alle, $kopfIndex + 1) as $zeile) {
        $name = trim((string) ($zeile[0] ?? ''));
        if ($name === '') {
            continue;
        }
        $preise = [];
        foreach ($klassen as $k => $gramm) {
            $wert = trim((string) ($zeile[$k] ?? ''));
            if ($wert !== '' && preg_match('/^-?\d[\d.,]*$/', $wert)) {
                $preise[$gramm] = (int) round(rpZahl($wert) * 100);
            }
        }
        if ($preise === []) {
            continue; // Fußnoten, Zuschlagstabellen usw.
        }
        $code = einkaufLandCode($name);
        if ($code === '') {
            $unbekannt[] = $name;
            continue;
        }
        $zeilen[] = ['name' => $name, 'code' => $code, 'preise' => $preise];
    }
    if ($zeilen === []) {
        throw new InvalidArgumentException('Keine Länderzeilen mit Preisen gefunden.');
    }

    return ['klassen' => array_values($klassen), 'zeilen' => $zeilen, 'unbekannt' => $unbekannt];
}

/** Gewichtsklasse zur Grenze: exakt, sonst bis 10 % darüber (30 kg → 31,5 kg), sonst neu. */
function einkaufKlasseFuer(int $gramm, bool $anlegen): ?array
{
    $db = datenbank();
    $klassen = $db->query('SELECT * FROM gewichtsklassen ORDER BY max_gramm')->fetchAll();
    foreach ($klassen as $k) {
        if ((int) $k['max_gramm'] === $gramm) {
            return $k;
        }
    }
    foreach ($klassen as $k) {
        if ((int) $k['max_gramm'] > $gramm && (int) $k['max_gramm'] <= (int) round($gramm * 1.1)) {
            return $k;
        }
    }
    if (!$anlegen) {
        return null;
    }
    $kg = rtrim(rtrim(number_format($gramm / 1000, 1, '.', ''), '0'), '.');
    $code = str_replace('.', '_', $kg) . 'kg';
    $st = $db->prepare('SELECT * FROM gewichtsklassen WHERE code = ?');
    $st->execute([$code]);
    if ($z = $st->fetch()) {
        return $z;
    }
    $db->prepare('INSERT INTO gewichtsklassen (code, name_de, name_en, max_gramm, aktiv, sortierung) VALUES (?, ?, ?, ?, 1, ?)')
       ->execute([$code, 'bis ' . str_replace('.', ',', $kg) . ' kg', 'up to ' . $kg . ' kg', $gramm, (int) ($gramm / 100)]);
    $st->execute([$code]);

    return $st->fetch() ?: null;
}

/**
 * Matrix in die Routingmatrix schreiben. Liefert Zähler: geaendert, neu, klassen_neu, laender_neu.
 * $aufschlagProzent: Verkauf für neue Zeilen = Einkauf × (1 + Aufschlag); $aktiv: neue Zeilen aktiv?
 */
function einkaufUebernehmen(int $carrierId, array $matrix, float $aufschlagProzent, bool $aktiv, string $von = 'import'): array
{
    $db = datenbank();
    $zaehler = ['geaendert' => 0, 'neu' => 0, 'klassen_neu' => 0, 'laender_neu' => 0, 'unveraendert' => 0, 'verkauf_unter_einkauf' => 0];
    $vorherKlassen = (int) $db->query('SELECT COUNT(*) FROM gewichtsklassen')->fetchColumn();
    $klassenIds = [];
    foreach ($matrix['klassen'] as $gramm) {
        $k = einkaufKlasseFuer((int) $gramm, true);
        if ($k !== null) {
            $klassenIds[$gramm] = (int) $k['id'];
        }
    }
    $zaehler['klassen_neu'] = (int) $db->query('SELECT COUNT(*) FROM gewichtsklassen')->fetchColumn() - $vorherKlassen;
    $db->beginTransaction();
    try {
        $landSt = $db->prepare('SELECT code FROM laender WHERE code = ?');
        $landNeu = $db->prepare('INSERT INTO laender (code, name_de, name_en, aktiv, sortierung) VALUES (?, ?, ?, 0, 900)');
        $zeileSt = $db->prepare('SELECT * FROM routing WHERE land_code = ? AND gewichtsklasse_id = ? AND carrier_id = ?');
        $prioSt = $db->prepare('SELECT COALESCE(MAX(prioritaet), 0) FROM routing WHERE land_code = ? AND gewichtsklasse_id = ?');
        $insert = $db->prepare('INSERT INTO routing (land_code, gewichtsklasse_id, carrier_id, prioritaet, laufzeit_de, laufzeit_en, verkauf_cent, einkauf_cent, aktiv, aktualisiert, aktualisiert_von) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $update = $db->prepare('UPDATE routing SET einkauf_cent = ?, aktualisiert = ?, aktualisiert_von = ? WHERE id = ?');
        foreach ($matrix['zeilen'] as $zeile) {
            $code = $zeile['code'];
            $landSt->execute([$code]);
            if ($landSt->fetchColumn() === false) {
                [$de, $en] = EINKAUF_LAENDERNAMEN[$code] ?? [$zeile['name'], $zeile['name']];
                $landNeu->execute([$code, $de, $en]);
                $zaehler['laender_neu']++;
            }
            foreach ($zeile['preise'] as $gramm => $cent) {
                $gkId = $klassenIds[$gramm] ?? null;
                if ($gkId === null) {
                    continue;
                }
                $zeileSt->execute([$code, $gkId, $carrierId]);
                $vorhanden = $zeileSt->fetch();
                if ($vorhanden) {
                    if ((int) $vorhanden['einkauf_cent'] === $cent) {
                        $zaehler['unveraendert']++;
                    } else {
                        $update->execute([$cent, jetzt(), $von, $vorhanden['id']]);
                        $zaehler['geaendert']++;
                    }
                    if ((int) $vorhanden['verkauf_cent'] <= $cent) {
                        $zaehler['verkauf_unter_einkauf']++;
                    }
                } else {
                    $prioSt->execute([$code, $gkId]);
                    $prio = (int) $prioSt->fetchColumn() + 1;
                    $laufzeit = $code === 'DE' ? ['1–2 Werktage', '1–2 working days'] : ['2–5 Werktage', '2–5 working days'];
                    $insert->execute([$code, $gkId, $carrierId, $prio, $laufzeit[0], $laufzeit[1], (int) round($cent * (1 + $aufschlagProzent / 100)), $cent, $aktiv ? 1 : 0, jetzt(), $von]);
                    $zaehler['neu']++;
                }
            }
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    return $zaehler;
}
