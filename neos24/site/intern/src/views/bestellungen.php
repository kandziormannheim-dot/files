<header class="kopfzeile">
  <div><span class="eyebrow">Bestellungen &amp; Sendungen</span><h1 class="h1">Bestellungen</h1></div>
  <span class="leise"><?= $gesamt ?> Treffer</span>
</header>
<form class="werkzeuge" method="get" action="<?= e(url('bestellungen')) ?>">
  <input type="search" name="q" value="<?= e($q) ?>" placeholder="Bestellnummer, E-Mail, Land, Revolut-ID" aria-label="Suche">
  <select name="status" aria-label="Status">
    <option value="">Alle Status</option>
    <?php foreach (['offen', 'angelegt', 'autorisiert', 'bezahlt', 'beauftragt', 'fehlgeschlagen', 'storniert'] as $s) { ?>
      <option value="<?= $s ?>" <?= $status === $s ? 'selected' : '' ?>><?= e(statusName($s)) ?></option>
    <?php } ?>
  </select>
  <select name="versand" aria-label="Versandstatus">
    <option value="">Alle Versandstatus</option>
    <?php foreach (VERSANDSTATUS as $code => $n) { ?><option value="<?= e($code) ?>" <?= $versand === $code ? 'selected' : '' ?>><?= e($n['de']) ?></option><?php } ?>
  </select>
  <label class="schalter"><input type="checkbox" name="abholung" value="1" <?= $abholung ? 'checked' : '' ?>> nur Abholungen</label>
  <button class="knopf knopf--leise" type="submit">Filtern</button>
  <?php if ($q !== '' || $status !== '' || $versand !== '' || $abholung) { ?><a class="knopf knopf--leise" href="<?= e(url('bestellungen')) ?>">Zurücksetzen</a><?php } ?>
</form>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer">Keine Bestellungen gefunden.</p><?php } else { ?>
  <div class="scrollen">
  <table class="tabelle">
    <thead><tr><th>Bestellung</th><th>Status</th><th>Versand</th><th>Ziel</th><th>Carrier</th><th>Kunde</th><th>Zahlung</th><th class="rechts">Brutto</th><th class="rechts">Angelegt</th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $z) { $ab = json_decode((string) ($z['abholung_json'] ?? '{}'), true) ?: []; ?>
      <tr>
        <td><a class="mono" href="<?= e(url('bestellungen/' . $z['ext_ref'])) ?>"><?= e($z['ext_ref']) ?></a><?= $z['art'] === 'retoure' ? ' <span class="pille">Retoure</span>' : '' ?><?= $z['referenz'] !== '' ? '<br><span class="leise">' . e($z['referenz']) . '</span>' : '' ?></td>
        <td><?= statusPille((string) $z['status']) ?></td>
        <td><span class="status status--vs-<?= e($z['versandstatus']) ?>"><?= e(versandstatusName((string) $z['versandstatus'])) ?></span><?= !empty($ab['datum']) ? '<br><span class="leise">Abholung ' . e(datumLesbar($ab['datum'])) . ', ' . e(str_replace('-', '–', $ab['fenster'] ?? '')) . ' Uhr</span>' : '' ?></td>
        <td><span class="flagge"><?= e($z['zielland']) ?></span><?= e($z['gewichtsklasse']) ?></td>
        <td><?= e($z['carrier'] ?? '—') ?></td>
        <td><?= e($z['email']) ?><?= !empty($z['firma']) ? '<br><span class="leise">' . e($z['firma']) . '</span>' : '' ?></td>
        <td><?= ['rechnung' => 'Rechnung', 'guthaben' => 'Guthaben'][$z['zahlungsart']] ?? 'Revolut' ?></td>
        <td class="mono rechts"><?= e(euro((int) $z['betrag_cent'])) ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($z['erstellt'])) ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
  <?= blaettern($seite, $gesamt, 50, 'bestellungen', ['q' => $q, 'status' => $status, 'versand' => $versand, 'abholung' => $abholung ? '1' : '']) ?>
  <?php } ?>
</div>
