<?php

/**
 * Routen des Kundenportals für Versandfunktionen (angemeldet):
 * Neue Sendung mit Carrier-Vergleich und Zusatzleistungen, Bezahlung,
 * Labels, Retoure, Reklamationen, Adressbuch, Paketvorlagen, CSV-Import,
 * Guthaben. Eingebunden aus index.php; erwartet $pfad, $methode, $ich, $firma, $db.
 */

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/label_pdf.php';

$business = $ich['art'] === 'business';
$listenPfad = $business ? 'sendungen' : 'bestellungen';

/** Angebote aller Zellen für das Formular (JSON): laender[code].klassen[gk] = [angebote] — mit Kundenpreisliste deren Preise. */
function angeboteFuerFormular(string $sprache, ?int $preislisteId = null): array
{
    $p = preisliste();
    $aus = ['gewichtsklassen' => [], 'kategorien' => [], 'laender' => [], 'zusatz' => [], 'mwst' => (int) $p['mwstSatz'], 'preisliste' => $preislisteId !== null];
    foreach (KATEGORIEN as $k => $namen) {
        $aus['kategorien'][$k] = $namen[$sprache];
    }
    foreach ($p['gewichtsklassen'] as $code => $gk) {
        $aus['gewichtsklassen'][$code] = ['name' => $gk[$sprache], 'max_gramm' => (int) $gk['max_gramm'], 'kategorie' => (string) ($gk['kategorie'] ?? 'paket')];
    }
    foreach ($p['laender'] as $code => $land) {
        $klassen = [];
        foreach ($p['gewichtsklassen'] as $gkCode => $_) {
            $angebote = angeboteFuer((string) $code, (string) $gkCode, $preislisteId);
            if ($angebote !== []) {
                $klassen[$gkCode] = array_map(static fn (array $a): array => ['carrier' => $a['carrier'], 'netto' => $a['netto'], 'brutto' => $a['brutto'], 'laufzeit' => $a['laufzeit'][$sprache], 'empfohlen' => $a['empfohlen'], 'volumenfaktor' => $a['volumenfaktor']], $angebote);
            }
        }
        if ($klassen !== []) {
            $aus['laender'][$code] = ['name' => $land['name'][$sprache], 'eu' => (bool) ($land['eu'] ?? landIstEu((string) $code)), 'klassen' => $klassen];
        }
    }
    foreach (zusatzleistungen(true, $preislisteId) as $code => $z) {
        $aus['zusatz'][$code] = ['name' => $z['name'][$sprache], 'beschreibung' => $z['beschreibung'][$sprache], 'preis' => $z['preis']];
    }

    return $aus;
}

/**
 * Mittlere Abweichung Carrier-Gewicht minus eingegebenes Gewicht der letzten
 * Sendungen (Gramm, Prozent, Anzahl) — Grundlage für den Warnhinweis im Formular.
 */
function abweichungsquote(array $kunde, int $anzahl = 20): array
{
    [$wo, $werte] = bereich($kunde);
    $st = datenbank()->prepare('SELECT b.gewicht_gramm, b.gewicht_carrier_gramm FROM bestellungen b WHERE ' . $wo . " AND b.gewicht_carrier_gramm > 0 AND b.gewicht_gramm > 0 AND b.art = 'sendung' ORDER BY b.id DESC LIMIT " . $anzahl);
    $st->execute($werte);
    $zeilen = $st->fetchAll();
    if ($zeilen === []) {
        return ['gramm' => 0, 'prozent' => 0, 'anzahl' => 0, 'warnen' => false];
    }
    $summeDiff = 0;
    $summeGewicht = 0;
    foreach ($zeilen as $z) {
        $summeDiff += (int) $z['gewicht_carrier_gramm'] - (int) $z['gewicht_gramm'];
        $summeGewicht += (int) $z['gewicht_gramm'];
    }
    $gramm = (int) round($summeDiff / count($zeilen));
    $prozent = $summeGewicht > 0 ? (int) round($summeDiff / $summeGewicht * 100) : 0;

    return ['gramm' => $gramm, 'prozent' => $prozent, 'anzahl' => count($zeilen), 'warnen' => count($zeilen) >= 2 && ($gramm >= 300 || $prozent >= 15)];
}

/** Standard-Absender: Adressbuch-Standard, sonst Unterkunde, sonst Firma bzw. gespeicherte Absenderadresse. */
function standardAbsender(array $kunde, ?array $firma, ?array $unterkunde = null): array
{
    foreach (adressenAlle($kunde, 'absender') as $a) {
        if ((int) $a['standard'] === 1) {
            return $a;
        }
    }
    if ($unterkunde !== null && (string) $unterkunde['strasse'] !== '') {
        return ['name' => $unterkunde['name'], 'firma' => '', 'strasse' => $unterkunde['strasse'], 'plz' => $unterkunde['plz'], 'ort' => $unterkunde['ort'], 'land' => $unterkunde['land'] ?: 'DE', 'email' => '', 'telefon' => ''];
    }
    if ($firma !== null) {
        return ['name' => $firma['name'], 'firma' => '', 'strasse' => $firma['strasse'], 'plz' => $firma['plz'], 'ort' => $firma['ort'], 'land' => $firma['land'] ?: 'DE', 'email' => '', 'telefon' => ''];
    }
    $a = json_decode((string) ($kunde['absender_json'] ?? '{}'), true) ?: [];

    return ['name' => $a['name'] ?? $kunde['name'], 'firma' => '', 'strasse' => $a['strasse'] ?? '', 'plz' => $a['plz'] ?? '', 'ort' => $a['ort'] ?? '', 'land' => 'DE', 'email' => '', 'telefon' => ''];
}

