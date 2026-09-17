<?php

/**
 * SBF-Kurs — Einstiegspunkt und Wegweiser.
 *
 * Alle Anfragen laufen durch diese Datei (.htaccess bzw. try_files auf
 * /index.php). Drei Zugänge:
 *
 *   Öffentlich — Anmeldung, Registrierung mit Einladungscode, Rechtstexte.
 *   Lernende   — Dashboard, Kurse, Lektionen, Trainer, Prüfung, Übungen.
 *   Admin      — Konten, Einladungen, Inhaltsstatus.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
// Keine Inline-Skripte, keine Inline-Styles: alles Dynamische läuft über
// data-Attribute, die assets/app.js und assets/dsc.js auslesen.
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'");

$konfig = konfigLaden();

$pfad = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Selbsttest wie bei Kontaktformular und Womo: zeigt, dass PHP läuft und ob
// eine Konfiguration gefunden wurde — ohne einen einzigen Wert zu verraten.
if ($pfad === '/status') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'dienst' => 'sbfkurs', 'bereit' => $konfig['bereit']]);
    exit;
}

// Browser fragen ungefragt nach einem Favicon — leise abwinken statt 404-Rauschen.
if ($pfad === '/favicon.ico') {
    http_response_code(204);
    exit;
}

if (!$konfig['bereit']) {
    http_response_code(503);
    exit('Noch nicht eingerichtet — sbfkurs-config.php fehlt oder ist unvollständig. Siehe docs/sbfkurs/README.md.');
}

$db = dbOeffnen($konfig);
sitzungStarten($konfig);
herkunftErzwingen($konfig);
$benutzer = aktuellerBenutzer($db);

/** Eine Ansicht im Seitenrahmen ausgeben. */
function ansicht(string $name, array $daten = []): never
{
    global $konfig, $benutzer;
    extract($daten, EXTR_SKIP);
    $inhaltDatei = dirname(__DIR__) . '/src/views/' . $name . '.php';
    require dirname(__DIR__) . '/src/views/layout.php';
    exit;
}

/** Hinweis für die nächste Seite in der Sitzung ablegen. */
function hinweisSetzen(string $text): void
{
    $_SESSION['hinweis'] = $text;
}

/** Zertifikat aus der URL laden — 404, wenn unbekannt oder für Lernende gesperrt. */
function zertifikatOderAbbruch(array $konfig, ?array $benutzer, string $kennung): array
{
    $z = zertifikatLaden($konfig, $kennung);
    if ($z === null || (empty($z['freigeschaltet']) && !istAdmin($benutzer))) {
        http_response_code(404);
        ansicht('fehler', ['titel' => 'Kurs nicht gefunden', 'text' => 'Diesen Kurs gibt es nicht oder er ist noch nicht freigeschaltet.']);
    }

    return $z;
}

// ================================================================ Öffentlich

if ($pfad === '/login') {
    if ($benutzer !== null) {
        umleiten('/');
    }
    $fehler = null;
    if ($methode === 'POST') {
        csrfPruefen();
        $angemeldet = anmelden($db, $konfig, (string) ($_POST['email'] ?? ''), (string) ($_POST['passwort'] ?? ''));
        if ($angemeldet !== null) {
            $ziel = (string) ($_SESSION['danach'] ?? '/');
            unset($_SESSION['danach']);
            umleiten(str_starts_with($ziel, '/') && !str_starts_with($ziel, '//') ? $ziel : '/');
        }
        $fehler = 'E-Mail oder Passwort falsch — oder zu viele Versuche, dann kurz warten.';
    }
    ansicht('login', ['fehler' => $fehler, 'email' => saeubern($_POST['email'] ?? '')]);
}

