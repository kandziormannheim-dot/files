<?php

/**
 * Foto- und Unterschriftenverarbeitung.
 *
 * Hochgeladenes wird nie roh gespeichert: jedes Bild läuft durch GD und wird
 * als frisches JPEG neu kodiert. Damit sind eingebettete Nutzlasten und
 * EXIF-Daten (auch GPS-Positionen der Mieter!) zuverlässig weg, und die
 * Dateigröße bleibt im Rahmen. Alles liegt außerhalb des Webroots und wird
 * nur über den Foto-Endpunkt mit Rechteprüfung ausgeliefert.
 */

declare(strict_types=1);

const FOTO_MAX_BYTES = 12 * 1024 * 1024; // je Upload, vor der Neukodierung
const FOTO_MAX_KANTE = 1600;             // längste Kante nach der Neukodierung
const FOTOS_JE_SCHADEN = 6;

/**
 * Ein Upload-Feld (auch Mehrfach-Feld) in eine Liste von Einzeldateien
 * auflösen; fehlerhafte und leere Einträge fallen raus.
 *
 * @return array{tmp: string, groesse: int}[]
 */
function uploadsEinsammeln(string $feld): array
{
    $eintrag = $_FILES[$feld] ?? null;
    if (!is_array($eintrag)) {
        return [];
    }

    $namen = is_array($eintrag['tmp_name']) ? $eintrag['tmp_name'] : [$eintrag['tmp_name']];
    $fehler = is_array($eintrag['error']) ? $eintrag['error'] : [$eintrag['error']];
    $groessen = is_array($eintrag['size']) ? $eintrag['size'] : [$eintrag['size']];
    $originale = is_array($eintrag['name']) ? $eintrag['name'] : [$eintrag['name']];

    $dateien = [];
    foreach ($namen as $i => $tmp) {
        if (($fehler[$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string) $tmp)) {
            continue;
        }
        $dateien[] = [
            'tmp' => (string) $tmp,
            'groesse' => (int) ($groessen[$i] ?? 0),
            'name' => (string) ($originale[$i] ?? ''),
        ];
    }

    return array_slice($dateien, 0, FOTOS_JE_SCHADEN);
}

/**
 * Eine Rechnung (PDF oder Bild) in den Rechnungsordner übernehmen. Anders
 * als Fotos werden PDFs unverändert abgelegt — geprüft wird der echte
 * Dateityp, nicht die Endung. Liefert [gespeicherter Name, Anzeigename]
 * oder null bei unlesbarer Datei.
 *
 * @param array{tmp: string, groesse: int, name: string} $datei
 * @return array{0: string, 1: string}|null
 */
function rechnungUebernehmen(array $konfig, array $datei): ?array
{
    if ($datei['groesse'] <= 0 || $datei['groesse'] > FOTO_MAX_BYTES) {
        return null;
    }

    $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($datei['tmp']);
    $endung = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ][$mime] ?? null;
    if ($endung === null) {
        return null;
    }

    $name = 'rechnung-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.' . $endung;
    $ziel = datenPfad($konfig, 'rechnungen') . '/' . $name;
    if (!move_uploaded_file($datei['tmp'], $ziel)) {
        return null;
    }
    chmod($ziel, 0640);

    $anzeige = trim(preg_replace('/[^\p{L}\p{N} ._()-]/u', '', basename($datei['name'])) ?? '');

    return [$name, $anzeige !== '' ? mb_substr($anzeige, 0, 120) : $name];
}

/**
 * Ein Bild einlesen, verkleinern und als JPEG neu kodieren.
 * Liefert den Dateinamen im Fotoverzeichnis oder null bei unlesbarer Datei.
 */
function fotoUebernehmen(array $konfig, string $tmpPfad, int $groesse): ?string
{
    if ($groesse <= 0 || $groesse > FOTO_MAX_BYTES) {
        return null;
    }

    $info = @getimagesize($tmpPfad);
    if ($info === false) {
        return null;
    }
    $bild = match ($info[2]) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($tmpPfad),
        IMAGETYPE_PNG => @imagecreatefrompng($tmpPfad),
        IMAGETYPE_WEBP => @imagecreatefromwebp($tmpPfad),
        default => false,
    };
    if ($bild === false) {
        return null;
    }

    // Handy-Fotos kommen oft gedreht: die EXIF-Ausrichtung wird angewandt,
    // BEVOR die EXIF-Daten mit der Neukodierung verschwinden.
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data($tmpPfad);
        $bild = match ((int) ($exif['Orientation'] ?? 1)) {
            3 => imagerotate($bild, 180, 0),
            6 => imagerotate($bild, -90, 0),
            8 => imagerotate($bild, 90, 0),
            default => $bild,
        };
    }

    $breite = imagesx($bild);
    $hoehe = imagesy($bild);
    $faktor = min(1.0, FOTO_MAX_KANTE / max($breite, $hoehe));
    if ($faktor < 1.0) {
        $bild = imagescale($bild, (int) round($breite * $faktor), (int) round($hoehe * $faktor));
        if ($bild === false) {
            return null;
        }
    }

    $name = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.jpg';
    $ziel = datenPfad($konfig, 'fotos') . '/' . $name;
    if (!imagejpeg($bild, $ziel, 82)) {
        return null;
    }

    return $name;
}

/**
 * Unterschrift aus einer Canvas-Daten-URL (image/png) übernehmen. Das PNG
 * wird auf weißen Grund gelegt und als JPEG gespeichert — so kann FPDF es
 * ohne Transparenz-Sonderfälle einbetten.
 */
function unterschriftUebernehmen(array $konfig, string $datenUrl): ?string
{
    if (!str_starts_with($datenUrl, 'data:image/png;base64,')) {
        return null;
    }
    $roh = base64_decode(substr($datenUrl, strlen('data:image/png;base64,')), true);
    if ($roh === false || strlen($roh) > 2 * 1024 * 1024) {
        return null;
    }
    $bild = @imagecreatefromstring($roh);
    if ($bild === false) {
        return null;
    }

    $breite = imagesx($bild);
    $hoehe = imagesy($bild);
    $grund = imagecreatetruecolor($breite, $hoehe);
    imagefill($grund, 0, 0, imagecolorallocate($grund, 255, 255, 255));
    imagecopy($grund, $bild, 0, 0, 0, 0, $breite, $hoehe);

    $name = 'unterschrift-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.jpg';
    $ziel = datenPfad($konfig, 'unterschriften') . '/' . $name;
    if (!imagejpeg($grund, $ziel, 90)) {
        return null;
    }

    return $name;
}
