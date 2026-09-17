<?php
$seitentitel = 'Ergebnis ' . $z['titel'];
$breit = true;
$falsche = array_filter($ergebnis['antworten'], static fn (array $a): bool => !$a['richtig']);
?>
<p class="brotkrumen"><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <a href="/pruefung/<?= e($kennung) ?>">Prüfungssimulation</a> › Ergebnis</p>
<section class="karte ergebnis <?= $ergebnis['bestanden'] ? 'ist-richtig' : 'ist-falsch' ?>">
    <h1><?= $ergebnis['bestanden'] ? 'Bestanden' : 'Nicht bestanden' ?></h1>
    <p class="ergebnis-zahl"><strong><?= (int) $ergebnis['richtig'] ?></strong> von <?= (int) $ergebnis['gesamt'] ?> richtig <small>(nötig: <?= (int) $ergebnis['mindest'] ?>)</small></p>
    <p>Abgegeben <?= e(zeitAnzeigen($pruefung['abgegeben_am'])) ?> nach <?= e(dauerAnzeigen($ergebnis['dauer'])) ?>.
    <?php if ($ergebnis['ueberzogen']) { ?><strong>In der echten Prüfung wäre die Zeit überschritten gewesen.</strong><?php } ?></p>
    <p class="knopfreihe">
        <a class="knopf" href="/pruefung/<?= e($kennung) ?>">Noch einmal</a>
        <?php if ($falsche !== []) { ?><a class="knopf zweit" href="/trainer/<?= e($kennung) ?>/frage?modus=wackelig">Falsche im Trainer üben</a><?php } ?>
        <a class="knopf zweit" href="/kurs/<?= e($kennung) ?>">Zum Kurs</a>
    </p>
</section>

<h2>Alle Fragen im Überblick</h2>
<ol class="bogen-fragen auswertung">
<?php foreach ($pruefung['fragen'] as $i => $eintrag) {
    $position = $i + 1;
    $frage = $katalog['fragen'][$eintrag['frage_id']] ?? null;
    $a = $ergebnis['antworten'][$position] ?? ['gegeben' => null, 'richtig' => false];
    if ($frage === null) {
        continue;
    }
    $antworten = [];
    foreach ($eintrag['reihenfolge'] as $idx) {
        $antworten[] = $frage['antworten'][$idx] ?? '';
    }
    $richtigePosition = array_search((int) $frage['richtig'], $eintrag['reihenfolge'], true);
    $gewaehltePosition = $a['gegeben'] === null ? -1 : array_search((int) $a['gegeben'], $eintrag['reihenfolge'], true);
    $feldname = "ansicht[$position]";
    $gewaehlt = $gewaehltePosition === false ? null : $gewaehltePosition;
    $aufloesung = ['richtigePosition' => $richtigePosition === false ? 0 : (int) $richtigePosition, 'gewaehlt' => $gewaehltePosition === false ? -1 : (int) $gewaehltePosition];
?>
    <li class="bogen-frage <?= $a['richtig'] ? 'ist-richtig' : 'ist-falsch' ?>">
        <p class="fragekopf">Frage <?= $position ?> <?= $a['richtig'] ? '✓' : ($a['gegeben'] === null ? '— nicht beantwortet' : '✗') ?></p>
        <?php require __DIR__ . '/_frage.php'; ?>
        <?php if (!$a['richtig'] && $frage['hinweis'] !== '') { ?><p class="hinweistext"><?= e($frage['hinweis']) ?></p><?php } ?>
        <?php if (!$a['richtig'] && !empty($frage['lektion'])) { ?><p><a href="/lektion/<?= e($kennung) ?>/<?= e($frage['lektion']) ?>">Zur Lektion</a></p><?php } ?>
    </li>
<?php } ?>
</ol>
