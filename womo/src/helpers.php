<?php

/**
 * Kleine Handgriffe: Ausgabe-Maskierung, Eingabe-Säuberung, Herkunftsprüfung,
 * CSRF-Schutz und die Missbrauchsbremse — die Muster stammen aus
 * site/public/api/kontakt.php.
 */

declare(strict_types=1);

/** HTML-Ausgabe maskieren. */
function e(?string $wert): string
{
    return htmlspecialchars((string) $wert, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Steuerzeichen raus — sie sind der Hebel für eingeschmuggelte Kopfzeilen. */
function saeubern(mixed $wert): string
{
    if (!is_string($wert)) {
        return '';
    }
    $wert = str_replace(["\r\n", "\r"], "\n", $wert);
    $wert = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $wert) ?? '';

    return trim($wert);
}

/** Umleiten und beenden. */
function umleiten(string $ziel): never
{
    header('Location: ' . $ziel);
    exit;
}

/**
 * Stammt die Anfrage von der Seite selbst? Browser schicken bei POST immer
 * einen Origin-Kopf; verglichen wird gegen den eigenen Host, die Liste deckt
 * nur zusätzliche Namen ab.
 */
function herkunftErlaubt(string $herkunft, array $erlaubte): bool
{
    if ($herkunft === '' || $herkunft === 'null') {
        return $herkunft === ''; // Kein Kopf: etwa curl. Erlaubt.
    }
    if (in_array($herkunft, $erlaubte, true)) {
        return true;
    }

    $teile = parse_url($herkunft);
    if (!is_array($teile) || !isset($teile['host'])) {
        return false;
    }
    $autoritaet = $teile['host'] . (isset($teile['port']) ? ':' . $teile['port'] : '');

    return strcasecmp($autoritaet, (string) ($_SERVER['HTTP_HOST'] ?? '')) === 0;
}

/** POST-Anfragen ohne passende Herkunft abweisen. */
function herkunftErzwingen(array $konfig): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        return;
    }
    if (!herkunftErlaubt($_SERVER['HTTP_ORIGIN'] ?? '', $konfig['erlaubteHerkunft'])) {
        http_response_code(403);
        exit('Herkunft nicht erlaubt.');
    }
}

/** CSRF-Wert der Sitzung — bei Bedarf erzeugen. */
function csrfWert(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }

    return $_SESSION['csrf'];
}

/** Verstecktes CSRF-Feld für Formulare. */
function csrfFeld(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrfWert()) . '">';
}

/** CSRF-Wert einer POST-Anfrage prüfen; bei Fehlschlag abbrechen. */
function csrfPruefen(): void
{
    $wert = (string) ($_POST['csrf'] ?? '');
    if ($wert === '' || !hash_equals(csrfWert(), $wert)) {
        http_response_code(403);
        exit('Sitzung abgelaufen — bitte zurück und neu laden.');
    }
}

/**
 * Missbrauchsbremse je Absender und Zweck. Die IP wird nur als Streuwert mit
 * täglich wechselndem Salz abgelegt, nie im Klartext.
 */
function begrenzungPruefen(array $konfig, string $zweck): bool
{
    $spool = datenPfad($konfig, 'spool');

    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') {
        return true;
    }

    $schluessel = hash('sha256', $zweck . '|' . $ip . '|' . gmdate('Y-m-d') . '|' . (string) $konfig['salz']);
    $datei = $spool . '/' . $schluessel . '.json';
    $jetzt = time();
    $fenster = (int) $konfig['limit']['fenster'];

    // Gelegentlich aufräumen, damit das Verzeichnis nicht unbegrenzt wächst.
    if (random_int(1, 50) === 1) {
        foreach (glob($spool . '/*.json') ?: [] as $alt) {
            if (@filemtime($alt) < $jetzt - max($fenster, 86400)) {
                @unlink($alt);
            }
        }
    }

    $zeiten = [];
    if (is_file($datei)) {
        $inhalt = json_decode((string) @file_get_contents($datei), true);
        if (is_array($inhalt)) {
            $zeiten = array_filter(
                $inhalt,
                static fn ($z): bool => is_int($z) && $z > $jetzt - $fenster
            );
        }
    }

    if (count($zeiten) >= (int) $konfig['limit']['anfragen']) {
        return false;
    }

    $zeiten[] = $jetzt;
    @file_put_contents($datei, json_encode(array_values($zeiten)), LOCK_EX);

    return true;
}

/**
 * Die festen Fahrzeugzonen und Systeme; Schlüssel wandern in die Datenbank.
 * 'gruppe' teilt die Auswahl in Karosserie/Außen und Innenraum & Technik.
 */
