<div class="k-gast">
  <div class="card k-gast-karte">
    <span class="eyebrow eyebrow--cyan">✉</span>
    <h1 class="h2"><?= e(t('link.titel')) ?></h1>
    <p class="k-text"><?= e(t('link.text', $email, $minuten)) ?></p>
    <p><a class="btn btn--ink" href="<?= e(url('login')) ?>"><?= e(t('link.zurueck')) ?></a></p>
  </div>
</div>
