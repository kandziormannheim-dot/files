<?php
$seitentitel = $z['titel'];
$praxisNamen = ['funkverkehr' => 'Funkverkehr-Trainer', 'buchstabieren' => 'Buchstabiertafel', 'englisch' => 'Englisch', 'dsc' => 'DSC-Simulator'];
$praxisLinks = ['funkverkehr' => "/uebung/$kennung/funkverkehr", 'buchstabieren' => '/uebung/buchstabieren', 'englisch' => "/uebung/$kennung/englisch", 'dsc' => "/uebung/dsc?kurs=$kennung"];
?>
<p class="brotkrumen"><a href="/">Kurse</a> › <?= e($z['titel']) ?></p>
<h1><?= e($z['titel']) ?></h1>
<?php if (empty($z['freigeschaltet'])) { ?><p class="band">Nur für Admins sichtbar — noch nicht freigeschaltet</p><?php } ?>
<?php if ($stand['beispielhaft']) { ?><p class="band">Beispielfragen — noch nicht der amtliche Katalog</p><?php } ?>
<p class="kurz"><?= e($z['kurz']) ?></p>
<?php require __DIR__ . '/_lernstand.php'; ?>

<div class="zweispaltig kurs-raster">
<section class="karte">
    <h2>Lektionen <small><?= $stand['lektionen']['gelesen'] ?> von <?= $stand['lektionen']['gesamt'] ?> gelesen</small></h2>
    <ol class="lektionsliste">
    <?php foreach ($lektionen as $slug => $l) { $gelesen = in_array($slug, $stand['lektionen']['slugs'], true); ?>
        <li class="<?= $gelesen ? 'gelesen' : '' ?>">
            <a href="/lektion/<?= e($kennung) ?>/<?= e($slug) ?>"><?= e($l['titel']) ?></a>
            <small><?= $gelesen ? '✓ gelesen' : ((int) $l['dauerMin'] > 0 ? (int) $l['dauerMin'] . ' Min.' : '') ?></small>
            <?php if ($l['kurz'] !== '') { ?><span class="kurz"><?= e($l['kurz']) ?></span><?php } ?>
        </li>
    <?php } ?>
    </ol>
</section>

<div>
<section class="karte">
    <h2>Lerntrainer</h2>
    <p><strong><?= $stand['fragen']['sicher'] ?></strong> von <?= $stand['fragen']['gesamt'] ?> Fragen sicher, <?= $stand['fragen']['geuebt'] ?> geübt.</p>
    <p class="knopfreihe"><a class="knopf" href="/trainer/<?= e($kennung) ?>">Üben</a> <a class="knopf zweit" href="/trainer/<?= e($kennung) ?>/statistik">Statistik</a></p>
</section>

<section class="karte">
    <h2>Prüfungssimulation</h2>
    <p><?= (int) $z['pruefung']['fragenProBogen'] ?> Fragen in <?= (int) $z['pruefung']['zeitMinuten'] ?> Minuten, bestanden ab <?= (int) $z['pruefung']['mindestRichtig'] ?> richtigen.</p>
    <?php if ($stand['pruefungen']['letzte'] !== []) { ?>
    <ul class="verlauf-kurz">
        <?php foreach ($stand['pruefungen']['letzte'] as $p) { ?>
        <li><a href="/pruefung/<?= (int) $p['id'] ?>/ergebnis"><?= e(zeitAnzeigen($p['abgegeben_am'])) ?></a>: <?= (int) $p['richtig'] ?>/<?= (int) $p['gesamt'] ?> <span class="status status-<?= (int) $p['bestanden'] === 1 ? 'gut' : 'schlecht' ?>"><?= (int) $p['bestanden'] === 1 ? 'bestanden' : 'nicht bestanden' ?></span></li>
        <?php } ?>
    </ul>
    <?php } ?>
    <p class="knopfreihe">
        <?php if ($stand['offenePruefung'] !== null) { ?>
        <a class="knopf" href="/pruefung/<?= (int) $stand['offenePruefung'] ?>">Laufende Prüfung fortsetzen</a>
        <?php } else { ?>
        <a class="knopf" href="/pruefung/<?= e($kennung) ?>">Zur Prüfung</a>
        <?php } ?>
    </p>
</section>

<?php if ($z['praxis'] !== []) { ?>
<section class="karte">
    <h2>Praxis</h2>
    <ul class="praxisliste">
    <?php foreach ($z['praxis'] as $modul) { $p = $stand['praxis'][$modul] ?? ['erledigt' => 0, 'gesamt' => 0]; ?>
        <li><a href="<?= e($praxisLinks[$modul] ?? '#') ?>"><?= e($praxisNamen[$modul] ?? $modul) ?></a> <small><?= (int) $p['erledigt'] ?>/<?= (int) $p['gesamt'] ?> erledigt</small></li>
    <?php } ?>
    </ul>
</section>
<?php } ?>
</div>
</div>
