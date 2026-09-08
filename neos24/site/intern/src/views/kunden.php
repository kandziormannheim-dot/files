<?php $darfB = darf('kunden', 'bearbeiten'); ?>
<header class="kopfzeile">
  <div><span class="eyebrow">Kunden &amp; Anfragen</span><h1 class="h1"><?= ['anfragen' => 'Anfragen', 'firmen' => 'Firmen', 'privatkunden' => 'Privatkunden'][$reiter] ?></h1></div>
  <div class="kopf-aktionen"><span class="leise"><?= $gesamt ?> Treffer</span><?php if ($darfB && $reiter === 'firmen') { ?><a class="knopf knopf--primaer" href="<?= e(url('kunden/firmen/neu')) ?>">Firmenkonto anlegen</a><?php } ?></div>
</header>
<nav class="reiter" aria-label="Bereich">
  <a href="<?= e(url('kunden')) ?>" class="<?= $reiter === 'anfragen' ? 'aktiv' : '' ?>">Anfragen</a>
  <a href="<?= e(url('kunden', ['reiter' => 'firmen'])) ?>" class="<?= $reiter === 'firmen' ? 'aktiv' : '' ?>">Firmen</a>
  <a href="<?= e(url('kunden', ['reiter' => 'privatkunden'])) ?>" class="<?= $reiter === 'privatkunden' ? 'aktiv' : '' ?>">Privatkunden</a>
</nav>
<form class="werkzeuge" method="get" action="<?= e(url('kunden')) ?>">
  <input type="hidden" name="reiter" value="<?= e($reiter) ?>">
  <input type="search" name="q" value="<?= e($q) ?>" placeholder="<?= ['anfragen' => 'Name, E-Mail, Firma', 'firmen' => 'Firma, Ort, E-Mail', 'privatkunden' => 'Name, E-Mail'][$reiter] ?>" aria-label="Suche">
  <?php if ($reiter === 'anfragen') { ?>
  <select name="status" aria-label="Status">
    <option value="">Alle Status</option>
    <?php foreach (['neu', 'in_bearbeitung', 'konto_angelegt', 'erledigt'] as $s) { ?><option value="<?= $s ?>" <?= $status === $s ? 'selected' : '' ?>><?= e(anfrageStatusName($s)) ?></option><?php } ?>
  </select>
  <?php } ?>
  <button class="knopf knopf--leise" type="submit">Filtern</button>
</form>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer"><?= ['anfragen' => 'Keine Anfragen — das Kontaktformular der Startseite legt sie hier an.', 'firmen' => 'Noch keine Firmenkonten. Aus einer Anfrage oder über „Firmenkonto anlegen“.', 'privatkunden' => 'Noch keine registrierten Privatkunden.'][$reiter] ?></p><?php } else { ?>
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
        <td><?= e($z['firma'] ?: '—') ?><?= !empty($z['firma_id']) ? ' <a class="leise" href="' . e(url('kunden/firmen/' . $z['firma_id'])) . '">→ Konto</a>' : '' ?></td>
        <td><?= e($z['email']) ?></td>
        <td><?= e($z['volumen'] ?: '—') ?></td>
        <td><?= e($z['bearbeiter'] ?? '—') ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($z['erstellt'])) ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  <?php } elseif ($reiter === 'firmen') { ?>
  <table class="tabelle">
    <thead><tr><th>Firma</th><th>Ort</th><th>Rechnungs-E-Mail</th><th class="rechts">Benutzer</th><th class="rechts">Sendungen</th><th class="rechts">Offene Rechnungen</th><th>Aktiv</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $f) { ?>
      <tr class="<?= (int) $f['aktiv'] === 1 ? '' : 'inaktiv' ?>">
        <td><a href="<?= e(url('kunden/firmen/' . $f['id'])) ?>"><?= e($f['name']) ?></a></td>
        <td><?= e(trim($f['plz'] . ' ' . $f['ort'])) ?></td>
        <td><?= e($f['rechnungs_email'] ?: '—') ?></td>
        <td class="mono rechts"><?= (int) $f['benutzer'] ?></td>
        <td class="mono rechts"><?= (int) $f['sendungen'] ?></td>
        <td class="mono rechts"><?= (int) $f['offene_rechnungen'] ?></td>
        <td><?= (int) $f['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
        <td class="rechts"><a class="knopf knopf--leise knopf--klein" href="<?= e(url('kunden/firmen/' . $f['id'])) ?>">Öffnen</a></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  <?php } else { ?>
  <table class="tabelle">
    <thead><tr><th>Name</th><th>E-Mail</th><th>Bestätigt</th><th>Passwort</th><th class="rechts">Bestellungen</th><th class="rechts">Umsatz brutto</th><th class="rechts">Letzte Anmeldung</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $k) { ?>
      <tr class="<?= (int) $k['aktiv'] === 1 ? '' : 'inaktiv' ?>">
        <td><?= e($k['name']) ?><?= (int) $k['aktiv'] === 1 ? '' : ' <span class="pille pille--warn">geschlossen</span>' ?></td>
        <td><?= e($k['email']) ?></td>
        <td><?= (int) $k['email_bestaetigt'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
        <td><?= $k['passwort_hash'] !== null ? '<span class="ja">✓</span>' : '<span class="leise">Link</span>' ?></td>
        <td class="mono rechts"><?= (int) $k['bestellungen'] ?></td>
        <td class="mono rechts"><?= e(euro((int) $k['umsatz'])) ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($k['letzte_anmeldung'])) ?></td>
        <td class="rechts"><?php if (darf('bestellungen')) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('bestellungen', ['q' => $k['email']])) ?>">Bestellungen</a><?php } ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  <?php } ?>
  </div>
  <?php if ($reiter !== 'firmen') { ?><?= blaettern($seite, $gesamt, 50, 'kunden', ['reiter' => $reiter, 'q' => $q, 'status' => $status]) ?><?php } ?>
  <?php } ?>
</div>
