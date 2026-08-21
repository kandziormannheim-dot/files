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

/** Schaden samt Fotoliste laden. */
function schadenLaden(PDO $db, int $id): ?array
{
    $abfrage = $db->prepare('SELECT * FROM schaeden WHERE id = ?');
    $abfrage->execute([$id]);
    $schaden = $abfrage->fetch();
    if ($schaden === false) {
        return null;
    }
    $fotos = $db->prepare('SELECT * FROM fotos WHERE schaden_id = ? ORDER BY id');
    $fotos->execute([$id]);
    $schaden['fotos'] = $fotos->fetchAll();

    return $schaden;
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
            "INSERT INTO schaeden (vermietung_id, zone, beschreibung, status, verursacher, quelle)
             VALUES (?, ?, ?, 'gemeldet', ?, 'mieter')"
        )->execute([(int) $vermietung['id'], $zone, $beschreibung, (string) $vermietung['name']]);
        $schadenId = (int) $db->lastInsertId();
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
                "INSERT INTO schaeden (zone, beschreibung, status, verursacher, quelle)
                 VALUES (?, ?, 'gemeldet', ?, 'qr')"
            )->execute([$zone, $beschreibung, $verursacher]);
            $schadenId = (int) $db->lastInsertId();
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

    $sql = 'SELECT s.*, v.name AS mieter_name,
                   (SELECT COUNT(*) FROM fotos f WHERE f.schaden_id = s.id) AS foto_anzahl
            FROM schaeden s LEFT JOIN vermietungen v ON v.id = s.vermietung_id';
    $werte = [];
    if ($filterStatus !== '') {
        $sql .= ' WHERE s.status = ?';
        $werte[] = $filterStatus;
    }
    $sql .= ' ORDER BY s.erstellt_am DESC';
    $abfrage = $db->prepare($sql);
    $abfrage->execute($werte);
    $schaeden = $abfrage->fetchAll();

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

    ansicht('dashboard', [
        'schaeden' => $schaeden,
        'unzugeordnet' => $unzugeordnet,
        'filterStatus' => $filterStatus,
        'loeschFaellig' => $faellig->fetchAll(),
    ]);
}

// ------------------------------------------------------------ Schaden anlegen