if ($pfad === '/registrieren') {
    if ($benutzer !== null) {
        umleiten('/');
    }
    $registrierungOffen = $konfig['einladungscode'] !== ''
        || (int) $db->query('SELECT COUNT(*) FROM einladungen WHERE verbraucht_von IS NULL')->fetchColumn() > 0;
    $fehler = null;
    if ($methode === 'POST' && $registrierungOffen) {
        csrfPruefen();
        // Honigtopf: Menschen lassen das versteckte Feld leer.
        if ((string) ($_POST['website'] ?? '') !== '') {
            umleiten('/login');
        }
        $passwort = (string) ($_POST['passwort'] ?? '');
        if ($passwort !== (string) ($_POST['passwort2'] ?? '')) {
            $fehler = 'Die beiden Passwörter stimmen nicht überein.';
        } else {
            $ergebnis = registrieren($db, $konfig, (string) ($_POST['email'] ?? ''), (string) ($_POST['name'] ?? ''), $passwort, (string) ($_POST['code'] ?? ''));
            if (is_int($ergebnis)) {
                session_regenerate_id(true);
                $_SESSION['benutzer_id'] = $ergebnis;
                hinweisSetzen('Willkommen! Dein Konto ist angelegt.');
                umleiten('/');
            }
            $fehler = $ergebnis;
        }
    }
    ansicht('registrieren', [
        'fehler' => $fehler,
        'offen' => $registrierungOffen,
        'werte' => ['email' => saeubern($_POST['email'] ?? ''), 'name' => saeubern($_POST['name'] ?? ''), 'code' => saeubern($_POST['code'] ?? '')],
    ]);
}

if ($pfad === '/logout' && $methode === 'POST') {
    csrfPruefen();
    session_destroy();
    umleiten('/login');
}

if ($pfad === '/impressum' || $pfad === '/datenschutz') {
    $name = substr($pfad, 1);
    $html = rechtstextLaden($konfig, $name);
    ansicht('rechtliches', ['titel' => $name === 'impressum' ? 'Impressum' : 'Datenschutz', 'html' => $html]);
}

if (preg_match('#^/bild/([a-z][a-z0-9-]*)/([A-Za-z0-9._-]+\.(png|jpg|jpeg|gif|svg|webp))$#', $pfad, $t)) {
    // Bilder aus content/<zert>/bilder — nur für Angemeldete, nur bekannte Endungen.
    anmeldungErzwingen($db, $pfad);
    $datei = inhaltePfad($konfig) . "/{$t[1]}/bilder/{$t[2]}";
    if (!is_file($datei)) {
        http_response_code(404);
        exit;
    }
    $typen = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'svg' => 'image/svg+xml', 'webp' => 'image/webp'];
    header('Content-Type: ' . $typen[strtolower($t[3])]);
    header('Cache-Control: private, max-age=86400');
    readfile($datei);
    exit;
}

// ============================================================ Angemeldete

$benutzer = anmeldungErzwingen($db, $pfad);
$benutzerId = (int) $benutzer['id'];
if ($methode === 'POST') {
    csrfPruefen();
}

if ($pfad === '/') {
    ansicht('dashboard', ['karten' => dashboardDaten($db, $konfig, $benutzer)]);
}

if ($pfad === '/konto') {
    $fehler = null;
    if ($methode === 'POST') {
        $aktion = (string) ($_POST['aktion'] ?? '');
        if ($aktion === 'name') {
            $db->prepare('UPDATE benutzer SET name = ? WHERE id = ?')
                ->execute([mb_substr(saeubern($_POST['name'] ?? ''), 0, 100), $benutzerId]);
            hinweisSetzen('Name gespeichert.');
            umleiten('/konto');
        }
        if ($aktion === 'passwort') {
            $erzwungen = (int) $benutzer['passwort_wechsel_noetig'] === 1;
            $neu = (string) ($_POST['neu'] ?? '');
            if (!$erzwungen && !password_verify((string) ($_POST['alt'] ?? ''), (string) $benutzer['passwort_hash'])) {
                $fehler = 'Das bisherige Passwort stimmt nicht.';
            } elseif ($neu !== (string) ($_POST['neu2'] ?? '')) {
                $fehler = 'Die beiden neuen Passwörter stimmen nicht überein.';
            } else {
                $fehler = passwortSetzen($db, $benutzerId, $neu, false);
                if ($fehler === null) {
                    hinweisSetzen('Passwort geändert.');
                    umleiten('/');
                }
            }
        }
    }
    ansicht('passwort_wechseln', ['fehler' => $fehler]);
}

// -------------------------------------------------------------------- Kurs

