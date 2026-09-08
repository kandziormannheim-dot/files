<?php

/**
 * Kundenportal neos24.com — Einstiegspunkt und Wegweiser.
 *
 * Alle Anfragen unter /konto/ laufen durch diese Datei (.htaccess). Jede
 * Datenabfrage läuft über src/sendungen.php und filtert auf das angemeldete
 * Konto bzw. dessen Firma — fremde Datensätze enden als 404.
 */

declare(strict_types=1);

require __DIR__ . '/src/bootstrap.php';

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pfad = isset($_GET['pfad'])
    ? (string) $_GET['pfad']
    : rawurldecode((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH));
$basis = kontoBasis();
if ($basis !== '' && str_starts_with($pfad, $basis)) {
    $pfad = substr($pfad, strlen($basis));
}
$pfad = '/' . trim(preg_replace('#/+#', '/', $pfad) ?? '', '/');
if ($pfad === '/index.php') {
    $pfad = '/';
}

if ($pfad === '/status') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'dienst' => 'konto', 'konfiguriert' => is_file(getenv('NEOS_KONFIG') ?: NEOS_KONFIG_PFAD)]);
    exit;
}

try {
    $db = datenbank();
} catch (Throwable $e) {
    error_log('[konto] Datenbank: ' . $e->getMessage());
    http_response_code(503);
    exit('Service temporarily unavailable.');
}
sitzungStarten();
sprache();
anmeldelinksAufraeumen();

if ($methode === 'POST' && !herkunftErlaubt((string) ($_SERVER['HTTP_ORIGIN'] ?? ''), konfig()['erlaubteHerkunft'])) {
    fehlerSeite(403, t('fehler.403'), t('fehler.403.text'));
}

$linkMinuten = (int) round((int) konfig()['konto']['linkGueltigkeit'] / 60);

// -------------------------------------------------------------- Checkout-Hilfe

