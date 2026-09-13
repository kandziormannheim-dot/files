<?php
$seitentitel = $uebung['titel'];
$richtung = $uebung['richtung'] === 'de-en' ? 'Deutsch → Englisch' : 'Englisch → Deutsch';
?>
<p class="brotkrumen"><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <a href="/uebung/<?= e($kennung) ?>/englisch">Englisch</a> › <?= e($uebung['titel']) ?></p>
<h1><?= e($uebung['titel']) ?> <small><?= e($richtung) ?></small></h1>

<section class="karte">
    <p class="kasten-titel"><?= $uebung['richtung'] === 'de-en' ? 'Übersetze ins Englische' : 'Übersetze ins Deutsche' ?></p>
    <p class="quelltext"><?= e($uebung['quelle']) ?></p>
</section>

<?php if ($ergebnis === null) { ?>
<form method="post" action="/uebung/<?= e($kennung) ?>/englisch/<?= e($uebung['id']) ?>" class="karte">
    <?= csrfFeld() ?>
    <input type="hidden" name="schritt" value="uebersetzen">
    <label>Deine Übersetzung
        <textarea name="eingabe" rows="5" required autofocus><?= e($eingabe) ?></textarea>
    </label>
    <p class="knopfreihe"><button type="submit">Mit Musterlösung vergleichen</button> <a class="knopf zweit" href="/uebung/<?= e($kennung) ?>/englisch">Abbrechen</a></p>
</form>
<?php } else { ?>
<div class="zweispaltig">
    <section class="karte">
        <h2>Deine Übersetzung</h2>
        <p class="quelltext"><?= nl2br(e($eingabe)) ?></p>
    </section>
    <section class="karte">
        <h2>Musterlösung</h2>
        <p class="quelltext"><?= e($uebung['musterloesung']) ?></p>
    </section>
</div>
<form method="post" action="/uebung/<?= e($kennung) ?>/englisch/<?= e($uebung['id']) ?>" class="karte">
    <?= csrfFeld() ?>
    <input type="hidden" name="schritt" value="bewerten">
    <input type="hidden" name="eingabe" value="<?= e($eingabe) ?>">
    <h2>Schlüsselbegriffe</h2>
    <ul class="schluesselwoerter">
    <?php foreach ($ergebnis['treffer'] as $t) { ?>
        <li class="<?= $t['gefunden'] !== null ? 'richtig' : 'falsch' ?>"><?= $t['gefunden'] !== null ? '✓' : '✗' ?> <?= e($t['wort']) ?></li>
    <?php } ?>
    </ul>
    <p><?= (int) $ergebnis['anzahl'] ?> von <?= count($ergebnis['treffer']) ?> gefunden (mindestens <?= (int) $ergebnis['mindest'] ?> nötig) — Vorschlag: <strong><?= e($ergebnis['vorschlag']) ?></strong>. Entscheide selbst, ob der Sinn getroffen ist:</p>
    <p class="knopfreihe">
        <button type="submit" name="einschaetzung" value="richtig">Richtig</button>
        <button type="submit" name="einschaetzung" value="teilweise" class="zweit">Teilweise</button>
        <button type="submit" name="einschaetzung" value="falsch" class="zweit">Falsch</button>
    </p>
</form>
<?php } ?>
