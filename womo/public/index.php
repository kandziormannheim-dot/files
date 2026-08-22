<?php

/**
 * Womo-Schadensakte — Einstiegspunkt und Wegweiser.
 *
 * Alle Anfragen laufen durch diese Datei (nginx: try_files auf /index.php).
 * Drei Zugänge:
 *
 *   Vermieter  — Anmeldung mit dem Admin-Passwort, volle Verwaltung.
 *   Mieter     — Link /m/<token> je Vermietung: Vorschäden sehen, Schäden
 *                melden, Protokolle abrufen. Keine Kosten, keine Notizen.
 *   Jedermann  — /qr, der QR-Code im Fahrzeug: Meldung ohne Zuordnung,
 *                mit Honigtopf und Missbrauchsbremse.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/auth.php';
require dirname(__DIR__) . '/src/protokoll_pdf.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

$konfig = konfigLaden();

$pfad = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Selbsttest wie beim Kontaktformular: zeigt, dass PHP läuft und ob eine
// Konfiguration gefunden wurde — ohne einen einzigen Wert zu verraten.
if ($pfad === '/status') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'dienst' => 'womo', 'bereit' => $konfig['bereit']]);
    exit;
}

if (!$konfig['bereit']) {
    http_response_code(503);
    exit('Noch nicht eingerichtet — womo-config.php fehlt oder ist unvollständig. Siehe docs/womo/README.md.');
}

$db = dbOeffnen($konfig);
sitzungStarten();
herkunftErzwingen($konfig);

/** Eine Ansicht im Seitenrahmen ausgeben. */
function ansicht(string $name, array $daten = []): never
{
    global $konfig;
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

/** Fotos eines Uploads an einen Schaden hängen; liefert die Anzahl. */
function fotosSpeichern(PDO $db, array $konfig, int $schadenId, string $feld): int
{
    $anzahl = 0;
    foreach (uploadsEinsammeln($feld) as $datei) {
        $name = fotoUebernehmen($konfig, $datei['tmp'], $datei['groesse']);
        if ($name === null) {
            continue;
        }
        $db->prepare('INSERT INTO fotos (schaden_id, datei) VALUES (?, ?)')
            ->execute([$schadenId, $name]);
        $anzahl++;
    }

    return $anzahl;
}

/** Schaden samt Fotos, Rechnungen und Verlauf laden. */
function schadenLaden(PDO $db, int $id): ?array
{
    $abfrage = $db->prepare('SELECT * FROM schaeden WHERE id = ?');
    $abfrage->execute([$id]);
    $schaden = $abfrage->fetch();
    if ($schaden === false) {
        return null;
    }
    foreach (['fotos', 'rechnungen', 'verlauf'] as $tabelle) {
        $liste = $db->prepare("SELECT * FROM $tabelle WHERE schaden_id = ? ORDER BY id");
        $liste->execute([$id]);
        $schaden[$tabelle] = $liste->fetchAll();
    }

    return $schaden;
}

/** Einen Verlaufseintrag zu einem Vorgang festhalten. */
function verlaufEintragen(PDO $db, int $schadenId, string $text): void
{
    $db->prepare('INSERT INTO verlauf (schaden_id, text) VALUES (?, ?)')
        ->execute([$schadenId, $text]);
}

/** Rechnungen eines Uploads an einen Vorgang hängen; liefert die Anzahl. */
function rechnungenSpeichern(PDO $db, array $konfig, int $schadenId, string $feld): int
{
    $anzahl = 0;
    foreach (uploadsEinsammeln($feld) as $datei) {
        $uebernommen = rechnungUebernehmen($konfig, $datei);
        if ($uebernommen === null) {
            continue;
        }
        $db->prepare('INSERT INTO rechnungen (schaden_id, datei, name) VALUES (?, ?, ?)')
            ->execute([$schadenId, $uebernommen[0], $uebernommen[1]]);
        verlaufEintragen($db, $schadenId, 'Rechnung angehängt: ' . $uebernommen[1]);
        $anzahl++;
    }

    return $anzahl;
}

/** Alle Fahrzeuge, ältestes zuerst. */
function fahrzeugeLaden(PDO $db): array
{
    return $db->query('SELECT * FROM fahrzeuge ORDER BY id')->fetchAll();
}

/** Benachrichtigung an den Vermieter über eine neue Meldung. */
function schadenMailAnVermieter(array $konfig, string $von, string $zone, string $beschreibung): void
{
    try {
        mailSenden(
            $konfig,
            [(string) $konfig['empfaenger']],
            t('de', 'mail.schaden.betreff', $konfig['fahrzeugName']),
            "Hallo,\n\n" . t(
                'de',
                'mail.schaden.text',
                $konfig['fahrzeugName'],
                $von,
                zonenName($zone),
                $beschreibung
            ) . "\n\n" . $konfig['basisUrl'] . "\n",
        );
    } catch (Throwable $e) {
        // Eine gescheiterte Benachrichtigung darf die Meldung nicht verwerfen.
        error_log('[womo] Benachrichtigung fehlgeschlagen: ' . $e->getMessage());
    }
}

// ================================================================= Anmeldung

if ($pfad === '/login') {
    if (adminAngemeldet()) {
        umleiten('/');
    }
    if ($methode === 'POST') {
        csrfPruefen();
        if (anmelden($konfig, (string) ($_POST['passwort'] ?? ''))) {
            umleiten('/');
        }
        ansicht('login', ['fehler' => 'Passwort falsch — oder zu viele Versuche, dann kurz warten.']);
    }
    ansicht('login', ['fehler' => null]);
}

if ($pfad === '/logout' && $methode === 'POST') {
    csrfPruefen();
    session_destroy();
    umleiten('/login');
}

// ============================================================== Mieter-Zugang

if (preg_match('#^/m/([a-f0-9]{32})$#', $pfad, $treffer)) {
    $vermietung = vermietungAusToken($db, $konfig, $treffer[1]);
    $sprache = $vermietung !== null && $vermietung['sprache'] === 'en' ? 'en' : 'de';
    if ($vermietung === null) {
        http_response_code(410);
        ansicht('mieter_abgelaufen', ['sprache' => 'de']);
    }
    $sprache = $vermietung['sprache'] === 'en' ? 'en' : 'de';

    $alle = $db->query('SELECT * FROM schaeden ORDER BY erstellt_am DESC')->fetchAll();
    $eigene = [];
    $vorschaeden = [];
    foreach ($alle as $schaden) {
        if ((int) ($schaden['vermietung_id'] ?? 0) === (int) $vermietung['id']) {
            $eigene[] = schadenLaden($db, (int) $schaden['id']);
        } elseif (schadenFuerMieterSichtbar($schaden, $vermietung)) {
            $vorschaeden[] = $schaden;
        }
    }

    $protokolle = $db->prepare(
        "SELECT * FROM protokolle WHERE vermietung_id = ? AND status = 'abgeschlossen' ORDER BY id"
    );
    $protokolle->execute([(int) $vermietung['id']]);

    ansicht('mieter', [
        'sprache' => $sprache,
        'vermietung' => $vermietung,
        'vorschaeden' => $vorschaeden,
        'eigene' => $eigene,
        'protokolle' => $protokolle->fetchAll(),
        'token' => $treffer[1],
        'fehler' => [],
    ]);
}

if (preg_match('#^/m/([a-f0-9]{32})/schaden$#', $pfad, $treffer) && $methode === 'POST') {
    $vermietung = vermietungAusToken($db, $konfig, $treffer[1]);
    if ($vermietung === null) {
        http_response_code(410);
        ansicht('mieter_abgelaufen', ['sprache' => 'de']);
    }
    $sprache = $vermietung['sprache'] === 'en' ? 'en' : 'de';

    $zone = saeubern($_POST['zone'] ?? '');
    $beschreibung = saeubern($_POST['beschreibung'] ?? '');
    $fehler = [];
    if (!array_key_exists($zone, zonen())) {
        $fehler[] = t($sprache, 'fehler.zone');
    }
    if (mb_strlen($beschreibung) < 5 || mb_strlen($beschreibung) > 2000) {
        $fehler[] = t($sprache, 'fehler.beschreibung');
    }
    if (uploadsEinsammeln('fotos') === []) {
        $fehler[] = t($sprache, 'fehler.foto');
    }

    if ($fehler === []) {
        $db->prepare(
            "INSERT INTO schaeden (vermietung_id, fahrzeug_id, zone, beschreibung, status, verursacher, quelle)
             VALUES (?, ?, ?, ?, 'gemeldet', ?, 'mieter')"
        )->execute([
            (int) $vermietung['id'],
            $vermietung['fahrzeug_id'] !== null ? (int) $vermietung['fahrzeug_id'] : null,
            $zone,
            $beschreibung,
            (string) $vermietung['name'],
        ]);
        $schadenId = (int) $db->lastInsertId();
        verlaufEintragen($db, $schadenId, 'Über den Mieter-Link gemeldet von ' . (string) $vermietung['name']);
        if (fotosSpeichern($db, $konfig, $schadenId, 'fotos') === 0) {
            // Upload war da, aber kein Bild lesbar: Eintrag ohne Foto wäre
            // gegen die Regel „Foto ist Pflicht“ — wieder zurücknehmen.
            $db->prepare('DELETE FROM schaeden WHERE id = ?')->execute([$schadenId]);
            $fehler[] = t($sprache, 'fehler.foto_format', (int) (FOTO_MAX_BYTES / 1048576));
        } else {
            schadenMailAnVermieter($konfig, (string) $vermietung['name'], $zone, $beschreibung);
            hinweisSetzen(t($sprache, 'gemeldet.danke'));
            umleiten('/m/' . $treffer[1]);
        }
    }

    $_SESSION['formularfehler'] = $fehler;
    umleiten('/m/' . $treffer[1]);
}

// ================================================================ QR-Meldung

if ($pfad === '/qr') {
    $sprache = ($_GET['lang'] ?? $_POST['lang'] ?? 'de') === 'en' ? 'en' : 'de';

    if ($methode === 'POST') {
        $falle = saeubern($_POST['firma'] ?? '');
        if ($falle !== '') {
            // Honigtopf gefüllt: still „Erfolg“ melden, nichts speichern.
            hinweisSetzen(t($sprache, 'gemeldet.danke'));
            umleiten('/qr?lang=' . $sprache);
        }
        if (!begrenzungPruefen($konfig, 'qr')) {
            ansicht('qr', ['sprache' => $sprache, 'fehler' => [t($sprache, 'fehler.zu_viele')]]);
        }

        $name = saeubern($_POST['name'] ?? '');
        $kontakt = saeubern($_POST['kontakt'] ?? '');
        $zone = saeubern($_POST['zone'] ?? '');
        $beschreibung = saeubern($_POST['beschreibung'] ?? '');

        $fehler = [];
        if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
            $fehler[] = t($sprache, 'fehler.name');
        }
        if (!array_key_exists($zone, zonen())) {
            $fehler[] = t($sprache, 'fehler.zone');
        }
        if (mb_strlen($beschreibung) < 5 || mb_strlen($beschreibung) > 2000) {
            $fehler[] = t($sprache, 'fehler.beschreibung');
        }
        if (uploadsEinsammeln('fotos') === []) {
            $fehler[] = t($sprache, 'fehler.foto');
        }

        if ($fehler === []) {
            $verursacher = $name . ($kontakt !== '' ? ' (' . mb_substr($kontakt, 0, 100) . ')' : '');
            $db->prepare(
                "INSERT INTO schaeden (fahrzeug_id, zone, beschreibung, status, verursacher, quelle)
                 VALUES ((SELECT MIN(id) FROM fahrzeuge), ?, ?, 'gemeldet', ?, 'qr')"
            )->execute([$zone, $beschreibung, $verursacher]);
            $schadenId = (int) $db->lastInsertId();
            verlaufEintragen($db, $schadenId, 'Über den QR-Code gemeldet von ' . $verursacher);
            if (fotosSpeichern($db, $konfig, $schadenId, 'fotos') === 0) {
                $db->prepare('DELETE FROM schaeden WHERE id = ?')->execute([$schadenId]);
                $fehler[] = t($sprache, 'fehler.foto_format', (int) (FOTO_MAX_BYTES / 1048576));
            } else {
                schadenMailAnVermieter($konfig, $verursacher . ' [QR]', $zone, $beschreibung);
                hinweisSetzen(t($sprache, 'gemeldet.danke'));
                umleiten('/qr?lang=' . $sprache);
            }
        }
        ansicht('qr', ['sprache' => $sprache, 'fehler' => $fehler]);
    }

    ansicht('qr', ['sprache' => $sprache, 'fehler' => []]);
}

