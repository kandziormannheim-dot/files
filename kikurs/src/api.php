<?php

/**
 * KI-ckoff (KI-Einstieg und KI-Werkstatt) — Server für den Mehrbenutzerbetrieb.
 *
 * Die Kursseite selbst ist statisch (public/index.html + JS). Dieser Teil
 * liefert nur eine kleine JSON-Schnittstelle unter /api.php?aktion=…:
 * Konten mit Einladungscode, Anmeldung, Speichern des Lernstands und eine
 * Übersicht für Admins. Muster und Sicherheitsregeln wie beim SBF-Kurs:
 * Konfiguration oberhalb des Webroots, SQLite, Missbrauchsbremse je IP,
 * Kontosperre nach Fehlversuchen, Herkunftsprüfung und CSRF-Wert.
 *
 * Die Logik steckt in apiBearbeiten(), das ohne HTTP aufrufbar ist — so
 * testen tests/lauf.php alle Wege direkt.
 */

declare(strict_types=1);

const KIKURS_STAND_MAX = 65536; // Byte JSON je Konto

/* ---------------------------------------------------------------- Konfig */

function konfigLaden(): array
{
    $pfad = getenv('KIKURS_KONFIG') ?: dirname(__DIR__, 2) . '/kikurs-config.php';
    if (!is_file($pfad)) {
        $pfad = dirname($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__) . '/public', 2) . '/kikurs-config.php';
    }
    $konfig = is_file($pfad) ? require $pfad : null;

    $standard = [
        'titel' => 'KI-ckoff',
        'adminEmail' => '',
        'adminPasswortHash' => '',
        'einladungscode' => '',
        // Name auf den Teilnahmebestätigungen; leer = Vorgabe der Kursseite.
        'aussteller' => '',
        'daten' => '',
        'salz' => '',
        'erlaubteHerkunft' => [],
        'limit' => ['anfragen' => 10, 'fenster' => 3600],
        'sperreVersuche' => 10,
        'sperreMinuten' => 15,
        'sitzungTage' => 30,
    ];
    $konfig = is_array($konfig) ? array_replace_recursive($standard, $konfig) : $standard;
    $konfig['bereit'] = $konfig['daten'] !== '' && $konfig['adminEmail'] !== '' && $konfig['adminPasswortHash'] !== '';

    return $konfig;
}

function datenPfad(array $konfig, string $unterordner = ''): string
{
    $pfad = rtrim((string) $konfig['daten'], '/') . ($unterordner !== '' ? '/' . $unterordner : '');
    if (!is_dir($pfad) && !@mkdir($pfad, 0770, true) && !is_dir($pfad)) {
        throw new RuntimeException('Datenverzeichnis nicht anlegbar.');
    }

    return $pfad;
}

/* ------------------------------------------------------------- Datenbank */

function dbOeffnen(array $konfig): PDO
{
    $db = new PDO('sqlite:' . datenPfad($konfig) . '/kikurs.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS benutzer (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
            name             TEXT NOT NULL DEFAULT '',
            passwort_hash    TEXT NOT NULL,
            rolle            TEXT NOT NULL DEFAULT 'lerner',   -- lerner|admin
            aktiv            INTEGER NOT NULL DEFAULT 1,
            wechsel_noetig   INTEGER NOT NULL DEFAULT 0,
            fehlversuche     INTEGER NOT NULL DEFAULT 0,
            gesperrt_bis     TEXT,
            erstellt_am      TEXT NOT NULL DEFAULT (datetime('now')),
            letzte_anmeldung TEXT
        )
        SQL);
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS lernstand (
            benutzer_id     INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
            stand_json      TEXT NOT NULL DEFAULT '{}',
            aktualisiert_am TEXT NOT NULL DEFAULT (datetime('now'))
        )
        SQL);
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS einladungen (
            code           TEXT PRIMARY KEY,
            bemerkung      TEXT NOT NULL DEFAULT '',
            verbraucht_von INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
            erstellt_am    TEXT NOT NULL DEFAULT (datetime('now')),
            verbraucht_am  TEXT
        )
        SQL);
    adminKontoSicherstellen($db, $konfig);

    return $db;
}

