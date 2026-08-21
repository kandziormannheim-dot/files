<h1>Vermietungen</h1>

<?php foreach ($fehler as $meldung) { ?>
<p class="fehler"><?= e($meldung) ?></p>
<?php } ?>

<section class="karte">
    <h2>Neue Vermietung</h2>
    <form method="post" action="/vermietungen">
        <?= csrfFeld() ?>
        <div class="reihe">
            <label>Name des Mieters
                <input type="text" name="name" maxlength="100" required
                    value="<?= e(saeubern($_POST['name'] ?? '')) ?>">
            </label>
            <label>E-Mail <small>(für Protokoll-PDF)</small>
                <input type="email" name="email" maxlength="254"
                    value="<?= e(saeubern($_POST['email'] ?? '')) ?>">
            </label>
        </div>
        <div class="reihe">
            <label>Telefon
                <input type="text" name="telefon" maxlength="50"
                    value="<?= e(saeubern($_POST['telefon'] ?? '')) ?>">
            </label>
            <label>Sprache des Mieters
                <select name="sprache">
                    <option value="de">Deutsch</option>
                    <option value="en" <?= ($_POST['sprache'] ?? '') === 'en' ? 'selected' : '' ?>>Englisch</option>
                </select>
            </label>
        </div>
        <div class="reihe">
            <label>Mietbeginn
                <input type="date" name="von" required value="<?= e(saeubern($_POST['von'] ?? '')) ?>">
            </label>
            <label>Mietende
                <input type="date" name="bis" required value="<?= e(saeubern($_POST['bis'] ?? '')) ?>">
            </label>
        </div>
        <button type="submit">Vermietung anlegen</button>
    </form>
</section>

<?php if ($vermietungen === []) { ?>
<p>Noch keine Vermietungen angelegt.</p>
<?php } else { ?>
<table class="liste">
    <thead>
        <tr><th>Mieter</th><th>Zeitraum</th><th>Status</th><th></th></tr>
    </thead>
    <tbody>
        <?php foreach ($vermietungen as $vermietung) { ?>
        <tr>
            <td><?= e($vermietung['name']) ?><?= (int) $vermietung['anonymisiert'] === 1 ? ' 🔒' : '' ?></td>
            <td><?= e(datumAnzeigen($vermietung['von'])) ?> – <?= e(datumAnzeigen($vermietung['bis'])) ?></td>
            <td><?= e($vermietung['status']) ?></td>
            <td><a href="/vermietung/<?= (int) $vermietung['id'] ?>">Öffnen</a></td>
        </tr>
        <?php } ?>
    </tbody>
</table>
<?php } ?>