function zonen(): array
{
    return [
        'front' => ['de' => 'Front', 'en' => 'Front', 'gruppe' => 'karosserie'],
        'heck' => ['de' => 'Heck', 'en' => 'Rear', 'gruppe' => 'karosserie'],
        'links' => ['de' => 'Seite links', 'en' => 'Left side', 'gruppe' => 'karosserie'],
        'rechts' => ['de' => 'Seite rechts', 'en' => 'Right side', 'gruppe' => 'karosserie'],
        'dach' => ['de' => 'Dach', 'en' => 'Roof', 'gruppe' => 'karosserie'],
        'unterboden' => ['de' => 'Unterboden', 'en' => 'Underbody', 'gruppe' => 'karosserie'],
        'abbauteile' => ['de' => 'Abbauteile außen', 'en' => 'Exterior attachments', 'gruppe' => 'karosserie'],
        'innenraum' => ['de' => 'Innenraum', 'en' => 'Interior', 'gruppe' => 'technik'],
        'elektronik' => ['de' => 'Elektronik', 'en' => 'Electronics', 'gruppe' => 'technik'],
        'heizung' => ['de' => 'Heizung', 'en' => 'Heating', 'gruppe' => 'technik'],
        'wasser' => ['de' => 'Wasser (Frischwasser)', 'en' => 'Water (fresh water)', 'gruppe' => 'technik'],
        'grauwasser' => ['de' => 'Grauwasser', 'en' => 'Grey water', 'gruppe' => 'technik'],
        'schwarzwasser' => ['de' => 'Schwarzwasser', 'en' => 'Black water', 'gruppe' => 'technik'],
        'internet' => ['de' => 'Internet (Starlink/LTE)', 'en' => 'Internet (Starlink/LTE)', 'gruppe' => 'technik'],
        'sonstiges' => ['de' => 'Sonstiges', 'en' => 'Other', 'gruppe' => 'karosserie'],
    ];
}

/** Die beiden Zonengruppen mit Anzeigenamen. */
function zonenGruppen(): array
{
    return [
        'karosserie' => ['de' => 'Karosserie / Außen', 'en' => 'Body / exterior'],
        'technik' => ['de' => 'Innenraum & Technik', 'en' => 'Interior & systems'],
    ];
}

/** Anzeigename einer Zone. */
function zonenName(string $zone, string $sprache = 'de'): string
{
    return zonen()[$zone][$sprache === 'en' ? 'en' : 'de'] ?? $zone;
}

/** Die Vorgangsarten: klassischer Schaden oder Werkstattauftrag (z. B. Nachrüstung). */
function typen(): array
{
    return [
        'schaden' => ['de' => 'Schaden', 'en' => 'Damage'],
        'werkstattauftrag' => ['de' => 'Werkstattauftrag', 'en' => 'Workshop order'],
    ];
}

/** Anzeigename einer Vorgangsart. */
function typName(string $typ, string $sprache = 'de'): string
{
    return typen()[$typ][$sprache === 'en' ? 'en' : 'de'] ?? $typ;
}

/** Vorgangsnummer aus Jahr der Erfassung und laufender Nummer, z. B. V-2026-0012. */
function vorgangsnummer(int $id, ?string $erstelltAm = null): string
{
    $jahr = substr((string) $erstelltAm, 0, 4);

    return 'V-' . (preg_match('/^\d{4}$/', $jahr) ? $jahr . '-' : '') . sprintf('%04d', $id);
}

/** Schadensstatus-Anzeigenamen. */
function statusName(string $status, string $sprache = 'de'): string
{
    $namen = [
        'offen' => ['de' => 'offen', 'en' => 'open'],
        'gemeldet' => ['de' => 'gemeldet', 'en' => 'reported'],
        'repariert' => ['de' => 'repariert', 'en' => 'repaired'],
    ];

    return $namen[$status][$sprache === 'en' ? 'en' : 'de'] ?? $status;
}

/** Betrag in Cent als Euro-Text, leere Werte als leere Zeichenkette. */
function euro(?int $cent): string
{
    if ($cent === null) {
        return '';
    }

    return number_format($cent / 100, 2, ',', '.') . ' €';
}

/** Euro-Eingabe („123,45“) in Cent; null bei leerer oder unlesbarer Eingabe. */
function centAusEingabe(string $eingabe): ?int
{
    $eingabe = trim(str_replace(['€', ' '], '', $eingabe));
    if ($eingabe === '') {
        return null;
    }
    $eingabe = str_replace('.', '', $eingabe);   // Tausenderpunkte
    $eingabe = str_replace(',', '.', $eingabe);  // Dezimalkomma
    if (!is_numeric($eingabe)) {
        return null;
    }

    return (int) round(((float) $eingabe) * 100);
}

/** Datum JJJJ-MM-TT als TT.MM.JJJJ anzeigen. */
function datumAnzeigen(?string $datum): string
{
    if ($datum === null || $datum === '') {
        return '';
    }
    $zeit = strtotime(substr($datum, 0, 10));

    return $zeit === false ? $datum : date('d.m.Y', $zeit);
}

/** Zeitstempel „JJJJ-MM-TT HH:MM:SS“ (UTC aus SQLite) als lokale Anzeige. */
function zeitAnzeigen(?string $zeit): string
{
    if ($zeit === null || $zeit === '') {
        return '';
    }
    try {
        $dt = new DateTimeImmutable($zeit . ' UTC');
    } catch (Exception) {
        return $zeit;
    }

    return $dt->setTimezone(new DateTimeZone('Europe/Berlin'))->format('d.m.Y H:i');
}
