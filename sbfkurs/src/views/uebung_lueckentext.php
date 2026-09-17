<?php
$seitentitel = $uebung['titel'];
preg_match_all('/\{\{(\d+)\}\}/', (string) $uebung['text'], $alle);
$zaehler = [];
?>
<p class="brotkrumen"><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <a href="/uebung/<?= e($kennung) ?>/funkverkehr">Funkverkehr-Trainer</a> › <?= e($uebung['titel']) ?></p>
<h1><?= e($uebung['titel']) ?></h1>
<?php if (!empty($uebung['einleitung'])) { ?><p class="einleitung"><?= e($uebung['einleitung']) ?></p><?php } ?>

<?php if ($ergebnis !== null) { ?>
<section class="karte ergebnis <?= $ergebnis['punkte'] >= $ergebnis['maximal'] * 0.8 ? 'ist-richtig' : 'ist-falsch' ?>">
    <p class="ergebnis-zahl"><strong><?= $ergebnis['punkte'] / 2 ?></strong> von <?= $ergebnis['maximal'] / 2 ?> Lücken richtig</p>
    <div class="funkspruch-luecken">
    <?php
    $ausgabe = e((string) $uebung['text']);
    foreach ($ergebnis['nummern'] as $n) {
        $d = $ergebnis['details'][$n];
        $klasse = $d['wert'] >= 1 ? 'richtig' : ($d['wert'] > 0 ? 'fast' : 'falsch');
        $ersatz = '<mark class="luecke ' . $klasse . '" title="' . e($d['loesung']) . '">' . ($d['eingabe'] !== '' ? e($d['eingabe']) : '—') . '</mark>'
            . ($d['wert'] < 1 ? ' <small class="loesung">(' . e($d['loesung']) . ')</small>' : '');
        $ausgabe = str_replace('{{' . $n . '}}', $ersatz, $ausgabe);
    }
    echo nl2br($ausgabe);
    ?>
    </div>
    <p class="knopfreihe"><a class="knopf" href="/uebung/<?= e($kennung) ?>/funkverkehr/<?= e($uebung['id']) ?>">Noch einmal</a> <a class="knopf zweit" href="/uebung/<?= e($kennung) ?>/funkverkehr">Alle Übungen</a></p>
</section>
<?php } else { ?>
<form method="post" action="/uebung/<?= e($kennung) ?>/funkverkehr/<?= e($uebung['id']) ?>" class="karte">
    <?= csrfFeld() ?>
    <div class="funkspruch-luecken">
    <?php
    $ausgabe = e((string) $uebung['text']);
    foreach (array_unique($alle[1]) as $n) {
        $hinweis = $uebung['luecken'][$n]['hinweis'] ?? '';
        $feld = '<input type="text" name="luecke[' . (int) $n . ']" class="luecke-feld" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Lücke ' . (int) $n . ($hinweis !== '' ? ': ' . e($hinweis) : '') . '"' . ($hinweis !== '' ? ' placeholder="' . e($hinweis) . '"' : '') . '>';
        // Dieselbe Nummer mehrfach: nur das erste Feld ist ein Eingabefeld, die
        // weiteren zeigen die Eingabe gespiegelt (app.js).
        $erstes = true;
        $ausgabe = preg_replace_callback('/\{\{' . (int) $n . '\}\}/', static function () use (&$erstes, $feld, $n): string {
            if ($erstes) {
                $erstes = false;

                return $feld;
            }

            return '<span class="luecke-spiegel" data-spiegel="' . (int) $n . '">…</span>';
        }, $ausgabe) ?? $ausgabe;
    }
    echo nl2br($ausgabe);
    ?>
    </div>
    <p class="knopfreihe"><button type="submit">Prüfen</button> <a class="knopf zweit" href="/uebung/<?= e($kennung) ?>/funkverkehr">Abbrechen</a></p>
</form>
<?php } ?>
