<?php
$darfB = darf('sync', 'bearbeiten');
$systeme = $status['systeme'];
$name = static fn (string $s): string => ['lexware' => 'Lexware Office', 'odoo' => 'Odoo'][$s] ?? $s;
$bezug = static fn (array $a): string => ['firmen' => 'kunden/firmen/', 'unterkunden' => 'kunden/unterkunden/', 'kunden' => 'kunden/privat/', 'rechnungen' => 'rechnungen/'][$a['bezug_tabelle']] ?? '';
?>
<header class="kopfzeile">
  <div><span class="eyebrow">Synchronisation</span><h1 class="h1">Lexware Office &amp; Odoo</h1></div>
  <p class="leise">Kundennummern und Stammdaten gehen in beide Richtungen: Änderungen in der Plattform laufen sofort und per Cron (<code>php intern/aufgaben.php sync</code>) in die Systeme; Änderungen dort werden zurückgeholt — die jüngere Änderung gewinnt, Konflikte stehen unten.</p>
</header>
<div class="kpi-raster">
  <div class="kpi <?= $systeme === [] ? 'kpi--coral' : 'kpi--cyan' ?>"><span class="kpi-name">Aktive Systeme</span><strong class="kpi-wert"><?= count($systeme) ?></strong><span class="kpi-zusatz"><?= $systeme === [] ? 'keins — lexware.aktiv / odoo.aktiv in der Konfiguration' : e(implode(' · ', array_map($name, $systeme))) ?></span></div>
  <div class="kpi <?= (int) $status['fehler'] > 0 ? 'kpi--coral' : 'kpi--gelb' ?>"><span class="kpi-name">Warteschlange</span><strong class="kpi-wert"><?= (int) $status['fehler'] ?></strong><span class="kpi-zusatz">fehlgeschlagen · <?= (int) $status['offen'] ?> offen</span></div>
  <div class="kpi <?= (int) $status['konflikte'] > 0 ? 'kpi--coral' : 'kpi--magenta' ?>"><span class="kpi-name">Offene Konflikte</span><strong class="kpi-wert"><?= (int) $status['konflikte'] ?></strong><span class="kpi-zusatz">beide Seiten geändert · jüngere gewann</span></div>
  <div class="kpi kpi--cyan"><span class="kpi-name">Letzte Rückholung</span><strong class="kpi-wert" style="font-size:1.1rem"><?= $status['abgeholt'] ? e(zeitAnzeigen($status['abgeholt'])) : '—' ?></strong><span class="kpi-zusatz">höchstens alle <?= (int) konfig()['sync']['abholenMinuten'] ?> Minuten, per Cron</span></div>
