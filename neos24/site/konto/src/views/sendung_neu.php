<?php
$sp = sprache();
$f = static fn (string $name) => in_array($name, $fehler, true) ? 'is-invalid' : '';
$absenderText = trim($firma['name'] . ', ' . $firma['strasse'] . ', ' . $firma['plz'] . ' ' . $firma['ort'], ', ');
?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url('sendungen')) ?>"><?= e(t('detail.zurueck')) ?></a><h1 class="h2"><?= e(t('neu.titel')) ?></h1><p class="k-text"><?= e(t('neu.text')) ?></p></div>
</header>
<?php if ($fehler !== []) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e(in_array('absender', $fehler, true) ? t('neu.absender.fehlt') : t('neu.fehler')) ?></p><?php } ?>
<form method="post" action="<?= e(url('sendungen/neu')) ?>" class="form k-form k-sendung" novalidate data-mwst="<?= (int) $preise['mwstSatz'] ?>">
  <?= csrfFeld() ?>
  <div class="k-spalten k-spalten--2-1">
    <div>
      <div class="card">
        <h2 class="h3"><?= e(t('detail.sendung')) ?></h2>
        <div class="form-row form-row--2">
          <div class="field <?= $f('zielland') ?>">
            <label for="s-land"><?= e(t('neu.zielland')) ?></label>
            <select id="s-land" name="zielland" required>
              <option value=""><?= e(t('neu.bitte_waehlen')) ?></option>
              <?php foreach ($preise['laender'] as $code => $land) { $klassen = []; foreach ($land['klassen'] as $gk => $z) { $klassen[$gk] = ['netto' => $z['netto'], 'carrier' => $z['carrier'], 'laufzeit' => $z['laufzeit'][$sp]]; } ?>
                <option value="<?= e($code) ?>" data-klassen="<?= e(json_encode($klassen, JSON_UNESCAPED_UNICODE)) ?>" <?= $werte['zielland'] === $code ? 'selected' : '' ?>><?= e($land['name'][$sp]) ?></option>
              <?php } ?>
            </select>
          </div>
          <div class="field <?= $f('zielland') ?>">
            <label for="s-gewicht"><?= e(t('neu.gewicht')) ?></label>
            <select id="s-gewicht" name="gewichtsklasse" required>
              <?php foreach ($preise['gewichtsklassen'] as $code => $gk) { ?><option value="<?= e($code) ?>" <?= $werte['gewichtsklasse'] === $code ? 'selected' : '' ?>><?= e($gk[$sp]) ?></option><?php } ?>
            </select>
          </div>
        </div>
        <div class="field"><label for="s-referenz"><?= e(t('neu.referenz')) ?></label><input id="s-referenz" name="referenz" type="text" maxlength="60" value="<?= e($werte['referenz']) ?>"><span class="k-klein"><?= e(t('neu.referenz.hinweis')) ?></span></div>
      </div>
      <div class="card">
        <h2 class="h3"><?= e(t('neu.empfaenger')) ?></h2>
        <div class="field <?= $f('name') ?>"><label for="s-name"><?= e(t('neu.name')) ?></label><input id="s-name" name="name" type="text" minlength="2" value="<?= e($werte['name']) ?>" required></div>
        <div class="field <?= $f('strasse') ?>"><label for="s-strasse"><?= e(t('neu.strasse')) ?></label><input id="s-strasse" name="strasse" type="text" minlength="3" value="<?= e($werte['strasse']) ?>" required></div>
        <div class="form-row form-row--plz">
          <div class="field <?= $f('plz') ?>"><label for="s-plz"><?= e(t('neu.plz')) ?></label><input id="s-plz" name="plz" type="text" minlength="3" value="<?= e($werte['plz']) ?>" required></div>
          <div class="field <?= $f('ort') ?>"><label for="s-ort"><?= e(t('neu.ort')) ?></label><input id="s-ort" name="ort" type="text" minlength="2" value="<?= e($werte['ort']) ?>" required></div>
        </div>
        <div class="field <?= $f('email') ?>"><label for="s-email"><?= e(t('neu.email')) ?></label><input id="s-email" name="email" type="email" value="<?= e($werte['email']) ?>"></div>
      </div>
    </div>
    <div>
      <div class="card card--ink k-summe">
        <span class="eyebrow eyebrow--cyan"><?= e(t('neu.preis')) ?></span>
        <div class="k-summe-wert k-mono" data-preis>—</div>
        <dl class="k-liste k-liste--ink">
          <dt><?= e(t('liste.carrier')) ?></dt><dd data-carrier>—</dd>
          <dt><?= e(t('detail.laufzeit')) ?></dt><dd data-laufzeit>—</dd>
        </dl>
        <p class="k-klein"><?= e($absenderText !== '' && $firma['strasse'] !== '' ? t('neu.absender', $absenderText) : t('neu.absender.fehlt')) ?></p>
        <button class="btn btn--primary k-btn-breit" type="submit"><?= e(t('neu.knopf')) ?> →</button>
      </div>
    </div>
  </div>
</form>
