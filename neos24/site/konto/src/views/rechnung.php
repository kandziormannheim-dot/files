<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url('rechnungen')) ?>"><?= e(t('detail.zurueck')) ?></a><h1 class="h2 k-mono"><?= e($r['nummer']) ?></h1></div>
  <div><?= statusPille((string) $r['status'], t('rechnungen.status.' . $r['status'])) ?> <a class="btn btn--sm btn--ink" href="<?= e(url('rechnungen/' . $r['nummer'] . '.pdf')) ?>"><?= e(t('rechnungen.pdf')) ?> ↓</a></div>
</header>
<div class="k-spalten k-spalten--2-1">
  <div class="card k-karte-tabelle">
    <h2 class="h3"><?= e(t('rechnungen.positionen')) ?> (<?= count($positionen) ?>)</h2>
    <div class="k-scroll"><table class="table k-tabelle">
      <thead><tr><th><?= e(t('liste.datum')) ?></th><th><?= e(t('liste.nummer')) ?></th><th><?= e(t('liste.referenz')) ?></th><th><?= e(t('liste.ziel')) ?></th><th><?= e(t('liste.carrier')) ?></th><th><?= e(t('detail.netto')) ?></th></tr></thead>
      <tbody>
      <?php foreach ($positionen as $p) { ?>
        <tr><td><?= e(datumAnzeigen($p['erstellt'], $sp)) ?></td><td><a class="k-mono" href="<?= e(url('sendungen/' . $p['ext_ref'])) ?>"><?= e($p['ext_ref']) ?></a></td><td><?= e($p['referenz'] ?: '—') ?></td><td><span class="flag"><?= e($p['zielland']) ?></span><?= e($p['gewichtsklasse']) ?></td><td><?= e($p['carrier'] ?? '—') ?></td><td class="k-mono"><?= e(euro((int) $p['netto_cent'], $sp)) ?></td></tr>
      <?php } ?>
      </tbody>
    </table></div>
  </div>
  <div class="card card--ink">
    <dl class="k-liste k-liste--ink">
      <dt><?= e(t('rechnungen.zeitraum')) ?></dt><dd><?= e(datumAnzeigen($r['zeitraum_von'], $sp)) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1), $sp)) ?></dd>
      <dt><?= e(t('detail.netto')) ?></dt><dd class="k-mono"><?= e(euro((int) $r['netto_cent'], $sp)) ?></dd>
      <dt><?= e(t('detail.mwst')) ?></dt><dd class="k-mono"><?= e(euro((int) $r['mwst_cent'], $sp)) ?></dd>
      <dt><?= e(t('detail.brutto')) ?></dt><dd class="k-mono"><strong><?= e(euro((int) $r['brutto_cent'], $sp)) ?></strong></dd>
      <dt><?= e(t('rechnungen.faellig')) ?></dt><dd><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z', $sp)) ?></dd>
    </dl>
  </div>
</div>
