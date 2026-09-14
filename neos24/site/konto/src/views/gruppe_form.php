<?php $sp = sprache(); $darf = $darf ?? false; ?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url('benutzer/gruppen')) ?>">← <?= e(t('gruppen.titel')) ?></a><h1 class="h2"><?= e($g !== null ? $g['name'] : t('gruppen.neu')) ?></h1><p class="k-text"><?= e(t('gruppen.form.text')) ?></p></div>
</header>
<?php if ($fehler !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
<form method="post" action="<?= e(url($g !== null ? 'benutzer/gruppen/' . $g['id'] : 'benutzer/gruppen/neu')) ?>" class="form k-form" novalidate<?= $darf ? '' : ' inert' ?>>
  <?= csrfFeld() ?>
  <div class="k-spalten k-spalten--2-1">
    <div class="card k-karte-tabelle">
      <div class="k-karte-kopf"><h2 class="h3"><?= e(t('gruppen.rechte')) ?></h2><span class="k-klein"><?= e(t('gruppen.rechte.text')) ?></span></div>
      <div class="k-scroll"><table class="table k-tabelle k-matrix">
        <thead><tr><th><?= e(t('gruppen.bereich')) ?></th><th><?= e(t('gruppen.stufe.keine')) ?></th><th><?= e(t('gruppen.stufe.sehen')) ?></th><th><?= e(t('gruppen.stufe.bearbeiten')) ?></th></tr></thead>
        <tbody>
        <?php foreach (KUNDEN_BEREICHE as $bereich) { $stufe = (string) ($werte['rechte'][$bereich] ?? ''); ?>
          <tr>
            <td><strong><?= e(t('gruppen.bereich.' . $bereich)) ?></strong><br><span class="k-klein"><?= e(t('gruppen.bereich.' . $bereich . '.text')) ?></span></td>
            <?php foreach (['', 'sehen', 'bearbeiten'] as $wahl) { ?>
              <td><label class="k-schalter" style="margin:0"><input type="radio" name="rechte[<?= e($bereich) ?>]" value="<?= e($wahl) ?>" <?= $stufe === $wahl ? 'checked' : '' ?> aria-label="<?= e(t('gruppen.bereich.' . $bereich) . ' ' . t('gruppen.stufe.' . ($wahl === '' ? 'keine' : $wahl))) ?>"></label></td>
            <?php } ?>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="field"><label for="g-name"><?= e(t('gruppen.name')) ?></label><input id="g-name" name="name" type="text" value="<?= e($werte['name']) ?>" minlength="2" maxlength="60" required></div>
      <div class="field"><label for="g-beschreibung"><?= e(t('gruppen.beschreibung')) ?></label><textarea id="g-beschreibung" name="beschreibung" rows="3" maxlength="300"><?= e($werte['beschreibung']) ?></textarea></div>
      <?php if ($darf) { ?><div class="k-form-fuss"><button class="btn btn--primary" type="submit"><?= e($g !== null ? t('einstellungen.speichern') : t('gruppen.anlegen')) ?></button><a class="btn btn--sm k-btn-leise" href="<?= e(url('benutzer/gruppen')) ?>"><?= e(t('import.abbrechen')) ?></a></div><?php } ?>
    </div>
  </div>
</form>
