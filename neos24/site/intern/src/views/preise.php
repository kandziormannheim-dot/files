<?php
$darfB = darf('preise', 'bearbeiten');
$darfL = darf('preise', 'loeschen');
$bearbeitenLand = str_starts_with($bearbeiten, 'land:') ? substr($bearbeiten, 5) : '';
$bearbeitenGk = str_starts_with($bearbeiten, 'gk:') ? (int) substr($bearbeiten, 3) : 0;
$bearbeitenCarrier = str_starts_with($bearbeiten, 'carrier:') ? (int) substr($bearbeiten, 8) : 0;
$landForm = null;
foreach ($laender as $l) { if ($l['code'] === $bearbeitenLand) { $landForm = $l; } }
$gkForm = null;
foreach ($klassen as $g) { if ((int) $g['id'] === $bearbeitenGk) { $gkForm = $g; } }
$carrierForm = null;
foreach ($carrier as $c) { if ((int) $c['id'] === $bearbeitenCarrier) { $carrierForm = $c; } }
$bearbeitenZusatz = str_starts_with($bearbeiten, 'zusatz:') ? (int) substr($bearbeiten, 7) : 0;
$zusatzForm = null;
foreach ($zusatz as $z) { if ($z['id'] === $bearbeitenZusatz) { $zusatzForm = $z; } }
?>
<header class="kopfzeile">
  <div><span class="eyebrow">Preise &amp; Zielländer</span><h1 class="h1">Stammdaten</h1></div>
  <p class="leise">Preise selbst stehen in der <a href="<?= e(url('routing')) ?>">Routingmatrix</a> (Land × Gewichtsklasse).</p>
</header>