// ---------------------------------------------------------------- Neue Sendung

if ($pfad === '/sendungen/neu') {
    if ($business) {
        kundenRechtErzwingen('versand', 'bearbeiten');
    }
    $fehler = [];
    // Unterkunde (Rechnungsempfänger): fest zugeordnet, aus ?unterkunde= (Wechsel lädt die Preise neu) oder aus dem Formular
    $unterkundeId = $festerUnterkunde > 0 ? $festerUnterkunde : (int) ($_POST['unterkunde_id'] ?? $_GET['unterkunde'] ?? ($ich['unterkunde_id'] ?? 0));
    $unterkunde = null;
    foreach ($unterkunden as $u) {
        if ((int) $u['id'] === $unterkundeId) {
            $unterkunde = $u;
        }
    }
    $unterkundeId = $unterkunde !== null ? (int) $unterkunde['id'] : 0;
    $preislisteId = preislisteFuerKonto(['unterkunde_id' => $unterkundeId] + $ich);
    $abweichung = abweichungsquote($ich);
    $werte = ['kategorie' => 'paket', 'zielland' => '', 'gewicht_kg' => '', 'laenge' => '', 'breite' => '', 'hoehe' => '', 'carrier' => '', 'referenz' => '', 'zusatz' => [], 'abholung_datum' => '', 'abholung_fenster' => '9-13', 'versicherung_wert' => '', 'nachnahme' => '', 'zahlungsart' => $business ? 'rechnung' : 'revolut', 'adresse_speichern' => false, 'gewicht_geprueft' => false,
        'unterkunde_id' => $unterkundeId, 'absender' => standardAbsender($ich, $firma, $unterkunde), 'empfaenger' => ['name' => '', 'firma' => '', 'strasse' => '', 'plz' => '', 'ort' => '', 'email' => '', 'telefon' => '']];
    if (in_array($_GET['kategorie'] ?? '', ['brief', 'paket'], true)) {
        $werte['kategorie'] = $_GET['kategorie'];
    }
    if ($methode === 'POST') {
        foreach (['kategorie', 'zielland', 'gewicht_kg', 'laenge', 'breite', 'hoehe', 'carrier', 'referenz', 'abholung_datum', 'abholung_fenster', 'versicherung_wert', 'nachnahme', 'zahlungsart'] as $k) {
            $werte[$k] = feld($k, 100);
        }
        if (!in_array($werte['kategorie'], ['brief', 'paket'], true)) {
            $werte['kategorie'] = 'paket';
        }
        $werte['zusatz'] = is_array($_POST['zusatz'] ?? null) ? array_map('strval', $_POST['zusatz']) : [];
        $werte['adresse_speichern'] = !empty($_POST['adresse_speichern']);
        $werte['gewicht_geprueft'] = !empty($_POST['gewicht_geprueft']);
        foreach (['absender', 'empfaenger'] as $rolle) {
            $roh = is_array($_POST[$rolle] ?? null) ? $_POST[$rolle] : [];
            foreach (['name', 'firma', 'strasse', 'plz', 'ort', 'email', 'telefon', 'land'] as $f) {
                $werte[$rolle][$f] = saeubern($roh[$f] ?? '', 254);
            }
        }
        $zahlungsart = $business ? (in_array($werte['zahlungsart'], ['rechnung', 'guthaben'], true) ? $werte['zahlungsart'] : 'rechnung') : (in_array($werte['zahlungsart'], ['revolut', 'guthaben'], true) ? $werte['zahlungsart'] : 'revolut');
        $gramm = (int) round((float) str_replace(',', '.', $werte['gewicht_kg']) * 1000);
        $ergebnis = $abweichung['warnen'] && !$werte['gewicht_geprueft'] ? ['fehler' => ['gewicht_bestaetigt']] : bestellungAnlegen([
            'sprache' => sprache(), 'kategorie' => $werte['kategorie'], 'zielland' => $werte['zielland'], 'gewicht_gramm' => $gramm, 'carrier' => $werte['carrier'],
            'zusatz' => $werte['zusatz'], 'masse' => ['l' => (int) $werte['laenge'], 'b' => (int) $werte['breite'], 'h' => (int) $werte['hoehe']],
            'abholung' => ['datum' => $werte['abholung_datum'], 'fenster' => $werte['abholung_fenster']],
            'versicherung_wert_cent' => centAusEingabe($werte['versicherung_wert']) ?? 0, 'nachnahme_cent' => centAusEingabe($werte['nachnahme']) ?? 0,
            'email' => $ich['email'], 'absender' => $werte['absender'], 'empfaenger' => $werte['empfaenger'], 'referenz' => $werte['referenz'],
            'kunde_id' => $ich['id'], 'firma_id' => $firma['id'] ?? null, 'unterkunde_id' => $unterkundeId ?: null, 'preisliste_id' => $preislisteId, 'zahlungsart' => $zahlungsart, 'angelegt_von' => $ich['name'],
            'adresse_speichern' => $werte['adresse_speichern'],
        ]);
        if (isset($ergebnis['bestellung'])) {
            $b = $ergebnis['bestellung'];
            if ($zahlungsart === 'revolut') {
                umleiten(url('bestellungen/' . $b['ext_ref'] . '/bezahlen'));
            }
            hinweisSetzen(t('neu.angelegt', $b['ext_ref']));
            umleiten(url($listenPfad . '/' . $b['ext_ref']));
        }
        $fehler = $ergebnis['fehler'];
        if ($gramm <= 0) {
            $fehler[] = 'gewicht';
        }
    }
    $meldung = null;
    foreach (['carrier' => 'neu.fehler.carrier', 'gewicht' => 'neu.fehler.gewicht', 'gewicht_bestaetigt' => 'neu.fehler.gewicht_bestaetigt', 'abholung' => 'neu.fehler.abholung', 'nachnahme' => 'neu.fehler.nachnahme', 'guthaben' => 'neu.fehler.guthaben', 'zielland' => 'neu.carrier.leer'] as $f => $key) {
        if (in_array($f, $fehler, true)) {
            $meldung = t($key);
            break;
        }
    }
    ansicht('sendung_neu', ['titel' => t('neu.titel'), 'werte' => $werte, 'fehler' => $fehler, 'meldung' => $meldung ?? ($fehler !== [] ? t('neu.fehler') : null), 'angebote' => angeboteFuerFormular(sprache(), $preislisteId),
        'adressen' => adressenAlle($ich), 'vorlagen' => vorlagenAlle($ich), 'guthaben' => guthabenStand($ich), 'zahlungBereit' => zahlungBereit(), 'business' => $business, 'abweichung' => $abweichung, 'preisliste' => $preislisteId !== null,
        'unterkunden' => $festerUnterkunde > 0 ? [] : $unterkunden, 'unterkunde' => $unterkunde, 'firma' => $firma, 'aktiv' => 'neu']);
}

