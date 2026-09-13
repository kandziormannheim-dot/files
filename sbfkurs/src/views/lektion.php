<?php
$seitentitel = $lektion['titel'];
$module = array_filter((array) $lektion['module']);
?>
<p class="brotkrumen"><a href="/">Kurse</a> › <a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › Lektion <?= (int) $lektion['position'] ?> von <?= (int) $lektion['anzahl'] ?></p>
<article class="lesetext lektion">
    <h1><?= e($lektion['titel']) ?></h1>
    <?php if ($lektion['kurz'] !== '') { ?><p class="einleitung"><?= e($lektion['kurz']) ?></p><?php } ?>
    <?php if (count($lektion['ueberschriften']) > 2) { ?>
    <nav class="inhaltsverzeichnis" aria-label="In dieser Lektion">
        <p class="kasten-titel">In dieser Lektion</p>
        <ol>
        <?php foreach ($lektion['ueberschriften'] as $u) { ?>
            <li><a href="#<?= e($u['anker']) ?>"><?= e($u['text']) ?></a></li>
        <?php } ?>
        </ol>
    </nav>
    <?php } ?>
    <?= $lektion['html'] ?>
</article>

<div class="lektion-fuss">
    <form method="post" action="/lektion/<?= e($kennung) ?>/<?= e($lektion['slug']) ?>/gelesen" class="inline">
        <?= csrfFeld() ?>
        <button type="submit"><?= $gelesen ? 'Weiter' : 'Gelesen — weiter' ?></button>
    </form>
    <?php if ($module !== []) { ?>
    <a class="knopf zweit" href="/trainer/<?= e($kennung) ?>/frage?modul=<?= e(reset($module)) ?>&amp;modus=neu">Fragen zu dieser Lektion üben</a>
    <?php } ?>
    <nav class="vor-zurueck" aria-label="Lektionen">
        <?php if ($lektion['vorher'] !== null) { ?><a href="/lektion/<?= e($kennung) ?>/<?= e($lektion['vorher']['slug']) ?>">‹ <?= e($lektion['vorher']['titel']) ?></a><?php } ?>
        <?php if ($lektion['nachher'] !== null) { ?><a href="/lektion/<?= e($kennung) ?>/<?= e($lektion['nachher']['slug']) ?>"><?= e($lektion['nachher']['titel']) ?> ›</a><?php } ?>
    </nav>
</div>
