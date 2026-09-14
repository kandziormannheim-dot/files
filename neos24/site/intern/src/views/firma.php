<?php $darfB = darf('kunden', 'bearbeiten'); ?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('kunden', ['reiter' => 'firmen'])) ?>">← Firmen</a><h1 class="h1"><?= e($firma['name']) ?> <span class="mono leise" style="font-size:.7em"><?= e($firma['kundennummer']) ?></span><?= (int) $firma['aktiv'] === 1 ? '' : ' <span class="pille pille--warn">inaktiv</span>' ?></h1></div>
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
      <div class="karte-kopf"><h2 class="h2">Unterkunden</h2><span class="leise">Firmengruppe, Standorte — eigene Rechnungsempfänger unter <?= e($firma['kundennummer']) ?></span></div>
      <?php if ($unterkunden === []) { ?><p class="leer">Keine Unterkunden — alle Sendungen laufen auf die Hauptfirma.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Nummer</th><th>Name</th><th>Ort</th><th>Rechnungs-E-Mail</th><th class="rechts">Benutzer</th><th class="rechts">Sendungen</th><th class="rechts">Offene Rechn.</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($unterkunden as $u) { ?>
          <tr class="<?= (int) $u['aktiv'] === 1 ? '' : 'inaktiv' ?>">
            <td><a class="mono" href="<?= e(url('kunden/unterkunden/' . $u['id'])) ?>"><?= e($u['nummer']) ?></a><?= (int) $u['aktiv'] === 1 ? '' : ' <span class="pille pille--warn">inaktiv</span>' ?></td>
            <td><?= e($u['name']) ?></td><td><?= e(trim($u['plz'] . ' ' . $u['ort'])) ?></td><td><?= e($u['rechnungs_email'] ?: '—') ?></td>
            <td class="mono rechts"><?= (int) $u['benutzer'] ?></td><td class="mono rechts"><?= (int) $u['sendungen'] ?></td><td class="mono rechts"><?= (int) $u['offene_rechnungen'] ?></td>
            <td class="rechts"><a class="knopf knopf--leise knopf--klein" href="<?= e(url('kunden/unterkunden/' . $u['id'])) ?>">Öffnen</a></td>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
      <?php if ($darfB) { ?>
      <details style="margin-top:.75rem"><summary class="knopf knopf--leise knopf--klein" style="display:inline-block;cursor:pointer">Unterkunde anlegen</summary>
      <form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/unterkunde')) ?>" class="formular" style="margin-top:.75rem">
        <?= csrfFeld() ?>
        <div class="spalten spalten--2">
          <div class="feld"><label for="u-name">Name (Unternehmen oder Standort)</label><input id="u-name" name="name" required maxlength="120"></div>
          <div class="feld"><label for="u-mail">E-Mail für Rechnungen</label><input id="u-mail" name="rechnungs_email" type="email" placeholder="leer = <?= e($firma['rechnungs_email'] ?: 'Firma') ?>"></div>
          <div class="feld"><label for="u-strasse">Straße und Hausnummer</label><input id="u-strasse" name="strasse" value="<?= e($firma['strasse']) ?>"></div>
          <div class="spalten spalten--2"><div class="feld"><label for="u-plz">PLZ</label><input id="u-plz" name="plz" value="<?= e($firma['plz']) ?>"></div><div class="feld"><label for="u-ort">Ort</label><input id="u-ort" name="ort" value="<?= e($firma['ort']) ?>"></div></div>
          <div class="spalten spalten--2"><div class="feld"><label for="u-land">Land</label><input id="u-land" name="land" value="<?= e($firma['land']) ?>" maxlength="2"></div><div class="feld"><label for="u-ust">USt-IdNr.</label><input id="u-ust" name="ust_id" maxlength="30"></div></div>
          <div class="spalten spalten--2"><div class="feld"><label for="u-ziel">Zahlungsziel (Tage, leer = Firma)</label><input id="u-ziel" name="zahlungsziel_tage" type="number" min="0"></div><div class="feld"><label for="u-notiz">Notiz (intern)</label><input id="u-notiz" name="notiz" maxlength="200"></div></div>
        </div>
        <button class="knopf knopf--primaer" type="submit">Unterkunde anlegen</button> <span class="leise">bekommt die nächste Nummer <?= e($firma['kundennummer']) ?>-<?= str_pad((string) (count($unterkunden) + 1), 2, '0', STR_PAD_LEFT) ?></span>
      </form>
      </details>
      <?php } ?>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Sendungen</h2><?php if (darf('bestellungen')) { ?><a class="leise" href="<?= e(url('bestellungen', ['q' => $firma['kundennummer']])) ?>">alle →</a><?php } ?></div>
      <?php if ($sendungen === []) { ?><p class="leer">Noch keine Sendungen.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Sendung</th><th>Status</th><th>Ziel</th><th>Referenz</th><th>Von</th><?php if ($unterkunden !== []) { ?><th>Für</th><?php } ?><th class="rechts">Netto</th><th>Rechnung</th><th class="rechts">Datum</th></tr></thead>
        <tbody>
        <?php $uNummern = array_column($unterkunden, 'nummer', 'id'); foreach ($sendungen as $s) { ?>
          <tr>
            <td><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $s['ext_ref'])) ?>"><?= e($s['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($s['ext_ref']) ?></span><?php } ?></td>
            <td><?= statusPille((string) $s['status']) ?></td>
            <td><span class="flagge"><?= e($s['zielland']) ?></span><?= e($s['gewichtsklasse']) ?></td>
            <td><?= e($s['referenz'] ?: '—') ?></td>
            <td><?= e($s['angelegt_von'] ?? '—') ?></td>
            <?php if ($unterkunden !== []) { ?><td class="mono leise"><?= e($uNummern[(int) ($s['unterkunde_id'] ?? 0)] ?? 'Firma') ?></td><?php } ?>
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
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Nummer</th><th>Status</th><?php if ($unterkunden !== []) { ?><th>Empfänger</th><?php } ?><th>Zeitraum</th><th class="rechts">Sendungen</th><th class="rechts">Brutto</th><th>Fällig</th></tr></thead>
        <tbody>
        <?php foreach ($rechnungen as $r) { ?>
          <tr><td><a class="mono" href="<?= e(url('rechnungen/' . $r['id'])) ?>"><?= e($r['nummer']) ?></a></td><td><?= statusPille((string) $r['status'], rechnungStatusName((string) $r['status'])) ?></td><?php if ($unterkunden !== []) { ?><td class="mono leise"><?= e($r['unterkunde_nummer'] ?: 'Firma') ?></td><?php } ?><td><?= e(datumAnzeigen($r['zeitraum_von'])) ?> – <?= e(datumAnzeigen(gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $r['zeitraum_bis']) - 1))) ?></td><td class="mono rechts"><?= (int) $r['positionen'] ?></td><td class="mono rechts"><?= e(euro((int) $r['brutto_cent'])) ?></td><td><?= e(datumAnzeigen($r['faellig'] . 'T00:00:00Z')) ?></td></tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
      <?php if (darf('rechnungen', 'bearbeiten')) { ?>
      <form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/rechnung')) ?>" class="formular formular--zeile">
        <?= csrfFeld() ?>
        <div class="feld"><label for="monat">Sammelrechnung erzeugen für</label><select id="monat" name="monat"><?php foreach ($monate as $m) { ?><option value="<?= e($m) ?>"><?= e(date('m/Y', strtotime($m . '-01'))) ?></option><?php } ?></select></div>
        <?php if ($unterkunden !== []) { ?><div class="feld"><label for="r-unterkunde">Abrechnen für</label><select id="r-unterkunde" name="unterkunde_id"><option value="">Hauptfirma <?= e($firma['kundennummer']) ?></option><?php foreach ($unterkunden as $u) { if ((int) $u['aktiv'] !== 1) { continue; } ?><option value="<?= (int) $u['id'] ?>"><?= e($u['nummer']) ?> · <?= e($u['name']) ?></option><?php } ?></select></div><?php } ?>
        <button class="knopf knopf--primaer" type="submit">Rechnung erzeugen</button>
        <span class="leise">alle beauftragten, noch nicht abgerechneten Sendungen des Monats<?= $unterkunden !== [] ? ' des gewählten Empfängers' : '' ?></span>
      </form>
      <?php } ?>
    </div>
  </div>
  <div>
    <?php $syncUrl = url('kunden/firmen/' . $firma['id'] . '/sync'); require __DIR__ . '/systeme_karte.php'; ?>
    <div class="karte karte--gelb">
      <div class="karte-kopf"><h2 class="h2">Guthaben</h2><strong class="mono"><?= e(euro($guthaben)) ?></strong></div>
      <?php if ($buchungen === []) { ?><p class="leise">Keine Buchungen — Aufladung per Revolut im Portal, Erstattungen aus Reklamationen.</p><?php } else { ?>
      <table class="tabelle tabelle--kompakt">
        <tbody>
        <?php foreach ($buchungen as $g) { ?>
          <tr><td class="leise mono"><?= e(datumAnzeigen($g['zeit'])) ?></td><td><?= e(['aufladung' => 'Aufladung', 'verbrauch' => 'Sendung', 'erstattung' => 'Erstattung', 'korrektur' => 'Korrektur'][$g['art']] ?? $g['art']) ?><?= $g['ext_ref'] ? ' <a class="mono" href="' . e(url('bestellungen/' . $g['ext_ref'])) . '">' . e($g['ext_ref']) . '</a>' : '' ?></td><td class="mono rechts"><?= (int) $g['betrag_cent'] > 0 ? '+' : '' ?><?= e(euro((int) $g['betrag_cent'])) ?></td></tr>
        <?php } ?>
        </tbody>
      </table>
      <?php } ?>
    </div>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2">Preisliste</h2><?php if ($firma['preisliste_id']) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('kunden/preisliste/' . $firma['preisliste_id'])) ?>">Bearbeiten</a><?php } ?></div>
      <?php if ($firma['preisliste_id']) { $pl = preislisteLaden((int) $firma['preisliste_id']); ?>
        <p><strong><?= e($pl['name'] ?? '') ?></strong><?= $pl !== null && (int) $pl['aktiv'] !== 1 ? ' <span class="pille pille--warn">inaktiv</span>' : '' ?><br><span class="leise">eigene Konditionen · zuletzt <?= e(zeitAnzeigen($pl['aktualisiert'] ?? null)) ?></span></p>
      <?php } elseif ($darfB) { ?>
        <p class="leise">Standardpreise der Routingmatrix. Eigene Liste anlegen — sie startet als Kopie der Routingmatrix mit Auf-/Abschlag:</p>
        <form method="post" action="<?= e(url('kunden/preisliste/anlegen')) ?>" class="formular" style="margin-top:.6rem">
          <?= csrfFeld() ?><input type="hidden" name="firma_id" value="<?= (int) $firma['id'] ?>">
          <div class="spalten spalten--2"><div class="feld"><label for="pl-name">Bezeichnung</label><input id="pl-name" name="name" value="<?= e($firma['name']) ?>" maxlength="80"></div><div class="feld"><label for="pl-prozent">Auf-/Abschlag %</label><input id="pl-prozent" name="prozent" inputmode="decimal" value="-10"></div></div>
          <button class="knopf knopf--leise" type="submit">Preisliste anlegen</button>
        </form>
      <?php } else { ?><p class="leise">Standardpreise der Routingmatrix.</p><?php } ?>
    </div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Benutzer</h2></div>
      <?php $uNummern = array_column($unterkunden, 'nummer', 'id'); foreach ($benutzer as $b) { ?>
        <div class="firma-benutzer <?= (int) $b['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <div><strong><?= e($b['name']) ?></strong> <span class="pille"><?= $b['firmenrolle'] === 'inhaber' ? 'Inhaber' : 'Mitarbeiter' ?></span><?= (int) ($b['unterkunde_id'] ?? 0) > 0 ? ' <span class="pille mono">' . e($uNummern[(int) $b['unterkunde_id']] ?? '') . '</span>' : '' ?><br><span class="leise"><?= e($b['email']) ?> · <?= (int) $b['email_bestaetigt'] === 1 ? 'aktiviert' : 'Einladung offen' ?><?= (int) $b['aktiv'] === 1 ? '' : ' · inaktiv' ?><?= $b['letzte_anmeldung'] ? ' · zuletzt ' . e(zeitAnzeigen($b['letzte_anmeldung'])) : '' ?></span></div>
          <?php if ($darfB) { ?>
          <div class="zeilen-aktionen">
            <?php if ($unterkunden !== []) { ?><form method="post" action="<?= e(url('kunden/firmen/' . $firma['id'] . '/benutzer')) ?>" class="formular--zeile"><?= csrfFeld() ?><input type="hidden" name="kunde_id" value="<?= (int) $b['id'] ?>"><input type="hidden" name="was" value="unterkunde"><select name="unterkunde_id" aria-label="Unterkunde" onchange="this.form.requestSubmit()"><option value="0">Hauptfirma</option><?php foreach ($unterkunden as $u) { ?><option value="<?= (int) $u['id'] ?>" <?= (int) ($b['unterkunde_id'] ?? 0) === (int) $u['id'] ? 'selected' : '' ?>><?= e($u['nummer']) ?> <?= e($u['name']) ?></option><?php } ?></select></form><?php } ?>
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
