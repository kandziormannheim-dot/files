<?php

/**
 * Praxismodule: Lückentexte und Reihenfolgen für den Funkverkehr, die
 * Buchstabiertafel und die Übersetzungsübungen. Auswertung ist tolerant,
 * wo es um Tippfehler geht, und streng, wo es um Reihenfolge und
 * Schlüsselbegriffe geht.
 */

declare(strict_types=1);

/** Text normalisieren: Großschreibung, Satzzeichen weg, ein Leerzeichen. */
function textNormieren(string $text): string
{
    $text = mb_strtoupper(trim($text));
    $text = str_replace(['Ä', 'Ö', 'Ü', 'ß', 'É', 'È'], ['AE', 'OE', 'UE', 'SS', 'E', 'E'], $text);
    $text = preg_replace('/[^\p{L}\p{N} ]+/u', ' ', $text) ?? $text;

    return trim(preg_replace('/\s+/', ' ', $text) ?? $text);
}

/**
 * Passt die Eingabe zu einer der Lösungen? Liefert 1 (exakt), 0.5 (ein
 * Tippfehler bei Wörtern ab sechs Zeichen) oder 0.
 */
function eingabeBewerten(string $eingabe, array $loesungen): float
{
    $e = textNormieren($eingabe);
    if ($e === '') {
        return 0;
    }
    $beste = 0.0;
    foreach ($loesungen as $l) {
        $l = textNormieren((string) $l);
        if ($e === $l) {
            return 1;
        }
        if (mb_strlen($l) >= 6 && levenshtein($e, $l) <= 1) {
            $beste = max($beste, 0.5);
        }
    }

    return $beste;
}

/** Lückentext auswerten. $eingaben: [nummer => text]. */
function lueckentextAuswerten(array $uebung, array $eingaben): array
{
    preg_match_all('/\{\{(\d+)\}\}/', (string) $uebung['text'], $t);
    $nummern = array_values(array_unique($t[1]));
    $punkte = 0.0;
    $details = [];
    foreach ($nummern as $n) {
        $luecke = $uebung['luecken'][$n] ?? ['loesung' => []];
        $eingabe = (string) ($eingaben[$n] ?? '');
        $wert = eingabeBewerten($eingabe, $luecke['loesung'] ?? []);
        $punkte += $wert;
        $details[$n] = ['eingabe' => $eingabe, 'wert' => $wert, 'loesung' => (string) (($luecke['loesung'] ?? [''])[0] ?? ''), 'hinweis' => $luecke['hinweis'] ?? ''];
    }

    return [
        'punkte' => (int) round($punkte * 2), // halbe Punkte ganzzahlig speichern
        'maximal' => count($nummern) * 2,
        'details' => $details,
        'nummern' => $nummern,
    ];
}

/** Reihenfolge auswerten. $eingabe: gewählte Abfolge als Element-Indizes. */
function reihenfolgeAuswerten(array $uebung, array $eingabe): array
{
    $loesung = array_map('intval', $uebung['loesung']);
    $eingabe = array_map('intval', $eingabe);
    $n = count($loesung);
    $punkte = 0;
    $details = [];
    for ($i = 0; $i < $n; $i++) {
        $richtig = isset($eingabe[$i]) && $eingabe[$i] === $loesung[$i];
        if ($richtig) {
            $punkte++;
        }
        $details[$i] = ['gegeben' => $eingabe[$i] ?? null, 'soll' => $loesung[$i], 'richtig' => $richtig];
    }

    return ['punkte' => $punkte, 'maximal' => $n, 'details' => $details];
}

/** Übersetzung: Schlüsselwörter zählen; die Selbsteinschätzung kommt später. */
function englischAuswerten(array $uebung, string $eingabe): array
{
    $text = textNormieren($eingabe);
    $treffer = [];
    foreach ($uebung['schluesselwoerter'] ?? [] as $i => $varianten) {
        $gefunden = null;
        foreach ((array) $varianten as $v) {
            $vn = textNormieren((string) $v);
            if ($vn !== '' && str_contains($text, $vn)) {
                $gefunden = (string) $v;
                break;
            }
        }
        $treffer[$i] = ['wort' => (string) ((array) $varianten)[0], 'gefunden' => $gefunden];
    }
    $anzahl = count(array_filter($treffer, static fn (array $t): bool => $t['gefunden'] !== null));

    return [
        'treffer' => $treffer,
        'anzahl' => $anzahl,
        'mindest' => (int) ($uebung['mindestTreffer'] ?? count($treffer)),
        'vorschlag' => $anzahl >= (int) ($uebung['mindestTreffer'] ?? count($treffer)) ? 'richtig' : ($anzahl > 0 ? 'teilweise' : 'falsch'),
    ];
}

/**
 * Diktat auswerten: Mitschrift wortweise gegen den diktierten Text stellen.
 * Die Wörter werden in Reihenfolge zugeordnet (längste gemeinsame Teilfolge),
 * ein Tippfehler in langen Wörtern zählt halb (wie eingabeBewerten). Punkte
 * in halben Punkten, damit uebungErgebnisSpeichern ganze Zahlen bekommt.
 */
