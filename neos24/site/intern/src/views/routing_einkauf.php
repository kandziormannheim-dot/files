<?php $m = $vorschau['matrix'] ?? null; ?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('routing')) ?>">← Routingmatrix</a><h1 class="h1">Einkaufspreise importieren</h1></div>
  <p class="leise">Preisliste eines Carriers (XLSX oder CSV: Zeilen = Länder, Spalten = Gewichtsgrenzen) in die Einkaufsspalte der Routingmatrix übernehmen.</p>
</header>
<div class="spalten spalten--2-1">
  <div>
    <?php if ($m === null) { ?>
    <div class="karte"><p class="leer">Noch keine Vorschau — rechts eine Preisliste hochladen.</p></div>
    <?php } else { ?>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Vorschau <?= e($vorschau['datei']) ?></h2><span class="leise"><?= count($m['zeilen']) ?> Länder × <?= count($m['klassen']) ?> Gewichtsgrenzen</span></div>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Land</th><?php foreach ($m['klassen'] as $g) { $k = einkaufKlasseFuer((int) $g, false); ?><th class="rechts">bis <?= e(rtrim(rtrim(number_format($g / 1000, 1, ',', ''), '0'), ',')) ?> kg<br><span class="leise mono"><?= $k !== null ? e($k['code']) : 'neu' ?></span></th><?php } ?></tr></thead>
        <tbody>
        <?php foreach ($m['zeilen'] as $z) { ?>
          <tr>
            <td><span class="flagge"><?= e($z['code']) ?></span><?= e($z['name']) ?></td>
            <?php foreach ($m['klassen'] as $g) { $v = $vergleich[$z['code']][$g] ?? null; $cent = $z['preise'][$g] ?? null; ?>
              <td class="mono rechts"><?php if ($cent === null) { ?>—<?php } else { ?><?= e(euro($cent)) ?><?php if ($v !== null && $v['alt'] !== null && $v['alt'] !== $cent) { ?><br><span class="leise">bisher <?= e(euro($v['alt'])) ?></span><?php } elseif ($v !== null && $v['alt'] === null) { ?><br><span class="leise">neu</span><?php } ?><?php } ?></td>
            <?php } ?>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php if ($m['unbekannt'] !== []) { ?><p class="leise" style="margin-top:.75rem">Nicht zugeordnete Zeilen (kein Land erkannt): <?= e(implode(', ', array_slice($m['unbekannt'], 0, 12))) ?><?= count($m['unbekannt']) > 12 ? ' …' : '' ?></p><?php } ?>
    </div>
    <?php } ?>
  </div>
  <div>
    <div class="karte">
      <h2 class="h2">Preisliste hochladen</h2>
      <form method="post" action="<?= e(url('routing/einkauf')) ?>" enctype="multipart/form-data" class="formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="ek-carrier">Carrier</label><select id="ek-carrier" name="carrier_id" required><option value="">— wählen —</option><?php foreach ($carrier as $c) { ?><option value="<?= (int) $c['id'] ?>" <?= (int) ($vorschau['carrier_id'] ?? 0) === (int) $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option><?php } ?></select></div>
        <div class="feld"><label for="ek-datei">Preisliste (XLSX oder CSV)</label><input id="ek-datei" name="datei" type="file" accept=".xlsx,.csv,.txt" required></div>
        <button class="knopf knopf--leise" type="submit">Vorschau</button>
      </form>
      <p class="leise" style="margin-top:.75rem">Erkannt wird die erste Zeile mit Gewichtsgrenzen wie „&lt;5kg“ oder „10 kg“; darunter je Zeile ein Land (Name deutsch/englisch oder ISO-Code) mit den Preisen. Fußnoten und Zuschlagstabellen werden übersprungen.</p>
    </div>
    <?php if ($m !== null) { ?>
    <div class="karte karte--gelb">
      <h2 class="h2">Übernehmen</h2>
      <form method="post" action="<?= e(url('routing/einkauf/uebernehmen')) ?>" class="formular" data-bestaetigen="Einkaufspreise für <?= count($m['zeilen']) ?> Länder in die Routingmatrix schreiben?">
        <?= csrfFeld() ?>
        <div class="feld"><label for="ek-aufschlag">Verkaufsaufschlag für neue Routing-Zeilen (%)</label><input id="ek-aufschlag" name="aufschlag" inputmode="decimal" value="30"><span class="leise">Bestehende Zeilen behalten ihren Verkaufspreis; nur der Einkauf wird gesetzt.</span></div>
        <label class="schalter"><input type="checkbox" name="aktiv" value="1" checked> Neue Zeilen sofort aktiv (sonst erst in der Routingmatrix freischalten)</label>
        <button class="knopf knopf--primaer knopf--breit" type="submit">In die Routingmatrix übernehmen</button>
      </form>
      <form method="post" action="<?= e(url('routing/einkauf/verwerfen')) ?>" style="margin-top:.6rem"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--breit" type="submit">Vorschau verwerfen</button></form>
      <p class="leise" style="margin-top:.75rem">Gewichtsgrenzen ohne passende Klasse werden als neue Gewichtsklassen angelegt (z. B. 1 kg, 3 kg, 15 kg, 25 kg); 30 kg trifft die vorhandene Klasse bis 31,5 kg. Länder, die es noch nicht gibt, kommen inaktiv dazu.</p>
    </div>
    <?php } ?>
  </div>
</div>