if (preg_match('#^/kurs/([a-z][a-z0-9-]*)$#', $pfad, $t)) {
    $z = zertifikatOderAbbruch($konfig, $benutzer, $t[1]);
    fortschrittBeruehren($db, $benutzerId, $t[1]);
    ansicht('kurs', [
        'z' => $z,
        'kennung' => $t[1],
        'lektionen' => lektionenLaden($konfig, $t[1]),
        'stand' => lernstandBerechnen($db, $konfig, $benutzerId, $t[1], $z),
    ]);
}

if (preg_match('#^/lektion/([a-z][a-z0-9-]*)/([a-z0-9][a-z0-9-]*)(/gelesen)?$#', $pfad, $t)) {
    $z = zertifikatOderAbbruch($konfig, $benutzer, $t[1]);
    $lektion = lektionLaden($konfig, $t[1], $t[2]);
    if ($lektion === null) {
        http_response_code(404);
        ansicht('fehler', ['titel' => 'Lektion nicht gefunden', 'text' => 'Diese Lektion gibt es nicht.']);
    }
    if (isset($t[3]) && $methode === 'POST') {
        lektionGelesen($db, $benutzerId, $t[1], $t[2]);
        if ($lektion['nachher'] !== null) {
            umleiten("/lektion/{$t[1]}/{$lektion['nachher']['slug']}");
        }
        hinweisSetzen('Alle Lektionen gelesen — weiter im Lerntrainer.');
        umleiten("/kurs/{$t[1]}");
    }
    fortschrittBeruehren($db, $benutzerId, $t[1], $t[2]);
    $gelesen = gelesetLektionen($db, $benutzerId, $t[1]);
    ansicht('lektion', ['z' => $z, 'kennung' => $t[1], 'lektion' => $lektion, 'gelesen' => in_array($t[2], $gelesen, true)]);
}

// ----------------------------------------------------------------- Trainer

if (preg_match('#^/trainer/([a-z][a-z0-9-]*)(/frage|/statistik)?$#', $pfad, $t)) {
    $kennung = $t[1];
    $z = zertifikatOderAbbruch($konfig, $benutzer, $kennung);
    $katalog = fragenLaden($konfig, $kennung);
    $sicherAb = (int) $z['trainer']['sicherAb'];
    $teil = $t[2] ?? '';

    if ($teil === '/statistik') {
        ansicht('trainer_statistik', ['z' => $z, 'kennung' => $kennung, 'statistik' => trainerStatistik($db, $benutzerId, $kennung, $katalog, $sicherAb), 'katalog' => $katalog]);
    }

    $modul = (string) ($_GET['modul'] ?? $_POST['modul'] ?? '');
    if (!in_array($modul, array_column($katalog['module'], 'id'), true)) {
        $modul = '';
    }
    $modus = (string) ($_GET['modus'] ?? $_POST['modus'] ?? 'neu');
    if (!isset(TRAINER_MODI[$modus])) {
        $modus = 'neu';
    }

    if ($teil === '') {
        ansicht('trainer_start', ['z' => $z, 'kennung' => $kennung, 'katalog' => $katalog, 'statistik' => trainerStatistik($db, $benutzerId, $kennung, $katalog, $sicherAb), 'modul' => $modul, 'modus' => $modus]);
    }

    $aufloesung = null;
    if ($methode === 'POST') {
        $aufloesung = antwortVerbuchen($db, $benutzerId, $kennung, $katalog, (string) ($_POST['frage'] ?? ''), (int) ($_POST['antwort'] ?? -1), $modus);
        if ($aufloesung === null) {
            umleiten("/trainer/$kennung/frage?modul=$modul&modus=$modus");
        }
        $ab = (int) ($aufloesung['frage']['nr'] ?? 0);
        ansicht('trainer_frage', ['z' => $z, 'kennung' => $kennung, 'katalog' => $katalog, 'modul' => $modul, 'modus' => $modus, 'aufloesung' => $aufloesung, 'frage' => null, 'ab' => $ab]);
    }

    $ab = (int) ($_GET['ab'] ?? 0);
    $frage = naechsteFrage($db, $benutzerId, $kennung, $katalog, $modul, $modus, $ab, $sicherAb);
    if ($frage === null) {
        ansicht('trainer_frage', ['z' => $z, 'kennung' => $kennung, 'katalog' => $katalog, 'modul' => $modul, 'modus' => $modus, 'aufloesung' => null, 'frage' => null, 'ab' => $ab]);
    }
    $gemischt = trainerFrageVorbereiten($frage, !empty($z['pruefung']['antwortenMischen']));
    ansicht('trainer_frage', ['z' => $z, 'kennung' => $kennung, 'katalog' => $katalog, 'modul' => $modul, 'modus' => $modus, 'aufloesung' => null, 'frage' => $frage, 'antworten' => $gemischt['antworten'], 'ab' => $ab]);
}