<div class="spalten spalten--2-1">
  <div class="karte karte--tabelle">
    <div class="karte-kopf"><h2 class="h2">Zielländer</h2><span class="leise"><?= count($laender) ?> Länder · nur aktive erscheinen auf der Startseite</span></div>
    <div class="scrollen">
    <table class="tabelle">
      <thead><tr><th>Code</th><th>Deutsch</th><th>Englisch</th><th class="rechts">Sortierung</th><th class="rechts">Routen</th><th>Aktiv</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($laender as $l) { ?>
        <tr class="<?= (int) $l['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <td><span class="flagge"><?= e($l['code']) ?></span></td>
          <td><?= e($l['name_de']) ?></td>
          <td><?= e($l['name_en']) ?></td>
          <td class="mono rechts"><?= (int) $l['sortierung'] ?></td>
          <td class="mono rechts"><?= (int) $l['routen'] ?></td>
          <td><?= (int) $l['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
          <td class="rechts zeilen-aktionen">
            <?php if ($darfB) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('preise', ['bearbeiten' => 'land:' . $l['code']])) ?>#formular-land">Bearbeiten</a><?php } ?>
            <?php if ($darfL && (int) $l['routen'] === 0) { ?><form method="post" action="<?= e(url('preise/land/loeschen')) ?>" data-bestaetigen="Land <?= e($l['code']) ?> löschen?"><?= csrfFeld() ?><input type="hidden" name="code" value="<?= e($l['code']) ?>"><button class="knopf knopf--gefahr knopf--klein" type="submit">Löschen</button></form><?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table>
    </div>
  </div>
  <?php if ($darfB) { ?>
  <div class="karte" id="formular-land">
    <h2 class="h2"><?= $landForm !== null ? 'Land ' . e($landForm['code']) . ' bearbeiten' : 'Neues Zielland' ?></h2>
    <form method="post" action="<?= e(url('preise/land')) ?>" class="formular">
      <?= csrfFeld() ?>
      <div class="feld"><label for="l-code">Ländercode (ISO-2)</label><input id="l-code" name="code" value="<?= e($landForm['code'] ?? '') ?>" pattern="[A-Za-z]{2}" maxlength="2" required <?= $landForm !== null ? 'readonly' : '' ?>></div>
      <div class="feld"><label for="l-de">Name deutsch</label><input id="l-de" name="name_de" value="<?= e($landForm['name_de'] ?? '') ?>" required></div>
      <div class="feld"><label for="l-en">Name englisch</label><input id="l-en" name="name_en" value="<?= e($landForm['name_en'] ?? '') ?>" required></div>
      <div class="feld"><label for="l-sort">Sortierung</label><input id="l-sort" name="sortierung" type="number" value="<?= e($landForm['sortierung'] ?? '100') ?>" min="0" max="9999"></div>
      <label class="schalter"><input type="checkbox" name="aktiv" <?= ($landForm === null || (int) $landForm['aktiv'] === 1) ? 'checked' : '' ?>> Aktiv (auf der Startseite und im Checkout)</label>
      <div class="formular-fuss"><button class="knopf knopf--primaer" type="submit">Speichern</button><?php if ($landForm !== null) { ?><a class="knopf knopf--leise" href="<?= e(url('preise')) ?>">Neu statt bearbeiten</a><?php } ?></div>
    </form>
    <p class="leise" style="margin-top:.75rem">Ein neues Land erscheint erst, wenn in der Routingmatrix mindestens ein Carrier mit Verkaufspreis eingetragen ist.</p>
  </div>
  <?php } ?>
</div>

<div class="spalten spalten--2">
  <div class="karte karte--tabelle">
    <div class="karte-kopf"><h2 class="h2">Gewichtsklassen</h2></div>
    <div class="scrollen">
    <table class="tabelle">
      <thead><tr><th>Kürzel</th><th>Kategorie</th><th>Deutsch</th><th>Englisch</th><th class="rechts">bis g</th><th class="rechts">Routen</th><th>Aktiv</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($klassen as $g) { ?>
        <tr class="<?= (int) $g['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <td class="mono"><?= e($g['code']) ?></td><td><?= e(kategorieName((string) ($g['kategorie'] ?? 'paket'))) ?></td><td><?= e($g['name_de']) ?></td><td><?= e($g['name_en']) ?></td>
          <td class="mono rechts"><?= (int) $g['max_gramm'] ?: '—' ?></td><td class="mono rechts"><?= (int) $g['routen'] ?></td>
          <td><?= (int) $g['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
          <td class="rechts zeilen-aktionen">
            <?php if ($darfB) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('preise', ['bearbeiten' => 'gk:' . $g['id']])) ?>#formular-gk">Bearbeiten</a><?php } ?>
            <?php if ($darfL && (int) $g['routen'] === 0) { ?><form method="post" action="<?= e(url('preise/gewichtsklasse/loeschen')) ?>" data-bestaetigen="Gewichtsklasse <?= e($g['code']) ?> löschen?"><?= csrfFeld() ?><input type="hidden" name="id" value="<?= (int) $g['id'] ?>"><button class="knopf knopf--gefahr knopf--klein" type="submit">Löschen</button></form><?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table>
    </div>
    <?php if ($darfB) { ?>
    <form method="post" action="<?= e(url('preise/gewichtsklasse')) ?>" class="formular formular--zeile" id="formular-gk">
      <?= csrfFeld() ?>
      <input type="hidden" name="id" value="<?= (int) ($gkForm['id'] ?? 0) ?>">
      <div class="feld"><label for="g-code">Kürzel</label><input id="g-code" name="code" value="<?= e($gkForm['code'] ?? '') ?>" pattern="[a-z0-9-]{1,12}" placeholder="5kg" required></div>
      <div class="feld"><label for="g-kat">Kategorie</label><select id="g-kat" name="kategorie"><?php foreach (['brief', 'paket'] as $kat) { ?><option value="<?= $kat ?>" <?= ($gkForm['kategorie'] ?? 'paket') === $kat ? 'selected' : '' ?>><?= e(kategorieName($kat)) ?></option><?php } ?></select></div>
      <div class="feld"><label for="g-de">Deutsch</label><input id="g-de" name="name_de" value="<?= e($gkForm['name_de'] ?? '') ?>" placeholder="bis 5 kg" required></div>
      <div class="feld"><label for="g-en">Englisch</label><input id="g-en" name="name_en" value="<?= e($gkForm['name_en'] ?? '') ?>" placeholder="up to 5 kg" required></div>
      <div class="feld"><label for="g-gramm">bis g</label><input id="g-gramm" name="max_gramm" type="number" value="<?= e($gkForm['max_gramm'] ?? '') ?>" min="0"></div>
      <div class="feld"><label for="g-sort">Sortierung</label><input id="g-sort" name="sortierung" type="number" value="<?= e($gkForm['sortierung'] ?? '100') ?>" min="0"></div>
      <label class="schalter"><input type="checkbox" name="aktiv" <?= ($gkForm === null || (int) $gkForm['aktiv'] === 1) ? 'checked' : '' ?>> Aktiv</label>
      <button class="knopf knopf--primaer" type="submit"><?= $gkForm !== null ? 'Speichern' : 'Anlegen' ?></button>
    </form>
    <?php } ?>
  </div>
  <div class="karte karte--tabelle">
    <div class="karte-kopf"><h2 class="h2">Carrier</h2></div>
    <div class="scrollen">
    <table class="tabelle">
      <thead><tr><th>Name</th><th class="rechts">Routen</th><th class="rechts">Volumenfaktor</th><th class="rechts">Gewichtsgebühr</th><th>Aktiv</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($carrier as $c) { ?>
        <tr class="<?= (int) $c['aktiv'] === 1 ? '' : 'inaktiv' ?>">
          <td><?= e($c['name']) ?></td><td class="mono rechts"><?= (int) $c['routen'] ?></td><td class="mono rechts"><?= (int) ($c['volumenfaktor'] ?? 5000) ?></td><td class="mono rechts"><?= (int) ($c['gewichtsgebuehr_cent'] ?? 0) > 0 ? e(euro((int) $c['gewichtsgebuehr_cent'])) : '—' ?></td>
          <td><?= (int) $c['aktiv'] === 1 ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
          <td class="rechts zeilen-aktionen">
            <?php if ($darfB) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('preise', ['bearbeiten' => 'carrier:' . $c['id']])) ?>#formular-carrier">Bearbeiten</a><?php } ?>
            <?php if ($darfL && (int) $c['routen'] === 0) { ?><form method="post" action="<?= e(url('preise/carrier/loeschen')) ?>" data-bestaetigen="Carrier <?= e($c['name']) ?> löschen?"><?= csrfFeld() ?><input type="hidden" name="id" value="<?= (int) $c['id'] ?>"><button class="knopf knopf--gefahr knopf--klein" type="submit">Löschen</button></form><?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table>
    </div>
    <?php if ($darfB) { ?>
    <form method="post" action="<?= e(url('preise/carrier')) ?>" class="formular formular--zeile" id="formular-carrier">
      <?= csrfFeld() ?>
      <input type="hidden" name="id" value="<?= (int) ($carrierForm['id'] ?? 0) ?>">
      <div class="feld feld--wachsen"><label for="c-name">Carrier</label><input id="c-name" name="name" value="<?= e($carrierForm['name'] ?? '') ?>" placeholder="z. B. Hermes" required></div>
      <div class="feld"><label for="c-volumen">Volumenfaktor</label><input id="c-volumen" name="volumenfaktor" type="number" min="0" max="20000" value="<?= (int) ($carrierForm['volumenfaktor'] ?? 5000) ?>" style="width:6.5rem"></div>
      <div class="feld"><label for="c-gebuehr">Gewichtsgebühr €</label><input id="c-gebuehr" name="gewichtsgebuehr" inputmode="decimal" value="<?= (int) ($carrierForm['gewichtsgebuehr_cent'] ?? 0) > 0 ? e(number_format((int) $carrierForm['gewichtsgebuehr_cent'] / 100, 2, ',', '')) : '' ?>" placeholder="2,20" style="width:6rem"></div>
      <label class="schalter"><input type="checkbox" name="aktiv" <?= ($carrierForm === null || (int) $carrierForm['aktiv'] === 1) ? 'checked' : '' ?>> Aktiv</label>
      <button class="knopf knopf--primaer" type="submit"><?= $carrierForm !== null ? 'Speichern' : 'Anlegen' ?></button>
    </form>
    <p class="leise" style="margin-top:.75rem">Ein deaktivierter Carrier fällt in der Routingmatrix aus; die nächste Priorität rückt nach. Volumenfaktor: L × B × H (cm) ÷ Faktor = Volumengewicht in kg (DHL 5000); 0 = kein Volumengewicht. Gewichtsgebühr: Zuschlag des Carriers je Paket mit Gewichtsabweichung — wird bei Nachberechnungen an den Kunden weitergegeben, wenn der Carrier ihn berechnet hat.</p>
    <?php } ?>
  </div>
</div>

<div class="karte karte--tabelle" id="formular-zusatz">
  <div class="karte-kopf"><h2 class="h2">Zusatzleistungen</h2><span class="leise">Nettopreise je Sendung · Abholung, Versicherung und Nachnahme fragen im Portal Zusatzfelder ab (Termin, Warenwert, Betrag)</span></div>
  <div class="scrollen">
  <table class="tabelle">
    <thead><tr><th>Kürzel</th><th>Deutsch</th><th>Englisch</th><th class="rechts">Netto</th><th class="rechts">Sortierung</th><th>Aktiv</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($zusatz as $z) { ?>
      <tr class="<?= $z['aktiv'] ? '' : 'inaktiv' ?>">
        <td class="mono"><?= e($z['code']) ?></td>
        <td><?= e($z['name']['de']) ?><br><span class="leise"><?= e($z['beschreibung']['de']) ?></span></td>
        <td><?= e($z['name']['en']) ?><br><span class="leise"><?= e($z['beschreibung']['en']) ?></span></td>
        <td class="mono rechts"><?= e(euro($z['preis'])) ?></td>
        <td class="mono rechts"><?= $z['sortierung'] ?></td>
        <td><?= $z['aktiv'] ? '<span class="ja">✓</span>' : '<span class="nein">–</span>' ?></td>
        <td class="rechts zeilen-aktionen">
          <?php if ($darfB) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('preise', ['bearbeiten' => 'zusatz:' . $z['id']])) ?>#formular-zusatz">Bearbeiten</a><?php } ?>
          <?php if ($darfL) { ?><form method="post" action="<?= e(url('preise/zusatz/loeschen')) ?>" data-bestaetigen="Zusatzleistung <?= e($z['code']) ?> löschen?"><?= csrfFeld() ?><input type="hidden" name="id" value="<?= $z['id'] ?>"><button class="knopf knopf--gefahr knopf--klein" type="submit">Löschen</button></form><?php } ?>
        </td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
  <?php if ($darfB) { ?>
  <form method="post" action="<?= e(url('preise/zusatz')) ?>" class="formular formular--zeile" style="margin-top:1rem">
    <?= csrfFeld() ?>
    <input type="hidden" name="id" value="<?= (int) ($zusatzForm['id'] ?? 0) ?>">
    <div class="feld"><label for="z-code">Kürzel</label><input id="z-code" name="code" value="<?= e($zusatzForm['code'] ?? '') ?>" pattern="[a-z0-9_]{2,20}" placeholder="sperrgut" required></div>
    <div class="feld"><label for="z-de">Deutsch</label><input id="z-de" name="name_de" value="<?= e($zusatzForm['name']['de'] ?? '') ?>" required></div>
    <div class="feld"><label for="z-en">Englisch</label><input id="z-en" name="name_en" value="<?= e($zusatzForm['name']['en'] ?? '') ?>" required></div>
    <div class="feld"><label for="z-preis">Netto €</label><input id="z-preis" name="preis" value="<?= $zusatzForm !== null ? e(number_format($zusatzForm['preis'] / 100, 2, ',', '')) : '' ?>" inputmode="decimal" placeholder="2,90" required></div>
    <div class="feld"><label for="z-sort">Sortierung</label><input id="z-sort" name="sortierung" type="number" value="<?= e($zusatzForm['sortierung'] ?? '100') ?>" min="0"></div>
    <div class="feld feld--wachsen"><label for="z-bde">Beschreibung deutsch</label><input id="z-bde" name="beschreibung_de" value="<?= e($zusatzForm['beschreibung']['de'] ?? '') ?>"></div>
    <div class="feld feld--wachsen"><label for="z-ben">Beschreibung englisch</label><input id="z-ben" name="beschreibung_en" value="<?= e($zusatzForm['beschreibung']['en'] ?? '') ?>"></div>
    <label class="schalter"><input type="checkbox" name="aktiv" <?= ($zusatzForm === null || $zusatzForm['aktiv']) ? 'checked' : '' ?>> Aktiv</label>
    <button class="knopf knopf--primaer" type="submit"><?= $zusatzForm !== null ? 'Speichern' : 'Anlegen' ?></button>
    <?php if ($zusatzForm !== null) { ?><a class="knopf knopf--leise" href="<?= e(url('preise')) ?>#formular-zusatz">Neu statt bearbeiten</a><?php } ?>
  </form>
  <?php } ?>
</div>
