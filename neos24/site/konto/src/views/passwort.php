<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('nav.einstellungen')) ?></span><h1 class="h2"><?= e(t('passwort.titel')) ?></h1></div>
</header>
<div class="k-spalten">
  <div class="card">
    <p class="k-text"><?= e(t($neu ? 'passwort.text_neu' : 'passwort.text', KUNDE_PASSWORT_MINDESTLAENGE)) ?></p>
    <?php if ($fehler !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="<?= e(url('passwort')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <?php if (!$frei) { ?><div class="field"><label for="alt"><?= e(t('passwort.alt')) ?></label><input id="alt" name="alt" type="password" autocomplete="current-password" required></div><?php } ?>
      <div class="field"><label for="neu"><?= e(t('passwort.neu')) ?></label><input id="neu" name="neu" type="password" autocomplete="new-password" minlength="<?= KUNDE_PASSWORT_MINDESTLAENGE ?>" required></div>
      <div class="field"><label for="wiederholung"><?= e(t('passwort.wiederholung')) ?></label><input id="wiederholung" name="wiederholung" type="password" autocomplete="new-password" minlength="<?= KUNDE_PASSWORT_MINDESTLAENGE ?>" required></div>
      <div class="k-form-fuss">
        <button class="btn btn--primary" type="submit"><?= e(t('passwort.knopf')) ?></button>
        <?php if ($neu) { ?><a class="btn btn--sm k-btn-leise" href="<?= e(url()) ?>"><?= e(t('passwort.spaeter')) ?></a><?php } ?>
      </div>
    </form>
  </div>
</div>