// ---------------------------------------------------------------- Prüfung

if (preg_match('#^/pruefung/([a-z][a-z0-9-]*)(/start)?$#', $pfad, $t)) {
    $kennung = $t[1];
    $z = zertifikatOderAbbruch($konfig, $benutzer, $kennung);
    $katalog = fragenLaden($konfig, $kennung);
    $boegen = boegenLaden($konfig, $kennung, $z);
    if (isset($t[2]) && $methode === 'POST') {
        if ($katalog['fragen'] === []) {
            hinweisSetzen('Für diesen Kurs gibt es noch keine Fragen.');
            umleiten("/pruefung/$kennung");
        }
        $wunsch = (string) ($_POST['bogen'] ?? 'zufall');
        if (!preg_match('/^(zufall|amtlich|amtlich-\d+)$/', $wunsch)) {
            $wunsch = 'zufall';
        }
        $id = pruefungStarten($db, $benutzerId, $kennung, $z, $katalog, $boegen, $wunsch);
        umleiten("/pruefung/$id");
    }
    ansicht('pruefung_start', [
        'z' => $z,
        'kennung' => $kennung,
        'katalog' => $katalog,
        'boegen' => $boegen,
        'verlauf' => pruefungenVerlauf($db, $benutzerId, $kennung),
        'stand' => lernstandBerechnen($db, $konfig, $benutzerId, $kennung, $z),
    ]);
}

if (preg_match('#^/pruefung/(\d+)(/abgeben|/ergebnis)?$#', $pfad, $t)) {
    $pruefung = pruefungLaden($db, $benutzerId, (int) $t[1]);
    if ($pruefung === null) {
        http_response_code(404);
        ansicht('fehler', ['titel' => 'Prüfung nicht gefunden', 'text' => 'Diese Prüfung gibt es nicht.']);
    }
    $kennung = $pruefung['zertifikat'];
    $z = zertifikatLaden($konfig, $kennung) ?? zertifikatNormieren(['id' => $kennung]);
    $katalog = fragenLaden($konfig, $kennung);
    $teil = $t[2] ?? '';

    if ($teil === '/abgeben' && $methode === 'POST') {
        $eingaben = [];
        foreach ((array) ($_POST['antwort'] ?? []) as $position => $wert) {
            $eingaben[(int) $position] = is_scalar($wert) ? (string) $wert : '';
        }
        pruefungAbgeben($db, $pruefung, $eingaben, $katalog);
        umleiten("/pruefung/{$pruefung['id']}/ergebnis");
    }
    if ($teil === '/ergebnis' || $pruefung['abgegeben_am'] !== null) {
        if ($pruefung['abgegeben_am'] === null) {
            umleiten("/pruefung/{$pruefung['id']}");
        }
        ansicht('pruefung_ergebnis', ['z' => $z, 'kennung' => $kennung, 'pruefung' => $pruefung, 'ergebnis' => pruefungErgebnis($pruefung, $katalog), 'katalog' => $katalog]);
    }
    ansicht('pruefung_bogen', ['z' => $z, 'kennung' => $kennung, 'pruefung' => $pruefung, 'katalog' => $katalog, 'ende' => pruefungEnde($pruefung)]);
}

// ---------------------------------------------------------------- Übungen

