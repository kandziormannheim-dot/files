<?php
$seitentitel = 'Lerntrainer ' . $z['titel'];
$weiter = "/trainer/$kennung/frage?modul=" . rawurlencode($modul) . '&modus=' . rawurlencode($modus) . ($modus === 'reihe' ? '&ab=' . (int) $ab : '');
$modulTitel = '';
foreach ($katalog['module'] as $m) {
    if ($m['id'] === $modul) {
        $modulTitel = $m['titel'] ?? $m['id'];
    }
}
?>
<p class="brotkrumen"><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <a href="/trainer/<?= e($kennung) ?>">Lerntrainer</a> › <?= e($modulTitel !== '' ? $modulTitel : 'Alle Module') ?> · <?= e(TRAINER_MODI[$modus]) ?></p>

<?php if ($aufloesung !== null) { $frage = $aufloesung['frage']; ?>
<section class="karte trainerkarte <?= $aufloesung['richtig'] ? 'ist-richtig' : 'ist-falsch' ?>">
    <p class="fragekopf">Frage <?= (int) ($frage['nr'] ?? 0) ?> <small><?= e($frage['id']) ?></small></p>
    <?php
    $antworten = [];
    foreach ($aufloesung['permutation'] as $i) {
        $antworten[] = $frage['antworten'][$i];
    }
    $feldname = 'antwort';
    $gewaehlt = $aufloesung['gewaehlt'];
    require __DIR__ . '/_frage.php';
    ?>
    <p class="verdikt"><?= $aufloesung['richtig'] ? '✓ Richtig.' : '✗ Leider falsch.' ?></p>
    <?php if ($frage['hinweis'] !== '') { ?><p class="hinweistext"><?= e($frage['hinweis']) ?></p><?php } ?>
    <p class="knopfreihe">
        <a class="knopf" href="<?= e($weiter) ?>" data-enter>Weiter</a>
        <?php if (!empty($frage['lektion'])) { ?><a class="knopf zweit" href="/lektion/<?= e($kennung) ?>/<?= e($frage['lektion']) ?>">Zur Lektion</a><?php } ?>
        <a class="knopf zweit" href="/trainer/<?= e($kennung) ?>">Anders üben</a>
    </p>
</section>

<?php } elseif ($frage === null) { ?>
<section class="karte">
    <?php if ($modus === 'wackelig') { ?>
    <h1>Keine Wackelkandidaten</h1>
    <p>Alles, was du geübt hast, sitzt. Übe neue Fragen oder wiederhole zufällig.</p>
    <?php } elseif ($modus === 'reihe') { ?>
    <h1>Ende der Reihe</h1>
    <p>Du bist am Ende des Katalogs angekommen.</p>
    <?php } else { ?>
    <h1>Keine Fragen</h1>
    <p>Für diese Auswahl gibt es keine Fragen.</p>
    <?php } ?>
    <p class="knopfreihe"><a class="knopf" href="/trainer/<?= e($kennung) ?>">Zur Auswahl</a> <a class="knopf zweit" href="/trainer/<?= e($kennung) ?>/frage?modul=<?= e($modul) ?>&amp;modus=neu">Neue Fragen</a></p>
</section>

<?php } else { ?>
<form method="post" action="/trainer/<?= e($kennung) ?>/frage" class="karte trainerkarte" data-trainer>
    <?= csrfFeld() ?>
    <input type="hidden" name="frage" value="<?= e($frage['id']) ?>">
    <input type="hidden" name="modul" value="<?= e($modul) ?>">
    <input type="hidden" name="modus" value="<?= e($modus) ?>">
    <p class="fragekopf">Frage <?= (int) ($frage['nr'] ?? 0) ?> <small><?= e($frage['id']) ?></small></p>
    <?php $feldname = 'antwort'; require __DIR__ . '/_frage.php'; ?>
    <p class="knopfreihe"><button type="submit">Antworten</button> <a class="knopf zweit" href="/trainer/<?= e($kennung) ?>">Abbrechen</a></p>
</form>
<?php } ?>