/** Admin aus der Konfiguration anlegen oder dessen Passwort nachziehen. */
function adminKontoSicherstellen(PDO $db, array $konfig): void
{
    $email = (string) $konfig['adminEmail'];
    $hash = (string) $konfig['adminPasswortHash'];
    if ($email === '' || $hash === '') {
        return;
    }
    $a = $db->prepare('SELECT id, passwort_hash, rolle FROM benutzer WHERE email = ?');
    $a->execute([$email]);
    $v = $a->fetch();
    if ($v === false) {
        $db->prepare("INSERT INTO benutzer (email, name, passwort_hash, rolle) VALUES (?, 'Kursleitung', ?, 'admin')")
            ->execute([$email, $hash]);
    } elseif ($v['passwort_hash'] !== $hash || $v['rolle'] !== 'admin') {
        $db->prepare("UPDATE benutzer SET passwort_hash = ?, rolle = 'admin', aktiv = 1, fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?")
            ->execute([$hash, (int) $v['id']]);
    }
}

/* -------------------------------------------------------------- Hilfen */

function saeubern(mixed $wert, int $max = 200): string
{
    if (!is_string($wert)) {
        return '';
    }
    $wert = preg_replace('/[\x00-\x1F\x7F]/u', '', $wert) ?? '';

    return mb_substr(trim($wert), 0, $max);
}

function passwortRegelnPruefen(string $pw): ?string
{
    if (mb_strlen($pw) < 10) {
        return 'Das Passwort braucht mindestens 10 Zeichen.';
    }
    if (strlen($pw) > 72) {
        return 'Das Passwort darf höchstens 72 Zeichen lang sein.';
    }

    return null;
}

/** Missbrauchsbremse je IP und Zweck; die IP liegt nur gesalzen gestreut vor. */
function begrenzungPruefen(array $konfig, string $zweck, string $ip): bool
{
    if ($ip === '') {
        return true;
    }
    $spool = datenPfad($konfig, 'spool');
    $datei = $spool . '/' . hash('sha256', $zweck . '|' . $ip . '|' . gmdate('Y-m-d') . '|' . $konfig['salz']) . '.json';
    $jetzt = time();
    $fenster = (int) $konfig['limit']['fenster'];
    $zeiten = [];
    if (is_file($datei)) {
        $alt = json_decode((string) @file_get_contents($datei), true);
        if (is_array($alt)) {
            $zeiten = array_values(array_filter($alt, static fn ($z) => is_int($z) && $z > $jetzt - $fenster));
        }
    }
    if (count($zeiten) >= (int) $konfig['limit']['anfragen']) {
        return false;
    }
    $zeiten[] = $jetzt;
    @file_put_contents($datei, json_encode($zeiten), LOCK_EX);

    return true;
}

function einladungErzeugen(PDO $db, string $bemerkung): string
{
    $zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= $zeichen[random_int(0, strlen($zeichen) - 1)];
        }
        $a = $db->prepare('SELECT 1 FROM einladungen WHERE code = ?');
        $a->execute([$code]);
    } while ($a->fetch() !== false);
    $db->prepare('INSERT INTO einladungen (code, bemerkung) VALUES (?, ?)')->execute([$code, saeubern($bemerkung, 100)]);

    return $code;
}

function zufallsPasswort(): string
{
    $zeichen = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $pw = '';
    for ($i = 0; $i < 14; $i++) {
        $pw .= $zeichen[random_int(0, strlen($zeichen) - 1)];
    }

    return $pw;
}

function benutzerOeffentlich(array $b): array
{
    return [
        'id' => (int) $b['id'], 'name' => $b['name'], 'email' => $b['email'],
        'rolle' => $b['rolle'], 'wechselNoetig' => (int) $b['wechsel_noetig'] === 1,
    ];
}

/* ------------------------------------------------------------ Handler */

/**
 * Eine API-Anfrage bearbeiten.
 *
 * @param array $sitzung  Sitzungsdaten per Referenz ($_SESSION im Betrieb)
 * @param array $eingabe  JSON-Körper der Anfrage
 * @param array $umfeld   ['ip' => …, 'csrf' => Kopfwert]
 * @return array{0:int,1:array} HTTP-Status und Antwort
 */
