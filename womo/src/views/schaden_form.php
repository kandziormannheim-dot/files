<?php $neu = $schaden === null; $sprache = 'de'; ?>
<h1><?= $neu ? 'Neuen Schaden anlegen' : 'Schaden bearbeiten' ?></h1>

<?php foreach ($fehler as $meldung) { ?>
<p class="fehler"><?= e($meldung) ?></p>
<?php } ?>

<form method="post" enctype="multipart/form-data" class="karte"
      action="<?= $neu ? '/schaden/neu' : '/schaden/' . (int) $schaden['id'] ?>">
    <?= csrfFeld() ?>

    <?php $gewaehlteZone = $schaden['zone'] ?? saeubern($_POST['zone'] ?? ''); ?>
    <?php require __DIR__ . '/_zonen.php'; ?>

    <label>Beschreibung
        <textarea name="beschreibung" rows="3" minlength="5" maxlength="2000" required
            placeholder="Was, wie groß, wie ist es passiert?"><?= e($schaden['beschreibung'] ?? saeubern($_POST['beschreibung'] ?? '')) ?></textarea>
    </label>

    <div class="reihe">
        <label>Status
            <select name="status">
                <?php foreach (['offen', 'gemeldet', 'repariert'] as $status) { ?>
                <option value="<?= e($status) ?>"
                    <?= ($schaden['status'] ?? 'offen') === $status ? 'selected' : '' ?>>
                    <?= e(ucfirst(statusName($status))) ?>
                </option>
                <?php } ?>
            </select>
        </label>
        <label>Kostenschätzung (€)
            <input type="text" name="kosten" inputmode="decimal" placeholder="z. B. 250,00"
                value="<?= e(euro(isset($schaden['kosten_cent']) && $schaden['kosten_cent'] !== null ? (int) $schaden['kosten_cent'] : null)) ?>">
        </label>
    </div>

    <div class="reihe">
        <label>Verursacher
            <input type="text" name="verursacher" maxlength="200"
                value="<?= e($schaden['verursacher'] ?? '') ?>">
        </label>
        <label>Werkstatt
            <input type="text" name="werkstatt" maxlength="200"
                value="<?= e($schaden['werkstatt'] ?? '') ?>">
        </label>
    </div>

    <label>Vermietung zuordnen
        <select name="vermietung_id">
            <option value="">— eigene Akte / keine —</option>
            <?php foreach ($vermietungen as $vermietung) { ?>
            <option value="<?= (int) $vermietung['id'] ?>"
                <?= (int) ($schaden['vermietung_id'] ?? 0) === (int) $vermietung['id'] ? 'selected' : '' ?>>
                <?= e($vermietung['name']) ?>
                (<?= e(datumAnzeigen($vermietung['von'])) ?> – <?= e(datumAnzeigen($vermietung['bis'])) ?>)
            </option>
            <?php } ?>
        </select>
    </label>

    <label>Interne Notiz <small>(sieht kein Mieter)</small>
        <textarea name="notiz" rows="2" maxlength="2000"><?= e($schaden['notiz'] ?? '') ?></textarea>
    </label>

    <label class="foto-feld"><?= $neu ? 'Fotos (Pflicht, bis zu ' . FOTOS_JE_SCHADEN . ')' : 'Weitere Fotos anhängen' ?>
        <input type="file" name="fotos[]" accept="image/*" capture="environment" multiple
            <?= $neu ? 'required' : '' ?>>
    </label>
    <div class="foto-vorschau"></div>

    <button type="submit"><?= $neu ? 'Schaden anlegen' : 'Speichern' ?></button>
</form>

<?php if (!$neu) { ?>
    <?php if ($schaden['fotos'] !== []) { ?>
    <section class="karte">
        <h2>Fotos</h2>
        <div class="galerie">
            <?php foreach ($schaden['fotos'] as $foto) { ?>
            <figure>
                <a href="/foto/<?= (int) $foto['id'] ?>" target="_blank">
                    <img src="/foto/<?= (int) $foto['id'] ?>" alt="Schadensfoto" loading="lazy">
                </a>
                <form method="post" action="/schaden/<?= (int) $schaden['id'] ?>"
                      data-bestaetigen="Dieses Foto löschen?">
                    <?= csrfFeld() ?>
                    <input type="hidden" name="aktion" value="foto_loeschen">
                    <input type="hidden" name="foto_id" value="<?= (int) $foto['id'] ?>">
                    <button type="submit" class="leise">Foto löschen</button>
                </form>
            </figure>
            <?php } ?>
        </div>
    </section>
    <?php } ?>

    <form method="post" action="/schaden/<?= (int) $schaden['id'] ?>"
          data-bestaetigen="Diesen Schaden samt Fotos unwiderruflich löschen?">
        <?= csrfFeld() ?>
        <input type="hidden" name="aktion" value="loeschen">
        <button type="submit" class="gefahr">Schaden löschen</button>
    </form>
<?php } ?>
