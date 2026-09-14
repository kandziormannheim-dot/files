<?php $sp = sprache(); $darf = $darf ?? false; ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url('benutzer')) ?>">← <?= e(t('benutzer.titel')) ?></a><h1 class="h2"><?= e(t('gruppen.titel')) ?></h1><p class="k-text"><?= e(t('gruppen.text')) ?></p></div>
  <?php if ($darf) { ?><a class="btn btn--primary" href="<?= e(url('benutzer/gruppen/neu')) ?>"><?= e(t('gruppen.neu')) ?></a><?php } ?>
</header>
<div class="card k-karte-tabelle">
  <div class="k-scroll"><table class="table k-tabelle k-matrix">
    <thead><tr><th><?= e(t('gruppen.name')) ?></th><?php foreach (KUNDEN_BEREICHE as $bereich) { ?><th><?= e(t('gruppen.bereich.' . $bereich)) ?></th><?php } ?><th><?= e(t('gruppen.benutzer_anzahl')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($gruppen as $g) { ?>
      <tr>
        <td><?php if ($darf) { ?><a href="<?= e(url('benutzer/gruppen/' . $g['id'])) ?>"><?= e($g['name']) ?></a><?php } else { ?><?= e($g['name']) ?><?php } ?><?= $g['beschreibung'] !== '' ? '<br><span class="k-klein">' . e($g['beschreibung']) . '</span>' : '' ?></td>
        <?php foreach (KUNDEN_BEREICHE as $bereich) { $stufe = $g['rechte'][$bereich]; ?>
          <td><?php if ($stufe === '') { ?><span class="k-klein">—</span><?php } else { ?><span class="status <?= $stufe === 'bearbeiten' ? 'status--bezahlt' : 'status--offen' ?>"><?= e(t('gruppen.stufe.' . $stufe)) ?></span><?php } ?></td>
        <?php } ?>
        <td class="k-mono"><?= (int) $g['benutzer'] ?></td>
        <td class="k-aktionen"><?php if ($darf) { ?><form method="post" action="<?= e(url('benutzer/gruppen/' . $g['id'] . '/loeschen')) ?>" data-bestaetigen="<?= e(t('gruppen.loeschen.bestaetigen', $g['name'])) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-gefahr" type="submit"><?= e(t('adressbuch.loeschen')) ?></button></form><?php } ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <p class="k-klein" style="margin-top:.75rem"><?= e(t('gruppen.hinweis')) ?></p>
</div>
