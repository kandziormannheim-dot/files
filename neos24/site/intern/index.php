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
    $q = saeubern($_GET['q'] ?? '', 100);
    $wo = [];
    $werte = [];
    if ($status !== '') {
        $wo[] = 'status = ?';
        $werte[] = $status;
    }
    if ($q !== '') {
        $wo[] = '(ext_ref LIKE ? OR email LIKE ? OR zielland = ? OR revolut_id = ?)';
        array_push($werte, '%' . $q . '%', '%' . $q . '%', strtoupper($q), $q);
    }
    $sql = $wo !== [] ? ' WHERE ' . implode(' AND ', $wo) : '';
    $st = $db->prepare('SELECT COUNT(*) FROM bestellungen' . $sql);
    $st->execute($werte);
    $gesamt = (int) $st->fetchColumn();
    $seite = seiteLesen();
    $st = $db->prepare('SELECT b.*, f.name AS firma FROM bestellungen b LEFT JOIN firmen f ON f.id = b.firma_id' . str_replace(['status = ?', 'ext_ref LIKE', 'email LIKE', 'zielland = ?', 'revolut_id = ?'], ['b.status = ?', 'b.ext_ref LIKE', 'b.email LIKE', 'b.zielland = ?', 'b.revolut_id = ?'], $sql) . ' ORDER BY b.id DESC LIMIT 50 OFFSET ' . (($seite - 1) * 50));
    $st->execute($werte);
    ansicht('bestellungen', ['titel' => 'Bestellungen & Sendungen', 'zeilen' => $st->fetchAll(), 'gesamt' => $gesamt, 'seite' => $seite, 'status' => $status, 'q' => $q, 'aktiv' => 'bestellungen']);
}

if (preg_match('#^/bestellungen/(NE-\d{4}-[0-9A-F]{8})(?:/(sync|status|label|loeschen))?$#', $pfad, $t)) {
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
            labelBeauftragen($b);
            protokollieren('bestellung.label', 'bestellung', $b['ext_ref']);
            hinweisSetzen('Label-Auftrag vermerkt (Carrier-Anbindung folgt).');
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
    ansicht('bestellung', ['titel' => 'Bestellung ' . $b['ext_ref'], 'b' => bestellungLaden('ext_ref', $t[1]), 'aktiv' => 'bestellungen']);
}

// -------------------------------------------------------- Preise & Zielländer

if ($pfad === '/preise') {
    rechtErzwingen('preise');
    ansicht('preise', ['titel' => 'Preise & Zielländer', 'laender' => laenderAlle(), 'klassen' => gewichtsklassenAlle(), 'carrier' => carrierAlle(), 'bearbeiten' => saeubern($_GET['bearbeiten'] ?? '', 40), 'aktiv' => 'preise']);
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
                   (SELECT COALESCE(SUM(betrag_cent),0) FROM bestellungen b WHERE b.kunde_id = k.id AND b.status = 'bezahlt') AS umsatz
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
    ansicht('firma', ['titel' => $firma['name'], 'firma' => $firma, 'benutzer' => firmenBenutzer((int) $firma['id']), 'sendungen' => $st->fetchAll(), 'rechnungen' => rechnungenDerFirma((int) $firma['id']), 'monate' => $monate, 'aktiv' => 'kunden']);
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
