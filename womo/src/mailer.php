<?php

/**
 * Mailversand — der SMTP-Kern stammt aus site/public/api/kontakt.php,
 * erweitert um mehrere Empfänger und PDF-Anhänge (multipart/mixed).
 *
 * transport '' schreibt Mails nur ins Serverprotokoll — für die lokale
 * Entwicklung, damit Abläufe ohne Postfach durchspielbar sind.
 */

declare(strict_types=1);

const MAIL_ZEILE = "\r\n";

/** Kopfzeilenwert nach RFC 2047 kodieren, wenn er nicht rein ASCII ist. */
function kopfKodieren(string $wert): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $wert) === 1) {
        return $wert;
    }

    return '=?UTF-8?B?' . base64_encode($wert) . '?=';
}

/**
 * Mail bauen und verschicken.
 *
 * @param string[] $empfaenger  Zieladressen (mindestens eine)
 * @param array{name: string, inhalt: string}[] $anhaenge  PDF-Anhänge
 */
function mailSenden(
    array $konfig,
    array $empfaenger,
    string $betreff,
    string $text,
    array $anhaenge = [],
    string $antwortAn = ''
): void {
    $empfaenger = array_values(array_filter(array_map('trim', $empfaenger)));
    if ($empfaenger === [] || $konfig['absender'] === '') {
        return;
    }

    $domaene = substr(strrchr((string) $konfig['absender'], '@') ?: '@lokal', 1);

    $kopf = [
        'From: ' . kopfKodieren((string) $konfig['absenderName']) . ' <' . $konfig['absender'] . '>',
        'To: ' . implode(', ', array_map(static fn (string $a): string => '<' . $a . '>', $empfaenger)),
        'Subject: ' . kopfKodieren($betreff),
        'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domaene . '>',
        'MIME-Version: 1.0',
        'Auto-Submitted: auto-generated',
    ];
    if ($antwortAn !== '') {
        $kopf[] = 'Reply-To: <' . $antwortAn . '>';
    }

    $textTeil = 'Content-Type: text/plain; charset=UTF-8' . MAIL_ZEILE
        . 'Content-Transfer-Encoding: base64' . MAIL_ZEILE . MAIL_ZEILE
        . chunk_split(base64_encode($text), 76, MAIL_ZEILE);

    if ($anhaenge === []) {
        $kopf[] = 'Content-Type: text/plain; charset=UTF-8';
        $kopf[] = 'Content-Transfer-Encoding: base64';
        $rumpf = chunk_split(base64_encode($text), 76, MAIL_ZEILE);
    } else {
        $grenze = 'grenze-' . bin2hex(random_bytes(12));
        $kopf[] = 'Content-Type: multipart/mixed; boundary="' . $grenze . '"';
        $teile = ['--' . $grenze . MAIL_ZEILE . $textTeil];
        foreach ($anhaenge as $anhang) {
            $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $anhang['name']) ?: 'anhang.pdf';
            $teile[] = '--' . $grenze . MAIL_ZEILE
                . 'Content-Type: application/pdf; name="' . $name . '"' . MAIL_ZEILE
                . 'Content-Disposition: attachment; filename="' . $name . '"' . MAIL_ZEILE
                . 'Content-Transfer-Encoding: base64' . MAIL_ZEILE . MAIL_ZEILE
                . chunk_split(base64_encode($anhang['inhalt']), 76, MAIL_ZEILE);
        }
        $teile[] = '--' . $grenze . '--' . MAIL_ZEILE;
        $rumpf = implode('', $teile);
    }

    $rohmail = implode(MAIL_ZEILE, $kopf) . MAIL_ZEILE . MAIL_ZEILE . $rumpf;

    $transport = (string) ($konfig['transport'] ?? 'smtp');
    if ($transport === '') {
        error_log('[womo] Mail (nicht versandt, transport leer): an '
            . implode(', ', $empfaenger) . ' — ' . $betreff);

        return;
    }
    if ($transport === 'mail') {
        perMailFunktionSenden($konfig, $empfaenger, $betreff, $rohmail);

        return;
    }
    perSmtpSenden($konfig, $empfaenger, $rohmail);
}

