<?php $ich = kundeAktuell(); $sp = sprache(); $business = $ich['art'] === 'business'; $belege = $archiv['belege']; ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('rechnungen.titel')) ?></h1><p class="k-text"><?= e(t('archiv.text')) ?></p></div>
</header>
<form class="k-werkzeuge" method="get" action="<?= e(url('rechnungen')) ?>">
  <input type="search" name="q" value="<?= e($q) ?>" placeholder="<?= e(t('archiv.suche')) ?>" aria-label="<?= e(t('archiv.suche')) ?>">
  <select name="jahr" aria-label="<?= e(t('archiv.jahr')) ?>">
    <option value=""><?= e(t('archiv.jahr.alle')) ?></option>
    <?php foreach ($archiv['jahre'] as $j) { ?><option value="<?= e($j) ?>" <?= $jahr !== null && (string) $jahr === $j ? 'selected' : '' ?>><?= e($j) ?></option><?php } ?>
  </select>
  <select name="art" aria-label="<?= e(t('archiv.art')) ?>">
    <option value=""><?= e(t('archiv.art.alle')) ?></option>
    <?php foreach (BELEG_ARTEN as $a) { if ($a === 'sammelrechnung' && !$business) { continue; } ?><option value="<?= e($a) ?>" <?= $art === $a ? 'selected' : '' ?>><?= e(t('archiv.art.' . $a)) ?></option><?php } ?>
  </select>
  <button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('liste.filter')) ?></button>
</form>
<div class="card k-karte-tabelle">
  <?php if ($belege === []) { ?><p class="k-leer"><?= e($q !== '' || $jahr !== null || $art !== '' ? t('liste.leer') : t('archiv.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('liste.datum')) ?></th><th><?= e(t('archiv.beleg')) ?></th><th><?= e(t('archiv.art')) ?></th><th><?= e(t('archiv.bezug')) ?></th><?php if ($business && ($unterkunden ?? []) !== []) { ?><th><?= e(t('kundennummer')) ?></th><?php } ?><th><?= e(t('archiv.betrag')) ?></th><th><?= e(t('liste.status')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($belege as $x) { ?>
      <tr>
        <td class="k-klein"><?= e(datumAnzeigen($x['datum'], $sp)) ?></td>
        <td><?php if ($x['art'] === 'sammelrechnung' && $x['nummer'] !== '') { ?><a class="k-mono" href="<?= e(url($x['detail'])) ?>"><?= e($x['nummer']) ?></a><?php } else { ?><span class="k-mono"><?= e($x['nummer'] !== '' ? $x['nummer'] : t('archiv.folgt')) ?></span><?php } ?></td>
        <td><?= e(t('archiv.art.' . $x['art'])) ?></td>
        <td><?php if ($x['ext_ref'] !== '') { ?><a class="k-mono" href="<?= e(url($x['detail'])) ?>"><?= e($x['bezug']) ?></a><?php } else { ?><?= e($x['bezug']) ?><?= $x['empfaenger'] !== '' ? '<br><span class="k-klein">' . e($x['empfaenger']) . '</span>' : '' ?><?php } ?></td>
        <?php if ($business && ($unterkunden ?? []) !== []) { ?><td class="k-klein k-mono"><?= e($x['kundennummer']) ?></td><?php } ?>
        <td class="k-mono"><?= $x['betrag_cent'] === null ? '—' : ((int) $x['betrag_cent'] < 0 ? '−' : '') . e(euro(abs((int) $x['betrag_cent']), $sp)) ?><?= $x['art'] !== 'nachweis' && $business ? ' <span class="k-klein">' . e(t('liste.netto')) . '</span>' : '' ?></td>
        <td><?= $x['art'] === 'nachweis' ? '' : statusPille((string) $x['status'], $x['status'] === 'gutschrift' ? t('archiv.status.gutschrift') : t('rechnungen.status.' . $x['status'])) ?></td>
        <td class="k-aktionen"><?php if ($x['pdf'] !== '') { ?><a class="btn btn--sm k-btn-leise" href="<?= e(url($x['pfad'])) ?>" target="_blank" rel="noopener"><?= e(t('rechnungen.pdf')) ?> ↓</a><?php } else { ?><span class="k-klein"><?= e(t('archiv.folgt')) ?></span><?php } ?></td>
      </tr>
    <?php } ?>
    </tbody>
    <tfoot><tr><td colspan="<?= $business && ($unterkunden ?? []) !== [] ? 5 : 4 ?>" class="k-klein"><?= e(t('archiv.summe')) ?></td><td class="k-mono"><strong><?= ($archiv['summe_cent'] < 0 ? '−' : '') . e(euro(abs((int) $archiv['summe_cent']), $sp)) ?></strong></td><td colspan="2"></td></tr></tfoot>
  </table></div>
  <?php } ?>
</div>
