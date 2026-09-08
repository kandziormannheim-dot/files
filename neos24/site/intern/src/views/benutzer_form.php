<?php
$darfB = darf('benutzer', 'bearbeiten');
$ich = benutzerAktuell();
$neu = $b === null;
$selbst = !$neu && (int) $b['id'] === (int) $ich['id'];
?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('benutzer')) ?>">← Benutzer</a><h1 class="h1"><?= $neu ? 'Neuer Benutzer' : e($b['name']) ?></h1></div>
</header>
<?php if ($startpasswort !== null) { ?>
<div class="karte karte--gelb">
  <h2 class="h2">Startpasswort</h2>
  <p>Jetzt an <strong><?= e($b['email']) ?></strong> weitergeben — es wird nach dem Verlassen dieser Seite nicht mehr angezeigt. Beim ersten Anmelden muss ein eigenes Passwort gesetzt werden.</p>
  <p class="passwort-anzeige mono" data-kopieren><?= e($startpasswort) ?></p>
</div>
<?php } ?>
<div class="spalten spalten--2-1">
  <div class="karte">
    <?php if ($fehler !== null) { ?><p class="hinweis hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="<?= e(url($neu ? 'benutzer/neu' : 'benutzer/' . $b['id'])) ?>" class="formular">
      <?= csrfFeld() ?>
      <div class="feld"><label for="email">E-Mail (Anmeldename)</label><input id="email" name="email" type="email" value="<?= e($werte['email']) ?>" <?= $neu ? 'required' : 'readonly' ?> <?= $darfB ? '' : 'readonly' ?>></div>
      <div class="feld"><label for="name">Name</label><input id="name" name="name" value="<?= e($werte['name']) ?>" minlength="2" required <?= $darfB ? '' : 'readonly' ?>></div>
      <div class="feld"><label for="rolle">Rolle</label>
        <select id="rolle" name="rolle_id" required <?= $darfB && !$selbst ? '' : 'disabled' ?>>
          <option value="">Bitte wählen</option>
          <?php foreach ($rollen as $r) { ?><option value="<?= (int) $r['id'] ?>" <?= (int) $werte['rolle_id'] === (int) $r['id'] ? 'selected' : '' ?>><?= e($r['name']) ?><?= $r['beschreibung'] !== '' ? ' — ' . e(mb_substr($r['beschreibung'], 0, 60)) : '' ?></option><?php } ?>
        </select>
        <?php if ($selbst) { ?><input type="hidden" name="rolle_id" value="<?= (int) $werte['rolle_id'] ?>"><span class="leise">Die eigene Rolle ändert nur ein anderer Admin.</span><?php } ?>
      </div>
      <?php if (!$neu) { ?>
        <?php if ($selbst) { ?><input type="hidden" name="aktiv" value="1"><?php } else { ?>
        <label class="schalter"><input type="checkbox" name="aktiv" <?= (int) $b['aktiv'] === 1 ? 'checked' : '' ?> <?= $darfB ? '' : 'disabled' ?>> Aktiv (kann sich anmelden)</label>
        <?php } ?>
      <?php } ?>
      <?php if ($darfB) { ?>
      <div class="formular-fuss"><button class="knopf knopf--primaer" type="submit"><?= $neu ? 'Benutzer anlegen' : 'Speichern' ?></button><?php if ($neu) { ?><span class="leise">Ein Startpasswort wird erzeugt und einmal angezeigt.</span><?php } ?></div>
      <?php } ?>
    </form>
  </div>
  <?php if (!$neu) { ?>
  <div>
    <div class="karte">
      <dl class="liste">
        <dt>Rolle</dt><dd><?= e($b['rolle']) ?></dd>
        <dt>Angelegt</dt><dd><?= e(zeitAnzeigen($b['erstellt'])) ?></dd>
        <dt>Letzte Anmeldung</dt><dd><?= e(zeitAnzeigen($b['letzte_anmeldung'])) ?></dd>
        <dt>Passwort</dt><dd><?= (int) $b['muss_passwort_aendern'] === 1 ? 'Startpasswort, Wechsel ausstehend' : 'eigenes' ?></dd>
        <?php if ($b['gesperrt_bis'] !== null && $b['gesperrt_bis'] > jetzt()) { ?><dt>Gesperrt bis</dt><dd><?= e(zeitAnzeigen($b['gesperrt_bis'])) ?></dd><?php } ?>
      </dl>
    </div>
    <?php if ($darfB) { ?>
    <div class="karte">
      <form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/passwort')) ?>" data-bestaetigen="Neues Startpasswort für <?= e($b['email']) ?> erzeugen? Das bisherige Passwort gilt dann nicht mehr."><?= csrfFeld() ?><button class="knopf knopf--leise knopf--breit" type="submit">Passwort zurücksetzen</button><span class="leise">hebt auch eine Sperre auf</span></form>
    </div>
    <?php } ?>
    <?php if (darf('benutzer', 'loeschen') && !$selbst) { ?>
    <div class="karte">
      <form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/loeschen')) ?>" data-bestaetigen="Benutzer <?= e($b['email']) ?> endgültig löschen?"><?= csrfFeld() ?><button class="knopf knopf--gefahr knopf--breit" type="submit" <?= !empty($letzterAdmin) ? 'disabled' : '' ?>>Benutzer löschen</button><?php if (!empty($letzterAdmin)) { ?><span class="leise">letzter aktiver Admin</span><?php } ?></form>
    </div>
    <?php } ?>
  </div>
  <?php } ?>
</div>
