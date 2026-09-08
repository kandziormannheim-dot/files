<?php

/**
 * Anmeldung mit eigenen Konten: E-Mail + Passwort (bcrypt), Anmeldebremse
 * je IP (begrenzungPruefen) und je Konto (Fehlversuche → Sperre), Sitzung
 * mit Ablauf bei Inaktivität.
 */

declare(strict_types=1);

const PASSWORT_MINDESTLAENGE = 10;

/** Angemeldeter Benutzer samt Rolle, oder null. Je Anfrage einmal geladen. */
function benutzerAktuell(): ?array
{
    static $benutzer = false;
    if ($benutzer !== false) {
        return $benutzer;
    }
    $benutzer = null;
    $id = (int) ($_SESSION['benutzer_id'] ?? 0);
    if ($id <= 0) {
        return null;
    }
    $dauer = (int) konfig()['intern']['sitzungsdauer'];
    if ($dauer > 0 && time() - (int) ($_SESSION['aktiv'] ?? 0) > $dauer) {
        abmelden();

        return null;
    }
    $st = datenbank()->prepare('SELECT b.*, r.name AS rolle, r.system FROM benutzer b JOIN rollen r ON r.id = b.rolle_id WHERE b.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();
    if (!is_array($z) || (int) $z['aktiv'] !== 1) {
        abmelden();

        return null;
    }
    $_SESSION['aktiv'] = time();
    $benutzer = $z;

    return $benutzer;
}

/** Ohne Anmeldung zur Login-Seite (mit Rücksprung). */
function anmeldungErzwingen(string $pfad): void
{
    if (benutzerAktuell() === null) {
        umleiten(url('login', $pfad !== '/' ? ['weiter' => $pfad] : []));
    }
}

/**
 * Anmeldeversuch. Liefert true bei Erfolg; alle Fehlerfälle liefern false
 * mit derselben Meldung nach außen (kein Hinweis, ob die E-Mail existiert).
 */
function anmelden(string $email, string $passwort): bool
{
    $email = mb_strtolower(trim($email));
    if (!begrenzungPruefen('login', (int) (konfig()['intern']['anmeldung']['jeIp'] ?? 30))) {
        return false;
    }
    $db = datenbank();
    $st = $db->prepare('SELECT * FROM benutzer WHERE email = ?');
    $st->execute([$email]);
    $b = $st->fetch();
    if (!is_array($b)) {
        // Gleicher Zeitaufwand wie ein echter Vergleich.
        password_verify($passwort, '$2y$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345');

        return false;
    }
    if ((int) $b['aktiv'] !== 1) {
        return false;
    }
    if ($b['gesperrt_bis'] !== null && $b['gesperrt_bis'] > jetzt()) {
        return false;
    }
    if (!password_verify($passwort, (string) $b['passwort_hash'])) {
        $regel = konfig()['intern']['anmeldung'];
        $versuche = (int) $b['fehlversuche'] + 1;
        $sperre = null;
        if ($versuche >= (int) $regel['versuche']) {
            $sperre = gmdate('Y-m-d\TH:i:s\Z', time() + (int) $regel['sperre']);
            $versuche = 0;
            protokollieren('anmeldung.gesperrt', 'benutzer', (int) $b['id'], ['email' => $email], $b);
        }
        $db->prepare('UPDATE benutzer SET fehlversuche = ?, gesperrt_bis = ? WHERE id = ?')->execute([$versuche, $sperre, $b['id']]);

        return false;
    }

    $hash = (string) $b['passwort_hash'];
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        $hash = password_hash($passwort, PASSWORD_DEFAULT);
    }
    $db->prepare('UPDATE benutzer SET fehlversuche = 0, gesperrt_bis = NULL, letzte_anmeldung = ?, passwort_hash = ? WHERE id = ?')
       ->execute([jetzt(), $hash, $b['id']]);

    session_regenerate_id(true);
    $_SESSION['benutzer_id'] = (int) $b['id'];
    $_SESSION['aktiv'] = time();
    unset($_SESSION['csrf']);
    protokollieren('anmeldung', 'benutzer', (int) $b['id'], [], $b);

    return true;
}

/** Sitzung beenden. */
function abmelden(): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
        session_destroy();
    }
}

/** Passwortregel prüfen; liefert die Fehlermeldung oder null. */
function passwortRegel(string $passwort): ?string
{
    if (mb_strlen($passwort) < PASSWORT_MINDESTLAENGE) {
        return 'Das Passwort braucht mindestens ' . PASSWORT_MINDESTLAENGE . ' Zeichen.';
    }
    if (preg_match('/^\s|\s$/', $passwort)) {
        return 'Das Passwort darf nicht mit Leerzeichen beginnen oder enden.';
    }

    return null;
}

function benutzerLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT b.*, r.name AS rolle, r.system FROM benutzer b JOIN rollen r ON r.id = b.rolle_id WHERE b.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function benutzerAlle(): array
{
    return datenbank()->query('SELECT b.*, r.name AS rolle, r.system FROM benutzer b JOIN rollen r ON r.id = b.rolle_id ORDER BY b.aktiv DESC, b.name')->fetchAll();
}

/** Zahl der aktiven Benutzer mit Admin-Systemrolle. */
function aktiveAdmins(): int
{
    return (int) datenbank()->query('SELECT COUNT(*) FROM benutzer b JOIN rollen r ON r.id = b.rolle_id WHERE b.aktiv = 1 AND r.system = 1')->fetchColumn();
}

/**
 * Benutzer anlegen. Liefert ['id' => …, 'passwort' => Startpasswort] oder
 * wirft InvalidArgumentException mit einer Meldung für das Formular.
 */
function benutzerAnlegen(string $email, string $name, int $rolleId, ?string $passwort = null): array
{
    $email = mb_strtolower(trim($email));
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new InvalidArgumentException('Bitte eine gültige E-Mail-Adresse angeben.');
    }
    if (mb_strlen(trim($name)) < 2) {
        throw new InvalidArgumentException('Bitte einen Namen angeben.');
    }
    if (rolleLaden($rolleId) === null) {
        throw new InvalidArgumentException('Bitte eine Rolle wählen.');
    }
    $db = datenbank();
    $st = $db->prepare('SELECT id FROM benutzer WHERE email = ?');
    $st->execute([$email]);
    if ($st->fetchColumn() !== false) {
        throw new InvalidArgumentException('Diese E-Mail-Adresse hat schon ein Konto.');
    }
    $passwort ??= passwortErzeugen();
    $db->prepare('INSERT INTO benutzer (email, name, passwort_hash, rolle_id, aktiv, muss_passwort_aendern, erstellt, aktualisiert) VALUES (?, ?, ?, ?, 1, 1, ?, ?)')
       ->execute([$email, trim($name), password_hash($passwort, PASSWORD_DEFAULT), $rolleId, jetzt(), jetzt()]);

    return ['id' => (int) $db->lastInsertId(), 'passwort' => $passwort];
}
