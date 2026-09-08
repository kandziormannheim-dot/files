<?php
$darfB = darf('preise', 'bearbeiten');
$darfL = darf('preise', 'loeschen');
$bearbeitenLand = str_starts_with($bearbeiten, 'land:') ? substr($bearbeiten, 5) : '';
$bearbeitenGk = str_starts_with($bearbeiten, 'gk:') ? (int) substr($bearbeiten, 3) : 0;
$bearbeitenCarrier = str_starts_with($bearbeiten, 'carrier:') ? (int) substr($bearbeiten, 8) : 0;
$landForm = null;
foreach ($laender as $l) { if ($l['code'] === $bearbeitenLand) { $landForm = $l; } }
$gkForm = null;
foreach ($klassen as $g) { if ((int) $g['id'] === $bearbeitenGk) { $gkForm = $g; } }
$carrierForm = null;
foreach ($carrier as $c) { if ((int) $c['id'] === $bearbeitenCarrier) { $carrierForm = $c; } }
?>
<header class="kopfzeile">
  <div><span class="eyebrow">Preise &amp; Zielländer</span><h1 class="h1">Stammdaten</h1></div>
  <p class="leise">Preise selbst stehen in der <a href="<?= e(url('routing')) ?>">Routingmatrix</a> (Land × Gewichtsklasse).</p>
</header>

