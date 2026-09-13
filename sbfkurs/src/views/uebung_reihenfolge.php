<?php $seitentitel = $uebung['titel']; ?>
<p class="brotkrumen"><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <a href="/uebung/<?= e($kennung) ?>/funkverkehr">Funkverkehr-Trainer</a> › <?= e($uebung['titel']) ?></p>
<h1><?= e($uebung['titel']) ?></h1>
<?php if (!empty($uebung['einleitung'])) { ?><p class="einleitung"><?= e($uebung['einleitung']) ?></p><?php } ?>

<?php if ($ergebnis !== null) { ?>
<section class="karte ergebnis <?= $ergebnis['punkte'] >= $ergebnis['maximal'] * 0.8 ? 'ist-richtig' : 'ist-falsch' ?>">
    <p class="ergebnis-zahl"><strong><?= (int) $ergebnis['punkte'] ?></strong> von <?= (int) $ergebnis['maximal'] ?> Positionen richtig</p>
    <ol class="reihenfolge auswertung">
    <?php foreach ($ergebnis['details'] as $i => $d) { ?>
        <li class="<?= $d['richtig'] ? 'richtig' : 'falsch' ?>">
            <?= e($uebung['elemente'][$d['gegeben']] ?? '—') ?>
            <?php if (!$d['richtig']) { ?><small class="loesung">richtig: <?= e($uebung['elemente'][$d['soll']] ?? '') ?></small><?php } ?>
        </li>
    <?php } ?>
    </ol>
    <p class="knopfreihe"><a class="knopf" href="/uebung/<?= e($kennung) ?>/funkverkehr/<?= e($uebung['id']) ?>">Noch einmal</a> <a class="knopf zweit" href="/uebung/<?= e($kennung) ?>/funkverkehr">Alle Übungen</a></p>
</section>
<?php } else { ?>
<form method="post" action="/uebung/<?= e($kennung) ?>/funkverkehr/<?= e($uebung['id']) ?>" class="karte" data-reihenfolge>
    <?= csrfFeld() ?>
    <p><small>Bringe die Zeilen mit ▲ und ▼ in die richtige Reihenfolge.</small></p>
    <ol class="reihenfolge">
    <?php foreach ($indizes as $i) { ?>
        <li>
            <input type="hidden" name="reihenfolge[]" value="<?= (int) $i ?>">
            <span class="element"><?= e($uebung['elemente'][$i]) ?></span>
            <span class="pfeile">
                <button type="button" class="pfeil" data-hoch aria-label="nach oben">▲</button>
                <button type="button" class="pfeil" data-runter aria-label="nach unten">▼</button>
            </span>
        </li>
    <?php } ?>
    </ol>
    <p class="knopfreihe"><button type="submit">Prüfen</button> <a class="knopf zweit" href="/uebung/<?= e($kennung) ?>/funkverkehr">Abbrechen</a></p>
</form>
<?php } ?>
