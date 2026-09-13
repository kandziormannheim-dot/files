<?php $seitentitel = 'Admin'; ?>
<h1>Verwaltung</h1>
<nav class="filter" aria-label="Admin">
    <a href="/admin" class="aktiv">Übersicht</a>
    <a href="/admin/benutzer">Konten</a>
    <a href="/admin/einladungen">Einladungen</a>
    <a href="/admin/inhalte">Inhalte</a>
</nav>
<div class="kartenraster">
    <section class="karte"><h2>Konten</h2><p class="grosszahl"><?= (int) $kennzahlen['benutzer'] ?></p><p><small><?= (int) $kennzahlen['aktiv7'] ?> in den letzten 7 Tagen angemeldet</small></p></section>
    <section class="karte"><h2>Prüfungen</h2><p class="grosszahl"><?= (int) $kennzahlen['pruefungen'] ?></p><p><small><?= (int) $kennzahlen['bestanden'] ?> bestanden</small></p></section>
    <section class="karte"><h2>Trainer-Antworten</h2><p class="grosszahl"><?= (int) $kennzahlen['antworten'] ?></p></section>
    <section class="karte"><h2>Offene Einladungscodes</h2><p class="grosszahl"><?= (int) $kennzahlen['offeneCodes'] ?></p></section>
</div>
<section class="karte">
    <h2>Inhalte</h2>
    <ul>
    <?php foreach ($status as $kennung => $s) { ?>
        <li><strong><?= e($s['zertifikat']['titel']) ?></strong>: <?= (int) $s['lektionen'] ?> Lektionen, <?= (int) $s['fragen'] ?> Fragen<?= $s['beispiele'] > 0 ? ' (davon ' . (int) $s['beispiele'] . ' Beispiel)' : '' ?>,
            <?= count($s['befund']['fehler']) ?> Fehler, <?= count($s['befund']['warnungen']) ?> Warnungen<?= empty($s['zertifikat']['freigeschaltet']) ? ' — <em>nicht freigeschaltet</em>' : '' ?></li>
    <?php } ?>
    </ul>
    <p><a href="/admin/inhalte">Details</a></p>
</section>
