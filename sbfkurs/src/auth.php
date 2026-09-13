<?php

/**
 * Konten und Anmeldung: Lernende und Admins, Registrierung mit
 * Einladungscode, Kontosperre nach Fehlversuchen, erzwungener
 * Passwortwechsel nach einem Admin-Reset.
 */

declare(strict_types=1);

function benutzerAngemeldet(): bool
{
    return isset($_SESSION['benutzer_id']) && (int) $_SESSION['benutzer_id'] > 0;
}

/**
 * Den angemeldeten Benutzer je Anfrage frisch laden — ein gesperrtes oder
 * gelöschtes Konto fliegt so sofort raus, nicht erst beim nächsten Login.
 */
function aktuellerBenutzer(PDO $db): ?array
{
    static $zwischenspeicher = null;
    if ($zwischenspeicher !== null) {
        return $zwischenspeicher ?: null;
    }
    if (!benutzerAngemeldet()) {
        $zwischenspeicher = false;

        return null;
    }
    $abfrage = $db->prepare('SELECT * FROM benutzer WHERE id = ? AND aktiv = 1');
    $abfrage->execute([(int) $_SESSION['benutzer_id']]);
    $benutzer = $abfrage->fetch();
    if ($benutzer === false) {
        unset($_SESSION['benutzer_id']);
        $zwischenspeicher = false;

        return null;
    }
    $zwischenspeicher = $benutzer;

    return $benutzer;
}

/** Seiten für Angemeldete brechen ohne Anmeldung zum Login ab. */
function anmeldungErzwingen(PDO $db, string $pfad): array
{
    $benutzer = aktuellerBenutzer($db);
    if ($benutzer === null) {
        $_SESSION['danach'] = $pfad;
        umleiten('/login');
    }
    // Nach einem Admin-Reset geht es nur noch zum Passwortwechsel.
    if ((int) $benutzer['passwort_wechsel_noetig'] === 1 && $pfad !== '/konto' && $pfad !== '/logout') {
        umleiten('/konto');
    }

    return $benutzer;
}

function istAdmin(?array $benutzer): bool
{
    return $benutzer !== null && $benutzer['rolle'] === 'admin';
}

/** Admin-Seiten liefern für alle anderen ein 403. */
function adminErzwingen(?array $benutzer): void
{
    if (!istAdmin($benutzer)) {
        http_response_code(403);
        exit('Nur für Admins.');
    }
}

/** Passwortregeln: Mindestlänge, nicht zu lang (bcrypt kappt bei 72 Byte). */
function passwortRegelnPruefen(string $passwort): ?string
{
    if (mb_strlen($passwort) < 10) {
        return 'Das Passwort braucht mindestens 10 Zeichen.';
    }
    if (strlen($passwort) > 72) {
        return 'Das Passwort darf höchstens 72 Zeichen lang sein.';
    }

    return null;
}

function emailGueltig(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false && strlen($email) <= 200;
}

/** Ist das Konto gerade gesperrt? */
function kontoGesperrt(array $benutzer): bool
{
    $bis = $benutzer['gesperrt_bis'] ?? null;

    return $bis !== null && $bis > gmdate('Y-m-d H:i:s');
}

/**
 * Anmeldeversuch. Missbrauchsbremse je IP und Kontosperre je Konto; die
 * Fehlermeldung ist für „unbekannt“, „falsch“ und „gesperrt“ dieselbe, damit
 * sich keine Konten erraten lassen.
 */
