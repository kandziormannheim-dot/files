<header class="kopfzeile">
  <div><span class="eyebrow">Kunden &amp; Anfragen</span><h1 class="h1"><?= $reiter === 'kunden' ? 'Kunden' : 'Anfragen' ?></h1></div>
  <span class="leise"><?= $gesamt ?> Treffer</span>
</header>
<nav class="reiter" aria-label="Bereich">
  <a href="<?= e(url('kunden')) ?>" class="<?= $reiter === 'anfragen' ? 'aktiv' : '' ?>">Anfragen</a>
  <a href="<?= e(url('kunden', ['reiter' => 'kunden'])) ?>" class="<?= $reiter === 'kunden' ? 'aktiv' : '' ?>">Kunden</a>
</nav>
<form class="werkzeuge" method="get" action="<?= e(url('kunden')) ?>">
  <input type="hidden" name="reiter" value="<?= e($reiter) ?>">
  <input type="search" name="q" value="<?= e($q) ?>" placeholder="<?= $reiter === 'kunden' ? 'E-Mail' : 'Name, E-Mail, Firma' ?>" aria-label="Suche">
  <?php if ($reiter === 'anfragen') { ?>
  <select name="status" aria-label="Status">
    <option value="">Alle Status</option>
    <?php foreach (['neu', 'in_bearbeitung', 'konto_angelegt', 'erledigt'] as $s) { ?><option value="<?= $s ?>" <?= $status === $s ? 'selected' : '' ?>><?= e(anfrageStatusName($s)) ?></option><?php } ?>
  </select>
  <?php } ?>
  <button class="knopf knopf--leise" type="submit">Filtern</button>
</form>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer"><?= $reiter === 'kunden' ? 'Noch keine Kunden mit Bestellungen.' : 'Keine Anfragen — das Kontaktformular der Startseite legt sie hier an.' ?></p><?php } else { ?>
  <div class="scrollen">
  <?php if ($reiter === 'anfragen') { ?>
  <table class="tabelle">
    <thead><tr><th>Status</th><th>Art</th><th>Name</th><th>Firma</th><th>E-Mail</th><th>Volumen</th><th>Bearbeiter</th><th class="rechts">Eingang</th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $z) { ?>
      <tr>
        <td><?= statusPille((string) $z['status'], anfrageStatusName((string) $z['status'])) ?></td>
        <td><?= $z['art'] === 'privat' ? 'Privat' : 'Business' ?></td>
        <td><a href="<?= e(url('kunden/anfragen/' . $z['id'])) ?>"><?= e($z['name']) ?></a></td>
        <td><?= e($z['firma'] ?: '—') ?></td>
        <td><?= e($z['email']) ?></td>
        <td><?= e($z['volumen'] ?: '—') ?></td>
        <td><?= e($z['bearbeiter'] ?? '—') ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($z['erstellt'])) ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  <?php } else { ?>
  <table class="tabelle">
    <thead><tr><th>E-Mail</th><th class="rechts">Bestellungen</th><th class="rechts">bezahlt</th><th class="rechts">Umsatz brutto</th><th>Sprache</th><th class="rechts">Letzte</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $z) { ?>
      <tr>
        <td><?= e($z['email']) ?></td>
        <td class="mono rechts"><?= (int) $z['anzahl'] ?></td>
        <td class="mono rechts"><?= (int) $z['bezahlt'] ?></td>
        <td class="mono rechts"><?= e(euro((int) $z['umsatz'])) ?></td>
        <td><?= e(strtoupper((string) $z['sprache'])) ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($z['letzte'])) ?></td>
        <td class="rechts"><?php if (darf('bestellungen')) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('bestellungen', ['q' => $z['email']])) ?>">Bestellungen</a><?php } ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  <?php } ?>
  </div>
  <?= blaettern($seite, $gesamt, 50, 'kunden', ['reiter' => $reiter, 'q' => $q, 'status' => $status]) ?>
  <?php } ?>
</div>
