<?php

/**
 * Kleine Handgriffe für die Ansichten und Aktionen: Maskierung, URLs,
 * Umleitung, Hinweise, CSRF, Geld- und Zeitformate, Protokoll.
 * saeubern() und begrenzungPruefen() kommen aus dem Revolut-Unterbau.
 */

declare(strict_types=1);

/** HTML-Ausgabe maskieren. */
function e(mixed $wert): string
{
    return htmlspecialchars((string) $wert, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Adresse innerhalb des Dashboards, z. B. url('bestellungen/NE-2026-…'). */
function url(string $pfad = '', array $abfrage = []): string
{
    $ziel = internBasis() . '/' . ltrim($pfad, '/');
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

/** Cent als „2,40 €“. */
function euro(?int $cent): string
{
    if ($cent === null) {
        return '—';
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

/** ISO-Zeit (UTC) als „08.09.2026 14:35“ in deutscher Zeit. */
function zeitAnzeigen(?string $zeit): string
{
    if ($zeit === null || $zeit === '') {
        return '—';
    }
    try {
        $d = new DateTimeImmutable($zeit, new DateTimeZone('UTC'));
    } catch (Throwable) {
        return $zeit;
    }

    return $d->setTimezone(new DateTimeZone('Europe/Berlin'))->format('d.m.Y H:i');
}

/** Nur das Datum. */
function datumAnzeigen(?string $zeit): string
{
    $s = zeitAnzeigen($zeit);

    return $s === '—' ? $s : substr($s, 0, 10);
}

/** Bestellstatus lesbar. */
function statusName(string $status): string
{
    return match ($status) {
        'offen' => 'Offen',
        'angelegt' => 'Zahlung offen',
        'autorisiert' => 'Autorisiert',
        'bezahlt' => 'Bezahlt',
        'fehlgeschlagen' => 'Fehlgeschlagen',
        'storniert' => 'Storniert',
        default => ucfirst($status),
    };
}

/** Anfragestatus lesbar. */
function anfrageStatusName(string $status): string
{
    return match ($status) {
        'neu' => 'Neu',
        'in_bearbeitung' => 'In Bearbeitung',
        'konto_angelegt' => 'Konto angelegt',
        'erledigt' => 'Erledigt',
        default => ucfirst($status),
    };
}

/** Status-Pille. */
function statusPille(string $status, ?string $text = null): string
{
    $text ??= statusName($status);

    return '<span class="status status--' . e($status) . '">' . e($text) . '</span>';
}

/** Änderung ins Protokoll schreiben (wer, wann, was). */
function protokollieren(string $aktion, string $objekt = '', string|int $objektId = '', array $details = [], ?array $wer = null): void
{
    $b = $wer ?? (function_exists('benutzerAktuell') ? benutzerAktuell() : null);
    try {
        datenbank()->prepare('INSERT INTO protokoll (benutzer_id, benutzer_name, aktion, objekt, objekt_id, details_json, zeit) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$b['id'] ?? null, (string) ($b['name'] ?? 'system'), $aktion, $objekt, (string) $objektId, json_encode($details, JSON_UNESCAPED_UNICODE), jetzt()]);
    } catch (Throwable $e) {
        error_log('[intern] Protokoll: ' . $e->getMessage());
    }
}

/** Seitenzahl aus ?seite= lesen. */
function seiteLesen(): int
{
    return max(1, (int) ($_GET['seite'] ?? 1));
}

/** Blätterleiste. */
function blaettern(int $seite, int $gesamt, int $proSeite, string $pfad, array $abfrage): string
{
    $seiten = (int) ceil($gesamt / $proSeite);
    if ($seiten <= 1) {
        return '';
    }
    $html = '<nav class="blaettern" aria-label="Seiten">';
    if ($seite > 1) {
        $html .= '<a href="' . e(url($pfad, ['seite' => $seite - 1] + $abfrage)) . '">‹ Zurück</a>';
    }
    $html .= '<span>Seite ' . $seite . ' von ' . $seiten . '</span>';
    if ($seite < $seiten) {
        $html .= '<a href="' . e(url($pfad, ['seite' => $seite + 1] + $abfrage)) . '">Weiter ›</a>';
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
