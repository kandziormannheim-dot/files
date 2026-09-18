<?php

/**
 * Inhalte laden und prüfen: Zertifikate, Lektionen, Fragenkataloge, Bögen,
 * Übungen. Alles kommt aus content/<zert>/ als JSON und Markdown; dieselbe
 * Validierung (katalogPruefen) läuft im Import, auf der Admin-Seite
 * „Inhalte“ und in den Tests.
 */

declare(strict_types=1);

/** Alle Zertifikate, nach 'reihenfolge' sortiert; optional nur freigeschaltete. */
function zertifikateLaden(array $konfig, bool $nurFreigeschaltete = false): array
{
    $liste = [];
    foreach (glob(inhaltePfad($konfig) . '/*/zertifikat.json') ?: [] as $datei) {
        $z = jsonLesen($datei);
        if ($z === null || !isset($z['id']) || basename(dirname($datei)) !== $z['id']) {
            continue;
        }
        if ($nurFreigeschaltete && empty($z['freigeschaltet'])) {
            continue;
        }
        $liste[$z['id']] = zertifikatNormieren($z);
    }
    uasort($liste, static fn (array $a, array $b): int => $a['reihenfolge'] <=> $b['reihenfolge']);

    return $liste;
}

/** Ein Zertifikat; null, wenn unbekannt. */
function zertifikatLaden(array $konfig, string $kennung): ?array
{
    if (zertifikatKennung($kennung) === null) {
        return null;
    }
    $z = jsonLesen(inhaltePfad($konfig) . "/$kennung/zertifikat.json");

    return $z === null || ($z['id'] ?? '') !== $kennung ? null : zertifikatNormieren($z);
}

/** Fehlende Schlüssel mit Vorgaben füllen, damit Views nicht prüfen müssen. */
function zertifikatNormieren(array $z): array
{
    $z += ['titel' => $z['id'], 'kurz' => '', 'reihenfolge' => 99, 'freigeschaltet' => false, 'praxis' => []];
    $z['trainer'] = ($z['trainer'] ?? []) + ['sicherAb' => 2];
    $z['pruefung'] = ($z['pruefung'] ?? []) + [
        'fragenProBogen' => 20,
        'zeitMinuten' => 30,
        'mindestRichtig' => 15,
        'fragenMischen' => true,
        'antwortenMischen' => true,
        'amtlicheBoegen' => null,
        'zusammensetzung' => [],
        'mindestRichtigJeModul' => [],
        'weitereTeile' => [],
    ];

    return $z;
}

/** Geordnete Lektionsliste eines Zertifikats. */
function lektionenLaden(array $konfig, string $kennung): array
{
    $index = jsonLesen(inhaltePfad($konfig) . "/$kennung/lektionen.json");
    $liste = [];
    foreach ($index['lektionen'] ?? [] as $l) {
        if (!isset($l['slug']) || !preg_match('/^[a-z0-9][a-z0-9-]*$/', (string) $l['slug'])) {
            continue;
        }
        $liste[$l['slug']] = $l + ['titel' => $l['slug'], 'kurz' => '', 'dauerMin' => 0, 'module' => []];
    }

    return $liste;
}

/**
 * Eine Lektion samt gerendertem Inhalt. Der Slug wird nur akzeptiert, wenn
 * er im Index steht — kein Pfad aus der URL erreicht das Dateisystem.
 */
function lektionLaden(array $konfig, string $kennung, string $slug): ?array
{
    $lektionen = lektionenLaden($konfig, $kennung);
    if (!isset($lektionen[$slug])) {
        return null;
    }
    $basis = inhaltePfad($konfig) . "/$kennung/lektionen/$slug";
    $lektion = $lektionen[$slug];
    $slugs = array_keys($lektionen);
    $pos = array_search($slug, $slugs, true);
    $lektion['position'] = (int) $pos + 1;
    $lektion['anzahl'] = count($slugs);
    $lektion['vorher'] = $pos > 0 ? $lektionen[$slugs[$pos - 1]] : null;
    $lektion['nachher'] = $pos < count($slugs) - 1 ? $lektionen[$slugs[$pos + 1]] : null;

    if (is_file("$basis.md")) {
        $text = (string) file_get_contents("$basis.md");
        $lektion['html'] = markdownRendern($text, "/bild/$kennung/");
        $lektion['ueberschriften'] = markdownUeberschriften($text);
    } elseif (is_file("$basis.php")) {
        ob_start();
        require "$basis.php";
        $lektion['html'] = (string) ob_get_clean();
        $lektion['ueberschriften'] = [];
    } else {
        return null;
    }

    return $lektion;
}

