<?php $seitentitel = 'Lerntrainer ' . $z['titel']; ?>
<p class="brotkrumen"><a href="/">Kurse</a> › <a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › Lerntrainer</p>
<h1>Lerntrainer</h1>
<?php if ($katalog['beispielhaft']) { ?><p class="band">Beispielfragen — noch nicht der amtliche Katalog</p><?php } ?>
<?php if ($katalog['fragen'] === []) { ?>
<p class="karte">Für diesen Kurs sind noch keine Fragen hinterlegt.</p>
<?php } else { ?>
<form method="get" action="/trainer/<?= e($kennung) ?>/frage" class="karte trainer-wahl">
    <fieldset>
        <legend>Was üben?</legend>
        <label class="wahl"><input type="radio" name="modul" value=""<?= $modul === '' ? ' checked' : '' ?>> <span>Alle Module <small>(<?= count($katalog['fragen']) ?> Fragen)</small></span></label>
        <?php foreach ($statistik['module'] as $id => $m) { ?>
        <label class="wahl"><input type="radio" name="modul" value="<?= e($id) ?>"<?= $modul === $id ? ' checked' : '' ?>> <span><?= e($m['titel']) ?> <small>(<?= (int) $m['sicher'] ?>/<?= (int) $m['gesamt'] ?> sicher)</small></span></label>
        <?php } ?>
    </fieldset>
    <fieldset>
        <legend>Wie üben?</legend>
        <?php $erklaerung = ['neu' => 'Ungeübte Fragen zuerst, dann die wackeligen.', 'wackelig' => 'Nur Fragen, die zuletzt falsch oder erst einmal richtig waren.', 'zufall' => 'Alles bunt gemischt.', 'reihe' => 'In der Nummernfolge des Katalogs.']; ?>
        <?php foreach (TRAINER_MODI as $id => $name) { ?>
        <label class="wahl"><input type="radio" name="modus" value="<?= e($id) ?>"<?= $modus === $id ? ' checked' : '' ?>> <span><?= e($name) ?> <small><?= e($erklaerung[$id]) ?></small></span></label>
        <?php } ?>
    </fieldset>
    <p class="knopfreihe"><button type="submit">Los geht's</button> <a class="knopf zweit" href="/trainer/<?= e($kennung) ?>/statistik">Statistik</a></p>
    <p><small>Tipp: Im Trainer wählst du Antworten mit den Tasten 1 bis 4 und gehst mit Enter weiter.</small></p>
</form>
<?php } ?>