// ============================================================ Foto & PDF-Abruf

if (preg_match('#^/foto/(\d+)$#', $pfad, $treffer)) {
    $foto = $db->prepare('SELECT * FROM fotos WHERE id = ?');
    $foto->execute([(int) $treffer[1]]);
    $foto = $foto->fetch();
    if ($foto === false) {
        http_response_code(404);
        exit;
    }

    $erlaubt = adminAngemeldet();
    if (!$erlaubt) {
        $token = (string) ($_GET['t'] ?? '');
        $vermietung = $token !== '' ? vermietungAusToken($db, $konfig, $token) : null;
        if ($vermietung !== null) {
            $schaden = schadenLaden($db, (int) $foto['schaden_id']);
            $erlaubt = $schaden !== null && schadenFuerMieterSichtbar($schaden, $vermietung);
        }
    }
    if (!$erlaubt) {
        http_response_code(403);
        exit;
    }

    $datei = datenPfad($konfig, 'fotos') . '/' . basename((string) $foto['datei']);
    if (!is_file($datei)) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . (string) filesize($datei));
    header('Cache-Control: private, max-age=86400');
    readfile($datei);
    exit;
}

if (preg_match('#^/pdf/(\d+)$#', $pfad, $treffer)) {
    $protokoll = $db->prepare('SELECT * FROM protokolle WHERE id = ?');
    $protokoll->execute([(int) $treffer[1]]);
    $protokoll = $protokoll->fetch();
    if ($protokoll === false || $protokoll['pdf_datei'] === '') {
        http_response_code(404);
        exit;
    }

    $erlaubt = adminAngemeldet();
    if (!$erlaubt) {
        $token = (string) ($_GET['t'] ?? '');
        $vermietung = $token !== '' ? vermietungAusToken($db, $konfig, $token) : null;
        $erlaubt = $vermietung !== null
            && (int) $vermietung['id'] === (int) $protokoll['vermietung_id'];
    }
    if (!$erlaubt) {
        http_response_code(403);
        exit;
    }

    $datei = datenPfad($konfig, 'pdf') . '/' . basename((string) $protokoll['pdf_datei']);
    if (!is_file($datei)) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: application/pdf');
    header('Content-Length: ' . (string) filesize($datei));
    header('Content-Disposition: inline; filename="' . basename($datei) . '"');
    header('Cache-Control: private');
    readfile($datei);
    exit;
}