if ($pfad === '/uebung/buchstabieren') {
    $tafel = buchstabiertafelLaden($konfig);
    $ergebnis = null;
    $aufgabe = $_SESSION['buchstabieren'] ?? null;
    if ($methode === 'POST' && $aufgabe !== null) {
        $ergebnis = buchstabierAuswerten($tafel, $aufgabe, (string) ($_POST['eingabe'] ?? ''));
        uebungErgebnisSpeichern($db, $benutzerId, '', 'buchstabieren', 'runde-' . substr(md5($aufgabe['wort'] . microtime()), 0, 8), $ergebnis['punkte'], $ergebnis['maximal'], ['wort' => $aufgabe['wort']]);
        $ergebnis['aufgabe'] = $aufgabe;
        unset($_SESSION['buchstabieren']);
        $aufgabe = null;
    }
    if ($aufgabe === null) {
        $richtung = (string) ($_GET['richtung'] ?? $_POST['richtung'] ?? '');
        $aufgabe = buchstabierAufgabe($tafel, in_array($richtung, ['buchstabieren', 'lesen'], true) ? $richtung : null);
        $_SESSION['buchstabieren'] = $aufgabe;
    }
    ansicht('uebung_buchstabieren', ['tafel' => $tafel, 'aufgabe' => $aufgabe, 'ergebnis' => $ergebnis, 'stand' => praxisStand($db, $konfig, $benutzerId, '', 'buchstabieren')]);
}

if (preg_match('#^/uebung/dsc(/ergebnis)?$#', $pfad, $t)) {
    $szenarien = dscSzenarienLaden($konfig);
    if (isset($t[1]) && $methode === 'POST') {
        $id = (string) ($_POST['szenario'] ?? '');
        $treffer = array_values(array_filter($szenarien['szenarien'], static fn (array $s): bool => ($s['id'] ?? '') === $id));
        if ($treffer !== []) {
            $punkte = max(0, (int) ($_POST['punkte'] ?? 0));
            $maximal = count($treffer[0]['erwartet'] ?? []);
            $protokoll = json_decode((string) ($_POST['protokoll'] ?? '[]'), true);
            uebungErgebnisSpeichern($db, $benutzerId, '', 'dsc', $id, min($punkte, $maximal), $maximal, ['protokoll' => is_array($protokoll) ? array_slice($protokoll, 0, 50) : []]);
            hinweisSetzen('Szenario „' . $treffer[0]['titel'] . '“: ' . min($punkte, $maximal) . " von $maximal Schritten richtig.");
        }
        umleiten('/uebung/dsc');
    }
    $kennung = (string) ($_GET['kurs'] ?? '');
    ansicht('uebung_dsc', ['szenarien' => $szenarien, 'kennung' => zertifikatKennung($kennung), 'stand' => praxisStand($db, $konfig, $benutzerId, $kennung !== '' ? $kennung : 'src', 'dsc')]);
}

