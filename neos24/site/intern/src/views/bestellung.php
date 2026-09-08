<?php
$absender = json_decode((string) $b['absender_json'], true) ?: [];
$empfaenger = json_decode((string) $b['empfaenger_json'], true) ?: [];
$ereignisse = json_decode((string) $b['ereignisse_json'], true) ?: [];
$land = preisliste()['laender'][$b['zielland']]['name']['de'] ?? $b['zielland'];
$loeschbar = in_array($b['status'], ['offen', 'fehlgeschlagen', 'storniert'], true);
?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('bestellungen')) ?>">← Bestellungen</a><h1 class="h1 mono"><?= e($b['ext_ref']) ?></h1></div>
  <div><?= statusPille((string) $b['status']) ?></div>
</header>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2">Sendung</h2><span class="leise">angelegt <?= e(zeitAnzeigen($b['erstellt'])) ?></span></div>
      <div class="spalten spalten--2">
        <dl class="liste">
          <dt>Zielland</dt><dd><span class="flagge"><?= e($b['zielland']) ?></span><?= e($land) ?></dd>
          <dt>Gewichtsklasse</dt><dd><?= e($b['gewichtsklasse']) ?></dd>
          <dt>Carrier</dt><dd><?= e($b['carrier'] ?? '— (vor Routingmatrix)') ?></dd>
          <dt>Sprache</dt><dd><?= e(strtoupper((string) $b['sprache'])) ?></dd>
        </dl>
        <dl class="liste">
          <dt>Netto</dt><dd class="mono"><?= e(euro((int) $b['netto_cent'])) ?></dd>
          <dt>MwSt.</dt><dd class="mono"><?= e(euro((int) $b['mwst_cent'])) ?></dd>
          <dt>Brutto</dt><dd class="mono"><strong><?= e(euro((int) $b['betrag_cent'])) ?></strong></dd>
          <dt>Einkauf / Marge</dt><dd class="mono"><?= e(euro((int) $b['einkauf_cent'])) ?> / <?= e(euro((int) $b['netto_cent'] - (int) $b['einkauf_cent'])) ?></dd>
        </dl>
      </div>
    </div>
    <div class="spalten spalten--2">
      <div class="karte">
        <h2 class="h2">Absender</h2>
        <p><strong><?= e($absender['name'] ?? '') ?></strong><br><?= e($absender['strasse'] ?? '') ?><br><?= e(($absender['plz'] ?? '') . ' ' . ($absender['ort'] ?? '')) ?></p>
        <p class="leise" style="margin-top:.5rem"><a href="mailto:<?= e($b['email']) ?>"><?= e($b['email']) ?></a></p>
      </div>
      <div class="karte">
        <h2 class="h2">Empfänger</h2>
        <p><strong><?= e($empfaenger['name'] ?? '') ?></strong><br><?= e($empfaenger['strasse'] ?? '') ?><br><?= e(($empfaenger['plz'] ?? '') . ' ' . ($empfaenger['ort'] ?? '')) ?><br><?= e($land) ?></p>
      </div>
    </div>
    <div class="karte">
      <h2 class="h2">Verlauf</h2>
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
        <dt>Revolut-Order</dt><dd class="mono"><?= e($b['revolut_id'] ?? '—') ?></dd>
        <dt>Bezahlt am</dt><dd><?= e(zeitAnzeigen($b['bezahlt'])) ?></dd>
        <dt>Aktualisiert</dt><dd><?= e(zeitAnzeigen($b['aktualisiert'])) ?></dd>
      </dl>
    </div>
    <?php if (darf('bestellungen', 'bearbeiten')) { ?>
    <div class="karte">
      <h2 class="h2">Aktionen</h2>
      <form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/sync')) ?>" class="aktion"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--breit" type="submit">Status bei Revolut abfragen</button></form>
      <form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/label')) ?>" class="aktion"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--breit" type="submit">Label anfordern</button><span class="leise">vermerkt den Auftrag — Carrier-Anbindung folgt</span></form>
      <form method="post" action="<?= e(url('bestellungen/' . $b['ext_ref'] . '/status')) ?>" class="aktion formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="grund">Status manuell setzen</label>
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
