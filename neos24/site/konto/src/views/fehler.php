<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e((string) $code) ?></span><h1 class="h2"><?= e($titel) ?></h1></div>
</header>
<div class="card">
  <p class="k-text"><?= e($text) ?></p>
  <p style="margin-top:1rem"><a class="btn btn--ink" href="<?= e(url()) ?>"><?= e(t('fehler.zur_uebersicht')) ?></a></p>
</div>
