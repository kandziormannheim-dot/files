<?php $seitentitel = 'Statistik ' . $z['titel']; ?>
<p class="brotkrumen"><a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <a href="/trainer/<?= e($kennung) ?>">Lerntrainer</a> › Statistik</p>
<h1>Dein Stand im Lerntrainer</h1>
<div class="tabelle-rahmen">
<table class="liste">
    <thead><tr><th>Modul</th><th>Fragen</th><th>Geübt</th><th>Sicher</th><th>Wackelig</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($statistik['module'] as $id => $m) { ?>
        <tr>
            <td><?= e($m['titel']) ?></td>
            <td><?= (int) $m['gesamt'] ?></td>
            <td><?= (int) $m['geuebt'] ?></td>
            <td><?= (int) $m['sicher'] ?></td>
            <td><?= (int) $m['wackelig'] ?></td>
            <td><a href="/trainer/<?= e($kennung) ?>/frage?modul=<?= e($id) ?>&amp;modus=neu">Üben</a></td>
        </tr>
    <?php } ?>
    </tbody>
</table>
</div>
<?php if ($statistik['wackelkandidaten'] !== []) { ?>
<section class="karte">
    <h2>Wackelkandidaten</h2>
    <ol class="wackelliste">
    <?php foreach (array_slice($statistik['wackelkandidaten'], 0, 30) as $f) { ?>
        <li><?= e($f['text']) ?> <small><?= (int) $f['stand']['falsch_anzahl'] ?>× falsch, <?= (int) $f['stand']['richtig_anzahl'] ?>× richtig</small></li>
    <?php } ?>
    </ol>
    <p class="knopfreihe"><a class="knopf" href="/trainer/<?= e($kennung) ?>/frage?modus=wackelig">Wackelkandidaten üben</a></p>
</section>
<?php } ?>
