<?php
/**
 * Diktat: eine Not-, Dringlichkeits- oder Sicherheitsmeldung wird vom Browser
 * vorgelesen (Web Speech API), der Lerner schreibt mit. Ohne Sprachausgabe
 * bleibt die Textfassung — sie ist ohnehin die „Tonspur als Text“.
 */
$seitentitel = $uebung['titel'];
$sprache = $uebung['sprache'] === 'de' ? 'Deutsch' : 'Englisch';
?>
<p class="brotkrumen"><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <a href="/uebung/<?= e($kennung) ?>/diktat">Diktat</a> › <?= e($uebung['titel']) ?></p>
<h1><?= e($uebung['titel']) ?> <small>Diktat · <?= e($sprache) ?></small></h1>

<section class="karte diktat" data-diktat data-sprache="<?= e($uebung['sprache']) ?>" data-text="<?= e($uebung['sprechtext'] ?? $uebung['text']) ?>">
    <p class="kasten-titel">Tonspur</p>
    <?php if (!empty($uebung['hinweis'])) { ?><p><?= e($uebung['hinweis']) ?></p><?php } ?>
    <p class="knopfreihe diktat-steuerung">
        <button type="button" data-diktat-start>▶ Abspielen</button>
        <button type="button" class="zweit" data-diktat-pause>⏸ Pause</button>
        <button type="button" class="zweit" data-diktat-stop>■ Stopp</button>
        <label class="inline">Tempo
            <select data-diktat-tempo>
                <option value="0.7">langsam</option>
                <option value="0.85" selected>Prüfungstempo</option>
                <option value="1">normal</option>
            </select>
        </label>
        <span class="diktat-stand" data-diktat-stand aria-live="polite"></span>
    </p>
    <p class="hinweistext" data-diktat-fehlt hidden>Dein Browser bietet keine Sprachausgabe. Lass dir den Text von jemandem vorlesen oder nutze die Textfassung unten.</p>
    <details class="diktat-text">
        <summary>Textfassung einblenden (Tonspur als Text)</summary>
        <p class="quelltext"><?= nl2br(e($uebung['text'])) ?></p>
    </details>
</section>

<?php if ($ergebnis === null) { ?>
<form method="post" action="/uebung/<?= e($kennung) ?>/diktat/<?= e($uebung['id']) ?>" class="karte">
    <?= csrfFeld() ?>
    <label>Mitschrift
        <textarea name="eingabe" rows="6" required autofocus placeholder="Schreib mit, was du hörst …"><?= e($eingabe) ?></textarea>
    </label>
    <p class="kurz">Groß-/Kleinschreibung und Satzzeichen sind egal. Ein Tippfehler in langen Wörtern kostet einen halben Punkt; jedes fehlende Wort einen ganzen.</p>
    <p class="knopfreihe"><button type="submit">Mitschrift prüfen</button> <a class="knopf zweit" href="/uebung/<?= e($kennung) ?>/diktat">Abbrechen</a></p>
</form>
<?php } else { ?>
<section class="karte">
    <h2>Ergebnis: <?= (int) $ergebnis['prozent'] ?> %</h2>
    <p><?= (int) $ergebnis['richtig'] ?> von <?= count($ergebnis['woerter']) ?> Wörtern getroffen<?php if ($ergebnis['zusaetzlich'] > 0) { ?>, <?= (int) $ergebnis['zusaetzlich'] ?> überzählige<?php } ?>. Fehlende oder falsch geschriebene Wörter sind markiert:</p>
    <ul class="schluesselwoerter diktat-woerter">
    <?php foreach ($ergebnis['woerter'] as $w) { ?>
        <li class="<?= $w['wert'] >= 1 ? 'richtig' : ($w['wert'] > 0 ? 'halb' : 'falsch') ?>"><?= e($w['wort']) ?></li>
    <?php } ?>
    </ul>
    <h2>Deine Mitschrift</h2>
    <p class="quelltext"><?= nl2br(e($eingabe)) ?></p>
    <p class="knopfreihe">
        <a class="knopf" href="/uebung/<?= e($kennung) ?>/diktat/<?= e($uebung['id']) ?>">Noch einmal</a>
        <a class="knopf zweit" href="/uebung/<?= e($kennung) ?>/diktat">Zur Übersicht</a>
    </p>
</section>
<?php } ?>