/** Angemeldeter Privatkunde für die Vorbelegung des Checkouts (JSON, nur lesend). */
if ($pfad === '/ich') {
    header('Content-Type: application/json; charset=utf-8');
    $k = kundeAktuell();
    if ($k === null || $k['art'] !== 'privat') {
        echo json_encode(['angemeldet' => false]);
        exit;
    }
    $absender = json_decode((string) $k['absender_json'], true) ?: [];
    echo json_encode(['angemeldet' => true, 'name' => $k['name'], 'email' => $k['email'], 'absender' => $absender], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------ Anmeldung

$weiter = (string) ($_GET['weiter'] ?? $_POST['weiter'] ?? '');
if ($weiter === '' || $weiter[0] !== '/' || str_starts_with($weiter, '//')) {
    $weiter = '/';
}

if ($pfad === '/login') {
    if (kundeAktuell() !== null) {
        umleiten(url());
    }
    $fehler = null;
    if ($methode === 'POST') {
        csrfPruefen();
        $email = feld('email', 254);
        $k = kundeNachEmail($email);
        if ($k !== null && $k['passwort_hash'] === null && (int) $k['aktiv'] === 1 && (int) $k['email_bestaetigt'] === 1) {
            $fehler = t('login.kein_passwort');
        } elseif (kundeAnmelden($email, (string) ($_POST['passwort'] ?? ''))) {
            umleiten(url(ltrim($weiter, '/')));
        } else {
            $fehler = t('login.fehler');
        }
    }
    ansicht('login', ['titel' => t('login.titel'), 'fehler' => $fehler, 'weiter' => $weiter, 'email' => feld('email', 254), 'aktiv' => '']);
}

if ($pfad === '/link-senden' && $methode === 'POST') {
    csrfPruefen();
    $email = mb_strtolower(feld('email', 254));
    if (filter_var($email, FILTER_VALIDATE_EMAIL) !== false && begrenzungPruefen('anmeldelink', 5)) {
        $k = kundeNachEmail($email);
        if ($k !== null && (int) $k['aktiv'] === 1) {
            $zweck = (int) $k['email_bestaetigt'] === 1 ? 'anmelden' : ($k['art'] === 'business' ? 'einladung' : 'registrieren');
            $gueltig = (int) konfig()['konto'][$zweck === 'einladung' ? 'einladungGueltigkeit' : 'linkGueltigkeit'];
            $token = anmeldelinkErzeugen((int) $k['id'], $zweck, $gueltig);
            try {
                kontoMailSenden($k, $zweck, anmeldelinkUrl($token, sprache()), ['firma' => $k['firma'] ?? '']);
            } catch (Throwable $e) {
                error_log('[konto] Anmeldelink-Mail: ' . $e->getMessage());
            }
        }
    }
    ansicht('link_gesendet', ['titel' => t('link.titel'), 'email' => $email, 'minuten' => $linkMinuten, 'aktiv' => '']);
}

if ($pfad === '/registrieren') {
    if (kundeAktuell() !== null) {
        umleiten(url());
    }
    $fehler = null;
    $werte = ['name' => '', 'email' => ''];
    if ($methode === 'POST') {
        csrfPruefen();
        $werte = ['name' => feld('name', 100), 'email' => mb_strtolower(feld('email', 254))];
        if (feld('webseite', 100) !== '') {
            ansicht('link_gesendet', ['titel' => t('link.titel'), 'email' => $werte['email'], 'minuten' => $linkMinuten, 'aktiv' => '']);
        }
        if (mb_strlen($werte['name']) < 2 || filter_var($werte['email'], FILTER_VALIDATE_EMAIL) === false) {
            $fehler = t('neu.fehler');
        } elseif (!begrenzungPruefen('anmeldelink', 5)) {
            $fehler = t('login.fehler');
        } else {
            $k = kundeNachEmail($werte['email']);
            if ($k === null) {
                $id = kundeAnlegen(['email' => $werte['email'], 'name' => $werte['name'], 'art' => 'privat', 'sprache' => sprache(), 'email_bestaetigt' => 0]);
                $k = kundeLaden($id);
                $zweck = 'registrieren';
            } else {
                // Vorhandenes Konto: nichts verraten, Anmeldelink statt Registrierung.
                $zweck = (int) $k['email_bestaetigt'] === 1 ? 'anmelden' : ($k['art'] === 'business' ? 'einladung' : 'registrieren');
            }
            if ((int) $k['aktiv'] === 1) {
                $gueltig = (int) konfig()['konto'][$zweck === 'einladung' ? 'einladungGueltigkeit' : 'linkGueltigkeit'];
                $token = anmeldelinkErzeugen((int) $k['id'], $zweck, $gueltig);
                try {
                    kontoMailSenden($k, $zweck, anmeldelinkUrl($token, sprache()), ['firma' => $k['firma'] ?? '']);
                } catch (Throwable $e) {
                    error_log('[konto] Registrierungs-Mail: ' . $e->getMessage());
                }
            }
            ansicht('link_gesendet', ['titel' => t('link.titel'), 'email' => $werte['email'], 'minuten' => $linkMinuten, 'aktiv' => '']);
        }
    }
    ansicht('registrieren', ['titel' => t('registrieren.titel'), 'fehler' => $fehler, 'werte' => $werte, 'aktiv' => '']);
}

if ($pfad === '/passwort-vergessen') {
    $fehler = null;
    if ($methode === 'POST') {
        csrfPruefen();
        $email = mb_strtolower(feld('email', 254));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) !== false && begrenzungPruefen('anmeldelink', 5)) {
            $k = kundeNachEmail($email);
            if ($k !== null && (int) $k['aktiv'] === 1 && (int) $k['email_bestaetigt'] === 1) {
                $token = anmeldelinkErzeugen((int) $k['id'], 'passwort', (int) konfig()['konto']['linkGueltigkeit']);
                try {
                    kontoMailSenden($k, 'passwort', anmeldelinkUrl($token, sprache()));
                } catch (Throwable $e) {
                    error_log('[konto] Passwort-Mail: ' . $e->getMessage());
                }
            }
        }
        ansicht('link_gesendet', ['titel' => t('link.titel'), 'email' => $email, 'minuten' => $linkMinuten, 'aktiv' => '']);
    }
    ansicht('passwort_vergessen', ['titel' => t('vergessen.titel'), 'fehler' => $fehler, 'aktiv' => '']);
}

