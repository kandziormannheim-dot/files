<?php $sp = sprache(); ?>
<div class="k-gast k-gast--breit">
  <div class="card k-gast-karte">
    <span class="eyebrow eyebrow--cyan"><?= e(t('nav.tracking')) ?></span>
    <h1 class="h2"><?= e(t('tracking.titel')) ?></h1>
    <p class="k-text"><?= e(t('tracking.text')) ?></p>
    <form method="get" action="<?= e(url('tracking')) ?>" class="form k-form" novalidate>
      <input type="hidden" name="sprache" value="<?= e($sp) ?>">
      <div class="form-row form-row--2">
        <div class="field"><label for="nr"><?= e(t('tracking.nummer')) ?></label><input id="nr" name="nr" type="text" value="<?= e($nr) ?>" placeholder="NE-2026-XXXXXXXX" required></div>
        <div class="field"><label for="plz"><?= e(t('tracking.plz')) ?></label><input id="plz" name="plz" type="text" value="<?= e($plz) ?>" required></div>
      </div>
      <button class="btn btn--primary" type="submit"><?= e(t('tracking.knopf')) ?></button>
    </form>
    <?php if ($gesucht && $ergebnis === null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e(t('tracking.nichts')) ?></p><?php } ?>
    <?php if ($ergebnis !== null) { ?>
      <div class="k-tracking">
        <div class="k-tracking-kopf">
          <div><span class="k-klein"><?= e(t('tracking.status')) ?></span><br><strong class="k-tracking-status"><?= e($ergebnis['status_text']) ?></strong></div>
          <div class="k-klein"><span class="k-mono"><?= e($ergebnis['nummer']) ?></span> · <?= e($ergebnis['carrier'] ?? '') ?> · <span class="flag"><?= e($ergebnis['zielland']) ?></span><?= e($ergebnis['empfaenger_ort']) ?></div>
        </div>
        <h2 class="h3"><?= e(t('tracking.verlauf')) ?></h2>
        <ol class="k-verlauf">
          <?php foreach (array_reverse($ergebnis['ereignisse']) as $ev) { ?><li><span class="k-mono k-klein"><?= e(zeitAnzeigen($ev['zeit'], $sp)) ?></span> <?= e($ev['text']) ?><?= $ev['ort'] !== '' ? ' <span class="k-klein">· ' . e($ev['ort']) . '</span>' : '' ?></li><?php } ?>
        </ol>
        <p class="k-klein"><?= e(t('tracking.hinweis')) ?></p>
      </div>
    <?php } ?>
  </div>
</div>