<div class="spalten spalten--2-1">
  <div class="karte karte--tabelle">
    <div class="karte-kopf"><h2 class="h2">Zielländer</h2><span class="leise"><?= count($laender) ?> Länder · nur aktive erscheinen auf der Startseite</span></div>
    <div class="scrollen">
    <table class="tabelle">
      <thead><tr><th>Code</th><th>Deutsch</th><th>Englisch</th><th class="rechts">Sortierung</th><th class="rechts">Routen</th><th>Aktiv</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($laender as $l) { ?>
        <tr class="<?= (int) $l['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <td><span class="flagge"><?= e($l['code']) ?></span></td>
          <td><?= e($l['name_de']) ?></td>
          <td><?= e($l['name_en']) ?></td>
          <td class="mono rechts"><?= (int) $l['sortierung'] ?></td>
          <td class="mono rechts"><?= (int) $l['routen'] ?></td>
          <td><?= (int) $l['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
          <td class="rechts zeilen-aktionen">
            <?php if ($darfB) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('preise', ['bearbeiten' => 'land:' . $l['code']])) ?>#formular-land">Bearbeiten</a><?php } ?>
            <?php if ($darfL && (int) $l['routen'] === 0) { ?><form method="post" action="<?= e(url('preise/land/loeschen')) ?>" data-bestaetigen="Land <?= e($l['code']) ?> löschen?"><?= csrfFeld() ?><input type="hidden" name="code" value="<?= e($l['code']) ?>"><button class="knopf knopf--gefahr knopf--klein" type="submit">Löschen</button></form><?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table>
    </div>
  </div>
  <?php if ($darfB) { ?>
  <div class="karte" id="formular-land">
    <h2 class="h2"><?= $landForm !== null ? 'Land ' . e($landForm['code']) . ' bearbeiten' : 'Neues Zielland' ?></h2>
    <form method="post" action="<?= e(url('preise/land')) ?>" class="formular">
      <?= csrfFeld() ?>
      <div class="feld"><label for="l-code">Ländercode (ISO-2)</label><input id="l-code" name="code" value="<?= e($landForm['code'] ?? '') ?>" pattern="[A-Za-z]{2}" maxlength="2" required <?= $landForm !== null ? 'readonly' : '' ?>></div>
      <div class="feld"><label for="l-de">Name deutsch</label><input id="l-de" name="name_de" value="<?= e($landForm['name_de'] ?? '') ?>" required></div>
      <div class="feld"><label for="l-en">Name englisch</label><input id="l-en" name="name_en" value="<?= e($landForm['name_en'] ?? '') ?>" required></div>
      <div class="feld"><label for="l-sort">Sortierung</label><input id="l-sort" name="sortierung" type="number" value="<?= e($landForm['sortierung'] ?? '100') ?>" min="0" max="9999"></div>
      <label class="schalter"><input type="checkbox" name="aktiv" <?= ($landForm === null || (int) $landForm['aktiv'] === 1) ? 'checked' : '' ?>> Aktiv (auf der Startseite und im Checkout)</label>
      <div class="formular-fuss"><button class="knopf knopf--primaer" type="submit">Speichern</button><?php if ($landForm !== null) { ?><a class="knopf knopf--leise" href="<?= e(url('preise')) ?>">Neu statt bearbeiten</a><?php } ?></div>
    </form>
    <p class="leise" style="margin-top:.75rem">Ein neues Land erscheint erst, wenn in der Routingmatrix mindestens ein Carrier mit Verkaufspreis eingetragen ist.</p>
  </div>
  <?php } ?>
</div>

<div class="spalten spalten--2">
  <div class="karte karte--tabelle">
    <div class="karte-kopf"><h2 class="h2">Gewichtsklassen</h2></div>
    <div class="scrollen">
    <table class="tabelle">
      <thead><tr><th>Kürzel</th><th>Deutsch</th><th>Englisch</th><th class="rechts">bis g</th><th class="rechts">Routen</th><th>Aktiv</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($klassen as $g) { ?>
        <tr class="<?= (int) $g['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <td class="mono"><?= e($g['code']) ?></td><td><?= e($g['name_de']) ?></td><td><?= e($g['name_en']) ?></td>
          <td class="mono rechts"><?= (int) $g['max_gramm'] ?: '—' ?></td><td class="mono rechts"><?= (int) $g['routen'] ?></td>
          <td><?= (int) $g['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
          <td class="rechts zeilen-aktionen">
            <?php if ($darfB) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('preise', ['bearbeiten' => 'gk:' . $g['id']])) ?>#formular-gk">Bearbeiten</a><?php } ?>
            <?php if ($darfL && (int) $g['routen'] === 0) { ?><form method="post" action="<?= e(url('preise/gewichtsklasse/loeschen')) ?>" data-bestaetigen="Gewichtsklasse <?= e($g['code']) ?> löschen?"><?= csrfFeld() ?><input type="hidden" name="id" value="<?= (int) $g['id'] ?>"><button class="knopf knopf--gefahr knopf--klein" type="submit">Löschen</button></form><?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table>
    </div>
    <?php if ($darfB) { ?>
    <form method="post" action="<?= e(url('preise/gewichtsklasse')) ?>" class="formular formular--zeile" id="formular-gk">
      <?= csrfFeld() ?>
      <input type="hidden" name="id" value="<?= (int) ($gkForm['id'] ?? 0) ?>">
      <div class="feld"><label for="g-code">Kürzel</label><input id="g-code" name="code" value="<?= e($gkForm['code'] ?? '') ?>" pattern="[a-z0-9]{1,12}" placeholder="5kg" required></div>
      <div class="feld"><label for="g-de">Deutsch</label><input id="g-de" name="name_de" value="<?= e($gkForm['name_de'] ?? '') ?>" placeholder="bis 5 kg" required></div>
      <div class="feld"><label for="g-en">Englisch</label><input id="g-en" name="name_en" value="<?= e($gkForm['name_en'] ?? '') ?>" placeholder="up to 5 kg" required></div>
      <div class="feld"><label for="g-gramm">bis g</label><input id="g-gramm" name="max_gramm" type="number" value="<?= e($gkForm['max_gramm'] ?? '') ?>" min="0"></div>
      <div class="feld"><label for="g-sort">Sortierung</label><input id="g-sort" name="sortierung" type="number" value="<?= e($gkForm['sortierung'] ?? '100') ?>" min="0"></div>
      <label class="schalter"><input type="checkbox" name="aktiv" <?= ($gkForm === null || (int) $gkForm['aktiv'] === 1) ? 'checked' : '' ?>> Aktiv</label>
      <button class="knopf knopf--primaer" type="submit"><?= $gkForm !== null ? 'Speichern' : 'Anlegen' ?></button>
    </form>
    <?php } ?>
  </div>
  <div class="karte karte--tabelle">
    <div class="karte-kopf"><h2 class="h2">Carrier</h2></div>
    <div class="scrollen">
    <table class="tabelle">
      <thead><tr><th>Name</th><th class="rechts">Routen</th><th>Aktiv</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($carrier as $c) { ?>
        <tr class="<?= (int) $c['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <td><?= e($c['name']) ?></td><td class="mono rechts"><?= (int) $c['routen'] ?></td>
          <td><?= (int) $c['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
          <td class="rechts zeilen-aktionen">
            <?php if ($darfB) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('preise', ['bearbeiten' => 'carrier:' . $c['id']])) ?>#formular-carrier">Bearbeiten</a><?php } ?>
            <?php if ($darfL && (int) $c['routen'] === 0) { ?><form method="post" action="<?= e(url('preise/carrier/loeschen')) ?>" data-bestaetigen="Carrier <?= e($c['name']) ?> löschen?"><?= csrfFeld() ?><input type="hidden" name="id" value="<?= (int) $c['id'] ?>"><button class="knopf knopf--gefahr knopf--klein" type="submit">Löschen</button></form><?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table>
    </div>
    <?php if ($darfB) { ?>
    <form method="post" action="<?= e(url('preise/carrier')) ?>" class="formular formular--zeile" id="formular-carrier">
      <?= csrfFeld() ?>
      <input type="hidden" name="id" value="<?= (int) ($carrierForm['id'] ?? 0) ?>">
      <div class="feld feld--wachsen"><label for="c-name">Carrier</label><input id="c-name" name="name" value="<?= e($carrierForm['name'] ?? '') ?>" placeholder="z. B. Hermes" required></div>
      <label class="schalter"><input type="checkbox" name="aktiv" <?= ($carrierForm === null || (int) $carrierForm['aktiv'] === 1) ? 'checked' : '' ?>> Aktiv</label>
      <button class="knopf knopf--primaer" type="submit"><?= $carrierForm !== null ? 'Speichern' : 'Anlegen' ?></button>
    </form>
    <p class="leise" style="margin-top:.75rem">Ein deaktivierter Carrier fällt in der Routingmatrix aus; die nächste Priorität rückt nach.</p>
    <?php } ?>
  </div>
</div>