if ($pfad === '/link') {
    $ergebnis = anmeldelinkEinloesen((string) ($_GET['t'] ?? ''));
    if ($ergebnis === null) {
        ansicht('login', ['titel' => t('login.titel'), 'fehler' => t('login.abgelaufen'), 'weiter' => '/', 'email' => '', 'aktiv' => '']);
    }
    $k = $ergebnis['kunde'];
    $zweck = $ergebnis['zweck'];
    $zugeordnet = 0;
    if ((int) $k['email_bestaetigt'] !== 1) {
        kundeAktualisieren((int) $k['id'], ['email_bestaetigt' => 1]);
        if ($k['art'] === 'privat') {
            $zugeordnet = bestellungenZuordnen((int) $k['id'], (string) $k['email']);
        }
        $k = kundeLaden((int) $k['id']);
    }
    if ($k['art'] === 'business' && (int) ($k['firma_aktiv'] ?? 0) !== 1) {
        ansicht('login', ['titel' => t('login.titel'), 'fehler' => t('login.fehler'), 'weiter' => '/', 'email' => '', 'aktiv' => '']);
    }
    kundeSitzungSetzen($k, true);
    if ($zweck === 'registrieren' || $zweck === 'einladung') {
        hinweisSetzen(t('willkommen.bestaetigt', $zugeordnet));
        umleiten(url('passwort', ['neu' => 1]));
    }
    if ($zweck === 'passwort') {
        umleiten(url('passwort'));
    }
    umleiten(url());
}

if ($pfad === '/logout') {
    if ($methode === 'POST') {
        csrfPruefen();
        kundeAbmelden();
    }
    umleiten(url('login'));
}

// ------------------------------------------------------------- Angemeldet

$ich = anmeldungErzwingen($pfad);
if ($methode === 'POST') {
    csrfPruefen();
}
$firma = $ich['art'] === 'business' ? firmaLaden((int) $ich['firma_id']) : null;

if ($pfad === '/passwort') {
    $fehler = null;
    $frei = !empty($_SESSION['passwort_frei']) || $ich['passwort_hash'] === null;
    if ($methode === 'POST') {
        $neu = (string) ($_POST['neu'] ?? '');
        if (!$frei && !password_verify((string) ($_POST['alt'] ?? ''), (string) $ich['passwort_hash'])) {
            $fehler = t('passwort.alt_falsch');
        } elseif (($fehler = kundePasswortRegel($neu, sprache())) === null) {
            if ($neu !== (string) ($_POST['wiederholung'] ?? '')) {
                $fehler = t('passwort.ungleich');
            } else {
                kundeAktualisieren((int) $ich['id'], ['passwort_hash' => password_hash($neu, PASSWORD_DEFAULT)]);
                $_SESSION['passwort_frei'] = false;
                hinweisSetzen(t('passwort.gespeichert'));
                umleiten(url());
            }
        }
    }
    ansicht('passwort', ['titel' => t('passwort.titel'), 'fehler' => $fehler, 'frei' => $frei, 'neu' => isset($_GET['neu']), 'aktiv' => 'einstellungen']);
}

if ($pfad === '/') {
    if ($ich['art'] === 'business') {
        $firma = businessErzwingen($ich);
        [$letzte] = eigeneBestellungen($ich, 5);
        ansicht('uebersicht', ['titel' => t('nav.uebersicht'), 'k' => firmaKennzahlen((int) $firma['id']), 'letzte' => $letzte, 'firma' => $firma, 'aktiv' => 'uebersicht']);
    }
    [$letzte] = eigeneBestellungen($ich, 5);
    ansicht('uebersicht', ['titel' => t('nav.uebersicht'), 'letzte' => $letzte, 'absender' => json_decode((string) $ich['absender_json'], true) ?: [], 'aktiv' => 'uebersicht']);
}

// ------------------------------------------------- Bestellungen / Sendungen

