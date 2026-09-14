<?php $ich = benutzerAktuell(); ?>
<header class="kopfzeile">
  <div><span class="eyebrow">Konto</span><h1 class="h1">Mein Konto</h1></div>
</header>
<div class="spalten">
  <div class="karte">
    <h2 class="h2">Passwort ändern</h2>
    <?php if ((int) $ich['muss_passwort_aendern'] === 1) { ?>
      <p class="hinweis hinweis--fehler">Du nutzt noch ein Startpasswort. Bitte jetzt ein eigenes setzen (mindestens <?= PASSWORT_MINDESTLAENGE ?> Zeichen).</p>
    <?php } ?>
    <?php if ($fehler !== null) { ?><p class="hinweis hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="<?= e(url('konto')) ?>" class="formular">
      <?= csrfFeld() ?>
      <div class="feld"><label for="alt">Bisheriges Passwort</label><input id="alt" name="alt" type="password" autocomplete="current-password" required></div>
      <div class="feld"><label for="neu">Neues Passwort</label><input id="neu" name="neu" type="password" autocomplete="new-password" minlength="<?= PASSWORT_MINDESTLAENGE ?>" required></div>
      <div class="feld"><label for="wiederholung">Neues Passwort wiederholen</label><input id="wiederholung" name="wiederholung" type="password" autocomplete="new-password" minlength="<?= PASSWORT_MINDESTLAENGE ?>" required></div>
      <div class="formular-fuss"><button class="knopf knopf--primaer" type="submit">Passwort speichern</button></div>
    </form>
  </div>
  <div class="karte">
    <h2 class="h2">Angaben</h2>
    <dl class="liste">
      <dt>Name</dt><dd><?= e($ich['name']) ?></dd>
      <dt>E-Mail</dt><dd><?= e($ich['email']) ?></dd>
      <dt>Rolle</dt><dd><?= e($ich['rolle']) ?><?= (int) $ich['system'] === 1 ? ' <span class="pille">Systemrolle</span>' : '' ?></dd>
      <dt>Letzte Anmeldung</dt><dd><?= e(zeitAnzeigen($ich['letzte_anmeldung'])) ?></dd>
    </dl>
    <h3 class="h3" style="margin-top:1.5rem">Deine Rechte</h3>
<div class="scrollen">
    <table class="tabelle tabelle--kompakt">
      <thead><tr><th>Modul</th><?php foreach (RECHTE as $r) { ?><th class="mitte"><?= e($r) ?></th><?php } ?></tr></thead>
      <tbody>
      <?php foreach (MODULE as $modul => $name) { ?>
        <tr><td><?= e($name) ?></td><?php foreach (RECHTE as $recht => $_) { ?><td class="mitte"><?= darf($modul, $recht) ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td><?php } ?></tr>
      <?php } ?>
      </tbody>
    </table>
</div>
  </div>
</div>
