<h1><?= e(t($sprache, 'titel.qr')) ?></h1>
<p>
    <?= e(t($sprache, 'qr.einleitung')) ?>
    &nbsp;<a href="/qr?lang=<?= $sprache === 'en' ? 'de' : 'en' ?>"><?= $sprache === 'en' ? 'Deutsch' : 'English' ?></a>
</p>

<?php foreach ($fehler as $meldung) { ?>
<p class="fehler"><?= e($meldung) ?></p>
<?php } ?>

<form method="post" enctype="multipart/form-data" action="/qr" class="karte">
    <input type="hidden" name="lang" value="<?= e($sprache) ?>">
    <!-- Honigtopf: für Menschen unsichtbar, Bots füllen es aus. -->
    <div class="versteckt" aria-hidden="true">
        <label>Firma <input type="text" name="firma" tabindex="-1" autocomplete="off"></label>
    </div>

    <div class="reihe">
        <label><?= e(t($sprache, 'qr.name')) ?>
            <input type="text" name="name" maxlength="100" required
                value="<?= e(saeubern($_POST['name'] ?? '')) ?>">
        </label>
        <label><?= e(t($sprache, 'qr.kontakt')) ?>
            <input type="text" name="kontakt" maxlength="100"
                value="<?= e(saeubern($_POST['kontakt'] ?? '')) ?>">
        </label>
    </div>

    <?php $gewaehlteZone = saeubern($_POST['zone'] ?? ''); require __DIR__ . '/_zonen.php'; ?>

    <label><?= e(t($sprache, 'beschreibung')) ?>
        <textarea name="beschreibung" rows="3" minlength="5" maxlength="2000" required
            placeholder="<?= e(t($sprache, 'beschreibung.platzhalter')) ?>"><?= e(saeubern($_POST['beschreibung'] ?? '')) ?></textarea>
    </label>

    <label class="foto-feld"><?= e(t($sprache, 'fotos', FOTOS_JE_SCHADEN)) ?>
        <input type="file" name="fotos[]" accept="image/*" capture="environment" multiple required>
        <small><?= e(t($sprache, 'fotos.hinweis')) ?></small>
    </label>
    <div class="foto-vorschau"></div>

    <button type="submit"><?= e(t($sprache, 'absenden')) ?></button>
</form>
