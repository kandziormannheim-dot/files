<?php $sp = sprache(); $f = static fn (string $name) => in_array($name, $fehler, true) ? 'is-invalid' : ''; ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url('sendungen/neu')) ?>">← <?= e(t('neu.titel')) ?></a><h1 class="h2"><?= e(t('palette.titel')) ?></h1><p class="k-text"><?= e(t('palette.text')) ?></p></div>
</header>
<?php if ($meldung !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($meldung) ?></p><?php } ?>
<div class="k-spalten k-spalten--2-1">
  <div class="card">
    <form method="post" action="<?= e(url('sendungen/palette')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <div class="form-row form-row--2">
        <div class="field <?= $f('zielland') ?>">
          <label for="p-land"><?= e(t('neu.zielland')) ?></label>
          <select id="p-land" name="zielland" required>
            <option value=""><?= e(t('neu.bitte_waehlen')) ?></option>
            <?php foreach ($laender as $code => $land) { ?><option value="<?= e($code) ?>" <?= $werte['zielland'] === $code ? 'selected' : '' ?>><?= e($land['name']) ?><?= $land['eu'] ? '' : ' *' ?></option><?php } ?>
          </select>
          <span class="k-klein"><?= e(t('neu.zoll.kurz')) ?></span>
        </div>
        <div class="field <?= $f('zielland') ?>"><label for="p-anzahl"><?= e(t('palette.anzahl')) ?></label><input id="p-anzahl" name="anzahl" type="number" min="1" max="999" value="<?= e($werte['anzahl']) ?>" required></div>
      </div>
      <div class="form-row form-row--2">
        <div class="field"><label for="p-art"><?= e(t('palette.art')) ?></label><select id="p-art" name="palettenart"><?php foreach (['' => t('neu.bitte_waehlen'), 'Euro 120 × 80' => 'Euro (120 × 80 cm)', 'Industrie 120 × 100' => $sp === 'en' ? 'Industrial (120 × 100 cm)' : 'Industrie (120 × 100 cm)', 'Halb 80 × 60' => $sp === 'en' ? 'Half pallet (80 × 60 cm)' : 'Halbpalette (80 × 60 cm)', 'Einweg' => $sp === 'en' ? 'One-way / other' : 'Einweg / andere'] as $wert => $name) { ?><option value="<?= e($wert) ?>" <?= $werte['palettenart'] === $wert ? 'selected' : '' ?>><?= e($name) ?></option><?php } ?></select></div>
        <div class="field"><label for="p-gewicht"><?= e(t('palette.gewicht')) ?></label><input id="p-gewicht" name="gewicht" type="text" inputmode="decimal" value="<?= e($werte['gewicht']) ?>" placeholder="450"></div>
      </div>
      <div class="field"><label for="p-abholung"><?= e(t('palette.abholung')) ?></label><input id="p-abholung" name="abholung" type="text" maxlength="120" value="<?= e($werte['abholung']) ?>" placeholder="<?= e(t('palette.abholung.platzhalter')) ?>"></div>
      <div class="field"><label for="p-nachricht"><?= e(t('palette.nachricht')) ?></label><textarea id="p-nachricht" name="nachricht" rows="4" maxlength="4000"><?= e($werte['nachricht']) ?></textarea></div>
      <div class="k-form-fuss"><button class="btn btn--primary" type="submit"><?= e(t('palette.knopf')) ?> →</button><a class="btn btn--sm k-btn-leise" href="<?= e(url('sendungen/neu')) ?>"><?= e(t('import.abbrechen')) ?></a></div>
    </form>
  </div>
  <div class="card card--ink">
    <span class="eyebrow eyebrow--cyan"><?= e(t('kategorie.palette')) ?></span>
    <p class="k-text" style="margin-top:.75rem"><?= e(t('palette.ablauf')) ?></p>
    <p class="k-text" style="margin-top:.75rem"><?= e(t('neu.zoll')) ?></p>
  </div>
</div>
