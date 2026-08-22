<?php $neu = $schaden === null; $sprache = 'de'; ?>
<?php $gewaehlterTyp = $schaden['typ'] ?? (array_key_exists($_POST['typ'] ?? '', typen()) ? (string) $_POST['typ'] : 'schaden'); ?>
<h1><?= $neu
    ? 'Neuen Vorgang anlegen'
    : e(vorgangsnummer((int) $schaden['id'], (string) $schaden['erstellt_am'])) . ' bearbeiten' ?></h1>

<?php foreach ($fehler as $meldung) { ?>
<p class="fehler"><?= e($meldung) ?></p>
<?php } ?>

<form method="post" enctype="multipart/form-data" class="karte"
      action="<?= $neu ? '/schaden/neu' : '/schaden/' . (int) $schaden['id'] ?>">
    <?= csrfFeld() ?>

    <div class="reihe">
        <label>Art des Vorgangs
            <select name="typ" id="vorgangstyp">
                <?php foreach (typen() as $typSchluessel => $typNamen) { ?>
                <option value="<?= e($typSchluessel) ?>"
                    <?= $gewaehlterTyp === $typSchluessel ? 'selected' : '' ?>>
                    <?= e($typNamen['de']) ?><?= $typSchluessel === 'werkstattauftrag' ? ' (z. B. Nachrüstung)' : '' ?>
                </option>
                <?php } ?>
            </select>
        </label>
        <label>Fahrzeug
            <select name="fahrzeug_id">
                <?php foreach ($fahrzeuge as $fahrzeug) { ?>
                <option value="<?= (int) $fahrzeug['id'] ?>"
                    <?= (int) ($schaden['fahrzeug_id'] ?? ($fahrzeuge[0]['id'] ?? 0)) === (int) $fahrzeug['id'] ? 'selected' : '' ?>>
                    <?= e($fahrzeug['name']) ?><?= (string) $fahrzeug['kennzeichen'] !== '' ? ' (' . e($fahrzeug['kennzeichen']) . ')' : '' ?>
                </option>
                <?php } ?>
            </select>
        </label>
    </div>

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

    <label>Kommentar der Werkstatt <small>(erscheint in der Vorgangsliste)</small>
        <textarea name="werkstatt_kommentar" rows="2" maxlength="2000"
            placeholder="z. B. Ersatzteil bestellt, Termin am …"><?= e($schaden['werkstatt_kommentar'] ?? '') ?></textarea>
    </label>

    <label>Interne Notiz <small>(sieht kein Mieter)</small>
        <textarea name="notiz" rows="2" maxlength="2000"><?= e($schaden['notiz'] ?? '') ?></textarea>
    </label>

    <label class="foto-feld">Rechnungen anhängen <small>(PDF oder Foto)</small>
        <input type="file" name="rechnungen[]" accept="application/pdf,image/*" multiple>
    </label>

    <label class="foto-feld"><?= $neu
            ? 'Fotos (bei Schäden Pflicht, bis zu ' . FOTOS_JE_SCHADEN . ')'
            : 'Weitere Fotos anhängen' ?>
        <input type="file" name="fotos[]" accept="image/*" capture="environment" multiple
            <?= $neu && $gewaehlterTyp === 'schaden' ? 'required' : '' ?>>
    </label>
    <div class="foto-vorschau"></div>

    <button type="submit"><?= $neu ? 'Vorgang anlegen' : 'Speichern' ?></button>
</form>

<?php if ($neu) { ?>
<script>
// Foto-Pflicht hängt an der Vorgangsart: für einen Werkstattauftrag
// (etwa eine geplante Nachrüstung) gibt es oft noch kein Foto.
(function () {
    var typ = document.getElementById('vorgangstyp');
    var fotos = document.querySelector('.foto-feld input[type="file"]');
    if (!typ || !fotos) { return; }
    function abgleichen() { fotos.required = typ.value === 'schaden'; }
    typ.addEventListener('change', abgleichen);
    abgleichen();
})();
</script>
<?php } ?>

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

    <section class="karte">
        <h2>Rechnungen</h2>
        <?php if ($schaden['rechnungen'] === []) { ?>
        <p>Noch keine Rechnung angehängt — oben im Formular hochladen (PDF oder Foto).</p>
        <?php } else { ?>
        <ul class="rechnungen">
            <?php foreach ($schaden['rechnungen'] as $rechnung) { ?>
            <li>
                🧾 <a href="/rechnung/<?= (int) $rechnung['id'] ?>" target="_blank"><?= e($rechnung['name']) ?></a>
                <small>(<?= e(zeitAnzeigen($rechnung['erstellt_am'])) ?>)</small>
                <form method="post" action="/schaden/<?= (int) $schaden['id'] ?>" class="inline"
                      data-bestaetigen="Diese Rechnung löschen?">
                    <?= csrfFeld() ?>
                    <input type="hidden" name="aktion" value="rechnung_loeschen">
                    <input type="hidden" name="rechnung_id" value="<?= (int) $rechnung['id'] ?>">
                    <button type="submit" class="leise">Löschen</button>
                </form>
            </li>
            <?php } ?>
        </ul>
        <?php } ?>
    </section>

    <section class="karte">
        <h2>Protokolle zu diesem Vorgang</h2>
        <?php if (($protokolle ?? []) === []) { ?>
        <p>Keine Protokolle verknüpft — der Vorgang gehört zu keiner Vermietung mit Protokoll.</p>
        <?php } else { ?>
        <ul>
            <?php foreach ($protokolle as $protokoll) { ?>
            <li>
                <a href="/protokoll/<?= (int) $protokoll['id'] ?>">
                    <?= e(t('de', 'protokoll.' . $protokoll['typ'])) ?> — <?= e($protokoll['mieter_name']) ?>
                </a>
                <?= (int) $schaden['protokoll_id'] === (int) $protokoll['id'] ? '<small>(hier erfasst)</small>' : '' ?>
                — <?= $protokoll['status'] === 'entwurf' ? 'Entwurf' : 'abgeschlossen am ' . e(zeitAnzeigen($protokoll['abgeschlossen_am'])) ?>
                <?php if ((string) $protokoll['pdf_datei'] !== '') { ?>
                · <a href="/pdf/<?= (int) $protokoll['id'] ?>" target="_blank">PDF</a>
                <?php } ?>
            </li>
            <?php } ?>
        </ul>
        <?php } ?>
    </section>

    <section class="karte">
        <h2>Verlauf</h2>
        <ul class="verlauf">
            <?php foreach (array_reverse($schaden['verlauf']) as $eintrag) { ?>
            <li><small><?= e(zeitAnzeigen($eintrag['erstellt_am'])) ?></small> <?= e($eintrag['text']) ?></li>
            <?php } ?>
            <li><small><?= e(zeitAnzeigen($schaden['erstellt_am'])) ?></small>
                Erfasst (Quelle: <?= e($schaden['quelle']) ?>)</li>
        </ul>
    </section>

    <form method="post" action="/schaden/<?= (int) $schaden['id'] ?>"
          data-bestaetigen="Diesen Vorgang samt Fotos und Rechnungen unwiderruflich löschen?">
        <?= csrfFeld() ?>
        <input type="hidden" name="aktion" value="loeschen">
        <button type="submit" class="gefahr">Vorgang löschen</button>
    </form>
<?php } ?>
