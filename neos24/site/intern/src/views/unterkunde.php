<?php $darfB = darf('kunden', 'bearbeiten'); ?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('kunden/firmen/' . $u['firma_id'])) ?>">← <?= e($firma['name'] ?? 'Firma') ?></a><h1 class="h1"><?= e($u['name']) ?> <span class="mono leise" style="font-size:.7em"><?= e($u['nummer']) ?></span><?= (int) $u['aktiv'] === 1 ? '' : ' <span class="pille pille--warn">inaktiv</span>' ?></h1></div>
  <?php if ($darfB) { ?><form method="post" action="<?= e(url('kunden/unterkunden/' . $u['id'] . '/aktiv')) ?>" data-bestaetigen="Unterkunde <?= (int) $u['aktiv'] === 1 ? 'deaktivieren? Neue Sendungen können ihm dann nicht mehr zugeordnet werden.' : 'aktivieren?' ?>"><?= csrfFeld() ?><button class="knopf knopf--leise" type="submit"><?= (int) $u['aktiv'] === 1 ? 'Deaktivieren' : 'Aktivieren' ?></button></form><?php } ?>
</header>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte">
      <h2 class="h2">Unterkunde von <?= e($firma['name'] ?? '') ?> <span class="mono leise"><?= e($firma['kundennummer'] ?? '') ?></span></h2>
      <p class="leise" style="margin-bottom:.75rem">Eigener Rechnungsempfänger: eigene Anschrift, USt-ID und Rechnungs-Mail, eigene Sammelrechnungen und eigener Kontakt in Lexware/Odoo. Zahlungsziel und Preisliste fallen ohne Angabe auf die Firma zurück.</p>
      <form method="post" action="<?= e(url('kunden/unterkunden/' . $u['id'] . '/daten')) ?>" class="formular">
        <?= csrfFeld() ?>
        <div class="spalten spalten--2">
          <div class="feld"><label for="name">Name</label><input id="name" name="name" value="<?= e($u['name']) ?>" required <?= $darfB ? '' : 'readonly' ?>></div>
          <div class="feld"><label for="rechnungs_email">E-Mail für Rechnungen</label><input id="rechnungs_email" name="rechnungs_email" type="email" value="<?= e($u['rechnungs_email']) ?>" placeholder="<?= e($firma['rechnungs_email'] ?? '') ?>" <?= $darfB ? '' : 'readonly' ?>></div>
          <div class="feld"><label for="strasse">Straße und Hausnummer</label><input id="strasse" name="strasse" value="<?= e($u['strasse']) ?>" <?= $darfB ? '' : 'readonly' ?>></div>
          <div class="spalten spalten--2"><div class="feld"><label for="plz">PLZ</label><input id="plz" name="plz" value="<?= e($u['plz']) ?>" <?= $darfB ? '' : 'readonly' ?>></div><div class="feld"><label for="ort">Ort</label><input id="ort" name="ort" value="<?= e($u['ort']) ?>" <?= $darfB ? '' : 'readonly' ?>></div></div>
          <div class="spalten spalten--2"><div class="feld"><label for="land">Land</label><input id="land" name="land" value="<?= e($u['land']) ?>" maxlength="2" <?= $darfB ? '' : 'readonly' ?>></div><div class="feld"><label for="ust_id">USt-IdNr.</label><input id="ust_id" name="ust_id" value="<?= e($u['ust_id']) ?>" <?= $darfB ? '' : 'readonly' ?>></div></div>
          <div class="feld"><label for="zahlungsziel_tage">Zahlungsziel (Tage, leer = Firma: <?= (int) ($firma['zahlungsziel_tage'] ?? 14) ?>)</label><input id="zahlungsziel_tage" name="zahlungsziel_tage" type="number" min="0" value="<?= $u['zahlungsziel_tage'] !== null ? (int) $u['zahlungsziel_tage'] : '' ?>" <?= $darfB ? '' : 'readonly' ?>></div>
          <div class="feld"><label for="notiz">Notiz (intern)</label><input id="notiz" name="notiz" value="<?= e($u['notiz']) ?>" maxlength="200" <?= $darfB ? '' : 'readonly' ?>></div>
        </div>
        <?php if ($darfB) { ?><div class="formular-fuss"><button class="knopf knopf--primaer" type="submit">Speichern</button><span class="leise">angelegt <?= e(zeitAnzeigen($u['erstellt'])) ?></span></div><?php } ?>
      </form>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Sendungen</h2><?php if (darf('bestellungen')) { ?><a class="leise" href="<?= e(url('bestellungen', ['q' => $u['nummer']])) ?>">alle →</a><?php } ?></div>
      <?php if ($sendungen === []) { ?><p class="leer">Noch keine Sendungen für diesen Unterkunden.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Sendung</th><th>Status</th><th>Ziel</th><th>Referenz</th><th>Von</th><th class="rechts">Netto</th><th>Rechnung</th><th class="rechts">Datum</th></tr></thead>
        <tbody>
        <?php foreach ($sendungen as $s) { ?>
          <tr>
            <td><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $s['ext_ref'])) ?>"><?= e($s['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($s['ext_ref']) ?></span><?php } ?></td>
            <td><?= statusPille((string) $s['status']) ?></td>
            <td><span class="flagge"><?= e($s['zielland']) ?></span><?= e($s['gewichtsklasse']) ?></td>
            <td><?= e($s['referenz'] ?: '—') ?></td>
            <td><?= e($s['angelegt_von'] ?? '—') ?></td>
            <td class="mono rechts"><?= e(euro((int) $s['netto_cent'])) ?></td>
            <td><?= $s['rechnung_id'] ? '<a href="' . e(url('rechnungen/' . $s['rechnung_id'])) . '">✓</a>' : '<span class="leise">offen</span>' ?></td>
            <td class="mono rechts leise"><?= e(zeitAnzeigen($s['erstellt'])) ?></td>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Rechnungen</h2></div>
      <?php if ($rechnungen === []) { ?><p class="leer">Noch keine Rechnung für diesen Unterkunden.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Nummer</th><th>Status</th><th>Zeitraum</th><th class="rechts">Sendungen</th><th class="rechts">Brutto</th><th>Fällig</th></tr></thead>
        <tbody>
        <?php foreach ($rechnungen as $r) { ?>
          <tr><td><a class="mono" href="<?= e(url('rechnungen/' . $r['id'])) ?>"><?= e($r['nummer']) ?></a></td><td><?= statusPille((string) $r['status'], rechnungStatusName((string) $r['status'])) ?></td><td><?= e(datumAnzeigen($r['zeitraum_von'])) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1))) ?></td><td class="mono rechts"><?= (int) $r['positionen'] ?></td><td class="mono rechts"><?= e(euro((int) $r['brutto_cent'])) ?></td><td><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z')) ?></td></tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
      <?php if (darf('rechnungen', 'bearbeiten') && (int) $u['aktiv'] === 1) { ?>
      <form method="post" action="<?= e(url('kunden/unterkunden/' . $u['id'] . '/rechnung')) ?>" class="formular formular--zeile">
        <?= csrfFeld() ?>
        <div class="feld"><label for="monat">Sammelrechnung erzeugen für</label><select id="monat" name="monat"><?php foreach ($monate as $m) { ?><option value="<?= e($m) ?>"><?= e(date('m/Y', strtotime($m . '-01'))) ?></option><?php } ?></select></div>
        <button class="knopf knopf--primaer" type="submit">Rechnung erzeugen</button>
        <span class="leise">nur Sendungen dieses Unterkunden · Rechnungsadresse und Kontakt des Unterkunden</span>
      </form>
      <?php } ?>
    </div>
  </div>
  <div>
    <?php $sync = $sync; $syncUrl = url('kunden/unterkunden/' . $u['id'] . '/sync'); require __DIR__ . '/systeme_karte.php'; ?>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2">Preisliste</h2><?php if ($u['preisliste_id']) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('kunden/preisliste/' . $u['preisliste_id'])) ?>">Bearbeiten</a><?php } ?></div>
      <?php if ($u['preisliste_id']) { $pl = preislisteLaden((int) $u['preisliste_id']); ?>
        <p><strong><?= e($pl['name'] ?? '') ?></strong><?= $pl !== null && (int) $pl['aktiv'] !== 1 ? ' <span class="pille pille--warn">inaktiv</span>' : '' ?><br><span class="leise">eigene Konditionen dieses Unterkunden</span></p>
      <?php } elseif ($darfB) { ?>
        <p class="leise"><?= ($firma['preisliste_id'] ?? null) ? 'Nutzt die Preisliste der Firma.' : 'Standardpreise der Routingmatrix (wie die Firma).' ?> Eigene Liste für diesen Unterkunden:</p>
        <form method="post" action="<?= e(url('kunden/preisliste/anlegen')) ?>" class="formular" style="margin-top:.6rem">
          <?= csrfFeld() ?><input type="hidden" name="unterkunde_id" value="<?= (int) $u['id'] ?>">
          <div class="spalten spalten--2"><div class="feld"><label for="pl-name">Bezeichnung</label><input id="pl-name" name="name" value="<?= e($u['name']) ?>" maxlength="80"></div><div class="feld"><label for="pl-prozent">Auf-/Abschlag %</label><input id="pl-prozent" name="prozent" inputmode="decimal" value="-5"></div></div>
          <button class="knopf knopf--leise" type="submit">Preisliste anlegen</button>
        </form>
      <?php } else { ?><p class="leise"><?= ($firma['preisliste_id'] ?? null) ? 'Preisliste der Firma.' : 'Standardpreise der Routingmatrix.' ?></p><?php } ?>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Zugeordnete Benutzer</h2></div>
      <?php if ($benutzer === []) { ?><p class="leise">Kein Benutzer fest zugeordnet — Inhaber wählen den Unterkunden je Sendung. Zuordnung unter der Firma bei den Benutzern.</p><?php } else { ?>
      <?php foreach ($benutzer as $b) { ?><div class="firma-benutzer <?= (int) $b['aktiv'] === 1 ? '' : 'inaktiv' ?>"><div><strong><?= e($b['name']) ?></strong> <span class="pille"><?= $b['firmenrolle'] === 'inhaber' ? 'Inhaber' : 'Mitarbeiter' ?></span><br><span class="leise"><?= e($b['email']) ?></span></div></div><?php } ?>
      <?php } ?>
    </div>
  </div>
</div>