if (preg_match('#^/uebung/([a-z][a-z0-9-]*)/(funkverkehr|englisch)(?:/([a-z0-9][a-z0-9-]*))?$#', $pfad, $t)) {
    $kennung = $t[1];
    $modul = $t[2];
    $z = zertifikatOderAbbruch($konfig, $benutzer, $kennung);
    if (!in_array($modul, $z['praxis'], true)) {
        http_response_code(404);
        ansicht('fehler', ['titel' => 'Modul nicht verfügbar', 'text' => 'Dieses Praxismodul gehört nicht zu diesem Kurs.']);
    }
    $uebungen = uebungenLaden($konfig, $kennung, $modul);
    $stand = praxisStand($db, $konfig, $benutzerId, $kennung, $modul);
    if (!isset($t[3])) {
        ansicht('uebung_liste', ['z' => $z, 'kennung' => $kennung, 'modul' => $modul, 'uebungen' => $uebungen, 'stand' => $stand]);
    }
    $uebung = $uebungen[$t[3]] ?? null;
    if ($uebung === null) {
        http_response_code(404);
        ansicht('fehler', ['titel' => 'Übung nicht gefunden', 'text' => 'Diese Übung gibt es nicht.']);
    }
    $ergebnis = null;
    $daten = ['z' => $z, 'kennung' => $kennung, 'modul' => $modul, 'uebung' => $uebung, 'uebungen' => $uebungen];

    if ($modul === 'englisch') {
        $eingabe = saeubern($_POST['eingabe'] ?? '');
        $schritt = (string) ($_POST['schritt'] ?? '');
        if ($methode === 'POST' && $schritt === 'bewerten') {
            $einschaetzung = (string) ($_POST['einschaetzung'] ?? '');
            $punkte = ['richtig' => 2, 'teilweise' => 1, 'falsch' => 0][$einschaetzung] ?? null;
            if ($punkte !== null) {
                $auswertung = englischAuswerten($uebung, $eingabe);
                uebungErgebnisSpeichern($db, $benutzerId, $kennung, 'englisch', $uebung['id'], $punkte, 2, ['treffer' => $auswertung['anzahl'], 'einschaetzung' => $einschaetzung]);
                hinweisSetzen('Übung „' . $uebung['titel'] . '“ als „' . $einschaetzung . '“ gespeichert.');
                umleiten("/uebung/$kennung/englisch");
            }
        }
        if ($methode === 'POST' && $eingabe !== '') {
            $ergebnis = englischAuswerten($uebung, $eingabe);
        }
        ansicht('uebung_englisch', $daten + ['ergebnis' => $ergebnis, 'eingabe' => $eingabe]);
    }

    if (($uebung['typ'] ?? '') === 'reihenfolge') {
        if ($methode === 'POST') {
            $reihenfolge = array_map('intval', (array) ($_POST['reihenfolge'] ?? []));
            $ergebnis = reihenfolgeAuswerten($uebung, $reihenfolge);
            uebungErgebnisSpeichern($db, $benutzerId, $kennung, 'funkverkehr', $uebung['id'], $ergebnis['punkte'], $ergebnis['maximal']);
            $ergebnis['reihenfolge'] = $reihenfolge;
        }
        // Angezeigte Reihenfolge: gemischt, aber deterministisch je Sitzung
        $indizes = array_keys($uebung['elemente']);
        mt_srand(crc32(session_id() . $uebung['id']));
        shuffle($indizes);
        mt_srand();
        ansicht('uebung_reihenfolge', $daten + ['ergebnis' => $ergebnis, 'indizes' => $indizes]);
    }

    if ($methode === 'POST') {
        $eingaben = [];
        foreach ((array) ($_POST['luecke'] ?? []) as $n => $wert) {
            $eingaben[(string) (int) $n] = saeubern($wert);
        }
        $ergebnis = lueckentextAuswerten($uebung, $eingaben);
        uebungErgebnisSpeichern($db, $benutzerId, $kennung, 'funkverkehr', $uebung['id'], $ergebnis['punkte'], $ergebnis['maximal']);
    }
    ansicht('uebung_lueckentext', $daten + ['ergebnis' => $ergebnis]);
}

// ------------------------------------------------------------------ Admin

