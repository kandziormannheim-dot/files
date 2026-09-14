<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e(t('firma.titel')) ?></h1><p class="k-text"><?= e(t('firma.text')) ?> <?= e(t('kundennummer')) ?>: <strong class="k-mono"><?= e($firma['kundennummer']) ?></strong></p></div>
</header>
<div class="k-spalten k-spalten--2-1">
  <div class="card">
    <?php if ($fehler !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="<?= e(url('firma')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <div class="field"><label for="f-name"><?= e(t('firma.name')) ?></label><input id="f-name" name="name" type="text" value="<?= e($firma['name']) ?>" required></div>
      <div class="field"><label for="f-strasse"><?= e(t('firma.strasse')) ?></label><input id="f-strasse" name="strasse" type="text" value="<?= e($firma['strasse']) ?>" required></div>
      <div class="form-row form-row--plz">
        <div class="field"><label for="f-plz"><?= e(t('firma.plz')) ?></label><input id="f-plz" name="plz" type="text" value="<?= e($firma['plz']) ?>" required></div>
        <div class="field"><label for="f-ort"><?= e(t('firma.ort')) ?></label><input id="f-ort" name="ort" type="text" value="<?= e($firma['ort']) ?>" required></div>
      </div>
      <div class="form-row form-row--2">
        <div class="field"><label for="f-land"><?= e(t('firma.land')) ?></label><input id="f-land" name="land" type="text" value="<?= e($firma['land']) ?>" maxlength="2" pattern="[A-Za-z]{2}" required></div>
        <div class="field"><label for="f-ust"><?= e(t('firma.ust')) ?></label><input id="f-ust" name="ust_id" type="text" value="<?= e($firma['ust_id']) ?>"></div>
      </div>
      <div class="field"><label for="f-rechnung"><?= e(t('firma.rechnungs_email')) ?></label><input id="f-rechnung" name="rechnungs_email" type="email" value="<?= e($firma['rechnungs_email']) ?>"></div>
      <button class="btn btn--primary" type="submit"><?= e(t('firma.speichern')) ?></button>
    </form>
  </div>
  <div class="card card--ink">
    <h2 class="h3"><?= e(t('firma.unterkunden')) ?></h2>
    <p class="k-text" style="margin:.5rem 0 1rem"><?= e(t('firma.unterkunden.text')) ?></p>
    <?php if (($unterkunden ?? []) === []) { ?><p class="k-klein"><?= e(t('firma.unterkunden.keine')) ?></p><?php } else { ?>
    <ul class="checklist">
      <?php foreach ($unterkunden as $u) { ?><li><span class="k-mono"><?= e($u['nummer']) ?></span> <?= e($u['name']) ?><?= (int) $u['aktiv'] === 1 ? '' : ' <span class="k-klein">(inaktiv)</span>' ?><br><span class="k-klein"><?= e(trim($u['strasse'] . ', ' . $u['plz'] . ' ' . $u['ort'], ', ')) ?><?= $u['rechnungs_email'] !== '' ? ' · ' . e($u['rechnungs_email']) : '' ?></span></li><?php } ?>
    </ul>
    <?php } ?>
  </div>
</div>
