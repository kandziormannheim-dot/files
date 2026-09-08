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
  <button class="knopf knopf--leise" type="submit">Filtern</button>
  <?php if ($q !== '' || $status !== '') { ?><a class="knopf knopf--leise" href="<?= e(url('bestellungen')) ?>">Zurücksetzen</a><?php } ?>
</form>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer">Keine Bestellungen gefunden.</p><?php } else { ?>
  <div class="scrollen">
  <table class="tabelle">
    <thead><tr><th>Bestellung</th><th>Status</th><th>Ziel</th><th>Carrier</th><th>Kunde</th><th>Zahlung</th><th class="rechts">Brutto</th><th class="rechts">Angelegt</th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $z) { ?>
      <tr>
        <td><a class="mono" href="<?= e(url('bestellungen/' . $z['ext_ref'])) ?>"><?= e($z['ext_ref']) ?></a></td>
        <td><?= statusPille((string) $z['status']) ?></td>
        <td><span class="flagge"><?= e($z['zielland']) ?></span><?= e($z['gewichtsklasse']) ?></td>
        <td><?= e($z['carrier'] ?? '—') ?></td>
        <td><?= e($z['email']) ?><?= !empty($z['firma']) ? '<br><span class="leise">' . e($z['firma']) . '</span>' : '' ?></td>
        <td><?= $z['zahlungsart'] === 'rechnung' ? 'Rechnung' : 'Revolut' ?></td>
        <td class="mono rechts"><?= e(euro((int) $z['betrag_cent'])) ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($z['erstellt'])) ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
  <?= blaettern($seite, $gesamt, 50, 'bestellungen', ['q' => $q, 'status' => $status]) ?>
  <?php } ?>
</div>
