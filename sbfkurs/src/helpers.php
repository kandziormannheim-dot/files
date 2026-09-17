<?php

/**
 * Kleine Handgriffe: Ausgabe-Maskierung, Eingabe-Säuberung, Herkunftsprüfung,
 * CSRF-Schutz, Missbrauchsbremse, Datums- und Zahlenanzeige — übernommen aus
 * womo/src/helpers.php, dem gemeinsamen Muster der PHP-Anwendungen im Repo.
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

/** Datum JJJJ-MM-TT als TT.MM.JJJJ anzeigen. */
function datumAnzeigen(?string $datum): string
{
    if ($datum === null || $datum === '') {
        return '';
    }
    $zeit = strtotime(substr($datum, 0, 10));

    return $zeit === false ? $datum : date('d.m.Y', $zeit);
}

/** Anteil als ganze Prozentzahl, 0 bei leerer Grundmenge. */
function prozent(int|float $teil, int|float $ganz): int
{
    if ($ganz <= 0) {
        return 0;
    }

    return (int) round($teil / $ganz * 100);
}

/** Sekunden als „mm:ss“ bzw. „h:mm:ss“. */
function dauerAnzeigen(int $sekunden): string
{
    $sekunden = max(0, $sekunden);
    $h = intdiv($sekunden, 3600);
    $m = intdiv($sekunden % 3600, 60);
    $s = $sekunden % 60;

    return $h > 0 ? sprintf('%d:%02d:%02d', $h, $m, $s) : sprintf('%d:%02d', $m, $s);
}

/** Wert aus einer Zeichenkette in die Kennung eines Zeugnisses (src, ubi, …) prüfen. */
function zertifikatKennung(string $wert): ?string
{
    return preg_match('/^[a-z][a-z0-9-]{1,19}$/', $wert) === 1 ? $wert : null;
}

/** JSON-Datei lesen; leere/kaputte Datei liefert null. */
function jsonLesen(string $datei): ?array
{
    if (!is_file($datei)) {
        return null;
    }
    $daten = json_decode((string) file_get_contents($datei), true);

    return is_array($daten) ? $daten : null;
}

/** JSON hübsch und ohne Unicode-Maskierung schreiben. */
function jsonSchreiben(string $datei, array $daten): void
{
    file_put_contents(
        $datei,
        json_encode($daten, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n",
        LOCK_EX
    );
}
