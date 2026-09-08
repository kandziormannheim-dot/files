<div class="anmeldung">
  <div class="karte karte--ink anmeldung-karte">
    <svg class="logo" viewBox="0 0 112 40" width="112" height="40" aria-hidden="true"><use href="#neos-logo"></use></svg>
    <h1 class="h1">Internes Dashboard</h1>
    <p class="leise">Anmeldung nur für das NEOS-Team.</p>
    <?php if ($keineBenutzer) { ?>
      <p class="hinweis hinweis--fehler">Noch kein Konto vorhanden. Ersten Admin auf dem Server anlegen:<br><code>php intern/einrichten.php admin@neos24.com "Name"</code></p>
    <?php } elseif ($fehler !== null) { ?>
      <p class="hinweis hinweis--fehler" role="alert"><?= e($fehler) ?></p>
    <?php } ?>
    <form method="post" action="<?= e(url('login')) ?>" class="formular">
      <?= csrfFeld() ?>
      <input type="hidden" name="weiter" value="<?= e($weiter) ?>">
      <div class="feld">
        <label for="email">E-Mail</label>
        <input id="email" name="email" type="email" autocomplete="username" required autofocus>
      </div>
      <div class="feld">
        <label for="passwort">Passwort</label>
        <input id="passwort" name="passwort" type="password" autocomplete="current-password" required>
      </div>
      <button class="knopf knopf--primaer knopf--breit" type="submit">Anmelden</button>
    </form>
  </div>
</div>
