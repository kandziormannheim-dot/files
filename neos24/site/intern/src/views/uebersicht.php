<?php
$max = max(1, ...array_map(static fn (array $w): int => (int) $w['anzahl'], $k['wochen']));
$bezahlt = (int) ($k['status']['bezahlt'] ?? 0);
$offen = (int) ($k['status']['offen'] ?? 0) + (int) ($k['status']['angelegt'] ?? 0) + (int) ($k['status']['autorisiert'] ?? 0);
$fehl = (int) ($k['status']['fehlgeschlagen'] ?? 0) + (int) ($k['status']['storniert'] ?? 0);
$gesamt = max(1, $k['gesamt']);
$trend = (int) $k['umsatzVor']['brutto'] > 0 ? (int) round(((int) $k['umsatz30']['brutto'] - (int) $k['umsatzVor']['brutto']) * 100 / (int) $k['umsatzVor']['brutto']) : null;
?>
<header class="kopfzeile">
  <div><span class="eyebrow">Übersicht</span><h1 class="h1">Guten Tag, <?= e(explode(' ', benutzerAktuell()['name'])[0]) ?>.</h1></div>
  <p class="leise">Stand <?= e(zeitAnzeigen(jetzt())) ?> · alle Zahlen aus den Bestellungen der Datenbank</p>
</header>

<div class="kpi-raster">
  <div class="kpi kpi--cyan"><span class="kpi-name">Bestellungen heute</span><strong class="kpi-wert"><?= $k['heute'] ?></strong><span class="kpi-zusatz"><?= $k['tage7'] ?> in 7 Tagen · <?= $k['tage30'] ?> in 30 Tagen</span></div>
  <div class="kpi kpi--gelb"><span class="kpi-name">Umsatz 30 Tage (brutto)</span><strong class="kpi-wert"><?= e(euro((int) $k['umsatz30']['brutto'])) ?></strong><span class="kpi-zusatz">netto <?= e(euro((int) $k['umsatz30']['netto'])) ?> · bezahlt und auf Rechnung<?= $trend !== null ? ' · ' . ($trend >= 0 ? '+' : '') . $trend . ' % zu den 30 Tagen davor' : '' ?></span></div>
  <div class="kpi kpi--magenta"><span class="kpi-name">Marge 30 Tage</span><strong class="kpi-wert"><?= e(euro($k['marge30'])) ?></strong><span class="kpi-zusatz">Verkauf netto − Einkauf laut Routingmatrix</span></div>
  <div class="kpi kpi--cyan"><span class="kpi-name">Offene Rechnungen</span><strong class="kpi-wert"><?= (int) $k['rechnungenOffen'] ?></strong><span class="kpi-zusatz"><?= e(euro((int) $k['rechnungenOffenBrutto'])) ?> brutto · <?= (int) $k['firmenAktiv'] ?> aktive Firmen<?= darf('rechnungen') ? ' · <a href="' . e(url('rechnungen')) . '">öffnen</a>' : '' ?></span></div>
  <div class="kpi kpi--coral"><span class="kpi-name">Neue Anfragen</span><strong class="kpi-wert"><?= $k['anfragenNeu'] ?></strong><span class="kpi-zusatz"><?= $k['anfragenOffen'] ?> offen insgesamt<?= darf('kunden') ? ' · <a href="' . e(url('kunden')) . '">öffnen</a>' : '' ?></span></div>
</div>

<div class="spalten spalten--2-1">
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Sendungen je Woche</h2><span class="leise">letzte 8 Kalenderwochen, ohne offene und fehlgeschlagene</span></div>
    <div class="balken" role="img" aria-label="Sendungen je Woche">
      <?php foreach ($k['wochen'] as $w) { ?>
        <div class="balken-spalte">
          <span class="balken-wert"><?= (int) $w['anzahl'] ?></span>
          <div class="balken-stab" style="height:<?= max(3, (int) round((int) $w['anzahl'] * 100 / $max)) ?>%" title="KW <?= (int) $w['kw'] ?>: <?= (int) $w['anzahl'] ?> Sendungen, <?= e(euro((int) $w['brutto'])) ?>"></div>
          <span class="balken-name">KW <?= (int) $w['kw'] ?></span>
        </div>
      <?php } ?>
    </div>
  </div>
  <div class="karte karte--ink">
    <div class="karte-kopf"><h2 class="h2">Status aller Bestellungen</h2></div>
    <div class="anteil" aria-hidden="true">
      <span class="anteil--bezahlt" style="width:<?= (int) round($bezahlt * 100 / $gesamt) ?>%"></span>
      <span class="anteil--offen" style="width:<?= (int) round($offen * 100 / $gesamt) ?>%"></span>
      <span class="anteil--fehl" style="width:<?= (int) round($fehl * 100 / $gesamt) ?>%"></span>
    </div>
    <dl class="liste liste--ink">
      <dt><span class="punkt punkt--bezahlt"></span>Bezahlt</dt><dd class="mono"><?= $bezahlt ?></dd>
      <dt><span class="punkt punkt--offen"></span>Offen / in Zahlung</dt><dd class="mono"><?= $offen ?></dd>
      <dt><span class="punkt punkt--fehl"></span>Fehlgeschlagen / storniert</dt><dd class="mono"><?= $fehl ?></dd>
      <dt>Gesamt</dt><dd class="mono"><?= $k['gesamt'] ?></dd>
    </dl>
  </div>
</div>

<div class="spalten spalten--3">
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Top-Zielländer</h2><span class="leise">30 Tage</span></div>
    <?php if ($k['laender'] === []) { ?><p class="leer">Noch keine Sendungen.</p><?php } else { ?>
    <table class="tabelle tabelle--kompakt"><tbody>
      <?php foreach ($k['laender'] as $z) { ?><tr><td><span class="flagge"><?= e($z['zielland']) ?></span><?= e(preisliste()['laender'][$z['zielland']]['name']['de'] ?? $z['zielland']) ?></td><td class="mono rechts"><?= (int) $z['n'] ?></td><td class="mono rechts"><?= e(euro((int) $z['brutto'])) ?></td></tr><?php } ?>
    </tbody></table>
    <?php } ?>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Top-Carrier</h2><span class="leise">30 Tage, Priorität 1 bei Bestellung</span></div>
    <?php if ($k['carrier'] === []) { ?><p class="leer">Noch keine Sendungen.</p><?php } else { ?>
    <table class="tabelle tabelle--kompakt"><tbody>
      <?php foreach ($k['carrier'] as $z) { ?><tr><td><?= e($z['carrier']) ?></td><td class="mono rechts"><?= (int) $z['n'] ?></td></tr><?php } ?>
    </tbody></table>
    <?php } ?>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Letzte Bestellungen</h2><?php if (darf('bestellungen')) { ?><a class="leise" href="<?= e(url('bestellungen')) ?>">alle →</a><?php } ?></div>
    <?php if ($k['letzte'] === []) { ?><p class="leer">Noch keine Bestellungen.</p><?php } else { ?>
    <table class="tabelle tabelle--kompakt"><tbody>
      <?php foreach ($k['letzte'] as $z) { ?>
        <tr>
          <td><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $z['ext_ref'])) ?>"><?= e($z['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($z['ext_ref']) ?></span><?php } ?><br><span class="leise"><?= e($z['zielland']) ?> · <?= e($z['carrier'] ?? '—') ?></span></td>
          <td class="rechts"><?= statusPille((string) $z['status']) ?><br><span class="mono leise"><?= e(euro((int) $z['betrag_cent'])) ?></span></td>
        </tr>
      <?php } ?>
    </tbody></table>
    <?php } ?>
  </div>
</div>