// ------------------------------------------------------------ Palettenanfrage
// Paletten sind nur auf Anfrage buchbar: Formular → Anfrage (typ palette) im Dashboard + Mail ans Postfach.

if ($pfad === '/sendungen/palette') {
    if ($business) {
        kundenRechtErzwingen('versand', 'bearbeiten');
    }
    $fehler = [];
    $werte = ['zielland' => '', 'anzahl' => '1', 'palettenart' => '', 'gewicht' => '', 'abholung' => '', 'nachricht' => ''];
    if ($methode === 'POST') {
        foreach (array_keys($werte) as $k) {
            $werte[$k] = feld($k, $k === 'nachricht' ? 4000 : 120);
        }
        if (!begrenzungPruefen('anfrage')) {
            $fehler[] = 'zu-viele';
        } elseif ($werte['zielland'] === '' || (int) $werte['anzahl'] <= 0) {
            $fehler[] = 'zielland';
        } else {
            $id = palettenanfrageAnlegen(['art' => $ich['art'], 'name' => $ich['name'], 'firma' => $firma['name'] ?? '', 'email' => $ich['email'], 'sprache' => sprache(), 'nachricht' => $werte['nachricht'],
                'zielland' => $werte['zielland'], 'anzahl' => $werte['anzahl'], 'palettenart' => $werte['palettenart'], 'gewicht' => $werte['gewicht'], 'abholung' => $werte['abholung'],
                'firma_id' => $firma['id'] ?? null, 'kundennummer' => $firma['kundennummer'] ?? ($ich['kundennummer'] ?? '')]);
            hinweisSetzen(t('palette.gesendet', (string) $id));
            umleiten(url($listenPfad));
        }
    }
    $laender = [];
    foreach (preisliste()['laender'] as $code => $land) {
        $laender[$code] = ['name' => $land['name'][sprache()], 'eu' => (bool) ($land['eu'] ?? landIstEu((string) $code))];
    }
    ansicht('sendung_palette', ['titel' => t('palette.titel'), 'werte' => $werte, 'fehler' => $fehler, 'meldung' => $fehler === [] ? null : t(in_array('zu-viele', $fehler, true) ? 'palette.fehler.zu_viele' : 'palette.fehler.zielland'), 'laender' => $laender, 'business' => $business, 'aktiv' => 'neu']);
}

// ------------------------------------------------------------------ Bezahlen

