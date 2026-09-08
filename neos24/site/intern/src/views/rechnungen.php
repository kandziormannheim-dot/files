<header class="kopfzeile">
  <div><span class="eyebrow">Rechnungen</span><h1 class="h1">Sammelrechnungen</h1></div>
  <p class="leise">Erzeugt werden Rechnungen je Firma und Monat unter Kunden &amp; Anfragen → Firmen. PDFs liegen im Datenverzeichnis unter <code>rechnungen/</code>.</p>
</header>
<form class="werkzeuge" method="get" action="<?= e(url('rechnungen')) ?>">
  <select name="status" aria-label="Status"><option value="">Alle Status</option><?php foreach (['offen', 'bezahlt', 'storniert'] as $s) { ?><option value="<?= $s ?>" <?= $status === $s ? 'selected' : '' ?>><?= e(rechnungStatusName($s)) ?></option><?php } ?></select>
  <button class="knopf knopf--leise" type="submit">Filtern</button>
</form>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer">Noch keine Rechnungen.</p><?php } else { ?>
  <div class="scrollen"><table class="tabelle">
    <thead><tr><th>Nummer</th><th>Status</th><th>Firma</th><th>Zeitraum</th><th class="rechts">Sendungen</th><th class="rechts">Netto</th><th class="rechts">Brutto</th><th>Fällig</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $r) { ?>
      <tr>
        <td><a class="mono" href="<?= e(url('rechnungen/' . $r['id'])) ?>"><?= e($r['nummer']) ?></a></td>
        <td><?= statusPille((string) $r['status'], rechnungStatusName((string) $r['status'])) ?></td>
        <td><a href="<?= e(url('kunden/firmen/' . $r['firma_id'])) ?>"><?= e($r['firma']) ?></a></td>
        <td><?= e(datumAnzeigen($r['zeitraum_von'])) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1))) ?></td>
        <td class="mono rechts"><?= (int) $r['positionen'] ?></td>
        <td class="mono rechts"><?= e(euro((int) $r['netto_cent'])) ?></td>
        <td class="mono rechts"><strong><?= e(euro((int) $r['brutto_cent'])) ?></strong></td>
        <td class="<?= $r['status'] === 'offen' && $r['faellig'] < gmdate('Y-m-d') ? 'ueberfaellig' : '' ?>"><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z')) ?></td>
        <td class="rechts"><a class="knopf knopf--leise knopf--klein" href="<?= e(url('rechnungen/' . $r['id'] . '.pdf')) ?>" target="_blank" rel="noopener">PDF</a></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