// ====================================================== Ab hier: nur Vermieter

adminErzwingen();
if ($methode === 'POST') {
    csrfPruefen();
}

// ------------------------------------------------------------------ Startseite

if ($pfad === '/') {
    $filterStatus = in_array($_GET['status'] ?? '', ['offen', 'gemeldet', 'repariert'], true)
        ? (string) $_GET['status'] : '';
    $filterTyp = array_key_exists($_GET['typ'] ?? '', typen()) ? (string) $_GET['typ'] : '';
    $filterBereich = array_key_exists($_GET['bereich'] ?? '', zonenGruppen())
        ? (string) $_GET['bereich'] : '';
    $fahrzeuge = fahrzeugeLaden($db);
    $filterFahrzeug = in_array((int) ($_GET['fahrzeug'] ?? 0), array_map('intval', array_column($fahrzeuge, 'id')), true)
        ? (int) $_GET['fahrzeug'] : 0;

    $sql = 'SELECT s.*, v.name AS mieter_name, fz.name AS fahrzeug_name,
                   (SELECT COUNT(*) FROM fotos f WHERE f.schaden_id = s.id) AS foto_anzahl,
                   (SELECT COUNT(*) FROM rechnungen r WHERE r.schaden_id = s.id) AS rechnung_anzahl
            FROM schaeden s
            LEFT JOIN vermietungen v ON v.id = s.vermietung_id
            LEFT JOIN fahrzeuge fz ON fz.id = s.fahrzeug_id';
    $bedingungen = [];
    $werte = [];
    if ($filterStatus !== '') {
        $bedingungen[] = 's.status = ?';
        $werte[] = $filterStatus;
    }
    if ($filterFahrzeug !== 0) {
        $bedingungen[] = 's.fahrzeug_id = ?';
        $werte[] = $filterFahrzeug;
    }
    if ($filterTyp !== '') {
        $bedingungen[] = 's.typ = ?';
        $werte[] = $filterTyp;
    }
    if ($filterBereich !== '') {
        $bereichZonen = array_keys(array_filter(
            zonen(),
            static fn (array $z): bool => $z['gruppe'] === $filterBereich
        ));
        $bedingungen[] = 's.zone IN (' . implode(',', array_fill(0, count($bereichZonen), '?')) . ')';
        $werte = array_merge($werte, $bereichZonen);
    }
    if ($bedingungen !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $bedingungen);
    }
    $sql .= ' ORDER BY s.erstellt_am DESC';
    $abfrage = $db->prepare($sql);
    $abfrage->execute($werte);
    $schaeden = $abfrage->fetchAll();

    $kostenSumme = 0;
    foreach ($schaeden as $schaden) {
        $kostenSumme += (int) ($schaden['kosten_cent'] ?? 0);
    }

    $unzugeordnet = $db->query(
        "SELECT * FROM schaeden WHERE vermietung_id IS NULL AND quelle = 'qr' AND status = 'gemeldet'
         ORDER BY erstellt_am DESC"
    )->fetchAll();

    // Löschfrist: Vermietungen, deren Ende länger als die Aufbewahrung zurückliegt.
    $stichtag = date('Y-m-d', strtotime('-' . (int) $konfig['aufbewahrungJahre'] . ' years') ?: 0);
    $faellig = $db->prepare(
        'SELECT * FROM vermietungen WHERE anonymisiert = 0 AND bis < ? ORDER BY bis'
    );
    $faellig->execute([$stichtag]);

    // Skizzen-Übersicht: offene und gemeldete Vorgänge je Zone — für das
    // gefilterte Fahrzeug oder, ohne Filter, das erste.
    $skizzeFahrzeug = $filterFahrzeug !== 0 ? $filterFahrzeug : (int) ($fahrzeuge[0]['id'] ?? 0);
    $zaehlung = $db->prepare(
        "SELECT zone, COUNT(*) AS anzahl FROM schaeden
         WHERE fahrzeug_id = ? AND status IN ('offen', 'gemeldet') GROUP BY zone"
    );
    $zaehlung->execute([$skizzeFahrzeug]);
    $zonenZaehler = array_column($zaehlung->fetchAll(), 'anzahl', 'zone');

    ansicht('dashboard', [
        'schaeden' => $schaeden,
        'unzugeordnet' => $unzugeordnet,
        'filterStatus' => $filterStatus,
        'filterTyp' => $filterTyp,
        'filterBereich' => $filterBereich,
        'filterFahrzeug' => $filterFahrzeug,
        'fahrzeuge' => $fahrzeuge,
        'skizzeFahrzeug' => $skizzeFahrzeug,
        'zonenZaehler' => $zonenZaehler,
        'kostenSumme' => $kostenSumme,
        'loeschFaellig' => $faellig->fetchAll(),
    ]);
}

// ------------------------------------------------------------------ Protokolle-Übersicht

if ($pfad === '/protokolle') {
    $liste = $db->query(
        'SELECT p.*, v.name AS mieter_name, v.von, v.bis, v.anonymisiert, fz.name AS fahrzeug_name
         FROM protokolle p
         JOIN vermietungen v ON v.id = p.vermietung_id
         LEFT JOIN fahrzeuge fz ON fz.id = v.fahrzeug_id
         ORDER BY p.id DESC'
    )->fetchAll();
    ansicht('protokolle', ['protokolle' => $liste]);
}

// ------------------------------------------------------------------ Fahrzeuge

