<?php $sp = sprache(); $listenPfad = kundeAktuell()['art'] === 'business' ? 'sendungen' : 'bestellungen'; ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url($listenPfad . '/' . $b['ext_ref'])) ?>"><?= e(t('detail.zurueck')) ?></a><h1 class="h2"><?= e(t('bezahlen.titel')) ?></h1><p class="k-text"><?= e(t('bezahlen.text', $b['ext_ref'], $b['carrier'])) ?></p></div>
</header>
<div class="k-spalten k-spalten--2-1">
  <div class="card card--ink k-bezahlen" data-bezahlen data-ref="<?= e($b['ext_ref']) ?>" data-token-url="<?= e(url($listenPfad . '/' . $b['ext_ref'] . '/token')) ?>" data-status-url="<?= e(url($listenPfad . '/' . $b['ext_ref'] . '/status')) ?>" data-weiter="<?= e(url($listenPfad . '/' . $b['ext_ref'])) ?>" data-csrf="<?= e(csrfWert()) ?>" data-modus="<?= e($modus) ?>" data-email="<?= e($b['email']) ?>" data-name="<?= e(json_decode((string) $b['absender_json'], true)['name'] ?? '') ?>" data-zurueck="<?= $zurueck ? '1' : '' ?>"
       data-msg-warten="<?= e(t('bezahlen.warten')) ?>" data-msg-erfolg="<?= e(t('bezahlen.erfolg')) ?>" data-msg-abbruch="<?= e(t('bezahlen.abbruch')) ?>" data-msg-fehler="<?= e(t('bezahlen.fehler')) ?>" data-msg-unavailable="<?= e(t('bezahlen.unavailable')) ?>">
    <span class="eyebrow eyebrow--cyan"><?= e(t('neu.summe.brutto')) ?></span>
    <div class="k-summe-wert k-mono"><?= e(euro((int) $b['betrag_cent'], $sp)) ?></div>
    <dl class="k-liste k-liste--ink">
      <dt><?= e(t('neu.summe.netto')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['netto_cent'], $sp)) ?></dd>
      <dt><?= e(t('neu.summe.mwst')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['mwst_cent'], $sp)) ?></dd>
      <dt><?= e(t('liste.status')) ?></dt><dd data-status-text><?= e(t('bezahlen.offen')) ?></dd>
    </dl>
    <p class="k-hinweis k-hinweis--fehler" data-fehler hidden></p>
    <?php if ($zahlungBereit) { ?>
      <button class="btn btn--primary k-btn-breit" type="button" data-bezahlen-knopf><?= e(t('bezahlen.knopf')) ?></button>
    <?php } else { ?>
      <p class="k-hinweis k-hinweis--fehler"><?= e(t('bezahlen.unavailable')) ?></p>
    <?php } ?>
  </div>
  <div class="card">
    <h2 class="h3"><?= e(t('nav.guthaben')) ?></h2>
    <p class="k-text" style="margin:.5rem 0 1rem"><?= e(t('bezahlen.guthaben', euro($guthaben, $sp))) ?></p>
    <form method="post" action="<?= e(url($listenPfad . '/' . $b['ext_ref'] . '/guthaben')) ?>"><?= csrfFeld() ?><button class="btn btn--sm btn--ink" type="submit" <?= $guthaben >= (int) $b['betrag_cent'] ? '' : 'disabled' ?>><?= e(t('nav.guthaben')) ?> →</button></form>
  </div>
</div>
