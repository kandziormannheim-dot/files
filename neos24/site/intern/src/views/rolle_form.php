<?php
$system = $rolle !== null && (int) $rolle['system'] === 1;
$darfB = darf('benutzer', 'bearbeiten') && !$system;
?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('benutzer')) ?>">← Benutzer &amp; Rollen</a><h1 class="h1"><?= $rolle !== null ? e($rolle['name']) : 'Neue Rolle' ?><?= $system ? ' <span class="pille">Systemrolle</span>' : '' ?></h1></div>
</header>
<?php if ($fehler !== null) { ?><p class="hinweis hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
<?php if ($system) { ?><p class="hinweis">Die Systemrolle Admin hat alle Rechte in allen Modulen und lässt sich nicht ändern oder löschen.</p><?php } ?>
<form method="post" action="<?= e(url($rolle !== null ? 'rollen/' . $rolle['id'] : 'rollen/neu')) ?>" class="formular">
  <?= csrfFeld() ?>
  <div class="spalten spalten--2-1">
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Rechtematrix</h2><span class="leise">Bearbeiten und Löschen schließen Sehen ein</span></div>
<div class="scrollen">
      <table class="tabelle rechteformular">
        <thead><tr><th>Modul</th><?php foreach (RECHTE as $recht => $name) { ?><th class="mitte"><?= e($name) ?></th><?php } ?><th class="mitte">Alles</th></tr></thead>
        <tbody>
        <?php foreach (MODULE as $modul => $name) { ?>
          <tr data-modul="<?= e($modul) ?>">
            <td><?= e($name) ?><?php if ($modul === 'benutzer') { ?><br><span class="leise">verwaltet Konten, Rollen und Rechte — nur für Admins gedacht</span><?php } ?></td>
            <?php foreach (RECHTE as $recht => $_) { ?>
              <td class="mitte"><input type="checkbox" name="rechte[<?= e($modul) ?>][<?= e($recht) ?>]" value="1" <?= !empty($matrix[$modul][$recht]) ? 'checked' : '' ?> <?= $darfB ? '' : 'disabled' ?> aria-label="<?= e($name . ' ' . $recht) ?>"></td>
            <?php } ?>
            <td class="mitte"><?php if ($darfB) { ?><button type="button" class="knopf knopf--leise knopf--klein" data-alles>alle</button><?php } ?></td>
          </tr>
        <?php } ?>
        </tbody>
      </table>
</div>
    </div>
    <div>
      <div class="karte">
        <div class="feld"><label for="name">Rollenname</label><input id="name" name="name" value="<?= e($werte['name']) ?>" minlength="2" maxlength="60" required <?= $darfB ? '' : 'readonly' ?>></div>
        <div class="feld"><label for="beschreibung">Beschreibung</label><textarea id="beschreibung" name="beschreibung" rows="3" maxlength="300" <?= $darfB ? '' : 'readonly' ?>><?= e($werte['beschreibung']) ?></textarea></div>
        <?php if ($darfB) { ?>
        <div class="formular-fuss"><button class="knopf knopf--primaer knopf--breit" type="submit"><?= $rolle !== null ? 'Rolle speichern' : 'Rolle anlegen' ?></button></div>
        <?php } ?>
      </div>
    </div>
  </div>
</form>
<?php if ($rolle !== null && !$system && darf('benutzer', 'loeschen')) { ?>
<form method="post" action="<?= e(url('rollen/' . $rolle['id'] . '/loeschen')) ?>" data-bestaetigen="Rolle <?= e($rolle['name']) ?> löschen?"><?= csrfFeld() ?><button class="knopf knopf--gefahr" type="submit">Rolle löschen</button> <span class="leise">nur möglich, wenn kein Benutzer sie hat</span></form>
<?php } ?>
