<?php
$darfB = darf('kunden', 'bearbeiten');
$konto = $liste['unterkunde_id'] ? $liste['unterkunde'] . ' (' . $liste['unterkunde_nummer'] . ')' : ($liste['firma_id'] ? $liste['firma'] : ($liste['kunde_name'] ?: $liste['kunde_email']));
$eigene = 0;
foreach ($matrix as $land) { foreach ($land as $zelle) { foreach ($zelle as $a) { if ($a['liste'] !== null) { $eigene++; } } } }
?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e($zurueck) ?>">← <?= e($konto) ?></a><h1 class="h1">Preisliste <?= e($liste['name']) ?><?= (int) $liste['aktiv'] === 1 ? '' : ' <span class="pille pille--warn">inaktiv</span>' ?></h1></div>
  <p class="leise">Eigene Verkaufspreise netto je Zielland, Gewichtsklasse und Carrier für <?= e($konto) ?>. <?= $eigene ?> Zellen mit eigenem Preis · leere Zellen: <?= $liste['fehlend'] === 'nicht' ? 'nicht anbieten' : 'Standardpreis der Routingmatrix' ?>.</p>
</header>
<div class="spalten spalten--2-1">
  <div>
    <form method="post" action="<?= e(url('kunden/preisliste/' . $liste['id'] . '/zellen')) ?>" class="karte karte--tabelle">
      <?= csrfFeld() ?>
      <div class="karte-kopf"><h2 class="h2">Matrix</h2><?php if ($darfB) { ?><button class="knopf knopf--primaer knopf--klein" type="submit">Preise speichern</button><?php } ?></div>
      <div class="scrollen">
      <table class="tabelle matrix matrix--preisliste">
        <thead><tr><th>Zielland</th><?php foreach ($klassen as $g) { ?><th><?= e($g['name_de']) ?> <span class="mono leise" style="text-transform:none"><?= e($g['code']) ?></span></th><?php } ?></tr></thead>
        <tbody>
        <?php foreach ($laender as $l) { ?>
          <tr>
            <th scope="row"><span class="flagge"><?= e($l['code']) ?></span><?= e($l['name_de']) ?></th>
            <?php foreach ($klassen as $g) { $angebote = $matrix[$l['code']][(int) $g['id']] ?? []; ?>
              <td class="zelle <?= $angebote === [] ? 'zelle--leer' : '' ?>">
                <?php if ($angebote === []) { ?><span class="leise">nicht angeboten</span><?php } else { foreach ($angebote as $a) { ?>
                  <label class="pl-zelle <?= $a['liste'] !== null ? 'pl-zelle--eigen' : '' ?>">
                    <span class="pl-carrier"><?= e($a['carrier']) ?><?= $a['prioritaet'] === 1 ? '' : ' <span class="leise">P' . $a['prioritaet'] . '</span>' ?></span>
                    <input class="mono" name="zelle[<?= e($l['code']) ?>][<?= (int) $g['id'] ?>][<?= $a['carrier_id'] ?>]" value="<?= $a['liste'] !== null ? e(number_format($a['liste'] / 100, 2, ',', '')) : '' ?>" placeholder="<?= e(number_format($a['standard'] / 100, 2, ',', '')) ?>" inputmode="decimal" size="6" <?= $darfB ? '' : 'readonly' ?> aria-label="<?= e($l['code'] . ' ' . $g['code'] . ' ' . $a['carrier']) ?>">
                    <span class="leise">Std. <?= e(euro($a['standard'])) ?> · EK <?= e(euro($a['einkauf'])) ?><?= $a['liste'] !== null && $a['liste'] <= $a['einkauf'] ? ' · <strong class="ueberfaellig">unter Einkauf</strong>' : '' ?></span>
                  </label>
                <?php } } ?>
              </td>
            <?php } ?>
          </tr>
        <?php } ?>
        </tbody>
      </table>
      </div>
      <p class="leise" style="margin-top:.75rem">Leeres Feld = kein eigener Preis (Standard bzw. nicht anbieten). Preise netto in Euro; Privatkunden zahlen zuzüglich <?= $mwst ?> % MwSt.</p>
    </form>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Zusatzleistungen</h2></div>
      <form method="post" action="<?= e(url('kunden/preisliste/' . $liste['id'] . '/zusatz')) ?>" class="formular">
        <?= csrfFeld() ?>
        <div class="scrollen"><table class="tabelle tabelle--kompakt">
          <thead><tr><th>Leistung</th><th class="rechts">Standard</th><th class="rechts">Eigener Preis netto €</th></tr></thead>
          <tbody>
          <?php foreach ($zusatz as $code => $z) { ?>
            <tr><td><?= e($z['name']['de']) ?> <span class="leise mono"><?= e($code) ?></span></td><td class="mono rechts"><?= e(euro((int) $z['standard'])) ?></td><td class="rechts"><input class="mono" name="zusatz[<?= e($code) ?>]" value="<?= $z['listenpreis'] ? e(number_format((int) $z['preis'] / 100, 2, ',', '')) : '' ?>" inputmode="decimal" size="7" <?= $darfB ? '' : 'readonly' ?>></td></tr>
          <?php } ?>
          </tbody>
        </table></div>
        <?php if ($darfB) { ?><div class="formular-fuss"><button class="knopf knopf--leise" type="submit">Zusatzpreise speichern</button></div><?php } ?>
      </form>
    </div>
  </div>
  <div>
    <div class="karte karte--ink">
      <h2 class="h2">Einstellungen</h2>
      <form method="post" action="<?= e(url('kunden/preisliste/' . $liste['id'] . '/einstellungen')) ?>" class="formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="pl-name">Bezeichnung</label><input id="pl-name" name="name" value="<?= e($liste['name']) ?>" maxlength="80" <?= $darfB ? '' : 'readonly' ?>></div>
        <div class="feld"><label for="pl-fehlend">Zellen ohne eigenen Preis</label><select id="pl-fehlend" name="fehlend" <?= $darfB ? '' : 'disabled' ?>><option value="standard" <?= $liste['fehlend'] === 'standard' ? 'selected' : '' ?>>Standardpreis der Routingmatrix</option><option value="nicht" <?= $liste['fehlend'] === 'nicht' ? 'selected' : '' ?>>nicht anbieten</option></select></div>
        <div class="feld"><label for="pl-notiz">Notiz (intern)</label><textarea id="pl-notiz" name="notiz" rows="3" <?= $darfB ? '' : 'readonly' ?>><?= e($liste['notiz']) ?></textarea></div>
        <label class="schalter"><input type="checkbox" name="aktiv" value="1" <?= (int) $liste['aktiv'] === 1 ? 'checked' : '' ?> <?= $darfB ? '' : 'disabled' ?>> Aktiv (sonst gilt der Standard)</label>
        <?php if ($darfB) { ?><button class="knopf knopf--leise knopf--breit" type="submit">Speichern</button><?php } ?>
        <p class="leise" style="margin-top:.5rem">zuletzt <?= e(zeitAnzeigen($liste['aktualisiert'])) ?> von <?= e($liste['aktualisiert_von']) ?></p>
      </form>
    </div>
    <?php if ($darfB) { ?>
    <div class="karte">
      <h2 class="h2">Preisliste importieren</h2>
      <form method="post" action="<?= e(url('kunden/preisliste/' . $liste['id'] . '/import')) ?>" enctype="multipart/form-data" class="formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="pl-datei">XLSX oder CSV (Zeilen = Länder, Spalten = Gewichtsgrenzen)</label><input id="pl-datei" name="datei" type="file" accept=".xlsx,.csv,.txt" required></div>
        <label class="schalter"><input type="checkbox" name="alle_carrier" value="1"> Preis für alle Carrier der Zelle setzen (sonst nur Priorität 1)</label>
        <button class="knopf knopf--leise knopf--breit" type="submit">Übernehmen</button>
        <span class="leise">Preise netto in Euro. Vorhandene Zellen werden überschrieben, andere bleiben.</span>
      </form>
    </div>
    <?php } ?>
    <?php if (darf('kunden', 'loeschen')) { ?>
    <div class="karte"><form method="post" action="<?= e(url('kunden/preisliste/' . $liste['id'] . '/loeschen')) ?>" data-bestaetigen="Preisliste löschen? Das Konto rechnet danach mit der Routingmatrix; bestehende Bestellungen behalten ihre Preise."><?= csrfFeld() ?><button class="knopf knopf--gefahr knopf--breit" type="submit">Preisliste löschen</button></form></div>
    <?php } ?>
    <div class="karte karte--gelb">
      <h2 class="h2">So wirkt die Liste</h2>
      <p class="leise">Im Portal sieht der Kunde diese Preise beim Anlegen einer Sendung und unter „Preise“. Jede Bestellung merkt sich die Liste; eine Gewichtsnachberechnung rechnet die Differenz der Klassen mit genau diesen Konditionen.</p>
    </div>
  </div>
</div>
