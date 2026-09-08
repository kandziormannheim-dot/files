<div class="k-gast">
  <div class="card k-gast-karte">
    <span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span>
    <h1 class="h2"><?= e(t('login.titel')) ?></h1>
    <p class="k-text"><?= e(t('login.text')) ?></p>
    <?php if ($fehler !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="<?= e(url('login')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <input type="hidden" name="weiter" value="<?= e($weiter) ?>">
      <input type="hidden" name="sprache" value="<?= e(sprache()) ?>">
      <div class="field"><label for="email"><?= e(t('login.email')) ?></label><input id="email" name="email" type="email" autocomplete="username" value="<?= e($email) ?>" required autofocus></div>
      <div class="field"><label for="passwort"><?= e(t('login.passwort')) ?></label><input id="passwort" name="passwort" type="password" autocomplete="current-password"></div>
      <button class="btn btn--primary k-btn-breit" type="submit"><?= e(t('login.knopf')) ?></button>
    </form>
    <p class="k-oder"><span><?= e(t('login.oder')) ?></span></p>
    <form method="post" action="<?= e(url('link-senden')) ?>" class="form k-form" novalidate data-link-form>
      <?= csrfFeld() ?>
      <input type="hidden" name="sprache" value="<?= e(sprache()) ?>">
      <input type="hidden" name="email" value="">
      <button class="btn btn--ink k-btn-breit" type="submit"><?= e(t('login.link')) ?></button>
    </form>
    <p class="k-links"><a href="<?= e(url('passwort-vergessen')) ?>"><?= e(t('login.vergessen')) ?></a><a href="<?= e(url('registrieren')) ?>"><?= e(t('login.registrieren')) ?></a></p>
  </div>
</div>
