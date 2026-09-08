<?php $ich = kundeAktuell(); $sp = sprache(); $business = $ich['art'] === 'business'; ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('nav.uebersicht')) ?></span><h1 class="h2"><?= e(t('willkommen', explode(' ', $ich['name'])[0] ?: $ich['name'])) ?></h1>
  <p class="k-text"><?= e($business ? t('uebersicht.business.text', $firma['name']) : t('uebersicht.privat.text', $ich['email'])) ?></p></div>
  <?php if ($business) { ?><a class="btn btn--primary" href="<?= e(url('sendungen/neu')) ?>"><?= e(t('nav.neu')) ?> →</a><?php } else { ?><a class="btn btn--primary" href="<?= e(startseite(($sp === 'en' ? '?customer=private#parcel' : '?kunde=privat#paket'))) ?>"><?= e(t('uebersicht.paket')) ?> →</a><?php } ?>
</header>
<?php if ($business) { ?>
<div class="k-kacheln">
  <div class="card k-kachel k-kachel--cyan"><span class="k-kachel-name"><?= e(t('uebersicht.monat')) ?></span><strong class="k-kachel-wert"><?= (int) $k['monat'] ?></strong></div>
  <div class="card k-kachel k-kachel--gelb"><span class="k-kachel-name"><?= e(t('uebersicht.kosten')) ?></span><strong class="k-kachel-wert"><?= e(euro($k['netto'], $sp)) ?></strong></div>
  <div class="card k-kachel k-kachel--coral"><span class="k-kachel-name"><?= e(t('uebersicht.offen')) ?></span><strong class="k-kachel-wert"><?= (int) $k['offen'] ?></strong><span class="k-klein"><?= e(euro($k['offen_brutto'], $sp)) ?> · <a href="<?= e(url('rechnungen')) ?>"><?= e(t('nav.rechnungen')) ?></a></span></div>
</div>
<?php } ?>
<div class="k-spalten k-spalten--2-1">
  <div class="card k-karte-tabelle">
    <div class="k-karte-kopf"><h2 class="h3"><?= e(t('uebersicht.letzte')) ?></h2><a href="<?= e(url($business ? 'sendungen' : 'bestellungen')) ?>"><?= e(t('uebersicht.alle')) ?> →</a></div>
    <?php if ($letzte === []) { ?><p class="k-leer"><?= e(t('uebersicht.keine')) ?></p><?php } else { ?>
    <div class="k-scroll"><table class="table k-tabelle">
      <thead><tr><th><?= e(t('liste.nummer')) ?></th><th><?= e(t('liste.status')) ?></th><th><?= e(t('liste.ziel')) ?></th><th><?= e($business ? t('liste.netto') : t('liste.betrag')) ?></th></tr></thead>
      <tbody>
      <?php foreach ($letzte as $z) { $emp = json_decode((string) $z['empfaenger_json'], true) ?: []; ?>
        <tr>
          <td><a class="k-mono" href="<?= e(url(($business ? 'sendungen/' : 'bestellungen/') . $z['ext_ref'])) ?>"><?= e($z['ext_ref']) ?></a><br><span class="k-klein"><?= e(datumAnzeigen($z['erstellt'], $sp)) ?></span></td>
          <td><?= statusPille((string) $z['status'], statusName((string) $z['status'], $sp)) ?></td>
          <td><span class="flag"><?= e($z['zielland']) ?></span><?= e($emp['name'] ?? '') ?></td>
          <td class="k-mono"><?= e(euro((int) ($business ? $z['netto_cent'] : $z['betrag_cent']), $sp)) ?></td>
        </tr>
      <?php } ?>
      </tbody>
    </table></div>
    <?php } ?>
  </div>
  <?php if (!$business) { ?>
  <div class="card">
    <h2 class="h3"><?= e(t('uebersicht.absender')) ?></h2>
    <p class="k-klein"><?= e(t('uebersicht.absender.text')) ?></p>
    <?php if (($absender['name'] ?? '') === '' && ($absender['strasse'] ?? '') === '') { ?>
      <p class="k-text" style="margin-top:.75rem"><?= e(t('uebersicht.absender.fehlt')) ?></p>
    <?php } else { ?>
      <p class="k-text" style="margin-top:.75rem"><strong><?= e($absender['name'] ?? '') ?></strong><br><?= e($absender['strasse'] ?? '') ?><br><?= e(trim(($absender['plz'] ?? '') . ' ' . ($absender['ort'] ?? ''))) ?></p>
    <?php } ?>
    <p style="margin-top:1rem"><a class="btn btn--sm k-btn-leise" href="<?= e(url('einstellungen')) ?>#absender"><?= e(t('nav.einstellungen')) ?></a></p>
  </div>
  <?php } else { ?>
  <div class="card card--ink">
    <h2 class="h3"><?= e($firma['name']) ?></h2>
    <p class="k-text" style="margin-top:.5rem"><?= e($firma['strasse']) ?><br><?= e(trim($firma['plz'] . ' ' . $firma['ort'])) ?></p>
    <ul class="checklist">
      <li><?= e(t('nav.preise')) ?>: <a href="<?= e(url('preise')) ?>"><?= e(t('uebersicht.alle')) ?></a></li>
      <li><?= e(t('nav.rechnungen')) ?>: <a href="<?= e(url('rechnungen')) ?>"><?= e(t('uebersicht.alle')) ?></a></li>
    </ul>
  </div>
  <?php } ?>
</div>
