<?php
$spalten = ['sendungen', 'umsatz', 'einkauf', 'marge', 'marge_prozent', 'durchschnitt', 'retouren', 'nachberechnungen', 'zugestellt_quote', 'laufzeit', 'reklamationen'];
$tabelle = static function (array $zeilen, string $dimName, array $spalten, ?array $summe = null, string $exportDim = '') use ($query): string {
    if ($zeilen === []) { return '<p class="leer">Keine Daten im Zeitraum.</p>'; }
    $h = '<div class="scrollen"><table class="tabelle tabelle--kompakt tabelle--zahlen"><thead><tr><th>' . e($dimName) . '</th>';
    foreach ($spalten as $s) { $h .= '<th class="rechts">' . e(STATISTIK_KENNZAHLEN[$s][0]) . '</th>'; }
    $h .= '</tr></thead><tbody>';
    foreach ($zeilen as $z) {
        $h .= '<tr><td>' . e($z['name']) . '</td>';
        foreach ($spalten as $s) { $h .= '<td class="rechts mono">' . e(statistikFormat($z[$s], STATISTIK_KENNZAHLEN[$s][1])) . '</td>'; }
        $h .= '</tr>';
    }
    $h .= '</tbody>';
    if ($summe !== null) {
        $h .= '<tfoot><tr><td><strong>Gesamt</strong></td>';
        foreach ($spalten as $s) { $h .= '<td class="rechts mono"><strong>' . e(statistikFormat($summe[$s], STATISTIK_KENNZAHLEN[$s][1])) . '</strong></td>'; }
        $h .= '</tr></tfoot>';
    }
    $h .= '</table></div>';
    if ($exportDim !== '') {
        $h .= '<p class="export-zeile"><a class="knopf knopf--leise knopf--klein" href="' . e(url('statistik/export.csv', $query + ['was' => $exportDim === 'zeitreihe' ? 'zeitreihe' : 'dimension', 'dim' => $exportDim])) . '">CSV ↓</a> <a class="knopf knopf--leise knopf--klein" href="' . e(url('statistik/export.xlsx', $query + ['was' => $exportDim === 'zeitreihe' ? 'zeitreihe' : 'dimension', 'dim' => $exportDim])) . '">Excel ↓</a></p>';
    }
    return $h;
};
$reihe = static fn (array $zeilen, string $k): array => array_map(static fn (array $z): array => ['name' => $z['name'], 'wert' => $z[$k]], $zeilen);
?>
<header class="kopfzeile">
  <div><span class="eyebrow">Statistiken &amp; Berichte</span><h1 class="h1"><?= e($berichte[$bericht]) ?></h1></div>
</header>
<?php $ziel = 'statistik/' . $bericht; $extra = $bericht === 'pivot' ? array_intersect_key($pk, array_flip(['zeilen', 'spalten', 'kennzahl', 'limit', 'diagramm'])) : []; require __DIR__ . '/statistik_filter.php'; ?>

