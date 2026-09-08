<?php
$darfB = darf('routing', 'bearbeiten');
$aktiveKlassen = array_filter($klassen, static fn (array $g): bool => (int) $g['aktiv'] === 1);
?>
<header class="kopfzeile">
  <div><span class="eyebrow">Routingmatrix</span><h1 class="h1">Zielland × Gewichtsklasse → Carrier</h1></div>
  <p class="leise">Je Zelle bis zu drei Carrier nach Priorität. Priorität 1 steht auf der Startseite und im Checkout; fällt sie aus, rückt die nächste nach. Verkauf netto, Privatkunden + <?= $mwst ?> % MwSt.</p>
</header>
<div class="karte karte--tabelle">
  <?php if ($aktiveKlassen === []) { ?><p class="leer">Keine aktive Gewichtsklasse — unter <a href="<?= e(url('preise')) ?>">Preise &amp; Zielländer</a> anlegen.</p><?php } else { ?>
  <div class="scrollen">
  <table class="tabelle matrix">
    <thead><tr><th>Zielland</th><?php foreach ($klassen as $g) { ?><th class="<?= (int) $g['aktiv'] === 1 ? '' : 'inaktiv' ?>"><?= e($g["name_de"]) ?> <span class="mono leise" style="text-transform:none"><?= e($g['code']) ?></span></th><?php } ?></tr></thead>
    <tbody>
    <?php foreach ($laender as $l) { ?>
      <tr class="<?= (int) $l['aktiv'] === 1 ? '' : 'inaktiv' ?>">
        <th scope="row"><span class="flagge"><?= e($l['code']) ?></span><?= e($l['name_de']) ?><?= (int) $l['aktiv'] === 1 ? '' : ' <span class="pille">inaktiv</span>' ?></th>
        <?php foreach ($klassen as $g) { $z = $matrix[$l['code']][$g['code']] ?? null; $ziel = url('routing/zelle', ['land' => $l['code'], 'gk' => $g['code']]); ?>
          <td class="zelle <?= $z === null || $z['carrier'] === null ? 'zelle--leer' : '' ?>">
            <a href="<?= e($ziel) ?>" class="zelle-link" aria-label="<?= e($l['code'] . ' ' . $g['code']) ?> bearbeiten">
              <?php if ($z === null || $z['carrier'] === null) { ?>
                <span class="leise"><?= $darfB ? '+ anbieten' : 'nicht angeboten' ?></span>
              <?php } else { ?>
                <strong><?= e($z['carrier']) ?></strong>
                <span class="mono"><?= e(euro($z['verkauf'])) ?> <span class="leise">/ <?= e(euro((int) round($z['verkauf'] * (100 + $mwst) / 100))) ?> brutto</span></span>
                <span class="leise">Marge <?= e(euro($z['verkauf'] - $z['einkauf'])) ?><?= $z['fallback'] !== [] ? ' · Fallback: ' . e(implode(', ', $z['fallback'])) : '' ?></span>
              <?php } ?>
            </a>
          </td>
        <?php } ?>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
  <?php } ?>
</div>
