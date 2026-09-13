<?php
/**
 * Partial: eine Frage mit Antwortliste. Erwartet
 *   $frage      — Katalogeintrag
 *   $antworten  — Antworten in Anzeigereihenfolge
 *   $feldname   — Name des Radio-Felds (z. B. 'antwort' oder 'antwort[3]')
 *   $kennung    — Zertifikat (für Bilder)
 *   $gewaehlt   — vorausgewählte Anzeigeposition oder null
 *   $aufloesung — null oder ['richtigePosition' => int, 'gewaehlt' => int]
 */
$gewaehlt = $gewaehlt ?? null;
$aufloesung = $aufloesung ?? null;
$buchstaben = ['A', 'B', 'C', 'D', 'E', 'F'];
?>
<div class="frage">
    <p class="fragetext"><?= e($frage['text']) ?></p>
    <?php if (!empty($frage['bild'])) { ?>
    <figure class="fragebild"><img src="/bild/<?= e($kennung) ?>/<?= e(basename((string) $frage['bild'])) ?>" alt="Abbildung zur Frage"></figure>
    <?php } ?>
    <ol class="antworten">
    <?php foreach ($antworten as $i => $antwort) {
        $klasse = '';
        if ($aufloesung !== null) {
            if ($i === $aufloesung['richtigePosition']) {
                $klasse = 'richtig';
            } elseif ($i === $aufloesung['gewaehlt']) {
                $klasse = 'falsch';
            }
        }
    ?>
        <li class="<?= $klasse ?>">
            <label>
                <input type="radio" name="<?= e($feldname) ?>" value="<?= $i ?>"<?= $gewaehlt === $i ? ' checked' : '' ?><?= $aufloesung !== null ? ' disabled' : '' ?> data-taste="<?= $i + 1 ?>">
                <span class="buchstabe"><?= $buchstaben[$i] ?? $i + 1 ?></span>
                <span class="antworttext"><?= e($antwort) ?></span>
            </label>
        </li>
    <?php } ?>
    </ol>
</div>