if (preg_match('#^/(bestellungen|sendungen)/(NE-\d{4}-[0-9A-F]{8})/(bezahlen|token|status|guthaben)$#', $pfad, $t)) {
    if ($business) {
        kundenRechtErzwingen('versand', 'bearbeiten');
    }
    $b = eigeneBestellung($ich, $t[2]);
    if ($b === null) {
        fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
    }
    if ($t[3] === 'status') {
        header('Content-Type: application/json; charset=utf-8');
        if (in_array($b['status'], ['angelegt', 'autorisiert'], true) && (string) $b['revolut_id'] !== '' && zahlungBereit()) {
            try {
                $antwort = revolutAnfrage('GET', '/api/orders/' . rawurlencode((string) $b['revolut_id']));
                $neu = statusAusRevolut((string) ($antwort['daten']['state'] ?? ''));
                if ($antwort['status'] === 200 && $neu !== null && $neu !== $b['status']) {
                    $b = bestellungFortschreiben($b, $neu, 'revolut.abgleich', ['state' => $antwort['daten']['state']]);
                }
            } catch (Throwable $e) {
                error_log('[konto] Abgleich: ' . $e->getMessage());
            }
        }
        echo json_encode(['ok' => true, 'status' => $b['status']]);
        exit;
    }
    if ($t[3] === 'token' && $methode === 'POST') {
        header('Content-Type: application/json; charset=utf-8');
        if ($b['zahlungsart'] !== 'revolut' || !in_array($b['status'], ['offen', 'angelegt', 'fehlgeschlagen'], true)) {
            echo json_encode(['ok' => false, 'fehler' => 'status']);
            exit;
        }
        if (!zahlungBereit()) {
            echo json_encode(['ok' => false, 'fehler' => 'nicht-eingerichtet']);
            exit;
        }
        try {
            $token = bestellungRevolutEroeffnen($b);
            echo json_encode(['ok' => true, 'token' => $token, 'modus' => checkoutModus()]);
        } catch (Throwable $e) {
            error_log('[konto] Revolut-Order: ' . $e->getMessage());
            echo json_encode(['ok' => false, 'fehler' => 'zahlungsdienst']);
        }
        exit;
    }
    if ($t[3] === 'guthaben' && $methode === 'POST') {
        if (in_array($b['status'], ['offen', 'angelegt', 'fehlgeschlagen'], true) && guthabenStand($ich) >= (int) $b['betrag_cent']) {
            guthabenBuchen($ich, 'verbrauch', -(int) $b['betrag_cent'], ($b['art'] === 'nachberechnung' ? 'Nachberechnung ' : 'Sendung ') . $b['ext_ref'], (int) $b['id']);
            $db->prepare("UPDATE bestellungen SET zahlungsart = 'guthaben' WHERE id = ?")->execute([$b['id']]);
            $b = bestellungFortschreiben(bestellungLaden('ext_ref', $b['ext_ref']), 'beauftragt', 'guthaben.belastet', ['betrag' => (int) $b['betrag_cent']]);
            nachBeauftragung($b);
            if (!$b['firma_id']) {
                lexwareAuftragAnlegen('rechnung', 'bestellungen', (int) $b['id']);
                lexwareAuftraegeAbarbeiten(3);
            }
            hinweisSetzen(t('neu.angelegt', $b['ext_ref']));
        } else {
            hinweisSetzen(t('neu.fehler.guthaben'), 'fehler');
        }
        umleiten(url($listenPfad . '/' . $b['ext_ref']));
    }
    if ($t[3] === 'bezahlen') {
        if (!in_array($b['status'], ['offen', 'angelegt', 'fehlgeschlagen', 'autorisiert'], true)) {
            umleiten(url($listenPfad . '/' . $b['ext_ref']));
        }
        ansicht('bezahlen', ['titel' => t('bezahlen.titel'), 'b' => $b, 'guthaben' => guthabenStand($ich), 'zahlungBereit' => zahlungBereit(), 'modus' => checkoutModus(), 'zurueck' => isset($_GET['zurueck']), 'aktiv' => $listenPfad]);
    }
}

// ---------------------------------------------------------------- Labels