</div>
<?php if ($darfB) { ?>
<div class="werkzeuge" style="margin-bottom:1rem">
  <form method="post" action="<?= e(url('sync/nachholen')) ?>"><?= csrfFeld() ?><button class="knopf knopf--leise" type="submit">Warteschlange nachholen</button></form>
  <form method="post" action="<?= e(url('sync/abholen')) ?>"><?= csrfFeld() ?><button class="knopf knopf--leise" type="submit">Jetzt aus den Systemen holen</button></form>
  <form method="post" action="<?= e(url('sync/alle')) ?>" data-bestaetigen="Alle Firmen, Unterkunden und Kunden erneut an Lexware und Odoo übergeben?"><?= csrfFeld() ?><button class="knopf knopf--leise" type="submit">Alle Kunden neu übergeben</button></form>
</div>
<?php } ?>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Warteschlange</h2><span class="leise">offen und fehlgeschlagen</span></div>
      <?php if ($auftraege === []) { ?><p class="leer">Alles übergeben.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>#</th><th>System</th><th>Art</th><th>Bezug</th><th>Status</th><th class="rechts">Versuche</th><th>Fehler</th><th class="rechts">Angelegt</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($auftraege as $a) { ?>
          <tr class="<?= $a['status'] === 'fehler' ? 'lr-fehler' : '' ?>">
            <td class="mono leise"><?= (int) $a['id'] ?></td><td><?= e($name($a['system'])) ?></td><td><?= e($a['art']) ?></td>
            <td class="mono"><?php if ($bezug($a) !== '') { ?><a href="<?= e(url($bezug($a) . $a['bezug_id'])) ?>"><?= e($a['bezug_tabelle']) ?> #<?= (int) $a['bezug_id'] ?></a><?php } else { ?><?= e($a['bezug_tabelle']) ?> #<?= (int) $a['bezug_id'] ?><?php } ?></td>
            <td><span class="status status--lr-<?= $a['status'] === 'fehler' ? 'beanstandet' : 'zuordnung' ?>"><?= e($a['status']) ?></span></td>
            <td class="mono rechts"><?= (int) $a['versuche'] ?></td><td class="leise"><?= e(mb_substr((string) $a['fehler_text'], 0, 160)) ?></td><td class="mono rechts leise"><?= e(zeitAnzeigen($a['erstellt'])) ?></td>
            <td class="rechts"><?php if ($darfB) { ?><form method="post" action="<?= e(url('sync/auftrag')) ?>"><?= csrfFeld() ?><input type="hidden" name="id" value="<?= (int) $a['id'] ?>"><button class="knopf knopf--leise knopf--klein" type="submit">Erneut</button></form><?php } ?></td>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Konflikte</h2><span class="leise">beide Seiten seit dem letzten Abgleich geändert</span></div>
      <?php if ($konflikte === []) { ?><p class="leer">Keine Konflikte.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Zeit</th><th>System</th><th>Datensatz</th><th>Feld</th><th>Plattform</th><th>System</th><th>Gewonnen</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($konflikte as $k) { ?>
          <tr class="<?= (int) $k['erledigt'] === 1 ? 'inaktiv' : '' ?>">
            <td class="mono leise"><?= e(zeitAnzeigen($k['zeit'])) ?></td><td><?= e($name($k['system'])) ?></td>
            <td><a href="<?= e(url($bezug($k) . $k['bezug_id'])) ?>"><?= e($k['bezug_name'] ?? '') ?></a> <span class="mono leise"><?= e($k['bezug_nummer'] ?? '') ?></span></td>
            <td class="mono"><?= e($k['feld']) ?></td><td><?= e($k['lokal']) ?></td><td><?= e($k['entfernt']) ?></td>
            <td><span class="pille"><?= $k['gewonnen'] === 'plattform' ? 'Plattform' : e($name($k['gewonnen'])) ?></span></td>
            <td class="rechts"><?php if ($darfB && (int) $k['erledigt'] === 0) { ?><form method="post" action="<?= e(url('sync/konflikt')) ?>"><?= csrfFeld() ?><input type="hidden" name="id" value="<?= (int) $k['id'] ?>"><button class="knopf knopf--leise knopf--klein" type="submit">Erledigt</button></form><?php } elseif ((int) $k['erledigt'] === 1) { ?><span class="leise">erledigt</span><?php } ?></td>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
    </div>
    <?php if ($erledigt !== []) { ?>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Zuletzt erledigt</h2></div>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <tbody>
        <?php foreach ($erledigt as $a) { ?>
          <tr><td class="mono leise"><?= e(zeitAnzeigen($a['erledigt'])) ?></td><td><?= e($name($a['system'])) ?></td><td><?= e($a['art']) ?></td><td class="mono"><?php if ($bezug($a) !== '') { ?><a href="<?= e(url($bezug($a) . $a['bezug_id'])) ?>"><?= e($a['bezug_tabelle']) ?> #<?= (int) $a['bezug_id'] ?></a><?php } else { ?><?= e($a['bezug_tabelle']) ?> #<?= (int) $a['bezug_id'] ?><?php } ?></td></tr>
        <?php } ?>
        </tbody>
      </table></div>
    </div>
    <?php } ?>
  </div>
  <div>
    <div class="karte karte--ink">
      <h2 class="h2">Stand</h2>
      <div class="scrollen"><table class="tabelle tabelle--kompakt" style="color:inherit">
        <thead><tr><th>Datensätze</th><th class="rechts">gesamt</th><th class="rechts">Odoo</th><th class="rechts">Lexware</th></tr></thead>
        <tbody>
        <?php foreach (['firmen' => 'Firmen', 'unterkunden' => 'Unterkunden', 'kunden' => 'Privatkunden', 'benutzer' => 'Firmenbenutzer', 'bestellungen' => 'Sendungen (beauftragt)'] as $k => $bez) { $s = $stand[$k] ?: ['n' => 0, 'odoo' => 0, 'lexware' => 0]; ?>
          <tr><td><?= e($bez) ?></td><td class="mono rechts"><?= (int) $s['n'] ?></td><td class="mono rechts"><?= (int) $s['odoo'] ?></td><td class="mono rechts"><?= $k === 'benutzer' || $k === 'bestellungen' ? '—' : (int) $s['lexware'] ?></td></tr>
        <?php } ?>
        </tbody>
      </table></div>
      <p class="leise" style="margin-top:.75rem">Firmenbenutzer stehen in Lexware als Ansprechpartner am Kontakt der Firma bzw. des Unterkunden. Sendungen gehen nur nach Odoo (Verkaufsaufträge); Rechnungen als Notiz am Partner — gebucht wird in Lexware.</p>
    </div>
    <div class="karte">
      <h2 class="h2">So läuft es</h2>
      <ul class="liste-punkte">
        <li><strong>Kundennummer</strong> vergibt die Plattform (<?= e(konfig()['kundennummer']['praefix']) ?>…); Lexware vergibt zusätzlich seine eigene, Odoo bekommt die NEOS-Nummer als interne Referenz.</li>
        <li><strong>Hinrichtung</strong>: Firma, Unterkunde, Kunde, Ansprechpartner → sofort nach dem Speichern und per Cron.</li>
        <li><strong>Rückrichtung</strong>: Änderungen in Odoo/Lexware werden per Cron und Webhook (<code>api/odoo/webhook.php</code>, <code>api/lexware/webhook.php</code>) geholt.</li>
        <li><strong>Konflikt</strong>: die jüngere Änderung gewinnt; das Feld erscheint hier zur Kontrolle.</li>
      </ul>
    </div>
  </div>
</div>
