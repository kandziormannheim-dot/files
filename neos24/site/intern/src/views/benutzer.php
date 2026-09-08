<?php $darfB = darf('benutzer', 'bearbeiten'); ?>
<header class="kopfzeile">
  <div><span class="eyebrow">Benutzer &amp; Rollen</span><h1 class="h1">Benutzer</h1></div>
  <div class="kopf-aktionen">
    <?php if ($darfB) { ?><a class="knopf knopf--leise" href="<?= e(url('rollen/neu')) ?>">Neue Rolle</a><a class="knopf knopf--primaer" href="<?= e(url('benutzer/neu')) ?>">Neuer Benutzer</a><?php } ?>
  </div>
</header>
<div class="karte karte--tabelle">
  <div class="scrollen">
  <table class="tabelle">
    <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Aktiv</th><th class="rechts">Letzte Anmeldung</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $b) { ?>
      <tr class="<?= (int) $b['aktiv'] === 1 ? '' : 'inaktiv' ?>">
        <td><a href="<?= e(url('benutzer/' . $b['id'])) ?>"><?= e($b['name']) ?></a><?= (int) $b['muss_passwort_aendern'] === 1 ? ' <span class="pille">Startpasswort</span>' : '' ?><?= $b['gesperrt_bis'] !== null && $b['gesperrt_bis'] > jetzt() ? ' <span class="pille pille--warn">gesperrt</span>' : '' ?></td>
        <td><?= e($b['email']) ?></td>
        <td><?= e($b['rolle']) ?><?= (int) $b['system'] === 1 ? ' <span class="pille">System</span>' : '' ?></td>
        <td><?= (int) $b['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($b['letzte_anmeldung'])) ?></td>
        <td class="rechts"><a class="knopf knopf--leise knopf--klein" href="<?= e(url('benutzer/' . $b['id'])) ?>"><?= $darfB ? 'Bearbeiten' : 'Ansehen' ?></a></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
</div>

<h2 class="h2" style="margin:2rem 0 1rem">Rollen &amp; Rechte</h2>
<div class="karte karte--tabelle">
  <div class="scrollen">
  <table class="tabelle rechtematrix">
    <thead><tr><th>Rolle</th><th class="rechts">Benutzer</th><?php foreach (MODULE as $name) { ?><th class="mitte"><?= e($name) ?></th><?php } ?><th></th></tr></thead>
    <tbody>
    <?php foreach ($rollen as $r) { $m = rechteDerRolle((int) $r['id']); ?>
      <tr>
        <td><a href="<?= e(url('rollen/' . $r['id'])) ?>"><?= e($r['name']) ?></a><?= (int) $r['system'] === 1 ? ' <span class="pille">System</span>' : '' ?><?= $r['beschreibung'] !== '' ? '<br><span class="leise">' . e($r['beschreibung']) . '</span>' : '' ?></td>
        <td class="mono rechts"><?= (int) $r['benutzer'] ?></td>
        <?php foreach (MODULE as $modul => $_) { $x = $m[$modul]; ?>
          <td class="mitte rechte-zelle" title="<?= e(($x['sehen'] ? 'sehen ' : '') . ($x['bearbeiten'] ? 'bearbeiten ' : '') . ($x['loeschen'] ? 'löschen' : '')) ?>">
            <span class="<?= $x['sehen'] ? 'ja' : 'nein' ?>" aria-label="sehen">S</span><span class="<?= $x['bearbeiten'] ? 'ja' : 'nein' ?>" aria-label="bearbeiten">B</span><span class="<?= $x['loeschen'] ? 'ja' : 'nein' ?>" aria-label="löschen">L</span>
          </td>
        <?php } ?>
        <td class="rechts"><a class="knopf knopf--leise knopf--klein" href="<?= e(url('rollen/' . $r['id'])) ?>"><?= (int) $r['system'] === 1 || !$darfB ? 'Ansehen' : 'Bearbeiten' ?></a></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
  <p class="leise" style="margin-top:.75rem">S = sehen, B = bearbeiten, L = löschen. <a href="<?= e(url('protokoll')) ?>">Änderungsprotokoll</a></p>
</div>
