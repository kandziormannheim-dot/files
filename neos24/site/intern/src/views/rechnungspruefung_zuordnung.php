<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('rechnungspruefung')) ?>">← Rechnungsprüfung</a><h1 class="h1">Spalten zuordnen</h1></div>
  <p class="leise"><?= e($r['carrier'] ?? '') ?> · <?= e($r['nummer'] ?: 'Rechnung #' . $r['id']) ?> · <?= count($csv['zeilen']) ?> Zeilen<?= $csv['trenner'] !== '' ? ', Trenner <code>' . ($csv['trenner'] === "\t" ? 'Tab' : e($csv['trenner'])) . '</code>' : '' ?></p>
</header>
<?php if (count($blaetter) > 1) { ?>
<nav class="reiter" aria-label="Blätter">
  <?php foreach ($blaetter as $i => $b) { ?><a href="<?= e(url('rechnungspruefung/' . $r['id'] . '/zuordnung', ['blatt' => $b['name']])) ?>" class="<?= $i === $blattIndex ? 'aktiv' : '' ?>"><?= e($b['name']) ?> <span class="leise">(<?= count($b['zeilen']) ?>)</span></a><?php } ?>
</nav>
<?php } ?>
<form method="post" action="<?= e(url('rechnungspruefung/' . $r['id'] . '/zuordnung')) ?>" class="formular">
  <?= csrfFeld() ?>
  <input type="hidden" name="blatt" value="<?= e($csv['name']) ?>">
  <div class="spalten spalten--2-1">
    <div class="karte karte--tabelle">
      <h2 class="h2">Vorschau (erste 8 Zeilen)</h2>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><?php foreach ($csv['kopf'] as $i => $name) { ?><th><?= e($name) ?><br><span class="leise mono">#<?= $i + 1 ?></span></th><?php } ?></tr></thead>
        <tbody>
        <?php foreach (array_slice($csv['zeilen'], 0, 8) as $z) { ?><tr><?php foreach ($csv['kopf'] as $i => $_) { ?><td class="mono"><?= e(mb_substr((string) ($z[$i] ?? ''), 0, 28)) ?></td><?php } ?></tr><?php } ?>
        </tbody>
      </table></div>
    </div>
    <div class="karte">
      <h2 class="h2">Welche Spalte ist was?</h2>
      <?php foreach (RP_FELDER as $feld => $name) { ?>
        <div class="feld"><label for="sp-<?= e($feld) ?>"><?= e($name) ?><?= in_array($feld, ['gewicht', 'betrag'], true) ? ' *' : '' ?></label>
          <select id="sp-<?= e($feld) ?>" name="spalte[<?= e($feld) ?>]">
            <option value="">— nicht enthalten —</option>
            <?php foreach ($csv['kopf'] as $i => $kname) { ?><option value="<?= $i ?>" <?= (int) ($vorschlag[$feld] ?? -1) === $i ? 'selected' : '' ?>><?= e($kname) ?> (#<?= $i + 1 ?>)</option><?php } ?>
          </select>
        </div>
      <?php } ?>
      <?php if (count($blaetter) > 1) { ?>
      <div class="feld"><label for="sp-zuschlag-blatt">Zuschläge aus anderem Blatt (je Sendungsnummer)</label>
        <select id="sp-zuschlag-blatt" name="zuschlag_blatt"><option value="">— keine —</option><?php foreach ($blaetter as $i => $b) { if ($i === $blattIndex) { continue; } ?><option value="<?= e($b['name']) ?>" <?= $zuschlagBlatt === $b['name'] ? 'selected' : '' ?>><?= e($b['name']) ?></option><?php } ?></select>
        <span class="leise">Spalten mit „Surcharge“, „Zuschlag“, „Fee“ werden je Sendung addiert — nur wenn oben keine Zuschlagsspalte gewählt ist.</span>
      </div>
      <?php } ?>
      <div class="feld"><label for="sp-einheit">Gewicht in</label><select id="sp-einheit" name="einheit"><option value="kg" <?= $einheit === 'kg' ? 'selected' : '' ?>>Kilogramm (4,5)</option><option value="g" <?= $einheit === 'g' ? 'selected' : '' ?>>Gramm (4500)</option></select></div>
      <label class="schalter"><input type="checkbox" name="profil" value="1" checked> Zuordnung für <?= e($r['carrier'] ?? 'diesen Carrier') ?> merken</label>
      <button class="knopf knopf--primaer knopf--breit" type="submit">Positionen einlesen und prüfen</button>
      <p class="leise">Unsere Sendungsnummer wird auch in anderen Spalten erkannt (Muster NE-JJJJ-XXXXXXXX). Ohne sie und ohne Carrier-Sendungsnummer bleibt die Zeile „nicht zugeordnet“.</p>
    </div>
  </div>
</form>