function diktatAuswerten(array $uebung, string $eingabe): array
{
    $woerterTeilen = static fn (string $t): array => array_values(array_filter(explode(' ', textNormieren($t)), static fn (string $w): bool => $w !== ''));
    $soll = $woerterTeilen((string) ($uebung['text'] ?? ''));
    $ist = $woerterTeilen($eingabe);
    $n = count($soll);
    $m = count($ist);

    // Ähnlichkeit je Wortpaar: 1 exakt, 0,5 Tippfehler, 0 sonst.
    $wert = static fn (string $a, string $b): float => eingabeBewerten($a, [$b]);
    // Dynamisches Programm über die Wortfolgen (Teilfolge mit maximaler Punktsumme).
    $tab = array_fill(0, $n + 1, array_fill(0, $m + 1, 0.0));
    for ($i = 1; $i <= $n; $i++) {
        for ($j = 1; $j <= $m; $j++) {
            $tab[$i][$j] = max($tab[$i - 1][$j], $tab[$i][$j - 1], $tab[$i - 1][$j - 1] + $wert($ist[$j - 1], $soll[$i - 1]));
        }
    }
    // Rückverfolgung: welches Sollwort wurde wie getroffen?
    $treffer = array_fill(0, $n, 0.0);
    $i = $n;
    $j = $m;
    $zugeordnet = 0;
    while ($i > 0 && $j > 0) {
        $w = $wert($ist[$j - 1], $soll[$i - 1]);
        if ($w > 0 && abs($tab[$i][$j] - ($tab[$i - 1][$j - 1] + $w)) < 1e-9) {
            $treffer[$i - 1] = $w;
            $zugeordnet++;
            $i--;
            $j--;
        } elseif ($tab[$i - 1][$j] >= $tab[$i][$j - 1]) {
            $i--;
        } else {
            $j--;
        }
    }
    $woerter = [];
    foreach ($soll as $k => $wort) {
        $woerter[] = ['wort' => $wort, 'wert' => $treffer[$k]];
    }
    $summe = array_sum($treffer);

    return [
        'woerter' => $woerter,
        'richtig' => count(array_filter($treffer, static fn (float $t): bool => $t >= 1)),
        'zusaetzlich' => max(0, $m - $zugeordnet),
        'punkte' => (int) round($summe * 2),
        'maximal' => max(1, $n * 2),
        'prozent' => $n > 0 ? (int) round($summe * 100 / $n) : 0,
    ];
}

/**
 * Buchstabier-Aufgabe: ein Wort aus der Liste oder ein Rufzeichen-artiger
 * Mix. Richtung 'buchstabieren' (Wort → Codewörter) oder 'lesen'
 * (Codewörter → Wort).
 */
function buchstabierAufgabe(array $tafel, ?string $richtung = null): array
{
    $richtung ??= random_int(0, 1) === 0 ? 'buchstabieren' : 'lesen';
    $woerter = $tafel['woerter'];
    if ($woerter !== [] && random_int(0, 3) > 0) {
        $wort = (string) $woerter[random_int(0, count($woerter) - 1)];
    } else {
        // Rufzeichen-artig: zwei Buchstaben, Ziffern, Buchstaben
        $b = array_keys($tafel['buchstaben']);
        $z = array_keys($tafel['ziffern']);
        $wort = $b[random_int(0, count($b) - 1)] . $b[random_int(0, count($b) - 1)]
            . $z[random_int(0, count($z) - 1)] . $z[random_int(0, count($z) - 1)]
            . $b[random_int(0, count($b) - 1)] . $b[random_int(0, count($b) - 1)];
    }
    $wort = mb_strtoupper($wort);
    $codewoerter = [];
    foreach (mb_str_split($wort) as $zeichen) {
        $codewoerter[] = $tafel['buchstaben'][$zeichen] ?? $tafel['ziffern'][$zeichen] ?? $zeichen;
    }

    return ['richtung' => $richtung, 'wort' => $wort, 'codewoerter' => $codewoerter];
}

/** Buchstabier-Antwort auswerten; toleriert Alfa/Alpha usw. laut 'varianten'. */
function buchstabierAuswerten(array $tafel, array $aufgabe, string $eingabe): array
{
    $details = [];
    $punkte = 0;
    if ($aufgabe['richtung'] === 'lesen') {
        $soll = textNormieren($aufgabe['wort']);
        $ist = str_replace(' ', '', textNormieren($eingabe));
        $richtig = $ist === str_replace(' ', '', $soll);

        return ['punkte' => $richtig ? 1 : 0, 'maximal' => 1, 'details' => [['soll' => $aufgabe['wort'], 'ist' => $eingabe, 'richtig' => $richtig]]];
    }
    $eingegeben = preg_split('/[\s,;]+/', trim($eingabe)) ?: [];
    $eingegeben = array_values(array_filter($eingegeben, static fn (string $w): bool => $w !== ''));
    foreach ($aufgabe['codewoerter'] as $i => $soll) {
        $ist = $eingegeben[$i] ?? '';
        $erlaubt = array_merge([$soll], $tafel['varianten'][$soll] ?? []);
        $richtig = eingabeBewerten($ist, $erlaubt) > 0;
        if ($richtig) {
            $punkte++;
        }
        $details[$i] = ['zeichen' => mb_substr($aufgabe['wort'], $i, 1), 'soll' => $soll, 'ist' => $ist, 'richtig' => $richtig];
    }

    return ['punkte' => $punkte, 'maximal' => count($aufgabe['codewoerter']), 'details' => $details];
}

/** Ergebnis einer Übung festhalten. */
function uebungErgebnisSpeichern(PDO $db, int $benutzerId, string $zertifikat, string $modul, string $uebungId, int $punkte, int $maximal, array $details = []): void
{
    $db->prepare('INSERT INTO uebung_ergebnisse (benutzer_id, zertifikat, modul, uebung_id, punkte, maximal, details_json)
                  VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$benutzerId, $zertifikat, $modul, $uebungId, $punkte, max(1, $maximal), json_encode($details, JSON_UNESCAPED_UNICODE)]);
    if ($zertifikat !== '') {
        fortschrittBeruehren($db, $benutzerId, $zertifikat);
    }
}
