<?php
$kz = $d['k']; $j = $kz['jetzt']; $delta = $kz['delta'];
$kachel = static function (string $name, string $schluessel, string $farbe, string $zusatz = '') use ($j, $delta, $kz): string {
    $format = STATISTIK_KENNZAHLEN[$schluessel][1] ?? 'anzahl';
    $wert = statistikFormat($j[$schluessel] ?? 0, $format);
    $dv = $delta[$schluessel] ?? null;
    $deltaHtml = '';
    if ($kz['vor'] !== null) {
        $gutWennHoch = !in_array($schluessel, ['einkauf', 'storniert', 'reklamationen', 'reklamationsquote', 'laufzeit', 'nachberechnungen', 'retouren'], true);
        if ($dv === null) {
            $deltaHtml = '<span class="kpi-delta kpi-delta--neutral">neu</span>';
        } else {
            $klasse = $dv == 0.0 ? 'neutral' : (($dv > 0) === $gutWennHoch ? 'gut' : 'schlecht');
            $deltaHtml = '<span class="kpi-delta kpi-delta--' . $klasse . '" title="Vorperiode: ' . e(statistikFormat($kz['vor'][$schluessel] ?? 0, $format)) . '">' . ($dv > 0 ? '▲' : ($dv < 0 ? '▼' : '=')) . ' ' . e(number_format(abs($dv), 1, ',', '.')) . ' %</span>';
        }
    }
    return '<div class="kpi kpi--' . $farbe . '"><span class="kpi-name">' . e($name) . '</span><strong class="kpi-wert">' . e($wert) . '</strong><span class="kpi-zusatz">' . $deltaHtml . ($zusatz !== '' ? ($deltaHtml !== '' ? ' · ' : '') . e($zusatz) : '') . '</span></div>';
};
$zr = $d['zeitreihe'];
$kats = array_column($zr, 'name');
?>
<header class="kopfzeile">
  <div><span class="eyebrow">Statistiken &amp; Berichte</span><h1 class="h1">Übersicht</h1></div>
  <p class="leise">Stand <?= e(zeitAnzeigen(jetzt())) ?> · Basis: bezahlte und beauftragte Bestellungen nach Bestelldatum</p>
</header>
<?php $ziel = 'statistik'; require __DIR__ . '/statistik_filter.php'; ?>

<div class="kpi-raster">
  <?= $kachel('Sendungen', 'sendungen', 'cyan', $j['retouren'] . ' Retouren · ' . $j['storniert'] . ' storniert') ?>
  <?= $kachel('Umsatz netto', 'umsatz', 'gelb', 'brutto ' . statistikFormat($j['brutto'], 'euro')) ?>
  <?= $kachel('Marge', 'marge', 'magenta', statistikFormat($j['marge_prozent'], 'prozent') . ' vom Umsatz') ?>
  <?= $kachel('Ø Netto je Sendung', 'durchschnitt', 'cyan', 'Ø Gewicht ' . statistikFormat($j['gewicht'], 'kg')) ?>
  <?= $kachel('Zustellquote', 'zugestellt_quote', 'gelb', 'Ø Laufzeit ' . statistikFormat($j['laufzeit'], 'tage')) ?>
  <?= $kachel('Nachberechnungen', 'nachberechnungen', 'coral', statistikFormat($j['nachberechnung_summe'], 'euro')) ?>
  <?= $kachel('Reklamationen', 'reklamationen', 'coral', statistikFormat($j['reklamationsquote'], 'prozent') . ' der Sendungen') ?>
  <div class="kpi kpi--cyan"><span class="kpi-name">Aktive Kunden</span><strong class="kpi-wert"><?= (int) $kz['kunden_aktiv'] ?></strong><span class="kpi-zusatz">mit Sendungen im Zeitraum</span></div>
  <div class="kpi <?= (int) $kz['offene_posten']['ueberfaellig'] > 0 ? 'kpi--coral' : 'kpi--gelb' ?>"><span class="kpi-name">Offene Posten</span><strong class="kpi-wert"><?= e(euro((int) $kz['offene_posten']['brutto'])) ?></strong><span class="kpi-zusatz"><?= (int) $kz['offene_posten']['n'] ?> Rechnungen · überfällig <?= e(euro((int) $kz['offene_posten']['ueberfaellig'])) ?></span></div>
