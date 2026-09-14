<?php

/**
 * Kundenkonten, Firmen und Anmeldelinks — gemeinsam für Kundenportal (konto/)
 * und Dashboard (intern/). Zugriff nur über diese Funktionen; die Trennung
 * „jeder sieht nur seine Daten“ erzwingt das Portal in src/sendungen.php.
 */

declare(strict_types=1);

const KUNDE_PASSWORT_MINDESTLAENGE = 10;

// ---------------------------------------------------------------------- Kunden

function kundeLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT k.*, f.name AS firma, f.aktiv AS firma_aktiv FROM kunden k LEFT JOIN firmen f ON f.id = k.firma_id WHERE k.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function kundeNachEmail(string $email): ?array
{
    $st = datenbank()->prepare('SELECT k.*, f.name AS firma, f.aktiv AS firma_aktiv FROM kunden k LEFT JOIN firmen f ON f.id = k.firma_id WHERE k.email = ?');
    $st->execute([mb_strtolower(trim($email))]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/**
 * Konto anlegen. $daten: email, name, art ('privat'|'business'), firma_id,
 * firmenrolle, sprache, passwort (optional), email_bestaetigt (0/1).
 */
function kundeAnlegen(array $daten): int
{
    $email = mb_strtolower(trim((string) ($daten['email'] ?? '')));
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new InvalidArgumentException('email');
    }
    $db = datenbank();
    $art = ($daten['art'] ?? 'privat') === 'business' ? 'business' : 'privat';
    $db->prepare(<<<'SQL'
        INSERT INTO kunden (art, email, name, firma_id, unterkunde_id, firmenrolle, passwort_hash, email_bestaetigt, aktiv, sprache, kundennummer, erstellt, aktualisiert)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    SQL)->execute([
        $art,
        $email,
        trim((string) ($daten['name'] ?? '')),
        isset($daten['firma_id']) ? (int) $daten['firma_id'] : null,
        isset($daten['unterkunde_id']) && (int) $daten['unterkunde_id'] > 0 ? (int) $daten['unterkunde_id'] : null,
        (string) ($daten['firmenrolle'] ?? ''),
        isset($daten['passwort']) && $daten['passwort'] !== '' ? password_hash((string) $daten['passwort'], PASSWORD_DEFAULT) : null,
        (int) ($daten['email_bestaetigt'] ?? 0),
        ($daten['sprache'] ?? 'de') === 'en' ? 'en' : 'de',
        $art === 'privat' ? kundennummerNeu($db) : '',   // Firmenbenutzer haben keine eigene Nummer
        jetzt(),
        jetzt(),
    ]);
    $id = (int) $db->lastInsertId();
    syncMarkieren('kunden', $id);

    return $id;
}

/** Einzelne Felder eines Kontos setzen (nur bekannte Spalten). */
function kundeAktualisieren(int $id, array $felder): void
{
    $erlaubt = ['name', 'passwort_hash', 'email_bestaetigt', 'aktiv', 'sprache', 'absender_json', 'fehlversuche', 'gesperrt_bis', 'letzte_anmeldung', 'firmenrolle', 'unterkunde_id'];
    $setzen = [];
    $werte = [];
    foreach ($felder as $spalte => $wert) {
        if (in_array($spalte, $erlaubt, true)) {
            $setzen[] = "$spalte = ?";
            $werte[] = $wert;
        }
    }
    if ($setzen === []) {
        return;
    }
    // Nur Stammdaten zählen als Änderung für die Synchronisation (nicht Anmeldezeit, Fehlversuche, Passwort)
    $stammdaten = array_intersect(array_keys($felder), ['name', 'aktiv', 'absender_json', 'firmenrolle', 'unterkunde_id']) !== [];
    if ($stammdaten) {
        $setzen[] = 'aktualisiert = ?';
        $werte[] = jetzt();
    }
    $werte[] = $id;
    datenbank()->prepare('UPDATE kunden SET ' . implode(', ', $setzen) . ' WHERE id = ?')->execute($werte);
    if ($stammdaten) {
        syncMarkieren('kunden', $id);
    }
}

/** Anzeigename mit Kundennummer: „Karla Kundin (K-100002)“ bzw. Firma/Unterkunde. */
function kundennummerVon(array $zeile): string
{
    return (string) ($zeile['nummer'] ?? $zeile['kundennummer'] ?? '');
}

/** Bestellungen derselben E-Mail (Privatkunden-Checkout) dem Konto zuordnen. */
function bestellungenZuordnen(int $kundeId, string $email): int
{
    $st = datenbank()->prepare("UPDATE bestellungen SET kunde_id = ? WHERE kunde_id IS NULL AND firma_id IS NULL AND zahlungsart = 'revolut' AND lower(email) = ?");
    $st->execute([$kundeId, mb_strtolower(trim($email))]);

    return $st->rowCount();
}

/** Passwortregel; liefert die Meldung (DE/EN) oder null. */
function kundePasswortRegel(string $passwort, string $sprache = 'de'): ?string
{
    if (mb_strlen($passwort) < KUNDE_PASSWORT_MINDESTLAENGE) {
        return $sprache === 'en'
            ? 'The password needs at least ' . KUNDE_PASSWORT_MINDESTLAENGE . ' characters.'
            : 'Das Passwort braucht mindestens ' . KUNDE_PASSWORT_MINDESTLAENGE . ' Zeichen.';
    }
    if (preg_match('/^\s|\s$/', $passwort)) {
        return $sprache === 'en' ? 'The password must not start or end with a space.' : 'Das Passwort darf nicht mit Leerzeichen beginnen oder enden.';
    }

    return null;
}

// ---------------------------------------------------------------------- Firmen

function firmaLaden(int $id): ?array
{
    $st = datenbank()->prepare('SELECT * FROM firmen WHERE id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Alle Firmen mit Benutzer-, Sendungs- und Rechnungszahl. */
function firmenAlle(): array
{
    return datenbank()->query(<<<'SQL'
        SELECT f.*,
               (SELECT COUNT(*) FROM kunden k WHERE k.firma_id = f.id AND k.aktiv = 1) AS benutzer,
               (SELECT COUNT(*) FROM bestellungen b WHERE b.firma_id = f.id AND b.status = 'beauftragt') AS sendungen,
               (SELECT COUNT(*) FROM rechnungen r WHERE r.firma_id = f.id AND r.status = 'offen') AS offene_rechnungen
        FROM firmen f ORDER BY f.aktiv DESC, f.name
    SQL)->fetchAll();
}

function firmenBenutzer(int $firmaId): array
{
    $st = datenbank()->prepare("SELECT * FROM kunden WHERE firma_id = ? ORDER BY CASE firmenrolle WHEN 'inhaber' THEN 0 ELSE 1 END, aktiv DESC, name");
    $st->execute([$firmaId]);

    return $st->fetchAll();
}

/** Firma anlegen; $daten: name, strasse, plz, ort, land, ust_id, rechnungs_email, anfrage_id. */
function firmaAnlegen(array $daten, string $von): int
{
    $name = trim((string) ($daten['name'] ?? ''));
    if (mb_strlen($name) < 2) {
        throw new InvalidArgumentException('Bitte einen Firmennamen angeben.');
    }
    $db = datenbank();
    $db->prepare(<<<'SQL'
        INSERT INTO firmen (name, strasse, plz, ort, land, ust_id, rechnungs_email, zahlungsziel_tage, aktiv, anfrage_id, freigeschaltet_von, kundennummer, erstellt, aktualisiert)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    SQL)->execute([
        $name,
        trim((string) ($daten['strasse'] ?? '')),
        trim((string) ($daten['plz'] ?? '')),
        trim((string) ($daten['ort'] ?? '')),
        strtoupper(trim((string) ($daten['land'] ?? 'DE'))) ?: 'DE',
        trim((string) ($daten['ust_id'] ?? '')),
        mb_strtolower(trim((string) ($daten['rechnungs_email'] ?? ''))),
        (int) ($daten['zahlungsziel_tage'] ?? konfig()['rechnung']['zahlungszielTage']),
        isset($daten['anfrage_id']) && (int) $daten['anfrage_id'] > 0 ? (int) $daten['anfrage_id'] : null,
        $von,
        kundennummerNeu($db),
        jetzt(),
        jetzt(),
    ]);
    $id = (int) $db->lastInsertId();
    syncMarkieren('firmen', $id);

    return $id;
}

function firmaAktualisieren(int $id, array $felder): void
{
    $erlaubt = ['name', 'strasse', 'plz', 'ort', 'land', 'ust_id', 'rechnungs_email', 'zahlungsziel_tage', 'aktiv'];
    $setzen = [];
    $werte = [];
    foreach ($felder as $spalte => $wert) {
        if (in_array($spalte, $erlaubt, true)) {
            $setzen[] = "$spalte = ?";
            $werte[] = $wert;
        }
    }
    if ($setzen === []) {
        return;
    }
    $setzen[] = 'aktualisiert = ?';
    $werte[] = jetzt();
    $werte[] = $id;
    datenbank()->prepare('UPDATE firmen SET ' . implode(', ', $setzen) . ' WHERE id = ?')->execute($werte);
    syncMarkieren('firmen', $id);
}

// ------------------------------------------------------------------ Unterkunden

/**
 * Unterkunden: weitere Unternehmen einer Firmengruppe oder Standorte unter
 * der Kundennummer der Firma (K-100001-01). Jeder Unterkunde ist eigener
 * Rechnungsempfänger mit eigener Adresse, USt-ID, Rechnungs-Mail, optional
 * eigenem Zahlungsziel und eigener Preisliste. Angelegt nur durch NEOS.
 */
function unterkundeLaden(int $id): ?array
{
    if ($id <= 0) {
        return null;
    }
    $st = datenbank()->prepare('SELECT u.*, f.name AS firma, f.kundennummer AS firma_kundennummer FROM unterkunden u JOIN firmen f ON f.id = u.firma_id WHERE u.id = ?');
    $st->execute([$id]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

function unterkundeNachNummer(string $nummer): ?array
{
    $st = datenbank()->prepare('SELECT u.*, f.name AS firma, f.kundennummer AS firma_kundennummer FROM unterkunden u JOIN firmen f ON f.id = u.firma_id WHERE u.nummer = ?');
    $st->execute([strtoupper(trim($nummer))]);
    $z = $st->fetch();

    return is_array($z) ? $z : null;
}

/** Unterkunden einer Firma (mit Sendungs- und Rechnungszahl), aktive zuerst. */
function unterkundenDerFirma(int $firmaId, bool $nurAktive = false): array
{
    $st = datenbank()->prepare(<<<'SQL'
        SELECT u.*,
               (SELECT COUNT(*) FROM bestellungen b WHERE b.unterkunde_id = u.id AND b.status = 'beauftragt') AS sendungen,
               (SELECT COUNT(*) FROM rechnungen r WHERE r.unterkunde_id = u.id AND r.status = 'offen') AS offene_rechnungen,
               (SELECT COUNT(*) FROM kunden k WHERE k.unterkunde_id = u.id AND k.aktiv = 1) AS benutzer
        FROM unterkunden u WHERE u.firma_id = ? AND (? = 0 OR u.aktiv = 1)
        ORDER BY u.aktiv DESC, u.laufnummer
    SQL);
    $st->execute([$firmaId, $nurAktive ? 1 : 0]);

    return $st->fetchAll();
}

/** Unterkunde anlegen; $daten: name, strasse, plz, ort, land, ust_id, rechnungs_email, zahlungsziel_tage (leer = Firma), notiz. */
function unterkundeAnlegen(int $firmaId, array $daten, string $von): int
{
    $firma = firmaLaden($firmaId);
    if ($firma === null) {
        throw new InvalidArgumentException('Firma nicht gefunden.');
    }
    $name = trim((string) ($daten['name'] ?? ''));
    if (mb_strlen($name) < 2) {
        throw new InvalidArgumentException('Bitte einen Namen für den Unterkunden angeben.');
    }
    $db = datenbank();
    $db->beginTransaction();
    try {
        $st = $db->prepare('SELECT COALESCE(MAX(laufnummer), 0) + 1 FROM unterkunden WHERE firma_id = ?');
        $st->execute([$firmaId]);
        $lauf = (int) $st->fetchColumn();
        $db->prepare(<<<'SQL'
            INSERT INTO unterkunden (firma_id, nummer, laufnummer, name, strasse, plz, ort, land, ust_id, rechnungs_email, zahlungsziel_tage, aktiv, notiz, erstellt, aktualisiert)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        SQL)->execute([
            $firmaId, unterkundenNummer((string) $firma['kundennummer'], $lauf), $lauf, $name,
            trim((string) ($daten['strasse'] ?? '')), trim((string) ($daten['plz'] ?? '')), trim((string) ($daten['ort'] ?? '')),
            strtoupper(trim((string) ($daten['land'] ?? $firma['land']))) ?: 'DE', trim((string) ($daten['ust_id'] ?? '')),
            mb_strtolower(trim((string) ($daten['rechnungs_email'] ?? ''))),
            isset($daten['zahlungsziel_tage']) && $daten['zahlungsziel_tage'] !== '' ? max(0, (int) $daten['zahlungsziel_tage']) : null,
            trim((string) ($daten['notiz'] ?? '')), jetzt(), jetzt(),
        ]);
        $id = (int) $db->lastInsertId();
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    syncMarkieren('unterkunden', $id);

    return $id;
}

function unterkundeAktualisieren(int $id, array $felder): void
{
    $erlaubt = ['name', 'strasse', 'plz', 'ort', 'land', 'ust_id', 'rechnungs_email', 'zahlungsziel_tage', 'preisliste_id', 'aktiv', 'notiz'];
    $setzen = [];
    $werte = [];
    foreach ($felder as $spalte => $wert) {
        if (in_array($spalte, $erlaubt, true)) {
            $setzen[] = "$spalte = ?";
            $werte[] = $wert;
        }
    }
    if ($setzen === []) {
        return;
    }
    $setzen[] = 'aktualisiert = ?';
    $werte[] = jetzt();
    $werte[] = $id;
    datenbank()->prepare('UPDATE unterkunden SET ' . implode(', ', $setzen) . ' WHERE id = ?')->execute($werte);
    syncMarkieren('unterkunden', $id);
}

/**
 * Rechnungsempfänger einer Bestellung oder Rechnung: der Unterkunde, sonst die
 * Firma. Liefert name, strasse, plz, ort, land, ust_id, rechnungs_email,
 * zahlungsziel_tage, kundennummer, lexware_kontakt_id, tabelle ('unterkunden'|'firmen'), id.
 */
function rechnungsempfaenger(array $bezug): array
{
    $firma = firmaLaden((int) ($bezug['firma_id'] ?? 0));
    if ($firma === null) {
        throw new InvalidArgumentException('Firma nicht gefunden.');
    }
    $u = (int) ($bezug['unterkunde_id'] ?? 0) > 0 ? unterkundeLaden((int) $bezug['unterkunde_id']) : null;
    if ($u === null) {
        return ['tabelle' => 'firmen', 'id' => (int) $firma['id'], 'firma' => $firma, 'unterkunde' => null, 'name' => $firma['name'], 'strasse' => $firma['strasse'], 'plz' => $firma['plz'], 'ort' => $firma['ort'], 'land' => $firma['land'] ?: 'DE',
            'ust_id' => $firma['ust_id'], 'rechnungs_email' => $firma['rechnungs_email'], 'zahlungsziel_tage' => (int) $firma['zahlungsziel_tage'], 'kundennummer' => (string) $firma['kundennummer'], 'lexware_kontakt_id' => (string) $firma['lexware_kontakt_id']];
    }

    return ['tabelle' => 'unterkunden', 'id' => (int) $u['id'], 'firma' => $firma, 'unterkunde' => $u, 'name' => $u['name'], 'strasse' => $u['strasse'], 'plz' => $u['plz'], 'ort' => $u['ort'], 'land' => $u['land'] ?: 'DE',
        'ust_id' => $u['ust_id'], 'rechnungs_email' => $u['rechnungs_email'] !== '' ? $u['rechnungs_email'] : $firma['rechnungs_email'],
        'zahlungsziel_tage' => $u['zahlungsziel_tage'] !== null ? (int) $u['zahlungsziel_tage'] : (int) $firma['zahlungsziel_tage'], 'kundennummer' => (string) $u['nummer'], 'lexware_kontakt_id' => (string) $u['lexware_kontakt_id']];
}

/**
 * Firmenbenutzer einladen (Inhaber beim Anlegen der Firma, Mitarbeiter durch
 * den Inhaber): Konto anlegen oder vorhandenes Konto derselben Firma erneut
 * einladen, Einladungslink per Mail. Liefert die Kunden-ID.
 */
function firmenBenutzerEinladen(array $firma, string $email, string $name, string $rolle, string $sprache = 'de'): int
{
    $email = mb_strtolower(trim($email));
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new InvalidArgumentException($sprache === 'en' ? 'Please enter a valid email address.' : 'Bitte eine gültige E-Mail-Adresse angeben.');
    }
    $vorhanden = kundeNachEmail($email);
    if ($vorhanden !== null && (int) $vorhanden['firma_id'] !== (int) $firma['id']) {
        throw new InvalidArgumentException($sprache === 'en' ? 'This email address already has an account.' : 'Diese E-Mail-Adresse hat schon ein Konto.');
    }
    $rolle = $rolle === 'inhaber' ? 'inhaber' : 'mitarbeiter';
    if ($vorhanden === null) {
        $kundeId = kundeAnlegen(['email' => $email, 'name' => $name, 'art' => 'business', 'firma_id' => (int) $firma['id'], 'firmenrolle' => $rolle, 'sprache' => $sprache, 'email_bestaetigt' => 0]);
    } else {
        $kundeId = (int) $vorhanden['id'];
        kundeAktualisieren($kundeId, ['aktiv' => 1, 'firmenrolle' => $rolle]);
    }
    $token = anmeldelinkErzeugen($kundeId, 'einladung', (int) konfig()['konto']['einladungGueltigkeit']);
    kontoMailSenden(kundeLaden($kundeId) ?? ['email' => $email, 'name' => $name, 'sprache' => $sprache], 'einladung', anmeldelinkUrl($token, $sprache), ['firma' => $firma['name']]);

    return $kundeId;
}

// ---------------------------------------------------------------- Anmeldelinks

/** Link-Token erzeugen; gespeichert wird nur der SHA-256. Liefert das Token. */
function anmeldelinkErzeugen(int $kundeId, string $zweck, int $gueltigkeit): string
{
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    datenbank()->prepare('INSERT INTO anmeldelinks (kunde_id, token_hash, zweck, ablauf, erstellt) VALUES (?, ?, ?, ?, ?)')
        ->execute([$kundeId, hash('sha256', $token), $zweck, gmdate('Y-m-d\TH:i:s\Z', time() + $gueltigkeit), jetzt()]);

    return $token;
}

/** Vollständige Adresse des Links im Portal. */
function anmeldelinkUrl(string $token, string $sprache = 'de'): string
{
    $basis = rtrim((string) konfig()['basisUrl'], '/');
    if ($basis === '') {
        $basis = (istHttps() ? 'https://' : 'http://') . (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    return $basis . '/konto/link?t=' . $token . ($sprache === 'en' ? '&sprache=en' : '');
}

/**
 * Link einlösen: gültig, unbenutzt, Konto aktiv. Markiert den Link als
 * genutzt (einmalig). Liefert ['kunde' => …, 'zweck' => …] oder null.
 */
function anmeldelinkEinloesen(string $token): ?array
{
    if ($token === '' || strlen($token) > 64) {
        return null;
    }
    $db = datenbank();
    $db->beginTransaction();
    try {
        $st = $db->prepare('SELECT * FROM anmeldelinks WHERE token_hash = ? AND genutzt IS NULL AND ablauf > ?');
        $st->execute([hash('sha256', $token), jetzt()]);
        $link = $st->fetch();
        if (!is_array($link)) {
            $db->commit();

            return null;
        }
        $db->prepare('UPDATE anmeldelinks SET genutzt = ? WHERE id = ?')->execute([jetzt(), $link['id']]);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    $kunde = kundeLaden((int) $link['kunde_id']);
    if ($kunde === null || (int) $kunde['aktiv'] !== 1) {
        return null;
    }

    return ['kunde' => $kunde, 'zweck' => (string) $link['zweck']];
}

/** Abgelaufene und genutzte Links gelegentlich aufräumen. */
function anmeldelinksAufraeumen(): void
{
    if (random_int(1, 20) !== 1) {
        return;
    }
    datenbank()->prepare('DELETE FROM anmeldelinks WHERE ablauf < ? OR genutzt IS NOT NULL')->execute([gmdate('Y-m-d\TH:i:s\Z', time() - 86400)]);
}

// ------------------------------------------------------------------------ Mails

/** Mail zu einem Link: anmelden, registrieren, passwort, einladung. */
function kontoMailSenden(array $kunde, string $zweck, string $url, array $extra = []): void
{
    $sprache = ($kunde['sprache'] ?? 'de') === 'en' ? 'en' : 'de';
    $name = trim((string) ($kunde['name'] ?? ''));
    $anrede = $sprache === 'en' ? 'Hello' . ($name !== '' ? ' ' . $name : '') . ',' : 'Hallo' . ($name !== '' ? ' ' . $name : '') . ',';
    $minuten = (int) round((int) konfig()['konto']['linkGueltigkeit'] / 60);
    $tage = (int) round((int) konfig()['konto']['einladungGueltigkeit'] / 86400);
    $fuss = $sprache === 'en'
        ? "If you did not request this, simply ignore this email.\n\nNEOS Logistics UG · info@neos24.com"
        : "Wenn du das nicht angefordert hast, ignoriere diese E-Mail einfach.\n\nNEOS Logistics UG · info@neos24.com";

    [$betreff, $text] = match ($zweck) {
        'registrieren' => $sprache === 'en'
            ? ['Confirm your NEOS account', "please confirm your email address to activate your NEOS account:\n\n$url\n\nThe link is valid for $minuten minutes. Afterwards you can see all your orders and set a password."]
            : ['NEOS-Konto bestätigen', "bitte bestätige deine E-Mail-Adresse, um dein NEOS-Konto zu aktivieren:\n\n$url\n\nDer Link ist $minuten Minuten gültig. Danach siehst du alle deine Bestellungen und kannst ein Passwort setzen."],
        'passwort' => $sprache === 'en'
            ? ['Set a new NEOS password', "use this link to set a new password:\n\n$url\n\nThe link is valid for $minuten minutes."]
            : ['Neues NEOS-Passwort setzen', "mit diesem Link setzt du ein neues Passwort:\n\n$url\n\nDer Link ist $minuten Minuten gültig."],
        'einladung' => $sprache === 'en'
            ? ['Your NEOS business account for ' . ($extra['firma'] ?? ''), "you have been invited to the NEOS customer portal of " . ($extra['firma'] ?? '') . ". Open this link to activate your access and set a password:\n\n$url\n\nThe link is valid for $tage days."]
            : ['Dein NEOS-Firmenzugang für ' . ($extra['firma'] ?? ''), "du wurdest zum NEOS-Kundenportal von " . ($extra['firma'] ?? '') . " eingeladen. Öffne diesen Link, um deinen Zugang zu aktivieren und ein Passwort zu setzen:\n\n$url\n\nDer Link ist $tage Tage gültig."],
        default => $sprache === 'en'
            ? ['Your NEOS sign-in link', "here is your sign-in link for the NEOS customer portal:\n\n$url\n\nThe link is valid for $minuten minutes and works once."]
            : ['Dein NEOS-Anmeldelink', "hier ist dein Anmeldelink für das NEOS-Kundenportal:\n\n$url\n\nDer Link ist $minuten Minuten gültig und funktioniert einmal."],
    };

    mailSenden((string) $kunde['email'], $betreff, $anrede . "\n\n" . $text . "\n\n" . $fuss);
}
