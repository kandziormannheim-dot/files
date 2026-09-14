<?php

/**
 * Minimaler IMAP-Client über TLS-Socket (PHP 8.4 ohne imap-Erweiterung) und
 * ein MIME-Parser für Anhänge. Reicht für: ungelesene Mails holen, Anhänge
 * (PDF, CSV, XLSX) auslesen, Mail als gelesen markieren und in einen
 * „Verarbeitet“-Ordner kopieren. Nur LOGIN über TLS (Port 993).
 */

declare(strict_types=1);

class ImapVerbindung
{
    /** @var resource */
    private $s;
    private int $nr = 0;

    public function __construct(string $host, int $port = 993, int $zeitlimit = 20, bool $tls = true)
    {
        $s = @stream_socket_client(($tls ? 'ssl://' : 'tcp://') . $host . ':' . $port, $fehlerNr, $fehler, $zeitlimit, STREAM_CLIENT_CONNECT);
        if ($s === false) {
            throw new RuntimeException('IMAP-Verbindung: ' . $fehler);
        }
        stream_set_timeout($s, $zeitlimit);
        $this->s = $s;
        $gruss = $this->zeile();
        if (!str_starts_with($gruss, '* OK') && !str_starts_with($gruss, '* PREAUTH')) {
            throw new RuntimeException('IMAP-Begrüßung: ' . trim($gruss));
        }
    }

    private function zeile(): string
    {
        $z = fgets($this->s, 65536);
        if ($z === false) {
            throw new RuntimeException('IMAP: Verbindung abgebrochen');
        }

        return $z;
    }

    /** Befehl senden; liefert ['status' => OK|NO|BAD, 'zeilen' => [untagged], 'text' => Rohdaten inkl. Literale]. */
    public function befehl(string $befehl): array
    {
        $tag = 'A' . str_pad((string) ++$this->nr, 4, '0', STR_PAD_LEFT);
        if (fwrite($this->s, $tag . ' ' . $befehl . "\r\n") === false) {
            throw new RuntimeException('IMAP: Schreiben fehlgeschlagen');
        }
        $zeilen = [];
        $text = '';
        while (true) {
            $z = $this->zeile();
            // Literal {n} am Zeilenende: n Bytes roh nachlesen
            while (preg_match('/\{(\d+)\}\r?\n$/', $z, $m)) {
                $rest = (int) $m[1];
                $daten = '';
                while ($rest > 0) {
                    $teil = fread($this->s, min($rest, 65536));
                    if ($teil === false || $teil === '') {
                        throw new RuntimeException('IMAP: Literal unvollständig');
                    }
                    $daten .= $teil;
                    $rest -= strlen($teil);
                }
                $z .= $daten . $this->zeile();
            }
            if (str_starts_with($z, $tag . ' ')) {
                $status = preg_match('/^' . preg_quote($tag, '/') . ' (OK|NO|BAD)\b/i', $z, $m) ? strtoupper($m[1]) : 'BAD';
                if ($status !== 'OK') {
                    throw new RuntimeException('IMAP ' . strtok($befehl, ' ') . ': ' . trim(substr($z, strlen($tag) + 1)));
                }

                return ['status' => $status, 'zeilen' => $zeilen, 'text' => $text];
            }
            $zeilen[] = $z;
            $text .= $z;
        }
    }

    private static function quote(string $s): string
    {
        return '"' . addcslashes($s, "\\\"") . '"';
    }

    public function login(string $benutzer, string $passwort): void
    {
        $this->befehl('LOGIN ' . self::quote($benutzer) . ' ' . self::quote($passwort));
    }

    public function select(string $ordner): void
    {
        $this->befehl('SELECT ' . self::quote($ordner));
    }

    /** UIDs der ungelesenen Mails. */
    public function ungelesen(): array
    {
        $antwort = $this->befehl('UID SEARCH UNSEEN');
        foreach ($antwort['zeilen'] as $z) {
            if (preg_match('/^\* SEARCH\s*(.*)$/i', trim($z), $m)) {
                return array_values(array_filter(array_map('intval', preg_split('/\s+/', trim($m[1])) ?: [])));
            }
        }

        return [];
    }

    /** Rohe Mail (Kopf + Rumpf) einer UID, ohne sie als gelesen zu markieren. */
    public function holen(int $uid): string
    {
        $antwort = $this->befehl('UID FETCH ' . $uid . ' (BODY.PEEK[])');
        if (preg_match('/\{(\d+)\}\r?\n/', $antwort['text'], $m, PREG_OFFSET_CAPTURE)) {
            $start = $m[0][1] + strlen($m[0][0]);

            return substr($antwort['text'], $start, (int) $m[1][0]);
        }
        throw new RuntimeException('IMAP: Mail ' . $uid . ' ohne Inhalt');
    }

    public function gelesen(int $uid): void
    {
        $this->befehl('UID STORE ' . $uid . ' +FLAGS (\Seen)');
    }

    public function kopieren(int $uid, string $ordner): void
    {
        $this->befehl('UID COPY ' . $uid . ' ' . self::quote($ordner));
    }

