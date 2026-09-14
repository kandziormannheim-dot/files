<?php $sp = sprache(); $gewaehlt = $v !== null ? (json_decode((string) $v['zusatz_json'], true) ?: []) : []; ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url('adressbuch')) ?>">← <?= e(t('adressbuch.titel')) ?></a><h1 class="h2"><?= e($titel) ?></h1><p class="k-text"><?= e(t('vorlagen.text')) ?></p></div>
</header>
<div class="k-spalten">
  <div class="card">
    <form method="post" action="<?= e(url($v !== null ? 'vorlagen/' . $v['id'] : 'vorlagen/neu')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <div class="form-row form-row--2">
        <div class="field"><label for="v-name"><?= e(t('vorlagen.name')) ?></label><input id="v-name" name="name" type="text" value="<?= e($v['name'] ?? '') ?>" required></div>
        <div class="field"><label for="v-gewicht"><?= e(t('neu.gewicht_kg')) ?></label><input id="v-gewicht" name="gewicht_kg" type="text" inputmode="decimal" value="<?= $v !== null ? e(number_format((int) $v['gewicht_gramm'] / 1000, 2, ',', '')) : '' ?>" required></div>
      </div>
      <div class="field"><label for="v-l"><?= e(t('neu.masse')) ?></label><div class="k-masse"><input id="v-l" name="laenge" type="number" min="0" value="<?= e($v['laenge_cm'] ?? '') ?>" placeholder="L"><span>×</span><input name="breite" type="number" min="0" value="<?= e($v['breite_cm'] ?? '') ?>" placeholder="B" aria-label="B"><span>×</span><input name="hoehe" type="number" min="0" value="<?= e($v['hoehe_cm'] ?? '') ?>" placeholder="H" aria-label="H"></div></div>
      <div class="field"><span class="k-klein"><?= e(t('neu.zusatz')) ?></span>
        <?php foreach ($zusatz as $code => $z) { ?><label class="k-schalter"><input type="checkbox" name="zusatz[]" value="<?= e($code) ?>" <?= in_array($code, $gewaehlt, true) ? 'checked' : '' ?>> <?= e($z['name'][$sp]) ?></label><?php } ?>
      </div>
      <div class="k-form-fuss"><button class="btn btn--primary" type="submit"><?= e(t('einstellungen.speichern')) ?></button><a class="btn btn--sm k-btn-leise" href="<?= e(url('adressbuch')) ?>"><?= e(t('import.abbrechen')) ?></a></div>
    </form>
  </div>
</div>