if ($pfad === '/fahrzeuge') {
    if ($methode === 'POST') {
        $name = saeubern($_POST['name'] ?? '');
        if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
            ansicht('fahrzeuge', [
                'fahrzeuge' => fahrzeugeLaden($db),
                'fehler' => ['Bitte einen Fahrzeugnamen angeben.'],
            ]);
        }
        $db->prepare('INSERT INTO fahrzeuge (name, kennzeichen) VALUES (?, ?)')
            ->execute([$name, mb_substr(saeubern($_POST['kennzeichen'] ?? ''), 0, 20)]);
        hinweisSetzen('Fahrzeug angelegt — jetzt die Fahrzeugdaten vervollständigen.');
        umleiten('/fahrzeug/' . (int) $db->lastInsertId());
    }
    ansicht('fahrzeuge', ['fahrzeuge' => fahrzeugeLaden($db), 'fehler' => []]);
}

if (preg_match('#^/fahrzeug/(\d+)$#', $pfad, $treffer)) {
    $abfrage = $db->prepare('SELECT * FROM fahrzeuge WHERE id = ?');
    $abfrage->execute([(int) $treffer[1]]);
    $fahrzeug = $abfrage->fetch();
    if ($fahrzeug === false) {
        http_response_code(404);
        exit('Fahrzeug nicht gefunden.');
    }

    if ($methode === 'POST') {
        $name = saeubern($_POST['name'] ?? '');
        if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
            $name = (string) $fahrzeug['name'];
        }
        $datum = static fn (string $d): string => preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) ? $d : '';
        $db->prepare(
            'UPDATE fahrzeuge SET name = ?, kennzeichen = ?, hersteller = ?, modell = ?, fin = ?,
                 erstzulassung = ?, km_stand = ?, tuev_bis = ?, versicherung = ?, notizen = ?
             WHERE id = ?'
        )->execute([
            $name,
            mb_substr(saeubern($_POST['kennzeichen'] ?? ''), 0, 20),
            mb_substr(saeubern($_POST['hersteller'] ?? ''), 0, 100),
            mb_substr(saeubern($_POST['modell'] ?? ''), 0, 100),
            mb_substr(saeubern($_POST['fin'] ?? ''), 0, 30),
            $datum(saeubern($_POST['erstzulassung'] ?? '')),
            mb_substr(saeubern($_POST['km_stand'] ?? ''), 0, 20),
            $datum(saeubern($_POST['tuev_bis'] ?? '')),
            mb_substr(saeubern($_POST['versicherung'] ?? ''), 0, 200),
            mb_substr(saeubern($_POST['notizen'] ?? ''), 0, 2000),
            (int) $fahrzeug['id'],
        ]);
        hinweisSetzen('Fahrzeugdaten gespeichert.');
        umleiten('/fahrzeug/' . (int) $fahrzeug['id']);
    }

    $zaehlung = $db->prepare(
        "SELECT zone, COUNT(*) AS anzahl FROM schaeden
         WHERE fahrzeug_id = ? AND status IN ('offen', 'gemeldet') GROUP BY zone"
    );
    $zaehlung->execute([(int) $fahrzeug['id']]);

    $offene = $db->prepare(
        "SELECT * FROM schaeden WHERE fahrzeug_id = ? AND status IN ('offen', 'gemeldet')
         ORDER BY erstellt_am DESC"
    );
    $offene->execute([(int) $fahrzeug['id']]);

    ansicht('fahrzeug', [
        'fahrzeug' => $fahrzeug,
        'zonenZaehler' => array_column($zaehlung->fetchAll(), 'anzahl', 'zone'),
        'offene' => $offene->fetchAll(),
    ]);
}

// ------------------------------------------------------------------ Rechnungsabruf

if (preg_match('#^/rechnung/(\d+)$#', $pfad, $treffer)) {
    $rechnung = $db->prepare('SELECT * FROM rechnungen WHERE id = ?');
    $rechnung->execute([(int) $treffer[1]]);
    $rechnung = $rechnung->fetch();
    $datei = $rechnung === false
        ? '' : datenPfad($konfig, 'rechnungen') . '/' . basename((string) $rechnung['datei']);
    if ($rechnung === false || !is_file($datei)) {
        http_response_code(404);
        exit;
    }
    $endung = strtolower(pathinfo($datei, PATHINFO_EXTENSION));
    header('Content-Type: ' . ([
        'pdf' => 'application/pdf',
        'jpg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
    ][$endung] ?? 'application/octet-stream'));
    header('Content-Length: ' . (string) filesize($datei));
    header('Content-Disposition: inline; filename="' . basename((string) $rechnung['datei']) . '"');
    header('Cache-Control: private');
    readfile($datei);
    exit;
}

// ------------------------------------------------------------ Schaden anlegen

if ($pfad === '/schaden/neu') {
    $vermietungen = $db->query(
        "SELECT id, name, von, bis FROM vermietungen WHERE anonymisiert = 0 ORDER BY von DESC"
    )->fetchAll();
    $fahrzeuge = fahrzeugeLaden($db);

    if ($methode === 'POST') {
        $typ = array_key_exists($_POST['typ'] ?? '', typen()) ? (string) $_POST['typ'] : 'schaden';
        $zone = saeubern($_POST['zone'] ?? '');
        $beschreibung = saeubern($_POST['beschreibung'] ?? '');
        $fehler = [];
        if (!array_key_exists($zone, zonen())) {
            $fehler[] = 'Bitte eine Stelle am Fahrzeug wählen.';
        }
        if (mb_strlen($beschreibung) < 5) {
            $fehler[] = 'Bitte den Vorgang beschreiben (mindestens 5 Zeichen).';
        }
        // Foto-Pflicht nur bei Schäden — ein Werkstattauftrag (etwa eine
        // Nachrüstung) hat oft noch nichts zu fotografieren.
        if ($typ === 'schaden' && uploadsEinsammeln('fotos') === []) {
            $fehler[] = 'Mindestens ein Foto ist Pflicht.';
        }
        if ($fehler === []) {
            $vermietungId = (int) ($_POST['vermietung_id'] ?? 0) ?: null;
            $fahrzeugId = (int) ($_POST['fahrzeug_id'] ?? 0);
            if (!in_array($fahrzeugId, array_map('intval', array_column($fahrzeuge, 'id')), true)) {
                $fahrzeugId = (int) ($fahrzeuge[0]['id'] ?? 0);
            }
            $status = in_array($_POST['status'] ?? '', ['offen', 'gemeldet', 'repariert'], true)
                ? (string) $_POST['status'] : 'offen';
            $db->prepare(
                'INSERT INTO schaeden
                     (vermietung_id, fahrzeug_id, typ, zone, beschreibung, status, kosten_cent,
                      werkstatt, werkstatt_kommentar, verursacher, notiz, quelle)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'admin\')'
            )->execute([
                $vermietungId,
                $fahrzeugId,
                $typ,
                $zone,
                $beschreibung,
                $status,
                centAusEingabe(saeubern($_POST['kosten'] ?? '')),
                saeubern($_POST['werkstatt'] ?? ''),
                saeubern($_POST['werkstatt_kommentar'] ?? ''),
                saeubern($_POST['verursacher'] ?? ''),
                saeubern($_POST['notiz'] ?? ''),
            ]);
            $schadenId = (int) $db->lastInsertId();
            if (fotosSpeichern($db, $konfig, $schadenId, 'fotos') === 0 && $typ === 'schaden') {
                $db->prepare('DELETE FROM schaeden WHERE id = ?')->execute([$schadenId]);
                $fehler[] = 'Kein Foto war lesbar (JPEG/PNG/WebP, höchstens '
                    . (int) (FOTO_MAX_BYTES / 1048576) . ' MB).';
            } else {
                verlaufEintragen($db, $schadenId, 'Angelegt als ' . typName($typ) . ', Status ' . statusName($status));
                rechnungenSpeichern($db, $konfig, $schadenId, 'rechnungen');
                hinweisSetzen('Vorgang angelegt.');
                umleiten('/schaden/' . $schadenId);
            }
        }
        ansicht('schaden_form', [
            'schaden' => null, 'vermietungen' => $vermietungen, 'fahrzeuge' => $fahrzeuge, 'fehler' => $fehler,
        ]);
    }

    ansicht('schaden_form', [
        'schaden' => null, 'vermietungen' => $vermietungen, 'fahrzeuge' => $fahrzeuge, 'fehler' => [],
    ]);
}