if (preg_match('#^/(bestellungen|sendungen)/(NE-\d{4}-[0-9A-F]{8})/label\.pdf$#', $pfad, $t)) {
    if ($business) {
        kundenRechtEinesErzwingen([['lager', 'bearbeiten'], ['versand', 'bearbeiten']]);
    }
    $b = eigeneBestellung($ich, $t[2]);
    if ($b === null || !in_array($b['status'], ['bezahlt', 'beauftragt'], true) || $b['art'] === 'nachberechnung') {
        fehlerSeite(404, t('fehler.404'), t('label.noch_nicht'));
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="NEOS-Label-' . $b['ext_ref'] . '.pdf"');
    echo labelPdf([$b], 'a6');
    exit;
}

if ($pfad === '/sendungen/labels.pdf' || $pfad === '/bestellungen/labels.pdf') {
    if ($business) {
        kundenRechtEinesErzwingen([['lager', 'bearbeiten'], ['versand', 'bearbeiten']]);
    }
    $refs = array_filter(array_map('trim', explode(',', (string) ($_GET['refs'] ?? ''))));
    $liste = [];
    foreach (array_slice($refs, 0, 40) as $ref) {
        if (preg_match('/^NE-\d{4}-[0-9A-F]{8}$/', $ref)) {
            $b = eigeneBestellung($ich, $ref);
            if ($b !== null && in_array($b['status'], ['bezahlt', 'beauftragt'], true) && $b['art'] !== 'nachberechnung') {
                $liste[] = $b;
            }
        }
    }
    if ($liste === []) {
        fehlerSeite(404, t('fehler.404'), t('label.noch_nicht'));
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="NEOS-Labels.pdf"');
    echo labelPdf($liste, 'a4');
    exit;
}

// ------------------------------------------ Nachweis, Rechnung, Widerspruch

if (preg_match('#^/(bestellungen|sendungen)/(NE-\d{4}-[0-9A-F]{8})/(nachweis|rechnung|gutschrift)\.pdf$#', $pfad, $t)) {
    if ($business) {
        kundenRechtErzwingen('buchhaltung');
    }
    $b = eigeneBestellung($ich, $t[2]);
    $datei = $b === null ? '' : belegDateiFuerBestellung($b, $t[3]);
    if ($b === null || $datei === '' || !is_file($datei)) {
        fehlerSeite(404, t('fehler.404'), $t[3] !== 'nachweis' ? t('nachberechnung.rechnung_folgt') : t('fehler.404.text'));
    }
    $nb = json_decode((string) ($b['nachberechnung_json'] ?? '{}'), true) ?: [];
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="NEOS-' . ($t[3] === 'nachweis' ? 'Nachweis-' . $b['ext_ref'] : ($t[3] === 'gutschrift' ? 'Gutschrift-' . ($nb['lexware_gutschrift_nummer'] ?? $b['ext_ref']) : 'Rechnung-' . ($b['lexware_nummer'] ?: $b['ext_ref']))) . '.pdf"');
    header('Content-Length: ' . (string) filesize($datei));
    readfile($datei);
    exit;
}

if (preg_match('#^/(bestellungen|sendungen)/(NE-\d{4}-[0-9A-F]{8})/widerspruch$#', $pfad, $t) && $methode === 'POST') {
    if ($business) {
        kundenRechtErzwingen('retouren', 'bearbeiten');
    }
    $b = eigeneBestellung($ich, $t[2]);
    if ($b === null || $b['art'] !== 'nachberechnung' || $b['status'] === 'storniert') {
        fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
    }
    $frist = (int) (konfig()['rechnungspruefung']['widerspruchTage'] ?? 14);
    if (strtotime((string) $b['erstellt']) < time() - $frist * 86400) {
        hinweisSetzen(t('nachberechnung.widerspruch.frist'), 'fehler');
        umleiten(url($t[1] . '/' . $b['ext_ref']));
    }
    try {
        reklamationAnlegen($ich, $b, 'nachberechnung', feld('beschreibung', 4000), (int) $b['betrag_cent']);
        hinweisSetzen(t('nachberechnung.widerspruch.eingereicht'));
    } catch (InvalidArgumentException) {
        hinweisSetzen(t('reklamationen.fehler'), 'fehler');
    }
    umleiten(url($t[1] . '/' . $b['ext_ref']));
}

// ------------------------------------------------------- Retoure, Reklamation

if (preg_match('#^/(bestellungen|sendungen)/(NE-\d{4}-[0-9A-F]{8})/retoure$#', $pfad, $t) && $methode === 'POST') {
    if ($business) {
        kundenRechtErzwingen('retouren', 'bearbeiten');
    }
    $b = eigeneBestellung($ich, $t[2]);
    if ($b === null || !in_array($b['status'], ['bezahlt', 'beauftragt'], true) || $b['art'] !== 'sendung') {
        fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
    }
    $zahlungsart = $business ? 'rechnung' : (guthabenStand($ich) >= bruttoCent((int) $b['netto_cent'] - (int) $b['zusatz_cent']) ? 'guthaben' : 'revolut');
    $ergebnis = retoureAnlegen($ich, $b, $zahlungsart, $ich['name']);
    if (isset($ergebnis['fehler'])) {
        hinweisSetzen(t('neu.carrier.leer'), 'fehler');
        umleiten(url($listenPfad . '/' . $b['ext_ref']));
    }
    $r = $ergebnis['bestellung'];
    if ($zahlungsart === 'revolut') {
        umleiten(url('bestellungen/' . $r['ext_ref'] . '/bezahlen'));
    }
    hinweisSetzen(t('retoure.angelegt', $r['ext_ref']));
    umleiten(url($listenPfad . '/' . $r['ext_ref']));
}

if (preg_match('#^/(bestellungen|sendungen)/(NE-\d{4}-[0-9A-F]{8})/reklamation$#', $pfad, $t)) {
    if ($business) {
        kundenRechtErzwingen('retouren', $methode === 'POST' ? 'bearbeiten' : 'sehen');
    }
    $b = eigeneBestellung($ich, $t[2]);
    if ($b === null) {
        fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
    }
    $fehler = null;
    $werte = ['art' => '', 'beschreibung' => '', 'betrag' => ''];
    if ($methode === 'POST') {
        $werte = ['art' => feld('art', 20), 'beschreibung' => feld('beschreibung', 4000), 'betrag' => feld('betrag', 12)];
        try {
            reklamationAnlegen($ich, $b, $werte['art'], $werte['beschreibung'], centAusEingabe($werte['betrag']) ?? 0);
            hinweisSetzen(t('reklamationen.eingereicht'));
            umleiten(url('reklamationen'));
        } catch (InvalidArgumentException) {
            $fehler = t('reklamationen.fehler');
        }
    }
    ansicht('reklamation_form', ['titel' => t('reklamationen.neu', $b['ext_ref']), 'b' => $b, 'werte' => $werte, 'fehler' => $fehler, 'pfad' => $t[1], 'aktiv' => 'reklamationen']);
}

if ($pfad === '/reklamationen') {
    if ($business) {
        kundenRechtErzwingen('retouren');
    }
    ansicht('reklamationen', ['titel' => t('reklamationen.titel'), 'zeilen' => reklamationenDesKunden($ich), 'pfad' => $listenPfad, 'aktiv' => 'reklamationen']);
}

// ---------------------------------------------------------------- Adressbuch

if ($business && str_starts_with($pfad, '/adressbuch')) {
    kundenRechtErzwingen('versand', $methode === 'POST' ? 'bearbeiten' : 'sehen');
}
if ($business && str_starts_with($pfad, '/vorlagen')) {
    kundenRechtErzwingen('versand', $methode === 'POST' ? 'bearbeiten' : 'sehen');
}

if ($pfad === '/adressbuch/export.csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="neos-adressbuch.csv"');
    echo adressenCsv($ich);
    exit;
}

if ($pfad === '/adressbuch/import' && $methode === 'POST') {
    $datei = $_FILES['datei'] ?? null;
    if ($datei === null || ($datei['error'] ?? 1) !== UPLOAD_ERR_OK) {
        hinweisSetzen(t('adressbuch.import.leer'), 'fehler');
    } elseif ((int) $datei['size'] > 2 * 1024 * 1024) {
        hinweisSetzen(t('import.zu_gross'), 'fehler');
    } else {
        try {
            $tabelle = tabelleLesen((string) $datei['tmp_name'], (string) $datei['name']);
            $blatt = $tabelle['blaetter'][0] ?? ['kopf' => [], 'zeilen' => []];
            $z = adressenImportieren($ich, $blatt['kopf'], $blatt['zeilen'], $business && !empty($_POST['geteilt']));
            hinweisSetzen(t('adressbuch.import.ergebnis', $z['angelegt'], $z['uebersprungen'], count($z['fehler'])) . ($z['fehler'] !== [] ? ' ' . t('adressbuch.import.fehlerzeilen', implode(', ', array_slice($z['fehler'], 0, 20))) : ''), $z['angelegt'] > 0 ? 'ok' : 'fehler');
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage() === 'spalten' ? t('adressbuch.import.spalten') : t('neu.fehler'), 'fehler');
        }
    }
    umleiten(url('adressbuch'));
}