if ($pfad === '/bestellungen' || $pfad === '/sendungen') {
    if ($pfad === '/sendungen') {
        businessErzwingen($ich);
    } else {
        privatErzwingen($ich);
    }
    $status = saeubern($_GET['status'] ?? '', 20);
    $q = saeubern($_GET['q'] ?? '', 60);
    $seite = seiteLesen();
    [$zeilen, $gesamt] = eigeneBestellungen($ich, 50, ($seite - 1) * 50, $status, $q);
    ansicht('bestellungen', ['titel' => t($pfad === '/sendungen' ? 'nav.sendungen' : 'nav.bestellungen'), 'zeilen' => $zeilen, 'gesamt' => $gesamt, 'seite' => $seite, 'status' => $status, 'q' => $q, 'pfad' => ltrim($pfad, '/'), 'aktiv' => ltrim($pfad, '/')]);
}

if (preg_match('#^/(bestellungen|sendungen)/(NE-\d{4}-[0-9A-F]{8})$#', $pfad, $t)) {
    if ($t[1] === 'sendungen') {
        businessErzwingen($ich);
    } else {
        privatErzwingen($ich);
    }
    $b = eigeneBestellung($ich, $t[2]);
    if ($b === null) {
        fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
    }
    ansicht('bestellung', ['titel' => $b['ext_ref'], 'b' => $b, 'pfad' => $t[1], 'aktiv' => $t[1]]);
}

if ($pfad === '/sendungen/neu') {
    $firma = businessErzwingen($ich);
    $fehler = [];
    $werte = ['zielland' => '', 'gewichtsklasse' => '', 'referenz' => '', 'name' => '', 'strasse' => '', 'plz' => '', 'ort' => '', 'email' => ''];
    if ($methode === 'POST') {
        foreach ($werte as $k => $_) {
            $werte[$k] = saeubern($_POST[$k] ?? '', 254);
        }
        $ergebnis = sendungAnlegen($ich, $firma, $_POST);
        if (isset($ergebnis['bestellung'])) {
            hinweisSetzen(t('neu.angelegt', $ergebnis['bestellung']['ext_ref']));
            umleiten(url('sendungen/' . $ergebnis['bestellung']['ext_ref']));
        }
        $fehler = $ergebnis['fehler'];
    }
    ansicht('sendung_neu', ['titel' => t('neu.titel'), 'firma' => $firma, 'werte' => $werte, 'fehler' => $fehler, 'preise' => preisliste(), 'aktiv' => 'neu']);
}

if ($pfad === '/preise') {
    businessErzwingen($ich);
    ansicht('preise', ['titel' => t('preise.titel'), 'preise' => preisliste(), 'aktiv' => 'preise']);
}

// ------------------------------------------------------------------ Rechnungen

if ($pfad === '/rechnungen') {
    $firma = businessErzwingen($ich);
    ansicht('rechnungen', ['titel' => t('rechnungen.titel'), 'zeilen' => rechnungenDerFirma((int) $firma['id']), 'aktiv' => 'rechnungen']);
}

if (preg_match('#^/rechnungen/([A-Z]{1,5}-\d{4}-\d{4,6})(\.pdf)?$#', $pfad, $t)) {
    $firma = businessErzwingen($ich);
    $r = rechnungNachNummer($t[1]);
    if ($r === null || (int) $r['firma_id'] !== (int) $firma['id']) {
        fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
    }
    if (isset($t[2])) {
        $datei = rechnungPfad($r);
        if (!is_file($datei)) {
            fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $r['nummer'] . '.pdf"');
        header('Content-Length: ' . (string) filesize($datei));
        readfile($datei);
        exit;
    }
    ansicht('rechnung', ['titel' => $r['nummer'], 'r' => $r, 'positionen' => rechnungPositionen((int) $r['id']), 'aktiv' => 'rechnungen']);
}

// --------------------------------------------------------- Benutzer und Firma

