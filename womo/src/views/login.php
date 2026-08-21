<section class="karte schmal">
    <h1>Anmeldung</h1>
    <?php if ($fehler !== null) { ?>
    <p class="fehler"><?= e($fehler) ?></p>
    <?php } ?>
    <form method="post" action="/login">
        <?= csrfFeld() ?>
        <label>Admin-Passwort
            <input type="password" name="passwort" autocomplete="current-password" required autofocus>
        </label>
        <button type="submit">Anmelden</button>
    </form>
</section>
