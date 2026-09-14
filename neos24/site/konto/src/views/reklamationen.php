<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('reklamationen.titel')) ?></h1><p class="k-text"><?= e(t('reklamationen.text')) ?></p></div>
</header>
<div class="card k-karte-tabelle">
  <?php if ($zeilen === []) { ?><p class="k-leer"><?= e(t('reklamationen.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('liste.datum')) ?></th><th><?= e(t('liste.nummer')) ?></th><th><?= e(t('reklamationen.art')) ?></th><th><?= e(t('liste.status')) ?></th><th><?= e(t('reklamationen.betrag')) ?></th><th><?= e(t('reklamationen.antwort')) ?></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $r) { ?>
      <tr>
        <td class="k-klein"><?= e(datumAnzeigen($r['erstellt'], $sp)) ?></td>
        <td><a class="k-mono" href="<?= e(url($pfad . '/' . $r['ext_ref'])) ?>"><?= e($r['ext_ref']) ?></a></td>
        <td><?= e(REKLAMATION_ARTEN[$r['art']][$sp] ?? $r['art']) ?><br><span class="k-klein"><?= e(mb_substr((string) $r['beschreibung'], 0, 80)) ?><?= mb_strlen((string) $r['beschreibung']) > 80 ? '…' : '' ?></span></td>
        <td><span class="status status--rk-<?= e($r['status']) ?>"><?= e(REKLAMATION_STATUS[$r['status']][$sp] ?? $r['status']) ?></span></td>
        <td class="k-mono"><?= (int) $r['betrag_cent'] > 0 ? e(euro((int) $r['betrag_cent'], $sp)) : '—' ?><?= (int) $r['erstattung_cent'] > 0 ? '<br><span class="k-klein">' . e(t('reklamationen.erstattung')) . ': ' . e(euro((int) $r['erstattung_cent'], $sp)) . '</span>' : '' ?></td>
        <td class="k-klein"><?= $r['antwort'] !== '' ? nl2br(e($r['antwort'])) : '—' ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
