<?php
$ich = kundeAktuell(); $sp = sprache(); $business = $ich['art'] === 'business';
$abs = json_decode((string) $b['absender_json'], true) ?: [];
$emp = json_decode((string) $b['empfaenger_json'], true) ?: [];
$landInfo = preisliste()['laender'][$b['zielland']] ?? null;
$land = $landInfo['name'][$sp] ?? $b['zielland'];
$laufzeit = $landInfo['klassen'][$b['gewichtsklasse']]['laufzeit'][$sp] ?? '—';
?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url($pfad)) ?>"><?= e(t('detail.zurueck')) ?></a><h1 class="h2 k-mono"><?= e($b['ext_ref']) ?></h1></div>
  <div><?= statusPille((string) $b['status'], statusName((string) $b['status'], $sp)) ?></div>
</header>
<div class="k-spalten k-spalten--2-1">
  <div>
    <div class="card">
      <div class="k-karte-kopf"><h2 class="h3"><?= e(t('detail.sendung')) ?></h2><span class="k-klein"><?= e(zeitAnzeigen($b['erstellt'], $sp)) ?></span></div>
      <dl class="k-liste">
        <dt><?= e(t('liste.ziel')) ?></dt><dd><span class="flag"><?= e($b['zielland']) ?></span><?= e($land) ?></dd>
        <dt><?= e(t('detail.gewicht')) ?></dt><dd><?= e(preisliste()['gewichtsklassen'][$b['gewichtsklasse']][$sp] ?? $b['gewichtsklasse']) ?></dd>
        <dt><?= e(t('liste.carrier')) ?></dt><dd><?= e($b['carrier'] ?? '—') ?></dd>
        <dt><?= e(t('detail.laufzeit')) ?></dt><dd><?= e($laufzeit) ?></dd>
        <?php if ($business) { ?><dt><?= e(t('liste.referenz')) ?></dt><dd><?= e($b['referenz'] ?: '—') ?></dd><dt><?= e(t('liste.angelegt_von')) ?></dt><dd><?= e($b['angelegt_von'] ?? '—') ?></dd><?php } ?>
      </dl>
    </div>
    <div class="k-spalten k-spalten--2">
      <div class="card"><h2 class="h3"><?= e(t('detail.absender')) ?></h2><p class="k-text"><strong><?= e($abs['name'] ?? '') ?></strong><br><?= e($abs['strasse'] ?? '') ?><br><?= e(trim(($abs['plz'] ?? '') . ' ' . ($abs['ort'] ?? ''))) ?></p></div>
      <div class="card"><h2 class="h3"><?= e(t('detail.empfaenger')) ?></h2><p class="k-text"><strong><?= e($emp['name'] ?? '') ?></strong><br><?= e($emp['strasse'] ?? '') ?><br><?= e(trim(($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''))) ?><br><?= e($land) ?></p></div>
    </div>
    <div class="card">
      <h2 class="h3"><?= e(t('detail.verlauf')) ?></h2>
      <ol class="k-verlauf">
        <?php foreach (array_reverse(kundenVerlauf($b)) as $v) { ?><li><span class="k-mono k-klein"><?= e(zeitAnzeigen($v['zeit'], $sp)) ?></span> <?= e($v['text']) ?></li><?php } ?>
      </ol>
    </div>
  </div>
  <div>
    <div class="card card--ink">
      <h2 class="h3"><?= e(t('detail.zahlung')) ?></h2>
      <dl class="k-liste k-liste--ink">
        <?php if ($business) { ?>
          <dt><?= e(t('detail.netto')) ?></dt><dd class="k-mono"><strong><?= e(euro((int) $b['netto_cent'], $sp)) ?></strong></dd>
          <dt><?= e(t('detail.zahlung')) ?></dt><dd><?= e(t('detail.zahlung.rechnung')) ?></dd>
          <dt><?= e(t('detail.rechnung')) ?></dt><dd><?= $b['rechnung_nummer'] ? '<a href="' . e(url('rechnungen/' . $b['rechnung_nummer'])) . '">' . e($b['rechnung_nummer']) . '</a>' : e(t('detail.rechnung.offen')) ?></dd>
        <?php } else { ?>
          <dt><?= e(t('detail.netto')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['netto_cent'], $sp)) ?></dd>
          <dt><?= e(t('detail.mwst')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['mwst_cent'], $sp)) ?></dd>
          <dt><?= e(t('detail.brutto')) ?></dt><dd class="k-mono"><strong><?= e(euro((int) $b['betrag_cent'], $sp)) ?></strong></dd>
          <dt><?= e(t('detail.zahlung')) ?></dt><dd><?= e(t('detail.zahlung.revolut')) ?></dd>
        <?php } ?>
      </dl>
    </div>
    <div class="card">
      <h2 class="h3"><?= e(t('detail.label')) ?></h2>
      <p class="k-text"><?= e(t('detail.label.text', $b['ext_ref'])) ?></p>
    </div>
  </div>
</div>
