<?php $seitentitel = 'Inhalte'; ?>
<h1>Inhalte</h1>
<nav class="filter" aria-label="Admin">
    <a href="/admin">Übersicht</a>
    <a href="/admin/benutzer">Konten</a>
    <a href="/admin/einladungen">Einladungen</a>
    <a href="/admin/inhalte" class="aktiv">Inhalte</a>
</nav>
<p class="kurz">Dieselbe Prüfung wie <code>werkzeuge/katalog-pruefen.php</code>. Wie Inhalte gepflegt werden, steht in <code>docs/sbfkurs/INHALTE.md</code>.</p>
<?php foreach ($status as $kennung => $s) { $z = $s['zertifikat']; ?>
<section class="karte">
    <h2><?= e($z['titel']) ?> <small><?= e($kennung) ?><?= empty($z['freigeschaltet']) ? ' · nicht freigeschaltet' : '' ?></small></h2>
    <ul class="kennzahlen">
        <li><strong><?= (int) $s['lektionen'] ?></strong> Lektionen</li>
        <li><strong><?= (int) $s['fragen'] ?></strong> Fragen<?= $s['beispiele'] > 0 ? ', davon ' . (int) $s['beispiele'] . ' Beispiel' : '' ?></li>
        <li><strong><?= (int) $s['boegen'] ?></strong> amtliche Bögen</li>
        <li><strong><?= (int) $s['uebungen'] ?></strong> Übungen</li>
    </ul>
    <p><small>Quelle: <?= e($s['quelle']['name']) ?><?= $s['quelle']['stand'] !== '' ? ', Stand ' . e($s['quelle']['stand']) : '' ?> — <?= !empty($s['quelle']['amtlich']) ? 'amtlich' : 'nicht amtlich' ?>.</small></p>
    <?php if ($s['befund']['fehler'] !== []) { ?>
    <p class="fehler">Fehler</p>
    <ul><?php foreach ($s['befund']['fehler'] as $f) { ?><li><?= e($f) ?></li><?php } ?></ul>
    <?php } ?>
    <?php if ($s['befund']['warnungen'] !== []) { ?>
    <p><strong>Warnungen</strong></p>
    <ul><?php foreach ($s['befund']['warnungen'] as $w) { ?><li><?= e($w) ?></li><?php } ?></ul>
    <?php } ?>
    <?php if ($s['befund']['fehler'] === [] && $s['befund']['warnungen'] === []) { ?><p class="status status-gut">Keine Befunde</p><?php } ?>
</section>
<?php } ?>
