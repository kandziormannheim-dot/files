<?php
$darfB = darf('routing', 'bearbeiten');
$proPrio = [];
foreach ($zeilen as $z) { $proPrio[(int) $z['prioritaet']] = $z; }
?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('routing')) ?>">← Routingmatrix</a><h1 class="h1"><span class="flagge"><?= e($land['code']) ?></span><?= e($land['name_de']) ?> · <?= e($gk['name_de']) ?></h1></div>
  <p class="leise">Priorität 1 wird gezeigt und verkauft; 2 und 3 sind Fallback, wenn ein Carrier deaktiviert ist.</p>
</header>
<form method="post" action="<?= e(url('routing/zelle')) ?>" class="formular">
  <?= csrfFeld() ?>
  <input type="hidden" name="land" value="<?= e($land['code']) ?>">
  <input type="hidden" name="gk" value="<?= e($gk['code']) ?>">
  <div class="karte karte--tabelle">
    <div class="scrollen">
    <table class="tabelle prioritaeten">
      <thead><tr><th>Prio</th><th>Carrier</th><th>Laufzeit DE</th><th>Laufzeit EN</th><th>Einkauf €</th><th>Verkauf netto €</th><th>Brutto</th><th>Marge</th><th>Aktiv</th></tr></thead>
      <tbody>
      <?php for ($p = 1; $p <= 3; $p++) { $z = $proPrio[$p] ?? null; ?>
        <tr>
          <td class="mono"><?= $p ?></td>
          <td>
            <select name="carrier[<?= $p ?>]" aria-label="Carrier Priorität <?= $p ?>" <?= $darfB ? '' : 'disabled' ?>>
              <option value="0">— keiner —</option>
              <?php foreach ($carrier as $c) { ?>
                <option value="<?= (int) $c['id'] ?>" <?= $z !== null && (int) $z['carrier_id'] === (int) $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?><?= (int) $c['aktiv'] === 1 ? '' : ' (inaktiv)' ?></option>
              <?php } ?>
            </select>
          </td>
          <td><input name="laufzeit_de[<?= $p ?>]" value="<?= e($z['laufzeit_de'] ?? '') ?>" placeholder="2–3 Werktage" maxlength="40" <?= $darfB ? '' : 'readonly' ?>></td>
          <td><input name="laufzeit_en[<?= $p ?>]" value="<?= e($z['laufzeit_en'] ?? '') ?>" placeholder="2–3 working days" maxlength="40" <?= $darfB ? '' : 'readonly' ?>></td>
          <td><input class="mono geld" name="einkauf[<?= $p ?>]" value="<?= $z !== null ? e(number_format((int) $z['einkauf_cent'] / 100, 2, ',', '')) : '' ?>" inputmode="decimal" placeholder="0,00" data-geld="einkauf" <?= $darfB ? '' : 'readonly' ?>></td>
          <td><input class="mono geld" name="verkauf[<?= $p ?>]" value="<?= $z !== null ? e(number_format((int) $z['verkauf_cent'] / 100, 2, ',', '')) : '' ?>" inputmode="decimal" placeholder="0,00" data-geld="verkauf" <?= $darfB ? '' : 'readonly' ?>></td>
          <td class="mono" data-brutto data-mwst="<?= $mwst ?>"><?= $z !== null ? e(euro((int) round((int) $z['verkauf_cent'] * (100 + $mwst) / 100))) : '—' ?></td>
          <td class="mono" data-marge><?= $z !== null ? e(euro((int) $z['verkauf_cent'] - (int) $z['einkauf_cent'])) : '—' ?></td>
          <td><input type="checkbox" name="aktiv[<?= $p ?>]" <?= $z === null || (int) $z['aktiv'] === 1 ? 'checked' : '' ?> aria-label="aktiv" <?= $darfB ? '' : 'disabled' ?>></td>
        </tr>
      <?php } ?>
      </tbody>
    </table>
    </div>
    <?php if ($darfB) { ?>
    <div class="formular-fuss">
      <button class="knopf knopf--primaer" type="submit">Zelle speichern</button>
      <a class="knopf knopf--leise" href="<?= e(url('routing')) ?>">Abbrechen</a>
      <span class="leise">Startseite und Checkout übernehmen die Werte sofort (Cache bis 5 Minuten).</span>
    </div>
    <?php } ?>
  </div>
</form>
<?php if (darf('routing', 'loeschen') && $zeilen !== []) { ?>
<form method="post" action="<?= e(url('routing/zelle/loeschen')) ?>" data-bestaetigen="<?= e($land['code'] . ' × ' . $gk['code']) ?> leeren? Das Land wird für diese Gewichtsklasse nicht mehr angeboten.">
  <?= csrfFeld() ?>
  <input type="hidden" name="land" value="<?= e($land['code']) ?>">
  <input type="hidden" name="gk" value="<?= e($gk['code']) ?>">
  <button class="knopf knopf--gefahr" type="submit">Zelle leeren</button>
</form>
<?php } ?>
