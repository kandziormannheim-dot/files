<?php $abs = json_decode((string) ($kunde['absender_json'] ?? '{}'), true) ?: []; ?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('kunden', ['reiter' => 'privatkunden'])) ?>">← Privatkunden</a><h1 class="h1"><?= e($kunde['name']) ?> <span class="mono leise" style="font-size:.7em"><?= e($kunde['kundennummer']) ?></span><?= (int) $kunde['aktiv'] === 1 ? '' : ' <span class="pille pille--warn">geschlossen</span>' ?></h1></div>
  <?php if (darf('bestellungen')) { ?><a class="knopf knopf--leise" href="<?= e(url('bestellungen', ['q' => $kunde['email']])) ?>">Alle Bestellungen</a><?php } ?>
</header>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Bestellungen</h2><span class="leise">letzte 20</span></div>
      <?php if ($bestellungen === []) { ?><p class="leer">Noch keine Bestellungen.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Bestellung</th><th>Status</th><th>Versand</th><th>Ziel</th><th>Carrier</th><th>Zahlung</th><th class="rechts">Brutto</th><th class="rechts">Datum</th></tr></thead>
        <tbody>
        <?php foreach ($bestellungen as $s) { ?>
          <tr>
            <td><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $s['ext_ref'])) ?>"><?= e($s['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($s['ext_ref']) ?></span><?php } ?><?= $s['art'] === 'retoure' ? ' <span class="pille">Retoure</span>' : '' ?></td>
            <td><?= statusPille((string) $s['status']) ?></td>
            <td><span class="status status--vs-<?= e($s['versandstatus']) ?>"><?= e(versandstatusName((string) $s['versandstatus'])) ?></span></td>
            <td><span class="flagge"><?= e($s['zielland']) ?></span><?= e($s['gewichtsklasse']) ?></td>
            <td><?= e($s['carrier'] ?? '—') ?></td>
            <td><?= ['rechnung' => 'Rechnung', 'guthaben' => 'Guthaben'][$s['zahlungsart']] ?? 'Revolut' ?></td>
            <td class="mono rechts"><?= e(euro((int) $s['betrag_cent'])) ?></td>
            <td class="mono rechts leise"><?= e(zeitAnzeigen($s['erstellt'])) ?></td>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Reklamationen</h2></div>
      <?php if ($reklamationen === []) { ?><p class="leer">Keine Reklamationen.</p><?php } else { ?>
      <table class="tabelle tabelle--kompakt">
        <tbody>
        <?php foreach ($reklamationen as $r) { ?>
          <tr><td><?php if (darf('reklamationen')) { ?><a class="mono" href="<?= e(url('reklamationen/' . $r['id'])) ?>">#<?= (int) $r['id'] ?></a><?php } else { ?>#<?= (int) $r['id'] ?><?php } ?></td><td><span class="status status--rk-<?= e($r['status']) ?>"><?= e(REKLAMATION_STATUS[$r['status']]['de'] ?? $r['status']) ?></span></td><td class="mono"><?= e($r['ext_ref']) ?></td><td><?= e(REKLAMATION_ARTEN[$r['art']]['de'] ?? $r['art']) ?></td><td class="mono rechts"><?= (int) $r['erstattung_cent'] > 0 ? e(euro((int) $r['erstattung_cent'])) : '—' ?></td></tr>
        <?php } ?>
        </tbody>
      </table>
      <?php } ?>
    </div>
  </div>
  <div>
    <div class="karte karte--ink">
      <h2 class="h2">Konto</h2>
      <dl class="liste liste--ink">
        <dt>Kundennummer</dt><dd class="mono"><strong><?= e($kunde['kundennummer']) ?></strong></dd>
        <dt>E-Mail</dt><dd><a href="mailto:<?= e($kunde['email']) ?>"><?= e($kunde['email']) ?></a></dd>
        <dt>Bestätigt</dt><dd><?= (int) $kunde['email_bestaetigt'] === 1 ? 'ja' : 'nein' ?></dd>
        <dt>Passwort</dt><dd><?= $kunde['passwort_hash'] !== null ? 'gesetzt' : 'nur Anmeldelink' ?></dd>
        <dt>Sprache</dt><dd><?= e(strtoupper((string) $kunde['sprache'])) ?></dd>
        <dt>Registriert</dt><dd><?= e(zeitAnzeigen($kunde['erstellt'])) ?></dd>
        <dt>Letzte Anmeldung</dt><dd><?= e(zeitAnzeigen($kunde['letzte_anmeldung'])) ?></dd>
        <?php if ($abs !== []) { ?><dt>Absender</dt><dd><?= e($abs['name'] ?? '') ?><br><?= e($abs['strasse'] ?? '') ?><br><?= e(trim(($abs['plz'] ?? '') . ' ' . ($abs['ort'] ?? ''))) ?></dd><?php } ?>
      </dl>
    </div>
    <?php $syncUrl = url('kunden/privat/' . $kunde['id'] . '/sync'); require __DIR__ . '/systeme_karte.php'; ?>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2">Preisliste</h2><?php if ($kunde['preisliste_id']) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('kunden/preisliste/' . $kunde['preisliste_id'])) ?>">Bearbeiten</a><?php } ?></div>
      <?php if ($kunde['preisliste_id']) { $pl = preislisteLaden((int) $kunde['preisliste_id']); ?>
        <p><strong><?= e($pl['name'] ?? '') ?></strong><?= $pl !== null && (int) $pl['aktiv'] !== 1 ? ' <span class="pille pille--warn">inaktiv</span>' : '' ?><br><span class="leise">eigene Konditionen</span></p>
      <?php } elseif (darf('kunden', 'bearbeiten')) { ?>
        <form method="post" action="<?= e(url('kunden/preisliste/anlegen')) ?>" class="formular">
          <?= csrfFeld() ?><input type="hidden" name="kunde_id" value="<?= (int) $kunde['id'] ?>">
          <div class="spalten spalten--2"><div class="feld"><label for="pl-name">Bezeichnung</label><input id="pl-name" name="name" value="<?= e($kunde['name']) ?>" maxlength="80"></div><div class="feld"><label for="pl-prozent">Auf-/Abschlag %</label><input id="pl-prozent" name="prozent" inputmode="decimal" value="-5"></div></div>
          <button class="knopf knopf--leise" type="submit">Eigene Preisliste anlegen</button>
        </form>
      <?php } else { ?><p class="leise">Standardpreise.</p><?php } ?>
    </div>
    <div class="karte karte--gelb">
      <div class="karte-kopf"><h2 class="h2">Guthaben</h2><strong class="mono"><?= e(euro($guthaben)) ?></strong></div>
      <?php if ($buchungen === []) { ?><p class="leise">Keine Buchungen.</p><?php } else { ?>
      <table class="tabelle tabelle--kompakt">
        <tbody>
        <?php foreach ($buchungen as $g) { ?>
          <tr><td class="leise mono"><?= e(datumAnzeigen($g['zeit'])) ?></td><td><?= e(['aufladung' => 'Aufladung', 'verbrauch' => 'Sendung', 'erstattung' => 'Erstattung', 'korrektur' => 'Korrektur'][$g['art']] ?? $g['art']) ?><?= $g['ext_ref'] && darf('bestellungen') ? ' <a class="mono" href="' . e(url('bestellungen/' . $g['ext_ref'])) . '">' . e($g['ext_ref']) . '</a>' : '' ?></td><td class="mono rechts"><?= (int) $g['betrag_cent'] > 0 ? '+' : '' ?><?= e(euro((int) $g['betrag_cent'])) ?></td></tr>
        <?php } ?>
        </tbody>
      </table>
      <?php } ?>
    </div>
  </div>
</div>
