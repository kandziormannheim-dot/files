<?php

/**
 * Fahrzeugskizze mit Schadenspunkten: dieselbe Draufsicht wie bei der
 * Zonenwahl, aber nur zur Anzeige — Zonen mit offenen oder gemeldeten
 * Vorgängen sind eingefärbt und tragen die Anzahl. Erwartet $zonenZaehler
 * (zone => anzahl); Technik-Zonen ohne Platz auf der Skizze stehen daneben.
 */

$zonenZaehler = $zonenZaehler ?? [];
$skizzenZonen = [
    'heck' => [41, 65], 'links' => [151, 94], 'rechts' => [151, 36],
    'dach' => [106, 65], 'innenraum' => [193, 65], 'front' => [260, 65],
];
?>
<div class="skizze-uebersicht">
    <svg viewBox="0 0 300 130" class="womo-skizze" role="img" aria-label="Fahrzeugskizze mit Schadenspunkten">
        <rect x="18" y="22" width="264" height="86" rx="16" fill="none"
              stroke="currentColor" stroke-width="2"/>
        <polygon points="255,15 255,40 270,30" fill="currentColor" opacity="0.35"/>
        <rect data-zone="heck"    x="20" y="24"  width="42"  height="82" rx="12"
              class="<?= !empty($zonenZaehler['heck']) ? 'belastet' : '' ?>"/>
        <rect data-zone="links"   x="66" y="82"  width="170" height="24"
              class="<?= !empty($zonenZaehler['links']) ? 'belastet' : '' ?>"/>
        <rect data-zone="rechts"  x="66" y="24"  width="170" height="24"
              class="<?= !empty($zonenZaehler['rechts']) ? 'belastet' : '' ?>"/>
        <rect data-zone="dach"    x="66" y="51"  width="80"  height="28"
              class="<?= !empty($zonenZaehler['dach']) ? 'belastet' : '' ?>"/>
        <rect data-zone="innenraum" x="150" y="51" width="86" height="28"
              class="<?= !empty($zonenZaehler['innenraum']) ? 'belastet' : '' ?>"/>
        <rect data-zone="front"   x="240" y="24" width="40"  height="82" rx="12"
              class="<?= !empty($zonenZaehler['front']) ? 'belastet' : '' ?>"/>
        <?php foreach ($skizzenZonen as $zone => [$x, $y]) { ?>
            <?php if (!empty($zonenZaehler[$zone])) { ?>
        <circle cx="<?= $x ?>" cy="<?= $y ?>" r="9" class="schadenspunkt"/>
        <text x="<?= $x ?>" y="<?= $y + 1 ?>" class="schadenszahl"><?= (int) $zonenZaehler[$zone] ?></text>
            <?php } else { ?>
        <text x="<?= $x ?>" y="<?= $y ?>"><?= e(strtoupper(mb_substr(zonenName($zone), 0, 1))) ?></text>
            <?php } ?>
        <?php } ?>
    </svg>
    <ul class="skizze-legende">
        <?php
        $weitere = array_filter(
            zonen(),
            static fn (array $namen, string $zone): bool => !isset($skizzenZonen[$zone]) && !empty($zonenZaehler[$zone]),
            ARRAY_FILTER_USE_BOTH
        );
        ?>
        <?php if ($weitere === [] && array_sum($zonenZaehler) === 0) { ?>
        <li class="frei">Keine offenen Schadenspunkte — alles im grünen Bereich.</li>
        <?php } ?>
        <?php foreach ($weitere as $zone => $namen) { ?>
        <li><span class="punkt"><?= (int) $zonenZaehler[$zone] ?></span> <?= e($namen['de']) ?></li>
        <?php } ?>
    </ul>
</div>
