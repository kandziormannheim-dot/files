<?php

/**
 * Diagramme als Inline-SVG ohne Abhängigkeiten: Balken, Linien, Ringe und
 * Querbalken. Farben aus der NEOS-Palette, Werte als <title> je Element,
 * Größen per viewBox — skaliert mit der Karte.
 */

declare(strict_types=1);

const DIAGRAMM_FARBEN = ['#29D3F5', '#FF5A2C', '#FFD400', '#FF3EA5', '#1FB97A', '#7B61FF', '#0a7f9a', '#b63a12', '#8a8f9a', '#4c5566', '#e0b400', '#a04b8f'];

function diagrammZahl(float $v): string
{
    if (abs($v) >= 1000000) { return number_format($v / 1000000, 1, ',', '.') . ' Mio'; }
    if (abs($v) >= 10000) { return number_format($v / 1000, 0, ',', '.') . ' k'; }
    return number_format($v, $v == floor($v) ? 0 : 1, ',', '.');
}

/** Achsenwert je Format formatieren (Cent → €). */
function diagrammAchse(float $v, string $format): string
{
    return match ($format) {
        'euro' => diagrammZahl($v / 100) . ' €',
        'prozent' => diagrammZahl($v) . ' %',
        default => diagrammZahl($v),
    };
}

/** „Schöne“ Obergrenze für die Achse. */
function diagrammMax(float $max): float
{
    if ($max <= 0) { return 1; }
    $p = 10 ** floor(log10($max));
    foreach ([1, 2, 2.5, 5, 10] as $s) {
        if ($max <= $s * $p) { return $s * $p; }
    }
    return 10 * $p;
}

/**
 * Balken- oder Liniendiagramm über Kategorien (Zeitreihe).
 * $reihen: [['name' => ..., 'werte' => [float...], 'format' => 'euro'|'anzahl', 'art' => 'balken'|'linie', 'achse' => 'links'|'rechts']]
 */