if ($pfad === '/adressbuch' || $pfad === '/adressbuch/neu' || preg_match('#^/adressbuch/(\d+)(?:/(loeschen|teilen))?$#', $pfad, $t)) {
    $adresse = null;
    if (isset($t[1])) {
        $adresse = adresseLaden($ich, (int) $t[1]);
        if ($adresse === null) {
            fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
        }
    }
    if ($methode === 'POST') {
        try {
            if (($t[2] ?? '') === 'loeschen') {
                adresseLoeschen($ich, (int) $adresse['id']);
                hinweisSetzen(t('adressbuch.geloescht'));
                umleiten(url('adressbuch'));
            }
            if (($t[2] ?? '') === 'teilen') {
                adresseTeilen($ich, (int) $adresse['id'], !empty($_POST['geteilt']));
                hinweisSetzen(!empty($_POST['geteilt']) ? t('adressbuch.geteilt.an') : t('adressbuch.geteilt.aus'));
                umleiten(url('adressbuch'));
            }
            if ($pfad !== '/adressbuch') {
                if ($adresse !== null && !adresseDarfBearbeiten($ich, $adresse)) {
                    fehlerSeite(403, t('fehler.403'), t('adressbuch.fremd'));
                }
                $a = [];
                foreach (['name', 'firma', 'strasse', 'plz', 'ort', 'land', 'email', 'telefon'] as $f) {
                    $a[$f] = feld($f, 254);
                }
                if (mb_strlen($a['name']) < 2 || mb_strlen($a['strasse']) < 3 || mb_strlen($a['plz']) < 3 || mb_strlen($a['ort']) < 2) {
                    hinweisSetzen(t('neu.fehler'), 'fehler');
                } else {
                    $art = feld('art', 12) === 'absender' ? 'absender' : 'empfaenger';
                    adresseSpeichern($ich, $art, $a, $adresse !== null ? (int) $adresse['id'] : null, $art === 'absender' && !empty($_POST['standard']), $business ? !empty($_POST['geteilt']) : null);
                    hinweisSetzen(t('adressbuch.gespeichert'));
                    umleiten(url('adressbuch'));
                }
            }
        } catch (InvalidArgumentException $e) {
            fehlerSeite(403, t('fehler.403'), t('adressbuch.fremd'));
        }
    }
    if ($pfad === '/adressbuch') {
        $alle = adressenAlle($ich);
        $eigene = array_values(array_filter($alle, static fn (array $a): bool => (int) $a['kunde_id'] === (int) $ich['id']));
        $geteilte = array_values(array_filter($alle, static fn (array $a): bool => (int) $a['kunde_id'] !== (int) $ich['id']));
        ansicht('adressbuch', ['titel' => t('adressbuch.titel'), 'zeilen' => $eigene, 'geteilte' => $geteilte, 'vorlagen' => vorlagenAlle($ich), 'business' => $business, 'aktiv' => 'adressbuch']);
    }
    ansicht('adresse_form', ['titel' => $adresse !== null ? t('adressbuch.bearbeiten') : t('adressbuch.neu'), 'a' => $adresse, 'laender' => preisliste()['laender'], 'business' => $business, 'darf' => ($adresse === null || adresseDarfBearbeiten($ich, $adresse)) && (!$business || darfKunde('versand', 'bearbeiten')), 'aktiv' => 'adressbuch']);
}

