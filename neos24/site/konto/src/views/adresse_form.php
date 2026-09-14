<?php $sp = sprache(); $art = $a['art'] ?? 'empfaenger'; ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url('adressbuch')) ?>">← <?= e(t('adressbuch.titel')) ?></a><h1 class="h2"><?= e($titel) ?></h1></div>
</header>
<div class="k-spalten">
  <div class="card">
    <form method="post" action="<?= e(url($a !== null ? 'adressbuch/' . $a['id'] : 'adressbuch/neu')) ?>" class="form k-form" novalidate<?= $darf ? '' : ' inert' ?>>
      <?= csrfFeld() ?>
      <div class="form-row form-row--2">
        <div class="field"><label for="ad-art"><?= e(t('adressbuch.art')) ?></label><select id="ad-art" name="art"><option value="empfaenger" <?= $art === 'empfaenger' ? 'selected' : '' ?>><?= e(t('adressbuch.art.empfaenger')) ?></option><option value="absender" <?= $art === 'absender' ? 'selected' : '' ?>><?= e(t('adressbuch.art.absender')) ?></option></select></div>
        <div class="field"><label for="ad-land"><?= e(t('neu.land')) ?></label><select id="ad-land" name="land"><option value="DE" <?= ($a['land'] ?? 'DE') === 'DE' ? 'selected' : '' ?>>Deutschland</option><?php foreach ($laender as $code => $l) { if ($code === 'DE') { continue; } ?><option value="<?= e($code) ?>" <?= ($a['land'] ?? '') === $code ? 'selected' : '' ?>><?= e($l['name'][$sp]) ?></option><?php } ?></select></div>
      </div>
      <div class="form-row form-row--2">
        <div class="field"><label for="ad-name"><?= e(t('neu.name')) ?></label><input id="ad-name" name="name" type="text" value="<?= e($a['name'] ?? '') ?>" required></div>
        <div class="field"><label for="ad-firma"><?= e(t('neu.firma')) ?></label><input id="ad-firma" name="firma" type="text" value="<?= e($a['firma'] ?? '') ?>"></div>
      </div>
      <div class="field"><label for="ad-strasse"><?= e(t('neu.strasse')) ?></label><input id="ad-strasse" name="strasse" type="text" value="<?= e($a['strasse'] ?? '') ?>" required></div>
      <div class="form-row form-row--plz">
        <div class="field"><label for="ad-plz"><?= e(t('neu.plz')) ?></label><input id="ad-plz" name="plz" type="text" value="<?= e($a['plz'] ?? '') ?>" required></div>
        <div class="field"><label for="ad-ort"><?= e(t('neu.ort')) ?></label><input id="ad-ort" name="ort" type="text" value="<?= e($a['ort'] ?? '') ?>" required></div>
      </div>
      <div class="form-row form-row--2">
        <div class="field"><label for="ad-email"><?= e(t('login.email')) ?></label><input id="ad-email" name="email" type="email" value="<?= e($a['email'] ?? '') ?>"></div>
        <div class="field"><label for="ad-tel"><?= e(t('neu.telefon')) ?></label><input id="ad-tel" name="telefon" type="tel" value="<?= e($a['telefon'] ?? '') ?>"></div>
      </div>
      <?php if (!$darf) { ?><p class="k-hinweis k-hinweis--warn"><?= e(t('adressbuch.fremd')) ?></p><?php } ?>
      <label class="k-schalter"><input type="checkbox" name="standard" value="1" <?= (int) ($a['standard'] ?? 0) === 1 ? 'checked' : '' ?>> <?= e(t('adressbuch.standard')) ?></label>
      <?php if ($business) { ?><label class="k-schalter"><input type="checkbox" name="geteilt" value="1" <?= (int) ($a['geteilt'] ?? 0) === 1 ? 'checked' : '' ?>> <?= e(t('adressbuch.geteilt')) ?></label><?php } ?>
      <div class="k-form-fuss"><?php if ($darf) { ?><button class="btn btn--primary" type="submit"><?= e(t('einstellungen.speichern')) ?></button><?php } ?><a class="btn btn--sm k-btn-leise" href="<?= e(url('adressbuch')) ?>"><?= e(t('import.abbrechen')) ?></a></div>
    </form>
  </div>
</div>
