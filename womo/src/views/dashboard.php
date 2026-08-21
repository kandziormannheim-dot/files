<h1>Schadensakte</h1>

<?php if ($loeschFaellig !== []) { ?>
<section class="karte warnung">
    <h2>Löschfrist erreicht</h2>
    <p>Bei diesen Vermietungen liegt das Mietende mehr als
        <?= (int) $konfig['aufbewahrungJahre'] ?> Jahre zurück — die Mieterdaten
        sollten entfernt werden (die Schäden bleiben anonymisiert erhalten):</p>
    <ul>
        <?php foreach ($loeschFaellig as $vermietung) { ?>
        <li>
            <a href="/vermietung/<?= (int) $vermietung['id'] ?>"><?= e($vermietung['name']) ?></a>
            (<?= e(datumAnzeigen($vermietung['von'])) ?> – <?= e(datumAnzeigen($vermietung['bis'])) ?>)
            <form method="post" action="/vermietung/<?= (int) $vermietung['id'] ?>/anonymisieren"
                  class="inline" data-bestaetigen="Mieterdaten dieser Vermietung unwiderruflich entfernen?">
                <?= csrfFeld() ?>
                <button type="submit" class="leise">Jetzt anonymisieren</button>
            </form>
        </li>
        <?php } ?>
    </ul>
</section>
<?php } ?>

<?php if ($unzugeordnet !== []) { ?>
<section class="karte warnung">
    <h2>Unzugeordnete QR-Meldungen</h2>
    <p>Über den QR-Code gemeldet, noch keiner Vermietung zugeordnet — bitte prüfen:</p>
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

<nav class="filter">
    <a href="/" class="<?= $filterStatus === '' ? 'aktiv' : '' ?>">Alle</a>
    <?php foreach (['offen', 'gemeldet', 'repariert'] as $status) { ?>
    <a href="/?status=<?= e($status) ?>" class="<?= $filterStatus === $status ? 'aktiv' : '' ?>">
        <?= e(ucfirst(statusName($status))) ?>
    </a>
    <?php } ?>
</nav>

<?php if ($schaeden === []) { ?>
<p>Noch keine Schäden erfasst. <a href="/schaden/neu">Den ersten anlegen.</a></p>
<?php } else { ?>
<table class="liste">
    <thead>
        <tr><th>Datum</th><th>Stelle</th><th>Beschreibung</th><th>Status</th><th>Kosten</th><th>Zuordnung</th><th></th></tr>
    </thead>
    <tbody>
        <?php foreach ($schaeden as $schaden) { ?>
        <tr>
            <td><?= e(datumAnzeigen($schaden['erstellt_am'])) ?></td>
            <td><?= e(zonenName($schaden['zone'])) ?></td>
            <td>
                <a href="/schaden/<?= (int) $schaden['id'] ?>"><?= e(mb_substr($schaden['beschreibung'], 0, 70)) ?></a>
                <?php if ((int) $schaden['foto_anzahl'] > 0) { ?>
                <small>📷 <?= (int) $schaden['foto_anzahl'] ?></small>
                <?php } ?>
            </td>
            <td><span class="status status-<?= e($schaden['status']) ?>"><?= e(statusName($schaden['status'])) ?></span></td>
            <td><?= e(euro($schaden['kosten_cent'] === null ? null : (int) $schaden['kosten_cent'])) ?></td>
            <td><?= e($schaden['mieter_name'] ?? ($schaden['quelle'] === 'qr' ? 'QR-Meldung' : 'Eigene Akte')) ?></td>
            <td><a href="/schaden/<?= (int) $schaden['id'] ?>">Öffnen</a></td>
        </tr>
        <?php } ?>
    </tbody>
</table>
<?php } ?>