if ($pfad === '/vorlagen/neu' || preg_match('#^/vorlagen/(\d+)(?:/(loeschen))?$#', $pfad, $t)) {
    $vorlage = null;
    if (isset($t[1])) {
        $vorlage = vorlageLaden($ich, (int) $t[1]);
        if ($vorlage === null) {
            fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
        }
    }
    if ($methode === 'POST') {
        if (isset($t[2])) {
            vorlageLoeschen($ich, (int) $vorlage['id']);
            hinweisSetzen(t('vorlagen.geloescht'));
            umleiten(url('adressbuch'));
        }
        $v = ['name' => feld('name', 60), 'gewicht_gramm' => (int) round((float) str_replace(',', '.', feld('gewicht_kg', 10)) * 1000), 'laenge_cm' => (int) feld('laenge', 5), 'breite_cm' => (int) feld('breite', 5), 'hoehe_cm' => (int) feld('hoehe', 5), 'zusatz' => is_array($_POST['zusatz'] ?? null) ? array_map('strval', $_POST['zusatz']) : []];
        if (mb_strlen($v['name']) < 2 || $v['gewicht_gramm'] <= 0) {
            hinweisSetzen(t('neu.fehler'), 'fehler');
        } else {
            vorlageSpeichern($ich, $v, $vorlage !== null ? (int) $vorlage['id'] : null);
            hinweisSetzen(t('vorlagen.gespeichert'));
            umleiten(url('adressbuch'));
        }
    }
    ansicht('vorlage_form', ['titel' => $vorlage !== null ? t('vorlagen.titel') : t('vorlagen.neu'), 'v' => $vorlage, 'zusatz' => zusatzleistungen(), 'aktiv' => 'adressbuch']);
}

// ---------------------------------------------------------------- CSV-Import

if ($pfad === '/import' || $pfad === '/import/vorlage.csv' || $pfad === '/import/vorlage.xlsx' || $pfad === '/import/fehler.csv' || $pfad === '/import/beauftragen' || $pfad === '/import/verwerfen') {
    $firma = businessErzwingen($ich);
    kundenRechtErzwingen('versand', 'bearbeiten');
    $vorlage = importVorlage((string) ($unterkunden[0]['nummer'] ?? ''));
    if ($pfad === '/import/vorlage.csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="neos-import-vorlage.csv"');
        echo "\xEF\xBB\xBF" . implode(';', $vorlage['kopf']) . "\n";
        foreach ($vorlage['zeilen'] as $z) {
            echo implode(';', $z) . "\n";
        }
        exit;
    }
    if ($pfad === '/import/vorlage.xlsx') {
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="neos-import-vorlage.xlsx"');
        echo xlsxSchreiben($vorlage['kopf'], $vorlage['zeilen'], 'Sendungen');
        exit;
    }
    if ($pfad === '/import/fehler.csv') {
        $vorschau = $_SESSION['import'] ?? [];
        $kopf = $_SESSION['import_kopf'] ?? [];
        if ($vorschau === []) {
            fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
        }
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="neos-import-fehler.csv"');
        echo importFehlerCsv($kopf, $vorschau, static fn (string $code): string => t('import.fehler.' . $code));
        exit;
    }
    if ($pfad === '/import/verwerfen' && $methode === 'POST') {
        unset($_SESSION['import'], $_SESSION['import_kopf'], $_SESSION['import_ergebnis']);
        umleiten(url('import'));
    }
    if ($pfad === '/import/beauftragen' && $methode === 'POST') {
        $zeilen = $_SESSION['import'] ?? [];
        unset($_SESSION['import'], $_SESSION['import_kopf']);
        $refs = [];
        $standardUnterkunde = $festerUnterkunde > 0 ? $festerUnterkunde : (int) feld('unterkunde_id', 10);
        $unterkundenNachId = array_column($unterkunden, null, 'id');
        foreach ($zeilen as $z) {
            if ($z['fehler'] !== []) {
                continue;
            }
            $uId = (int) ($z['unterkunde_id'] ?? 0) > 0 ? (int) $z['unterkunde_id'] : $standardUnterkunde;
            $u = $unterkundenNachId[$uId] ?? null;
            $e = bestellungAnlegen($z['p'] + ['email' => $ich['email'], 'absender' => standardAbsender($ich, $firma, $u), 'kunde_id' => $ich['id'], 'firma_id' => $firma['id'], 'unterkunde_id' => $u !== null ? (int) $u['id'] : null,
                'preisliste_id' => preislisteFuerKonto(['unterkunde_id' => $u !== null ? (int) $u['id'] : 0] + $ich), 'zahlungsart' => 'rechnung', 'angelegt_von' => $ich['name'] . ' (Import)', 'sprache' => sprache()]);
            if (isset($e['bestellung'])) {
                $refs[] = ['ext_ref' => $e['bestellung']['ext_ref'], 'referenz' => $z['p']['referenz'], 'name' => $z['p']['empfaenger']['name'], 'zielland' => $z['p']['zielland'], 'betrag_cent' => (int) ($e['bestellung']['betrag_cent'] ?? 0)];
            }
        }
        $_SESSION['import_ergebnis'] = $refs;
        hinweisSetzen(t('import.beauftragt', count($refs)));
        umleiten(url('import'));
    }
    $vorschau = $_SESSION['import'] ?? null;
    $kopf = $_SESSION['import_kopf'] ?? [];
    $ergebnis = $_SESSION['import_ergebnis'] ?? null;
    unset($_SESSION['import_ergebnis']);
    $meldung = null;
    if ($methode === 'POST' && $pfad === '/import') {
        $datei = $_FILES['datei'] ?? null;
        if ($datei === null || ($datei['error'] ?? 1) !== UPLOAD_ERR_OK) {
            $meldung = t('import.leer');
        } elseif ((int) $datei['size'] > 2 * 1024 * 1024) {
            $meldung = t('import.zu_gross');
        } else {
            try {
                $tabelle = tabelleLesen((string) $datei['tmp_name'], (string) $datei['name']);
                $blatt = $tabelle['blaetter'][0] ?? ['kopf' => [], 'zeilen' => []];
                foreach ($tabelle['blaetter'] as $b) { // erstes Blatt mit Daten
                    if ($b['zeilen'] !== []) {
                        $blatt = $b;
                        break;
                    }
                }
                $fehlt = importFehlendeSpalten(importKopfZuordnen($blatt['kopf']));
                if ($fehlt !== []) {
                    $meldung = t('import.spalten_fehlen', implode(', ', $fehlt));
                } elseif (count($blatt['zeilen']) > 500) {
                    $meldung = t('import.zu_gross');
                } else {
                    $vorschau = importZeilenPruefen($ich, $blatt['kopf'], $blatt['zeilen'], $unterkunden, $festerUnterkunde, !empty($_POST['dubletten_ok']));
                    if ($vorschau === []) {
                        $meldung = t('import.keine');
                        $vorschau = null;
                    } else {
                        $_SESSION['import'] = $vorschau;
                        $_SESSION['import_kopf'] = $kopf = $blatt['kopf'];
                    }
                }
            } catch (InvalidArgumentException|RuntimeException $e) {
                $meldung = t('import.unlesbar') . ' ' . $e->getMessage();
            }
        }
    }
    ansicht('import', ['titel' => t('import.titel'), 'vorschau' => $vorschau, 'kopf' => $kopf, 'ergebnis' => $ergebnis, 'meldung' => $meldung, 'unterkunden' => $festerUnterkunde > 0 ? [] : $unterkunden, 'aktiv' => 'import']);
}

