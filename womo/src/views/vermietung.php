<h1>Vermietung: <?= e($vermietung['name']) ?></h1>

<section class="karte">
    <p>
        <strong>Zeitraum:</strong>
        <?= e(datumAnzeigen($vermietung['von'])) ?> – <?= e(datumAnzeigen($vermietung['bis'])) ?>
        &nbsp; <strong>Status:</strong> <?= e($vermietung['status']) ?>
        &nbsp; <strong>Sprache:</strong> <?= $vermietung['sprache'] === 'en' ? 'Englisch' : 'Deutsch' ?>
    </p>
    <?php if ((string) $vermietung['email'] !== '' || (string) $vermietung['telefon'] !== '') { ?>
    <p>
        <?php if ((string) $vermietung['email'] !== '') { ?>
        <strong>E-Mail:</strong> <?= e($vermietung['email']) ?> &nbsp;
        <?php } ?>
        <?php if ((string) $vermietung['telefon'] !== '') { ?>
        <strong>Telefon:</strong> <?= e($vermietung['telefon']) ?>
        <?php } ?>
    </p>
    <?php } ?>

    <?php if ((int) $vermietung['anonymisiert'] === 1) { ?>
    <p class="hinweis">Diese Vermietung ist anonymisiert — Mieterdaten und Protokolldateien wurden entfernt.</p>
    <?php } elseif ($vermietung['token'] !== null) { ?>
    <p><strong>Mieter-Link</strong> (per Mail oder Messenger verschicken — gültig ab einem Tag
        vor Mietbeginn bis <?= (int) $konfig['tokenNachlauf'] ?> Tage nach Mietende):</p>
    <p><code class="kopierbar"><?= e(rtrim((string) $konfig['basisUrl'], '/')) ?>/m/<?= e($vermietung['token']) ?></code></p>
    <?php } ?>
</section>

<?php if ((int) $vermietung['anonymisiert'] === 0) { ?>
<section class="karte">
    <h2>Protokolle</h2>
    <?php if ($protokolle === []) { ?>
    <p>Noch kein Protokoll erstellt.</p>
    <?php } else { ?>
    <ul>
        <?php foreach ($protokolle as $protokoll) { ?>
        <li>
            <a href="/protokoll/<?= (int) $protokoll['id'] ?>">
                <?= e(t('de', 'protokoll.' . $protokoll['typ'])) ?>
            </a>
            — <?= $protokoll['status'] === 'entwurf' ? 'Entwurf' : 'abgeschlossen am ' . e(zeitAnzeigen($protokoll['abgeschlossen_am'])) ?>
            <?php if ((string) $protokoll['pdf_datei'] !== '') { ?>
            · <a href="/pdf/<?= (int) $protokoll['id'] ?>">PDF</a>
            <?php } ?>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>
    <div class="reihe">
        <form method="post" action="/vermietung/<?= (int) $vermietung['id'] ?>/protokoll" class="inline">
            <?= csrfFeld() ?>
            <input type="hidden" name="typ" value="uebergabe">
            <button type="submit">Übergabeprotokoll starten</button>
        </form>
        <form method="post" action="/vermietung/<?= (int) $vermietung['id'] ?>/protokoll" class="inline">
            <?= csrfFeld() ?>
            <input type="hidden" name="typ" value="rueckgabe">
            <button type="submit">Rückgabeprotokoll starten</button>
        </form>
    </div>
</section>
<?php } ?>

<section class="karte">
    <h2>Schäden dieser Vermietung</h2>
    <?php if ($schaeden === []) { ?>
    <p>Keine Schäden zugeordnet.</p>
    <?php } else { ?>
    <ul>
        <?php foreach ($schaeden as $schaden) { ?>
        <li>
            <a href="/schaden/<?= (int) $schaden['id'] ?>">
                <?= e(zonenName($schaden['zone'])) ?> — <?= e(mb_substr($schaden['beschreibung'], 0, 80)) ?>
            </a>
            <small>(<?= e(statusName($schaden['status'])) ?>, <?= e(zeitAnzeigen($schaden['erstellt_am'])) ?>)</small>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>
</section>

<?php if ($unzugeordnet !== []) { ?>
<section class="karte">
    <h2>Unzugeordnete QR-Meldungen</h2>
    <p>Zum Zuordnen die Meldung öffnen und dort diese Vermietung wählen.</p>
    <ul>
        <?php foreach ($unzugeordnet as $schaden) { ?>
        <li>
            <a href="/schaden/<?= (int) $schaden['id'] ?>">
                <?= e(zonenName($schaden['zone'])) ?> — <?= e(mb_substr($schaden['beschreibung'], 0, 80)) ?>
            </a>
            <small>(<?= e($schaden['verursacher']) ?>, <?= e(zeitAnzeigen($schaden['erstellt_am'])) ?>)</small>
        </li>
        <?php } ?>
    </ul>
</section>
<?php } ?>

<?php if ((int) $vermietung['anonymisiert'] === 0) { ?>
<form method="post" action="/vermietung/<?= (int) $vermietung['id'] ?>/anonymisieren"
      data-bestaetigen="Name, Kontakt, Link, Unterschriften und PDFs dieser Vermietung unwiderruflich entfernen?">
    <?= csrfFeld() ?>
    <button type="submit" class="gefahr">Mieterdaten anonymisieren</button>
</form>
<?php } ?>