if (str_starts_with($pfad, '/admin')) {
    adminErzwingen($benutzer);

    if ($pfad === '/admin') {
        $kennzahlen = [
            'benutzer' => (int) $db->query('SELECT COUNT(*) FROM benutzer')->fetchColumn(),
            'aktiv7' => (int) $db->query("SELECT COUNT(*) FROM benutzer WHERE letzte_anmeldung > datetime('now', '-7 days')")->fetchColumn(),
            'pruefungen' => (int) $db->query('SELECT COUNT(*) FROM pruefungen WHERE abgegeben_am IS NOT NULL')->fetchColumn(),
            'bestanden' => (int) $db->query('SELECT COUNT(*) FROM pruefungen WHERE bestanden = 1')->fetchColumn(),
            'antworten' => (int) $db->query('SELECT COUNT(*) FROM trainer_antworten')->fetchColumn(),
            'offeneCodes' => (int) $db->query('SELECT COUNT(*) FROM einladungen WHERE verbraucht_von IS NULL')->fetchColumn(),
        ];
        ansicht('admin_start', ['kennzahlen' => $kennzahlen, 'status' => inhalteStatus($konfig)]);
    }

    if ($pfad === '/admin/benutzer') {
        $fehler = null;
        if ($methode === 'POST') {
            $ergebnis = benutzerAnlegen(
                $db,
                (string) ($_POST['email'] ?? ''),
                (string) ($_POST['name'] ?? ''),
                (string) ($_POST['passwort'] ?? ''),
                (string) ($_POST['rolle'] ?? 'lerner'),
                true
            );
            if (is_int($ergebnis)) {
                hinweisSetzen('Konto angelegt — beim ersten Anmelden muss das Passwort geändert werden.');
                umleiten('/admin/benutzer');
            }
            $fehler = $ergebnis;
        }
        $liste = $db->query('SELECT id, email, name, rolle, aktiv, erstellt_am, letzte_anmeldung, gesperrt_bis FROM benutzer ORDER BY erstellt_am DESC')->fetchAll();
        ansicht('admin_benutzer', ['liste' => $liste, 'fehler' => $fehler]);
    }

    if (preg_match('#^/admin/benutzer/(\d+)$#', $pfad, $t)) {
        $abfrage = $db->prepare('SELECT * FROM benutzer WHERE id = ?');
        $abfrage->execute([(int) $t[1]]);
        $konto = $abfrage->fetch();
        if ($konto === false) {
            http_response_code(404);
            ansicht('fehler', ['titel' => 'Konto nicht gefunden', 'text' => '']);
        }
        $fehler = null;
        if ($methode === 'POST') {
            $aktion = (string) ($_POST['aktion'] ?? '');
            $selbst = (int) $konto['id'] === $benutzerId;
            if ($aktion === 'rolle' && !$selbst) {
                $db->prepare('UPDATE benutzer SET rolle = ? WHERE id = ?')
                    ->execute([($_POST['rolle'] ?? '') === 'admin' ? 'admin' : 'lerner', (int) $konto['id']]);
                hinweisSetzen('Rolle geändert.');
            } elseif ($aktion === 'sperren' && !$selbst) {
                $db->prepare('UPDATE benutzer SET aktiv = 0 WHERE id = ?')->execute([(int) $konto['id']]);
                hinweisSetzen('Konto gesperrt.');
            } elseif ($aktion === 'entsperren') {
                $db->prepare('UPDATE benutzer SET aktiv = 1, fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?')->execute([(int) $konto['id']]);
                hinweisSetzen('Konto entsperrt.');
            } elseif ($aktion === 'passwort') {
                $fehler = passwortSetzen($db, (int) $konto['id'], (string) ($_POST['passwort'] ?? ''), !$selbst);
                if ($fehler === null) {
                    hinweisSetzen($selbst ? 'Passwort geändert.' : 'Übergangspasswort gesetzt — beim nächsten Anmelden muss es geändert werden.');
                }
            } elseif ($aktion === 'loeschen' && !$selbst) {
                $db->prepare('DELETE FROM benutzer WHERE id = ?')->execute([(int) $konto['id']]);
                hinweisSetzen('Konto und Lernstand gelöscht.');
                umleiten('/admin/benutzer');
            }
            if ($fehler === null) {
                umleiten('/admin/benutzer/' . $konto['id']);
            }
        }
        $lernstand = [];
        foreach (zertifikateLaden($konfig) as $kennung => $z) {
            $lernstand[$kennung] = lernstandBerechnen($db, $konfig, (int) $konto['id'], $kennung, $z);
        }
        ansicht('admin_benutzer_detail', ['konto' => $konto, 'lernstand' => $lernstand, 'fehler' => $fehler, 'selbst' => (int) $konto['id'] === $benutzerId]);
    }

    if ($pfad === '/admin/einladungen') {
        if ($methode === 'POST') {
            $aktion = (string) ($_POST['aktion'] ?? 'erzeugen');
            if ($aktion === 'loeschen') {
                $db->prepare('DELETE FROM einladungen WHERE code = ? AND verbraucht_von IS NULL')->execute([(string) ($_POST['code'] ?? '')]);
                hinweisSetzen('Code gelöscht.');
            } else {
                $code = einladungErzeugen($db, (string) ($_POST['bemerkung'] ?? ''));
                hinweisSetzen("Neuer Einladungscode: $code");
            }
            umleiten('/admin/einladungen');
        }
        $liste = $db->query('SELECT e.*, b.email AS verbraucht_email FROM einladungen e LEFT JOIN benutzer b ON b.id = e.verbraucht_von ORDER BY e.erstellt_am DESC')->fetchAll();
        ansicht('admin_einladungen', ['liste' => $liste, 'konfigCode' => $konfig['einladungscode'] !== '']);
    }

    if ($pfad === '/admin/inhalte') {
        ansicht('admin_inhalte', ['status' => inhalteStatus($konfig)]);
    }
}

http_response_code(404);
ansicht('fehler', ['titel' => 'Seite nicht gefunden', 'text' => 'Unter dieser Adresse gibt es nichts.']);