// --------------------------------------------------- Schaden ansehen/bearbeiten

if (preg_match('#^/schaden/(\d+)$#', $pfad, $treffer)) {
    $schaden = schadenLaden($db, (int) $treffer[1]);
    if ($schaden === null) {
        http_response_code(404);
        exit('Schaden nicht gefunden.');
    }
    $vermietungen = $db->query(
        "SELECT id, name, von, bis FROM vermietungen WHERE anonymisiert = 0 ORDER BY von DESC"
    )->fetchAll();
    $fahrzeuge = fahrzeugeLaden($db);

    if ($methode === 'POST') {
        $aktion = (string) ($_POST['aktion'] ?? 'speichern');

        if ($aktion === 'loeschen') {
            foreach ($schaden['fotos'] as $foto) {
                @unlink(datenPfad($konfig, 'fotos') . '/' . basename((string) $foto['datei']));
            }
            foreach ($schaden['rechnungen'] as $rechnung) {
                @unlink(datenPfad($konfig, 'rechnungen') . '/' . basename((string) $rechnung['datei']));
            }
            $db->prepare('DELETE FROM schaeden WHERE id = ?')->execute([(int) $schaden['id']]);
            hinweisSetzen('Vorgang gelöscht.');
            umleiten('/');
        }

        if ($aktion === 'rechnung_loeschen') {
            $rechnungId = (int) ($_POST['rechnung_id'] ?? 0);
            foreach ($schaden['rechnungen'] as $rechnung) {
                if ((int) $rechnung['id'] === $rechnungId) {
                    @unlink(datenPfad($konfig, 'rechnungen') . '/' . basename((string) $rechnung['datei']));
                    $db->prepare('DELETE FROM rechnungen WHERE id = ?')->execute([$rechnungId]);
                    verlaufEintragen($db, (int) $schaden['id'], 'Rechnung entfernt: ' . (string) $rechnung['name']);
                }
            }
            umleiten('/schaden/' . $schaden['id']);
        }

        if ($aktion === 'foto_loeschen') {
            $fotoId = (int) ($_POST['foto_id'] ?? 0);
            foreach ($schaden['fotos'] as $foto) {
                if ((int) $foto['id'] === $fotoId) {
                    @unlink(datenPfad($konfig, 'fotos') . '/' . basename((string) $foto['datei']));
                    $db->prepare('DELETE FROM fotos WHERE id = ?')->execute([$fotoId]);
                }
            }
            umleiten('/schaden/' . $schaden['id']);
        }

        // Speichern: Felder übernehmen, neue Fotos anhängen.
        $typ = array_key_exists($_POST['typ'] ?? '', typen())
            ? (string) $_POST['typ'] : (string) $schaden['typ'];
        $zone = saeubern($_POST['zone'] ?? '');
        $beschreibung = saeubern($_POST['beschreibung'] ?? '');
        $fehler = [];
        if (!array_key_exists($zone, zonen())) {
            $fehler[] = 'Bitte eine Stelle am Fahrzeug wählen.';
        }
        if (mb_strlen($beschreibung) < 5) {
            $fehler[] = 'Bitte den Vorgang beschreiben (mindestens 5 Zeichen).';
        }
        if ($fehler === []) {
            $status = in_array($_POST['status'] ?? '', ['offen', 'gemeldet', 'repariert'], true)
                ? (string) $_POST['status'] : (string) $schaden['status'];
            $fahrzeugId = (int) ($_POST['fahrzeug_id'] ?? 0);
            if (!in_array($fahrzeugId, array_map('intval', array_column($fahrzeuge, 'id')), true)) {
                $fahrzeugId = (int) ($schaden['fahrzeug_id'] ?? 0) ?: (int) ($fahrzeuge[0]['id'] ?? 0);
            }
            $kosten = centAusEingabe(saeubern($_POST['kosten'] ?? ''));
            $werkstattKommentar = saeubern($_POST['werkstatt_kommentar'] ?? '');
            $db->prepare(
                "UPDATE schaeden SET vermietung_id = ?, fahrzeug_id = ?, typ = ?, zone = ?,
                     beschreibung = ?, status = ?, kosten_cent = ?, werkstatt = ?,
                     werkstatt_kommentar = ?, verursacher = ?, notiz = ?,
                     aktualisiert_am = datetime('now')
                 WHERE id = ?"
            )->execute([
                (int) ($_POST['vermietung_id'] ?? 0) ?: null,
                $fahrzeugId,
                $typ,
                $zone,
                $beschreibung,
                $status,
                $kosten,
                saeubern($_POST['werkstatt'] ?? ''),
                $werkstattKommentar,
                saeubern($_POST['verursacher'] ?? ''),
                saeubern($_POST['notiz'] ?? ''),
                (int) $schaden['id'],
            ]);

            // Verlauf: die sichtbaren Änderungen festhalten.
            $meldungen = [];
            if ($status !== (string) $schaden['status']) {
                $meldungen[] = 'Status: ' . statusName((string) $schaden['status']) . ' → ' . statusName($status);
            }
            $kostenAlt = $schaden['kosten_cent'] === null ? null : (int) $schaden['kosten_cent'];
            if ($kosten !== $kostenAlt) {
                $meldungen[] = 'Kosten: ' . (euro($kostenAlt) ?: '—') . ' → ' . (euro($kosten) ?: '—');
            }
            if ($werkstattKommentar !== (string) $schaden['werkstatt_kommentar']) {
                $meldungen[] = 'Werkstatt-Kommentar: ' . ($werkstattKommentar !== '' ? $werkstattKommentar : '(entfernt)');
            }
            if ($typ !== (string) $schaden['typ']) {
                $meldungen[] = 'Art: ' . typName((string) $schaden['typ']) . ' → ' . typName($typ);
            }
            if ($zone !== (string) $schaden['zone']) {
                $meldungen[] = 'Stelle: ' . zonenName((string) $schaden['zone']) . ' → ' . zonenName($zone);
            }
            foreach ($meldungen as $meldung) {
                verlaufEintragen($db, (int) $schaden['id'], $meldung);
            }

            fotosSpeichern($db, $konfig, (int) $schaden['id'], 'fotos');
            rechnungenSpeichern($db, $konfig, (int) $schaden['id'], 'rechnungen');
            hinweisSetzen('Gespeichert.');
            umleiten('/schaden/' . $schaden['id']);
        }
        ansicht('schaden_form', [
            'schaden' => $schaden, 'vermietungen' => $vermietungen, 'fahrzeuge' => $fahrzeuge,
            'protokolle' => schadenProtokolle($db, $schaden), 'fehler' => $fehler,
        ]);
    }

    ansicht('schaden_form', [
        'schaden' => $schaden, 'vermietungen' => $vermietungen, 'fahrzeuge' => $fahrzeuge,
        'protokolle' => schadenProtokolle($db, $schaden), 'fehler' => [],
    ]);
}

