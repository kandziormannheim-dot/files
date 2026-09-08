<?php $darfB = darf('kunden', 'bearbeiten'); ?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('kunden', ['reiter' => 'firmen'])) ?>">← Firmen</a><h1 class="h1"><?= e($firma['name']) ?><?= (int) $firma['aktiv'] === 1 ? '' : ' <span class="pille pille--warn">inaktiv</span>' ?></h1></div>
  <?php if ($darfB) { ?><form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/aktiv')) ?>" data-bestaetigen="Firma <?= (int) $firma['aktiv'] === 1 ? 'deaktivieren? Benutzer können sich dann nicht mehr anmelden.' : 'aktivieren?' ?>"><?= csrfFeld() ?><button class="knopf knopf--leise" type="submit"><?= (int) $firma['aktiv'] === 1 ? 'Deaktivieren' : 'Aktivieren' ?></button></form><?php } ?>
</header>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte">
      <h2 class="h2">Firmendaten</h2>
      <form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/daten')) ?>" class="formular">
        <?= csrfFeld() ?>
        <div class="spalten spalten--2">
          <div class="feld"><label for="name">Firmenname</label><input id="name" name="name" value="<?= e($firma['name']) ?>" required <?= $darfB ? '' : 'readonly' ?>></div>
          <div class="feld"><label for="rechnungs_email">E-Mail für Rechnungen</label><input id="rechnungs_email" name="rechnungs_email" type="email" value="<?= e($firma['rechnungs_email']) ?>" <?= $darfB ? '' : 'readonly' ?>></div>
          <div class="feld"><label for="strasse">Straße und Hausnummer</label><input id="strasse" name="strasse" value="<?= e($firma['strasse']) ?>" <?= $darfB ? '' : 'readonly' ?>></div>
          <div class="spalten spalten--2"><div class="feld"><label for="plz">PLZ</label><input id="plz" name="plz" value="<?= e($firma['plz']) ?>" <?= $darfB ? '' : 'readonly' ?>></div><div class="feld"><label for="ort">Ort</label><input id="ort" name="ort" value="<?= e($firma['ort']) ?>" <?= $darfB ? '' : 'readonly' ?>></div></div>
          <div class="spalten spalten--2"><div class="feld"><label for="land">Land</label><input id="land" name="land" value="<?= e($firma['land']) ?>" maxlength="2" <?= $darfB ? '' : 'readonly' ?>></div><div class="feld"><label for="ust_id">USt-IdNr.</label><input id="ust_id" name="ust_id" value="<?= e($firma['ust_id']) ?>" <?= $darfB ? '' : 'readonly' ?>></div></div>
          <div class="feld"><label for="zahlungsziel_tage">Zahlungsziel (Tage)</label><input id="zahlungsziel_tage" name="zahlungsziel_tage" type="number" min="0" value="<?= (int) $firma['zahlungsziel_tage'] ?>" <?= $darfB ? '' : 'readonly' ?>></div>
        </div>
        <?php if ($darfB) { ?><div class="formular-fuss"><button class="knopf knopf--primaer" type="submit">Speichern</button><span class="leise">angelegt <?= e(zeitAnzeigen($firma['erstellt'])) ?> von <?= e($firma['freigeschaltet_von']) ?></span></div><?php } ?>
      </form>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Sendungen</h2><?php if (darf('bestellungen')) { ?><a class="leise" href="<?= e(url('bestellungen', ['q' => $firma['name']])) ?>">alle →</a><?php } ?></div>
      <?php if ($sendungen === []) { ?><p class="leer">Noch keine Sendungen.</p><?php } else { ?>
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
      <?php if ($rechnungen === []) { ?><p class="leer">Noch keine Rechnung.</p><?php } else { ?>
      <table class="tabelle tabelle--kompakt">
        <thead><tr><th>Nummer</th><th>Status</th><th>Zeitraum</th><th class="rechts">Sendungen</th><th class="rechts">Brutto</th><th>Fällig</th></tr></thead>
        <tbody>
        <?php foreach ($rechnungen as $r) { ?>
          <tr><td><a class="mono" href="<?= e(url('rechnungen/' . $r['id'])) ?>"><?= e($r['nummer']) ?></a></td><td><?= statusPille((string) $r['status'], rechnungStatusName((string) $r['status'])) ?></td><td><?= e(datumAnzeigen($r['zeitraum_von'])) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1))) ?></td><td class="mono rechts"><?= (int) $r['positionen'] ?></td><td class="mono rechts"><?= e(euro((int) $r['brutto_cent'])) ?></td><td><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z')) ?></td></tr>
        <?php } ?>
        </tbody>
      </table>
      <?php } ?>
      <?php if (darf('rechnungen', 'bearbeiten')) { ?>
      <form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/rechnung')) ?>" class="formular formular--zeile">
        <?= csrfFeld() ?>
        <div class="feld"><label for="monat">Sammelrechnung erzeugen für</label><select id="monat" name="monat"><?php foreach ($monate as $m) { ?><option value="<?= e($m) ?>"><?= e(date('m/Y', strtotime($m . '-01'))) ?></option><?php } ?></select></div>
        <button class="knopf knopf--primaer" type="submit">Rechnung erzeugen</button>
        <span class="leise">alle beauftragten, noch nicht abgerechneten Sendungen des Monats</span>
      </form>
      <?php } ?>
    </div>
  </div>
  <div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Benutzer</h2></div>
      <?php foreach ($benutzer as $b) { ?>
        <div class="firma-benutzer <?= (int) $b['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <div><strong><?= e($b['name']) ?></strong> <span class="pille"><?= $b['firmenrolle'] === 'inhaber' ? 'Inhaber' : 'Mitarbeiter' ?></span><br><span class="leise"><?= e($b['email']) ?> · <?= (int) $b['email_bestaetigt'] === 1 ? 'aktiviert' : 'Einladung offen' ?><?= (int) $b['aktiv'] === 1 ? '' : ' · inaktiv' ?><?= $b['letzte_anmeldung'] ? ' · zuletzt ' . e(zeitAnzeigen($b['letzte_anmeldung'])) : '' ?></span></div>
          <?php if ($darfB) { ?>
          <div class="zeilen-aktionen">
            <?php if ((int) $b['email_bestaetigt'] !== 1) { ?><form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/benutzer')) ?>"><?= csrfFeld() ?><input type="hidden" name="kunde_id" value="<?= (int) $b['id'] ?>"><input type="hidden" name="was" value="einladen"><button class="knopf knopf--leise knopf--klein" type="submit">Erneut einladen</button></form><?php } ?>
            <form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/benutzer')) ?>"><?= csrfFeld() ?><input type="hidden" name="kunde_id" value="<?= (int) $b['id'] ?>"><input type="hidden" name="was" value="<?= (int) $b['aktiv'] === 1 ? 'deaktivieren' : 'aktivieren' ?>"><button class="knopf knopf--leise knopf--klein" type="submit"><?= (int) $b['aktiv'] === 1 ? 'Deaktivieren' : 'Aktivieren' ?></button></form>
          </div>
          <?php } ?>
        </div>
      <?php } ?>
      <?php if ($darfB) { ?>
      <form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/einladen')) ?>" class="formular" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line)">
        <?= csrfFeld() ?>
        <div class="feld"><label for="e-name">Benutzer einladen</label><input id="e-name" name="name" placeholder="Name" required></div>
        <div class="feld"><input name="email" type="email" placeholder="E-Mail" aria-label="E-Mail" required></div>
        <div class="spalten spalten--2">
          <div class="feld"><select name="rolle" aria-label="Rolle"><option value="mitarbeiter">Mitarbeiter</option><option value="inhaber">Inhaber</option></select></div>
          <div class="feld"><select name="sprache" aria-label="Sprache"><option value="de">Deutsch</option><option value="en">English</option></select></div>
        </div>
        <button class="knopf knopf--leise" type="submit">Einladen</button>
      </form>
      <?php } ?>
    </div>
  </div>
</div>