function svgZeitreihe(array $kategorien, array $reihen, int $breite = 900, int $hoehe = 280): string
{
    $n = max(1, count($kategorien));
    $links = 62; $rechts = 62; $oben = 16; $unten = 34;
    $pw = $breite - $links - $rechts; $ph = $hoehe - $oben - $unten;
    $maxL = 0.0; $maxR = 0.0; $formatL = 'anzahl'; $formatR = 'anzahl';
    foreach ($reihen as $r) {
        $m = (float) max(array_merge([0.0], array_map('floatval', $r['werte'])));
        if (($r['achse'] ?? 'links') === 'rechts') { $maxR = max($maxR, $m); $formatR = $r['format'] ?? 'anzahl'; } else { $maxL = max($maxL, $m); $formatL = $r['format'] ?? 'anzahl'; }
    }
    $maxL = diagrammMax($maxL); $maxR = diagrammMax($maxR);
    $s = '<svg class="diagramm" viewBox="0 0 ' . $breite . ' ' . $hoehe . '" role="img" aria-label="Diagramm" preserveAspectRatio="xMidYMid meet">';
    // Raster + linke Achse
    for ($i = 0; $i <= 4; $i++) {
        $y = $oben + $ph - $ph * $i / 4;
        $s .= '<line x1="' . $links . '" x2="' . ($breite - $rechts) . '" y1="' . $y . '" y2="' . $y . '" class="d-raster"/>';
        $s .= '<text x="' . ($links - 6) . '" y="' . ($y + 4) . '" class="d-achse" text-anchor="end">' . e(diagrammAchse($maxL * $i / 4, $formatL)) . '</text>';
        if ($maxR > 1) {
            $s .= '<text x="' . ($breite - $rechts + 6) . '" y="' . ($y + 4) . '" class="d-achse">' . e(diagrammAchse($maxR * $i / 4, $formatR)) . '</text>';
        }
    }
    $slot = $pw / $n;
    $balkenReihen = array_values(array_filter($reihen, static fn (array $r): bool => ($r['art'] ?? 'balken') === 'balken'));
    $bn = max(1, count($balkenReihen));
    $bw = max(2, min(38, ($slot * 0.7) / $bn));
    $farbe = 0;
    foreach ($reihen as $r) {
        $col = $r['farbe'] ?? DIAGRAMM_FARBEN[$farbe % count(DIAGRAMM_FARBEN)];
        $farbe++;
        $max = ($r['achse'] ?? 'links') === 'rechts' ? $maxR : $maxL;
        if (($r['art'] ?? 'balken') === 'balken') {
            $bi = array_search($r, $balkenReihen, true);
            foreach ($r['werte'] as $i => $v) {
                $h = $max > 0 ? $ph * (float) $v / $max : 0;
                $x = $links + $slot * $i + ($slot - $bw * $bn) / 2 + $bw * (int) $bi;
                $s .= '<rect x="' . round($x, 1) . '" y="' . round($oben + $ph - $h, 1) . '" width="' . round($bw, 1) . '" height="' . round(max(0, $h), 1) . '" rx="3" fill="' . $col . '"><title>' . e(($kategorien[$i] ?? '') . ' · ' . $r['name'] . ': ' . statistikFormat((float) $v, $r['format'] ?? 'anzahl')) . '</title></rect>';
            }
        } else {
            $punkte = [];
            foreach ($r['werte'] as $i => $v) {
                $x = $links + $slot * $i + $slot / 2;
                $y = $oben + $ph - ($max > 0 ? $ph * (float) $v / $max : 0);
                $punkte[] = round($x, 1) . ',' . round($y, 1);
            }
            $s .= '<polyline points="' . implode(' ', $punkte) . '" fill="none" stroke="' . $col . '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
            foreach ($r['werte'] as $i => $v) {
                [$x, $y] = explode(',', $punkte[$i]);
                $s .= '<circle cx="' . $x . '" cy="' . $y . '" r="3.5" fill="' . $col . '" stroke="#fff" stroke-width="1.5"><title>' . e(($kategorien[$i] ?? '') . ' · ' . $r['name'] . ': ' . statistikFormat((float) $v, $r['format'] ?? 'anzahl')) . '</title></circle>';
            }
        }
    }
    // Kategorien (bei vielen nur jede k-te)
    $schritt = (int) max(1, ceil($n / max(4, floor($pw / 68)))); // Beschriftungen nach Platz ausdünnen
    foreach ($kategorien as $i => $k) {
        if ($i % $schritt !== 0 && $i !== $n - 1) { continue; }
        $x = $links + $slot * $i + $slot / 2;
        $s .= '<text x="' . round($x, 1) . '" y="' . ($hoehe - 12) . '" class="d-achse" text-anchor="middle">' . e(mb_strimwidth((string) $k, 0, 12, '…')) . '</text>';
    }
    $s .= '</svg>';
    // Legende
    $s .= '<div class="d-legende">';
    $farbe = 0;
    foreach ($reihen as $r) {
        $col = $r['farbe'] ?? DIAGRAMM_FARBEN[$farbe % count(DIAGRAMM_FARBEN)];
        $farbe++;
        $s .= '<span><i style="background:' . $col . '"></i>' . e($r['name']) . '</span>';
    }
    $s .= '</div>';

    return $s;
}

/** Querbalken je Kategorie (Rangliste). $zeilen: [['name', 'wert']] */
function svgQuerbalken(array $zeilen, string $format = 'anzahl', int $breite = 600): string
{
    if ($zeilen === []) { return '<p class="leer">Keine Daten im Zeitraum.</p>'; }
    $max = diagrammMax((float) max(array_map(static fn (array $z): float => (float) $z['wert'], $zeilen)));
    $zh = 26; $hoehe = count($zeilen) * $zh + 6; $links = 170; $rechts = 90; $pw = $breite - $links - $rechts;
    $s = '<svg class="diagramm diagramm--quer" viewBox="0 0 ' . $breite . ' ' . $hoehe . '" role="img" aria-label="Rangliste" preserveAspectRatio="xMidYMid meet">';
    foreach ($zeilen as $i => $z) {
        $y = 3 + $i * $zh;
        $w = $max > 0 ? $pw * (float) $z['wert'] / $max : 0;
        $col = $z['farbe'] ?? DIAGRAMM_FARBEN[$i % count(DIAGRAMM_FARBEN)];
        $s .= '<text x="' . ($links - 8) . '" y="' . ($y + 17) . '" class="d-name" text-anchor="end">' . e(mb_strimwidth((string) $z['name'], 0, 24, '…')) . '</text>';
        $s .= '<rect x="' . $links . '" y="' . ($y + 4) . '" width="' . round(max(1, $w), 1) . '" height="' . ($zh - 8) . '" rx="4" fill="' . $col . '"><title>' . e($z['name'] . ': ' . statistikFormat((float) $z['wert'], $format)) . '</title></rect>';
        $s .= '<text x="' . round($links + $w + 8, 1) . '" y="' . ($y + 17) . '" class="d-wert">' . e(statistikFormat((float) $z['wert'], $format)) . '</text>';
    }
    return $s . '</svg>';
}

