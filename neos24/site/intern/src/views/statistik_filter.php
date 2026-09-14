<?php /* Filterleiste + Berichtsreiter; erwartet $f, $auswahl, $berichte, $bericht, $ziel (Pfad), $extra (versteckte Felder) */ $extra = $extra ?? []; ?>
<nav class="reiter reiter--statistik" aria-label="Berichte">
  <a href="<?= e(url('statistik', $query)) ?>" class="<?= $bericht === '' ? 'aktiv' : '' ?>">Übersicht</a>
  <?php foreach ($berichte as $schluessel => $name) { ?><a href="<?= e(url('statistik/' . $schluessel, $query)) ?>" class="<?= $bericht === $schluessel ? 'aktiv' : '' ?>"><?= e($name) ?></a><?php } ?>
</nav>
<form method="get" action="<?= e(url($ziel)) ?>" class="werkzeuge statistik-filter">
  <?php foreach ($extra as $k => $v) { ?><input type="hidden" name="<?= e($k) ?>" value="<?= e((string) $v) ?>"><?php } ?>
  <select name="zeitraum" aria-label="Zeitraum" data-zeitraum>
    <?php foreach (STATISTIK_ZEITRAEUME as $k => $name) { ?><option value="<?= e((string) $k) ?>" <?= $f['zeitraum'] === (string) $k ? 'selected' : '' ?>><?= e($name) ?></option><?php } ?>
  </select>
  <span class="statistik-frei" <?= $f['zeitraum'] === 'frei' ? '' : 'hidden' ?>><input type="date" name="von" value="<?= e($f['zeitraum'] === 'frei' ? $f['von'] : '') ?>" aria-label="Von"> <input type="date" name="bis" value="<?= e($f['zeitraum'] === 'frei' ? $f['bis_anzeige'] : '') ?>" aria-label="Bis"></span>
  <select name="firma" aria-label="Kunde">
    <option value="">Alle Kunden</option>
    <?php foreach ($auswahl['firmen'] as $x) { ?><option value="<?= (int) $x['id'] ?>" <?= $f['firma'] === (int) $x['id'] ? 'selected' : '' ?>><?= e($x['name']) ?> (<?= e($x['kundennummer']) ?>)</option><?php } ?>
  </select>
  <?php if ($f['firma'] > 0 && array_filter($auswahl['unterkunden'], static fn (array $u): bool => (int) $u['firma_id'] === $f['firma']) !== []) { ?>
  <select name="unterkunde" aria-label="Unterkunde">
    <option value="">Alle Unterkunden</option>
    <?php foreach ($auswahl['unterkunden'] as $u) { if ((int) $u['firma_id'] !== $f['firma']) { continue; } ?><option value="<?= (int) $u['id'] ?>" <?= $f['unterkunde'] === (int) $u['id'] ? 'selected' : '' ?>><?= e($u['nummer']) ?> <?= e($u['name']) ?></option><?php } ?>
  </select>
  <?php } ?>
  <select name="carrier" aria-label="Carrier">
    <option value="">Alle Carrier</option>
    <?php foreach ($auswahl['carrier'] as $c) { ?><option value="<?= e($c) ?>" <?= $f['carrier'] === $c ? 'selected' : '' ?>><?= e($c) ?></option><?php } ?>
  </select>
  <select name="land" aria-label="Zielland">
    <option value="">Alle Länder</option>
    <?php foreach ($auswahl['laender'] as $l) { ?><option value="<?= e($l) ?>" <?= $f['land'] === $l ? 'selected' : '' ?>><?= e(statistikDimensionName('zielland', $l)) ?></option><?php } ?>
  </select>
  <select name="zahlungsart" aria-label="Zahlungsart">
    <option value="">Alle Zahlungsarten</option>
    <?php foreach (['rechnung' => 'Rechnung', 'guthaben' => 'Guthaben', 'revolut' => 'Revolut'] as $k => $name) { ?><option value="<?= e($k) ?>" <?= $f['zahlungsart'] === $k ? 'selected' : '' ?>><?= e($name) ?></option><?php } ?>
  </select>
  <label class="schalter"><input type="checkbox" name="vergleich" value="1" <?= $f['vergleich'] ? 'checked' : '' ?>> Vorperiode vergleichen</label>
  <button class="knopf knopf--leise" type="submit">Anwenden</button>
  <span class="leise statistik-zeitraum"><?= e(datumAnzeigen($f['von'] . 'T00:00:00Z')) ?> – <?= e(datumAnzeigen($f['bis_anzeige'] . 'T00:00:00Z')) ?> · <?= (int) $f['tage'] ?> Tage<?= $f['vergleich'] ? ' · Vorperiode ' . e(datumAnzeigen($f['vor_von'] . 'T00:00:00Z')) . ' – ' . e(datumAnzeigen(gmdate('Y-m-d', strtotime($f['vor_bis']) - 86400) . 'T00:00:00Z')) : '' ?></span>
</form>
