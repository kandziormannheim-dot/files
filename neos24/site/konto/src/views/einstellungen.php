<?php $ich = kundeAktuell(); $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('einstellungen.titel')) ?></h1></div>
</header>
<div class="k-spalten k-spalten--2">
  <div class="card">
    <h2 class="h3"><?= e(t('einstellungen.konto')) ?></h2>
    <form method="post" action="<?= e(url('einstellungen')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <div class="field"><label for="e-name"><?= e(t('einstellungen.name')) ?></label><input id="e-name" name="name" type="text" value="<?= e($ich['name']) ?>" minlength="2" required></div>
      <div class="field"><label><?= e(t('login.email')) ?></label><input type="email" value="<?= e($ich['email']) ?>" readonly></div>
      <div class="field"><label for="e-sprache"><?= e(t('einstellungen.sprache')) ?></label><select id="e-sprache" name="sprache"><option value="de" <?= $ich['sprache'] === 'de' ? 'selected' : '' ?>>Deutsch</option><option value="en" <?= $ich['sprache'] === 'en' ? 'selected' : '' ?>>English</option></select></div>
      <button class="btn btn--primary" type="submit"><?= e(t('einstellungen.speichern')) ?></button>
    </form>
  </div>
  <div>
    <div class="card">
      <h2 class="h3"><?= e(t('einstellungen.passwort')) ?></h2>
      <p class="k-text"><?= e(t('einstellungen.passwort.text')) ?></p>
      <p class="k-klein" style="margin:.5rem 0 1rem"><?= e($ich['passwort_hash'] !== null ? t('einstellungen.passwort.gesetzt') : t('einstellungen.passwort.keins')) ?></p>
      <a class="btn btn--sm btn--ink" href="<?= e(url('passwort')) ?>"><?= e(t('einstellungen.passwort.knopf')) ?></a>
    </div>
    <?php if ($ich['art'] === 'privat') { ?>
    <div class="card" id="absender">
      <h2 class="h3"><?= e(t('einstellungen.absender')) ?></h2>
      <p class="k-klein" style="margin-bottom:1rem"><?= e(t('einstellungen.absender.text')) ?></p>
      <form method="post" action="<?= e(url('einstellungen/absender')) ?>" class="form k-form" novalidate>
        <?= csrfFeld() ?>
        <div class="field"><label for="a-name"><?= e(t('neu.name')) ?></label><input id="a-name" name="name" type="text" value="<?= e($absender['name'] ?? $ich['name']) ?>"></div>
        <div class="field"><label for="a-strasse"><?= e(t('neu.strasse')) ?></label><input id="a-strasse" name="strasse" type="text" value="<?= e($absender['strasse'] ?? '') ?>"></div>
        <div class="form-row form-row--plz">
          <div class="field"><label for="a-plz"><?= e(t('neu.plz')) ?></label><input id="a-plz" name="plz" type="text" value="<?= e($absender['plz'] ?? '') ?>"></div>
          <div class="field"><label for="a-ort"><?= e(t('neu.ort')) ?></label><input id="a-ort" name="ort" type="text" value="<?= e($absender['ort'] ?? '') ?>"></div>
        </div>
        <button class="btn btn--primary" type="submit"><?= e(t('einstellungen.speichern')) ?></button>
      </form>
    </div>
    <?php } ?>
    <div class="card">
      <h2 class="h3"><?= e(t('einstellungen.schliessen')) ?></h2>
      <p class="k-text" style="margin-bottom:1rem"><?= e(t('einstellungen.schliessen.text')) ?></p>
      <form method="post" action="<?= e(url('einstellungen/schliessen')) ?>" data-bestaetigen="<?= e(t('einstellungen.schliessen.bestaetigen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-gefahr" type="submit"><?= e(t('einstellungen.schliessen.knopf')) ?></button></form>
    </div>
  </div>
</div>
