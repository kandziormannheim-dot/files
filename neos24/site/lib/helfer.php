<?php

/**
 * Gemeinsame Handgriffe für die PHP-Anwendungen der Seite (internes Dashboard
 * intern/, Kundenportal konto/): Maskierung, URLs, Umleitung, Hinweise, CSRF,
 * Geld- und Zeitformate, Blättern. saeubern() und begrenzungPruefen() kommen
 * aus api/revolut/_bootstrap.php.
 *
 * Erwartet von der einbindenden Anwendung: die Konstante APP_BASIS (URL-Pfad,
 * z. B. „/intern“) und eine Funktion fehlerSeite(int, string, string): never.
 */

declare(strict_types=1);

/** HTML-Ausgabe maskieren. */
function e(mixed $wert): string
{
    return htmlspecialchars((string) $wert, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Adresse innerhalb der Anwendung, z. B. url('bestellungen/NE-2026-…'). */
function url(string $pfad = '', array $abfrage = []): string
{
    $ziel = (defined('APP_BASIS') ? rtrim((string) APP_BASIS, '/') : '') . '/' . ltrim($pfad, '/');
    if ($abfrage !== []) {
        $ziel .= '?' . http_build_query($abfrage);
    }

    return $ziel;
}

/** Umleiten und beenden. */
function umleiten(string $ziel): never
{
    header('Location: ' . $ziel, true, 303);
    exit;
}

/** Hinweis für die nächste Seite in der Sitzung ablegen ('ok' oder 'fehler'). */
function hinweisSetzen(string $text, string $art = 'ok'): void
{
    $_SESSION['hinweis'] = ['text' => $text, 'art' => $art === 'fehler' ? 'fehler' : 'ok'];
}

/** Hinweis abholen und löschen. */
function hinweisHolen(): ?array
{
    $h = $_SESSION['hinweis'] ?? null;
    unset($_SESSION['hinweis']);

    return is_array($h) ? $h : null;
}

/** CSRF-Wert der Sitzung — bei Bedarf erzeugen. */
function csrfWert(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }

    return (string) $_SESSION['csrf'];
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
        fehlerSeite(403, 'Sitzung abgelaufen', 'Das Formular war zu lange offen oder die Sitzung ist abgelaufen. Bitte zurück und die Seite neu laden.');
    }
}

/** POST-Feld gesäubert lesen. */
function feld(string $name, int $max = 200): string
{
    return saeubern($_POST[$name] ?? '', $max);
}

/** Cent als „2,40 €“ (de) bzw. „€2.40“ (en). */
function euro(?int $cent, string $sprache = 'de'): string
{
    if ($cent === null) {
        return '—';
    }
    if ($sprache === 'en') {
        return '€' . number_format($cent / 100, 2, '.', ',');
    }

    return number_format($cent / 100, 2, ',', '.') . ' €';
}

/** Eingabe „2,40“ / „2.40“ / „2“ → Cent, sonst null. */
function centAusEingabe(string $eingabe): ?int
{
    $wert = str_replace([' ', '€'], '', trim($eingabe));
    $wert = str_replace(',', '.', $wert);
    if ($wert === '' || !preg_match('/^\d{1,6}(\.\d{1,2})?$/', $wert)) {
        return null;
    }

    return (int) round((float) $wert * 100);
}

/** ISO-Zeit (UTC) als „08.09.2026 14:35“ in deutscher Zeit (en: „08/09/2026 14:35“). */
function zeitAnzeigen(?string $zeit, string $sprache = 'de'): string
{
    if ($zeit === null || $zeit === '') {
        return '—';
    }
    try {
        $d = new DateTimeImmutable($zeit, new DateTimeZone('UTC'));
    } catch (Throwable) {
        return $zeit;
    }

    return $d->setTimezone(new DateTimeZone('Europe/Berlin'))->format($sprache === 'en' ? 'd/m/Y H:i' : 'd.m.Y H:i');
}

/** Nur das Datum. */
function datumAnzeigen(?string $zeit, string $sprache = 'de'): string
{
    $s = zeitAnzeigen($zeit, $sprache);

    return $s === '—' ? $s : substr($s, 0, 10);
}

/** Bestellstatus lesbar. */
function statusName(string $status, string $sprache = 'de'): string
{
    $de = [
        'offen' => 'Offen', 'angelegt' => 'Zahlung offen', 'autorisiert' => 'Autorisiert', 'bezahlt' => 'Bezahlt',
        'beauftragt' => 'Beauftragt', 'fehlgeschlagen' => 'Fehlgeschlagen', 'storniert' => 'Storniert',
    ];
    $en = [
        'offen' => 'Open', 'angelegt' => 'Payment pending', 'autorisiert' => 'Authorised', 'bezahlt' => 'Paid',
        'beauftragt' => 'Booked', 'fehlgeschlagen' => 'Failed', 'storniert' => 'Cancelled',
    ];

    return ($sprache === 'en' ? $en : $de)[$status] ?? ucfirst($status);
}

/** Status-Pille. */
function statusPille(string $status, ?string $text = null): string
{
    $text ??= statusName($status);

    return '<span class="status status--' . e($status) . '">' . e($text) . '</span>';
}

/** Seitenzahl aus ?seite= lesen. */
function seiteLesen(): int
{
    return max(1, (int) ($_GET['seite'] ?? 1));
}

/** Blätterleiste. */
function blaettern(int $seite, int $gesamt, int $proSeite, string $pfad, array $abfrage, string $sprache = 'de'): string
{
    $seiten = (int) ceil($gesamt / $proSeite);
    if ($seiten <= 1) {
        return '';
    }
    $html = '<nav class="blaettern" aria-label="Seiten">';
    if ($seite > 1) {
        $html .= '<a href="' . e(url($pfad, ['seite' => $seite - 1] + $abfrage)) . '">' . ($sprache === 'en' ? '‹ Back' : '‹ Zurück') . '</a>';
    }
    $html .= '<span>' . ($sprache === 'en' ? 'Page ' . $seite . ' of ' . $seiten : 'Seite ' . $seite . ' von ' . $seiten) . '</span>';
    if ($seite < $seiten) {
        $html .= '<a href="' . e(url($pfad, ['seite' => $seite + 1] + $abfrage)) . '">' . ($sprache === 'en' ? 'Next ›' : 'Weiter ›') . '</a>';
    }

    return $html . '</nav>';
}

/** Zufälliges Startpasswort: 14 Zeichen ohne verwechselbare. */
function passwortErzeugen(): string
{
    $zeichen = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $p = '';
    for ($i = 0; $i < 14; $i++) {
        $p .= $zeichen[random_int(0, strlen($zeichen) - 1)];
    }

    return $p;
}

/** Ist die Verbindung verschlüsselt? (Cookie-Flag Secure) */
function istHttps(): bool
{
    $https = (string) ($_SERVER['HTTPS'] ?? '');

    return ($https !== '' && $https !== 'off') || (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
