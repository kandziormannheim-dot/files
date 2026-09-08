<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('benutzer')) ?>">← Benutzer &amp; Rollen</a><h1 class="h1">Änderungsprotokoll</h1></div>
  <span class="leise"><?= $gesamt ?> Einträge</span>
</header>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer">Noch keine Einträge.</p><?php } else { ?>
  <div class="scrollen">
  <table class="tabelle tabelle--kompakt">
    <thead><tr><th>Zeit</th><th>Wer</th><th>Aktion</th><th>Objekt</th><th>Details</th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $z) { ?>
      <tr>
        <td class="mono leise"><?= e(zeitAnzeigen($z['zeit'])) ?></td>
        <td><?= e($z['benutzer_name']) ?></td>
        <td class="mono"><?= e($z['aktion']) ?></td>
        <td><?= e(trim($z['objekt'] . ' ' . $z['objekt_id'])) ?></td>
        <td class="leise details"><?= e($z['details_json'] === '{}' || $z['details_json'] === '[]' ? '' : $z['details_json']) ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
  <?= blaettern($seite, $gesamt, 100, 'protokoll', []) ?>
  <?php } ?>
</div>