/** Die Protokolle, die zu einem Vorgang gehören: das erfassende und alle der Vermietung. */
function schadenProtokolle(PDO $db, array $schaden): array
{
    $ids = [];
    $werte = [];
    if (!empty($schaden['protokoll_id'])) {
        $ids[] = 'p.id = ?';
        $werte[] = (int) $schaden['protokoll_id'];
    }
    if (!empty($schaden['vermietung_id'])) {
        $ids[] = 'p.vermietung_id = ?';
        $werte[] = (int) $schaden['vermietung_id'];
    }
    if ($ids === []) {
        return [];
    }
    $abfrage = $db->prepare(
        'SELECT DISTINCT p.*, v.name AS mieter_name FROM protokolle p
         JOIN vermietungen v ON v.id = p.vermietung_id
         WHERE ' . implode(' OR ', $ids) . ' ORDER BY p.id'
    );
    $abfrage->execute($werte);

    return $abfrage->fetchAll();
}

// ---------------------------------------------------------------- Vermietungen

if ($pfad === '/vermietungen') {
    $fahrzeuge = fahrzeugeLaden($db);
    if ($methode === 'POST') {
        $name = saeubern($_POST['name'] ?? '');
        $email = saeubern($_POST['email'] ?? '');
        $von = saeubern($_POST['von'] ?? '');
        $bis = saeubern($_POST['bis'] ?? '');
        $fehler = [];
        if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
            $fehler[] = 'Bitte einen Namen angeben.';
        }
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $fehler[] = 'Die E-Mail-Adresse ist nicht lesbar.';
        }
        $datumOk = static fn (string $d): bool => (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
        if (!$datumOk($von) || !$datumOk($bis) || $bis < $von) {
            $fehler[] = 'Bitte einen gültigen Zeitraum wählen (von ≤ bis).';
        }
        if ($fehler === []) {
            $fahrzeugId = (int) ($_POST['fahrzeug_id'] ?? 0);
            if (!in_array($fahrzeugId, array_map('intval', array_column($fahrzeuge, 'id')), true)) {
                $fahrzeugId = (int) ($fahrzeuge[0]['id'] ?? 0);
            }
            $db->prepare(
                'INSERT INTO vermietungen (name, email, telefon, von, bis, sprache, token, fahrzeug_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $name,
                $email,
                saeubern($_POST['telefon'] ?? ''),
                $von,
                $bis,
                ($_POST['sprache'] ?? 'de') === 'en' ? 'en' : 'de',
                bin2hex(random_bytes(16)),
                $fahrzeugId,
            ]);
            hinweisSetzen('Vermietung angelegt — der Mieter-Link steht auf der Detailseite.');
            umleiten('/vermietung/' . (int) $db->lastInsertId());
        }
        $liste = $db->query('SELECT * FROM vermietungen ORDER BY von DESC')->fetchAll();
        ansicht('vermietungen', ['vermietungen' => $liste, 'fahrzeuge' => $fahrzeuge, 'fehler' => $fehler]);
    }

    $liste = $db->query('SELECT * FROM vermietungen ORDER BY von DESC')->fetchAll();
    ansicht('vermietungen', ['vermietungen' => $liste, 'fahrzeuge' => $fahrzeuge, 'fehler' => []]);
}

if (preg_match('#^/vermietung/(\d+)$#', $pfad, $treffer)) {
    $abfrage = $db->prepare('SELECT * FROM vermietungen WHERE id = ?');
    $abfrage->execute([(int) $treffer[1]]);
    $vermietung = $abfrage->fetch();
    if ($vermietung === false) {
        http_response_code(404);
        exit('Vermietung nicht gefunden.');
    }

    $protokolle = $db->prepare('SELECT * FROM protokolle WHERE vermietung_id = ? ORDER BY id');
    $protokolle->execute([(int) $vermietung['id']]);

    $schaeden = $db->prepare('SELECT * FROM schaeden WHERE vermietung_id = ? ORDER BY erstellt_am DESC');
    $schaeden->execute([(int) $vermietung['id']]);

    $unzugeordnet = $db->query(
        "SELECT * FROM schaeden WHERE vermietung_id IS NULL AND quelle = 'qr' AND status = 'gemeldet'
         ORDER BY erstellt_am DESC"
    )->fetchAll();

    ansicht('vermietung', [
        'vermietung' => $vermietung,
        'protokolle' => $protokolle->fetchAll(),
        'schaeden' => $schaeden->fetchAll(),
        'unzugeordnet' => $unzugeordnet,
    ]);
}

if (preg_match('#^/vermietung/(\d+)/protokoll$#', $pfad, $treffer) && $methode === 'POST') {
    $typ = ($_POST['typ'] ?? '') === 'rueckgabe' ? 'rueckgabe' : 'uebergabe';
    $abfrage = $db->prepare('SELECT id FROM vermietungen WHERE id = ? AND anonymisiert = 0');
    $abfrage->execute([(int) $treffer[1]]);
    if ($abfrage->fetch() === false) {
        http_response_code(404);
        exit('Vermietung nicht gefunden.');
    }
    // Einen bereits offenen Entwurf gleichen Typs weiterverwenden statt
    // Doubletten anzuhäufen.
    $offen = $db->prepare(
        "SELECT id FROM protokolle WHERE vermietung_id = ? AND typ = ? AND status = 'entwurf'"
    );
    $offen->execute([(int) $treffer[1], $typ]);
    $vorhanden = $offen->fetch();
    if ($vorhanden !== false) {
        umleiten('/protokoll/' . (int) $vorhanden['id']);
    }
    $db->prepare('INSERT INTO protokolle (vermietung_id, typ) VALUES (?, ?)')
        ->execute([(int) $treffer[1], $typ]);
    umleiten('/protokoll/' . (int) $db->lastInsertId());
}

