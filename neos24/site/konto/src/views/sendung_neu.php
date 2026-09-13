<?php
$sp = sprache();
$f = static fn (string $name) => in_array($name, $fehler, true) ? 'is-invalid' : '';
$absenderBuch = array_values(array_filter($adressen, static fn (array $a): bool => $a['art'] === 'absender'));
$empfaengerBuch = array_values(array_filter($adressen, static fn (array $a): bool => $a['art'] === 'empfaenger'));
$morgen = gmdate('Y-m-d', strtotime('tomorrow'));
$daten = $angebote; // Angebote je Land/Klasse, Zusatzleistungen, MwSt. (JSON für konto.js)
$zusatzAlle = $daten['zusatz'];
?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url($business ? 'sendungen' : 'bestellungen')) ?>"><?= e(t('detail.zurueck')) ?></a><h1 class="h2"><?= e(t('neu.titel')) ?></h1><p class="k-text"><?= e(t($business ? 'neu.text.business' : 'neu.text.privat')) ?></p></div>
</header>
<?php if ($meldung !== null) { ?><p class="k-hinweis k-hinweis--fehler" role="alert"><?= e($meldung) ?></p><?php } ?>
<form method="post" action="<?= e(url('sendungen/neu')) ?>" class="form k-form k-sendung" novalidate data-mwst="<?= (int) $daten['mwst'] ?>" data-sprache="<?= e($sp) ?>" data-guthaben="<?= (int) $guthaben ?>">
  <?= csrfFeld() ?>
  <script type="application/json" id="angebote-daten"><?= json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
  <script type="application/json" id="adressen-daten"><?= json_encode(['absender' => $absenderBuch, 'empfaenger' => $empfaengerBuch, 'vorlagen' => array_map(static fn (array $v): array => $v + ['zusatz' => json_decode((string) $v['zusatz_json'], true) ?: []], $vorlagen)], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
  <div class="k-spalten k-spalten--2-1">
    <div>
      <div class="card">
        <h2 class="h3"><?= e(t('neu.paket')) ?></h2>
        <div class="form-row form-row--2">
          <div class="field <?= $f('zielland') ?>">
            <label for="s-land"><?= e(t('neu.zielland')) ?></label>
            <select id="s-land" name="zielland" required>
              <option value=""><?= e(t('neu.bitte_waehlen')) ?></option>
              <?php foreach ($daten['laender'] as $code => $land) { ?><option value="<?= e($code) ?>" <?= $werte['zielland'] === $code ? 'selected' : '' ?>><?= e($land['name']) ?></option><?php } ?>
            </select>
          </div>
          <div class="field <?= $f('gewicht') ?>">
            <label for="s-gewicht"><?= e(t('neu.gewicht_kg')) ?></label>
            <input id="s-gewicht" name="gewicht_kg" type="text" inputmode="decimal" value="<?= e($werte['gewicht_kg']) ?>" placeholder="1,5" required>
            <span class="k-klein" data-gewichtsklasse></span>
          </div>
        </div>
        <div class="form-row form-row--2">
          <div class="field">
            <label for="s-laenge"><?= e(t('neu.masse')) ?></label>
            <div class="k-masse"><input id="s-laenge" name="laenge" type="number" min="0" max="200" value="<?= e($werte['laenge']) ?>" placeholder="L" aria-label="L"><span>×</span><input name="breite" type="number" min="0" max="200" value="<?= e($werte['breite']) ?>" placeholder="B" aria-label="B"><span>×</span><input name="hoehe" type="number" min="0" max="200" value="<?= e($werte['hoehe']) ?>" placeholder="H" aria-label="H"></div>
          </div>
          <div class="field">
            <label for="s-vorlage"><?= e(t('neu.vorlage')) ?></label>
            <select id="s-vorlage" data-vorlage>
              <option value=""><?= e(t('neu.vorlage.keine')) ?></option>
              <?php foreach ($vorlagen as $v) { ?><option value="<?= (int) $v['id'] ?>"><?= e($v['name']) ?> · <?= e(number_format((int) $v['gewicht_gramm'] / 1000, 1, ',', '')) ?> kg</option><?php } ?>
            </select>
          </div>
        </div>
        <div class="field"><label for="s-referenz"><?= e(t('neu.referenz')) ?></label><input id="s-referenz" name="referenz" type="text" maxlength="60" value="<?= e($werte['referenz']) ?>"><span class="k-klein"><?= e(t('neu.referenz.hinweis')) ?></span></div>
      </div>

      <div class="card <?= $f('carrier') ?>">
        <div class="k-karte-kopf"><h2 class="h3"><?= e(t('neu.carrier')) ?></h2><span class="k-klein"><?= e(t('neu.carrier.hinweis')) ?></span></div>
        <div class="k-angebote" data-angebote data-gewaehlt="<?= e($werte['carrier']) ?>" data-leer="<?= e(t('neu.carrier.leer')) ?>" data-empfohlen="<?= e(t('neu.carrier.empfohlen')) ?>" data-netto="<?= e(t('neu.summe.netto')) ?>" data-brutto="<?= e(t('neu.summe.brutto')) ?>">
          <p class="k-leer"><?= e(t('neu.carrier.leer')) ?></p>
        </div>
      </div>

      <div class="card">
        <h2 class="h3"><?= e(t('neu.zusatz')) ?></h2>
        <div class="k-zusatz">
          <?php foreach ($zusatzAlle as $code => $z) { ?>
            <label class="k-zusatz-zeile">
              <input type="checkbox" name="zusatz[]" value="<?= e($code) ?>" data-preis="<?= (int) $z['preis'] ?>" <?= in_array($code, $werte['zusatz'], true) ? 'checked' : '' ?>>
              <span><strong><?= e($z['name']) ?></strong><br><span class="k-klein"><?= e($z['beschreibung']) ?></span></span>
              <span class="k-mono">+ <?= e(euro((int) $z['preis'], $sp)) ?></span>
            </label>
            <?php if ($code === 'abholung') { ?>
              <div class="k-zusatz-detail form-row form-row--2 <?= $f('abholung') ?>" data-zusatz-detail="abholung" hidden>
                <div class="field"><label for="s-abholung"><?= e(t('neu.abholung.datum')) ?></label><input id="s-abholung" name="abholung_datum" type="date" min="<?= e($morgen) ?>" value="<?= e($werte['abholung_datum']) ?>"></div>
                <div class="field"><label for="s-fenster"><?= e(t('neu.abholung.fenster')) ?></label><select id="s-fenster" name="abholung_fenster"><option value="9-13" <?= $werte['abholung_fenster'] === '9-13' ? 'selected' : '' ?>>9–13 h</option><option value="13-17" <?= $werte['abholung_fenster'] === '13-17' ? 'selected' : '' ?>>13–17 h</option></select></div>
              </div>
            <?php } elseif ($code === 'versicherung') { ?>
              <div class="k-zusatz-detail" data-zusatz-detail="versicherung" hidden><div class="field"><label for="s-vers"><?= e(t('neu.versicherung.wert')) ?></label><input id="s-vers" name="versicherung_wert" type="text" inputmode="decimal" value="<?= e($werte['versicherung_wert']) ?>" placeholder="120,00"></div></div>
            <?php } elseif ($code === 'nachnahme') { ?>
              <div class="k-zusatz-detail <?= $f('nachnahme') ?>" data-zusatz-detail="nachnahme" hidden><div class="field <?= $f('nachnahme') ?>"><label for="s-nn"><?= e(t('neu.nachnahme.betrag')) ?></label><input id="s-nn" name="nachnahme" type="text" inputmode="decimal" value="<?= e($werte['nachnahme']) ?>" placeholder="49,90"></div></div>
            <?php } ?>
          <?php } ?>
        </div>
      </div>

      <div class="card">
        <div class="k-karte-kopf"><h2 class="h3"><?= e(t('neu.empfaenger')) ?></h2>
          <?php if ($empfaengerBuch !== []) { ?><select class="k-adresswahl" data-adresswahl="empfaenger" aria-label="<?= e(t('neu.adresse.aus_buch')) ?>"><option value=""><?= e(t('neu.adresse.aus_buch')) ?></option><?php foreach ($empfaengerBuch as $a) { ?><option value="<?= (int) $a['id'] ?>"><?= e($a['name']) ?>, <?= e($a['ort']) ?></option><?php } ?></select><?php } ?>
        </div>
        <div class="form-row form-row--2">
          <div class="field <?= $f('empfaenger.name') ?>"><label for="e-name"><?= e(t('neu.name')) ?></label><input id="e-name" name="empfaenger[name]" type="text" value="<?= e($werte['empfaenger']['name']) ?>" required></div>
          <div class="field"><label for="e-firma"><?= e(t('neu.firma')) ?></label><input id="e-firma" name="empfaenger[firma]" type="text" value="<?= e($werte['empfaenger']['firma']) ?>"></div>
        </div>
        <div class="field <?= $f('empfaenger.strasse') ?>"><label for="e-strasse"><?= e(t('neu.strasse')) ?></label><input id="e-strasse" name="empfaenger[strasse]" type="text" value="<?= e($werte['empfaenger']['strasse']) ?>" required></div>
        <div class="form-row form-row--plz">
          <div class="field <?= $f('empfaenger.plz') ?>"><label for="e-plz"><?= e(t('neu.plz')) ?></label><input id="e-plz" name="empfaenger[plz]" type="text" value="<?= e($werte['empfaenger']['plz']) ?>" required></div>
          <div class="field <?= $f('empfaenger.ort') ?>"><label for="e-ort"><?= e(t('neu.ort')) ?></label><input id="e-ort" name="empfaenger[ort]" type="text" value="<?= e($werte['empfaenger']['ort']) ?>" required></div>
        </div>
        <div class="form-row form-row--2">
          <div class="field <?= $f('empfaenger.email') ?>"><label for="e-email"><?= e(t('neu.email')) ?></label><input id="e-email" name="empfaenger[email]" type="email" value="<?= e($werte['empfaenger']['email']) ?>"></div>
          <div class="field"><label for="e-tel"><?= e(t('neu.telefon')) ?></label><input id="e-tel" name="empfaenger[telefon]" type="tel" value="<?= e($werte['empfaenger']['telefon']) ?>"></div>
        </div>
        <label class="k-schalter"><input type="checkbox" name="adresse_speichern" value="1" <?= $werte['adresse_speichern'] ? 'checked' : '' ?>> <?= e(t('neu.adresse.speichern')) ?></label>
      </div>

      <div class="card">
        <div class="k-karte-kopf"><h2 class="h3"><?= e(t('neu.absender')) ?></h2>
          <?php if ($absenderBuch !== []) { ?><select class="k-adresswahl" data-adresswahl="absender" aria-label="<?= e(t('neu.adresse.aus_buch')) ?>"><option value=""><?= e(t('neu.adresse.aus_buch')) ?></option><?php foreach ($absenderBuch as $a) { ?><option value="<?= (int) $a['id'] ?>"><?= e($a['name']) ?>, <?= e($a['ort']) ?></option><?php } ?></select><?php } ?>
        </div>
        <div class="form-row form-row--2">
          <div class="field <?= $f('absender.name') ?>"><label for="a-name"><?= e(t('neu.name')) ?></label><input id="a-name" name="absender[name]" type="text" value="<?= e($werte['absender']['name']) ?>" required></div>
          <div class="field"><label for="a-firma"><?= e(t('neu.firma')) ?></label><input id="a-firma" name="absender[firma]" type="text" value="<?= e($werte['absender']['firma'] ?? '') ?>"></div>
        </div>
        <div class="field <?= $f('absender.strasse') ?>"><label for="a-strasse"><?= e(t('neu.strasse')) ?></label><input id="a-strasse" name="absender[strasse]" type="text" value="<?= e($werte['absender']['strasse']) ?>" required></div>
        <div class="form-row form-row--plz">
          <div class="field <?= $f('absender.plz') ?>"><label for="a-plz"><?= e(t('neu.plz')) ?></label><input id="a-plz" name="absender[plz]" type="text" value="<?= e($werte['absender']['plz']) ?>" required></div>
          <div class="field <?= $f('absender.ort') ?>"><label for="a-ort"><?= e(t('neu.ort')) ?></label><input id="a-ort" name="absender[ort]" type="text" value="<?= e($werte['absender']['ort']) ?>" required></div>
        </div>
        <input type="hidden" name="absender[land]" value="<?= e($werte['absender']['land'] ?? 'DE') ?>">
        <input type="hidden" name="absender[email]" value="<?= e($werte['absender']['email'] ?? '') ?>">
        <input type="hidden" name="absender[telefon]" value="<?= e($werte['absender']['telefon'] ?? '') ?>">
      </div>
    </div>

    <div>
      <div class="card card--ink k-summe">
        <span class="eyebrow eyebrow--cyan"><?= e(t('neu.summe.brutto')) ?></span>
        <div class="k-summe-wert k-mono" data-summe="brutto">—</div>
        <dl class="k-liste k-liste--ink">
          <dt><?= e(t('liste.carrier')) ?></dt><dd data-summe="carrier">—</dd>
          <dt><?= e(t('detail.laufzeit')) ?></dt><dd data-summe="laufzeit">—</dd>
          <dt><?= e(t('neu.summe.porto')) ?></dt><dd class="k-mono" data-summe="porto">—</dd>
          <dt><?= e(t('neu.summe.zusatz')) ?></dt><dd class="k-mono" data-summe="zusatz">—</dd>
          <dt><?= e(t('neu.summe.netto')) ?></dt><dd class="k-mono" data-summe="netto">—</dd>
          <dt><?= e(t('neu.summe.mwst')) ?></dt><dd class="k-mono" data-summe="mwst">—</dd>
        </dl>
        <fieldset class="k-zahlung">
          <legend class="k-klein"><?= e(t('neu.zahlung')) ?></legend>
          <?php if ($business) { ?>
            <label><input type="radio" name="zahlungsart" value="rechnung" <?= $werte['zahlungsart'] !== 'guthaben' ? 'checked' : '' ?>> <?= e(t('neu.zahlung.rechnung')) ?></label>
            <label><input type="radio" name="zahlungsart" value="guthaben" data-guthaben-wahl <?= $werte['zahlungsart'] === 'guthaben' ? 'checked' : '' ?>> <span data-guthaben-text data-reicht="<?= e(t('neu.zahlung.guthaben', euro($guthaben, $sp))) ?>" data-knapp="<?= e(t('neu.zahlung.guthaben.knapp', euro($guthaben, $sp))) ?>"><?= e(t('neu.zahlung.guthaben', euro($guthaben, $sp))) ?></span></label>
          <?php } else { ?>
            <label><input type="radio" name="zahlungsart" value="revolut" <?= $werte['zahlungsart'] !== 'guthaben' ? 'checked' : '' ?> <?= $zahlungBereit ? '' : 'disabled' ?>> <?= e(t('neu.zahlung.revolut')) ?></label>
            <label><input type="radio" name="zahlungsart" value="guthaben" data-guthaben-wahl <?= $werte['zahlungsart'] === 'guthaben' ? 'checked' : '' ?>> <span data-guthaben-text data-reicht="<?= e(t('neu.zahlung.guthaben', euro($guthaben, $sp))) ?>" data-knapp="<?= e(t('neu.zahlung.guthaben.knapp', euro($guthaben, $sp))) ?>"><?= e(t('neu.zahlung.guthaben', euro($guthaben, $sp))) ?></span></label>
          <?php } ?>
        </fieldset>
        <button class="btn btn--primary k-btn-breit" type="submit"><?= e($business ? t('neu.knopf') : t('neu.knopf.privat')) ?> →</button>
      </div>
    </div>
  </div>
</form>
