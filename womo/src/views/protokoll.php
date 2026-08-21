<?php $sprache = 'de'; $entwurf = $protokoll['status'] === 'entwurf' && (int) $protokoll['anonymisiert'] === 0; ?>
<h1><?= e(t('de', 'protokoll.' . $protokoll['typ'])) ?> — <?= e($protokoll['mieter_name']) ?></h1>
<p>
    Mietzeitraum <?= e(datumAnzeigen($protokoll['von'])) ?> – <?= e(datumAnzeigen($protokoll['bis'])) ?>
    · begonnen <?= e(zeitAnzeigen($protokoll['erstellt_am'])) ?>
    <?php if (!$entwurf) { ?>
    · abgeschlossen <?= e(zeitAnzeigen($protokoll['abgeschlossen_am'])) ?>
    · <a href="/pdf/<?= (int) $protokoll['id'] ?>">PDF öffnen</a>
    <?php } ?>
</p>

<?php foreach ($fehler as $meldung) { ?>
<p class="fehler"><?= e($meldung) ?></p>
<?php } ?>

<section class="karte">
    <h2>Vorschäden <small>(vor diesem Protokoll dokumentiert)</small></h2>
    <?php if ($vorschaeden === []) { ?>
    <p>Keine offenen Vorschäden.</p>
    <?php } else { ?>
    <ul>
        <?php foreach ($vorschaeden as $schaden) { ?>
        <li>
            <a href="/schaden/<?= (int) $schaden['id'] ?>"><?= e(zonenName($schaden['zone'])) ?></a>
            — <?= e(mb_substr($schaden['beschreibung'], 0, 100)) ?>
            <small>(<?= e(statusName($schaden['status'])) ?>, <?= e(datumAnzeigen($schaden['erstellt_am'])) ?>)</small>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>
    <p><small>Diese Liste steht auch im PDF — der Mieter haftet nicht für Vorschäden.</small></p>
</section>

<section class="karte">
    <h2>In diesem Protokoll festgehaltene Schäden</h2>
    <?php if ($neue === []) { ?>
    <p>Noch keine. <?= $entwurf ? 'Beim Rundgang unten erfassen.' : '' ?></p>
    <?php } else { ?>
    <ul>
        <?php foreach ($neue as $schaden) { ?>
        <li>
            <a href="/schaden/<?= (int) $schaden['id'] ?>"><?= e(zonenName($schaden['zone'])) ?></a>
            — <?= e(mb_substr($schaden['beschreibung'], 0, 100)) ?>
            <small>📷 <?= count($schaden['fotos']) ?></small>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>

    <?php if ($entwurf) { ?>
    <details class="aufklappen" <?= $fehler !== [] ? 'open' : '' ?>>
        <summary>Schaden hinzufügen</summary>
        <form method="post" enctype="multipart/form-data"
              action="/protokoll/<?= (int) $protokoll['id'] ?>/schaden">
            <?= csrfFeld() ?>
            <?php $gewaehlteZone = saeubern($_POST['zone'] ?? ''); require __DIR__ . '/_zonen.php'; ?>
            <label>Beschreibung
                <textarea name="beschreibung" rows="3" minlength="5" maxlength="2000" required
                    placeholder="Was, wie groß, wie ist es passiert?"><?= e(saeubern($_POST['beschreibung'] ?? '')) ?></textarea>
            </label>
            <label class="foto-feld">Fotos (Pflicht, bis zu <?= FOTOS_JE_SCHADEN ?>)
                <input type="file" name="fotos[]" accept="image/*" capture="environment" multiple required>
            </label>
            <div class="foto-vorschau"></div>
            <button type="submit">Schaden festhalten</button>
        </form>
    </details>
    <?php } ?>
</section>

<?php if ($entwurf) { ?>
<section class="karte">
    <h2>Abschließen</h2>
    <form method="post" action="/protokoll/<?= (int) $protokoll['id'] ?>/abschliessen" class="abschluss">
        <?= csrfFeld() ?>
        <div class="reihe">
            <label>Kilometerstand
                <input type="text" name="km_stand" inputmode="numeric" maxlength="20"
                    value="<?= e(saeubern($_POST['km_stand'] ?? '')) ?>">
            </label>
            <label>Bemerkung <small>(Tankfüllung, Gasflaschen, Sauberkeit …)</small>
                <input type="text" name="bemerkung" maxlength="2000"
                    value="<?= e(saeubern($_POST['bemerkung'] ?? '')) ?>">
            </label>
        </div>

        <div class="unterschriften">
            <div class="unterschrift" data-ziel="unterschrift_mieter">
                <p>Unterschrift Mieter (<?= e($protokoll['mieter_name']) ?>)</p>
                <canvas width="600" height="240"></canvas>
                <button type="button" class="leise leeren">Neu ansetzen</button>
                <input type="hidden" name="unterschrift_mieter">
            </div>
            <div class="unterschrift" data-ziel="unterschrift_vermieter">
                <p>Unterschrift Vermieter</p>
                <canvas width="600" height="240"></canvas>
                <button type="button" class="leise leeren">Neu ansetzen</button>
                <input type="hidden" name="unterschrift_vermieter">
            </div>
        </div>

        <p><small>Mit dem Abschluss wird das PDF erzeugt und
            <?= (string) $protokoll['mieter_email'] !== '' ? 'an ' . e($protokoll['mieter_email']) . ' und ' : 'an ' ?>
            <?= e($konfig['empfaenger']) ?> verschickt. Danach ist das Protokoll nicht mehr änderbar.</small></p>
        <button type="submit">Protokoll abschließen</button>
    </form>
</section>
<?php } ?>
