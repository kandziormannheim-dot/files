#!/usr/bin/env php
<?php

/**
 * Amtlichen Fragenkatalog importieren: PDF (oder bereits extrahierter Text)
 * → content/<zert>/fragen.json.
 *
 *   php sbfkurs/werkzeuge/katalog-import.php \
 *       --profil sbfkurs/werkzeuge/import-profile/elwis-src.json \
 *       --pdf ~/Downloads/Fragenkatalog-SRC.pdf   (oder --txt datei.txt) \
 *       --ziel sbfkurs/content/src/fragen.json \
 *       [--zusammenfuehren] [--stand 2023-08]
 *
 * --pdf und --txt dürfen mehrfach vorkommen — die SBF-Kataloge bestehen aus
 * getrennten Dateien (Basisfragen, spezifische Fragen), die in einer
 * fragen.json landen; die Fragennummern laufen dort durch.
 *
 * Das Textlayout der PDFs ist von Ausgabe zu Ausgabe verschieden — deshalb
 * stecken alle Muster im Profil, nicht hier. Der Bericht (import-bericht.json
 * neben dem Ziel) macht Fehlparsing sichtbar, statt es zu verschlucken.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

$optionen = getopt('', ['profil:', 'pdf:', 'txt:', 'ziel:', 'zusammenfuehren', 'stand:']);
if (!isset($optionen['profil'], $optionen['ziel']) || (!isset($optionen['pdf']) && !isset($optionen['txt']))) {
    fwrite(STDERR, "Aufruf: --profil <json> (--pdf <datei> | --txt <datei>)… --ziel <fragen.json> [--zusammenfuehren] [--stand JJJJ-MM]\n");
    exit(2);
}

$profil = jsonLesen((string) $optionen['profil']);
if ($profil === null) {
    fwrite(STDERR, "Profil nicht lesbar: {$optionen['profil']}\n");
    exit(2);
}
$profil += ['kopfzeilen' => [], 'modulRegex' => '', 'modulZuordnung' => [], 'modulNachNummer' => [], 'module' => [], 'standardModul' => '', 'antwortenOhneKennung' => false, 'richtigIstErste' => true, 'bildMarker' => []];

// ------------------------------------------------------------ Text holen

$text = '';
foreach ((array) ($optionen['txt'] ?? []) as $datei) {
    $text .= (string) file_get_contents((string) $datei) . "\n\n";
}
foreach ((array) ($optionen['pdf'] ?? []) as $datei) {
    $text .= textAusPdf((string) $datei) . "\n\n";
}
if (trim($text) === '') {
    fwrite(STDERR, "Kein Text gewonnen.\n");
    exit(1);
}

/** pdftotext -layout aufrufen; fehlt poppler, mit Hinweis abbrechen. */
function textAusPdf(string $pdf): string
{
    if (!is_file($pdf)) {
        fwrite(STDERR, "PDF nicht gefunden: $pdf\n");
        exit(1);
    }
    $prozess = proc_open(['pdftotext', '-layout', '-enc', 'UTF-8', $pdf, '-'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($prozess)) {
        fwrite(STDERR, "pdftotext nicht gefunden (Paket poppler-utils). Alternativ den Text anders extrahieren und mit --txt übergeben.\n");
        exit(1);
    }
    $text = (string) stream_get_contents($pipes[1]);
    $fehler = (string) stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($prozess) !== 0) {
        fwrite(STDERR, "pdftotext scheiterte: $fehler\n");
        exit(1);
    }

    return $text;
}

// ------------------------------------------------------ Zeilen normalisieren

/** Profil-Muster in einen fertigen PCRE-Ausdruck wandeln (Schrägstriche maskiert). */
function muster(string $regex, string $flags = 'u'): string
{
    return '/' . preg_replace('~(?<!\\\\)/~', '\\/', $regex) . '/' . $flags;
}

/** Kopf-/Fußzeilen entfernen, Silbentrennung zusammenziehen, Zeilen trimmen. */
function zeilenNormalisieren(string $text, array $kopfzeilen): array
{
    $zeilen = preg_split('/\R/u', str_replace("\f", "\n", $text)) ?: [];
    $ergebnis = [];
    foreach ($zeilen as $zeile) {
        $zeile = rtrim($zeile);
        $raus = false;
        foreach ($kopfzeilen as $muster) {
            if (preg_match(muster($muster, 'ui'), $zeile)) {
                $raus = true;
                break;
            }
        }
        if ($raus) {
            continue;
        }
        // Silbentrennung: „Funk-“ am Zeilenende + Kleinbuchstabe am Anfang der nächsten
        $letzte = count($ergebnis) - 1;
        if ($letzte >= 0 && preg_match('/\p{L}-$/u', $ergebnis[$letzte]) && preg_match('/^\s*\p{Ll}/u', $zeile)) {
            $ergebnis[$letzte] = substr($ergebnis[$letzte], 0, -1) . ltrim($zeile);
            continue;
        }
        $ergebnis[] = $zeile;
    }

    return $ergebnis;
}