    public function logout(): void
    {
        try {
            $this->befehl('LOGOUT');
        } catch (Throwable) {
        }
        fclose($this->s);
    }
}

// ------------------------------------------------------------------- MIME

/** Kopfzeilen (entfaltet, Kleinbuchstaben) und Rumpf einer MIME-Nachricht/eines Teils. */
function mimeKopfUndRumpf(string $roh): array
{
    $roh = str_replace("\r\n", "\n", $roh);
    $teile = explode("\n\n", $roh, 2);
    $kopfText = preg_replace('/\n[ \t]+/', ' ', $teile[0]) ?? $teile[0];
    $kopf = [];
    foreach (explode("\n", $kopfText) as $z) {
        if (preg_match('/^([A-Za-z0-9-]+):\s*(.*)$/', $z, $m)) {
            $kopf[strtolower($m[1])] = trim($m[2]);
        }
    }

    return [$kopf, $teile[1] ?? ''];
}

/** Parameter eines Kopfwerts, z. B. boundary="…" oder name="…" (auch RFC 2231 name*=). */
function mimeParameter(string $wert, string $name): string
{
    if (preg_match('/;\s*' . preg_quote($name, '/') . '\*?=\s*"([^"]*)"/i', $wert, $m) || preg_match('/;\s*' . preg_quote($name, '/') . '\*?=\s*([^;\s]+)/i', $wert, $m)) {
        $v = $m[1];
        if (preg_match('/^[a-z0-9-]+\'[a-z-]*\'(.*)$/i', $v, $r)) {
            $v = rawurldecode($r[1]);
        }

        return mimeWortDekodieren($v);
    }

    return '';
}

/** RFC-2047-Wörter (=?UTF-8?B?…?=) dekodieren. */
function mimeWortDekodieren(string $s): string
{
    if (!str_contains($s, '=?')) {
        return $s;
    }
    $d = @mb_decode_mimeheader($s);

    return $d !== false && $d !== '' ? $d : $s;
}

function mimeInhaltDekodieren(string $rumpf, string $kodierung): string
{
    return match (strtolower(trim($kodierung))) {
        'base64' => (string) base64_decode(preg_replace('/\s+/', '', $rumpf) ?? '', false),
        'quoted-printable' => quoted_printable_decode($rumpf),
        default => $rumpf,
    };
}

/**
 * Nachricht zerlegen: ['kopf' => [...], 'text' => Klartext, 'anhaenge' => [['name', 'typ', 'inhalt']]].
 */
function mimeZerlegen(string $roh): array
{
    [$kopf, $rumpf] = mimeKopfUndRumpf($roh);
    $aus = ['kopf' => $kopf, 'text' => '', 'anhaenge' => []];
    mimeTeilSammeln($kopf, $rumpf, $aus);

    return $aus;
}

function mimeTeilSammeln(array $kopf, string $rumpf, array &$aus): void
{
    $typ = strtolower(trim(strtok($kopf['content-type'] ?? 'text/plain', ';') ?: 'text/plain'));
    if (str_starts_with($typ, 'multipart/')) {
        $grenze = mimeParameter($kopf['content-type'] ?? '', 'boundary');
        if ($grenze === '') {
            return;
        }
        $stuecke = preg_split('/\n--' . preg_quote($grenze, '/') . '(?:--)?[ \t]*\n?/', "\n" . $rumpf) ?: [];
        foreach (array_slice($stuecke, 1) as $stueck) {
            if (trim($stueck) === '' || str_starts_with(trim($stueck), '--')) {
                continue;
            }
            [$k, $r] = mimeKopfUndRumpf(ltrim($stueck, "\n"));
            mimeTeilSammeln($k, $r, $aus);
        }

        return;
    }
    $inhalt = mimeInhaltDekodieren($rumpf, $kopf['content-transfer-encoding'] ?? '7bit');
    $name = mimeParameter($kopf['content-disposition'] ?? '', 'filename') ?: mimeParameter($kopf['content-type'] ?? '', 'name');
    $anhang = $name !== '' || str_starts_with(strtolower($kopf['content-disposition'] ?? ''), 'attachment');
    if ($anhang) {
        $aus['anhaenge'][] = ['name' => $name !== '' ? basename($name) : 'anhang', 'typ' => $typ, 'inhalt' => $inhalt];
    } elseif ($typ === 'text/plain' && $aus['text'] === '') {
        $zeichensatz = mimeParameter($kopf['content-type'] ?? '', 'charset');
        $aus['text'] = $zeichensatz !== '' && strtoupper($zeichensatz) !== 'UTF-8' ? (string) @mb_convert_encoding($inhalt, 'UTF-8', $zeichensatz) : $inhalt;
    }
}

/** Absenderadresse (klein) aus einem From-Kopf. */
function mimeAbsender(string $from): string
{
    if (preg_match('/<([^>]+)>/', $from, $m)) {
        return mb_strtolower(trim($m[1]));
    }

    return mb_strtolower(trim($from, " \t\"'"));
}
