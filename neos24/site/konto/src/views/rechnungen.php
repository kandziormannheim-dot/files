<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('rechnungen.titel')) ?></h1><p class="k-text"><?= e(t('rechnungen.text')) ?></p></div>
</header>
<div class="card k-karte-tabelle">
  <?php if ($zeilen === []) { ?><p class="k-leer"><?= e(t('rechnungen.keine')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('rechnungen.nummer')) ?></th><th><?= e(t('liste.status')) ?></th><th><?= e(t('rechnungen.zeitraum')) ?></th><th><?= e(t('rechnungen.positionen')) ?></th><th><?= e(t('detail.netto')) ?></th><th><?= e(t('detail.brutto')) ?></th><th><?= e(t('rechnungen.faellig')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $r) { ?>
      <tr>
        <td><a class="k-mono" href="<?= e(url('rechnungen/' . $r['nummer'])) ?>"><?= e($r['nummer']) ?></a><br><span class="k-klein"><?= e(datumAnzeigen($r['erstellt'], $sp)) ?></span></td>
        <td><?= statusPille((string) $r['status'], t('rechnungen.status.' . $r['status'])) ?></td>
        <td><?= e(datumAnzeigen($r['zeitraum_von'], $sp)) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1), $sp)) ?></td>
        <td class="k-mono"><?= (int) $r['positionen'] ?></td>
        <td class="k-mono"><?= e(euro((int) $r['netto_cent'], $sp)) ?></td>
        <td class="k-mono"><strong><?= e(euro((int) $r['brutto_cent'], $sp)) ?></strong></td>
        <td><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z', $sp)) ?></td>
        <td><a class="btn btn--sm k-btn-leise" href="<?= e(url('rechnungen/' . $r['nummer'] . '.pdf')) ?>"><?= e(t('rechnungen.pdf')) ?> ↓</a></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
