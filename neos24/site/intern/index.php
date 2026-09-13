<?php

/**
 * Internes Dashboard neos24.com — Einstiegspunkt und Wegweiser.
 *
 * Alle Anfragen unter /intern/ laufen durch diese Datei (.htaccess: alles,
 * was keine Datei ist, nach index.php; ohne Rewrite geht auch
 * index.php?pfad=/bestellungen). Module und Rechte: src/rechte.php.
 */

declare(strict_types=1);

require __DIR__ . '/src/bootstrap.php';

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pfad = isset($_GET['pfad'])
    ? (string) $_GET['pfad']
    : rawurldecode((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH));
$basis = internBasis();
if ($basis !== '' && str_starts_with($pfad, $basis)) {
    $pfad = substr($pfad, strlen($basis));
}
$pfad = '/' . trim(preg_replace('#/+#', '/', $pfad) ?? '', '/');
if ($pfad === '/index.php') {
    $pfad = '/';
}

// Selbsttest ohne Anmeldung: läuft PHP, gibt es eine Konfiguration?
if ($pfad === '/status') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'dienst' => 'intern', 'konfiguriert' => is_file(getenv('NEOS_KONFIG') ?: NEOS_KONFIG_PFAD)]);
    exit;
}

try {
    $db = datenbank();
} catch (Throwable $e) {
    error_log('[intern] Datenbank: ' . $e->getMessage());
    http_response_code(503);
    exit('Datenbank nicht erreichbar — Datenverzeichnis und Rechte prüfen (siehe intern/README.md).');
}
sitzungStarten();

if ($methode === 'POST' && !herkunftErlaubt((string) ($_SERVER['HTTP_ORIGIN'] ?? ''), konfig()['erlaubteHerkunft'])) {
    fehlerSeite(403, 'Herkunft nicht erlaubt', 'Die Anfrage kam nicht von dieser Seite.');
}

// ------------------------------------------------------------------ Anmeldung

if ($pfad === '/login') {
    if (benutzerAktuell() !== null) {
        umleiten(url());
    }
    $weiter = (string) ($_GET['weiter'] ?? $_POST['weiter'] ?? '');
    if ($weiter === '' || $weiter[0] !== '/' || str_starts_with($weiter, '//')) {
        $weiter = '/';
    }
    $fehler = null;
    if ($methode === 'POST') {
        csrfPruefen();
        if (anmelden(feld('email', 254), (string) ($_POST['passwort'] ?? ''))) {
            umleiten(url(ltrim($weiter, '/')));
        }
        $fehler = 'E-Mail oder Passwort falsch — oder das Konto ist vorübergehend gesperrt.';
    }
    $keineBenutzer = (int) $db->query('SELECT COUNT(*) FROM benutzer')->fetchColumn() === 0;
    ansicht('login', ['titel' => 'Anmelden', 'fehler' => $fehler, 'weiter' => $weiter, 'keineBenutzer' => $keineBenutzer, 'aktiv' => '']);
}

if ($pfad === '/logout') {
    if ($methode === 'POST') {
        csrfPruefen();
        abmelden();
    }
    umleiten(url('login'));
}

anmeldungErzwingen($pfad);
$ich = benutzerAktuell();
if ($methode === 'POST') {
    csrfPruefen();
}
if ((int) $ich['muss_passwort_aendern'] === 1 && $pfad !== '/konto') {
    hinweisSetzen('Bitte zuerst ein eigenes Passwort setzen.', 'fehler');
    umleiten(url('konto'));
}

// ---------------------------------------------------------------------- Konto

if ($pfad === '/konto') {
    $fehler = null;
    if ($methode === 'POST') {
        $alt = (string) ($_POST['alt'] ?? '');
        $neu = (string) ($_POST['neu'] ?? '');
        $wiederholung = (string) ($_POST['wiederholung'] ?? '');
        if (!password_verify($alt, (string) $ich['passwort_hash'])) {
            $fehler = 'Das bisherige Passwort stimmt nicht.';
        } elseif (($fehler = passwortRegel($neu)) === null) {
            if ($neu !== $wiederholung) {
                $fehler = 'Die Wiederholung stimmt nicht überein.';
            } elseif ($neu === $alt) {
                $fehler = 'Das neue Passwort muss sich vom bisherigen unterscheiden.';
            } else {
                $db->prepare('UPDATE benutzer SET passwort_hash = ?, muss_passwort_aendern = 0, aktualisiert = ? WHERE id = ?')
                   ->execute([password_hash($neu, PASSWORD_DEFAULT), jetzt(), $ich['id']]);
                protokollieren('passwort.geaendert', 'benutzer', (int) $ich['id']);
                hinweisSetzen('Passwort geändert.');
                umleiten(url());
            }
        }
    }
    ansicht('konto', ['titel' => 'Mein Konto', 'fehler' => $fehler, 'aktiv' => 'konto']);
}

// ----------------------------------------------------------------- Übersicht

if ($pfad === '/') {
    rechtErzwingen('uebersicht');
    ansicht('uebersicht', ['titel' => 'Übersicht', 'k' => kennzahlen(), 'aktiv' => 'uebersicht']);
}

// -------------------------------------------------------------- Bestellungen

if ($pfad === '/bestellungen') {
    rechtErzwingen('bestellungen');
    $status = saeubern($_GET['status'] ?? '', 20);
    $versand = saeubern($_GET['versand'] ?? '', 20);
    $abholung = ($_GET['abholung'] ?? '') === '1';
    $q = saeubern($_GET['q'] ?? '', 100);
    $wo = [];
    $werte = [];
    if ($status !== '') {
        $wo[] = 'b.status = ?';
        $werte[] = $status;
    }
    if ($versand !== '' && isset(VERSANDSTATUS[$versand])) {
        $wo[] = 'b.versandstatus = ?';
        $werte[] = $versand;
    }
    if ($abholung) {
        $wo[] = "b.abholung_json LIKE '%\"datum\":\"2%' AND b.status IN ('bezahlt','beauftragt')";
    }
    if ($q !== '') {
        $wo[] = '(b.ext_ref LIKE ? OR b.email LIKE ? OR b.zielland = ? OR b.revolut_id = ? OR b.referenz LIKE ? OR f.name LIKE ?)';
        array_push($werte, '%' . $q . '%', '%' . $q . '%', strtoupper($q), $q, '%' . $q . '%', '%' . $q . '%');
    }
    $sql = ' FROM bestellungen b LEFT JOIN firmen f ON f.id = b.firma_id' . ($wo !== [] ? ' WHERE ' . implode(' AND ', $wo) : '');
    $st = $db->prepare('SELECT COUNT(*)' . $sql);
    $st->execute($werte);
    $gesamt = (int) $st->fetchColumn();
    $seite = seiteLesen();
    $st = $db->prepare('SELECT b.*, f.name AS firma' . $sql . ' ORDER BY ' . ($abholung ? "json_extract(b.abholung_json, '$.datum'), " : '') . 'b.id DESC LIMIT 50 OFFSET ' . (($seite - 1) * 50));
    $st->execute($werte);
    ansicht('bestellungen', ['titel' => 'Bestellungen & Sendungen', 'zeilen' => $st->fetchAll(), 'gesamt' => $gesamt, 'seite' => $seite, 'status' => $status, 'versand' => $versand, 'abholung' => $abholung, 'q' => $q, 'aktiv' => 'bestellungen']);
}