if ($pfad === '/benutzer' || $pfad === '/benutzer/einladen' || preg_match('#^/benutzer/(\d+)/(deaktivieren|aktivieren|einladen)$#', $pfad, $t)) {
    $firma = inhaberErzwingen($ich);
    if ($methode === 'POST' && $pfad === '/benutzer/einladen') {
        try {
            $id = firmenBenutzerEinladen($firma, feld('email', 254), feld('name', 100), 'mitarbeiter', sprache());
            hinweisSetzen(t('benutzer.eingeladen', mb_strtolower(feld('email', 254))));
        } catch (InvalidArgumentException $e) {
            hinweisSetzen($e->getMessage(), 'fehler');
        }
        umleiten(url('benutzer'));
    }
    if ($methode === 'POST' && isset($t[1])) {
        $ziel = kundeLaden((int) $t[1]);
        if ($ziel === null || (int) $ziel['firma_id'] !== (int) $firma['id']) {
            fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
        }
        if ($t[2] === 'einladen') {
            firmenBenutzerEinladen($firma, (string) $ziel['email'], (string) $ziel['name'], (string) $ziel['firmenrolle'], (string) $ziel['sprache']);
            hinweisSetzen(t('benutzer.eingeladen', $ziel['email']));
        } elseif ((int) $ziel['id'] === (int) $ich['id']) {
            hinweisSetzen(t('benutzer.selbst'), 'fehler');
        } else {
            kundeAktualisieren((int) $ziel['id'], ['aktiv' => $t[2] === 'aktivieren' ? 1 : 0]);
        }
        umleiten(url('benutzer'));
    }
    ansicht('benutzer', ['titel' => t('benutzer.titel'), 'firma' => $firma, 'zeilen' => firmenBenutzer((int) $firma['id']), 'aktiv' => 'benutzer']);
}

if ($pfad === '/firma') {
    $firma = inhaberErzwingen($ich);
    $fehler = null;
    if ($methode === 'POST') {
        $daten = ['name' => feld('name', 120), 'strasse' => feld('strasse', 120), 'plz' => feld('plz', 12), 'ort' => feld('ort', 80), 'land' => strtoupper(feld('land', 2)), 'ust_id' => feld('ust_id', 30), 'rechnungs_email' => mb_strtolower(feld('rechnungs_email', 254))];
        if (mb_strlen($daten['name']) < 2 || $daten['strasse'] === '' || $daten['plz'] === '' || $daten['ort'] === '' || !preg_match('/^[A-Z]{2}$/', $daten['land'])
            || ($daten['rechnungs_email'] !== '' && filter_var($daten['rechnungs_email'], FILTER_VALIDATE_EMAIL) === false)) {
            $fehler = t('neu.fehler');
            $firma = array_merge($firma, $daten);
        } else {
            firmaAktualisieren((int) $firma['id'], $daten);
            hinweisSetzen(t('firma.gespeichert'));
            umleiten(url('firma'));
        }
    }
    ansicht('firma', ['titel' => t('firma.titel'), 'firma' => $firma, 'fehler' => $fehler, 'aktiv' => 'firma']);
}

// --------------------------------------------------------------- Einstellungen

if ($pfad === '/einstellungen' || $pfad === '/einstellungen/absender' || $pfad === '/einstellungen/schliessen') {
    if ($methode === 'POST') {
        if ($pfad === '/einstellungen/schliessen') {
            kundeAktualisieren((int) $ich['id'], ['aktiv' => 0]);
            kundeAbmelden();
            hinweisSetzen(t('einstellungen.geschlossen'));
            umleiten(url('login'));
        }
        if ($pfad === '/einstellungen/absender') {
            privatErzwingen($ich);
            $absender = ['name' => feld('name', 100), 'strasse' => feld('strasse', 120), 'plz' => feld('plz', 12), 'ort' => feld('ort', 80)];
            kundeAktualisieren((int) $ich['id'], ['absender_json' => json_encode($absender, JSON_UNESCAPED_UNICODE)]);
        } else {
            $name = feld('name', 100);
            $spracheNeu = feld('sprache', 2) === 'en' ? 'en' : 'de';
            if (mb_strlen($name) >= 2) {
                kundeAktualisieren((int) $ich['id'], ['name' => $name, 'sprache' => $spracheNeu]);
                $_SESSION['sprache'] = $spracheNeu;
            }
        }
        hinweisSetzen(t('einstellungen.gespeichert'));
        umleiten(url('einstellungen', ['sprache' => $_SESSION['sprache'] ?? sprache()]));
    }
    ansicht('einstellungen', ['titel' => t('einstellungen.titel'), 'absender' => json_decode((string) $ich['absender_json'], true) ?: [], 'aktiv' => 'einstellungen']);
}

fehlerSeite(404, t('fehler.404'), t('fehler.404.text'));