/** Fragenkatalog eines Zertifikats; Fragen nach id indiziert. */
function fragenLaden(array $konfig, string $kennung): array
{
    $katalog = jsonLesen(inhaltePfad($konfig) . "/$kennung/fragen.json") ?? [];
    $katalog += ['zertifikat' => $kennung, 'quelle' => [], 'module' => [], 'fragen' => []];
    $katalog['quelle'] += ['name' => 'unbekannt', 'stand' => '', 'amtlich' => false];
    $nachId = [];
    foreach ($katalog['fragen'] as $frage) {
        if (isset($frage['id'])) {
            $nachId[$frage['id']] = $frage + ['bild' => null, 'bildText' => '', 'schall' => null, 'hinweis' => '', 'lektion' => null, 'beispiel' => false, 'pruefen' => false];
        }
    }
    $katalog['fragen'] = $nachId;
    $katalog['beispielhaft'] = !$katalog['quelle']['amtlich']
        || array_filter($nachId, static fn (array $f): bool => !empty($f['beispiel'])) !== [];

    return $katalog;
}

/**
 * Textfassung eines Fragebilds für das alt-Attribut: „bildText“ der Frage,
 * sonst der <title> der SVG-Datei (die selbst gezeichneten Grafiken tragen
 * ihre Beschreibung dort), sonst ein allgemeiner Hinweis.
 */
function bildAltText(array $konfig, string $kennung, array $frage): string
{
    if (trim((string) ($frage['bildText'] ?? '')) !== '') {
        return trim((string) $frage['bildText']);
    }
    $datei = basename((string) ($frage['bild'] ?? ''));
    if ($datei !== '' && str_ends_with(strtolower($datei), '.svg')) {
        $pfad = inhaltePfad($konfig) . "/$kennung/bilder/$datei";
        $kopf = is_file($pfad) ? (string) file_get_contents($pfad, false, null, 0, 2000) : '';
        if (preg_match('#<title[^>]*>(.*?)</title>#s', $kopf, $t)) {
            return trim(html_entity_decode($t[1], ENT_QUOTES | ENT_XML1, 'UTF-8'));
        }
    }

    return 'Abbildung zur Frage';
}

/** Amtliche Bögen, falls vorhanden; leere Liste sonst. */
function boegenLaden(array $konfig, string $kennung, array $zertifikat): array
{
    $datei = $zertifikat['pruefung']['amtlicheBoegen'] ?? null;
    if (!is_string($datei) || $datei === '' || str_contains($datei, '/')) {
        return [];
    }
    $daten = jsonLesen(inhaltePfad($konfig) . "/$kennung/$datei");
    $boegen = [];
    foreach ($daten['boegen'] ?? [] as $bogen) {
        if (isset($bogen['nr'], $bogen['fragen']) && is_array($bogen['fragen'])) {
            $boegen[(int) $bogen['nr']] = array_map('intval', $bogen['fragen']);
        }
    }
    ksort($boegen);

    return $boegen;
}

/** Übungen eines Praxismoduls (funkverkehr | englisch | diktat), nach id indiziert. */
function uebungenLaden(array $konfig, string $kennung, string $modul): array
{
    if (!in_array($modul, ['funkverkehr', 'englisch', 'diktat'], true)) {
        return [];
    }
    $daten = jsonLesen(inhaltePfad($konfig) . "/$kennung/uebungen/$modul.json");
    $liste = [];
    foreach ($daten['uebungen'] ?? [] as $u) {
        if (isset($u['id']) && preg_match('/^[a-z0-9][a-z0-9-]*$/', (string) $u['id'])) {
            $liste[$u['id']] = $u;
        }
    }

    return $liste;
}

