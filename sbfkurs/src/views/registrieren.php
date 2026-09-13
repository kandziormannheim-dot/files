<?php $seitentitel = 'Registrieren'; ?>
<section class="karte schmal">
    <h1>Konto anlegen</h1>
    <?php if (!$offen) { ?>
    <p>Die Registrierung ist zurzeit geschlossen. Zugang gibt es über den Kursanbieter.</p>
    <p class="nachsatz"><a href="/login">Zur Anmeldung</a></p>
    <?php } else { ?>
    <?php if ($fehler !== null) { ?>
    <p class="fehler" role="alert"><?= e($fehler) ?></p>
    <?php } ?>
    <form method="post" action="/registrieren">
        <?= csrfFeld() ?>
        <label>Einladungscode
            <input type="text" name="code" value="<?= e($werte['code']) ?>" required autofocus autocomplete="off" spellcheck="false">
        </label>
        <label>Name <small>(wie du angesprochen werden möchtest)</small>
            <input type="text" name="name" value="<?= e($werte['name']) ?>" autocomplete="name" maxlength="100">
        </label>
        <label>E-Mail-Adresse
            <input type="email" name="email" value="<?= e($werte['email']) ?>" autocomplete="username" required>
        </label>
        <label>Passwort <small>(mindestens 10 Zeichen)</small>
            <input type="password" name="passwort" autocomplete="new-password" minlength="10" required>
        </label>
        <label>Passwort wiederholen
            <input type="password" name="passwort2" autocomplete="new-password" minlength="10" required>
        </label>
        <div class="versteckt" aria-hidden="true">
            <label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <button type="submit">Konto anlegen</button>
    </form>
    <p class="nachsatz">Schon registriert? <a href="/login">Anmelden</a>.</p>
    <?php } ?>
</section>
