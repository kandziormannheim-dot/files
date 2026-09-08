<div class="k-gast">
  <div class="card k-gast-karte">
    <span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span>
    <h1 class="h2"><?= e(t('registrieren.titel')) ?></h1>
    <p class="k-text"><?= e(t('registrieren.text')) ?></p>
    <?php if ($fehler !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="<?= e(url('registrieren')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <input type="hidden" name="sprache" value="<?= e(sprache()) ?>">
      <div class="field checkout-honey" aria-hidden="true"><label for="webseite">Website</label><input id="webseite" name="webseite" type="text" tabindex="-1" autocomplete="off"></div>
      <div class="field"><label for="name"><?= e(t('registrieren.name')) ?></label><input id="name" name="name" type="text" autocomplete="name" value="<?= e($werte['name']) ?>" required autofocus></div>
      <div class="field"><label for="email"><?= e(t('login.email')) ?></label><input id="email" name="email" type="email" autocomplete="email" value="<?= e($werte['email']) ?>" required></div>
      <button class="btn btn--primary k-btn-breit" type="submit"><?= e(t('registrieren.knopf')) ?></button>
    </form>
    <p class="k-text k-klein"><?= t('registrieren.business', e(startseite(sprache() === 'en' ? '#contact' : '#kontakt'))) ?></p>
    <p class="k-links"><a href="<?= e(url('login')) ?>"><?= e(t('link.zurueck')) ?></a></p>
  </div>
</div>
