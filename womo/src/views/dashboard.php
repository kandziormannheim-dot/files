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

<?php
// Filterlinks behalten die jeweils anderen Filter bei.
$filterLink = static function (array $aenderung) use ($filterStatus, $filterTyp, $filterBereich, $filterFahrzeug): string {
    $werte = array_filter(array_merge(
        ['status' => $filterStatus, 'typ' => $filterTyp, 'bereich' => $filterBereich,
         'fahrzeug' => $filterFahrzeug !== 0 ? (string) $filterFahrzeug : ''],
        $aenderung
    ), static fn (string $w): bool => $w !== '');

    return '/' . ($werte === [] ? '' : '?' . http_build_query($werte));
};
$skizzenName = '';
foreach ($fahrzeuge as $f) {
    if ((int) $f['id'] === $skizzeFahrzeug) {
        $skizzenName = (string) $f['name'];
    }
}
?>

<section class="karte">
    <h2>Schadenspunkte<?= $skizzenName !== '' ? ' — ' . e($skizzenName) : '' ?></h2>
    <?php require __DIR__ . '/_skizze.php'; ?>
</section>

<?php if (count($fahrzeuge) > 1) { ?>
<nav class="filter">
    <a href="<?= e($filterLink(['fahrzeug' => ''])) ?>" class="<?= $filterFahrzeug === 0 ? 'aktiv' : '' ?>">Alle Fahrzeuge</a>
    <?php foreach ($fahrzeuge as $f) { ?>
    <a href="<?= e($filterLink(['fahrzeug' => (string) (int) $f['id']])) ?>"
       class="<?= $filterFahrzeug === (int) $f['id'] ? 'aktiv' : '' ?>">
        <?= e($f['name']) ?>
    </a>
    <?php } ?>
</nav>
<?php } ?>
<nav class="filter">
    <a href="<?= e($filterLink(['status' => ''])) ?>" class="<?= $filterStatus === '' ? 'aktiv' : '' ?>">Alle</a>
    <?php foreach (['offen', 'gemeldet', 'repariert'] as $status) { ?>
    <a href="<?= e($filterLink(['status' => $status])) ?>" class="<?= $filterStatus === $status ? 'aktiv' : '' ?>">
        <?= e(ucfirst(statusName($status))) ?>
    </a>
    <?php } ?>
</nav>
<nav class="filter">
    <a href="<?= e($filterLink(['bereich' => ''])) ?>" class="<?= $filterBereich === '' ? 'aktiv' : '' ?>">Alle Bereiche</a>
    <?php foreach (zonenGruppen() as $gruppe => $namen) { ?>
    <a href="<?= e($filterLink(['bereich' => $gruppe])) ?>" class="<?= $filterBereich === $gruppe ? 'aktiv' : '' ?>">
        <?= e($namen['de']) ?>
    </a>
    <?php } ?>
    <a href="<?= e($filterLink(['typ' => ''])) ?>" class="<?= $filterTyp === '' ? 'aktiv' : '' ?>">Alle Arten</a>
    <?php foreach (['schaden' => 'Schäden', 'werkstattauftrag' => 'Werkstattaufträge'] as $typ => $mehrzahl) { ?>
    <a href="<?= e($filterLink(['typ' => $typ])) ?>" class="<?= $filterTyp === $typ ? 'aktiv' : '' ?>">
        <?= e($mehrzahl) ?>
    </a>
    <?php } ?>
</nav>

<?php if ($schaeden === []) { ?>
<p>Keine Vorgänge zu diesen Filtern. <a href="/schaden/neu">Neuen Vorgang anlegen.</a></p>
<?php } else { ?>
<table class="liste">
    <thead>
        <tr><th>Vorgang</th><th>Datum</th><th>Art</th><th>Stelle</th><th>Beschreibung</th><th>Status</th><th>Kosten</th><th>Zuordnung</th><th></th></tr>
    </thead>
    <tbody>
        <?php foreach ($schaeden as $schaden) { ?>
        <tr>
            <td><a href="/schaden/<?= (int) $schaden['id'] ?>"><?= e(vorgangsnummer((int) $schaden['id'], (string) $schaden['erstellt_am'])) ?></a></td>
            <td><?= e(datumAnzeigen($schaden['erstellt_am'])) ?></td>
            <td><?= e(typName((string) ($schaden['typ'] ?? 'schaden'))) ?></td>
            <td><?= e(zonenName($schaden['zone'])) ?></td>
            <td>
                <a href="/schaden/<?= (int) $schaden['id'] ?>"><?= e(mb_substr($schaden['beschreibung'], 0, 70)) ?></a>
                <?php if ((int) $schaden['foto_anzahl'] > 0) { ?>
                <small>📷 <?= (int) $schaden['foto_anzahl'] ?></small>
                <?php } ?>
                <?php if ((int) ($schaden['rechnung_anzahl'] ?? 0) > 0) { ?>
                <small>🧾 <?= (int) $schaden['rechnung_anzahl'] ?></small>
                <?php } ?>
                <?php if ((string) ($schaden['werkstatt_kommentar'] ?? '') !== '') { ?>
                <small class="werkstatt-kommentar">🔧 <?= e(mb_substr($schaden['werkstatt_kommentar'], 0, 90)) ?></small>
                <?php } ?>
            </td>
            <td><span class="status status-<?= e($schaden['status']) ?>"><?= e(statusName($schaden['status'])) ?></span></td>
            <td><?= e(euro($schaden['kosten_cent'] === null ? null : (int) $schaden['kosten_cent'])) ?></td>
            <td>
                <?= e($schaden['mieter_name'] ?? ($schaden['quelle'] === 'qr' ? 'QR-Meldung' : 'Eigene Akte')) ?>
                <?php if (count($fahrzeuge) > 1 && (string) ($schaden['fahrzeug_name'] ?? '') !== '') { ?>
                <small>🚐 <?= e($schaden['fahrzeug_name']) ?></small>
                <?php } ?>
            </td>
            <td><a href="/schaden/<?= (int) $schaden['id'] ?>">Öffnen</a></td>
        </tr>
        <?php } ?>
    </tbody>
    <tfoot>
        <tr>
            <td colspan="6" class="summe">Summe (<?= count($schaeden) ?> Vorgänge)</td>
            <td class="summe"><?= e(euro($kostenSumme)) ?></td>
            <td colspan="2"></td>
        </tr>
    </tfoot>
</table>
<?php } ?>