if (preg_match('#^/bestellungen/(NE-\d{4}-[0-9A-F]{8})/label\.pdf$#', $pfad, $t)) {
    rechtErzwingen('bestellungen');
    $b = bestellungLaden('ext_ref', $t[1]);
    if ($b === null || $b['art'] === 'nachberechnung') {
        fehlerSeite(404, 'Nicht gefunden', 'Zu dieser Bestellung gibt es kein Label.');
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="NEOS-Label-' . $b['ext_ref'] . '.pdf"');
    echo labelPdf([$b], 'a6');
    exit;
}

if (preg_match('#^/bestellungen/(NE-\d{4}-[0-9A-F]{8})(?:/(sync|status|label|ereignis|loeschen))?$#', $pfad, $t)) {
    rechtErzwingen('bestellungen');
    $b = bestellungLaden('ext_ref', $t[1]);
    if ($b === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Diese Bestellung gibt es nicht.');
    }
    $aktion = $t[2] ?? '';
    if ($aktion !== '' && $methode === 'POST') {
        rechtErzwingen('bestellungen', $aktion === 'loeschen' ? 'loeschen' : 'bearbeiten');
        if ($aktion === 'sync') {
            if ((string) $b['revolut_id'] === '' || !zahlungBereit()) {
                hinweisSetzen('Keine Revolut-Bestellung hinterlegt oder Zahlung nicht eingerichtet.', 'fehler');
            } else {
                try {
                    $antwort = revolutAnfrage('GET', '/api/orders/' . rawurlencode((string) $b['revolut_id']));
                    $neu = statusAusRevolut((string) ($antwort['daten']['state'] ?? ''));
                    if ($neu === null) {
                        hinweisSetzen('Revolut antwortete ohne bekannten Status (HTTP ' . $antwort['status'] . ').', 'fehler');
                    } else {
                        bestellungFortschreiben($b, $neu, 'intern.sync', ['state' => $antwort['daten']['state'], 'von' => $ich['name']]);
                        protokollieren('bestellung.sync', 'bestellung', $b['ext_ref'], ['status' => $neu]);
                        hinweisSetzen('Status von Revolut übernommen: ' . statusName($neu) . '.');
                    }
                } catch (Throwable $e) {
                    hinweisSetzen('Revolut nicht erreichbar: ' . $e->getMessage(), 'fehler');
                }
            }
        } elseif ($aktion === 'status') {
            $neu = feld('status', 20);
            if (!in_array($neu, ['bezahlt', 'storniert'], true)) {
                hinweisSetzen('Unbekannter Status.', 'fehler');
            } else {
                bestellungFortschreiben($b, $neu, 'intern.status', ['von' => $ich['name'], 'grund' => feld('grund', 200)]);
                protokollieren('bestellung.status', 'bestellung', $b['ext_ref'], ['status' => $neu, 'grund' => feld('grund', 200)]);
                hinweisSetzen('Status gesetzt: ' . statusName($neu) . '.');
            }
        } elseif ($aktion === 'label') {
            if ($b['art'] === 'nachberechnung') {
                hinweisSetzen('Eine Nachberechnung hat kein Label.', 'fehler');
                umleiten(url('bestellungen/' . $b['ext_ref']));
            }
            labelBeauftragen($b);
            protokollieren('bestellung.label', 'bestellung', $b['ext_ref']);
            hinweisSetzen('Label erzeugt (NEOS-Label; Carrier-Anbindung folgt).');
        } elseif ($aktion === 'ereignis') {
            $code = feld('code', 20);
            if (!isset(VERSANDSTATUS[$code]) || in_array($code, ['angelegt', 'bezahlt'], true)) {
                hinweisSetzen('Unbekannter Versandstatus.', 'fehler');
            } else {
                $text = feld('text', 200);
                sendungsereignis((int) $b['id'], $code, feld('ort', 80), 'intern', $ich['name'], $text !== '' ? $text : null, $text !== '' ? $text : null);
                if ($code === 'storniert' && !in_array($b['status'], ['storniert'], true)) {
                    bestellungFortschreiben($b, 'storniert', 'intern.status', ['von' => $ich['name'], 'grund' => $text]);
                }
                protokollieren('bestellung.ereignis', 'bestellung', $b['ext_ref'], ['code' => $code, 'ort' => feld('ort', 80)]);
                hinweisSetzen('Versandstatus gesetzt: ' . versandstatusName($code) . '.');
            }
        } elseif ($aktion === 'loeschen') {
            if (!in_array($b['status'], ['offen', 'fehlgeschlagen', 'storniert'], true)) {
                hinweisSetzen('Nur offene, fehlgeschlagene oder stornierte Bestellungen lassen sich löschen.', 'fehler');
            } else {
                $db->prepare('DELETE FROM bestellungen WHERE id = ?')->execute([$b['id']]);
                protokollieren('bestellung.geloescht', 'bestellung', $b['ext_ref'], ['status' => $b['status']]);
                hinweisSetzen('Bestellung ' . $b['ext_ref'] . ' gelöscht.');
                umleiten(url('bestellungen'));
            }
        }
        umleiten(url('bestellungen/' . $b['ext_ref']));
    }
    $b = bestellungLaden('ext_ref', $t[1]);
    $st = $db->prepare('SELECT r.* FROM reklamationen r WHERE r.bestellung_id = ? ORDER BY r.id DESC');
    $st->execute([$b['id']]);
    $retoureZu = $b['retoure_zu'] ? bestellungLaden('id', (string) $b['retoure_zu']) : null;
    $st2 = $db->prepare('SELECT ext_ref FROM bestellungen WHERE retoure_zu = ?');
    $st2->execute([$b['id']]);
    $st3 = $db->prepare('SELECT ext_ref FROM bestellungen WHERE nachberechnung_zu = ?');
    $st3->execute([$b['id']]);
    ansicht('bestellung', ['titel' => 'Bestellung ' . $b['ext_ref'], 'b' => $b, 'sendungsereignisse' => sendungsereignisse((int) $b['id']), 'reklamationen' => $st->fetchAll(), 'retoureZu' => $retoureZu, 'retouren' => $st2->fetchAll(PDO::FETCH_COLUMN), 'nachberechnungen' => $st3->fetchAll(PDO::FETCH_COLUMN),
        'kunde' => $b['kunde_id'] ? kundeLaden((int) $b['kunde_id']) : null, 'firma' => $b['firma_id'] ? firmaLaden((int) $b['firma_id']) : null, 'aktiv' => 'bestellungen']);
}

// -------------------------------------------------------- Preise & Zielländer

if ($pfad === '/preise') {
    rechtErzwingen('preise');
    ansicht('preise', ['titel' => 'Preise & Zielländer', 'laender' => laenderAlle(), 'klassen' => gewichtsklassenAlle(), 'carrier' => carrierAlle(), 'zusatz' => zusatzleistungen(false), 'bearbeiten' => saeubern($_GET['bearbeiten'] ?? '', 40), 'aktiv' => 'preise']);
}

if (preg_match('#^/preise/zusatz(/loeschen)?$#', $pfad, $t) && $methode === 'POST') {
    $loeschen = isset($t[1]);
    rechtErzwingen('preise', $loeschen ? 'loeschen' : 'bearbeiten');
    $id = (int) feld('id', 10);
    try {
        if ($loeschen) {
            $db->prepare('DELETE FROM zusatzleistungen WHERE id = ?')->execute([$id]);
            protokollieren('zusatz.geloescht', 'zusatzleistung', $id);
            hinweisSetzen('Zusatzleistung gelöscht. Bestehende Sendungen behalten ihre gebuchten Leistungen.');
        } else {
            $code = strtolower(feld('code', 20));
            $z = ['name_de' => feld('name_de', 60), 'name_en' => feld('name_en', 60), 'beschreibung_de' => feld('beschreibung_de', 160), 'beschreibung_en' => feld('beschreibung_en', 160), 'preis_cent' => centAusEingabe(feld('preis', 12)) ?? -1, 'sortierung' => (int) feld('sortierung', 6) ?: 100, 'aktiv' => isset($_POST['aktiv']) ? 1 : 0];
            if (!preg_match('/^[a-z0-9_]{2,20}$/', $code) || $z['name_de'] === '' || $z['name_en'] === '' || $z['preis_cent'] < 0) {
                throw new InvalidArgumentException('Kürzel (Kleinbuchstaben, z. B. versicherung), beide Namen und ein Preis ≥ 0 sind Pflicht.');
            }
            $st = $db->prepare('SELECT id FROM zusatzleistungen WHERE code = ?');
            $st->execute([$code]);
            $vorhanden = $st->fetchColumn();
            if ($vorhanden !== false && (int) $vorhanden !== $id) {
                throw new InvalidArgumentException('Das Kürzel ist schon vergeben.');
            }
            if ($id > 0) {
                $db->prepare('UPDATE zusatzleistungen SET code = ?, name_de = ?, name_en = ?, beschreibung_de = ?, beschreibung_en = ?, preis_cent = ?, sortierung = ?, aktiv = ? WHERE id = ?')
                   ->execute([$code, $z['name_de'], $z['name_en'], $z['beschreibung_de'], $z['beschreibung_en'], $z['preis_cent'], $z['sortierung'], $z['aktiv'], $id]);
                protokollieren('zusatz.geaendert', 'zusatzleistung', $id, ['code' => $code, 'preis' => $z['preis_cent'], 'aktiv' => $z['aktiv']]);
            } else {
                $db->prepare('INSERT INTO zusatzleistungen (code, name_de, name_en, beschreibung_de, beschreibung_en, preis_cent, sortierung, aktiv) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                   ->execute([$code, $z['name_de'], $z['name_en'], $z['beschreibung_de'], $z['beschreibung_en'], $z['preis_cent'], $z['sortierung'], $z['aktiv']]);
                protokollieren('zusatz.angelegt', 'zusatzleistung', (int) $db->lastInsertId(), ['code' => $code]);
            }
            hinweisSetzen('Zusatzleistung „' . $code . '“ gespeichert.');
        }
    } catch (InvalidArgumentException $e) {
        hinweisSetzen($e->getMessage(), 'fehler');
    }
    umleiten(url('preise') . '#formular-zusatz');
}

if (preg_match('#^/preise/(land|gewichtsklasse|carrier)(/loeschen)?$#', $pfad, $t) && $methode === 'POST') {
    $art = $t[1];
    $loeschen = isset($t[2]);
    rechtErzwingen('preise', $loeschen ? 'loeschen' : 'bearbeiten');
    $aktiv = isset($_POST['aktiv']) ? 1 : 0;
    try {
        if ($art === 'land') {
            $code = strtoupper(feld('code', 2));
            if ($loeschen) {
                $land = landLaden($code);
                if ($land === null) {
                    throw new InvalidArgumentException('Land nicht gefunden.');
                }
                $st = $db->prepare('SELECT COUNT(*) FROM routing WHERE land_code = ?');
                $st->execute([$code]);
                if ((int) $st->fetchColumn() > 0) {
                    throw new InvalidArgumentException('Erst die Routing-Zeilen des Landes leeren, dann löschen — oder das Land nur deaktivieren.');
                }
                $db->prepare('DELETE FROM laender WHERE code = ?')->execute([$code]);
                protokollieren('land.geloescht', 'land', $code);
                hinweisSetzen('Land ' . $code . ' gelöscht.');
            } else {
                $nameDe = feld('name_de', 60);
                $nameEn = feld('name_en', 60);
                if (!preg_match('/^[A-Z]{2}$/', $code) || $nameDe === '' || $nameEn === '') {
                    throw new InvalidArgumentException('Ländercode (2 Buchstaben) und beide Namen sind Pflicht.');
                }
                $sortierung = (int) feld('sortierung', 6);
                if (landLaden($code) !== null) {
                    $db->prepare('UPDATE laender SET name_de = ?, name_en = ?, aktiv = ?, sortierung = ? WHERE code = ?')->execute([$nameDe, $nameEn, $aktiv, $sortierung, $code]);
                    protokollieren('land.geaendert', 'land', $code, ['aktiv' => $aktiv]);
                } else {
                    $db->prepare('INSERT INTO laender (code, name_de, name_en, aktiv, sortierung) VALUES (?, ?, ?, ?, ?)')->execute([$code, $nameDe, $nameEn, $aktiv, $sortierung ?: 100]);
                    protokollieren('land.angelegt', 'land', $code);
                }
                hinweisSetzen('Land ' . $code . ' gespeichert.');
            }
        } elseif ($art === 'gewichtsklasse') {
            $id = (int) feld('id', 10);
            if ($loeschen) {
                $st = $db->prepare('SELECT COUNT(*) FROM routing WHERE gewichtsklasse_id = ?');
                $st->execute([$id]);
                if ((int) $st->fetchColumn() > 0) {
                    throw new InvalidArgumentException('Erst die Routing-Zeilen der Gewichtsklasse leeren — oder nur deaktivieren.');
                }
                $db->prepare('DELETE FROM gewichtsklassen WHERE id = ?')->execute([$id]);
                protokollieren('gewichtsklasse.geloescht', 'gewichtsklasse', $id);
                hinweisSetzen('Gewichtsklasse gelöscht.');
            } else {
                $code = feld('code', 12);
                $nameDe = feld('name_de', 60);
                $nameEn = feld('name_en', 60);
                $gramm = (int) feld('max_gramm', 8);
                $sortierung = (int) feld('sortierung', 6);
                if (!preg_match('/^[a-z0-9]{1,12}$/', $code) || $nameDe === '' || $nameEn === '') {
                    throw new InvalidArgumentException('Kürzel (Kleinbuchstaben/Ziffern, z. B. 5kg) und beide Namen sind Pflicht.');
                }
                $vorhanden = gewichtsklasseNachCode($code);
                if ($id > 0) {
                    if ($vorhanden !== null && (int) $vorhanden['id'] !== $id) {
                        throw new InvalidArgumentException('Das Kürzel ist schon vergeben.');
                    }
                    $db->prepare('UPDATE gewichtsklassen SET code = ?, name_de = ?, name_en = ?, max_gramm = ?, aktiv = ?, sortierung = ? WHERE id = ?')->execute([$code, $nameDe, $nameEn, $gramm, $aktiv, $sortierung, $id]);
                    protokollieren('gewichtsklasse.geaendert', 'gewichtsklasse', $id, ['code' => $code, 'aktiv' => $aktiv]);
                } else {
                    if ($vorhanden !== null) {
                        throw new InvalidArgumentException('Das Kürzel ist schon vergeben.');
                    }
                    $db->prepare('INSERT INTO gewichtsklassen (code, name_de, name_en, max_gramm, aktiv, sortierung) VALUES (?, ?, ?, ?, ?, ?)')->execute([$code, $nameDe, $nameEn, $gramm, $aktiv, $sortierung ?: 100]);
                    protokollieren('gewichtsklasse.angelegt', 'gewichtsklasse', (int) $db->lastInsertId(), ['code' => $code]);
                }
                hinweisSetzen('Gewichtsklasse „' . $code . '“ gespeichert.');
            }
        } else {
            $id = (int) feld('id', 10);
            if ($loeschen) {
                $st = $db->prepare('SELECT COUNT(*) FROM routing WHERE carrier_id = ?');
                $st->execute([$id]);
                if ((int) $st->fetchColumn() > 0) {
                    throw new InvalidArgumentException('Der Carrier steckt noch in der Routingmatrix — erst dort ersetzen oder nur deaktivieren.');
                }
                $db->prepare('DELETE FROM carrier WHERE id = ?')->execute([$id]);
                protokollieren('carrier.geloescht', 'carrier', $id);
                hinweisSetzen('Carrier gelöscht.');
            } else {
                $name = feld('name', 60);
                if (mb_strlen($name) < 2) {
                    throw new InvalidArgumentException('Bitte einen Carrier-Namen angeben.');
                }
                $st = $db->prepare('SELECT id FROM carrier WHERE name = ?');
                $st->execute([$name]);
                $vorhanden = $st->fetchColumn();
                if ($id > 0) {
                    if ($vorhanden !== false && (int) $vorhanden !== $id) {
                        throw new InvalidArgumentException('Diesen Carrier gibt es schon.');
                    }
                    $db->prepare('UPDATE carrier SET name = ?, aktiv = ? WHERE id = ?')->execute([$name, $aktiv, $id]);
                    protokollieren('carrier.geaendert', 'carrier', $id, ['name' => $name, 'aktiv' => $aktiv]);
                } else {
                    if ($vorhanden !== false) {
                        throw new InvalidArgumentException('Diesen Carrier gibt es schon.');
                    }
                    $db->prepare('INSERT INTO carrier (name, aktiv) VALUES (?, ?)')->execute([$name, $aktiv]);
                    protokollieren('carrier.angelegt', 'carrier', (int) $db->lastInsertId(), ['name' => $name]);
                }
                hinweisSetzen('Carrier „' . $name . '“ gespeichert.');
            }
        }
    } catch (InvalidArgumentException $e) {
        hinweisSetzen($e->getMessage(), 'fehler');
    }
    umleiten(url('preise'));
}

// ------------------------------------------------------------- Routingmatrix

if ($pfad === '/routing') {
    rechtErzwingen('routing');
    ansicht('routing', ['titel' => 'Routingmatrix', 'laender' => laenderAlle(), 'klassen' => gewichtsklassenAlle(), 'matrix' => routingMatrix(), 'mwst' => (int) konfig()['mwstSatz'], 'aktiv' => 'routing']);
}

if ($pfad === '/routing/einkauf' || $pfad === '/routing/einkauf/uebernehmen' || $pfad === '/routing/einkauf/verwerfen') {
    rechtErzwingen('routing', 'bearbeiten');
    if ($pfad === '/routing/einkauf/verwerfen' && $methode === 'POST') {
        unset($_SESSION['einkauf']);
        umleiten(url('routing/einkauf'));
    }
    if ($pfad === '/routing/einkauf/uebernehmen' && $methode === 'POST') {
        $vorschau = $_SESSION['einkauf'] ?? null;
        if ($vorschau === null) {
            hinweisSetzen('Keine Vorschau — bitte die Preisliste erneut hochladen.', 'fehler');
            umleiten(url('routing/einkauf'));
        }
        try {
            $z = einkaufUebernehmen((int) $vorschau['carrier_id'], $vorschau['matrix'], (float) str_replace(',', '.', feld('aufschlag', 8)), !empty($_POST['aktiv']), $ich['name']);
            unset($_SESSION['einkauf']);
            protokollieren('routing.einkauf_import', 'carrier', (int) $vorschau['carrier_id'], $z);
            hinweisSetzen('Einkaufspreise übernommen: ' . $z['geaendert'] . ' Zellen geändert, ' . $z['neu'] . ' neue Routing-Zeilen, ' . $z['unveraendert'] . ' unverändert' . ($z['klassen_neu'] > 0 ? ', ' . $z['klassen_neu'] . ' neue Gewichtsklassen' : '') . ($z['laender_neu'] > 0 ? ', ' . $z['laender_neu'] . ' neue Länder (inaktiv, unter Preise & Zielländer freischalten)' : '') . '.' . ($z['verkauf_unter_einkauf'] > 0 ? ' Achtung: bei ' . $z['verkauf_unter_einkauf'] . ' bestehenden Zellen liegt der Verkaufspreis nicht über dem Einkauf — bitte Verkauf prüfen.' : ''));
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
        }
        umleiten(url('routing'));
    }
    if ($methode === 'POST') {
        try {
            $carrierId = (int) feld('carrier_id', 10);
            if ($carrierId <= 0) {
                throw new InvalidArgumentException('Bitte den Carrier wählen, dessen Einkaufspreise das sind.');
            }
            $datei = $_FILES['datei'] ?? null;
            if ($datei === null || ($datei['error'] ?? 1) !== UPLOAD_ERR_OK || (int) $datei['size'] > 10 * 1024 * 1024) {
                throw new InvalidArgumentException('Bitte die Preisliste als XLSX oder CSV hochladen (bis 10 MB).');
            }
            $tabelle = tabelleLesen((string) $datei['tmp_name'], (string) $datei['name']);
            $matrix = null;
            $fehler = '';
            foreach ($tabelle['blaetter'] as $b) {
                try {
                    $matrix = einkaufMatrixLesen($b);
                    break;
                } catch (InvalidArgumentException $e) {
                    $fehler = $e->getMessage();
                }
            }
            if ($matrix === null) {
                throw new InvalidArgumentException($fehler ?: 'Keine Preismatrix gefunden.');
            }
            $_SESSION['einkauf'] = ['carrier_id' => $carrierId, 'matrix' => $matrix, 'datei' => (string) $datei['name']];
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
        }
        umleiten(url('routing/einkauf'));
    }
    $vorschau = $_SESSION['einkauf'] ?? null;
    $vergleich = [];
    if ($vorschau !== null) {
        foreach ($vorschau['matrix']['zeilen'] as $zeile) {
            foreach ($zeile['preise'] as $gramm => $cent) {
                $k = einkaufKlasseFuer((int) $gramm, false);
                $st = $db->prepare('SELECT r.einkauf_cent, r.verkauf_cent FROM routing r WHERE r.land_code = ? AND r.gewichtsklasse_id = ? AND r.carrier_id = ?');
                $st->execute([$zeile['code'], (int) ($k['id'] ?? 0), $vorschau['carrier_id']]);
                $vergleich[$zeile['code']][$gramm] = ['klasse' => $k['code'] ?? null, 'alt' => ($alt = $st->fetch()) ? (int) $alt['einkauf_cent'] : null, 'verkauf' => $alt ? (int) $alt['verkauf_cent'] : null];
            }
        }
    }
    ansicht('routing_einkauf', ['titel' => 'Einkaufspreise importieren', 'carrier' => carrierAlle(), 'vorschau' => $vorschau, 'vergleich' => $vergleich, 'aktiv' => 'routing']);
}

if ($pfad === '/routing/zelle' || $pfad === '/routing/zelle/loeschen') {
    rechtErzwingen('routing');
    $quelle = $methode === 'POST' ? $_POST : $_GET;
    $landCode = strtoupper(saeubern($quelle['land'] ?? '', 2));
    $gkCode = saeubern($quelle['gk'] ?? '', 12);
    $land = landLaden($landCode);
    $gk = gewichtsklasseNachCode($gkCode);
    if ($land === null || $gk === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Land oder Gewichtsklasse unbekannt.');
    }
    if ($methode === 'POST') {
        if ($pfad === '/routing/zelle/loeschen') {
            rechtErzwingen('routing', 'loeschen');
            routingZelleSpeichern($landCode, (int) $gk['id'], [], $ich['name']);
            protokollieren('routing.geleert', 'routing', $landCode . '/' . $gkCode);
            hinweisSetzen('Zelle ' . $landCode . ' × ' . $gkCode . ' geleert — das Land wird für diese Gewichtsklasse nicht mehr angeboten.');
            umleiten(url('routing'));
        }
        rechtErzwingen('routing', 'bearbeiten');
        $zeilen = [];
        $fehler = [];
        $gesehen = [];
        for ($p = 1; $p <= 3; $p++) {
            $carrierId = (int) ($_POST['carrier'][$p] ?? 0);
            if ($carrierId <= 0) {
                continue;
            }
            if (isset($gesehen[$carrierId])) {
                $fehler[] = 'Priorität ' . $p . ': Carrier doppelt.';
                continue;
            }
            $gesehen[$carrierId] = true;
            $verkauf = centAusEingabe((string) ($_POST['verkauf'][$p] ?? ''));
            $einkauf = centAusEingabe((string) ($_POST['einkauf'][$p] ?? '0'));
            if ($verkauf === null || $verkauf <= 0) {
                $fehler[] = 'Priorität ' . $p . ': Verkaufspreis fehlt oder ist ungültig.';
            }
            if ($einkauf === null) {
                $fehler[] = 'Priorität ' . $p . ': Einkaufspreis ungültig.';
            }
            $zeilen[] = [
                'carrier_id' => $carrierId,
                'laufzeit_de' => saeubern($_POST['laufzeit_de'][$p] ?? '', 40),
                'laufzeit_en' => saeubern($_POST['laufzeit_en'][$p] ?? '', 40),
                'einkauf_cent' => $einkauf ?? 0,
                'verkauf_cent' => $verkauf ?? 0,
                'aktiv' => isset($_POST['aktiv'][$p]),
            ];
        }
        if ($fehler === []) {
            // Prioritäten lückenlos 1..n in der Reihenfolge des Formulars.
            $zellen = [];
            foreach ($zeilen as $i => $z) {
                $zellen[$i + 1] = $z;
            }
            routingZelleSpeichern($landCode, (int) $gk['id'], $zellen, $ich['name']);
            protokollieren('routing.gespeichert', 'routing', $landCode . '/' . $gkCode, ['zeilen' => array_map(static fn (array $z): array => ['carrier' => $z['carrier_id'], 'verkauf' => $z['verkauf_cent'], 'einkauf' => $z['einkauf_cent'], 'aktiv' => $z['aktiv']], $zellen)]);
            hinweisSetzen('Zelle ' . $landCode . ' × ' . $gkCode . ' gespeichert. Startseite und Checkout zeigen die neuen Werte sofort.');
            umleiten(url('routing'));
        }
        hinweisSetzen(implode(' ', $fehler), 'fehler');
    }
    ansicht('routing_zelle', ['titel' => 'Routing ' . $landCode . ' × ' . $gkCode, 'land' => $land, 'gk' => $gk, 'zeilen' => routingZelle($landCode, (int) $gk['id']), 'carrier' => carrierAlle(), 'mwst' => (int) konfig()['mwstSatz'], 'aktiv' => 'routing']);
}

// --------------------------------------------------------- Kunden & Anfragen

if ($pfad === '/kunden') {
    rechtErzwingen('kunden');
    $reiter = in_array($_GET['reiter'] ?? '', ['firmen', 'privatkunden'], true) ? $_GET['reiter'] : 'anfragen';
    $status = saeubern($_GET['status'] ?? '', 20);
    $q = saeubern($_GET['q'] ?? '', 100);
    $seite = seiteLesen();
    $gesamt = 0;
    if ($reiter === 'anfragen') {
        $wo = [];
        $werte = [];
        if ($status !== '') {
            $wo[] = 'status = ?';
            $werte[] = $status;
        }
        if ($q !== '') {
            $wo[] = '(name LIKE ? OR email LIKE ? OR firma LIKE ?)';
            array_push($werte, '%' . $q . '%', '%' . $q . '%', '%' . $q . '%');
        }
        $sql = $wo !== [] ? ' WHERE ' . implode(' AND ', $wo) : '';
        $st = $db->prepare('SELECT COUNT(*) FROM anfragen' . $sql);
        $st->execute($werte);
        $gesamt = (int) $st->fetchColumn();
        $st = $db->prepare('SELECT a.*, b.name AS bearbeiter FROM anfragen a LEFT JOIN benutzer b ON b.id = a.bearbeiter_id' . $sql . ' ORDER BY a.id DESC LIMIT 50 OFFSET ' . (($seite - 1) * 50));
        $st->execute($werte);
        $zeilen = $st->fetchAll();
    } elseif ($reiter === 'firmen') {
        $zeilen = array_values(array_filter(firmenAlle(), static fn (array $f): bool => $q === '' || stripos($f['name'] . ' ' . $f['ort'] . ' ' . $f['rechnungs_email'], $q) !== false));
        $gesamt = count($zeilen);
    } else {
        $sql = $q !== '' ? ' WHERE (k.email LIKE ? OR k.name LIKE ?)' : '';
        $werte = $q !== '' ? ['%' . $q . '%', '%' . $q . '%'] : [];
        $st = $db->prepare("SELECT COUNT(*) FROM kunden k WHERE k.art = 'privat'" . ($q !== '' ? ' AND (k.email LIKE ? OR k.name LIKE ?)' : ''));
        $st->execute($werte);
        $gesamt = (int) $st->fetchColumn();
        $st = $db->prepare(<<<'SQL'
            SELECT k.*, (SELECT COUNT(*) FROM bestellungen b WHERE b.kunde_id = k.id) AS bestellungen,
                   (SELECT COALESCE(SUM(betrag_cent),0) FROM bestellungen b WHERE b.kunde_id = k.id AND b.status IN ('bezahlt','beauftragt')) AS umsatz,
                   (SELECT COALESCE(SUM(betrag_cent),0) FROM guthaben_buchungen g WHERE g.kunde_id = k.id AND g.firma_id IS NULL) AS guthaben
            FROM kunden k WHERE k.art = 'privat'
        SQL . ($q !== '' ? ' AND (k.email LIKE ? OR k.name LIKE ?)' : '') . ' ORDER BY k.id DESC LIMIT 50 OFFSET ' . (($seite - 1) * 50));
        $st->execute($werte);
        $zeilen = $st->fetchAll();
    }
    ansicht('kunden', ['titel' => 'Kunden & Anfragen', 'reiter' => $reiter, 'zeilen' => $zeilen, 'gesamt' => $gesamt, 'seite' => $seite, 'status' => $status, 'q' => $q, 'aktiv' => 'kunden']);
}

if ($pfad === '/kunden/firmen/neu') {
    rechtErzwingen('kunden', 'bearbeiten');
    $fehler = null;
    $anfrage = null;
    $anfrageId = (int) ($_GET['anfrage'] ?? $_POST['anfrage_id'] ?? 0);
    if ($anfrageId > 0) {
        $st = $db->prepare('SELECT * FROM anfragen WHERE id = ?');
        $st->execute([$anfrageId]);
        $anfrage = $st->fetch() ?: null;
    }
    $werte = ['name' => $anfrage['firma'] ?? '', 'strasse' => '', 'plz' => '', 'ort' => '', 'land' => 'DE', 'ust_id' => '', 'rechnungs_email' => $anfrage['email'] ?? '', 'inhaber_name' => $anfrage['name'] ?? '', 'inhaber_email' => $anfrage['email'] ?? '', 'sprache' => $anfrage['sprache'] ?? 'de'];
    if ($methode === 'POST') {
        foreach ($werte as $k => $_) {
            $werte[$k] = feld($k, 254);
        }
        try {
            if (filter_var($werte['inhaber_email'], FILTER_VALIDATE_EMAIL) === false || mb_strlen($werte['inhaber_name']) < 2) {
                throw new InvalidArgumentException('Bitte Name und gültige E-Mail des Inhabers angeben.');
            }
            $vorhanden = kundeNachEmail($werte['inhaber_email']);
            if ($vorhanden !== null) {
                throw new InvalidArgumentException('Die E-Mail des Inhabers hat schon ein Konto.');
            }
            $firmaId = firmaAnlegen($werte + ['anfrage_id' => $anfrageId], $ich['name']);
            $firma = firmaLaden($firmaId);
            firmenBenutzerEinladen($firma, $werte['inhaber_email'], $werte['inhaber_name'], 'inhaber', $werte['sprache'] === 'en' ? 'en' : 'de');
            if ($anfrage !== null) {
                $db->prepare("UPDATE anfragen SET status = 'konto_angelegt', firma_id = ?, bearbeiter_id = ?, aktualisiert = ? WHERE id = ?")->execute([$firmaId, $ich['id'], jetzt(), $anfrage['id']]);
            }
            protokollieren('firma.angelegt', 'firma', $firmaId, ['name' => $werte['name'], 'inhaber' => mb_strtolower($werte['inhaber_email'])]);
            hinweisSetzen('Firmenkonto angelegt. Der Inhaber hat eine Einladung per E-Mail bekommen.');
            umleiten(url('kunden/firmen/' . $firmaId));
        } catch (InvalidArgumentException $e) {
            $fehler = $e->getMessage();
        }
    }
    ansicht('firma_form', ['titel' => 'Firmenkonto anlegen', 'werte' => $werte, 'fehler' => $fehler, 'anfrage' => $anfrage, 'aktiv' => 'kunden']);
}

if (preg_match('#^/kunden/firmen/(\d+)(?:/(daten|einladen|benutzer|rechnung|aktiv))?$#', $pfad, $t)) {
    rechtErzwingen('kunden');
    $firma = firmaLaden((int) $t[1]);
    if ($firma === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Diese Firma gibt es nicht.');
    }
    $aktion = $t[2] ?? '';
    if ($aktion !== '' && $methode === 'POST') {
        try {
            if ($aktion === 'rechnung') {
                rechtErzwingen('rechnungen', 'bearbeiten');
                $zeitraum = monatsZeitraum(feld('monat', 7));
                if ($zeitraum === null) {
                    throw new InvalidArgumentException('Bitte einen Monat wählen.');
                }
                $r = rechnungErzeugen((int) $firma['id'], $zeitraum[0], $zeitraum[1], $ich['name']);
                protokollieren('rechnung.erzeugt', 'rechnung', $r['nummer'], ['firma' => $firma['name'], 'brutto' => $r['brutto_cent']]);
                hinweisSetzen('Rechnung ' . $r['nummer'] . ' erzeugt (' . euro((int) $r['brutto_cent']) . ' brutto) und per Mail angekündigt.');
                umleiten(url('rechnungen/' . $r['id']));
            }
            rechtErzwingen('kunden', 'bearbeiten');
            if ($aktion === 'daten') {
                $daten = ['name' => feld('name', 120), 'strasse' => feld('strasse', 120), 'plz' => feld('plz', 12), 'ort' => feld('ort', 80), 'land' => strtoupper(feld('land', 2)) ?: 'DE', 'ust_id' => feld('ust_id', 30), 'rechnungs_email' => mb_strtolower(feld('rechnungs_email', 254)), 'zahlungsziel_tage' => max(0, (int) feld('zahlungsziel_tage', 4))];
                if (mb_strlen($daten['name']) < 2) {
                    throw new InvalidArgumentException('Bitte einen Firmennamen angeben.');
                }
                firmaAktualisieren((int) $firma['id'], $daten);
                protokollieren('firma.geaendert', 'firma', (int) $firma['id']);
                hinweisSetzen('Firmendaten gespeichert.');
            } elseif ($aktion === 'aktiv') {
                $neu = (int) $firma['aktiv'] === 1 ? 0 : 1;
                firmaAktualisieren((int) $firma['id'], ['aktiv' => $neu]);
                protokollieren('firma.' . ($neu ? 'aktiviert' : 'deaktiviert'), 'firma', (int) $firma['id']);
                hinweisSetzen($neu ? 'Firma aktiviert.' : 'Firma deaktiviert — Benutzer können sich nicht mehr anmelden.');
            } elseif ($aktion === 'einladen') {
                $id = firmenBenutzerEinladen($firma, feld('email', 254), feld('name', 100), feld('rolle', 12) === 'inhaber' ? 'inhaber' : 'mitarbeiter', feld('sprache', 2) === 'en' ? 'en' : 'de');
                protokollieren('firma.benutzer_eingeladen', 'kunde', $id, ['firma' => $firma['name']]);
                hinweisSetzen('Einladung verschickt.');
            } elseif ($aktion === 'benutzer') {
                $kunde = kundeLaden((int) feld('kunde_id', 10));
                if ($kunde === null || (int) $kunde['firma_id'] !== (int) $firma['id']) {
                    throw new InvalidArgumentException('Benutzer gehört nicht zu dieser Firma.');
                }
                $was = feld('was', 12);
                if ($was === 'einladen') {
                    firmenBenutzerEinladen($firma, (string) $kunde['email'], (string) $kunde['name'], (string) $kunde['firmenrolle'], (string) $kunde['sprache']);
                    hinweisSetzen('Einladung erneut verschickt.');
                } else {
                    kundeAktualisieren((int) $kunde['id'], ['aktiv' => $was === 'aktivieren' ? 1 : 0]);
                    hinweisSetzen('Benutzer ' . ($was === 'aktivieren' ? 'aktiviert' : 'deaktiviert') . '.');
                }
                protokollieren('firma.benutzer_' . $was, 'kunde', (int) $kunde['id']);
            }
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
        }
        umleiten(url('kunden/firmen/' . $firma['id']));
    }
    $st = $db->prepare('SELECT b.*, k.name AS angelegt_von FROM bestellungen b LEFT JOIN kunden k ON k.id = b.kunde_id WHERE b.firma_id = ? ORDER BY b.id DESC LIMIT 20');
    $st->execute([$firma['id']]);
    $monate = [];
    for ($i = 0; $i < 6; $i++) {
        $monate[] = gmdate('Y-m', strtotime('first day of -' . $i . ' month'));
    }
    $guthabenKonto = ['id' => 0, 'art' => 'business', 'firma_id' => (int) $firma['id']];
    ansicht('firma', ['titel' => $firma['name'], 'firma' => $firma, 'benutzer' => firmenBenutzer((int) $firma['id']), 'sendungen' => $st->fetchAll(), 'rechnungen' => rechnungenDerFirma((int) $firma['id']), 'monate' => $monate,
        'guthaben' => guthabenStand($guthabenKonto), 'buchungen' => guthabenBuchungen($guthabenKonto, 10), 'aktiv' => 'kunden']);
}

if (preg_match('#^/kunden/privat/(\d+)$#', $pfad, $t)) {
    rechtErzwingen('kunden');
    $kunde = kundeLaden((int) $t[1]);
    if ($kunde === null || $kunde['art'] !== 'privat') {
        fehlerSeite(404, 'Nicht gefunden', 'Diesen Privatkunden gibt es nicht.');
    }
    $st = $db->prepare('SELECT * FROM bestellungen WHERE kunde_id = ? ORDER BY id DESC LIMIT 20');
    $st->execute([$kunde['id']]);
    $rk = $db->prepare('SELECT r.*, b.ext_ref FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id WHERE r.kunde_id = ? AND r.firma_id IS NULL ORDER BY r.id DESC');
    $rk->execute([$kunde['id']]);
    ansicht('privatkunde', ['titel' => $kunde['name'], 'kunde' => $kunde, 'bestellungen' => $st->fetchAll(), 'guthaben' => guthabenStand($kunde), 'buchungen' => guthabenBuchungen($kunde, 20), 'reklamationen' => $rk->fetchAll(), 'aktiv' => 'kunden']);
}

if (preg_match('#^/kunden/anfragen/(\d+)(?:/(status|notiz|loeschen))?$#', $pfad, $t)) {
    rechtErzwingen('kunden');
    $st = $db->prepare('SELECT a.*, b.name AS bearbeiter FROM anfragen a LEFT JOIN benutzer b ON b.id = a.bearbeiter_id WHERE a.id = ?');
    $st->execute([(int) $t[1]]);
    $a = $st->fetch();
    if (!is_array($a)) {
        fehlerSeite(404, 'Nicht gefunden', 'Diese Anfrage gibt es nicht.');
    }
    $aktion = $t[2] ?? '';
    if ($aktion !== '' && $methode === 'POST') {
        if ($aktion === 'loeschen') {
            rechtErzwingen('kunden', 'loeschen');
            $db->prepare('DELETE FROM anfragen WHERE id = ?')->execute([$a['id']]);
            protokollieren('anfrage.geloescht', 'anfrage', (int) $a['id'], ['email' => $a['email']]);
            hinweisSetzen('Anfrage gelöscht.');
            umleiten(url('kunden'));
        }
        rechtErzwingen('kunden', 'bearbeiten');
        $status = feld('status', 20);
        if (!in_array($status, ['neu', 'in_bearbeitung', 'konto_angelegt', 'erledigt'], true)) {
            $status = (string) $a['status'];
        }
        $notiz = feld('notiz', 2000);
        $db->prepare('UPDATE anfragen SET status = ?, notiz = ?, bearbeiter_id = ?, aktualisiert = ? WHERE id = ?')->execute([$status, $notiz, $ich['id'], jetzt(), $a['id']]);
        protokollieren('anfrage.geaendert', 'anfrage', (int) $a['id'], ['status' => $status]);
        hinweisSetzen('Anfrage gespeichert.');
        umleiten(url('kunden/anfragen/' . $a['id']));
    }
    $st = $db->prepare('SELECT ext_ref, status, zielland, betrag_cent, erstellt FROM bestellungen WHERE email = ? ORDER BY id DESC LIMIT 10');
    $st->execute([$a['email']]);
    ansicht('anfrage', ['titel' => 'Anfrage von ' . $a['name'], 'a' => $a, 'bestellungen' => $st->fetchAll(), 'aktiv' => 'kunden']);
}

// ------------------------------------------------------------------ Rechnungen

if ($pfad === '/rechnungen') {
    rechtErzwingen('rechnungen');
    $status = saeubern($_GET['status'] ?? '', 20);
    ansicht('rechnungen', ['titel' => 'Rechnungen', 'zeilen' => rechnungenAlle($status), 'status' => $status, 'firmen' => firmenAlle(), 'aktiv' => 'rechnungen']);
}

if (preg_match('#^/rechnungen/(\d+)(\.pdf)?(?:/(status))?$#', $pfad, $t)) {
    rechtErzwingen('rechnungen');
    $r = rechnungLaden((int) $t[1]);
    if ($r === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Diese Rechnung gibt es nicht.');
    }
    if (($t[2] ?? '') === '.pdf') {
        $datei = rechnungPfad($r);
        if (!is_file($datei)) {
            fehlerSeite(404, 'Nicht gefunden', 'Die PDF-Datei fehlt im Datenverzeichnis.');
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $r['nummer'] . '.pdf"');
        header('Content-Length: ' . (string) filesize($datei));
        readfile($datei);
        exit;
    }
    if (($t[3] ?? '') === 'status' && $methode === 'POST') {
        rechtErzwingen('rechnungen', 'bearbeiten');
        try {
            $neu = feld('status', 12);
            rechnungStatusSetzen($r, $neu);
            protokollieren('rechnung.status', 'rechnung', $r['nummer'], ['status' => $neu]);
            hinweisSetzen('Rechnung ' . $r['nummer'] . ': ' . rechnungStatusName($neu) . '.');
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
        }
        umleiten(url('rechnungen/' . $r['id']));
    }
    ansicht('rechnung', ['titel' => 'Rechnung ' . $r['nummer'], 'r' => $r, 'firma' => firmaLaden((int) $r['firma_id']), 'positionen' => rechnungPositionen((int) $r['id']), 'aktiv' => 'rechnungen']);
}

// -------------------------------------------------------------- Reklamationen

if ($pfad === '/reklamationen') {
    rechtErzwingen('reklamationen');
    $status = saeubern($_GET['status'] ?? '', 20);
    $sql = 'SELECT r.*, b.ext_ref, b.zielland, b.carrier, k.name AS kunde_name, f.name AS firma_name FROM reklamationen r JOIN bestellungen b ON b.id = r.bestellung_id LEFT JOIN kunden k ON k.id = r.kunde_id LEFT JOIN firmen f ON f.id = r.firma_id';
    $werte = [];
    if ($status !== '' && isset(REKLAMATION_STATUS[$status])) {
        $sql .= ' WHERE r.status = ?';
        $werte[] = $status;
    } elseif ($status === '') {
        $sql .= " WHERE r.status NOT IN ('erstattet','abgelehnt')";
    }
    $st = $db->prepare($sql . ' ORDER BY r.id DESC LIMIT 200');
    $st->execute($werte);
    ansicht('reklamationen', ['titel' => 'Reklamationen', 'zeilen' => $st->fetchAll(), 'status' => $status, 'aktiv' => 'reklamationen']);
}

if (preg_match('#^/reklamationen/(\d+)(?:/(status))?$#', $pfad, $t)) {
    rechtErzwingen('reklamationen');
    $r = reklamationLaden((int) $t[1]);
    if ($r === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Diese Reklamation gibt es nicht.');
    }
    if (($t[2] ?? '') === 'status' && $methode === 'POST') {
        rechtErzwingen('reklamationen', 'bearbeiten');
        try {
            $neu = feld('status', 20);
            $antwort = feld('antwort', 4000);
            $erstattung = centAusEingabe(feld('erstattung', 12)) ?? 0;
            if ($neu === 'erstattet' && $erstattung <= 0) {
                throw new InvalidArgumentException('Für „Erstattet“ bitte einen Betrag angeben — er wird dem Kunden als Guthaben gutgeschrieben.');
            }
            reklamationFortschreiben($r, $neu, $antwort, $erstattung, $ich['name']);
            protokollieren('reklamation.status', 'reklamation', (int) $r['id'], ['status' => $neu, 'erstattung' => $erstattung]);
            if (!empty($_POST['mail']) && $antwort !== '') {
                reklamationAntwortSenden(reklamationLaden((int) $r['id']) ?? $r);
            }
            hinweisSetzen('Reklamation: ' . REKLAMATION_STATUS[$neu]['de'] . ($neu === 'erstattet' ? ' — ' . euro($erstattung) . ' als Guthaben gebucht' : '') . '.');
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage() === 'status' ? 'Unbekannter Status.' : $e->getMessage(), 'fehler');
        }
        umleiten(url('reklamationen/' . $r['id']));
    }
    ansicht('reklamation', ['titel' => 'Reklamation #' . $r['id'], 'r' => $r, 'b' => bestellungLaden('id', (string) $r['bestellung_id']), 'aktiv' => 'reklamationen']);
}

// ------------------------------------------------------------ Rechnungsprüfung

if ($pfad === '/rechnungspruefung') {
    rechtErzwingen('rechnungspruefung');
    if ($methode === 'POST') {
        rechtErzwingen('rechnungspruefung', 'bearbeiten');
        try {
            $carrierId = (int) feld('carrier_id', 10);
            if ($carrierId <= 0) {
                throw new InvalidArgumentException('Bitte den Carrier wählen, der die Rechnung gestellt hat.');
            }
            $csv = $_FILES['csv'] ?? null;
            if ($csv === null || ($csv['error'] ?? 1) !== UPLOAD_ERR_OK || (int) $csv['size'] > 10 * 1024 * 1024) {
                throw new InvalidArgumentException('Bitte die Tabelle der Rechnung (CSV oder XLSX) hochladen (bis 10 MB).');
            }
            $pdf = $_FILES['pdf'] ?? null;
            $pdfPfad = $pdf !== null && ($pdf['error'] ?? 1) === UPLOAD_ERR_OK && (int) $pdf['size'] <= 20 * 1024 * 1024 ? (string) $pdf['tmp_name'] : null;
            if ($pdfPfad !== null && substr((string) file_get_contents($pdfPfad, false, null, 0, 5), 0, 4) !== '%PDF') {
                throw new InvalidArgumentException('Die PDF-Datei ist kein PDF.');
            }
            $id = rpRechnungAnlegen($carrierId, ['tabelle' => (string) $csv['tmp_name'], 'tabelle_name' => (string) $csv['name'], 'pdf' => $pdfPfad], ['nummer' => feld('nummer', 40), 'datum' => rpDatumNormalisieren(feld('datum', 12)), 'netto_cent' => centAusEingabe(feld('netto', 14)) ?? 0], $ich['name']);
            protokollieren('lieferantenrechnung.hochgeladen', 'lieferantenrechnung', $id, ['carrier_id' => $carrierId]);
            umleiten(url('rechnungspruefung/' . $id . '/zuordnung'));
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
            umleiten(url('rechnungspruefung'));
        }
    }
    $status = saeubern($_GET['status'] ?? '', 20);
    ansicht('rechnungspruefung', ['titel' => 'Rechnungsprüfung', 'zeilen' => rpRechnungenAlle($status), 'status' => $status, 'carrier' => carrierAlle(), 'aktiv' => 'rechnungspruefung']);
}

if (preg_match('#^/rechnungspruefung/(\d+)(?:/(zuordnung|pruefen|status|notiz|kopf|beanstandung\.csv|rechnung\.pdf|loeschen|alle-buchen))?$#', $pfad, $t)) {
    rechtErzwingen('rechnungspruefung');
    $r = rpRechnungLaden((int) $t[1]);
    if ($r === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Diese Lieferantenrechnung gibt es nicht.');
    }
    $aktion = $t[2] ?? '';
    if ($aktion === 'rechnung.pdf') {
        $datei = rpVerzeichnis() . '/' . $r['datei_pdf'];
        if ($r['datei_pdf'] === '' || !is_file($datei)) {
            fehlerSeite(404, 'Nicht gefunden', 'Zu dieser Rechnung wurde kein PDF hochgeladen.');
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="Lieferantenrechnung-' . ($r['nummer'] ?: $r['id']) . '.pdf"');
        readfile($datei);
        exit;
    }
    if ($aktion === 'beanstandung.csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="Beanstandung-' . preg_replace('/[^A-Za-z0-9_-]/', '_', (string) ($r['nummer'] ?: $r['id'])) . '.csv"');
        echo rpBeanstandungCsv($r);
        exit;
    }
    if ($aktion === 'zuordnung') {
        $blattName = saeubern($_POST['blatt'] ?? $_GET['blatt'] ?? '', 60);
        $tabelle = rpRechnungTabelle($r, $blattName);
        $csv = $tabelle['blatt'];
        if ($methode === 'POST') {
            rechtErzwingen('rechnungspruefung', 'bearbeiten');
            $spalten = [];
            foreach (array_keys(RP_FELDER) as $feld) {
                $spalten[$feld] = isset($_POST['spalte'][$feld]) && $_POST['spalte'][$feld] !== '' ? (int) $_POST['spalte'][$feld] : -1;
            }
            $einheit = feld('einheit', 2) === 'g' ? 'g' : 'kg';
            try {
                $n = rpPositionenImportieren($r, $spalten, $einheit, $csv['name'], feld('zuschlag_blatt', 60));
                if (!empty($_POST['profil'])) {
                    rpProfilSpeichern((int) $r['carrier_id'], $spalten, $einheit, $csv['kopf']);
                }
                protokollieren('lieferantenrechnung.geprueft', 'lieferantenrechnung', (int) $r['id'], ['positionen' => $n]);
                hinweisSetzen($n . ' Positionen eingelesen und geprüft.');
                umleiten(url('rechnungspruefung/' . $r['id']));
            } catch (InvalidArgumentException $e) {
                hinweisSetzen($e->getMessage(), 'fehler');
                umleiten(url('rechnungspruefung/' . $r['id'] . '/zuordnung'));
            }
        }
        $gespeichert = json_decode((string) $r['spalten_json'], true) ?: [];
        $vorschlag = $gespeichert !== [] && isset($gespeichert['gewicht']) ? $gespeichert : (rpProfilAnwenden(rpProfilFuerCarrier((int) $r['carrier_id']), $csv['kopf']) ?? rpSpaltenErkennen($csv['kopf'], $csv['zeilen']));
        $zuschlagVorschlag = (string) ($r['zuschlag_blatt'] ?? '');
        if ($zuschlagVorschlag === '' && count($tabelle['blaetter']) > 1 && ($vorschlag['zuschlag'] ?? -1) < 0) {
            $schluessel = [];
            foreach ($csv['zeilen'] as $z) {
                foreach (['sendungsnummer', 'referenz'] as $f) {
                    if (($vorschlag[$f] ?? -1) >= 0 && trim((string) ($z[$vorschlag[$f]] ?? '')) !== '') {
                        $schluessel[trim((string) $z[$vorschlag[$f]])] = true;
                    }
                }
            }
            foreach ($tabelle['blaetter'] as $i => $b) {
                if ($i !== $tabelle['index'] && ($info = rpZuschlagErkennen($b, $schluessel)) !== null && $info['betraege'] !== []) {
                    $zuschlagVorschlag = $b['name'];
                    break;
                }
            }
        }
        ansicht('rechnungspruefung_zuordnung', ['titel' => 'Spalten zuordnen', 'r' => $r, 'csv' => $csv, 'blaetter' => $tabelle['blaetter'], 'blattIndex' => $tabelle['index'], 'zuschlagBlatt' => $zuschlagVorschlag, 'vorschlag' => $vorschlag, 'einheit' => $r['status'] !== 'zuordnung' ? $r['gewicht_einheit'] : rpGewichtEinheitRaten($csv['zeilen'], (int) ($vorschlag['gewicht'] ?? -1)), 'aktiv' => 'rechnungspruefung']);
    }
    if ($aktion !== '' && $methode === 'POST') {
        rechtErzwingen('rechnungspruefung', $aktion === 'loeschen' ? 'loeschen' : 'bearbeiten');
        try {
            if ($aktion === 'pruefen') {
                rpRechnungPruefen((int) $r['id']);
                hinweisSetzen('Alle Positionen neu geprüft.');
            } elseif ($aktion === 'status') {
                $neu = feld('status', 20);
                if (!isset(RP_STATUS[$neu]) || $neu === 'zuordnung') {
                    throw new InvalidArgumentException('Unbekannter Status.');
                }
                $db->prepare('UPDATE lieferantenrechnungen SET status = ?, aktualisiert = ? WHERE id = ?')->execute([$neu, jetzt(), $r['id']]);
                protokollieren('lieferantenrechnung.status', 'lieferantenrechnung', (int) $r['id'], ['status' => $neu]);
                hinweisSetzen('Rechnung: ' . RP_STATUS[$neu] . '.');
            } elseif ($aktion === 'notiz') {
                $db->prepare('UPDATE lieferantenrechnungen SET notiz = ?, aktualisiert = ? WHERE id = ?')->execute([feld('notiz', 4000), jetzt(), $r['id']]);
                hinweisSetzen('Notiz gespeichert.');
            } elseif ($aktion === 'kopf') {
                $db->prepare('UPDATE lieferantenrechnungen SET nummer = ?, datum = ?, betrag_netto_cent = ?, aktualisiert = ? WHERE id = ?')
                   ->execute([feld('nummer', 40), rpDatumNormalisieren(feld('datum', 12)), centAusEingabe(feld('netto', 14)) ?? 0, jetzt(), $r['id']]);
                hinweisSetzen('Kopfdaten gespeichert.');
            } elseif ($aktion === 'alle-buchen') {
                $n = 0;
                $summe = 0;
                foreach (rpPositionen((int) $r['id']) as $p) {
                    if ($p['nachberechnung_status'] === 'offen' && (int) $p['nachberechnung_cent'] > 0) {
                        $p['rechnung_nummer'] = $r['nummer'];
                        rpNachberechnungBuchen($p, $ich['name']);
                        $n++;
                        $summe += (int) $p['nachberechnung_cent'];
                    }
                }
                protokollieren('nachberechnung.alle', 'lieferantenrechnung', (int) $r['id'], ['anzahl' => $n, 'netto' => $summe]);
                hinweisSetzen($n . ' Nachberechnungen gebucht (' . euro($summe) . ' netto) — Kunden sind per Mail informiert.');
            } elseif ($aktion === 'loeschen') {
                if ((int) $db->query('SELECT COUNT(*) FROM lieferantenpositionen WHERE rechnung_id = ' . (int) $r['id'] . " AND nachberechnung_status IN ('gebucht','gutschrift')")->fetchColumn() > 0) {
                    throw new InvalidArgumentException('Rechnungen mit gebuchten Nachberechnungen oder Gutschriften lassen sich nicht löschen.');
                }
                $db->prepare('DELETE FROM lieferantenpositionen WHERE rechnung_id = ?')->execute([$r['id']]);
                $db->prepare('DELETE FROM lieferantenrechnungen WHERE id = ?')->execute([$r['id']]);
                foreach ([$r['datei_pdf'], $r['datei_csv']] as $d) {
                    if ($d !== '' && is_file(rpVerzeichnis() . '/' . $d)) {
                        unlink(rpVerzeichnis() . '/' . $d);
                    }
                }
                protokollieren('lieferantenrechnung.geloescht', 'lieferantenrechnung', (int) $r['id']);
                hinweisSetzen('Lieferantenrechnung gelöscht.');
                umleiten(url('rechnungspruefung'));
            }
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
        }
        umleiten(url('rechnungspruefung/' . $r['id']));
    }
    if ($r['status'] === 'zuordnung') {
        umleiten(url('rechnungspruefung/' . $r['id'] . '/zuordnung'));
    }
    $befund = saeubern($_GET['befund'] ?? '', 24);
    ansicht('lieferantenrechnung', ['titel' => 'Lieferantenrechnung ' . ($r['nummer'] ?: '#' . $r['id']), 'r' => $r, 'positionen' => rpPositionen((int) $r['id'], $befund), 'z' => rpZusammenfassung((int) $r['id']), 'befund' => $befund, 'pdfKopf' => json_decode((string) $r['pdf_kopf_json'], true) ?: [], 'aktiv' => 'rechnungspruefung']);
}

if (preg_match('#^/rechnungspruefung/position/(\d+)/(zuordnen|buchen|verzichten|gutschrift)$#', $pfad, $t) && $methode === 'POST') {
    rechtErzwingen('rechnungspruefung', 'bearbeiten');
    $p = rpPositionLaden((int) $t[1]);
    if ($p === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Diese Position gibt es nicht.');
    }
    try {
        if ($t[2] === 'zuordnen') {
            rpPositionZuordnen($p, feld('ext_ref', 20));
            hinweisSetzen('Position ' . $p['zeile'] . ' zugeordnet und neu geprüft.');
        } elseif ($t[2] === 'buchen') {
            $betrag = feld('betrag', 12) !== '' ? centAusEingabe(feld('betrag', 12)) : null;
            $neu = rpNachberechnungBuchen($p, $ich['name'], $betrag);
            protokollieren('nachberechnung.gebucht', 'bestellung', $neu['ext_ref'], ['netto' => $neu['netto_cent'], 'zahlungsart' => $neu['zahlungsart'], 'position' => (int) $p['id']]);
            hinweisSetzen('Nachberechnung ' . $neu['ext_ref'] . ' gebucht (' . euro((int) $neu['netto_cent']) . ' netto, ' . ['rechnung' => 'nächste Sammelrechnung', 'guthaben' => 'vom Guthaben abgebucht', 'revolut' => 'offene Zahlung, Kunde per Mail gebeten'][$neu['zahlungsart']] . ').');
        } elseif ($t[2] === 'verzichten') {
            rpNachberechnungVerzichten($p);
            hinweisSetzen('Auf die Nachberechnung für Zeile ' . $p['zeile'] . ' verzichtet.');
        } else {
            $betrag = rpGutschriftBuchen($p, $ich['name']);
            protokollieren('gutschrift.gebucht', 'lieferantenposition', (int) $p['id'], ['betrag' => $betrag]);
            hinweisSetzen('Gutschrift ' . euro($betrag) . ' als Guthaben gebucht.');
        }
    } catch (InvalidArgumentException $e) {
        hinweisSetzen($e->getMessage(), 'fehler');
    }
    umleiten(url('rechnungspruefung/' . $p['rechnung_id']));
}

// ---------------------------------------------------------- Benutzer & Rollen

if ($pfad === '/benutzer') {
    rechtErzwingen('benutzer');
    ansicht('benutzer', ['titel' => 'Benutzer & Rollen', 'zeilen' => benutzerAlle(), 'rollen' => rollenAlle(), 'aktiv' => 'benutzer']);
}

if ($pfad === '/benutzer/neu') {
    rechtErzwingen('benutzer', 'bearbeiten');
    $fehler = null;
    $werte = ['email' => '', 'name' => '', 'rolle_id' => 0];
    if ($methode === 'POST') {
        $werte = ['email' => feld('email', 254), 'name' => feld('name', 100), 'rolle_id' => (int) feld('rolle_id', 10)];
        try {
            $neu = benutzerAnlegen($werte['email'], $werte['name'], $werte['rolle_id']);
            protokollieren('benutzer.angelegt', 'benutzer', $neu['id'], ['email' => mb_strtolower($werte['email']), 'rolle_id' => $werte['rolle_id']]);
            $_SESSION['startpasswort'] = ['id' => $neu['id'], 'passwort' => $neu['passwort']];
            hinweisSetzen('Benutzer angelegt. Das Startpasswort steht unten — es wird nur einmal angezeigt.');
            umleiten(url('benutzer/' . $neu['id']));
        } catch (InvalidArgumentException $e) {
            $fehler = $e->getMessage();
        }
    }
    ansicht('benutzer_form', ['titel' => 'Neuer Benutzer', 'b' => null, 'werte' => $werte, 'rollen' => rollenAlle(), 'fehler' => $fehler, 'startpasswort' => null, 'aktiv' => 'benutzer']);
}

if (preg_match('#^/benutzer/(\d+)(?:/(passwort|loeschen))?$#', $pfad, $t)) {
    rechtErzwingen('benutzer');
    $b = benutzerLaden((int) $t[1]);
    if ($b === null) {
        fehlerSeite(404, 'Nicht gefunden', 'Diesen Benutzer gibt es nicht.');
    }
    $aktion = $t[2] ?? '';
    $fehler = null;
    $istAdmin = (int) $b['system'] === 1 && (int) $b['aktiv'] === 1;
    $letzterAdmin = $istAdmin && aktiveAdmins() <= 1;
    if ($methode === 'POST') {
        rechtErzwingen('benutzer', $aktion === 'loeschen' ? 'loeschen' : 'bearbeiten');
        if ($aktion === 'loeschen') {
            if ((int) $b['id'] === (int) $ich['id']) {
                hinweisSetzen('Du kannst dich nicht selbst löschen.', 'fehler');
            } elseif ($letzterAdmin) {
                hinweisSetzen('Der letzte aktive Admin lässt sich nicht löschen.', 'fehler');
            } else {
                $db->prepare('DELETE FROM benutzer WHERE id = ?')->execute([$b['id']]);
                protokollieren('benutzer.geloescht', 'benutzer', (int) $b['id'], ['email' => $b['email']]);
                hinweisSetzen('Benutzer ' . $b['email'] . ' gelöscht.');
                umleiten(url('benutzer'));
            }
            umleiten(url('benutzer/' . $b['id']));
        }
        if ($aktion === 'passwort') {
            $neu = passwortErzeugen();
            $db->prepare('UPDATE benutzer SET passwort_hash = ?, muss_passwort_aendern = 1, fehlversuche = 0, gesperrt_bis = NULL, aktualisiert = ? WHERE id = ?')
               ->execute([password_hash($neu, PASSWORD_DEFAULT), jetzt(), $b['id']]);
            protokollieren('benutzer.passwort_zurueckgesetzt', 'benutzer', (int) $b['id']);
            $_SESSION['startpasswort'] = ['id' => (int) $b['id'], 'passwort' => $neu];
            hinweisSetzen('Neues Startpasswort erzeugt — es wird nur einmal angezeigt.');
            umleiten(url('benutzer/' . $b['id']));
        }
        $name = feld('name', 100);
        $rolleId = (int) feld('rolle_id', 10);
        $aktiv = isset($_POST['aktiv']) ? 1 : 0;
        $rolle = rolleLaden($rolleId);
        if (mb_strlen($name) < 2) {
            $fehler = 'Bitte einen Namen angeben.';
        } elseif ($rolle === null) {
            $fehler = 'Bitte eine Rolle wählen.';
        } elseif ((int) $b['id'] === (int) $ich['id'] && ($aktiv === 0 || (int) $rolle['system'] !== (int) $ich['system'])) {
            $fehler = 'Eigenes Konto: Rolle und Aktiv-Status kann nur ein anderer Admin ändern.';
        } elseif ($letzterAdmin && ($aktiv === 0 || (int) $rolle['system'] !== 1)) {
            $fehler = 'Der letzte aktive Admin muss Admin und aktiv bleiben.';
        } else {
            $db->prepare('UPDATE benutzer SET name = ?, rolle_id = ?, aktiv = ?, aktualisiert = ? WHERE id = ?')->execute([$name, $rolleId, $aktiv, jetzt(), $b['id']]);
            protokollieren('benutzer.geaendert', 'benutzer', (int) $b['id'], ['rolle_id' => $rolleId, 'aktiv' => $aktiv]);
            hinweisSetzen('Benutzer gespeichert.');
            umleiten(url('benutzer/' . $b['id']));
        }
    }
    $start = $_SESSION['startpasswort'] ?? null;
    unset($_SESSION['startpasswort']);
    if (!is_array($start) || (int) $start['id'] !== (int) $b['id']) {
        $start = null;
    }
    ansicht('benutzer_form', ['titel' => $b['name'], 'b' => $b, 'werte' => ['email' => $b['email'], 'name' => $b['name'], 'rolle_id' => (int) $b['rolle_id']], 'rollen' => rollenAlle(), 'fehler' => $fehler, 'startpasswort' => $start['passwort'] ?? null, 'letzterAdmin' => $letzterAdmin, 'aktiv' => 'benutzer']);
}

if ($pfad === '/rollen') {
    rechtErzwingen('benutzer');
    umleiten(url('benutzer'));
}

if ($pfad === '/rollen/neu' || preg_match('#^/rollen/(\d+)(?:/(loeschen))?$#', $pfad, $t)) {
    rechtErzwingen('benutzer');
    $rolle = null;
    if ($pfad !== '/rollen/neu') {
        $rolle = rolleLaden((int) $t[1]);
        if ($rolle === null) {
            fehlerSeite(404, 'Nicht gefunden', 'Diese Rolle gibt es nicht.');
        }
    }
    $aktion = $t[2] ?? '';
    $fehler = null;
    $werte = ['name' => $rolle['name'] ?? '', 'beschreibung' => $rolle['beschreibung'] ?? ''];
    $matrix = $rolle !== null ? rechteDerRolle((int) $rolle['id']) : rechteDerRolle(0);
    if ($methode === 'POST') {
        rechtErzwingen('benutzer', $aktion === 'loeschen' ? 'loeschen' : 'bearbeiten');
        if ($rolle !== null && (int) $rolle['system'] === 1) {
            hinweisSetzen('Die Systemrolle Admin ist nicht änderbar.', 'fehler');
            umleiten(url('rollen/' . $rolle['id']));
        }
        if ($aktion === 'loeschen') {
            $st = $db->prepare('SELECT COUNT(*) FROM benutzer WHERE rolle_id = ?');
            $st->execute([$rolle['id']]);
            if ((int) $st->fetchColumn() > 0) {
                hinweisSetzen('Die Rolle hat noch Benutzer — erst umhängen, dann löschen.', 'fehler');
                umleiten(url('rollen/' . $rolle['id']));
            }
            $db->prepare('DELETE FROM rollen WHERE id = ?')->execute([$rolle['id']]);
            protokollieren('rolle.geloescht', 'rolle', (int) $rolle['id'], ['name' => $rolle['name']]);
            hinweisSetzen('Rolle „' . $rolle['name'] . '“ gelöscht.');
            umleiten(url('benutzer'));
        }
        $werte = ['name' => feld('name', 60), 'beschreibung' => feld('beschreibung', 300)];
        $eingabe = is_array($_POST['rechte'] ?? null) ? $_POST['rechte'] : [];
        $matrix = [];
        foreach (MODULE as $modul => $_) {
            $r = is_array($eingabe[$modul] ?? null) ? $eingabe[$modul] : [];
            $matrix[$modul] = ['sehen' => !empty($r['sehen']) || !empty($r['bearbeiten']) || !empty($r['loeschen']), 'bearbeiten' => !empty($r['bearbeiten']), 'loeschen' => !empty($r['loeschen'])];
        }
        $st = $db->prepare('SELECT id FROM rollen WHERE name = ?');
        $st->execute([$werte['name']]);
        $doppelt = $st->fetchColumn();
        if (mb_strlen($werte['name']) < 2) {
            $fehler = 'Bitte einen Rollennamen angeben.';
        } elseif ($doppelt !== false && ($rolle === null || (int) $doppelt !== (int) $rolle['id'])) {
            $fehler = 'Diesen Rollennamen gibt es schon.';
        } else {
            if ($rolle === null) {
                $db->prepare('INSERT INTO rollen (name, beschreibung, system, erstellt) VALUES (?, ?, 0, ?)')->execute([$werte['name'], $werte['beschreibung'], jetzt()]);
                $rolleId = (int) $db->lastInsertId();
                protokollieren('rolle.angelegt', 'rolle', $rolleId, ['name' => $werte['name'], 'rechte' => $matrix]);
            } else {
                $rolleId = (int) $rolle['id'];
                $db->prepare('UPDATE rollen SET name = ?, beschreibung = ? WHERE id = ?')->execute([$werte['name'], $werte['beschreibung'], $rolleId]);
                protokollieren('rolle.geaendert', 'rolle', $rolleId, ['name' => $werte['name'], 'rechte' => $matrix]);
            }
            rechteSpeichern($rolleId, $eingabe);
            hinweisSetzen('Rolle „' . $werte['name'] . '“ gespeichert. Die Rechte gelten ab der nächsten Seite jedes Benutzers.');
            umleiten(url('rollen/' . $rolleId));
        }
    }
    ansicht('rolle_form', ['titel' => $rolle !== null ? 'Rolle ' . $rolle['name'] : 'Neue Rolle', 'rolle' => $rolle, 'werte' => $werte, 'matrix' => $matrix, 'fehler' => $fehler, 'aktiv' => 'benutzer']);
}

if ($pfad === '/protokoll') {
    rechtErzwingen('benutzer');
    $seite = seiteLesen();
    $gesamt = (int) $db->query('SELECT COUNT(*) FROM protokoll')->fetchColumn();
    $zeilen = $db->query('SELECT * FROM protokoll ORDER BY id DESC LIMIT 100 OFFSET ' . (($seite - 1) * 100))->fetchAll();
    ansicht('protokoll', ['titel' => 'Änderungsprotokoll', 'zeilen' => $zeilen, 'gesamt' => $gesamt, 'seite' => $seite, 'aktiv' => 'benutzer']);
}

fehlerSeite(404, 'Nicht gefunden', 'Diese Seite gibt es im Dashboard nicht.');