if (preg_match('#^/vermietung/(\d+)/anonymisieren$#', $pfad, $treffer) && $methode === 'POST') {
    $id = (int) $treffer[1];
    $abfrage = $db->prepare('SELECT * FROM vermietungen WHERE id = ?');
    $abfrage->execute([$id]);
    $vermietung = $abfrage->fetch();
    if ($vermietung === false) {
        http_response_code(404);
        exit('Vermietung nicht gefunden.');
    }

    // Personenbezug entfernen, Sachdaten behalten: Unterschriften und PDFs
    // enthalten Namen und Schriftzug — die Dateien werden gelöscht. Die
    // Schadenszeilen bleiben als anonymisierte Fahrzeughistorie stehen.
    $protokolle = $db->prepare('SELECT * FROM protokolle WHERE vermietung_id = ?');
    $protokolle->execute([$id]);
    foreach ($protokolle->fetchAll() as $protokoll) {
        foreach (['unterschrift_mieter', 'unterschrift_vermieter'] as $feld) {
            if ((string) $protokoll[$feld] !== '') {
                @unlink(datenPfad($konfig, 'unterschriften') . '/' . basename((string) $protokoll[$feld]));
            }
        }
        if ((string) $protokoll['pdf_datei'] !== '') {
            @unlink(datenPfad($konfig, 'pdf') . '/' . basename((string) $protokoll['pdf_datei']));
        }
    }
    $db->prepare(
        "UPDATE protokolle SET unterschrift_mieter = '', unterschrift_vermieter = '', pdf_datei = ''
         WHERE vermietung_id = ?"
    )->execute([$id]);
    $db->prepare(
        "UPDATE schaeden SET verursacher = 'Mieter (anonymisiert)'
         WHERE vermietung_id = ? AND verursacher != ''"
    )->execute([$id]);
    $db->prepare(
        "UPDATE vermietungen
         SET name = '(anonymisiert)', email = '', telefon = '', token = NULL, anonymisiert = 1
         WHERE id = ?"
    )->execute([$id]);

    hinweisSetzen('Mieterdaten entfernt — die Schäden bleiben anonymisiert in der Akte.');
    umleiten('/vermietungen');
}

// ------------------------------------------------------------------ Protokolle

/** Protokoll samt Vermietung laden oder 404. */
function protokollLaden(PDO $db, int $id): array
{
    $abfrage = $db->prepare(
        'SELECT p.*, v.name AS mieter_name, v.email AS mieter_email, v.von, v.bis,
                v.sprache, v.token, v.id AS v_id, v.anonymisiert, v.fahrzeug_id,
                fz.name AS fahrzeug_name, fz.kennzeichen AS fahrzeug_kennzeichen
         FROM protokolle p JOIN vermietungen v ON v.id = p.vermietung_id
         LEFT JOIN fahrzeuge fz ON fz.id = v.fahrzeug_id
         WHERE p.id = ?'
    );
    $abfrage->execute([$id]);
    $protokoll = $abfrage->fetch();
    if ($protokoll === false) {
        http_response_code(404);
        exit('Protokoll nicht gefunden.');
    }

    return $protokoll;
}

/** Die Schäden, die in diesem Protokoll erfasst wurden — mit Fotos. */
function protokollSchaeden(PDO $db, int $protokollId): array
{
    $abfrage = $db->prepare('SELECT id FROM schaeden WHERE protokoll_id = ? ORDER BY id');
    $abfrage->execute([$protokollId]);

    return array_map(
        static fn (array $zeile): array => schadenLaden($db, (int) $zeile['id']),
        $abfrage->fetchAll()
    );
}

/** Offene Vorschäden aus der Zeit vor diesem Protokoll. */
function protokollVorschaeden(PDO $db, array $protokoll): array
{
    $abfrage = $db->prepare(
        "SELECT * FROM schaeden
         WHERE status IN ('offen', 'gemeldet')
           AND typ = 'schaden'
           AND (fahrzeug_id IS NULL OR ? IS NULL OR fahrzeug_id = ?)
           AND (protokoll_id IS NULL OR protokoll_id != ?)
           AND erstellt_am <= ?
         ORDER BY erstellt_am"
    );
    $abfrage->execute([
        $protokoll['fahrzeug_id'],
        $protokoll['fahrzeug_id'],
        (int) $protokoll['id'],
        (string) $protokoll['erstellt_am'],
    ]);

    return $abfrage->fetchAll();
}

if (preg_match('#^/protokoll/(\d+)$#', $pfad, $treffer)) {
    $protokoll = protokollLaden($db, (int) $treffer[1]);
    ansicht('protokoll', [
        'protokoll' => $protokoll,
        'vorschaeden' => protokollVorschaeden($db, $protokoll),
        'neue' => protokollSchaeden($db, (int) $protokoll['id']),
        'fehler' => [],
    ]);
}

if (preg_match('#^/protokoll/(\d+)/schaden$#', $pfad, $treffer) && $methode === 'POST') {
    $protokoll = protokollLaden($db, (int) $treffer[1]);
    if ($protokoll['status'] !== 'entwurf' || (int) $protokoll['anonymisiert'] === 1) {
        umleiten('/protokoll/' . $protokoll['id']);
    }

    $zone = saeubern($_POST['zone'] ?? '');
    $beschreibung = saeubern($_POST['beschreibung'] ?? '');
    $fehler = [];
    if (!array_key_exists($zone, zonen())) {
        $fehler[] = 'Bitte eine Stelle am Fahrzeug wählen.';
    }
    if (mb_strlen($beschreibung) < 5) {
        $fehler[] = 'Bitte den Schaden beschreiben (mindestens 5 Zeichen).';
    }
    if (uploadsEinsammeln('fotos') === []) {
        $fehler[] = 'Mindestens ein Foto ist Pflicht.';
    }
    if ($fehler === []) {
        $db->prepare(
            "INSERT INTO schaeden (vermietung_id, fahrzeug_id, protokoll_id, zone, beschreibung, status, verursacher, quelle)
             VALUES (?, ?, ?, ?, ?, 'offen', ?, 'admin')"
        )->execute([
            (int) $protokoll['v_id'],
            $protokoll['fahrzeug_id'] !== null ? (int) $protokoll['fahrzeug_id'] : null,
            (int) $protokoll['id'],
            $zone,
            $beschreibung,
            $protokoll['typ'] === 'rueckgabe' ? (string) $protokoll['mieter_name'] : '',
        ]);
        $schadenId = (int) $db->lastInsertId();
        verlaufEintragen($db, $schadenId, 'Im ' . t('de', 'protokoll.' . $protokoll['typ']) . ' erfasst');
        if (fotosSpeichern($db, $konfig, $schadenId, 'fotos') === 0) {
            $db->prepare('DELETE FROM schaeden WHERE id = ?')->execute([$schadenId]);
            $fehler[] = 'Kein Foto war lesbar (JPEG/PNG/WebP, höchstens '
                . (int) (FOTO_MAX_BYTES / 1048576) . ' MB).';
        } else {
            umleiten('/protokoll/' . $protokoll['id']);
        }
    }
    ansicht('protokoll', [
        'protokoll' => $protokoll,
        'vorschaeden' => protokollVorschaeden($db, $protokoll),
        'neue' => protokollSchaeden($db, (int) $protokoll['id']),
        'fehler' => $fehler,
    ]);
}

