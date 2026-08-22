<?php

/**
 * Zonenwahl: eine anklickbare Draufsicht des Fahrzeugs plus Schaltflächen —
 * beides setzt dieselben Radio-Felder. Erwartet $sprache und optional
 * $gewaehlteZone.
 */

$gewaehlteZone = $gewaehlteZone ?? '';
?>
<fieldset class="zonen">
    <legend><?= e(t($sprache, 'zone')) ?></legend>
    <svg viewBox="0 0 300 130" class="womo-skizze" aria-hidden="true">
        <!-- Draufsicht: Front rechts, Heck links -->
        <rect x="18" y="22" width="264" height="86" rx="16" fill="none"
              stroke="currentColor" stroke-width="2"/>
        <polygon points="255,15 255,40 270,30" fill="currentColor" opacity="0.35"/>
        <rect data-zone="heck"    x="20" y="24"  width="42"  height="82" rx="12"/>
        <rect data-zone="links"   x="66" y="82"  width="170" height="24"/>
        <rect data-zone="rechts"  x="66" y="24"  width="170" height="24"/>
        <rect data-zone="dach"    x="66" y="51"  width="80"  height="28"/>
        <rect data-zone="innenraum" x="150" y="51" width="86" height="28"/>
        <rect data-zone="front"   x="240" y="24" width="40"  height="82" rx="12"/>
        <text x="41"  y="69">H</text>
        <text x="151" y="99">L</text>
        <text x="151" y="42">R</text>
        <text x="106" y="69">D</text>
        <text x="193" y="69">I</text>
        <text x="260" y="69">F</text>
    </svg>
    <?php foreach (zonenGruppen() as $gruppe => $gruppenNamen) { ?>
    <p class="zonen-gruppe"><?= e($gruppenNamen[$sprache === 'en' ? 'en' : 'de']) ?></p>
    <div class="zonen-liste">
        <?php foreach (zonen() as $schluessel => $namen) { ?>
            <?php if ($namen['gruppe'] !== $gruppe) { continue; } ?>
        <label class="zone">
            <input type="radio" name="zone" value="<?= e($schluessel) ?>"
                <?= $gewaehlteZone === $schluessel ? 'checked' : '' ?> required>
            <span><?= e($namen[$sprache === 'en' ? 'en' : 'de']) ?></span>
        </label>
        <?php } ?>
    </div>
    <?php } ?>
</fieldset>