function apiBearbeiten(PDO $db, array $konfig, string $aktion, string $methode, array $eingabe, array &$sitzung, array $umfeld = []): array
{
    $ip = (string) ($umfeld['ip'] ?? '');
    $benutzer = null;
    if (!empty($sitzung['benutzer_id'])) {
        $a = $db->prepare('SELECT * FROM benutzer WHERE id = ? AND aktiv = 1');
        $a->execute([(int) $sitzung['benutzer_id']]);
        $benutzer = $a->fetch() ?: null;
        if ($benutzer === null) {
            unset($sitzung['benutzer_id']);
        }
    }
    if (empty($sitzung['csrf'])) {
        $sitzung['csrf'] = bin2hex(random_bytes(16));
    }
    $schreibend = $methode === 'POST';
    if ($schreibend && !hash_equals((string) $sitzung['csrf'], (string) ($umfeld['csrf'] ?? ''))) {
        return [403, ['fehler' => 'Sitzung abgelaufen. Bitte die Seite neu laden.']];
    }
    $nurGet = ['ich'];
    if (in_array($aktion, $nurGet, true) === $schreibend) {
        return [405, ['fehler' => 'Methode nicht erlaubt.']];
    }

    switch ($aktion) {
        case 'ich':
            $antwort = ['angemeldet' => $benutzer !== null, 'csrf' => $sitzung['csrf'], 'registrierung' => true,
                'aussteller' => (string) $konfig['aussteller']];
            if ($benutzer !== null) {
                $antwort['benutzer'] = benutzerOeffentlich($benutzer);
                $a = $db->prepare('SELECT stand_json, aktualisiert_am FROM lernstand WHERE benutzer_id = ?');
                $a->execute([(int) $benutzer['id']]);
                $zeile = $a->fetch();
                $antwort['stand'] = $zeile ? json_decode($zeile['stand_json'], true) : null;
            }

            return [200, $antwort];

        case 'anmelden':
            if (!begrenzungPruefen($konfig, 'login', $ip)) {
                return [429, ['fehler' => 'Zu viele Versuche. Bitte in einer Stunde noch einmal.']];
            }
            $email = saeubern($eingabe['email'] ?? '');
            $pw = (string) ($eingabe['passwort'] ?? '');
            $a = $db->prepare('SELECT * FROM benutzer WHERE email = ?');
            $a->execute([$email]);
            $b = $a->fetch();
            $gesperrt = $b && $b['gesperrt_bis'] !== null && $b['gesperrt_bis'] > gmdate('Y-m-d H:i:s');
            if (!$b) {
                password_verify($pw, '$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345678');
            }
            if (!$b || (int) $b['aktiv'] !== 1 || $gesperrt || !password_verify($pw, (string) $b['passwort_hash'])) {
                if ($b && !$gesperrt && (int) $b['aktiv'] === 1) {
                    $v = (int) $b['fehlversuche'] + 1;
                    $bis = null;
                    if ($v >= (int) $konfig['sperreVersuche']) {
                        $bis = gmdate('Y-m-d H:i:s', time() + (int) $konfig['sperreMinuten'] * 60);
                        $v = 0;
                    }
                    $db->prepare('UPDATE benutzer SET fehlversuche = ?, gesperrt_bis = ? WHERE id = ?')->execute([$v, $bis, (int) $b['id']]);
                }

                return [401, ['fehler' => 'E-Mail oder Passwort stimmen nicht.']];
            }
            $db->prepare("UPDATE benutzer SET fehlversuche = 0, gesperrt_bis = NULL, letzte_anmeldung = datetime('now') WHERE id = ?")
                ->execute([(int) $b['id']]);
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_regenerate_id(true);
            }
            $sitzung['benutzer_id'] = (int) $b['id'];

            return [200, ['ok' => true, 'benutzer' => benutzerOeffentlich($b)]];

        case 'registrieren':
            if (!begrenzungPruefen($konfig, 'registrierung', $ip)) {
                return [429, ['fehler' => 'Zu viele Versuche. Bitte später noch einmal.']];
            }
            $code = strtoupper(saeubern($eingabe['code'] ?? '', 40));
            $email = saeubern($eingabe['email'] ?? '');
            $name = saeubern($eingabe['name'] ?? '', 100);
            $pw = (string) ($eingabe['passwort'] ?? '');
            $konfigCode = strtoupper((string) $konfig['einladungscode']);
            $konfigTrifft = $code !== '' && $konfigCode !== '' && hash_equals($konfigCode, $code);
            $einmal = null;
            if (!$konfigTrifft && $code !== '') {
                $a = $db->prepare('SELECT code FROM einladungen WHERE code = ? AND verbraucht_von IS NULL');
                $a->execute([$code]);
                $einmal = $a->fetchColumn() ?: null;
            }
            if (!$konfigTrifft && $einmal === null) {
                return [400, ['fehler' => 'Der Einladungscode stimmt nicht.']];
            }
            if ($name === '') {
                return [400, ['fehler' => 'Bitte einen Namen angeben.']];
            }
            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                return [400, ['fehler' => 'Bitte eine gültige E-Mail-Adresse angeben.']];
            }
            if (($f = passwortRegelnPruefen($pw)) !== null) {
                return [400, ['fehler' => $f]];
            }
            $a = $db->prepare('SELECT 1 FROM benutzer WHERE email = ?');
            $a->execute([$email]);
            if ($a->fetch() !== false) {
                return [400, ['fehler' => 'Für diese E-Mail-Adresse gibt es schon ein Konto. Bitte anmelden.']];
            }
            $db->prepare("INSERT INTO benutzer (email, name, passwort_hash, letzte_anmeldung) VALUES (?, ?, ?, datetime('now'))")
                ->execute([$email, $name, password_hash($pw, PASSWORD_DEFAULT)]);
            $id = (int) $db->lastInsertId();
            if ($einmal !== null) {
                $db->prepare("UPDATE einladungen SET verbraucht_von = ?, verbraucht_am = datetime('now') WHERE code = ?")->execute([$id, $einmal]);
            }
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_regenerate_id(true);
            }
            $sitzung['benutzer_id'] = $id;
            $a = $db->prepare('SELECT * FROM benutzer WHERE id = ?');
            $a->execute([$id]);

            return [200, ['ok' => true, 'benutzer' => benutzerOeffentlich($a->fetch())]];

        case 'abmelden':
            unset($sitzung['benutzer_id']);

            return [200, ['ok' => true]];
    }

    // Ab hier nur mit Anmeldung.
    if ($benutzer === null) {
        return [401, ['fehler' => 'Bitte zuerst anmelden.']];
    }
    $id = (int) $benutzer['id'];

    switch ($aktion) {
        case 'stand':
            $stand = $eingabe['stand'] ?? null;
            if (!is_array($stand)) {
                return [400, ['fehler' => 'Lernstand fehlt.']];
            }
            $json = json_encode($stand, JSON_UNESCAPED_UNICODE);
            if ($json === false || strlen($json) > KIKURS_STAND_MAX) {
                return [413, ['fehler' => 'Lernstand ist zu groß.']];
            }
            $db->prepare("INSERT INTO lernstand (benutzer_id, stand_json, aktualisiert_am) VALUES (?, ?, datetime('now'))
                          ON CONFLICT(benutzer_id) DO UPDATE SET stand_json = excluded.stand_json, aktualisiert_am = excluded.aktualisiert_am")
                ->execute([$id, $json]);

            return [200, ['ok' => true]];

        case 'passwort':
            if (!password_verify((string) ($eingabe['alt'] ?? ''), (string) $benutzer['passwort_hash'])) {
                return [400, ['fehler' => 'Das bisherige Passwort stimmt nicht.']];
            }
            $neu = (string) ($eingabe['neu'] ?? '');
            if (($f = passwortRegelnPruefen($neu)) !== null) {
                return [400, ['fehler' => $f]];
            }
            $db->prepare('UPDATE benutzer SET passwort_hash = ?, wechsel_noetig = 0 WHERE id = ?')->execute([password_hash($neu, PASSWORD_DEFAULT), $id]);

            return [200, ['ok' => true]];
    }

    // Ab hier nur für Admins.
    if ($benutzer['rolle'] !== 'admin') {
        return [403, ['fehler' => 'Nur für die Kursleitung.']];
    }

    switch ($aktion) {
        case 'admin_uebersicht':
            $zeilen = $db->query("SELECT b.id, b.name, b.email, b.rolle, b.aktiv, b.erstellt_am, b.letzte_anmeldung,
                                         l.stand_json, l.aktualisiert_am
                                  FROM benutzer b LEFT JOIN lernstand l ON l.benutzer_id = b.id
                                  ORDER BY b.rolle DESC, b.name COLLATE NOCASE")->fetchAll();
            $teilnehmende = array_map(static fn ($z) => [
                'id' => (int) $z['id'], 'name' => $z['name'], 'email' => $z['email'], 'rolle' => $z['rolle'],
                'aktiv' => (int) $z['aktiv'] === 1, 'erstelltAm' => $z['erstellt_am'],
                'letzteAnmeldung' => $z['letzte_anmeldung'], 'aktualisiertAm' => $z['aktualisiert_am'],
                'stand' => $z['stand_json'] ? json_decode($z['stand_json'], true) : null,
            ], $zeilen);
            $einladungen = $db->query('SELECT e.code, e.bemerkung, e.erstellt_am, e.verbraucht_am, b.name AS verbraucht_von
                                       FROM einladungen e LEFT JOIN benutzer b ON b.id = e.verbraucht_von
                                       ORDER BY e.erstellt_am DESC LIMIT 50')->fetchAll();

            return [200, ['teilnehmende' => $teilnehmende, 'einladungen' => $einladungen,
                'einladungscode' => (string) $konfig['einladungscode']]];

        case 'admin_einladung':
            return [200, ['code' => einladungErzeugen($db, (string) ($eingabe['bemerkung'] ?? ''))]];

        case 'admin_konto':
            $ziel = (int) ($eingabe['id'] ?? 0);
            $was = (string) ($eingabe['was'] ?? '');
            if ($ziel === $id) {
                return [400, ['fehler' => 'Das eigene Konto lässt sich hier nicht ändern.']];
            }
            $a = $db->prepare('SELECT * FROM benutzer WHERE id = ?');
            $a->execute([$ziel]);
            if ($a->fetch() === false) {
                return [404, ['fehler' => 'Konto nicht gefunden.']];
            }
            if ($was === 'sperren' || $was === 'entsperren') {
                $db->prepare('UPDATE benutzer SET aktiv = ? WHERE id = ?')->execute([$was === 'entsperren' ? 1 : 0, $ziel]);

                return [200, ['ok' => true]];
            }
            if ($was === 'passwort') {
                $pw = zufallsPasswort();
                $db->prepare('UPDATE benutzer SET passwort_hash = ?, wechsel_noetig = 1, fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?')
                    ->execute([password_hash($pw, PASSWORD_DEFAULT), $ziel]);

                return [200, ['ok' => true, 'passwort' => $pw]];
            }
            if ($was === 'loeschen') {
                $db->prepare('DELETE FROM benutzer WHERE id = ?')->execute([$ziel]);

                return [200, ['ok' => true]];
            }

            return [400, ['fehler' => 'Unbekannte Aktion.']];
    }

    return [404, ['fehler' => 'Unbekannte Aktion.']];
}

/* ------------------------------------------------------------ HTTP-Seite */

/** Herkunftsprüfung für POST wie bei den Schwesteranwendungen. */
function herkunftErlaubt(string $herkunft, array $erlaubte, string $host): bool
{
    if ($herkunft === '') {
        return true;
    }
    if (in_array($herkunft, $erlaubte, true)) {
        return true;
    }
    $t = parse_url($herkunft);
    if (!is_array($t) || !isset($t['host'])) {
        return false;
    }

    return strcasecmp($t['host'] . (isset($t['port']) ? ':' . $t['port'] : ''), $host) === 0;
}

function apiAusliefern(): never
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $senden = static function (int $status, array $daten): never {
        http_response_code($status);
        echo json_encode($daten, JSON_UNESCAPED_UNICODE);
        exit;
    };

    $konfig = konfigLaden();
    $aktion = preg_replace('/[^a-z_]/', '', (string) ($_GET['aktion'] ?? '')) ?? '';
    if ($aktion === 'status') {
        $senden(200, ['ok' => true, 'dienst' => 'kikurs', 'bereit' => $konfig['bereit']]);
    }
    if (!$konfig['bereit']) {
        $senden(503, ['fehler' => 'Noch nicht eingerichtet (kikurs-config.php fehlt).']);
    }
    $methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($methode === 'POST' && !herkunftErlaubt($_SERVER['HTTP_ORIGIN'] ?? '', $konfig['erlaubteHerkunft'], (string) ($_SERVER['HTTP_HOST'] ?? ''))) {
        $senden(403, ['fehler' => 'Herkunft nicht erlaubt.']);
    }

    $tage = max(1, (int) $konfig['sitzungTage']);
    ini_set('session.gc_maxlifetime', (string) ($tage * 86400));
    session_save_path(datenPfad($konfig, 'sitzungen'));
    session_name('kikurs_sitzung');
    session_set_cookie_params([
        'lifetime' => $tage * 86400, 'path' => '/', 'secure' => (($_SERVER['HTTPS'] ?? '') !== ''),
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();

    $eingabe = [];
    if ($methode === 'POST') {
        $roh = (string) file_get_contents('php://input', false, null, 0, KIKURS_STAND_MAX * 2);
        $eingabe = json_decode($roh, true);
        if (!is_array($eingabe)) {
            $senden(400, ['fehler' => 'Ungültige Anfrage.']);
        }
    }
    try {
        $db = dbOeffnen($konfig);
        [$status, $antwort] = apiBearbeiten($db, $konfig, $aktion, $methode, $eingabe, $_SESSION, [
            'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
            'csrf' => (string) ($_SERVER['HTTP_X_CSRF'] ?? ''),
        ]);
    } catch (Throwable $e) {
        error_log('kikurs: ' . $e->getMessage());
        $senden(500, ['fehler' => 'Interner Fehler. Bitte später noch einmal.']);
    }
    $senden($status, $antwort);
}
