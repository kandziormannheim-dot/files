<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('rechnungen')) ?>">← Rechnungen</a><h1 class="h1 mono"><?= e($r['nummer']) ?></h1></div>
  <div class="kopf-aktionen"><?= statusPille((string) $r['status'], rechnungStatusName((string) $r['status'])) ?> <a class="knopf knopf--primaer" href="<?= e(url('rechnungen/' . $r['id'] . '.pdf')) ?>" target="_blank" rel="noopener">PDF öffnen</a></div>
</header>
<div class="spalten spalten--2-1">
  <div class="karte karte--tabelle">
    <div class="karte-kopf"><h2 class="h2">Positionen (<?= count($positionen) ?>)</h2><a href="<?= e(url('kunden/firmen/' . $r['firma_id'])) ?>"><?= e($firma['name'] ?? '') ?> →</a></div>
    <div class="scrollen"><table class="tabelle tabelle--kompakt">
      <thead><tr><th>Datum</th><th>Sendung</th><th>Referenz</th><th>Ziel</th><th>Carrier</th><th class="rechts">Netto</th></tr></thead>
      <tbody>
      <?php foreach ($positionen as $p) { ?>
        <tr><td class="leise"><?= e(datumAnzeigen($p['erstellt'])) ?></td><td><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $p['ext_ref'])) ?>"><?= e($p['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($p['ext_ref']) ?></span><?php } ?></td><td><?= e($p['referenz'] ?: '—') ?></td><td><span class="flagge"><?= e($p['zielland']) ?></span><?= e($p['gewichtsklasse']) ?></td><td><?= e($p['carrier'] ?? '—') ?></td><td class="mono rechts"><?= e(euro((int) $p['netto_cent'])) ?></td></tr>
      <?php } ?>
      </tbody>
    </table></div>
  </div>
  <div>
    <div class="karte karte--ink">
      <dl class="liste liste--ink">
        <dt>Firma</dt><dd><?= e($r['firma']) ?></dd>
        <dt>Zeitraum</dt><dd><?= e(datumAnzeigen($r['zeitraum_von'])) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1))) ?></dd>
        <dt>Netto</dt><dd class="mono"><?= e(euro((int) $r['netto_cent'])) ?></dd>
        <dt>MwSt.</dt><dd class="mono"><?= e(euro((int) $r['mwst_cent'])) ?></dd>
        <dt>Brutto</dt><dd class="mono"><strong><?= e(euro((int) $r['brutto_cent'])) ?></strong></dd>
        <dt>Fällig</dt><dd><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z')) ?></dd>
        <dt>Erstellt</dt><dd><?= e(zeitAnzeigen($r['erstellt'])) ?> von <?= e($r['erstellt_von']) ?></dd>
      </dl>
    </div>
    <?php if (darf('rechnungen', 'bearbeiten')) { ?>
    <div class="karte">
      <h2 class="h2">Status</h2>
      <?php foreach (['bezahlt' => 'Als bezahlt markieren', 'offen' => 'Wieder öffnen', 'storniert' => 'Stornieren (Sendungen wieder abrechenbar)'] as $s => $text) { if ($s === $r['status']) { continue; } ?>
        <form method="post" action="<?= e(url('rechnungen/' . $r['id'] . '/status')) ?>" class="aktion" <?= $s === 'storniert' ? 'data-bestaetigen="Rechnung ' . e($r['nummer']) . ' stornieren?"' : '' ?>><?= csrfFeld() ?><input type="hidden" name="status" value="<?= $s ?>"><button class="knopf <?= $s === 'storniert' ? 'knopf--gefahr' : 'knopf--leise' ?> knopf--breit" type="submit"><?= e($text) ?></button></form>
      <?php } ?>
    </div>
    <?php } ?>
  </div>
</div>
