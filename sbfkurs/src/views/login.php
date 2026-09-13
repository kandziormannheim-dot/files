<?php $seitentitel = 'Anmeldung'; ?>
<section class="karte schmal">
    <h1>Anmeldung</h1>
    <?php if ($fehler !== null) { ?>
    <p class="fehler" role="alert"><?= e($fehler) ?></p>
    <?php } ?>
    <form method="post" action="/login">
        <?= csrfFeld() ?>
        <label>E-Mail-Adresse
            <input type="email" name="email" value="<?= e($email) ?>" autocomplete="username" required autofocus>
        </label>
        <label>Passwort
            <input type="password" name="passwort" autocomplete="current-password" required>
        </label>
        <button type="submit">Anmelden</button>
    </form>
    <p class="nachsatz">Noch kein Konto? <a href="/registrieren">Mit Einladungscode registrieren</a>.</p>
</section>
