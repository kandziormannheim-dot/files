<?php $sp = sprache(); $ergebnis = $ergebnis ?? null; ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('import.titel')) ?></h1><p class="k-text"><?= e(t('import.text')) ?></p></div>
  <div class="k-form-fuss"><a class="btn btn--sm k-btn-leise" href="<?= e(url('import/vorlage.csv')) ?>"><?= e(t('import.vorlage')) ?> ↓</a><a class="btn btn--sm k-btn-leise" href="<?= e(url('import/vorlage.xlsx')) ?>"><?= e(t('import.vorlage.xlsx')) ?> ↓</a></div>
</header>
<?php if ($meldung !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($meldung) ?></p><?php } ?>
<?php if ($ergebnis !== null) { $refs = array_column($ergebnis, 'ext_ref'); ?>
<div class="card k-karte-tabelle">
  <div class="k-karte-kopf"><h2 class="h3"><?= e(t('import.ergebnis')) ?></h2><span class="k-klein"><?= count($ergebnis) ?> · <?= e(t('import.ergebnis.text')) ?></span></div>
  <?php if ($ergebnis === []) { ?><p class="k-leer"><?= e(t('import.ergebnis.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('liste.nummer')) ?></th><th><?= e(t('liste.referenz')) ?></th><th><?= e(t('liste.empfaenger')) ?></th><th><?= e(t('liste.ziel')) ?></th><th><?= e(t('liste.netto')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($ergebnis as $r) { ?>
      <tr>
        <td><a class="k-mono" href="<?= e(url('sendungen/' . $r['ext_ref'])) ?>"><?= e($r['ext_ref']) ?></a></td>
        <td><?= e($r['referenz'] !== '' ? $r['referenz'] : '—') ?></td>
        <td><?= e($r['name']) ?></td>
        <td><span class="flag"><?= e($r['zielland']) ?></span></td>
        <td class="k-mono"><?= e(euro((int) $r['betrag_cent'], $sp)) ?></td>
        <td class="k-aktionen"><a class="btn btn--sm k-btn-leise" href="<?= e(url('sendungen/' . $r['ext_ref'] . '/label.pdf')) ?>" target="_blank" rel="noopener"><?= e(t('label.knopf')) ?></a></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <div class="k-form-fuss" style="margin-top:1rem">
    <a class="btn btn--primary" href="<?= e(url('sendungen/labels.pdf', ['refs' => implode(',', $refs)])) ?>" target="_blank" rel="noopener"><?= e(t('import.labels')) ?></a>
    <a class="btn btn--sm k-btn-leise" href="<?= e(url('sendungen')) ?>"><?= e(t('nav.sendungen')) ?></a>
    <a class="btn btn--sm k-btn-leise" href="<?= e(url('import')) ?>"><?= e(t('import.ergebnis.weiter')) ?></a>
  </div>
  <?php } ?>
</div>
<?php } elseif ($vorschau === null) { ?>
<div class="k-spalten k-spalten--2-1">
  <div class="card">
    <form method="post" action="<?= e(url('import')) ?>" enctype="multipart/form-data" class="form k-form">
      <?= csrfFeld() ?>
      <div class="field"><label for="datei"><?= e(t('import.datei')) ?></label><input id="datei" name="datei" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required></div>
      <label class="k-schalter"><input type="checkbox" name="dubletten_ok" value="1"> <?= e(t('import.dubletten_ok')) ?></label>
      <div class="k-form-fuss"><button class="btn btn--primary" type="submit"><?= e(t('import.pruefen')) ?></button></div>
    </form>
  </div>
  <div class="card card--ink"><p class="k-text"><?= e(t('import.spalten')) ?></p><p class="k-text" style="margin-top:.75rem"><?= e(t('import.gewicht_hinweis')) ?></p><?php if ($unterkunden !== []) { ?><p class="k-text" style="margin-top:.75rem"><?= e(t('import.unterkunde')) ?></p><?php } ?></div>
</div>
<?php } else { $ok = count(array_filter($vorschau, static fn (array $z): bool => $z['fehler'] === [])); $fehlerhaft = count($vorschau) - $ok; ?>
<div class="card k-karte-tabelle">
  <div class="k-karte-kopf"><h2 class="h3"><?= e(t('import.vorschau')) ?></h2><span class="k-klein"><?= $ok ?> / <?= count($vorschau) ?> <?= e(t('import.ok')) ?><?php if ($fehlerhaft > 0) { ?> · <a href="<?= e(url('import/fehler.csv')) ?>"><?= e(t('import.fehlerbericht')) ?> ↓</a><?php } ?></span></div>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('import.zeile')) ?></th><th><?= e(t('liste.ziel')) ?></th><th><?= e(t('neu.gewicht_kg')) ?></th><th><?= e(t('liste.empfaenger')) ?></th><th><?= e(t('liste.referenz')) ?></th><?php if ($unterkunden !== []) { ?><th><?= e(t('liste.fuer')) ?></th><?php } ?><th><?= e(t('liste.carrier')) ?></th><th><?= e(t('neu.zusatz')) ?></th><th><?= e(t('liste.netto')) ?></th><th><?= e(t('import.fehler')) ?></th></tr></thead>
    <tbody>
    <?php $uNummern = array_column($unterkunden, 'nummer', 'id'); foreach ($vorschau as $z) { $p = $z['p']; ?>
      <tr class="<?= $z['fehler'] !== [] ? 'k-fehlerzeile' : '' ?>">
        <td class="k-mono"><?= (int) $z['nr'] ?></td>
        <td><?php if ($p['zielland'] !== '') { ?><span class="flag"><?= e($p['zielland']) ?></span><?php } else { ?>—<?php } ?><?= e($z['gk'] ?? '') ?><?= ($p['kategorie'] ?? 'paket') === 'brief' ? ' <span class="k-klein">' . e(kategorieName('brief', $sp)) . '</span>' : '' ?></td>
        <td class="k-mono"><?= $p['gewicht_gramm'] > 0 ? e(number_format($p['gewicht_gramm'] / 1000, 2, $sp === 'en' ? '.' : ',', '')) : '—' ?></td>
        <td><?= e($p['empfaenger']['name']) ?><br><span class="k-klein"><?= e($p['empfaenger']['strasse']) ?>, <?= e(trim($p['empfaenger']['plz'] . ' ' . $p['empfaenger']['ort'])) ?></span></td>
        <td><?= e($p['referenz'] !== '' ? $p['referenz'] : '—') ?></td>
        <?php if ($unterkunden !== []) { ?><td class="k-mono k-klein"><?= e($uNummern[(int) ($z['unterkunde_id'] ?? 0)] ?? '—') ?></td><?php } ?>
        <td><?= e($z['preis']['carrier'] ?? ($p['carrier'] !== '' ? $p['carrier'] : '—')) ?></td>
        <td><?= e($p['zusatz'] !== [] ? implode(', ', $p['zusatz']) : '—') ?></td>
        <td class="k-mono"><?= $z['preis'] !== null ? e(euro($z['preis']['netto'] + zusatzBerechnen($p['zusatz'])['netto'], $sp)) : '—' ?></td>
        <td class="k-klein"><?= $z['fehler'] !== [] ? e(implode(' · ', array_map(static fn (string $c): string => t('import.fehler.' . $c), $z['fehler']))) : '<span class="status status--bezahlt">' . e(t('import.ok')) . '</span>' ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <div class="k-form-fuss" style="margin-top:1rem">
    <form method="post" action="<?= e(url('import/beauftragen')) ?>" class="form k-form" style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap"><?= csrfFeld() ?>
      <?php if ($unterkunden !== []) { ?><div class="field" style="margin:0"><label for="i-unterkunde"><?= e(t('unterkunde.abrechnen')) ?></label><select id="i-unterkunde" name="unterkunde_id"><option value="0"><?= e(t('unterkunde.hauptfirma')) ?></option><?php foreach ($unterkunden as $u) { ?><option value="<?= (int) $u['id'] ?>"><?= e($u['nummer']) ?> · <?= e($u['name']) ?></option><?php } ?></select></div><?php } ?>
      <button class="btn btn--primary" type="submit" <?= $ok === 0 ? 'disabled' : '' ?>><?= e(t('import.beauftragen', $ok)) ?></button>
    </form>
    <?php if ($fehlerhaft > 0) { ?><a class="btn btn--sm k-btn-leise" href="<?= e(url('import/fehler.csv')) ?>"><?= e(t('import.fehlerbericht')) ?> ↓</a><?php } ?>
    <form method="post" action="<?= e(url('import/verwerfen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('import.abbrechen')) ?></button></form>
  </div>
</div>
<?php } ?>
