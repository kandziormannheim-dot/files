<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('guthaben.titel')) ?></h1><p class="k-text"><?= e(t('guthaben.text')) ?></p></div>
</header>
<div class="k-spalten k-spalten--2-1">
  <div>
    <div class="card k-kachel k-kachel--gelb"><span class="k-kachel-name"><?= e(t('guthaben.stand')) ?></span><strong class="k-kachel-wert" data-guthaben-stand><?= e(euro($stand, $sp)) ?></strong></div>
    <div class="card k-karte-tabelle">
      <div class="k-karte-kopf"><h2 class="h3"><?= e(t('guthaben.buchungen')) ?></h2></div>
      <?php if ($buchungen === []) { ?><p class="k-leer"><?= e(t('guthaben.keine')) ?></p><?php } else { ?>
      <div class="k-scroll"><table class="table k-tabelle">
        <thead><tr><th><?= e(t('liste.datum')) ?></th><th><?= e(t('adressbuch.art')) ?></th><th></th><th><?= e(t('liste.betrag')) ?></th></tr></thead>
        <tbody>
        <?php foreach ($buchungen as $g) { ?>
          <tr><td class="k-klein"><?= e(zeitAnzeigen($g['zeit'], $sp)) ?></td><td><?= e(t('guthaben.art.' . $g['art'])) ?></td><td><?= $g['ext_ref'] ? '<a class="k-mono" href="' . e(url((kundeAktuell()['art'] === 'business' ? 'sendungen/' : 'bestellungen/') . $g['ext_ref'])) . '">' . e($g['ext_ref']) . '</a>' : e($g['text']) ?></td><td class="k-mono <?= (int) $g['betrag_cent'] < 0 ? 'k-minus' : 'k-plus' ?>"><?= (int) $g['betrag_cent'] > 0 ? '+' : '' ?><?= e(euro((int) $g['betrag_cent'], $sp)) ?></td></tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
    </div>
  </div>
  <div class="card card--ink k-aufladen" data-aufladen data-url="<?= e(url('guthaben/aufladen')) ?>" data-status-url="<?= e(url('guthaben/status')) ?>" data-csrf="<?= e(csrfWert()) ?>" data-modus="<?= e($modus) ?>" data-email="<?= e(kundeAktuell()['email']) ?>" data-name="<?= e(kundeAktuell()['name']) ?>" data-rueck="<?= e($rueck) ?>"
       data-msg-warten="<?= e(t('bezahlen.warten')) ?>" data-msg-erfolg="<?= e(t('guthaben.aufgeladen')) ?>" data-msg-abbruch="<?= e(t('bezahlen.abbruch')) ?>" data-msg-fehler="<?= e(t('bezahlen.fehler')) ?>" data-msg-unavailable="<?= e(t('bezahlen.unavailable')) ?>" data-msg-betrag="<?= e(t('guthaben.min')) ?>">
    <h2 class="h3"><?= e(t('guthaben.aufladen')) ?></h2>
    <div class="k-betraege">
      <?php foreach ([2500, 5000, 10000, 25000] as $c) { ?><button type="button" class="btn btn--sm k-btn-leise" data-betrag="<?= $c ?>"><?= e(euro($c, $sp)) ?></button><?php } ?>
    </div>
    <div class="field"><label for="g-betrag"><?= e(t('guthaben.eigener')) ?></label><input id="g-betrag" type="text" inputmode="decimal" value="50,00" data-betrag-feld></div>
    <p class="k-klein"><?= e(t('guthaben.min')) ?></p>
    <p class="k-hinweis k-hinweis--fehler" data-fehler hidden></p>
    <p class="k-hinweis k-hinweis--ok" data-ok hidden></p>
    <?php if ($zahlungBereit) { ?><button class="btn btn--primary k-btn-breit" type="button" data-aufladen-knopf><?= e(t('guthaben.aufladen.knopf')) ?></button><?php } else { ?><p class="k-hinweis k-hinweis--fehler"><?= e(t('bezahlen.unavailable')) ?></p><?php } ?>
  </div>
</div>