/** Ring (Anteile). $teile: [['name', 'wert']] */
function svgRing(array $teile, string $format = 'anzahl', int $groesse = 180): string
{
    $summe = array_sum(array_map(static fn (array $t): float => max(0.0, (float) $t['wert']), $teile));
    if ($summe <= 0) { return '<p class="leer">Keine Daten im Zeitraum.</p>'; }
    $r = 70; $c = 2 * M_PI * $r; $offset = 0.0; $mitte = $groesse / 2;
    $s = '<div class="d-ring"><svg viewBox="0 0 ' . $groesse . ' ' . $groesse . '" role="img" aria-label="Anteile">';
    $s .= '<circle cx="' . $mitte . '" cy="' . $mitte . '" r="' . $r . '" fill="none" stroke="#eef0f3" stroke-width="22"/>';
    foreach ($teile as $i => $t) {
        $v = max(0.0, (float) $t['wert']);
        if ($v <= 0) { continue; }
        $len = $c * $v / $summe;
        $col = $t['farbe'] ?? DIAGRAMM_FARBEN[$i % count(DIAGRAMM_FARBEN)];
        $s .= '<circle cx="' . $mitte . '" cy="' . $mitte . '" r="' . $r . '" fill="none" stroke="' . $col . '" stroke-width="22" stroke-dasharray="' . round($len, 2) . ' ' . round($c - $len, 2) . '" stroke-dashoffset="' . round(-$offset, 2) . '" transform="rotate(-90 ' . $mitte . ' ' . $mitte . ')"><title>' . e($t['name'] . ': ' . statistikFormat($v, $format) . ' (' . round($v * 100 / $summe, 1) . ' %)') . '</title></circle>';
        $offset += $len;
    }
    $s .= '<text x="' . $mitte . '" y="' . ($mitte + 6) . '" class="d-mitte" text-anchor="middle">' . e($format === 'euro' ? diagrammAchse($summe, 'euro') : diagrammZahl($summe)) . '</text></svg><ul class="d-ring-legende">';
    foreach ($teile as $i => $t) {
        $v = max(0.0, (float) $t['wert']);
        $col = $t['farbe'] ?? DIAGRAMM_FARBEN[$i % count(DIAGRAMM_FARBEN)];
        $s .= '<li><i style="background:' . $col . '"></i>' . e($t['name']) . ' <span class="mono">' . e(statistikFormat($v, $format)) . ' · ' . round($v * 100 / $summe, 1) . ' %</span></li>';
    }
    return $s . '</ul></div>';
}

/** Kleine Sparkline (Werte im Zeitverlauf) für Kacheln. */
function svgSparkline(array $werte, string $farbe = '#29D3F5', int $breite = 120, int $hoehe = 32): string
{
    if (count($werte) < 2) { return ''; }
    $max = max(1.0, (float) max($werte));
    $n = count($werte);
    $punkte = [];
    foreach ($werte as $i => $v) {
        $punkte[] = round($i * ($breite - 4) / ($n - 1) + 2, 1) . ',' . round($hoehe - 2 - ((float) $v / $max) * ($hoehe - 6), 1);
    }
    return '<svg class="sparkline" viewBox="0 0 ' . $breite . ' ' . $hoehe . '" aria-hidden="true"><polyline points="' . implode(' ', $punkte) . '" fill="none" stroke="' . $farbe . '" stroke-width="2" stroke-linejoin="round"/></svg>';
}

/** Heatmap-Farbe (weiß → cyan) für Pivot-Zellen. */
function diagrammZellfarbe(float|int|null $wert, float $max): string
{
    if ($wert === null || $max <= 0 || $wert <= 0) { return ''; }
    $a = min(1, (float) $wert / $max);
    return 'background: rgba(41, 211, 245, ' . round(0.08 + 0.42 * $a, 2) . ')';
}