/** Eine SMTP-Antwort lesen; mehrzeilige Antworten werden zusammengefasst. */
function smtpLesen($verbindung, array $erwartet, string $schritt): void
{
    $antwort = '';
    while (($zeile = fgets($verbindung, 8192)) !== false) {
        $antwort .= $zeile;
        if (strlen($zeile) < 4 || $zeile[3] !== '-') {
            break;
        }
    }
    if ($antwort === '') {
        throw new RuntimeException($schritt . ': keine Antwort');
    }
    if (!in_array((int) substr($antwort, 0, 3), $erwartet, true)) {
        throw new RuntimeException($schritt . ': ' . trim($antwort));
    }
}

function smtpSchreiben($verbindung, string $befehl): void
{
    if (fwrite($verbindung, $befehl . MAIL_ZEILE) === false) {
        throw new RuntimeException('Schreiben fehlgeschlagen');
    }
}

/** @param string[] $empfaenger */
function perSmtpSenden(array $konfig, array $empfaenger, string $rohmail): void
{
    $s = $konfig['smtp'];
    $zeitlimit = (int) ($s['zeitlimit'] ?? 15);
    $schema = ($s['verschluesselung'] ?? 'starttls') === 'tls' ? 'ssl://' : 'tcp://';

    $verbindung = @stream_socket_client(
        $schema . $s['host'] . ':' . (int) $s['port'],
        $nummer,
        $meldung,
        $zeitlimit,
        STREAM_CLIENT_CONNECT
    );
    if ($verbindung === false) {
        throw new RuntimeException('Verbindung: ' . $meldung);
    }
    stream_set_timeout($verbindung, $zeitlimit);

    try {
        smtpLesen($verbindung, [220], 'Begrüßung');
        smtpSchreiben($verbindung, 'EHLO ' . gethostname());
        smtpLesen($verbindung, [250], 'EHLO');

        if (($s['verschluesselung'] ?? 'starttls') === 'starttls') {
            smtpSchreiben($verbindung, 'STARTTLS');
            smtpLesen($verbindung, [220], 'STARTTLS');
            if (!stream_socket_enable_crypto(
                $verbindung,
                true,
                STREAM_CRYPTO_METHOD_TLS_CLIENT
            )) {
                throw new RuntimeException('TLS-Aufbau fehlgeschlagen');
            }
            smtpSchreiben($verbindung, 'EHLO ' . gethostname());
            smtpLesen($verbindung, [250], 'EHLO nach TLS');
        }

        if (($s['benutzer'] ?? '') !== '') {
            smtpSchreiben($verbindung, 'AUTH PLAIN ' . base64_encode(
                "\0" . $s['benutzer'] . "\0" . $s['passwort']
            ));
            smtpLesen($verbindung, [235], 'Anmeldung');
        }

        smtpSchreiben($verbindung, 'MAIL FROM:<' . $konfig['absender'] . '>');
        smtpLesen($verbindung, [250], 'MAIL FROM');
        foreach ($empfaenger as $adresse) {
            smtpSchreiben($verbindung, 'RCPT TO:<' . $adresse . '>');
            smtpLesen($verbindung, [250, 251], 'RCPT TO');
        }
        smtpSchreiben($verbindung, 'DATA');
        smtpLesen($verbindung, [354], 'DATA');

        // Punkt am Zeilenanfang verdoppeln, sonst endet die Mail dort.
        $sicher = preg_replace('/^\./m', '..', $rohmail) ?? $rohmail;
        smtpSchreiben($verbindung, $sicher . MAIL_ZEILE . '.');
        smtpLesen($verbindung, [250], 'Übergabe');

        smtpSchreiben($verbindung, 'QUIT');
    } finally {
        fclose($verbindung);
    }
}

/** @param string[] $empfaenger */
function perMailFunktionSenden(array $konfig, array $empfaenger, string $betreff, string $rohmail): void
{
    [$kopfteil, $koerper] = explode(MAIL_ZEILE . MAIL_ZEILE, $rohmail, 2);
    $rest = [];
    foreach (explode(MAIL_ZEILE, $kopfteil) as $zeile) {
        if (str_starts_with($zeile, 'Subject: ') || str_starts_with($zeile, 'To: ')) {
            continue;
        }
        $rest[] = $zeile;
    }
    if (!mail(implode(', ', $empfaenger), kopfKodieren($betreff), $koerper, implode(MAIL_ZEILE, $rest))) {
        throw new RuntimeException('mail() lehnte die Nachricht ab');
    }
}