</div>

<div class="karte">
  <div class="karte-kopf"><h2 class="h2">Sendungen und Umsatz im Zeitverlauf</h2><span class="leise">je <?= ['tag' => 'Tag', 'woche' => 'Kalenderwoche', 'monat' => 'Monat'][$f['granularitaet']] ?> · <a href="<?= e(url('statistik/zeitverlauf', $query)) ?>">Details</a></span></div>
  <?= svgZeitreihe($kats, [
      ['name' => 'Sendungen', 'werte' => array_column($zr, 'sendungen'), 'format' => 'anzahl', 'art' => 'balken'],
      ['name' => 'Umsatz netto', 'werte' => array_column($zr, 'umsatz'), 'format' => 'euro', 'art' => 'linie', 'achse' => 'rechts', 'farbe' => '#FF5A2C'],
      ['name' => 'Marge', 'werte' => array_column($zr, 'marge'), 'format' => 'euro', 'art' => 'linie', 'achse' => 'rechts', 'farbe' => '#FF3EA5'],
  ]) ?>
</div>

<div class="spalten spalten--3">
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Carrier</h2><a class="leise" href="<?= e(url('statistik/carrier', $query)) ?>">Bericht →</a></div>
    <?= svgQuerbalken(array_map(static fn (array $z): array => ['name' => $z['name'], 'wert' => $z['sendungen']], $d['carrier'])) ?>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Zielländer</h2><a class="leise" href="<?= e(url('statistik/laender', $query)) ?>">Bericht →</a></div>
    <?= svgQuerbalken(array_map(static fn (array $z): array => ['name' => $z['name'], 'wert' => $z['sendungen']], $d['laender'])) ?>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Top-Kunden nach Umsatz</h2><a class="leise" href="<?= e(url('statistik/kunden', $query)) ?>">Bericht →</a></div>
    <?= svgQuerbalken(array_map(static fn (array $z): array => ['name' => $z['name'], 'wert' => $z['umsatz']], $d['kunden']), 'euro') ?>
  </div>
</div>

<div class="spalten spalten--3">
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Zahlungsarten</h2><a class="leise" href="<?= e(url('statistik/finanzen', $query)) ?>">Finanzen →</a></div>
    <?= svgRing(array_map(static fn (array $z): array => ['name' => $z['name'], 'wert' => $z['umsatz']], $d['zahlungsarten']), 'euro') ?>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2 class="h2">Versandstatus</h2><span class="leise">Sendungen im Zeitraum</span></div>
    <?= svgRing(array_map(static fn (array $z): array => ['name' => $z['name'], 'wert' => $z['sendungen']], array_values(array_filter($d['status'], static fn (array $z): bool => $z['sendungen'] > 0)))) ?>
  </div>
  <div class="karte karte--ink">
    <div class="karte-kopf"><h2 class="h2">Berichte</h2></div>
    <ul class="checklist">
      <?php foreach ($berichte as $schluessel => $name) { ?><li><a href="<?= e(url('statistik/' . $schluessel, $query)) ?>"><?= e($name) ?></a><?= $schluessel === 'pivot' ? ' <span class="leise">— Dimension × Kennzahl frei kombinieren, speichern, exportieren</span>' : '' ?></li><?php } ?>
    </ul>
    <p class="leise" style="margin-top:1rem">Jede Tabelle lässt sich als CSV oder Excel exportieren. Filter gelten für alle Berichte.</p>
  </div>
</div>
