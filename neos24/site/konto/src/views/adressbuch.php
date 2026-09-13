<?php $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('adressbuch.titel')) ?></h1><p class="k-text"><?= e(t('adressbuch.text')) ?></p></div>
  <div class="k-form-fuss"><a class="btn btn--sm k-btn-leise" href="<?= e(url('vorlagen/neu')) ?>"><?= e(t('vorlagen.neu')) ?></a><a class="btn btn--primary" href="<?= e(url('adressbuch/neu')) ?>"><?= e(t('adressbuch.neu')) ?></a></div>
</header>
<div class="card k-karte-tabelle">
  <?php if ($zeilen === []) { ?><p class="k-leer"><?= e(t('adressbuch.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><?= e(t('adressbuch.art')) ?></th><th><?= e(t('neu.name')) ?></th><th><?= e(t('neu.strasse')) ?></th><th><?= e(t('neu.ort')) ?></th><th><?= e(t('neu.land')) ?></th><th><?= e(t('login.email')) ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $a) { ?>
      <tr>
        <td><?= e(t('adressbuch.art.' . $a['art'])) ?><?= (int) $a['standard'] === 1 ? ' <span class="status status--bezahlt">' . e(t('adressbuch.standard.pille')) . '</span>' : '' ?></td>
        <td><a href="<?= e(url('adressbuch/' . $a['id'])) ?>"><?= e($a['name']) ?></a><?= $a['firma'] !== '' ? '<br><span class="k-klein">' . e($a['firma']) . '</span>' : '' ?></td>
        <td><?= e($a['strasse']) ?></td>
        <td><?= e(trim($a['plz'] . ' ' . $a['ort'])) ?></td>
        <td><span class="flag"><?= e($a['land']) ?></span></td>
        <td><?= e($a['email'] ?: '—') ?></td>
        <td class="k-aktionen"><form method="post" action="<?= e(url('adressbuch/' . $a['id'] . '/loeschen')) ?>" data-bestaetigen="<?= e(t('adressbuch.loeschen.bestaetigen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-gefahr" type="submit"><?= e(t('adressbuch.loeschen')) ?></button></form></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
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
        <td class="k-aktionen"><form method="post" action="<?= e(url('vorlagen/' . $v['id'] . '/loeschen')) ?>" data-bestaetigen="<?= e(t('adressbuch.loeschen.bestaetigen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-gefahr" type="submit"><?= e(t('adressbuch.loeschen')) ?></button></form></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
