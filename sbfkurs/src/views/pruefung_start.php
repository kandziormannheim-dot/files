<?php
$seitentitel = 'Prüfung ' . $z['titel'];
$regeln = $z['pruefung'];
?>
<p class="brotkrumen"><a href="/">Kurse</a> › <a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › Prüfungssimulation</p>
<h1>Prüfungssimulation</h1>
<?php if ($katalog['beispielhaft']) { ?><p class="band">Beispielfragen — noch nicht der amtliche Katalog</p><?php } ?>

<div class="zweispaltig">
<section class="karte">
    <h2>So läuft die Prüfung</h2>
    <ul>
        <li><strong><?= (int) $regeln['fragenProBogen'] ?> Fragen</strong> in <strong><?= (int) $regeln['zeitMinuten'] ?> Minuten</strong>.</li>
        <li>Bestanden ab <strong><?= (int) $regeln['mindestRichtig'] ?> richtigen</strong> Antworten.</li>
        <?php if ($regeln['zusammensetzung'] !== []) { ?>
        <li>Zusammensetzung:
            <?php $teile = []; foreach ($katalog['module'] as $m) { if (isset($regeln['zusammensetzung'][$m['id']])) { $teile[] = (int) $regeln['zusammensetzung'][$m['id']] . '× ' . ($m['titel'] ?? $m['id']); } } echo e(implode(', ', $teile)); ?>.
        </li>
        <?php } ?>
        <?php foreach ($regeln['weitereTeile'] as $teil) { ?>
        <li>Weiterer Prüfungsteil: <?= e($teil['titel']) ?>
            <?php if (!empty($teil['simuliert'])) { ?><small>(hier: <?= $teil['simuliert'] === 'englisch' ? '<a href="/uebung/' . e($kennung) . '/englisch">Englisch-Übungen</a>' : ($teil['simuliert'] === 'dsc' ? '<a href="/uebung/dsc?kurs=' . e($kennung) . '">DSC-Simulator</a>' : e($teil['simuliert'])) ?>)</small><?php } else { ?><small>(nicht simuliert)</small><?php } ?>
        </li>
        <?php } ?>
    </ul>
    <?php if (isset($regeln['_zuPruefen'])) { ?>
    <p><small>Regeln nach bestem Wissen; maßgeblich ist die aktuelle Prüfungsordnung.</small></p>
    <?php } ?>
    <?php if (count($katalog['fragen']) < (int) $regeln['fragenProBogen']) { ?>
    <p class="karte warnung">Der Katalog hat erst <?= count($katalog['fragen']) ?> Fragen — der Bogen wird entsprechend verkürzt, die Bestehensgrenze anteilig gesetzt.</p>
    <?php } ?>

    <?php if ($stand['offenePruefung'] !== null) { ?>
    <p class="knopfreihe"><a class="knopf" href="/pruefung/<?= (int) $stand['offenePruefung'] ?>">Laufende Prüfung fortsetzen</a></p>
    <?php } elseif ($katalog['fragen'] !== []) { ?>
    <form method="post" action="/pruefung/<?= e($kennung) ?>/start">
        <?= csrfFeld() ?>
        <?php if ($boegen !== []) { ?>
        <label>Bogen
            <select name="bogen">
                <option value="zufall">Zufällig zusammengestellt</option>
                <option value="amtlich">Amtlicher Bogen, zufällig gewählt</option>
                <?php foreach ($boegen as $nr => $fragen) { ?>
                <option value="amtlich-<?= (int) $nr ?>">Amtlicher Bogen Nr. <?= (int) $nr ?></option>
                <?php } ?>
            </select>
        </label>
        <?php } else { ?>
        <input type="hidden" name="bogen" value="zufall">
        <?php } ?>
        <button type="submit">Prüfung starten</button>
        <p><small>Die Zeit läuft ab dem Start. Du kannst die Seite neu laden — Antworten bleiben erhalten.</small></p>
    </form>
    <?php } ?>
</section>

<section class="karte">
    <h2>Bisherige Versuche</h2>
    <?php if ($verlauf === []) { ?>
    <p>Noch keine Prüfung abgelegt.</p>
    <?php } else { ?>
    <div class="tabelle-rahmen">
    <table class="liste">
        <thead><tr><th>Datum</th><th>Bogen</th><th>Ergebnis</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($verlauf as $p) { ?>
            <tr>
                <td><?= e(zeitAnzeigen($p['abgegeben_am'])) ?></td>
                <td><?= e($p['bogen'] === 'zufall' ? 'zufällig' : str_replace('amtlich-', 'Nr. ', $p['bogen'])) ?></td>
                <td><?= (int) $p['richtig'] ?>/<?= (int) $p['gesamt'] ?> <span class="status status-<?= (int) $p['bestanden'] === 1 ? 'gut' : 'schlecht' ?>"><?= (int) $p['bestanden'] === 1 ? 'bestanden' : 'nicht bestanden' ?></span><?= (int) $p['ueberzogen'] === 1 ? ' <small>(Zeit überzogen)</small>' : '' ?></td>
                <td><a href="/pruefung/<?= (int) $p['id'] ?>/ergebnis">Ansehen</a></td>
            </tr>
        <?php } ?>
        </tbody>
    </table>
    </div>
    <?php } ?>
</section>
</div>
