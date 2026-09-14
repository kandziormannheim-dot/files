<header class="kopfzeile">
  <div><span class="eyebrow">Rechnungen</span><h1 class="h1">Sammelrechnungen</h1></div>
  <p class="leise">Erzeugt werden Rechnungen je Firma und Monat unter Kunden &amp; Anfragen → Firmen. <?= $lexware ? 'Lexware Office vergibt die Nummern und erzeugt die PDFs; Privatkunden-Bestellungen und Nachberechnungen gehen ebenfalls als Rechnung an Lexware.' : 'PDFs liegen im Datenverzeichnis unter <code>rechnungen/</code>. Lexware ist nicht konfiguriert.' ?></p>
</header>
<form class="werkzeuge" method="get" action="<?= e(url('rechnungen')) ?>">
  <select name="status" aria-label="Status"><option value="">Alle Status</option><?php foreach (['offen', 'bezahlt', 'storniert'] as $s) { ?><option value="<?= $s ?>" <?= $status === $s ? 'selected' : '' ?>><?= e(rechnungStatusName($s)) ?></option><?php } ?></select>
  <button class="knopf knopf--leise" type="submit">Filtern</button>
  <?php if ($lexware && darf('rechnungen', 'bearbeiten')) { ?>
    <span style="flex:1"></span>
    <button class="knopf knopf--leise" type="submit" form="lx-abgleich">Zahlungsstatus aus Lexware holen</button>
    <button class="knopf knopf--leise" type="submit" form="lx-nachholen">Warteschlange nachholen</button>
  <?php } ?>
</form>
<?php if ($lexware && darf('rechnungen', 'bearbeiten')) { ?>
<form id="lx-abgleich" method="post" action="<?= e(url('rechnungen/lexware')) ?>" hidden><?= csrfFeld() ?><input type="hidden" name="was" value="abgleich"></form>
<form id="lx-nachholen" method="post" action="<?= e(url('rechnungen/lexware')) ?>" hidden><?= csrfFeld() ?><input type="hidden" name="was" value="nachholen"></form>
<?php } ?>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer">Noch keine Rechnungen.</p><?php } else { ?>
  <div class="scrollen"><table class="tabelle">
    <thead><tr><th>Nummer</th><th>Status</th><th>Firma</th><th>Zeitraum</th><th class="rechts">Sendungen</th><th class="rechts">Netto</th><th class="rechts">Brutto</th><th>Fällig</th><?php if ($lexware) { ?><th>Lexware</th><?php } ?><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $r) { $entwurf = str_starts_with((string) $r['nummer'], 'ENTWURF-'); ?>
      <tr>
        <td><a class="mono" href="<?= e(url('rechnungen/' . $r['id'])) ?>"><?= $entwurf ? '<span class="leise">wird erstellt</span>' : e($r['nummer']) ?></a></td>
        <td><?= statusPille((string) $r['status'], rechnungStatusName((string) $r['status'])) ?></td>
        <td><a href="<?= e(url('kunden/firmen/' . $r['firma_id'])) ?>"><?= e($r['firma']) ?></a><?= $r['unterkunde_id'] ? '<br><a class="leise" href="' . e(url('kunden/unterkunden/' . $r['unterkunde_id'])) . '">↳ ' . e($r['unterkunde']) . '</a>' : '' ?><br><span class="mono leise"><?= e($r['kundennummer']) ?></span></td>
        <td><?= e(datumAnzeigen($r['zeitraum_von'])) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1))) ?></td>
        <td class="mono rechts"><?= (int) $r['positionen'] ?></td>
        <td class="mono rechts"><?= e(euro((int) $r['netto_cent'])) ?></td>
        <td class="mono rechts"><strong><?= e(euro((int) $r['brutto_cent'])) ?></strong></td>
        <td class="<?= $r['status'] === 'offen' && $r['faellig'] < gmdate('Y-m-d') ? 'ueberfaellig' : '' ?>"><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z')) ?></td>
        <?php if ($lexware) { ?><td><?= $r['lexware_id'] !== '' ? '<span class="ja">✓</span> <span class="leise">' . e($r['lexware_status'] ?: 'übergeben') . '</span>' : '<span class="status status--lr-zuordnung">ausstehend</span>' ?></td><?php } ?>
        <td class="rechts"><?php if (!$entwurf || $r['lexware_id'] !== '') { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('rechnungen/' . $r['id'] . '.pdf')) ?>" target="_blank" rel="noopener">PDF</a><?php } ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php } ?>
</div>
<?php if ($lexware && $auftraege !== []) { ?>
<div class="karte karte--tabelle">
  <div class="karte-kopf"><h2 class="h2">Lexware-Warteschlange</h2><span class="leise">offene und fehlgeschlagene Übergaben · Cron: php intern/aufgaben.php lexware</span></div>
  <div class="scrollen"><table class="tabelle tabelle--kompakt">
    <thead><tr><th>#</th><th>Art</th><th>Bezug</th><th>Status</th><th class="rechts">Versuche</th><th>Fehler</th><th class="rechts">Angelegt</th></tr></thead>
    <tbody>
    <?php foreach ($auftraege as $a) { ?>
      <tr class="<?= $a['status'] === 'fehler' ? 'lr-fehler' : '' ?>"><td class="mono leise"><?= (int) $a['id'] ?></td><td><?= e($a['art']) ?></td><td class="mono"><?= e($a['bezug_tabelle']) ?> #<?= (int) $a['bezug_id'] ?></td><td><span class="status status--lr-<?= $a['status'] === 'fehler' ? 'beanstandet' : 'zuordnung' ?>"><?= e($a['status']) ?></span></td><td class="mono rechts"><?= (int) $a['versuche'] ?></td><td class="leise"><?= e(mb_substr((string) $a['fehler_text'], 0, 160)) ?></td><td class="mono rechts leise"><?= e(zeitAnzeigen($a['erstellt'])) ?></td></tr>
    <?php } ?>
    </tbody>
  </table></div>
</div>
<?php } ?>