if (preg_match('#^/protokoll/(\d+)/abschliessen$#', $pfad, $treffer) && $methode === 'POST') {
    $protokoll = protokollLaden($db, (int) $treffer[1]);
    if ($protokoll['status'] !== 'entwurf' || (int) $protokoll['anonymisiert'] === 1) {
        umleiten('/protokoll/' . $protokoll['id']);
    }

    $fehler = [];
    $mieterUnterschrift = unterschriftUebernehmen($konfig, (string) ($_POST['unterschrift_mieter'] ?? ''));
    $vermieterUnterschrift = unterschriftUebernehmen($konfig, (string) ($_POST['unterschrift_vermieter'] ?? ''));
    if ($mieterUnterschrift === null || $vermieterUnterschrift === null) {
        // Keine halb gespeicherten Unterschriften zurücklassen.
        foreach ([$mieterUnterschrift, $vermieterUnterschrift] as $datei) {
            if ($datei !== null) {
                @unlink(datenPfad($konfig, 'unterschriften') . '/' . $datei);
            }
        }
        $fehler[] = 'Beide Unterschriften sind Pflicht — bitte in beiden Feldern unterschreiben.';
    }

    if ($fehler === []) {
        // Erst Unterschriften und Angaben sichern — der Entwurf bleibt
        // Entwurf, bis das PDF wirklich da ist. So hinterlässt ein
        // PDF-Fehler kein abgeschlossenes Protokoll ohne Dokument.
        $db->prepare(
            'UPDATE protokolle
             SET km_stand = ?, bemerkung = ?, unterschrift_mieter = ?, unterschrift_vermieter = ?
             WHERE id = ?'
        )->execute([
            mb_substr(saeubern($_POST['km_stand'] ?? ''), 0, 20),
            mb_substr(saeubern($_POST['bemerkung'] ?? ''), 0, 2000),
            $mieterUnterschrift,
            $vermieterUnterschrift,
            (int) $protokoll['id'],
        ]);
        $protokoll = protokollLaden($db, (int) $protokoll['id']);

        // Das PDF trägt den Namen des Fahrzeugs der Vermietung — nicht den
        // aus der Konfiguration, der nur das erste Fahrzeug beschreibt.
        $pdfKonfig = $konfig;
        if ((string) ($protokoll['fahrzeug_name'] ?? '') !== '') {
            $pdfKonfig['fahrzeugName'] = (string) $protokoll['fahrzeug_name'];
            $pdfKonfig['kennzeichen'] = (string) ($protokoll['fahrzeug_kennzeichen'] ?? '');
        }
        try {
            $pdfName = protokollPdfErzeugen(
                $pdfKonfig,
                $protokoll,
                [
                    'name' => $protokoll['mieter_name'],
                    'von' => $protokoll['von'],
                    'bis' => $protokoll['bis'],
                    'sprache' => $protokoll['sprache'],
                ],
                protokollVorschaeden($db, $protokoll),
                protokollSchaeden($db, (int) $protokoll['id'])
            );
        } catch (Throwable $e) {
            error_log('[womo] PDF-Erzeugung fehlgeschlagen: ' . $e->getMessage());
            $fehler[] = 'Das PDF konnte nicht erzeugt werden — das Protokoll bleibt als Entwurf '
                . 'erhalten (Ursache steht im Serverprotokoll).';
        }
    }

    if ($fehler === []) {
        $db->prepare(
            "UPDATE protokolle
             SET status = 'abgeschlossen', abgeschlossen_am = datetime('now'), pdf_datei = ?
             WHERE id = ?"
        )->execute([$pdfName, (int) $protokoll['id']]);

        // Mietstatus fortschreiben: Übergabe startet, Rückgabe beendet.
        $db->prepare('UPDATE vermietungen SET status = ? WHERE id = ?')->execute([
            $protokoll['typ'] === 'uebergabe' ? 'laufend' : 'abgeschlossen',
            (int) $protokoll['v_id'],
        ]);

        // PDF an beide Seiten — in der Sprache der Vermietung an den Mieter,
        // die Vermieter-Ausfertigung geht an die konfigurierte Adresse mit.
        $sprache = $protokoll['sprache'] === 'en' ? 'en' : 'de';
        $titel = t($sprache, 'protokoll.' . $protokoll['typ']);
        $pdfInhalt = (string) file_get_contents(datenPfad($konfig, 'pdf') . '/' . $pdfName);
        $empfaenger = [(string) $konfig['empfaenger']];
        if ((string) $protokoll['mieter_email'] !== '') {
            $empfaenger[] = (string) $protokoll['mieter_email'];
        }
        try {
            mailSenden(
                $konfig,
                $empfaenger,
                t($sprache, 'mail.protokoll.betreff', $titel, datumAnzeigen(date('Y-m-d')), $konfig['fahrzeugName']),
                t($sprache, 'begruessung', (string) $protokoll['mieter_name']) . "\n\n"
                    . t(
                        $sprache,
                        'mail.protokoll.text',
                        $titel,
                        $konfig['fahrzeugName'],
                        datumAnzeigen($protokoll['von']),
                        datumAnzeigen($protokoll['bis'])
                    ) . "\n\n"
                    . t($sprache, 'mail.gruss', (string) $konfig['absenderName']) . "\n",
                [['name' => $pdfName, 'inhalt' => $pdfInhalt]],
                (string) $konfig['empfaenger']
            );
            hinweisSetzen('Protokoll abgeschlossen — PDF erstellt und per Mail verschickt.');
        } catch (Throwable $e) {
            error_log('[womo] Protokollversand fehlgeschlagen: ' . $e->getMessage());
            hinweisSetzen('Protokoll abgeschlossen und PDF erstellt — der Mailversand ist fehlgeschlagen, '
                . 'das PDF liegt aber im System (siehe Serverprotokoll).');
        }
        umleiten('/protokoll/' . $protokoll['id']);
    }

    ansicht('protokoll', [
        'protokoll' => $protokoll,
        'vorschaeden' => protokollVorschaeden($db, $protokoll),
        'neue' => protokollSchaeden($db, (int) $protokoll['id']),
        'fehler' => $fehler,
    ]);
}

http_response_code(404);
exit('Seite nicht gefunden.');
