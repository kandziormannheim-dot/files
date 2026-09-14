<?php
/** Karte „Systeme“: Kundennummer, Lexware- und Odoo-Kennungen, offene Aufträge, „Jetzt abgleichen“. Erwartet $sync (syncKarte()) und $syncUrl. */
$s = $sync;
?>
<div class="karte">
  <div class="karte-kopf"><h2 class="h2">Systeme</h2><?php if (darf('kunden', 'bearbeiten') && ($s['lexware']['aktiv'] || $s['odoo']['aktiv'])) { ?><form method="post" action="<?= e($syncUrl) ?>"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--klein" type="submit">Jetzt abgleichen</button></form><?php } ?></div>
  <dl class="liste">
    <dt>Kundennummer</dt><dd class="mono"><strong><?= e($s['kundennummer'] ?: '—') ?></strong></dd>
    <?php if ($s['lexware']['aktiv'] || $s['lexware']['kontakt'] !== '') { ?><dt>Lexware</dt><dd><?= $s['lexware']['kontakt'] !== '' ? '<span class="ja">✓</span> Kunden-Nr. <span class="mono">' . e($s['lexware']['nummer'] ?: '—') . '</span>' . ($s['lexware']['zeit'] !== '' ? ' <span class="leise">' . e(zeitAnzeigen($s['lexware']['zeit'])) . '</span>' : '') : '<span class="leise">noch nicht übergeben</span>' ?></dd><?php } ?>
    <?php if ($s['odoo']['aktiv'] || $s['odoo']['id'] > 0) { ?><dt>Odoo</dt><dd><?= $s['odoo']['id'] > 0 ? '<span class="ja">✓</span> ' . ($s['odoo']['link'] !== '' ? '<a href="' . e($s['odoo']['link']) . '" target="_blank" rel="noopener">Partner #' . (int) $s['odoo']['id'] . '</a>' : 'Partner #' . (int) $s['odoo']['id']) . ($s['odoo']['zeit'] !== '' ? ' <span class="leise">' . e(zeitAnzeigen($s['odoo']['zeit'])) . '</span>' : '') : '<span class="leise">noch nicht übergeben</span>' ?></dd><?php } ?>
    <?php if (!$s['lexware']['aktiv'] && !$s['odoo']['aktiv']) { ?><dt>Abgleich</dt><dd class="leise">kein System aktiv</dd><?php } ?>
  </dl>
  <?php if ($s['offen'] !== []) { ?>
    <ul class="liste-punkte" style="margin-top:.5rem">
      <?php foreach ($s['offen'] as $a) { ?><li><?= $a['status'] === 'fehler' ? '<span class="pille pille--warn">Fehler</span>' : '<span class="pille">offen</span>' ?> <?= e(ucfirst($a['system'])) ?> <?= e($a['art']) ?><?= $a['fehler_text'] !== '' ? ' <span class="leise">' . e(mb_substr((string) $a['fehler_text'], 0, 120)) . '</span>' : '' ?></li><?php } ?>
    </ul>
  <?php } ?>
</div>
