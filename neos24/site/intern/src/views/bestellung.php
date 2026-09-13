<?php
$absender = json_decode((string) $b['absender_json'], true) ?: [];
$empfaenger = json_decode((string) $b['empfaenger_json'], true) ?: [];
$ereignisse = json_decode((string) $b['ereignisse_json'], true) ?: [];
$masse = json_decode((string) ($b['masse_json'] ?? '{}'), true) ?: [];
$zusatz = json_decode((string) ($b['zusatz_json'] ?? '[]'), true) ?: [];
$abholung = json_decode((string) ($b['abholung_json'] ?? '{}'), true) ?: [];
$land = preisliste()['laender'][$b['zielland']]['name']['de'] ?? $b['zielland'];
$loeschbar = in_array($b['status'], ['offen', 'fehlgeschlagen', 'storniert'], true);
$labelDa = in_array($b['status'], ['bezahlt', 'beauftragt'], true);
$zahlungsartName = ['rechnung' => 'Auf Rechnung (Sammelrechnung)', 'guthaben' => 'Vom Guthaben', 'revolut' => 'Revolut'][$b['zahlungsart']] ?? $b['zahlungsart'];
?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('bestellungen')) ?>">← Bestellungen</a><h1 class="h1 mono"><?= e($b['ext_ref']) ?><?= $b['art'] === 'retoure' ? ' <span class="pille">Retoure</span>' : ($b['art'] === 'nachberechnung' ? ' <span class="pille pille--warn">Nachberechnung</span>' : '') ?></h1></div>
  <div><?= statusPille((string) $b['status']) ?> <span class="status status--vs-<?= e($b['versandstatus']) ?>"><?= e(versandstatusName((string) $b['versandstatus'])) ?></span></div>
