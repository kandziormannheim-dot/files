<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('preise.titel')) ?></h1><p class="k-text"><?= e(!empty($eigene) ? t('preise.eigene') : t('preise.text')) ?></p></div>
</header>
<div class="card k-karte-tabelle">
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('liste.ziel')) ?></th><th><?= e(t('liste.carrier')) ?></th><th><?= e(t('detail.laufzeit')) ?></th><?php foreach ($preise['gewichtsklassen'] as $gk) { ?><th><?= e($gk[$sp]) ?></th><?php } ?></tr></thead>
    <tbody>
    <?php foreach ($preise['laender'] as $code => $land) { ?>
      <tr>
        <td><span class="flag"><?= e($code) ?></span><?= e($land['name'][$sp]) ?></td>
        <td><?= e($land['carrier']) ?></td>
        <td><?= e($land['laufzeit'][$sp]) ?></td>
        <?php foreach ($preise['gewichtsklassen'] as $gkCode => $_) { $z = $land['klassen'][$gkCode] ?? null; ?><td class="k-mono"><?= $z !== null ? e(euro((int) $z['netto'], $sp)) : '—' ?></td><?php } ?>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
</div>
<?php if (!empty($zusatz)) { ?>
<div class="card k-karte-tabelle" style="margin-top:1rem">
  <h2 class="h3"><?= e(t('preise.zusatz')) ?></h2>
  <table class="table k-tabelle">
    <tbody>
    <?php foreach ($zusatz as $z) { ?><tr><td><strong><?= e($z['name'][$sp]) ?></strong><br><span class="k-klein"><?= e($z['beschreibung'][$sp]) ?></span></td><td class="k-mono"><?= e(euro((int) $z['preis'], $sp)) ?></td></tr><?php } ?>
    </tbody>
  </table>
</div>
<?php } ?>
