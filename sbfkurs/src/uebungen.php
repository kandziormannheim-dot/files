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