</header>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2">Sendung</h2><span class="leise">angelegt <?= e(zeitAnzeigen($b['erstellt'])) ?><?= $b['referenz'] !== '' ? ' · Referenz ' . e($b['referenz']) : '' ?></span></div>
      <div class="spalten spalten--2">
        <dl class="liste">
          <dt>Zielland</dt><dd><span class="flagge"><?= e($b['zielland']) ?></span><?= e($land) ?></dd>
          <dt>Gewicht</dt><dd><?= e($b['gewichtsklasse']) ?><?= (int) $b['gewicht_gramm'] > 0 ? ' · ' . e(number_format((int) $b['gewicht_gramm'] / 1000, 2, ',', '')) . ' kg' : '' ?><?= !empty($masse['l']) ? ' · ' . e($masse['l'] . ' × ' . $masse['b'] . ' × ' . $masse['h'] . ' cm') : '' ?></dd>
          <dt>Carrier</dt><dd><?= e($b['carrier'] ?? '— (vor Routingmatrix)') ?></dd>
          <dt>Zusatzleistungen</dt><dd><?= $zusatz !== [] ? e(implode(', ', array_map(static fn (array $z): string => ($z['name']['de'] ?? $z['code']) . ' (' . euro((int) $z['preis']) . ')', $zusatz))) : '—' ?></dd>
          <?php if ((int) $b['versicherung_cent'] > 0) { ?><dt>Versichert</dt><dd class="mono"><?= e(euro((int) $b['versicherung_cent'])) ?> Warenwert</dd><?php } ?>
          <?php if ((int) $b['nachnahme_cent'] > 0) { ?><dt>Nachnahme</dt><dd class="mono"><?= e(euro((int) $b['nachnahme_cent'])) ?></dd><?php } ?>
          <?php if (!empty($abholung['datum'])) { ?><dt>Abholung</dt><dd><strong><?= e(datumLesbar($abholung['datum'])) ?></strong>, <?= e(str_replace('-', '–', $abholung['fenster'] ?? '')) ?> Uhr beim Absender</dd><?php } ?>
          <dt>Sprache</dt><dd><?= e(strtoupper((string) $b['sprache'])) ?></dd>
        </dl>
        <dl class="liste">
          <dt>Porto netto</dt><dd class="mono"><?= e(euro((int) $b['netto_cent'] - (int) $b['zusatz_cent'])) ?></dd>
          <dt>Zusatz netto</dt><dd class="mono"><?= e(euro((int) $b['zusatz_cent'])) ?></dd>
          <dt>Netto</dt><dd class="mono"><?= e(euro((int) $b['netto_cent'])) ?></dd>
          <dt>MwSt.</dt><dd class="mono"><?= e(euro((int) $b['mwst_cent'])) ?></dd>
          <dt>Brutto</dt><dd class="mono"><strong><?= e(euro((int) $b['betrag_cent'])) ?></strong></dd>
          <dt>Einkauf / Marge</dt><dd class="mono"><?= e(euro((int) $b['einkauf_cent'])) ?> / <?= e(euro((int) $b['netto_cent'] - (int) $b['zusatz_cent'] - (int) $b['einkauf_cent'])) ?></dd>
        </dl>
      </div>
      <?php $nbGrund = json_decode((string) ($b['nachberechnung_json'] ?? '{}'), true) ?: []; if ($b['art'] === 'nachberechnung' && $nbGrund !== []) { ?>
      <p class="hinweis" style="margin-top:.75rem">Gewichtsnachberechnung zu <a class="mono" href="<?= e(url('bestellungen/' . ($nbGrund['original'] ?? ''))) ?>"><?= e($nbGrund['original'] ?? '') ?></a>: gewogen <?= e(number_format((int) ($nbGrund['gewicht_gramm'] ?? 0) / 1000, 2, ',', '')) ?> kg, gebucht <?= e($nbGrund['gk_bestellt'] ?? '') ?>, tatsächlich <?= e($nbGrund['gk_ist'] ?? '') ?><?= !empty($nbGrund['lieferantenrechnung']) ? ' · Lieferantenrechnung ' . e($nbGrund['lieferantenrechnung']) : '' ?>.</p>
      <?php } ?>
      <?php if ((int) $b['gewicht_carrier_gramm'] > 0) { ?><p class="leise" style="margin-top:.75rem">Vom Carrier gewogen: <strong><?= e(number_format((int) $b['gewicht_carrier_gramm'] / 1000, 2, ',', '')) ?> kg</strong><?= $b['einkauf_ist_cent'] !== null ? ' · tatsächlicher Einkauf ' . e(euro((int) $b['einkauf_ist_cent'])) : '' ?><?= $b['carrier_sendungsnummer'] !== '' ? ' · Carrier-Nr. <span class="mono">' . e($b['carrier_sendungsnummer']) . '</span>' : '' ?><?= $nachberechnungen !== [] ? ' · Nachberechnung: ' . implode(', ', array_map(static fn (string $ref): string => '<a class="mono" href="' . e(url('bestellungen/' . $ref)) . '">' . e($ref) . '</a>', $nachberechnungen)) : '' ?></p><?php } ?>
      <?php if ($retoureZu !== null || $retouren !== []) { ?>
      <p class="leise" style="margin-top:.75rem">
        <?php if ($retoureZu !== null) { ?>Retoure zu <a class="mono" href="<?= e(url('bestellungen/' . $retoureZu['ext_ref'])) ?>"><?= e($retoureZu['ext_ref']) ?></a><?php } ?>
        <?php foreach ($retouren as $ref) { ?>Retoure: <a class="mono" href="<?= e(url('bestellungen/' . $ref)) ?>"><?= e($ref) ?></a> <?php } ?>
      </p>
      <?php } ?>
    </div>
    <div class="spalten spalten--2">
      <div class="karte">
        <h2 class="h2">Absender</h2>
        <p><strong><?= e($absender['name'] ?? '') ?></strong><?= !empty($absender['firma']) ? '<br>' . e($absender['firma']) : '' ?><br><?= e($absender['strasse'] ?? '') ?><br><?= e(($absender['plz'] ?? '') . ' ' . ($absender['ort'] ?? '')) ?></p>
        <p class="leise" style="margin-top:.5rem"><a href="mailto:<?= e($b['email']) ?>"><?= e($b['email']) ?></a></p>
        <?php if ($firma !== null) { ?><p class="leise">Firma: <a href="<?= e(url('kunden/firmen/' . $firma['id'])) ?>"><?= e($firma['name']) ?></a></p><?php } elseif ($kunde !== null) { ?><p class="leise">Privatkunde: <a href="<?= e(url('kunden/privat/' . $kunde['id'])) ?>"><?= e($kunde['name']) ?></a></p><?php } ?>
      </div>
      <div class="karte">
        <h2 class="h2">Empfänger</h2>
        <p><strong><?= e($empfaenger['name'] ?? '') ?></strong><?= !empty($empfaenger['firma']) ? '<br>' . e($empfaenger['firma']) : '' ?><br><?= e($empfaenger['strasse'] ?? '') ?><br><?= e(($empfaenger['plz'] ?? '') . ' ' . ($empfaenger['ort'] ?? '')) ?><br><?= e($land) ?></p>
        <?php if (!empty($empfaenger['email']) || !empty($empfaenger['telefon'])) { ?><p class="leise" style="margin-top:.5rem"><?= e($empfaenger['email'] ?? '') ?><?= !empty($empfaenger['telefon']) ? ' · ' . e($empfaenger['telefon']) : '' ?></p><?php } ?>
      </div>
    </div>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2">Sendungsverlauf</h2><span class="leise">sieht der Kunde im Portal und im öffentlichen Tracking</span></div>
      <?php if ($sendungsereignisse === []) { ?><p class="leer">Noch keine Ereignisse.</p><?php } else { ?>
      <ol class="verlauf">
        <?php foreach (array_reverse($sendungsereignisse) as $ev) { ?>
          <li><span class="mono leise"><?= e(zeitAnzeigen($ev['zeit'])) ?></span><strong><?= e($ev['text_de']) ?></strong><?= $ev['ort'] !== '' ? ' · ' . e($ev['ort']) : '' ?><span class="leise"><?= e($ev['quelle']) ?><?= $ev['benutzer'] !== '' ? ' · ' . e($ev['benutzer']) : '' ?></span></li>
        <?php } ?>
      </ol>
      <?php } ?>
      <?php if (darf('bestellungen', 'bearbeiten') && !in_array($b['status'], ['offen', 'fehlgeschlagen', 'storniert'], true)) { ?>
      <form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/ereignis')) ?>" class="formular formular--zeile" style="margin-top:1rem">
        <?= csrfFeld() ?>
        <div class="feld"><label for="ev-code">Versandstatus setzen</label><select id="ev-code" name="code"><?php foreach (VERSANDSTATUS as $code => $n) { if (in_array($code, ['angelegt', 'bezahlt'], true)) { continue; } ?><option value="<?= e($code) ?>"><?= e($n['de']) ?></option><?php } ?></select></div>
        <div class="feld"><label for="ev-ort">Ort</label><input id="ev-ort" name="ort" maxlength="80" placeholder="z. B. Depot Mannheim"></div>
        <div class="feld feld--wachsen"><label for="ev-text">Text (optional, statt Standardtext)</label><input id="ev-text" name="text" maxlength="200"></div>
        <button class="knopf knopf--primaer" type="submit">Eintragen</button>
      </form>
      <?php } ?>
    </div>
    <div class="karte">
      <h2 class="h2">Interner Verlauf</h2>
      <ol class="verlauf">
        <?php foreach (array_reverse($ereignisse) as $ev) { ?>
          <li>
            <span class="mono leise"><?= e(zeitAnzeigen($ev['zeit'] ?? null)) ?></span>
            <strong><?= e($ev['ereignis'] ?? '') ?></strong> → <?= e(statusName((string) ($ev['status'] ?? ''))) ?>
            <?php $rest = array_diff_key($ev, ['zeit' => 1, 'ereignis' => 1, 'status' => 1]); if ($rest !== []) { ?><span class="leise"><?= e(json_encode($rest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?></span><?php } ?>
          </li>
        <?php } ?>
      </ol>
    </div>
  </div>
  <div>
    <div class="karte karte--ink">
      <h2 class="h2">Zahlung</h2>
      <dl class="liste liste--ink">
        <dt>Zahlungsart</dt><dd><?= e($zahlungsartName) ?></dd>
        <?php if ($b['zahlungsart'] === 'revolut') { ?><dt>Revolut-Order</dt><dd class="mono"><?= e($b['revolut_id'] ?? '—') ?></dd><dt>Bezahlt am</dt><dd><?= e(zeitAnzeigen($b['bezahlt'])) ?></dd><?php } ?>
        <?php if ($b['zahlungsart'] === 'rechnung') { ?><dt>Rechnung</dt><dd><?= $b['rechnung_id'] ? '<a href="' . e(url('rechnungen/' . $b['rechnung_id'])) . '">Rechnung ansehen</a>' : 'noch offen' ?></dd><?php } ?>
        <dt>Aktualisiert</dt><dd><?= e(zeitAnzeigen($b['aktualisiert'])) ?></dd>
      </dl>
    </div>
    <div class="karte">
      <h2 class="h2">Label</h2>
      <?php if ($b['art'] === 'nachberechnung') { ?><p class="leise">Reine Geldposition — kein Label.</p><?php } elseif ($labelDa) { ?>
        <a class="knopf knopf--primaer knopf--breit" href="<?= e(url('bestellungen/' . $b['ext_ref'] . '/label.pdf')) ?>" target="_blank" rel="noopener">Label (PDF, A6)</a>
        <p class="leise" style="margin-top:.5rem"><?= $b['label_datei'] === 'neos' || $b['label_datei'] === null ? 'NEOS-Label mit Strichcode — das Carrier-Label ersetzt es automatisch mit der Anbindung.' : 'Carrier-Label: ' . e($b['label_datei']) ?></p>
      <?php } else { ?><p class="leise">Das Label gibt es nach Zahlung bzw. Beauftragung.</p><?php } ?>
    </div>
    <?php if ($reklamationen !== []) { ?>
    <div class="karte karte--gelb">
      <h2 class="h2">Reklamationen</h2>
      <?php foreach ($reklamationen as $r) { ?>
        <p><?php if (darf('reklamationen')) { ?><a class="mono" href="<?= e(url('reklamationen/' . $r['id'])) ?>">#<?= (int) $r['id'] ?></a><?php } else { ?>#<?= (int) $r['id'] ?><?php } ?> <span class="status status--rk-<?= e($r['status']) ?>"><?= e(REKLAMATION_STATUS[$r['status']]['de'] ?? $r['status']) ?></span> <?= e(REKLAMATION_ARTEN[$r['art']]['de'] ?? $r['art']) ?><?= (int) $r['erstattung_cent'] > 0 ? ' · ' . e(euro((int) $r['erstattung_cent'])) . ' erstattet' : '' ?></p>
      <?php } ?>
    </div>
    <?php } ?>
    <?php if (darf('bestellungen', 'bearbeiten')) { ?>
    <div class="karte">
      <h2 class="h2">Aktionen</h2>
      <?php if ($b['zahlungsart'] === 'revolut') { ?><form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/sync')) ?>" class="aktion"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--breit" type="submit">Status bei Revolut abfragen</button></form><?php } ?>
      <form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/label')) ?>" class="aktion"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--breit" type="submit">Label neu erzeugen</button><span class="leise">setzt den Versandstatus auf „Label erstellt“</span></form>
      <form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/status')) ?>" class="aktion formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="grund">Bestellstatus manuell setzen</label>
          <select name="status" id="status-neu"><option value="bezahlt">Bezahlt (z. B. Überweisung)</option><option value="storniert">Storniert</option></select>
          <input id="grund" name="grund" type="text" placeholder="Grund (optional)" maxlength="200"></div>
        <button class="knopf knopf--primaer knopf--breit" type="submit">Status setzen</button>
      </form>
    </div>
    <?php } ?>
    <?php if (darf('bestellungen', 'loeschen')) { ?>
    <div class="karte">
      <form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/loeschen')) ?>" data-bestaetigen="Bestellung <?= e($b['ext_ref']) ?> endgültig löschen?">
        <?= csrfFeld() ?>
        <button class="knopf knopf--gefahr knopf--breit" type="submit" <?= $loeschbar ? '' : 'disabled' ?>>Bestellung löschen</button>
        <?php if (!$loeschbar) { ?><span class="leise">nur offene, fehlgeschlagene oder stornierte Bestellungen</span><?php } ?>
      </form>
    </div>
    <?php } ?>
  </div>
</div>
