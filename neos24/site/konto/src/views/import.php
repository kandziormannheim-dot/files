<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('import.titel')) ?></h1><p class="k-text"><?= e(t('import.text')) ?></p></div>
  <a class="btn btn--sm k-btn-leise" href="<?= e(url('import/vorlage.csv')) ?>"><?= e(t('import.vorlage')) ?> ↓</a>
</header>
<?php if ($meldung !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($meldung) ?></p><?php } ?>
<?php if ($vorschau === null) { ?>
<div class="k-spalten k-spalten--2-1">
  <div class="card">
    <form method="post" action="<?= e(url('import')) ?>" enctype="multipart/form-data" class="form k-form">
      <?= csrfFeld() ?>
      <div class="field"><label for="datei"><?= e(t('import.datei')) ?></label><input id="datei" name="datei" type="file" accept=".csv,text/csv" required></div>
      <button class="btn btn--primary" type="submit"><?= e(t('import.pruefen')) ?></button>
    </form>
  </div>
  <div class="card card--ink"><p class="k-text"><?= e(t('import.spalten')) ?></p><?php if ($unterkunden !== []) { ?><p class="k-text" style="margin-top:.75rem"><?= e(t('import.unterkunde')) ?></p><?php } ?></div>
</div>
<?php } else { $ok = count(array_filter($vorschau, static fn (array $z): bool => $z['fehler'] === [])); ?>
<div class="card k-karte-tabelle">
  <div class="k-karte-kopf"><h2 class="h3"><?= e(t('import.vorschau')) ?></h2><span class="k-klein"><?= $ok ?> / <?= count($vorschau) ?> <?= e(t('import.ok')) ?></span></div>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('import.zeile')) ?></th><th><?= e(t('liste.ziel')) ?></th><th><?= e(t('neu.gewicht_kg')) ?></th><th><?= e(t('liste.empfaenger')) ?></th><th><?= e(t('liste.referenz')) ?></th><?php if ($unterkunden !== []) { ?><th><?= e(t('liste.fuer')) ?></th><?php } ?><th><?= e(t('liste.carrier')) ?></th><th><?= e(t('neu.zusatz')) ?></th><th><?= e(t('liste.netto')) ?></th><th><?= e(t('import.fehler')) ?></th></tr></thead>
    <tbody>
    <?php $uNummern = array_column($unterkunden, 'nummer', 'id'); foreach ($vorschau as $z) { $p = $z['p']; ?>
      <tr class="<?= $z['fehler'] !== [] ? 'k-fehlerzeile' : '' ?>">
        <td class="k-mono"><?= (int) $z['nr'] ?></td>
        <td><span class="flag"><?= e($p['zielland']) ?></span><?= e($z['gk'] ?? '') ?></td>
        <td class="k-mono"><?= e(number_format($p['gewicht_gramm'] / 1000, 2, $sp === 'en' ? '.' : ',', '')) ?></td>
        <td><?= e($p['empfaenger']['name']) ?><br><span class="k-klein"><?= e($p['empfaenger']['strasse']) ?>, <?= e(trim($p['empfaenger']['plz'] . ' ' . $p['empfaenger']['ort'])) ?></span></td>
        <td><?= e($p['referenz'] ?: '—') ?></td>
        <?php if ($unterkunden !== []) { ?><td class="k-mono k-klein"><?= e($uNummern[(int) ($z['unterkunde_id'] ?? 0)] ?? '—') ?></td><?php } ?>
        <td><?= e($z['preis']['carrier'] ?? ($p['carrier'] ?: '—')) ?></td>
        <td><?= e($p['zusatz'] !== [] ? implode(', ', $p['zusatz']) : '—') ?></td>
        <td class="k-mono"><?= $z['preis'] !== null ? e(euro($z['preis']['netto'] + zusatzBerechnen($p['zusatz'])['netto'], $sp)) : '—' ?></td>
        <td class="k-klein"><?= $z['fehler'] !== [] ? e(implode(', ', $z['fehler'])) : '<span class="status status--bezahlt">' . e(t('import.ok')) . '</span>' ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <div class="k-form-fuss" style="margin-top:1rem">
    <form method="post" action="<?= e(url('import/beauftragen')) ?>" class="form k-form" style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap"><?= csrfFeld() ?>
      <?php if ($unterkunden !== []) { ?><div class="field" style="margin:0"><label for="i-unterkunde"><?= e(t('unterkunde.abrechnen')) ?></label><select id="i-unterkunde" name="unterkunde_id"><option value="0"><?= e(t('unterkunde.hauptfirma')) ?></option><?php foreach ($unterkunden as $u) { ?><option value="<?= (int) $u['id'] ?>"><?= e($u['nummer']) ?> · <?= e($u['name']) ?></option><?php } ?></select></div><?php } ?>
      <button class="btn btn--primary" type="submit" <?= $ok === 0 ? 'disabled' : '' ?>><?= e(t('import.beauftragen', $ok)) ?></button>
    </form>
    <form method="post" action="<?= e(url('import/verwerfen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('import.abbrechen')) ?></button></form>
  </div>
</div>
<?php } ?>
