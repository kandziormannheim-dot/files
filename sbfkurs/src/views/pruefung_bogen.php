<?php
$seitentitel = 'Prüfungsbogen ' . $z['titel'];
$breit = true;
$regeln = $pruefung['regeln'];
?>
<form method="post" action="/pruefung/<?= (int) $pruefung['id'] ?>/abgeben" class="bogen" data-pruefung="<?= (int) $pruefung['id'] ?>" data-ende="<?= (int) $ende ?>" data-bestaetigen="Prüfung jetzt abgeben? Unbeantwortete Fragen zählen als falsch.">
    <?= csrfFeld() ?>
    <header class="bogen-kopf">
        <div>
            <h1>Prüfungsbogen <?= e($z['titel']) ?></h1>
            <p><?= e($pruefung['bogen'] === 'zufall' ? 'Zufällig zusammengestellt' : 'Amtlicher Bogen ' . str_replace('amtlich-', 'Nr. ', $pruefung['bogen'])) ?> · <?= count($pruefung['fragen']) ?> Fragen · <?= (int) ($regeln['zeitMinuten'] ?? 0) ?> Minuten · bestanden ab <?= (int) ($regeln['mindestRichtig'] ?? 0) ?> richtigen</p>
            <?php if (!empty($regeln['verkuerzt'])) { ?><p class="band">Bogen verkürzt: der Katalog hat noch nicht genug Fragen.</p><?php } ?>
        </div>
        <div class="timer" role="timer" aria-live="off">
            <span class="timer-label">Restzeit</span>
            <output class="timer-wert" data-timer><?= e(dauerAnzeigen(max(0, $ende - time()))) ?></output>
        </div>
    </header>

    <ol class="bogen-fragen">
    <?php foreach ($pruefung['fragen'] as $i => $eintrag) {
        $position = $i + 1;
        $frage = $katalog['fragen'][$eintrag['frage_id']] ?? null;
        if ($frage === null) {
            continue;
        }
        $antworten = [];
        foreach ($eintrag['reihenfolge'] as $idx) {
            $antworten[] = $frage['antworten'][$idx] ?? '';
        }
        $feldname = "antwort[$position]";
        $gewaehlt = null;
        $aufloesung = null;
    ?>
        <li class="bogen-frage" id="frage-<?= $position ?>">
            <p class="fragekopf">Frage <?= $position ?><?php if (isset($frage['nr'])) { ?> <small>Katalog-Nr. <?= (int) $frage['nr'] ?></small><?php } ?></p>
            <?php require __DIR__ . '/_frage.php'; ?>
        </li>
    <?php } ?>
    </ol>

    <footer class="bogen-fuss">
        <p><span data-beantwortet>0</span> von <?= count($pruefung['fragen']) ?> beantwortet</p>
        <button type="submit">Abgeben</button>
    </footer>
</form>