/** Buchstabiertafel aus content/gemeinsam. */
function buchstabiertafelLaden(array $konfig): array
{
    $daten = jsonLesen(inhaltePfad($konfig) . '/gemeinsam/buchstabiertafel.json') ?? [];

    return $daten + ['buchstaben' => [], 'ziffern' => [], 'varianten' => [], 'woerter' => []];
}

/** DSC-Szenarien aus content/dsc. */
function dscSzenarienLaden(array $konfig): array
{
    $daten = jsonLesen(inhaltePfad($konfig) . '/dsc/szenarien.json') ?? [];

    return $daten + ['geraet' => [], 'szenarien' => []];
}

/** Rechtstext (impressum | datenschutz) als HTML; null, wenn nicht vorhanden. */
function rechtstextLaden(array $konfig, string $name): ?string
{
    $datei = inhaltePfad($konfig) . "/gemeinsam/rechtliches/$name.md";

    return is_file($datei) ? markdownRendern((string) file_get_contents($datei)) : null;
}

/**
 * Katalog und Regeln eines Zertifikats prüfen. Liefert
 * ['fehler' => [...], 'warnungen' => [...]] mit Klartextmeldungen.
 */
function katalogPruefen(array $konfig, string $kennung): array
{
    $fehler = [];
    $warnungen = [];
    $zertifikat = zertifikatLaden($konfig, $kennung);
    if ($zertifikat === null) {
        return ['fehler' => ["zertifikat.json fehlt oder trägt nicht die id „{$kennung}“."], 'warnungen' => []];
    }
    $lektionen = lektionenLaden($konfig, $kennung);
    foreach ($lektionen as $slug => $l) {
        $basis = inhaltePfad($konfig) . "/$kennung/lektionen/$slug";
        if (!is_file("$basis.md") && !is_file("$basis.php")) {
            $fehler[] = "Lektion „{$slug}“ steht im Index, aber die Datei fehlt.";
        }
    }

    $katalog = fragenLaden($konfig, $kennung);
    $module = [];
    foreach ($katalog['module'] as $m) {
        if (isset($m['id'])) {
            $module[$m['id']] = 0;
        }
    }
    if ($module === []) {
        $fehler[] = 'fragen.json nennt keine Module.';
    }
    $nummern = [];
    foreach ($katalog['fragen'] as $id => $f) {
        if (!preg_match('/^' . preg_quote($kennung, '/') . '-\d{3,4}$/', (string) $id)) {
            $fehler[] = "Frage „{$id}“: id passt nicht zum Muster $kennung-000.";
        }
        if (!isset($f['modul']) || !array_key_exists($f['modul'], $module)) {
            $fehler[] = "Frage „{$id}“: Modul „" . ($f['modul'] ?? '') . "“ ist nicht definiert.";
        } else {
            $module[$f['modul']]++;
        }
        $antworten = $f['antworten'] ?? [];
        if (!is_array($antworten) || count($antworten) < 2) {
            $fehler[] = "Frage „{$id}“: weniger als zwei Antworten.";
        } elseif (count($antworten) !== 4) {
            $warnungen[] = "Frage „{$id}“: " . count($antworten) . ' statt 4 Antworten.';
        }
        if (!isset($f['richtig']) || !is_int($f['richtig']) || !isset($antworten[$f['richtig']])) {
            $fehler[] = "Frage „{$id}“: „richtig“ zeigt auf keine vorhandene Antwort.";
        }
        if (trim((string) ($f['text'] ?? '')) === '') {
            $fehler[] = "Frage „{$id}“: leerer Fragetext.";
        }
        if (!empty($f['lektion']) && !isset($lektionen[$f['lektion']])) {
            $warnungen[] = "Frage „{$id}“: Lektion „{$f['lektion']}“ gibt es nicht.";
        }
        if (!empty($f['bild']) && !is_file(inhaltePfad($konfig) . "/$kennung/bilder/" . basename((string) $f['bild']))) {
            $fehler[] = "Frage „{$id}“: Bild „{$f['bild']}“ fehlt unter bilder/.";
        }
        if (isset($f['nr'])) {
            if (isset($nummern[(int) $f['nr']])) {
                $fehler[] = "Frage „{$id}“: Nummer {$f['nr']} ist doppelt.";
            }
            $nummern[(int) $f['nr']] = $id;
        }
        if (!empty($f['pruefen'])) {
            $warnungen[] = "Frage „{$id}“: vom Import als „prüfen“ markiert.";
        }
    }

    $regeln = $zertifikat['pruefung'];
    foreach (['fragenProBogen', 'zeitMinuten', 'mindestRichtig'] as $schluessel) {
        if (!is_int($regeln[$schluessel]) || $regeln[$schluessel] <= 0) {
            $fehler[] = "zertifikat.json: pruefung.$schluessel muss eine positive Zahl sein.";
        }
    }
    if ($regeln['mindestRichtig'] > $regeln['fragenProBogen']) {
        $fehler[] = 'zertifikat.json: mindestRichtig ist größer als fragenProBogen.';
    }
    $zusammensetzung = $regeln['zusammensetzung'];
    if ($zusammensetzung !== []) {
        $summe = 0;
        foreach ($zusammensetzung as $modul => $anzahl) {
            if (!array_key_exists($modul, $module)) {
                $fehler[] = "zertifikat.json: Zusammensetzung nennt unbekanntes Modul „{$modul}“.";
            }
            $summe += (int) $anzahl;
        }
        if ($summe !== (int) $regeln['fragenProBogen']) {
            $fehler[] = "zertifikat.json: Zusammensetzung ergibt $summe, fragenProBogen ist {$regeln['fragenProBogen']}.";
        }
    }
    // Schwellen je Modul (SBF: Basisfragen und spezifische Fragen getrennt)
    foreach ($regeln['mindestRichtigJeModul'] as $modul => $mindest) {
        if (!array_key_exists($modul, $module)) {
            $fehler[] = "zertifikat.json: mindestRichtigJeModul nennt unbekanntes Modul „{$modul}“.";
        } elseif (!isset($zusammensetzung[$modul])) {
            $fehler[] = "zertifikat.json: mindestRichtigJeModul „{$modul}“ braucht einen Eintrag in zusammensetzung.";
        } elseif (!is_int($mindest) || $mindest < 0 || $mindest > (int) $zusammensetzung[$modul]) {
            $fehler[] = "zertifikat.json: mindestRichtigJeModul „{$modul}“ muss zwischen 0 und {$zusammensetzung[$modul]} liegen.";
        }
    }
    if (isset($regeln['_zuPruefen'])) {
        $warnungen[] = 'Prüfungsregeln sind noch als „zu prüfen“ markiert.';
    }
    foreach ($module as $modul => $anzahl) {
        $soll = (int) ($zusammensetzung[$modul] ?? 0);
        if ($anzahl < $soll) {
            $warnungen[] = "Modul „{$modul}“ hat nur $anzahl Fragen, der Bogen verlangt $soll — wird aufgefüllt.";
        }
    }
    foreach ($lektionen as $slug => $l) {
        foreach ($l['module'] as $m) {
            if (!array_key_exists($m, $module)) {
                $warnungen[] = "Lektion „{$slug}“ verweist auf unbekanntes Modul „{$m}“.";
            }
        }
    }

    foreach (boegenLaden($konfig, $kennung, $zertifikat) as $nr => $fragen) {
        foreach ($fragen as $fnr) {
            if (!isset($nummern[$fnr])) {
                $fehler[] = "Bogen $nr: Frage Nr. $fnr gibt es im Katalog nicht.";
            }
        }
        if (count($fragen) !== (int) $regeln['fragenProBogen']) {
            $warnungen[] = "Bogen $nr hat " . count($fragen) . " Fragen, erwartet {$regeln['fragenProBogen']}.";
        }
    }

    foreach (['funkverkehr', 'englisch'] as $modul) {
        if (!in_array($modul, $zertifikat['praxis'], true)) {
            continue;
        }
        foreach (uebungenLaden($konfig, $kennung, $modul) as $id => $u) {
            $fehler = array_merge($fehler, uebungPruefen($modul, $id, $u));
        }
    }

    return ['fehler' => $fehler, 'warnungen' => $warnungen];
}