// ------------------------------------------------------------------ Parsen

/**
 * Zustandsautomat: Modulüberschrift → Frage → Antworten. Fortsetzungszeilen
 * hängen sich an das zuletzt begonnene Element (Frage oder Antwort).
 */
function katalogParsen(array $zeilen, array $profil): array
{
    $fragen = [];
    $modul = $profil['standardModul'];
    $aktuell = null;    // laufende Frage
    $ziel = null;       // 'frage' | 'antwort'
    $bildMarker = implode('|', array_map(static fn (string $m): string => $m, $profil['bildMarker']));

    $abschliessen = static function () use (&$fragen, &$aktuell): void {
        if ($aktuell !== null) {
            $fragen[] = $aktuell;
            $aktuell = null;
        }
    };

    foreach ($zeilen as $zeile) {
        if (trim($zeile) === '') {
            // Leerzeile: Fortsetzung endet, Frage bleibt offen bis zur nächsten Frage.
            $ziel = null;
            continue;
        }
        // Frage vor Modul prüfen: „3. Welcher Kanal …“ sähe sonst wie eine
        // Überschrift aus. Überschriften tragen in den Katalogen keinen Punkt.
        if (preg_match(muster($profil['frageRegex']), $zeile, $t)) {
            $abschliessen();
            $aktuell = ['nr' => (int) $t[1], 'modul' => $modul, 'text' => trim($t[2]), 'antworten' => [], 'bild' => false];
            $ziel = 'frage';
            continue;
        }
        if ($profil['modulRegex'] !== '' && preg_match(muster($profil['modulRegex']), $zeile, $t)) {
            $abschliessen();
            $schluessel = (string) $t[1];
            $modul = $profil['modulZuordnung'][$schluessel] ?? $modul;
            $ziel = null;
            continue;
        }
        if ($aktuell !== null && !$profil['antwortenOhneKennung'] && preg_match(muster($profil['antwortRegex']), $zeile, $t)) {
            $aktuell['antworten'][] = trim($t[2]);
            $ziel = 'antwort';
            continue;
        }
        if ($aktuell !== null) {
            $stueck = trim($zeile);
            if ($profil['antwortenOhneKennung'] && $ziel !== 'frage-fortsetzung' && ($ziel === null || $ziel === 'antwort-neu')) {
                // Ohne Buchstabenkennung: jeder Absatz nach der Frage ist eine Antwort.
                $aktuell['antworten'][] = $stueck;
                $ziel = 'antwort';
                continue;
            }
            if ($ziel === 'frage' || $ziel === 'frage-fortsetzung') {
                $aktuell['text'] .= ' ' . $stueck;
                $ziel = $profil['antwortenOhneKennung'] ? 'frage' : 'frage';
            } elseif ($ziel === 'antwort' && $aktuell['antworten'] !== []) {
                $aktuell['antworten'][count($aktuell['antworten']) - 1] .= ' ' . $stueck;
            }
        }
    }
    $abschliessen();

    foreach ($fragen as &$f) {
        $f['bild'] = $bildMarker !== '' && preg_match(muster($bildMarker, 'ui'), $f['text'] . ' ' . implode(' ', $f['antworten'])) === 1;
        // Modul nach Fragennummer (SBF: 1–72 Basisfragen, danach spezifische
        // Fragen) schlägt die Überschriften-Erkennung.
        foreach ($profil['modulNachNummer'] as $bereich) {
            $ab = (int) ($bereich['ab'] ?? 1);
            $bis = (int) ($bereich['bis'] ?? PHP_INT_MAX);
            if ($f['nr'] >= $ab && $f['nr'] <= $bis) {
                $f['modul'] = (string) $bereich['modul'];
                break;
            }
        }
    }
    unset($f);

    return $fragen;
}

// ---------------------------------------------------------- Zusammenbauen

$zeilen = zeilenNormalisieren($text, $profil['kopfzeilen']);
$roh = katalogParsen($zeilen, $profil);
if ($roh === []) {
    fwrite(STDERR, "Keine Fragen erkannt — frageRegex im Profil prüfen. Erste Zeilen:\n" . implode("\n", array_slice($zeilen, 0, 15)) . "\n");
    exit(1);
}