function anmelden(PDO $db, array $konfig, string $email, string $passwort): ?array
{
    if (!begrenzungPruefen($konfig, 'login')) {
        return null;
    }
    $abfrage = $db->prepare('SELECT * FROM benutzer WHERE email = ?');
    $abfrage->execute([trim($email)]);
    $benutzer = $abfrage->fetch();
    if ($benutzer === false) {
        // Gleiche Laufzeit wie ein echter Vergleich.
        password_verify($passwort, '$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345678');

        return null;
    }
    if ((int) $benutzer['aktiv'] !== 1 || kontoGesperrt($benutzer)) {
        return null;
    }
    if (!password_verify($passwort, (string) $benutzer['passwort_hash'])) {
        fehlversuchVerbuchen($db, $konfig, $benutzer);

        return null;
    }

    $neuerHash = password_needs_rehash((string) $benutzer['passwort_hash'], PASSWORD_DEFAULT)
        ? password_hash($passwort, PASSWORD_DEFAULT)
        : $benutzer['passwort_hash'];
    $db->prepare("UPDATE benutzer SET fehlversuche = 0, gesperrt_bis = NULL,
                  letzte_anmeldung = datetime('now'), passwort_hash = ? WHERE id = ?")
        ->execute([$neuerHash, (int) $benutzer['id']]);

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
    $_SESSION['benutzer_id'] = (int) $benutzer['id'];
    unset($_SESSION['trainer'], $_SESSION['buchstabieren']);

    return $benutzer;
}

/** Fehlversuch zählen; ab der Schwelle das Konto eine Weile sperren. */
function fehlversuchVerbuchen(PDO $db, array $konfig, array $benutzer): void
{
    $versuche = (int) $benutzer['fehlversuche'] + 1;
    $sperre = null;
    if ($versuche >= (int) $konfig['sperreVersuche']) {
        $sperre = gmdate('Y-m-d H:i:s', time() + (int) $konfig['sperreMinuten'] * 60);
        $versuche = 0;
    }
    $db->prepare('UPDATE benutzer SET fehlversuche = ?, gesperrt_bis = ? WHERE id = ?')
        ->execute([$versuche, $sperre, (int) $benutzer['id']]);
}

/** Konto anlegen; liefert die neue ID oder eine Fehlermeldung. */
function benutzerAnlegen(PDO $db, string $email, string $name, string $passwort, string $rolle = 'lerner', bool $wechselNoetig = false): int|string
{
    $email = trim($email);
    if (!emailGueltig($email)) {
        return 'Bitte eine gültige E-Mail-Adresse angeben.';
    }
    if (($fehler = passwortRegelnPruefen($passwort)) !== null) {
        return $fehler;
    }
    $rolle = $rolle === 'admin' ? 'admin' : 'lerner';

    $abfrage = $db->prepare('SELECT id FROM benutzer WHERE email = ?');
    $abfrage->execute([$email]);
    if ($abfrage->fetch() !== false) {
        return 'Für diese E-Mail-Adresse gibt es schon ein Konto.';
    }

    $db->prepare('INSERT INTO benutzer (email, name, passwort_hash, rolle, passwort_wechsel_noetig)
                  VALUES (?, ?, ?, ?, ?)')
        ->execute([$email, mb_substr(saeubern($name), 0, 100), password_hash($passwort, PASSWORD_DEFAULT), $rolle, $wechselNoetig ? 1 : 0]);

    return (int) $db->lastInsertId();
}

/**
 * Selbstregistrierung: nur mit gültigem Einladungscode — dem aus der
 * Konfiguration oder einem unverbrauchten Einmalcode.
 */
function registrieren(PDO $db, array $konfig, string $email, string $name, string $passwort, string $code): int|string
{
    if (!begrenzungPruefen($konfig, 'registrierung')) {
        return 'Zu viele Versuche — bitte später noch einmal.';
    }
    $code = trim($code);
    $konfigCode = (string) $konfig['einladungscode'];
    $einmalcode = null;
    if ($code !== '') {
        if ($konfigCode === '' || !hash_equals($konfigCode, $code)) {
            $abfrage = $db->prepare('SELECT code FROM einladungen WHERE code = ? AND verbraucht_von IS NULL');
            $abfrage->execute([$code]);
            $einmalcode = $abfrage->fetchColumn() ?: null;
        }
    }
    $konfigTrifft = $code !== '' && $konfigCode !== '' && hash_equals($konfigCode, $code);
    if (!$konfigTrifft && $einmalcode === null) {
        return 'Der Einladungscode stimmt nicht.';
    }

    $ergebnis = benutzerAnlegen($db, $email, $name, $passwort);
    if (is_int($ergebnis) && $einmalcode !== null) {
        $db->prepare("UPDATE einladungen SET verbraucht_von = ?, verbraucht_am = datetime('now') WHERE code = ?")
            ->execute([$ergebnis, $einmalcode]);
    }

    return $ergebnis;
}

/** Passwort setzen; optional den Wechselzwang setzen oder aufheben. */
function passwortSetzen(PDO $db, int $benutzerId, string $passwort, bool $wechselNoetig): ?string
{
    if (($fehler = passwortRegelnPruefen($passwort)) !== null) {
        return $fehler;
    }
    $db->prepare('UPDATE benutzer SET passwort_hash = ?, passwort_wechsel_noetig = ?,
                  fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?')
        ->execute([password_hash($passwort, PASSWORD_DEFAULT), $wechselNoetig ? 1 : 0, $benutzerId]);

    return null;
}

/** Einmal-Einladungscode erzeugen (lesbar, ohne verwechselbare Zeichen). */
function einladungErzeugen(PDO $db, string $bemerkung): string
{
    $zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= $zeichen[random_int(0, strlen($zeichen) - 1)];
        }
        $abfrage = $db->prepare('SELECT 1 FROM einladungen WHERE code = ?');
        $abfrage->execute([$code]);
    } while ($abfrage->fetch() !== false);

    $db->prepare('INSERT INTO einladungen (code, bemerkung) VALUES (?, ?)')
        ->execute([$code, mb_substr(saeubern($bemerkung), 0, 100)]);

    return $code;
}
