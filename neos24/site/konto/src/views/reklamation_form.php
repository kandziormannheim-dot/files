<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url($pfad . '/' . $b['ext_ref'])) ?>"><?= e(t('detail.zurueck')) ?></a><h1 class="h2"><?= e($titel) ?></h1><p class="k-text"><?= e(t('reklamationen.text')) ?></p></div>
</header>
<div class="k-spalten k-spalten--2-1">
  <div class="card">
    <?php if ($fehler !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="<?= e(url($pfad . '/' . $b['ext_ref'] . '/reklamation')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <div class="form-row form-row--2">
        <div class="field"><label for="rk-art"><?= e(t('reklamationen.art')) ?></label><select id="rk-art" name="art" required><option value=""><?= e(t('neu.bitte_waehlen')) ?></option><?php foreach (REKLAMATION_ARTEN as $code => $n) { if ($code === 'nachberechnung' && $b['art'] !== 'nachberechnung') { continue; } ?><option value="<?= e($code) ?>" <?= $werte['art'] === $code ? 'selected' : '' ?>><?= e($n[$sp]) ?></option><?php } ?></select></div>
        <div class="field"><label for="rk-betrag"><?= e(t('reklamationen.betrag')) ?></label><input id="rk-betrag" name="betrag" type="text" inputmode="decimal" value="<?= e($werte['betrag']) ?>"></div>
      </div>
      <div class="field"><label for="rk-text"><?= e(t('reklamationen.beschreibung')) ?></label><textarea id="rk-text" name="beschreibung" rows="6" minlength="10" required><?= e($werte['beschreibung']) ?></textarea></div>
      <button class="btn btn--primary" type="submit"><?= e(t('reklamationen.knopf')) ?></button>
    </form>
  </div>
  <div class="card card--ink">
    <dl class="k-liste k-liste--ink">
      <dt><?= e(t('liste.nummer')) ?></dt><dd class="k-mono"><?= e($b['ext_ref']) ?></dd>
      <dt><?= e(t('liste.carrier')) ?></dt><dd><?= e($b['carrier'] ?? '—') ?></dd>
      <dt><?= e(t('detail.versandstatus')) ?></dt><dd><?= e(versandstatusName((string) $b['versandstatus'], $sp)) ?></dd>
    </dl>
  </div>
</div>