/** Struktur einer einzelnen Übung prüfen. */
function uebungPruefen(string $modul, string $id, array $u): array
{
    $fehler = [];
    if ($modul === 'funkverkehr') {
        $typ = $u['typ'] ?? '';
        if ($typ === 'lueckentext') {
            preg_match_all('/\{\{(\d+)\}\}/', (string) ($u['text'] ?? ''), $t);
            foreach (array_unique($t[1]) as $n) {
                if (empty($u['luecken'][$n]['loesung']) || !is_array($u['luecken'][$n]['loesung'])) {
                    $fehler[] = "Übung „{$id}“: Lücke {{{$n}}} hat keine Lösung.";
                }
            }
            if ($t[1] === []) {
                $fehler[] = "Übung „{$id}“: Lückentext ohne Lücken.";
            }
        } elseif ($typ === 'reihenfolge') {
            $n = count($u['elemente'] ?? []);
            $loesung = $u['loesung'] ?? [];
            if ($n < 2 || count($loesung) !== $n || array_diff(range(0, $n - 1), $loesung) !== []) {
                $fehler[] = "Übung „{$id}“: Lösung muss jede Position von 0 bis " . ($n - 1) . ' genau einmal nennen.';
            }
        } else {
            $fehler[] = "Übung „{$id}“: unbekannter Typ „{$typ}“.";
        }
    } elseif ($modul === 'englisch') {
        if (!in_array($u['richtung'] ?? '', ['en-de', 'de-en'], true)) {
            $fehler[] = "Übung „{$id}“: richtung muss en-de oder de-en sein.";
        }
        if (empty($u['quelle']) || empty($u['musterloesung'])) {
            $fehler[] = "Übung „{$id}“: quelle und musterloesung sind Pflicht.";
        }
        foreach ($u['schluesselwoerter'] ?? [] as $eintrag) {
            if (!is_array($eintrag) || $eintrag === []) {
                $fehler[] = "Übung „{$id}“: schluesselwoerter müssen Listen von Varianten sein.";
                break;
            }
        }
    } elseif ($modul === 'diktat') {
        if (trim((string) ($u['text'] ?? '')) === '') {
            $fehler[] = "Übung „{$id}“: text (der diktierte Wortlaut) ist Pflicht.";
        }
        if (!in_array($u['sprache'] ?? '', ['en', 'de'], true)) {
            $fehler[] = "Übung „{$id}“: sprache muss en oder de sein.";
        }
    }

    return $fehler;
}

/** Zusammenfassung aller Zertifikate für die Admin-Seite „Inhalte“. */
function inhalteStatus(array $konfig): array
{
    $status = [];
    foreach (zertifikateLaden($konfig) as $kennung => $z) {
        $katalog = fragenLaden($konfig, $kennung);
        $beispiele = count(array_filter($katalog['fragen'], static fn (array $f): bool => !empty($f['beispiel'])));
        $uebungen = 0;
        foreach (['funkverkehr', 'englisch'] as $modul) {
            $uebungen += count(uebungenLaden($konfig, $kennung, $modul));
        }
        $status[$kennung] = [
            'zertifikat' => $z,
            'lektionen' => count(lektionenLaden($konfig, $kennung)),
            'fragen' => count($katalog['fragen']),
            'beispiele' => $beispiele,
            'quelle' => $katalog['quelle'],
            'boegen' => count(boegenLaden($konfig, $kennung, $z)),
            'uebungen' => $uebungen,
            'befund' => katalogPruefen($konfig, $kennung),
        ];
    }

    return $status;
}