<?php if ($bericht === 'zeitverlauf') { $zr = $d['zeitreihe']; $kats = array_column($zr, 'name'); ?>
<div class="karte">
  <div class="karte-kopf"><h2 class="h2">Sendungen, Umsatz, Einkauf und Marge</h2>
    <form method="get" action="<?= e(url('statistik/zeitverlauf')) ?>" class="formular--inline"><?php foreach ($query as $k => $v) { ?><input type="hidden" name="<?= e($k) ?>" value="<?= e((string) $v) ?>"><?php } ?><select name="granularitaet" aria-label="Auflösung" onchange="this.form.requestSubmit()"><?php foreach (['tag' => 'je Tag', 'woche' => 'je Woche', 'monat' => 'je Monat'] as $g => $name) { ?><option value="<?= $g ?>" <?= $d['granularitaet'] === $g ? 'selected' : '' ?>><?= $name ?></option><?php } ?></select></form></div>
  <?= svgZeitreihe($kats, [
      ['name' => 'Sendungen', 'werte' => array_column($zr, 'sendungen'), 'format' => 'anzahl', 'art' => 'balken'],
      ['name' => 'Umsatz netto', 'werte' => array_column($zr, 'umsatz'), 'format' => 'euro', 'art' => 'linie', 'achse' => 'rechts', 'farbe' => '#FF5A2C'],
      ['name' => 'Einkauf', 'werte' => array_column($zr, 'einkauf'), 'format' => 'euro', 'art' => 'linie', 'achse' => 'rechts', 'farbe' => '#8a8f9a'],
      ['name' => 'Marge', 'werte' => array_column($zr, 'marge'), 'format' => 'euro', 'art' => 'linie', 'achse' => 'rechts', 'farbe' => '#FF3EA5'],
  ]) ?>
</div>
<div class="spalten spalten--2">
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Zustellquote und Laufzeit</h2></div>
    <?= svgZeitreihe($kats, [['name' => 'Zustellquote %', 'werte' => array_column($zr, 'zugestellt_quote'), 'format' => 'prozent', 'art' => 'linie', 'farbe' => '#1FB97A'], ['name' => 'Ø Laufzeit Tage', 'werte' => array_column($zr, 'laufzeit'), 'format' => 'tage', 'art' => 'linie', 'achse' => 'rechts', 'farbe' => '#7B61FF']], 600, 220) ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Retouren, Nachberechnungen, Reklamationen</h2></div>
    <?= svgZeitreihe($kats, [['name' => 'Retouren', 'werte' => array_column($zr, 'retouren'), 'format' => 'anzahl'], ['name' => 'Nachberechnungen', 'werte' => array_column($zr, 'nachberechnungen'), 'format' => 'anzahl'], ['name' => 'Reklamationen', 'werte' => array_column($zr, 'reklamationen'), 'format' => 'anzahl']], 600, 220) ?></div>
</div>
<div class="karte karte--tabelle"><div class="karte-kopf"><h2 class="h2">Tabelle</h2></div><?= $tabelle($zr, ['tag' => 'Tag', 'woche' => 'Woche', 'monat' => 'Monat'][$d['granularitaet']], array_merge(['sendungen', 'umsatz', 'brutto', 'einkauf', 'marge', 'marge_prozent', 'durchschnitt', 'retouren', 'nachberechnungen', 'storniert', 'zugestellt_quote', 'laufzeit', 'reklamationen']), $d['summe'], 'zeitreihe') ?></div>

<?php } elseif ($bericht === 'carrier' || $bericht === 'laender') { $dim = $bericht === 'carrier' ? 'carrier' : 'zielland'; ?>
<div class="spalten spalten--3">
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Sendungen</h2></div><?= svgQuerbalken($reihe(array_slice($d['zeilen'], 0, 12), 'sendungen')) ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Marge</h2></div><?= svgQuerbalken($reihe(array_slice($d['zeilen'], 0, 12), 'marge'), 'euro') ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2"><?= $bericht === 'carrier' ? 'Ø Laufzeit (Tage)' : 'Umsatzanteil' ?></h2></div><?= $bericht === 'carrier' ? svgQuerbalken($reihe(array_values(array_filter(array_slice($d['zeilen'], 0, 12), static fn (array $z): bool => $z['laufzeit'] > 0)), 'laufzeit'), 'tage') : svgRing($reihe(array_slice($d['zeilen'], 0, 8), 'umsatz'), 'euro') ?></div>
</div>
<div class="karte karte--tabelle"><div class="karte-kopf"><h2 class="h2"><?= e($berichte[$bericht]) ?> im Vergleich</h2><span class="leise">Zustellquote bezogen auf abgeschlossene Sendungen · Laufzeit Übergabe bis Zustellung</span></div><?= $tabelle($d['zeilen'], STATISTIK_DIMENSIONEN[$dim], $spalten, $d['summe'], $dim) ?></div>

<?php } elseif ($bericht === 'kunden') { ?>
<div class="spalten spalten--3">
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Top-Kunden nach Umsatz</h2></div><?= svgQuerbalken($reihe(array_slice($d['zeilen'], 0, 12), 'umsatz'), 'euro') ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Geschäfts- und Privatkunden</h2></div><?= svgRing($reihe($d['kundenart'], 'umsatz'), 'euro') ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Preislisten</h2></div><?= svgRing($reihe($d['preislisten'], 'umsatz'), 'euro') ?></div>
</div>
<div class="karte karte--tabelle"><div class="karte-kopf"><h2 class="h2">Kunden</h2><span class="leise">Top 25 nach Umsatz</span></div><?= $tabelle($d['zeilen'], 'Kunde', $spalten, $d['summe'], 'kunde') ?></div>
<div class="karte karte--tabelle"><div class="karte-kopf"><h2 class="h2">Unterkunden und Hauptfirmen</h2></div><?= $tabelle($d['unterkunden'], 'Rechnungsempfänger', $spalten, null, 'unterkunde') ?></div>

<?php } elseif ($bericht === 'finanzen') { $zr = $d['zeitreihe']; $kats = array_column($zr, 'name'); $j = $d['k']['jetzt']; ?>
<div class="kpi-raster">
  <div class="kpi kpi--gelb"><span class="kpi-name">Umsatz netto</span><strong class="kpi-wert"><?= e(euro($j['umsatz'])) ?></strong><span class="kpi-zusatz">brutto <?= e(euro($j['brutto'])) ?></span></div>
  <div class="kpi kpi--cyan"><span class="kpi-name">Einkauf</span><strong class="kpi-wert"><?= e(euro($j['einkauf'])) ?></strong><span class="kpi-zusatz">Ist-Einkauf aus der Rechnungsprüfung, sonst Routing</span></div>
  <div class="kpi kpi--magenta"><span class="kpi-name">Marge</span><strong class="kpi-wert"><?= e(euro($j['marge'])) ?></strong><span class="kpi-zusatz"><?= e(statistikFormat($j['marge_prozent'], 'prozent')) ?></span></div>
  <div class="kpi kpi--coral"><span class="kpi-name">Nachberechnungen</span><strong class="kpi-wert"><?= e(euro($j['nachberechnung_summe'])) ?></strong><span class="kpi-zusatz"><?= (int) $j['nachberechnungen'] ?> Positionen</span></div>
  <div class="kpi <?= (int) $d['k']['offene_posten']['ueberfaellig'] > 0 ? 'kpi--coral' : 'kpi--gelb' ?>"><span class="kpi-name">Offene Posten</span><strong class="kpi-wert"><?= e(euro((int) $d['k']['offene_posten']['brutto'])) ?></strong><span class="kpi-zusatz">überfällig <?= e(euro((int) $d['k']['offene_posten']['ueberfaellig'])) ?></span></div>
</div>
<div class="karte"><div class="karte-kopf"><h2 class="h2">Umsatz, Einkauf und Marge</h2></div>
  <?= svgZeitreihe($kats, [['name' => 'Umsatz netto', 'werte' => array_column($zr, 'umsatz'), 'format' => 'euro'], ['name' => 'Einkauf', 'werte' => array_column($zr, 'einkauf'), 'format' => 'euro', 'farbe' => '#8a8f9a'], ['name' => 'Marge', 'werte' => array_column($zr, 'marge'), 'format' => 'euro', 'farbe' => '#FF3EA5']]) ?></div>
<div class="spalten spalten--3">
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Zahlungsarten</h2></div><?= svgRing($reihe($d['zahlungsarten'], 'umsatz'), 'euro') ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Auftragsarten</h2></div><?= svgRing($reihe($d['arten'], 'umsatz'), 'euro') ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Sammelrechnungen je Monat</h2><span class="leise">brutto</span></div>
    <?php if ($d['rechnungen'] === []) { ?><p class="leer">Keine Rechnungen im Zeitraum.</p><?php } else { ?><?= svgZeitreihe(array_map(static fn (array $r): string => statistikDimensionName('monat', (string) $r['monat']), $d['rechnungen']), [['name' => 'Bezahlt', 'werte' => array_column($d['rechnungen'], 'bezahlt'), 'format' => 'euro', 'farbe' => '#1FB97A'], ['name' => 'Offen', 'werte' => array_column($d['rechnungen'], 'offen'), 'format' => 'euro', 'farbe' => '#FFD400'], ['name' => 'Storniert', 'werte' => array_column($d['rechnungen'], 'storniert'), 'format' => 'euro', 'farbe' => '#FF5A2C']], 600, 220) ?><?php } ?></div>
</div>
<div class="karte karte--tabelle"><div class="karte-kopf"><h2 class="h2">Offene Posten je Kunde</h2><span class="leise">alle offenen Sammelrechnungen, unabhängig vom Zeitraum</span></div>
  <?php if ($d['offene_posten'] === []) { ?><p class="leer">Keine offenen Rechnungen.</p><?php } else { ?>
  <div class="scrollen"><table class="tabelle tabelle--kompakt"><thead><tr><th>Kunde</th><th>Kundennummer</th><th class="rechts">Rechnungen</th><th class="rechts">Offen brutto</th><th class="rechts">Überfällig</th><th>Älteste Fälligkeit</th></tr></thead><tbody>
    <?php foreach ($d['offene_posten'] as $o) { ?><tr><td><?php if (darf('kunden')) { ?><a href="<?= e(url('kunden/firmen/' . $o['id'])) ?>"><?= e($o['name']) ?></a><?php } else { ?><?= e($o['name']) ?><?php } ?></td><td class="mono"><?= e($o['kundennummer']) ?></td><td class="rechts mono"><?= (int) $o['n'] ?></td><td class="rechts mono"><?= e(euro((int) $o['brutto'])) ?></td><td class="rechts mono <?= (int) $o['ueberfaellig'] > 0 ? 'warn' : '' ?>"><?= e(euro((int) $o['ueberfaellig'])) ?></td><td class="mono"><?= e(datumAnzeigen($o['aelteste'] . 'T00:00:00Z')) ?></td></tr><?php } ?>
  </tbody></table></div><?php } ?></div>

<?php } elseif ($bericht === 'reklamationen') { $r = $d['r']; $s = $r['summe']; $zr = $d['zeitreihe']; ?>
<div class="kpi-raster">
  <div class="kpi kpi--coral"><span class="kpi-name">Reklamationen</span><strong class="kpi-wert"><?= (int) $s['n'] ?></strong><span class="kpi-zusatz"><?= (int) $s['offen'] ?> offen</span></div>
  <div class="kpi kpi--gelb"><span class="kpi-name">Gefordert</span><strong class="kpi-wert"><?= e(euro((int) $s['betrag'])) ?></strong><span class="kpi-zusatz">Summe der Reklamationsbeträge</span></div>
  <div class="kpi kpi--magenta"><span class="kpi-name">Erstattet</span><strong class="kpi-wert"><?= e(euro((int) $s['erstattung'])) ?></strong><span class="kpi-zusatz"><?= (int) $s['betrag'] > 0 ? e(number_format((int) $s['erstattung'] * 100 / (int) $s['betrag'], 1, ',', '.')) . ' % der Forderungen' : '—' ?></span></div>
  <div class="kpi kpi--cyan"><span class="kpi-name">Ø Bearbeitungsdauer</span><strong class="kpi-wert"><?= $s['dauer'] !== null ? e(number_format((float) $s['dauer'], 1, ',', '.')) . ' T' : '—' ?></strong><span class="kpi-zusatz">bis Anerkennung, Erstattung oder Ablehnung</span></div>
</div>
<div class="spalten spalten--3">
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Nach Art</h2></div><?= svgRing(array_map(static fn (array $z): array => ['name' => REKLAMATION_ARTEN[$z['schluessel']]['de'] ?? $z['schluessel'], 'wert' => $z['n']], $r['art'])) ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Nach Status</h2></div><?= svgRing(array_map(static fn (array $z): array => ['name' => REKLAMATION_STATUS[$z['schluessel']]['de'] ?? $z['schluessel'], 'wert' => $z['n']], $r['status'])) ?></div>
  <div class="karte"><div class="karte-kopf"><h2 class="h2">Reklamationsquote je Carrier</h2></div><?= svgQuerbalken($reihe(array_values(array_filter(array_slice($d['carrier'], 0, 12), static fn (array $z): bool => $z['sendungen'] > 0)), 'reklamationsquote'), 'prozent') ?></div>
</div>
<div class="karte"><div class="karte-kopf"><h2 class="h2">Reklamationen im Zeitverlauf</h2></div><?= svgZeitreihe(array_column($zr, 'name'), [['name' => 'Reklamationen', 'werte' => array_column($zr, 'reklamationen'), 'format' => 'anzahl', 'farbe' => '#FF5A2C'], ['name' => 'Sendungen', 'werte' => array_column($zr, 'sendungen'), 'format' => 'anzahl', 'art' => 'linie', 'achse' => 'rechts']]) ?></div>
<div class="karte karte--tabelle"><div class="karte-kopf"><h2 class="h2">Carrier</h2></div><?= $tabelle($d['carrier'], 'Carrier', ['sendungen', 'reklamationen', 'reklamationsquote', 'zugestellt_quote', 'laufzeit', 'retouren', 'nachberechnungen'], null, 'carrier') ?></div>

<?php } elseif ($bericht === 'guthaben') { $g = $d['g']; ?>
<div class="kpi-raster">
  <div class="kpi kpi--gelb"><span class="kpi-name">Guthabenbestand</span><strong class="kpi-wert"><?= e(euro($g['bestand'])) ?></strong><span class="kpi-zusatz">Summe aller Kundenguthaben (Verbindlichkeit)</span></div>
  <div class="kpi kpi--cyan"><span class="kpi-name">Aufladungen im Zeitraum</span><strong class="kpi-wert"><?= e(euro((int) array_sum(array_column($g['aufladungen'], 'betrag')))) ?></strong><span class="kpi-zusatz"><?= (int) array_sum(array_column($g['aufladungen'], 'n')) ?> Aufladungen</span></div>
  <?php foreach ($g['buchungen'] as $b) { ?><div class="kpi kpi--magenta"><span class="kpi-name"><?= e(['aufladung' => 'Aufladungen', 'verbrauch' => 'Verbrauch für Sendungen', 'erstattung' => 'Erstattungen', 'korrektur' => 'Korrekturen'][$b['art']] ?? $b['art']) ?></span><strong class="kpi-wert"><?= e(euro((int) $b['betrag'])) ?></strong><span class="kpi-zusatz"><?= (int) $b['n'] ?> Buchungen</span></div><?php } ?>
</div>
<div class="karte"><div class="karte-kopf"><h2 class="h2">Aufladungen je Monat</h2></div>
  <?php if ($g['aufladungen'] === []) { ?><p class="leer">Keine Aufladungen im Zeitraum.</p><?php } else { ?><?= svgZeitreihe(array_map(static fn (array $r): string => statistikDimensionName('monat', (string) $r['monat']), $g['aufladungen']), [['name' => 'Aufladungen €', 'werte' => array_column($g['aufladungen'], 'betrag'), 'format' => 'euro', 'farbe' => '#FFD400'], ['name' => 'Anzahl', 'werte' => array_column($g['aufladungen'], 'n'), 'format' => 'anzahl', 'art' => 'linie', 'achse' => 'rechts']]) ?><?php } ?></div>

<?php } elseif ($bericht === 'pivot') { $p = $d['pivot']; $maxZelle = 0.0; foreach ($p['werte'] as $zs) { foreach ($zs as $v) { $maxZelle = max($maxZelle, (float) ($v ?? 0)); } } $darfB = darf('statistik', 'bearbeiten'); ?>
<div class="spalten spalten--2-1">
  <div class="karte">
    <form method="get" action="<?= e(url('statistik/pivot')) ?>" class="formular pivot-form">
      <?php foreach ($query as $k => $v) { ?><input type="hidden" name="<?= e($k) ?>" value="<?= e((string) $v) ?>"><?php } ?>
      <div class="spalten spalten--3">
        <div class="feld"><label for="pv-zeilen">Zeilen</label><select id="pv-zeilen" name="zeilen"><?php foreach (STATISTIK_DIMENSIONEN as $k => $name) { ?><option value="<?= e($k) ?>" <?= $pk['zeilen'] === $k ? 'selected' : '' ?>><?= e($name) ?></option><?php } ?></select></div>
        <div class="feld"><label for="pv-spalten">Spalten</label><select id="pv-spalten" name="spalten"><option value="">— keine —</option><?php foreach (STATISTIK_DIMENSIONEN as $k => $name) { ?><option value="<?= e($k) ?>" <?= $pk['spalten'] === $k ? 'selected' : '' ?>><?= e($name) ?></option><?php } ?></select></div>
        <div class="feld"><label for="pv-kennzahl">Kennzahl</label><select id="pv-kennzahl" name="kennzahl"><?php foreach (STATISTIK_KENNZAHLEN as $k => [$name]) { ?><option value="<?= e($k) ?>" <?= $pk['kennzahl'] === $k ? 'selected' : '' ?>><?= e($name) ?></option><?php } ?></select></div>
      </div>
      <div class="spalten spalten--3">
        <div class="feld"><label for="pv-limit">Zeilen (Top N)</label><select id="pv-limit" name="limit"><?php foreach ([5, 10, 15, 25, 50, 0] as $n) { ?><option value="<?= $n ?>" <?= $pk['limit'] === $n ? 'selected' : '' ?>><?= $n === 0 ? 'alle' : $n ?></option><?php } ?></select></div>
        <div class="feld"><label for="pv-diagramm">Diagramm</label><select id="pv-diagramm" name="diagramm"><?php foreach (['balken' => 'Balken', 'linie' => 'Linie', 'quer' => 'Rangliste', 'ring' => 'Ring', 'keins' => 'nur Tabelle'] as $k => $name) { ?><option value="<?= $k ?>" <?= $pk['diagramm'] === $k ? 'selected' : '' ?>><?= $name ?></option><?php } ?></select></div>
        <div class="feld formular-fuss" style="align-self:end"><button class="knopf knopf--primaer" type="submit">Bericht erstellen</button></div>
      </div>
    </form>
  </div>
  <div class="karte karte--ink">
    <div class="karte-kopf"><h2 class="h2">Gespeicherte Berichte</h2></div>
    <?php if ($d['berichte_liste'] === []) { ?><p class="leise">Noch keine. Bericht zusammenstellen und unten speichern.</p><?php } else { ?>
    <ul class="checklist berichte-liste">
      <?php foreach ($d['berichte_liste'] as $b) { ?><li><a href="<?= e(url('statistik/pivot', ['bericht' => $b['id']])) ?>"<?= $d['gespeichert'] !== null && (int) $d['gespeichert']['id'] === (int) $b['id'] ? ' class="aktiv"' : '' ?>><?= e($b['name']) ?></a><?php if ($darfB) { ?> <form method="post" action="<?= e(url('statistik/berichte/' . $b['id'] . '/loeschen')) ?>" data-bestaetigen="Bericht „<?= e($b['name']) ?>“ löschen?"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--klein" type="submit">✕</button></form><?php } ?></li><?php } ?>
    </ul>
    <?php } ?>
    <?php if ($darfB) { ?>
    <form method="post" action="<?= e(url('statistik/pivot', $query + $extra)) ?>" class="formular formular--inline" style="margin-top:1rem"><?= csrfFeld() ?>
      <?php if ($d['gespeichert'] !== null) { ?><input type="hidden" name="bericht_id" value="<?= (int) $d['gespeichert']['id'] ?>"><?php } ?>
      <input name="name" placeholder="Berichtsname" value="<?= e($d['gespeichert']['name'] ?? '') ?>" maxlength="80" required aria-label="Berichtsname">
      <button class="knopf knopf--leise" type="submit"><?= $d['gespeichert'] !== null ? 'Bericht aktualisieren' : 'Als Bericht speichern' ?></button>
    </form>
    <?php } ?>
  </div>
</div>
<?php if ($pk['diagramm'] !== 'keins') { ?>
<div class="karte">
  <div class="karte-kopf"><h2 class="h2"><?= e(STATISTIK_KENNZAHLEN[$p['kennzahl']][0]) ?> nach <?= e(STATISTIK_DIMENSIONEN[$p['zeilen_dim']]) ?><?= $p['spalten_dim'] !== '' ? ' × ' . e(STATISTIK_DIMENSIONEN[$p['spalten_dim']]) : '' ?></h2></div>
  <?php
  $zeilenNamen = array_values($p['zeilen']);
  if ($pk['diagramm'] === 'ring') {
      echo svgRing(array_map(static fn (string $z, string $name): array => ['name' => $name, 'wert' => (float) ($p['zeilen_summe'][$z] ?? 0)], array_keys($p['zeilen']), $zeilenNamen), $p['format']);
  } elseif ($pk['diagramm'] === 'quer') {
      echo svgQuerbalken(array_map(static fn (string $z, string $name): array => ['name' => $name, 'wert' => (float) ($p['zeilen_summe'][$z] ?? 0)], array_keys($p['zeilen']), $zeilenNamen), $p['format']);
  } elseif ($p['spalten_dim'] !== '') {
      // Spalten als Reihen (max. 8), Zeilen als Kategorien
      $reihen = [];
      foreach (array_slice($p['spalten'], 0, 8, true) as $s => $sName) {
          $reihen[] = ['name' => $sName, 'werte' => array_map(static fn (string $z): float => (float) ($p['werte'][$z][$s] ?? 0), array_keys($p['zeilen'])), 'format' => $p['format'], 'art' => $pk['diagramm']];
      }
      echo svgZeitreihe($zeilenNamen, $reihen, 900, 300);
  } else {
      echo svgZeitreihe($zeilenNamen, [['name' => STATISTIK_KENNZAHLEN[$p['kennzahl']][0], 'werte' => array_map(static fn (string $z): float => (float) ($p['zeilen_summe'][$z] ?? 0), array_keys($p['zeilen'])), 'format' => $p['format'], 'art' => $pk['diagramm']]], 900, 300);
  }
  ?>
</div>
<?php } ?>
<div class="karte karte--tabelle">
  <div class="karte-kopf"><h2 class="h2">Tabelle</h2><span class="leise"><?= count($p['zeilen']) ?> Zeilen<?= $p['spalten_dim'] !== '' ? ' × ' . count($p['spalten']) . ' Spalten' : '' ?> · Zeitraum <?= e(datumAnzeigen($f['von'] . 'T00:00:00Z')) ?> – <?= e(datumAnzeigen($f['bis_anzeige'] . 'T00:00:00Z')) ?></span></div>
  <?php if ($p['zeilen'] === []) { ?><p class="leer">Keine Daten im Zeitraum.</p><?php } else { ?>
  <div class="scrollen"><table class="tabelle tabelle--kompakt tabelle--zahlen pivot">
    <thead><tr><th><?= e(STATISTIK_DIMENSIONEN[$p['zeilen_dim']]) ?></th><?php foreach ($p['spalten'] as $sName) { ?><th class="rechts"><?= e($sName) ?></th><?php } ?><?php if ($p['spalten_dim'] !== '') { ?><th class="rechts">Summe</th><?php } ?></tr></thead>
    <tbody>
    <?php foreach ($p['zeilen'] as $z => $zName) { ?>
      <tr><td><?= e($zName) ?></td><?php foreach (array_keys($p['spalten']) as $s) { $v = $p['werte'][$z][$s] ?? null; ?><td class="rechts mono" style="<?= diagrammZellfarbe($v, $maxZelle) ?>"><?= e(statistikFormat($v, $p['format'])) ?></td><?php } ?><?php if ($p['spalten_dim'] !== '') { ?><td class="rechts mono"><strong><?= e(statistikFormat($p['zeilen_summe'][$z] ?? null, $p['format'])) ?></strong></td><?php } ?></tr>
    <?php } ?>
    </tbody>
    <tfoot><tr><td><strong>Gesamt</strong></td><?php foreach (array_keys($p['spalten']) as $s) { ?><td class="rechts mono"><strong><?= e(statistikFormat($p['spalten_summe'][$s] ?? null, $p['format'])) ?></strong></td><?php } ?><?php if ($p['spalten_dim'] !== '') { ?><td class="rechts mono"><strong><?= e(statistikFormat($p['gesamt'], $p['format'])) ?></strong></td><?php } ?></tr></tfoot>
  </table></div>
  <p class="export-zeile"><a class="knopf knopf--leise knopf--klein" href="<?= e(url('statistik/export.csv', $query + $extra + ['was' => 'pivot'])) ?>">CSV ↓</a> <a class="knopf knopf--leise knopf--klein" href="<?= e(url('statistik/export.xlsx', $query + $extra + ['was' => 'pivot'])) ?>">Excel ↓</a></p>
  <?php } ?>
</div>
<?php } ?>
