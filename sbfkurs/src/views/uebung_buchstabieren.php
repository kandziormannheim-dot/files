<?php $seitentitel = 'Buchstabiertafel'; ?>
<p class="brotkrumen"><a href="/">Kurse</a> › Buchstabiertafel</p>
<h1>Buchstabiertafel</h1>
<p class="kurz">Das internationale Alphabet gilt für alle Funkzeugnisse — Namen, Rufzeichen und MMSI werden damit buchstabiert. <?= (int) $stand['erledigt'] ?> von 10 Runden mit mindestens 80 % geschafft.</p>

<div class="zweispaltig">
<div>
<?php if ($ergebnis !== null) { ?>
<section class="karte ergebnis <?= $ergebnis['punkte'] >= $ergebnis['maximal'] * 0.8 ? 'ist-richtig' : 'ist-falsch' ?>">
    <p class="ergebnis-zahl"><strong><?= (int) $ergebnis['punkte'] ?></strong> von <?= (int) $ergebnis['maximal'] ?> richtig</p>
    <?php if ($ergebnis['aufgabe']['richtung'] === 'lesen') { $d = $ergebnis['details'][0]; ?>
    <p>Gesucht war <strong><?= e($d['soll']) ?></strong><?= $d['richtig'] ? '.' : ', du hast „' . e($d['ist']) . '“ geschrieben.' ?></p>
    <?php } else { ?>
    <ol class="buchstabier-auswertung">
    <?php foreach ($ergebnis['details'] as $d) { ?>
        <li class="<?= $d['richtig'] ? 'richtig' : 'falsch' ?>"><span class="zeichen"><?= e($d['zeichen']) ?></span> <?= e($d['soll']) ?><?= !$d['richtig'] ? ' <small class="loesung">(du: ' . e($d['ist'] !== '' ? $d['ist'] : '—') . ')</small>' : '' ?></li>
    <?php } ?>
    </ol>
    <?php } ?>
</section>
<?php } ?>

<form method="post" action="/uebung/buchstabieren" class="karte">
    <?= csrfFeld() ?>
    <?php if ($aufgabe['richtung'] === 'buchstabieren') { ?>
    <p class="kasten-titel">Buchstabiere</p>
    <p class="buchstabier-wort"><?= e($aufgabe['wort']) ?></p>
    <label>Codewörter, durch Leerzeichen getrennt
        <input type="text" name="eingabe" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Alfa Bravo …" required autofocus>
    </label>
    <?php } else { ?>
    <p class="kasten-titel">Was wurde buchstabiert?</p>
    <p class="buchstabier-wort codewoerter"><?= e(implode(' · ', $aufgabe['codewoerter'])) ?></p>
    <label>Das Wort
        <input type="text" name="eingabe" autocomplete="off" autocapitalize="characters" spellcheck="false" required autofocus>
    </label>
    <?php } ?>
    <p class="knopfreihe"><button type="submit">Prüfen</button>
        <a class="knopf zweit" href="/uebung/buchstabieren?richtung=buchstabieren">Neu: Wort buchstabieren</a>
        <a class="knopf zweit" href="/uebung/buchstabieren?richtung=lesen">Neu: Codewörter lesen</a></p>
</form>
</div>

<section class="karte">
    <h2>Die Tafel</h2>
    <div class="tabelle-rahmen">
    <table class="liste tafel">
        <tbody>
        <?php $buchstaben = $tafel['buchstaben']; $ziffern = $tafel['ziffern']; $zeilen = max(count($buchstaben), count($ziffern)); $bk = array_keys($buchstaben); $zk = array_keys($ziffern); ?>
        <?php for ($i = 0; $i < ceil(count($bk) / 2); $i++) { ?>
            <tr>
                <th><?= e($bk[$i]) ?></th><td><?= e($buchstaben[$bk[$i]]) ?></td>
                <?php $j = $i + (int) ceil(count($bk) / 2); ?>
                <th><?= isset($bk[$j]) ? e($bk[$j]) : '' ?></th><td><?= isset($bk[$j]) ? e($buchstaben[$bk[$j]]) : '' ?></td>
            </tr>
        <?php } ?>
        <?php for ($i = 0; $i < ceil(count($zk) / 2); $i++) { ?>
            <tr>
                <th><?= e($zk[$i]) ?></th><td><?= e($ziffern[$zk[$i]]) ?></td>
                <?php $j = $i + (int) ceil(count($zk) / 2); ?>
                <th><?= isset($zk[$j]) ? e($zk[$j]) : '' ?></th><td><?= isset($zk[$j]) ? e($ziffern[$zk[$j]]) : '' ?></td>
            </tr>
        <?php } ?>
        </tbody>
    </table>
    </div>
</section>
</div>
