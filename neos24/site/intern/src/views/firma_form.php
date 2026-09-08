<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('kunden', ['reiter' => 'firmen'])) ?>">← Firmen</a><h1 class="h1">Firmenkonto anlegen</h1></div>
</header>
<?php if ($fehler !== null) { ?><p class="hinweis hinweis--fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
<?php if ($anfrage !== null) { ?><p class="hinweis">Aus Anfrage von <?= e($anfrage['name']) ?> (<?= e($anfrage['email']) ?>). Die Anfrage wird auf „Konto angelegt“ gesetzt.</p><?php } ?>
<form method="post" action="<?= e(url('kunden/firmen/neu')) ?>" class="formular">
  <?= csrfFeld() ?>
  <input type="hidden" name="anfrage_id" value="<?= (int) ($anfrage['id'] ?? 0) ?>">
  <div class="spalten spalten--2">
    <div class="karte">
      <h2 class="h2">Firma</h2>
      <div class="feld"><label for="name">Firmenname</label><input id="name" name="name" value="<?= e($werte['name']) ?>" required></div>
      <div class="feld"><label for="strasse">Straße und Hausnummer</label><input id="strasse" name="strasse" value="<?= e($werte['strasse']) ?>"></div>
      <div class="spalten spalten--2">
        <div class="feld"><label for="plz">PLZ</label><input id="plz" name="plz" value="<?= e($werte['plz']) ?>"></div>
        <div class="feld"><label for="ort">Ort</label><input id="ort" name="ort" value="<?= e($werte['ort']) ?>"></div>
      </div>
      <div class="spalten spalten--2">
        <div class="feld"><label for="land">Land (ISO-2)</label><input id="land" name="land" value="<?= e($werte['land']) ?>" maxlength="2"></div>
        <div class="feld"><label for="ust_id">USt-IdNr.</label><input id="ust_id" name="ust_id" value="<?= e($werte['ust_id']) ?>"></div>
      </div>
      <div class="feld"><label for="rechnungs_email">E-Mail für Rechnungen</label><input id="rechnungs_email" name="rechnungs_email" type="email" value="<?= e($werte['rechnungs_email']) ?>"></div>
      <p class="leise">Anschrift kann der Inhaber später im Portal ergänzen; ohne Anschrift lassen sich noch keine Sendungen anlegen.</p>
    </div>
    <div class="karte">
      <h2 class="h2">Inhaber (erster Benutzer)</h2>
      <div class="feld"><label for="inhaber_name">Name</label><input id="inhaber_name" name="inhaber_name" value="<?= e($werte['inhaber_name']) ?>" required></div>
      <div class="feld"><label for="inhaber_email">E-Mail (Anmeldename)</label><input id="inhaber_email" name="inhaber_email" type="email" value="<?= e($werte['inhaber_email']) ?>" required></div>
      <div class="feld"><label for="sprache">Sprache</label><select id="sprache" name="sprache"><option value="de" <?= $werte['sprache'] !== 'en' ? 'selected' : '' ?>>Deutsch</option><option value="en" <?= $werte['sprache'] === 'en' ? 'selected' : '' ?>>English</option></select></div>
      <p class="leise">Der Inhaber bekommt eine Einladung per E-Mail (7 Tage gültig), setzt ein Passwort und kann weitere Benutzer einladen.</p>
      <div class="formular-fuss" style="margin-top:1rem"><button class="knopf knopf--primaer" type="submit">Firmenkonto anlegen und einladen</button></div>
    </div>
  </div>
</form>
