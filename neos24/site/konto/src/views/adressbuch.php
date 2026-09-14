<?php $sp = sprache(); $ich = kundeAktuell(); $business = $business ?? false; $schreiben = !$business || darfKunde('versand', 'bearbeiten');
$zeile = static function (array $a, bool $fremdBlock) use ($ich, $business, $schreiben): void { $darf = $schreiben && adresseDarfBearbeiten($ich, $a); ?>
      <tr>
        <td><?= e(t('adressbuch.art.' . $a['art'])) ?><?= (int) $a['standard'] === 1 && !$fremdBlock ? ' <span class="status status--bezahlt">' . e(t('adressbuch.standard.pille')) . '</span>' : '' ?><?= $business && (int) $a['geteilt'] === 1 && !$fremdBlock ? ' <span class="status status--offen">' . e(t('adressbuch.geteilt.pille')) . '</span>' : '' ?></td>
        <td><?php if ($darf) { ?><a href="<?= e(url('adressbuch/' . $a['id'])) ?>"><?= e($a['name']) ?></a><?php } else { ?><?= e($a['name']) ?><?php } ?><?= $a['firma'] !== '' ? '<br><span class="k-klein">' . e($a['firma']) . '</span>' : '' ?></td>
        <td><?= e($a['strasse']) ?></td>
        <td><?= e(trim($a['plz'] . ' ' . $a['ort'])) ?></td>
        <td><span class="flag"><?= e($a['land']) ?></span></td>
        <td><?= e($a['email'] ?: '—') ?></td>
        <?php if ($fremdBlock) { ?><td class="k-klein"><?= e($a['ersteller'] ?? '') ?></td><?php } ?>
        <td class="k-aktionen"><?php if ($darf) { ?>
          <?php if ($business) { ?><form method="post" action="<?= e(url('adressbuch/' . $a['id'] . '/teilen')) ?>"><?= csrfFeld() ?><input type="hidden" name="geteilt" value="<?= (int) $a['geteilt'] === 1 ? '0' : '1' ?>"><button class="btn btn--sm k-btn-leise" type="submit"><?= e((int) $a['geteilt'] === 1 ? t('adressbuch.teilen.aus') : t('adressbuch.teilen')) ?></button></form><?php } ?>
          <form method="post" action="<?= e(url('adressbuch/' . $a['id'] . '/loeschen')) ?>" data-bestaetigen="<?= e(t('adressbuch.loeschen.bestaetigen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-gefahr" type="submit"><?= e(t('adressbuch.loeschen')) ?></button></form>
        <?php } ?></td>
      </tr>
<?php }; ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('adressbuch.titel')) ?></h1><p class="k-text"><?= e($business ? t('adressbuch.text.business') : t('adressbuch.text')) ?></p></div>
  <div class="k-form-fuss"><a class="btn btn--sm k-btn-leise" href="<?= e(url('adressbuch/export.csv')) ?>"><?= e(t('adressbuch.export')) ?> ↓</a><?php if ($schreiben) { ?><a class="btn btn--sm k-btn-leise" href="<?= e(url('vorlagen/neu')) ?>"><?= e(t('vorlagen.neu')) ?></a><a class="btn btn--primary" href="<?= e(url('adressbuch/neu')) ?>"><?= e(t('adressbuch.neu')) ?></a><?php } ?></div>
</header>
<div class="card k-karte-tabelle">
  <?php if ($business) { ?><div class="k-karte-kopf"><h2 class="h3"><?= e(t('adressbuch.meine')) ?></h2></div><?php } ?>
  <?php if ($zeilen === []) { ?><p class="k-leer"><?= e(t('adressbuch.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('adressbuch.art')) ?></th><th><?= e(t('neu.name')) ?></th><th><?= e(t('neu.strasse')) ?></th><th><?= e(t('neu.ort')) ?></th><th><?= e(t('neu.land')) ?></th><th><?= e(t('login.email')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $a) { $zeile($a, false); } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
<?php if ($business) { ?>
<div class="card k-karte-tabelle">
  <div class="k-karte-kopf"><h2 class="h3"><?= e(t('adressbuch.firma.titel')) ?></h2><span class="k-klein"><?= e(t('adressbuch.firma.text')) ?></span></div>
  <?php if ($geteilte === []) { ?><p class="k-leer"><?= e(t('adressbuch.firma.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('adressbuch.art')) ?></th><th><?= e(t('neu.name')) ?></th><th><?= e(t('neu.strasse')) ?></th><th><?= e(t('neu.ort')) ?></th><th><?= e(t('neu.land')) ?></th><th><?= e(t('login.email')) ?></th><th><?= e(t('adressbuch.ersteller')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($geteilte as $a) { $zeile($a, true); } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
<?php } ?>
<?php if ($schreiben) { ?>
<div class="card">
  <div class="k-karte-kopf"><h2 class="h3"><?= e(t('adressbuch.import')) ?></h2></div>
  <p class="k-klein"><?= e(t('adressbuch.import.text')) ?></p>
  <form method="post" action="<?= e(url('adressbuch/import')) ?>" enctype="multipart/form-data" class="form k-form k-import-form">
    <?= csrfFeld() ?>
    <div class="form-row form-row--2">
      <div class="field"><label for="ab-datei"><?= e(t('import.datei')) ?></label><input id="ab-datei" name="datei" type="file" accept=".csv,.xlsx,text/csv" required></div>
      <div class="field k-feld-knopf"><?php if ($business) { ?><label class="k-schalter"><input type="checkbox" name="geteilt" value="1"> <?= e(t('adressbuch.import.geteilt')) ?></label><?php } ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('adressbuch.import.knopf')) ?></button></div>
    </div>
  </form>
</div>
<?php } ?>
<div class="card k-karte-tabelle">
  <div class="k-karte-kopf"><h2 class="h3"><?= e(t('vorlagen.titel')) ?></h2><span class="k-klein"><?= e(t('vorlagen.text')) ?></span></div>
  <?php if ($vorlagen === []) { ?><p class="k-leer"><?= e(t('vorlagen.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('vorlagen.name')) ?></th><th><?= e(t('neu.gewicht_kg')) ?></th><th><?= e(t('neu.masse')) ?></th><th><?= e(t('neu.zusatz')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($vorlagen as $v) { $z = json_decode((string) $v['zusatz_json'], true) ?: []; ?>
      <tr>
        <td><a href="<?= e(url('vorlagen/' . $v['id'])) ?>"><?= e($v['name']) ?></a></td>
        <td class="k-mono"><?= e(number_format((int) $v['gewicht_gramm'] / 1000, 2, $sp === 'en' ? '.' : ',', '')) ?> kg</td>
        <td class="k-mono"><?= (int) $v['laenge_cm'] > 0 ? e($v['laenge_cm'] . ' × ' . $v['breite_cm'] . ' × ' . $v['hoehe_cm'] . ' cm') : '—' ?></td>
        <td><?= e($z !== [] ? implode(', ', $z) : '—') ?></td>
        <td class="k-aktionen"><?php if ($schreiben) { ?><form method="post" action="<?= e(url('vorlagen/' . $v['id'] . '/loeschen')) ?>" data-bestaetigen="<?= e(t('adressbuch.loeschen.bestaetigen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-gefahr" type="submit"><?= e(t('adressbuch.loeschen')) ?></button></form><?php } ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
