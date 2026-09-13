<?php
$seitentitel = 'Konto';
$erzwungen = (int) $benutzer['passwort_wechsel_noetig'] === 1;
?>
<h1>Dein Konto</h1>
<?php if ($erzwungen) { ?>
<p class="karte warnung">Dein Passwort wurde zurückgesetzt. Bitte lege jetzt ein eigenes fest — vorher geht es nicht weiter.</p>
<?php } ?>
<?php if ($fehler !== null) { ?>
<p class="fehler" role="alert"><?= e($fehler) ?></p>
<?php } ?>
<div class="zweispaltig">
    <section class="karte">
        <h2>Passwort ändern</h2>
        <form method="post" action="/konto">
            <?= csrfFeld() ?>
            <input type="hidden" name="aktion" value="passwort">
            <?php if (!$erzwungen) { ?>
            <label>Bisheriges Passwort
                <input type="password" name="alt" autocomplete="current-password" required>
            </label>
            <?php } ?>
            <label>Neues Passwort <small>(mindestens 10 Zeichen)</small>
                <input type="password" name="neu" autocomplete="new-password" minlength="10" required<?= $erzwungen ? ' autofocus' : '' ?>>
            </label>
            <label>Neues Passwort wiederholen
                <input type="password" name="neu2" autocomplete="new-password" minlength="10" required>
            </label>
            <button type="submit">Passwort speichern</button>
        </form>
    </section>
    <?php if (!$erzwungen) { ?>
    <section class="karte">
        <h2>Name</h2>
        <form method="post" action="/konto">
            <?= csrfFeld() ?>
            <input type="hidden" name="aktion" value="name">
            <label>Anzeigename
                <input type="text" name="name" value="<?= e($benutzer['name']) ?>" maxlength="100" autocomplete="name">
            </label>
            <button type="submit">Name speichern</button>
        </form>
        <p><small>Angemeldet als <?= e($benutzer['email']) ?> · Rolle: <?= e($benutzer['rolle']) ?></small></p>
    </section>
    <?php } ?>
</div>