// ------------------------------------------------------------------ Guthaben

if ($pfad === '/guthaben' || $pfad === '/guthaben/aufladen' || $pfad === '/guthaben/status') {
    if ($business) {
        kundenRechtErzwingen('buchhaltung', $pfad === '/guthaben' ? 'sehen' : 'bearbeiten');
    }
    if ($pfad === '/guthaben/status') {
        header('Content-Type: application/json; charset=utf-8');
        $a = aufladungLaden('ext_ref', saeubern($_GET['ref'] ?? '', 20));
        [, , $kundeId, $firmaId] = guthabenBereich($ich);
        if ($a === null || (int) $a['kunde_id'] !== (int) $kundeId && (int) $a['firma_id'] !== (int) $firmaId) {
            echo json_encode(['ok' => false]);
            exit;
        }
        if ($a['status'] !== 'bezahlt' && (string) $a['revolut_id'] !== '' && zahlungBereit()) {
            try {
                $antwort = revolutAnfrage('GET', '/api/orders/' . rawurlencode((string) $a['revolut_id']));
                $neu = statusAusRevolut((string) ($antwort['daten']['state'] ?? ''));
                if ($antwort['status'] === 200 && $neu !== null && $neu !== $a['status']) {
                    $a = aufladungFortschreiben($a, $neu);
                }
            } catch (Throwable $e) {
                error_log('[konto] Aufladung-Abgleich: ' . $e->getMessage());
            }
        }
        echo json_encode(['ok' => true, 'status' => $a['status'], 'guthaben' => guthabenStand($ich)]);
        exit;
    }
    if ($pfad === '/guthaben/aufladen' && $methode === 'POST') {
        header('Content-Type: application/json; charset=utf-8');
        $betrag = centAusEingabe(feld('betrag', 12)) ?? 0;
        try {
            $a = aufladungAnlegen($ich, $betrag, sprache());
            echo json_encode(['ok' => true, 'token' => $a['token'], 'modus' => checkoutModus(), 'ref' => $a['aufladung']['ext_ref']]);
        } catch (InvalidArgumentException) {
            echo json_encode(['ok' => false, 'fehler' => 'betrag']);
        } catch (Throwable $e) {
            error_log('[konto] Aufladung: ' . $e->getMessage());
            echo json_encode(['ok' => false, 'fehler' => $e->getMessage() === 'nicht-eingerichtet' ? 'nicht-eingerichtet' : 'zahlungsdienst']);
        }
        exit;
    }
    ansicht('guthaben', ['titel' => t('guthaben.titel'), 'stand' => guthabenStand($ich), 'buchungen' => guthabenBuchungen($ich), 'zahlungBereit' => zahlungBereit(), 'modus' => checkoutModus(), 'rueck' => saeubern($_GET['aufladung'] ?? '', 20), 'aktiv' => 'guthaben']);
}
