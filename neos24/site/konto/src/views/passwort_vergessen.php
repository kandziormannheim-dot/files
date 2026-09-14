<div class="k-gast">
  <div class="card k-gast-karte">
    <span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span>
    <h1 class="h2"><?= e(t('vergessen.titel')) ?></h1>
    <p class="k-text"><?= e(t('vergessen.text')) ?></p>
    <form method="post" action="<?= e(url('passwort-vergessen')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <input type="hidden" name="sprache" value="<?= e(sprache()) ?>">
      <div class="field"><label for="email"><?= e(t('login.email')) ?></label><input id="email" name="email" type="email" autocomplete="email" required autofocus></div>
      <button class="btn btn--primary k-btn-breit" type="submit"><?= e(t('vergessen.knopf')) ?></button>
    </form>
    <p class="k-links"><a href="<?= e(url('login')) ?>"><?= e(t('link.zurueck')) ?></a></p>
  </div>
</div>
