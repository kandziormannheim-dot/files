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
 * --anhaengen behält die vorhandenen Fragen anderer Module (etwa den
 * Hauptkatalog), wenn ein zweiter Katalog mit eigenem Modul dazukommt
 * (SRC-Anpassungsprüfung); das Profil hebt dessen Nummern per nummerOffset
 * aus dem Nummernkreis des Hauptkatalogs heraus.
 *
 * Das Textlayout der PDFs ist von Ausgabe zu Ausgabe verschieden — deshalb
 * stecken alle Muster im Profil, nicht hier. Der Bericht (import-bericht.json
 * neben dem Ziel) macht Fehlparsing sichtbar, statt es zu verschlucken.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

$optionen = getopt('', ['profil:', 'pdf:', 'txt:', 'ziel:', 'zusammenfuehren', 'anhaengen', 'stand:']);
if (!isset($optionen['profil'], $optionen['ziel']) || (!isset($optionen['pdf']) && !isset($optionen['txt']))) {
    fwrite(STDERR, "Aufruf: --profil <json> (--pdf <datei> | --txt <datei>)… --ziel <fragen.json> [--zusammenfuehren] [--anhaengen] [--stand JJJJ-MM]\n");
    exit(2);
}

$profil = jsonLesen((string) $optionen['profil']);
if ($profil === null) {
    fwrite(STDERR, "Profil nicht lesbar: {$optionen['profil']}\n");
    exit(2);
}
$profil += ['kopfzeilen' => [], 'modulRegex' => '', 'modulZuordnung' => [], 'modulNachNummer' => [], 'module' => [], 'standardModul' => '', 'antwortenOhneKennung' => false, 'antwortenJeFrage' => 4, 'fortlaufend' => false, 'leerzeilenIgnorieren' => false, 'nummerOffset' => 0, 'bilder' => [], 'lektionJeModul' => [], 'richtigIstErste' => true, 'bildMarker' => [], 'entfernen' => [], 'ohneBild' => [], 'schall' => []];

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

/** Text aus der PDF holen: pdf-text.py (PyMuPDF), sonst pdftotext; fehlt beides, abbrechen. */
function textAusPdf(string $pdf): string
{
    if (!is_file($pdf)) {
        fwrite(STDERR, "PDF nicht gefunden: $pdf\n");
        exit(1);
    }
    $befehle = [
        // pdf-text.py (PyMuPDF) baut Zeilen aus den Wortpositionen und zieht
        // die in den Funk-Katalogen mittig neben dem Text stehenden Kennungen
        // vor die erste Zeile des Eintrags (siehe Kopf der Datei). pdftotext
        // ließe sie in der zweiten Zeile stehen, taugt aber für die
        // Inline-Kataloge (SBF) als Rückfall.
        ['python3', __DIR__ . '/pdf-text.py', $pdf],
        ['pdftotext', '-layout', '-enc', 'UTF-8', $pdf, '-'],
    ];
    foreach ($befehle as $befehl) {
        $prozess = @proc_open($befehl, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($prozess)) {
            continue;
        }
        $text = (string) stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        if (proc_close($prozess) === 0 && trim($text) !== '') {
            return $text;
        }
    }
    fwrite(STDERR, "Weder PyMuPDF (python3 -m pip install pymupdf) noch pdftotext (poppler-utils) verfügbar. Alternativ den Text anders extrahieren und mit --txt übergeben.\n");
    exit(1);
}

// ------------------------------------------------------ Zeilen normalisieren

/** Profil-Muster in einen fertigen PCRE-Ausdruck wandeln (Schrägstriche maskiert). */
function muster(string $regex, string $flags = 'u'): string
{
    return '/' . preg_replace('~(?<!\\\\)/~', '\\/', $regex) . '/' . $flags;
}