if ($pfad === '/schaden/neu') {
    $vermietungen = $db->query(
        "SELECT id, name, von, bis FROM vermietungen WHERE anonymisiert = 0 ORDER BY von DESC"
    )->fetchAll();

    if ($methode === 'POST') {
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
            $vermietungId = (int) ($_POST['vermietung_id'] ?? 0) ?: null;
            $status = in_array($_POST['status'] ?? '', ['offen', 'gemeldet', 'repariert'], true)
                ? (string) $_POST['status'] : 'offen';
            $db->prepare(
                'INSERT INTO schaeden
                     (vermietung_id, zone, beschreibung, status, kosten_cent, werkstatt, verursacher, notiz, quelle)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'admin\')'
            )->execute([
                $vermietungId,
                $zone,
                $beschreibung,
                $status,
                centAusEingabe(saeubern($_POST['kosten'] ?? '')),
                saeubern($_POST['werkstatt'] ?? ''),
                saeubern($_POST['verursacher'] ?? ''),
                saeubern($_POST['notiz'] ?? ''),
            ]);
            $schadenId = (int) $db->lastInsertId();
            if (fotosSpeichern($db, $konfig, $schadenId, 'fotos') === 0) {
                $db->prepare('DELETE FROM schaeden WHERE id = ?')->execute([$schadenId]);
                $fehler[] = 'Kein Foto war lesbar (JPEG/PNG/WebP, höchstens '
                    . (int) (FOTO_MAX_BYTES / 1048576) . ' MB).';
            } else {
                hinweisSetzen('Schaden angelegt.');
                umleiten('/schaden/' . $schadenId);
            }
        }
        ansicht('schaden_form', [
            'schaden' => null, 'vermietungen' => $vermietungen, 'fehler' => $fehler,
        ]);
    }

    ansicht('schaden_form', ['schaden' => null, 'vermietungen' => $vermietungen, 'fehler' => []]);
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

    if ($methode === 'POST') {
        $aktion = (string) ($_POST['aktion'] ?? 'speichern');

        if ($aktion === 'loeschen') {
            foreach ($schaden['fotos'] as $foto) {
                @unlink(datenPfad($konfig, 'fotos') . '/' . basename((string) $foto['datei']));
            }
            $db->prepare('DELETE FROM schaeden WHERE id = ?')->execute([(int) $schaden['id']]);
            hinweisSetzen('Schaden gelöscht.');
            umleiten('/');
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
        $zone = saeubern($_POST['zone'] ?? '');
        $beschreibung = saeubern($_POST['beschreibung'] ?? '');
        $fehler = [];
        if (!array_key_exists($zone, zonen())) {
            $fehler[] = 'Bitte eine Stelle am Fahrzeug wählen.';
        }
        if (mb_strlen($beschreibung) < 5) {
            $fehler[] = 'Bitte den Schaden beschreiben (mindestens 5 Zeichen).';
        }
        if ($fehler === []) {
            $status = in_array($_POST['status'] ?? '', ['offen', 'gemeldet', 'repariert'], true)
                ? (string) $_POST['status'] : (string) $schaden['status'];
            $db->prepare(
                "UPDATE schaeden SET vermietung_id = ?, zone = ?, beschreibung = ?, status = ?,
                     kosten_cent = ?, werkstatt = ?, verursacher = ?, notiz = ?,
                     aktualisiert_am = datetime('now')
                 WHERE id = ?"
            )->execute([
                (int) ($_POST['vermietung_id'] ?? 0) ?: null,
                $zone,
                $beschreibung,
                $status,
                centAusEingabe(saeubern($_POST['kosten'] ?? '')),
                saeubern($_POST['werkstatt'] ?? ''),
                saeubern($_POST['verursacher'] ?? ''),
                saeubern($_POST['notiz'] ?? ''),
                (int) $schaden['id'],
            ]);
            fotosSpeichern($db, $konfig, (int) $schaden['id'], 'fotos');
            hinweisSetzen('Gespeichert.');
            umleiten('/schaden/' . $schaden['id']);
        }
        ansicht('schaden_form', [
            'schaden' => $schaden, 'vermietungen' => $vermietungen, 'fehler' => $fehler,
        ]);
    }

    ansicht('schaden_form', ['schaden' => $schaden, 'vermietungen' => $vermietungen, 'fehler' => []]);
}

// ---------------------------------------------------------------- Vermietungen

if ($pfad === '/vermietungen') {
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
            $db->prepare(
                'INSERT INTO vermietungen (name, email, telefon, von, bis, sprache, token)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $name,
                $email,
                saeubern($_POST['telefon'] ?? ''),
                $von,
                $bis,
                ($_POST['sprache'] ?? 'de') === 'en' ? 'en' : 'de',
                bin2hex(random_bytes(16)),
            ]);
            hinweisSetzen('Vermietung angelegt — der Mieter-Link steht auf der Detailseite.');
            umleiten('/vermietung/' . (int) $db->lastInsertId());
        }
        $liste = $db->query('SELECT * FROM vermietungen ORDER BY von DESC')->fetchAll();
        ansicht('vermietungen', ['vermietungen' => $liste, 'fehler' => $fehler]);
    }

    $liste = $db->query('SELECT * FROM vermietungen ORDER BY von DESC')->fetchAll();
    ansicht('vermietungen', ['vermietungen' => $liste, 'fehler' => []]);
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
                v.sprache, v.token, v.id AS v_id, v.anonymisiert
         FROM protokolle p JOIN vermietungen v ON v.id = p.vermietung_id
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
           AND (protokoll_id IS NULL OR protokoll_id != ?)
           AND erstellt_am <= ?
         ORDER BY erstellt_am"
    );
    $abfrage->execute([(int) $protokoll['id'], (string) $protokoll['erstellt_am']]);

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
            "INSERT INTO schaeden (vermietung_id, protokoll_id, zone, beschreibung, status, verursacher, quelle)
             VALUES (?, ?, ?, ?, 'offen', ?, 'admin')"
        )->execute([
            (int) $protokoll['v_id'],
            (int) $protokoll['id'],
            $zone,
            $beschreibung,
            $protokoll['typ'] === 'rueckgabe' ? (string) $protokoll['mieter_name'] : '',
        ]);
        $schadenId = (int) $db->lastInsertId();
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

        try {
            $pdfName = protokollPdfErzeugen(
                $konfig,
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
