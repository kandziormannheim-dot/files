<?php
$formularfehler = $_SESSION['formularfehler'] ?? [];
unset($_SESSION['formularfehler']);
?>
<h1><?= e(t($sprache, 'titel.mieter')) ?></h1>
<p>
    <?= e(t($sprache, 'begruessung', (string) $vermietung['name'])) ?>
    <?= e(t($sprache, 'mieter.einleitung')) ?>
</p>
<p>
    <strong><?= e(t($sprache, 'mieter.zeitraum')) ?>:</strong>
    <?= e(datumAnzeigen($vermietung['von'])) ?> – <?= e(datumAnzeigen($vermietung['bis'])) ?>
</p>

<?php foreach ($formularfehler as $meldung) { ?>
<p class="fehler"><?= e($meldung) ?></p>
<?php } ?>

<section class="karte">
    <h2><?= e(t($sprache, 'neu.melden')) ?></h2>
    <form method="post" enctype="multipart/form-data" action="/m/<?= e($token) ?>/schaden">
        <?php $gewaehlteZone = ''; require __DIR__ . '/_zonen.php'; ?>
        <label><?= e(t($sprache, 'beschreibung')) ?>
            <textarea name="beschreibung" rows="3" minlength="5" maxlength="2000" required
                placeholder="<?= e(t($sprache, 'beschreibung.platzhalter')) ?>"></textarea>
        </label>
        <label class="foto-feld"><?= e(t($sprache, 'fotos', FOTOS_JE_SCHADEN)) ?>
            <input type="file" name="fotos[]" accept="image/*" capture="environment" multiple required>
            <small><?= e(t($sprache, 'fotos.hinweis')) ?></small>
        </label>
        <div class="foto-vorschau"></div>
        <button type="submit"><?= e(t($sprache, 'absenden')) ?></button>
    </form>
</section>

<section class="karte">
    <h2><?= e(t($sprache, 'eigene')) ?></h2>
    <?php if ($eigene === []) { ?>
    <p><?= e(t($sprache, 'eigene.keine')) ?></p>
    <?php } else { ?>
    <ul>
        <?php foreach ($eigene as $schaden) { ?>
        <li>
            <?= e(zonenName($schaden['zone'], $sprache)) ?> —
            <?= e(mb_substr($schaden['beschreibung'], 0, 120)) ?>
            <small>(<?= e(zeitAnzeigen($schaden['erstellt_am'])) ?>)</small>
            <?php foreach ($schaden['fotos'] as $foto) { ?>
            <a href="/foto/<?= (int) $foto['id'] ?>?t=<?= e($token) ?>" target="_blank">📷</a>
            <?php } ?>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>
</section>

<section class="karte">
    <h2><?= e(t($sprache, 'vorschaeden')) ?></h2>
    <p><small><?= e(t($sprache, 'vorschaeden.hinweis')) ?></small></p>
    <?php if ($vorschaeden === []) { ?>
    <p><?= e(t($sprache, 'vorschaeden.keine')) ?></p>
    <?php } else { ?>
    <ul>
        <?php foreach ($vorschaeden as $schaden) { ?>
        <li>
            <?= e(zonenName($schaden['zone'], $sprache)) ?> —
            <?= e(mb_substr($schaden['beschreibung'], 0, 120)) ?>
            <small>(<?= e(datumAnzeigen($schaden['erstellt_am'])) ?>)</small>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>
</section>

<?php $mitPdf = array_filter($protokolle, static fn (array $p): bool => (string) $p['pdf_datei'] !== ''); ?>
<?php if ($mitPdf !== []) { ?>
<section class="karte">
    <h2>PDF</h2>
    <ul>
        <?php foreach ($mitPdf as $protokoll) { ?>
        <li>
            <a href="/pdf/<?= (int) $protokoll['id'] ?>?t=<?= e($token) ?>">
                <?= e(t($sprache, 'protokoll.' . $protokoll['typ'])) ?>
                (<?= e(zeitAnzeigen($protokoll['abgeschlossen_am'])) ?>)
            </a>
        </li>
        <?php } ?>
    </ul>
</section>
<?php } ?>
