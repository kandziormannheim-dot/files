<?php $seitentitel = 'Kurse'; ?>
<h1>Hallo<?= $benutzer['name'] !== '' ? ' ' . e($benutzer['name']) : '' ?>, wo geht es weiter?</h1>
<?php if ($karten === []) { ?>
<p class="karte">Noch kein Kurs freigeschaltet.</p>
<?php } ?>
<div class="kartenraster">
<?php foreach ($karten as $kennung => $stand) { $z = $stand['zertifikat']; ?>
    <section class="karte kurskarte">
        <h2><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a></h2>
        <?php if (empty($z['freigeschaltet'])) { ?><p class="band">Nur für Admins sichtbar — noch nicht freigeschaltet</p><?php } ?>
        <?php if ($stand['beispielhaft']) { ?><p class="band">Beispielfragen — noch nicht der amtliche Katalog</p><?php } ?>
        <p class="kurz"><?= e($z['kurz']) ?></p>
        <?php require __DIR__ . '/_lernstand.php'; ?>
        <ul class="kennzahlen">
            <li><strong><?= $stand['lektionen']['gelesen'] ?>/<?= $stand['lektionen']['gesamt'] ?></strong> Lektionen</li>
            <li><strong><?= $stand['fragen']['sicher'] ?>/<?= $stand['fragen']['gesamt'] ?></strong> Fragen sicher</li>
            <li><strong><?= $stand['pruefungen']['bestanden'] ?>/<?= $stand['pruefungen']['versuche'] ?></strong> Prüfungen bestanden</li>
        </ul>
        <p class="knopfreihe">
            <?php if ($stand['offenePruefung'] !== null) { ?>
            <a class="knopf" href="/pruefung/<?= (int) $stand['offenePruefung'] ?>">Prüfung fortsetzen</a>
            <?php } elseif ($stand['naechsteLektion'] !== null) { ?>
            <a class="knopf" href="/lektion/<?= e($kennung) ?>/<?= e($stand['naechsteLektion']) ?>">Weiter lernen</a>
            <?php } ?>
            <a class="knopf zweit" href="/trainer/<?= e($kennung) ?>">Trainer</a>
            <a class="knopf zweit" href="/pruefung/<?= e($kennung) ?>">Prüfung</a>
        </p>
    </section>
<?php } ?>
</div>
