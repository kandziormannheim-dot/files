<?php $darfB = darf('rechnungspruefung', 'bearbeiten'); ?>
<header class="kopfzeile">
  <div><span class="eyebrow">Rechnungsprüfung</span><h1 class="h1">Lieferantenrechnungen</h1></div>
  <p class="leise">CSV der Carrier-Rechnung einlesen, jede Sendung gegen Bestellung und Routingmatrix prüfen, Gewichtsdifferenzen an Kunden nachberechnen, Abweichungen beim Lieferanten beanstanden.</p>
</header>
<div class="spalten spalten--2-1">
  <div class="karte karte--tabelle">
    <form class="werkzeuge" method="get" action="<?= e(url('rechnungspruefung')) ?>">
      <select name="status" aria-label="Status"><option value="">Alle Status</option><?php foreach (RP_STATUS as $code => $n) { ?><option value="<?= e($code) ?>" <?= $status === $code ? 'selected' : '' ?>><?= e($n) ?></option><?php } ?></select>
      <button class="knopf knopf--leise" type="submit">Filtern</button>
    </form>
    <?php if ($zeilen === []) { ?><p class="leer">Noch keine Lieferantenrechnung hochgeladen.</p><?php } else { ?>
    <div class="scrollen"><table class="tabelle">
      <thead><tr><th>Rechnung</th><th>Carrier</th><th>Status</th><th class="rechts">Positionen</th><th class="rechts">Summe CSV</th><th class="rechts">Laut PDF</th><th class="rechts">Auffällig</th><th class="rechts">Nachberechnung offen</th><th class="rechts">Hochgeladen</th></tr></thead>
      <tbody>
      <?php foreach ($zeilen as $z) { ?>
        <tr>
          <td><a class="mono" href="<?= e(url('rechnungspruefung/' . $z['id'])) ?>"><?= e($z['nummer'] ?: '#' . $z['id']) ?></a><?= $z['datum'] !== '' ? '<br><span class="leise">' . e(datumLesbar($z['datum'])) . '</span>' : '' ?></td>
          <td><?= e($z['carrier'] ?? '—') ?></td>
          <td><span class="status status--lr-<?= e($z['status']) ?>"><?= e(RP_STATUS[$z['status']] ?? $z['status']) ?></span></td>
          <td class="mono rechts"><?= (int) $z['positionen'] ?></td>
          <td class="mono rechts"><?= e(euro((int) $z['summe_cent'])) ?></td>
          <td class="mono rechts <?= (int) $z['betrag_netto_cent'] > 0 && abs((int) $z['betrag_netto_cent'] - (int) $z['summe_cent']) > rpToleranzCent() ? 'ueberfaellig' : '' ?>"><?= (int) $z['betrag_netto_cent'] > 0 ? e(euro((int) $z['betrag_netto_cent'])) : '—' ?></td>
          <td class="mono rechts"><?= (int) $z['auffaellig'] > 0 ? '<strong>' . (int) $z['auffaellig'] . '</strong>' : '0' ?></td>
          <td class="mono rechts"><?= (int) $z['nachberechnung_offen'] > 0 ? e(euro((int) $z['nachberechnung_offen'])) : '—' ?></td>
          <td class="mono rechts leise"><?= e(zeitAnzeigen($z['erstellt'])) ?><br><?= e($z['hochgeladen_von']) ?></td>
        </tr>
      <?php } ?>
      </tbody>
    </table></div>
    <?php } ?>
  </div>
  <?php if ($darfB) { ?>
  <div class="karte">
    <h2 class="h2">Rechnung hochladen</h2>
    <form method="post" action="<?= e(url('rechnungspruefung')) ?>" enctype="multipart/form-data" class="formular">
      <?= csrfFeld() ?>
      <div class="feld"><label for="lr-carrier">Carrier (Rechnungssteller)</label><select id="lr-carrier" name="carrier_id" required><option value="">— wählen —</option><?php foreach ($carrier as $c) { ?><option value="<?= (int) $c['id'] ?>"><?= e($c['name']) ?></option><?php } ?></select></div>
      <div class="feld"><label for="lr-csv">CSV mit den Sendungen (Pflicht)</label><input id="lr-csv" name="csv" type="file" accept=".csv,.txt,text/csv,text/plain" required></div>
      <div class="feld"><label for="lr-pdf">Rechnung als PDF (Beleg, Kopfdaten werden gelesen)</label><input id="lr-pdf" name="pdf" type="file" accept=".pdf,application/pdf"></div>
      <details>
        <summary class="leise">Kopfdaten von Hand (sonst aus dem PDF)</summary>
        <div class="feld" style="margin-top:.6rem"><label for="lr-nummer">Rechnungsnummer</label><input id="lr-nummer" name="nummer" maxlength="40"></div>
        <div class="spalten spalten--2"><div class="feld"><label for="lr-datum">Datum</label><input id="lr-datum" name="datum" type="date"></div><div class="feld"><label for="lr-netto">Summe netto €</label><input id="lr-netto" name="netto" inputmode="decimal" placeholder="1234,56"></div></div>
      </details>
      <button class="knopf knopf--primaer" type="submit">Hochladen und Spalten zuordnen</button>
    </form>
    <p class="leise" style="margin-top:.75rem">Erwartet wird je Zeile eine Sendung mit unserer Nummer (NE-…) oder der Carrier-Sendungsnummer, dem berechneten Gewicht und dem Nettobetrag. Trennzeichen und Spalten werden erkannt; die Zuordnung wird je Carrier gemerkt. Toleranz beim Einkaufspreis: <?= e(euro(rpToleranzCent())) ?>.</p>
  </div>
  <?php } ?>
</div>
