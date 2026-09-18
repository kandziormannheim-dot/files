<?php
$seitentitel = 'DSC-Simulator';
$breit = true;
$skripte = ['/assets/dsc.js'];
$liste = array_values(array_filter($szenarien['szenarien'], static fn (array $s): bool => $kennung === null || !isset($s['zertifikat']) || in_array($kennung, (array) $s['zertifikat'], true)));
$geraet = $szenarien['geraet'] + ['kanaele' => ['16', '70', '06', '08', '72', '77'], 'eigeneMmsi' => '211123450'];
?>
<p class="brotkrumen"><a href="/">Kurse</a> › DSC-Simulator</p>
<h1>DSC-Controller-Simulator</h1>
<p class="kurz">Ein nachgebautes UKW-Funkgerät mit DSC-Controller: Menü mit MENU/ENT/CLR und den Pfeiltasten bedienen, Ziffern eintippen, Kanal und Sendeleistung wählen, zum Sprechen die PTT-Taste halten — die Gegenstelle antwortet im Sprechfunk-Fenster (auf Wunsch vorgelesen). Die rote DISTRESS-Taste sitzt unter einer Klappe und wirkt nur lange gedrückt. Jedes Szenario zählt die erwarteten Schritte mit.</p>

<?php if ($liste === []) { ?>
<p class="karte">Noch keine Szenarien hinterlegt.</p>
<?php } else { ?>
<div class="dsc-raster">
<section class="karte dsc-szenarien">
    <h2>Szenarien</h2>
    <ol class="uebungsliste kompakt">
    <?php foreach ($liste as $s) { $b = $stand['beste'][$s['id']] ?? null; ?>
        <li class="<?= $b !== null && $b['beste'] >= 80 ? 'gelesen' : '' ?>">
            <button type="button" class="leise szenario-wahl" data-szenario="<?= e($s['id']) ?>"><?= e($s['titel']) ?></button>
            <?php if ($b !== null) { ?><small>bestes Ergebnis <?= (int) $b['beste'] ?> %</small><?php } ?>
        </li>
    <?php } ?>
    </ol>
    <div class="dsc-lage" data-lage hidden>
        <p class="kasten-titel" data-lage-titel></p>
        <p data-lage-text></p>
        <ol class="dsc-protokoll" data-protokoll></ol>
        <p class="knopfreihe">
            <button type="button" data-neustart class="zweit">Szenario neu starten</button>
        </p>
    </div>
    <div class="dsc-funk" data-funk hidden>
        <p class="kasten-titel">Sprechfunk</p>
        <p><strong>Du (PTT halten):</strong> <span data-funk-du>…</span></p>
        <p><strong>Gegenstelle:</strong> <span data-funk-antwort>…</span></p>
        <label class="inline"><input type="checkbox" data-funk-vorlesen checked> Antwort vorlesen (Sprachausgabe des Browsers)</label>
    </div>
    <form method="post" action="/uebung/dsc/ergebnis" data-dsc-ergebnis hidden>
        <?= csrfFeld() ?>
        <input type="hidden" name="szenario" value="">
        <input type="hidden" name="punkte" value="0">
        <input type="hidden" name="protokoll" value="[]">
        <button type="submit">Ergebnis speichern</button>
    </form>
</section>

<section class="karte dsc-geraet" data-dsc data-szenarien="<?= e(json_encode($liste, JSON_UNESCAPED_UNICODE)) ?>" data-geraet="<?= e(json_encode($geraet, JSON_UNESCAPED_UNICODE)) ?>">
    <div class="dsc-display" aria-live="polite">
        <div class="dsc-zeile dsc-status"><span data-anzeige-kanal>CH 16</span><span data-anzeige-leistung>25 W</span><span data-anzeige-mmsi>MMSI <?= e($geraet['eigeneMmsi']) ?></span></div>
        <div class="dsc-zeile" data-zeile="1">DSC READY</div>
        <div class="dsc-zeile" data-zeile="2"></div>
        <div class="dsc-zeile" data-zeile="3"></div>
    </div>
    <div class="dsc-tasten">
        <div class="dsc-block dsc-menue">
            <button type="button" data-taste="menu">MENU</button>
            <button type="button" data-taste="hoch">▲</button>
            <button type="button" data-taste="runter">▼</button>
            <button type="button" data-taste="ent">ENT</button>
            <button type="button" data-taste="clr">CLR</button>
        </div>
        <div class="dsc-block dsc-ziffern">
            <?php foreach (['1', '2', '3', '4', '5', '6', '7', '8', '9', '16', '0', '⌫'] as $z) { ?>
            <button type="button" data-ziffer="<?= e($z) ?>"><?= e($z) ?></button>
            <?php } ?>
        </div>
        <div class="dsc-block dsc-kanal">
            <span class="dsc-beschriftung">Kanal</span>
            <button type="button" data-taste="kanal-hoch">CH ▲</button>
            <button type="button" data-taste="kanal-runter">CH ▼</button>
            <button type="button" data-taste="leistung">25 W → 1 W</button>
            <button type="button" data-taste="ptt" class="ptt" aria-label="Sprechtaste halten">PTT <small>halten</small></button>
        </div>
        <div class="dsc-block dsc-distress">
            <button type="button" class="klappe" data-klappe aria-expanded="false">DISTRESS<br><small>Klappe öffnen</small></button>
            <button type="button" class="distress" data-distress hidden aria-label="DISTRESS 5 Sekunden halten">
                <span class="distress-ring"></span>DISTRESS<br><small>5 s halten</small>
            </button>
        </div>
    </div>
</section>
</div>
<?php } ?>