/**
 * Kopf-/Fußzeilen entfernen, Störtext streichen („entfernen“, z. B. die
 * Verweisnummern „[117]“ der Funk-Kataloge), Silbentrennung zusammenziehen,
 * Zeilen trimmen. Eine Zeile, die durch das Streichen leer wird, fällt weg —
 * sie darf keine Blockgrenze erzeugen.
 */
function zeilenNormalisieren(string $text, array $kopfzeilen, array $entfernen = []): array
{
    $zeilen = preg_split('/\R/u', str_replace("\f", "\n", $text)) ?: [];
    $ergebnis = [];
    foreach ($zeilen as $zeile) {
        $zeile = rtrim($zeile);
        foreach ($entfernen as $muster) {
            $gestrichen = preg_replace(muster($muster), '', $zeile);
            if ($gestrichen !== null && $gestrichen !== $zeile) {
                $zeile = rtrim($gestrichen);
                if (trim($zeile) === '') {
                    continue 2;
                }
            }
        }
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
    $letzteNr = 0;
    $lose = [];         // Zeilen nach einer Blockgrenze, noch nicht zugeordnet
    $bildMarker = implode('|', array_map(static fn (string $m): string => $m, $profil['bildMarker']));
    $jeFrage = (int) $profil['antwortenJeFrage'];

    $loseAnLetzteAntwort = static function () use (&$lose, &$aktuell, &$fragen): void {
        if ($lose === []) {
            return;
        }
        if ($aktuell !== null && $aktuell['antworten'] === []) {
            // Noch keine Antwort: lose Zeilen sind Fragetext (Nummer stand
            // allein auf der Zeile, der Text folgt nach einer Blockgrenze).
            $aktuell['text'] = trim($aktuell['text'] . ' ' . implode(' ', $lose));
        } elseif ($aktuell !== null) {
            $aktuell['antworten'][count($aktuell['antworten']) - 1] .= ' ' . implode(' ', $lose);
        } elseif ($fragen !== [] && $fragen[count($fragen) - 1]['antworten'] !== []) {
            $letzte = count($fragen) - 1;
            $n = count($fragen[$letzte]['antworten']) - 1;
            $fragen[$letzte]['antworten'][$n] .= ' ' . implode(' ', $lose);
        }
        $lose = [];
    };

    $abschliessen = static function () use (&$fragen, &$aktuell): void {
        if ($aktuell !== null) {
            $aktuell['text'] = trim(preg_replace('/\s+/u', ' ', $aktuell['text']) ?? $aktuell['text']);
            $aktuell['antworten'] = array_map(static fn (string $a): string => trim(preg_replace('/\s+/u', ' ', $a) ?? $a), $aktuell['antworten']);
            $fragen[] = $aktuell;
            $aktuell = null;
        }
    };

    foreach ($zeilen as $zeile) {
        if (trim($zeile) === '') {
            // Leerzeile: Fortsetzung endet. Mit leerzeilenIgnorieren gilt sie
            // als Blockgrenze — die folgenden losen Zeilen kommen in einen
            // Puffer und werden dem passenden Nachbarn zugeordnet: dem
            // Fragetext, wenn die nächste Frage ohne Text beginnt (die Nummer
            // steht in den Funk-Katalogen mittig neben mehrzeiligem Text),
            // sonst der vorigen Antwort (Seitenumbruch mitten in der Antwort).
            $ziel = $profil['leerzeilenIgnorieren'] ? 'lose' : null;
            continue;
        }
        if ($ziel === 'lose' && !preg_match(muster($profil['frageRegex']), $zeile) && !preg_match(muster($profil['antwortRegex']), $zeile)
            && !($profil['modulRegex'] !== '' && preg_match(muster($profil['modulRegex']), $zeile))) {
            $lose[] = trim($zeile);
            continue;
        }
        $istFrage = preg_match(muster($profil['frageRegex']), $zeile, $f) === 1;
        $istAntwort = $aktuell !== null && !$profil['antwortenOhneKennung'] && preg_match(muster($profil['antwortRegex']), $zeile, $a) === 1;
        if ($istFrage && $istAntwort) {
            // Inline-Kataloge nummerieren auch Antworten („1. …“): Die nächste
            // Antwortnummer der offenen Frage gewinnt, sonst ist es eine Frage.
            $nr = (int) $f[1];
            $istFrage = !($nr <= $jeFrage && $nr === count($aktuell['antworten']) + 1 && count($aktuell['antworten']) < $jeFrage);
            $istAntwort = !$istFrage;
        }
        // Frage vor Modul prüfen: „3. Welcher Kanal …“ sähe sonst wie eine
        // Überschrift aus. Überschriften tragen in den Katalogen keinen Punkt.
        // Fortlaufend nummerierte Kataloge: Nur die nächste Nummer eröffnet eine
        // Frage — eine Zeile „16.“ mitten in einer Antwort bleibt Antworttext.
        if ($istFrage && $profil['fortlaufend'] && (int) $f[1] !== $letzteNr + 1) {
            $istFrage = false;
        }
        if ($istFrage && (int) $f[1] > $letzteNr) {
            $text = trim($f[2] ?? '');
            if ($text === '' && $lose !== []) {
                $text = implode(' ', $lose);
                $lose = [];
            }
            $loseAnLetzteAntwort();
            $abschliessen();
            $letzteNr = (int) $f[1];
            $aktuell = ['nr' => $letzteNr, 'modul' => $modul, 'text' => $text, 'antworten' => [], 'bild' => false];
            $ziel = 'frage';
            continue;
        }
        if ($profil['modulRegex'] !== '' && preg_match(muster($profil['modulRegex']), $zeile, $t)) {
            $loseAnLetzteAntwort();
            $abschliessen();
            $schluessel = (string) $t[1];
            $modul = $profil['modulZuordnung'][$schluessel] ?? $modul;
            $ziel = null;
            continue;
        }
        if ($istAntwort) {
            $loseAnLetzteAntwort();
            $aktuell['antworten'][] = trim($a[2] ?? '');
            $ziel = 'antwort';
            continue;
        }
        if ($aktuell !== null) {
            $stueck = trim($zeile);
            if ($profil['antwortenOhneKennung'] && ($ziel === null || $ziel === 'antwort-neu')) {
                // Ohne Buchstabenkennung: jeder Absatz nach der Frage ist eine Antwort.
                $aktuell['antworten'][] = $stueck;
                $ziel = 'antwort';
                continue;
            }
            if ($ziel === 'frage') {
                $aktuell['text'] .= ' ' . $stueck;
            } elseif ($ziel === 'antwort' && $aktuell['antworten'] !== []) {
                $aktuell['antworten'][count($aktuell['antworten']) - 1] .= ' ' . $stueck;
            }
        }
    }
    $loseAnLetzteAntwort();
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

$zeilen = zeilenNormalisieren($text, $profil['kopfzeilen'], $profil['entfernen']);
$roh = katalogParsen($zeilen, $profil);
if ($roh === []) {
    fwrite(STDERR, "Keine Fragen erkannt — frageRegex im Profil prüfen. Erste Zeilen:\n" . implode("\n", array_slice($zeilen, 0, 15)) . "\n");
    exit(1);
}

$kennung = (string) $profil['zertifikat'];
$bisher = [];
$vorhanden = jsonLesen((string) $optionen['ziel']) ?? [];
if ((isset($optionen['zusammenfuehren']) || isset($optionen['anhaengen'])) && is_file((string) $optionen['ziel'])) {
    foreach ($vorhanden['fragen'] ?? [] as $f) {
        if (isset($f['id']) && empty($f['beispiel'])) {
            $bisher[$f['id']] = $f;
        }
    }
}

$bericht = ['fragen' => count($roh), 'module' => [], 'pruefen' => []];
$fragen = [];
$offset = (int) $profil['nummerOffset'];
foreach ($roh as $f) {
    $nr = $f['nr'] + $offset;
    $id = sprintf('%s-%03d', $kennung, $nr);
    $bild = $profil['bilder'][(string) $f['nr']] ?? $bisher[$id]['bild'] ?? null;
    $gruende = [];
    if (count($f['antworten']) !== 4) {
        $gruende[] = count($f['antworten']) . ' Antworten';
    }
    if ($f['bild'] && $bild === null && !in_array($f['nr'], array_map('intval', $profil['ohneBild']), true)) {
        // Bildmarker im Text, aber kein Bild zugeordnet — es sei denn, das
        // Profil bestätigt per „ohneBild“, dass die Frage ohne Bild auskommt.
        $gruende[] = 'Bildverweis';
    }
    if (mb_strlen($f['text']) < 15) {
        $gruende[] = 'kurzer Fragetext';
    }
    $eintrag = [
        'id' => $id,
        'nr' => $nr,
        'modul' => $f['modul'],
        'text' => $f['text'],
        'antworten' => $f['antworten'],
        'richtig' => $profil['richtigIstErste'] ? 0 : (int) ($bisher[$id]['richtig'] ?? 0),
        'bild' => $bild,
        // Schallsignal als Tonfolge (k = kurz, l = lang) — die Ansicht bietet
        // dazu einen „Anhören“-Knopf, die Grafik bleibt die Textfassung.
        'schall' => $profil['schall'][(string) $f['nr']] ?? $bisher[$id]['schall'] ?? null,
        'hinweis' => $bisher[$id]['hinweis'] ?? '',
        'lektion' => $bisher[$id]['lektion'] ?? ($profil['lektionJeModul'][$f['modul']] ?? null),
        'beispiel' => false,
    ];
    if ($gruende !== []) {
        $eintrag['pruefen'] = true;
        $bericht['pruefen'][$id] = $gruende;
    }
    $bericht['module'][$f['modul']] = ($bericht['module'][$f['modul']] ?? 0) + 1;
    $fragen[] = $eintrag;
}

$module = $profil['module'];
if (isset($optionen['anhaengen'])) {
    // Fragen anderer Module aus der vorhandenen Datei behalten, Modulliste vereinen.
    $neueModule = array_column($profil['module'], 'id');
    $behalten = [];
    foreach ($vorhanden['fragen'] ?? [] as $f) {
        if (empty($f['beispiel']) && !in_array($f['modul'] ?? '', $neueModule, true)) {
            $behalten[] = $f;
        }
    }
    $fragen = array_merge($behalten, $fragen);
    $bekannt = array_column($module, 'id');
    $alteModule = [];
    foreach ($vorhanden['module'] ?? [] as $m) {
        if (!in_array($m['id'], $bekannt, true)) {
            $alteModule[] = $m;
        }
    }
    $module = array_merge($alteModule, $module);
    usort($fragen, static fn (array $a, array $b): int => $a['nr'] <=> $b['nr']);
}

$quelle = ($profil['quelle'] ?? []) + ['name' => 'Import', 'stand' => (string) ($optionen['stand'] ?? date('Y-m')), 'amtlich' => true];
if (isset($optionen['stand'])) {
    $quelle['stand'] = (string) $optionen['stand'];
}
if (isset($optionen['anhaengen']) && !empty($vorhanden['quelle']['name'])) {
    // Der Hauptkatalog bleibt die Quelle; der angehängte Katalog wird unter
    // „ergaenzt“ genannt (Name, Stand), ohne den Hauptstand zu überschreiben.
    $ergaenzt = array_values(array_filter((array) ($vorhanden['quelle']['ergaenzt'] ?? []), static fn (array $q): bool => ($q['name'] ?? '') !== $quelle['name']));
    $ergaenzt[] = ['name' => $quelle['name'], 'stand' => $quelle['stand']];
    $quelle = $vorhanden['quelle'];
    $quelle['ergaenzt'] = $ergaenzt;
}
$katalog = [
    'zertifikat' => $kennung,
    'quelle' => $quelle,
    'module' => $module,
    'fragen' => $fragen,
];

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
