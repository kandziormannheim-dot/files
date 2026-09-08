<?php

/**
 * Anmeldung im Kundenportal: Passwort (bcrypt, Bremse je IP und je Konto)
 * oder Anmeldelink (lib/kunden.php). Sitzung je Anfrage gegen die Datenbank
 * geprüft (aktiv, bestätigt, Firma aktiv).
 */

declare(strict_types=1);

/** Angemeldeter Kunde samt Firma, oder null. Je Anfrage einmal geladen. */
function kundeAktuell(): ?array
{
    static $kunde = false;
    if ($kunde !== false) {
        return $kunde;
    }
    $kunde = null;
    $id = (int) ($_SESSION['kunde_id'] ?? 0);
    if ($id <= 0) {
        return null;
    }
    $dauer = (int) konfig()['konto']['sitzungsdauer'];
    if ($dauer > 0 && time() - (int) ($_SESSION['aktiv'] ?? 0) > $dauer) {
        kundeAbmelden();

        return null;
    }
    $k = kundeLaden($id);
    if ($k === null || (int) $k['aktiv'] !== 1 || (int) $k['email_bestaetigt'] !== 1
        || ($k['art'] === 'business' && ((int) ($k['firma_aktiv'] ?? 0) !== 1))) {
        kundeAbmelden();

        return null;
    }
    $_SESSION['aktiv'] = time();
    $kunde = $k;

    return $kunde;
}

/** Sitzung auf ein Konto setzen (nach Passwort oder Link). */
function kundeSitzungSetzen(array $kunde, bool $ueberLink = false): void
{
    session_regenerate_id(true);
    $_SESSION['kunde_id'] = (int) $kunde['id'];
    $_SESSION['aktiv'] = time();
    $_SESSION['sprache'] = $kunde['sprache'] === 'en' ? 'en' : 'de';
    $_SESSION['passwort_frei'] = $ueberLink; // nach Link darf ohne altes Passwort ein neues gesetzt werden
    unset($_SESSION['csrf']);
    kundeAktualisieren((int) $kunde['id'], ['letzte_anmeldung' => jetzt(), 'fehlversuche' => 0, 'gesperrt_bis' => null]);
}

/** Passwort-Anmeldung. Alle Fehlerfälle liefern false mit derselben Meldung. */
function kundeAnmelden(string $email, string $passwort): bool
{
    $regel = konfig()['konto']['anmeldung'];
    if (!begrenzungPruefen('konto-login', (int) ($regel['jeIp'] ?? 30))) {
        return false;
    }
    $k = kundeNachEmail($email);
    if ($k === null || $k['passwort_hash'] === null) {
        password_verify($passwort, '$2y$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345');

        return false;
    }
    if ((int) $k['aktiv'] !== 1 || (int) $k['email_bestaetigt'] !== 1) {
        return false;
    }
    if ($k['gesperrt_bis'] !== null && $k['gesperrt_bis'] > jetzt()) {
        return false;
    }
    if (!password_verify($passwort, (string) $k['passwort_hash'])) {
        $versuche = (int) $k['fehlversuche'] + 1;
        $sperre = null;
        if ($versuche >= (int) $regel['versuche']) {
            $sperre = gmdate('Y-m-d\TH:i:s\Z', time() + (int) $regel['sperre']);
            $versuche = 0;
        }
        kundeAktualisieren((int) $k['id'], ['fehlversuche' => $versuche, 'gesperrt_bis' => $sperre]);

        return false;
    }
    if (password_needs_rehash((string) $k['passwort_hash'], PASSWORD_DEFAULT)) {
        kundeAktualisieren((int) $k['id'], ['passwort_hash' => password_hash($passwort, PASSWORD_DEFAULT)]);
    }
    kundeSitzungSetzen($k, false);

    return true;
}

function kundeAbmelden(): void
{
    $sprache = $_SESSION['sprache'] ?? null;
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
        session_destroy();
        session_start();
    }
    if ($sprache !== null) {
        $_SESSION['sprache'] = $sprache;
    }
}

/** Ohne Anmeldung zur Login-Seite (mit Rücksprung). */
function anmeldungErzwingen(string $pfad): array
{
    $k = kundeAktuell();
    if ($k === null) {
        umleiten(url('login', $pfad !== '/' ? ['weiter' => $pfad] : []));
    }

    return $k;
}

function businessErzwingen(array $kunde): array
{
    if ($kunde['art'] !== 'business' || (int) $kunde['firma_id'] <= 0) {
        fehlerSeite(403, t('fehler.403'), t('fehler.403.text'));
    }
    $firma = firmaLaden((int) $kunde['firma_id']);
    if ($firma === null) {
        fehlerSeite(403, t('fehler.403'), t('fehler.403.text'));
    }

    return $firma;
}

function privatErzwingen(array $kunde): void
{
    if ($kunde['art'] !== 'privat') {
        fehlerSeite(403, t('fehler.403'), t('fehler.403.text'));
    }
}

function inhaberErzwingen(array $kunde): array
{
    $firma = businessErzwingen($kunde);
    if ($kunde['firmenrolle'] !== 'inhaber') {
        fehlerSeite(403, t('fehler.403'), t('fehler.403.text'));
    }

    return $firma;
}