$kennung = (string) $profil['zertifikat'];
$bisher = [];
if (isset($optionen['zusammenfuehren']) && is_file((string) $optionen['ziel'])) {
    foreach ((jsonLesen((string) $optionen['ziel']) ?? [])['fragen'] ?? [] as $f) {
        if (isset($f['id']) && empty($f['beispiel'])) {
            $bisher[$f['id']] = $f;
        }
    }
}

$bericht = ['fragen' => count($roh), 'module' => [], 'pruefen' => []];
$fragen = [];
foreach ($roh as $f) {
    $id = sprintf('%s-%03d', $kennung, $f['nr']);
    $gruende = [];
    if (count($f['antworten']) !== 4) {
        $gruende[] = count($f['antworten']) . ' Antworten';
    }
    if ($f['bild']) {
        $gruende[] = 'Bildverweis';
    }
    if (mb_strlen($f['text']) < 15) {
        $gruende[] = 'kurzer Fragetext';
    }
    $eintrag = [
        'id' => $id,
        'nr' => $f['nr'],
        'modul' => $f['modul'],
        'text' => $f['text'],
        'antworten' => $f['antworten'],
        'richtig' => $profil['richtigIstErste'] ? 0 : (int) ($bisher[$id]['richtig'] ?? 0),
        'bild' => $bisher[$id]['bild'] ?? null,
        'hinweis' => $bisher[$id]['hinweis'] ?? '',
        'lektion' => $bisher[$id]['lektion'] ?? null,
        'beispiel' => false,
    ];
    if ($gruende !== []) {
        $eintrag['pruefen'] = true;
        $bericht['pruefen'][$id] = $gruende;
    }
    $bericht['module'][$f['modul']] = ($bericht['module'][$f['modul']] ?? 0) + 1;
    $fragen[] = $eintrag;
}

$katalog = [
    'zertifikat' => $kennung,
    'quelle' => ($profil['quelle'] ?? []) + ['name' => 'Import', 'stand' => (string) ($optionen['stand'] ?? date('Y-m')), 'amtlich' => true],
    'module' => $profil['module'],
    'fragen' => $fragen,
];
if (isset($optionen['stand'])) {
    $katalog['quelle']['stand'] = (string) $optionen['stand'];
}

// -------------------------------------------------------- Prüfen, schreiben

$zielDatei = (string) $optionen['ziel'];
$zielVerzeichnis = dirname($zielDatei);
if (!is_dir($zielVerzeichnis)) {
    mkdir($zielVerzeichnis, 0775, true);
}
$vorlaeufig = $zielVerzeichnis . '/fragen.import.json';
jsonSchreiben($vorlaeufig, $katalog);
jsonSchreiben($zielVerzeichnis . '/import-bericht.json', $bericht);

// Validierung mit dem echten Inhaltsverzeichnis: Ziel probeweise ersetzen.
$konfig = ['inhalte' => dirname($zielVerzeichnis)];
$sicherung = is_file($zielDatei) ? (string) file_get_contents($zielDatei) : null;
copy($vorlaeufig, $zielDatei);
$befund = katalogPruefen($konfig, basename($zielVerzeichnis));
if ($befund['fehler'] !== []) {
    if ($sicherung !== null) {
        file_put_contents($zielDatei, $sicherung);
    } else {
        unlink($zielDatei);
    }
    fwrite(STDERR, "Import geparst, aber die Validierung meldet Fehler — Ergebnis liegt in $vorlaeufig, die alte Datei bleibt:\n");
    foreach ($befund['fehler'] as $fehler) {
        fwrite(STDERR, "  FEHLER  $fehler\n");
    }
    exit(1);
}
unlink($vorlaeufig);

printf("%d Fragen importiert nach %s\n", count($fragen), $zielDatei);
foreach ($bericht['module'] as $m => $n) {
    printf("  %-22s %4d\n", $m, $n);
}
if ($bericht['pruefen'] !== []) {
    printf("%d Fragen mit „pruefen“ markiert (siehe import-bericht.json):\n", count($bericht['pruefen']));
    foreach (array_slice($bericht['pruefen'], 0, 10, true) as $id => $gruende) {
        printf("  %s: %s\n", $id, implode(', ', $gruende));
    }
}
foreach ($befund['warnungen'] as $w) {
    echo "  Warnung  $w\n";
}
exit(0);
