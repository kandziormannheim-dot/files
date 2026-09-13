<?php $darfB = darf('reklamationen', 'bearbeiten'); $abgeschlossen = in_array($r['status'], ['erstattet', 'abgelehnt'], true); ?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('reklamationen')) ?>">← Reklamationen</a><h1 class="h1">Reklamation #<?= (int) $r['id'] ?></h1></div>
  <div><span class="status status--rk-<?= e($r['status']) ?>"><?= e(REKLAMATION_STATUS[$r['status']]['de'] ?? $r['status']) ?></span></div>
</header>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2"><?= e(REKLAMATION_ARTEN[$r['art']]['de'] ?? $r['art']) ?></h2><span class="leise">eingereicht <?= e(zeitAnzeigen($r['erstellt'])) ?></span></div>
      <p style="white-space:pre-line"><?= e($r['beschreibung']) ?></p>
      <dl class="liste" style="margin-top:1rem">
        <dt>Gefordert</dt><dd class="mono"><?= (int) $r['betrag_cent'] > 0 ? e(euro((int) $r['betrag_cent'])) : '— (kein Betrag)' ?></dd>
        <dt>Sendung</dt><dd><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $r['ext_ref'])) ?>"><?= e($r['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($r['ext_ref']) ?></span><?php } ?> · <span class="flagge"><?= e($r['zielland']) ?></span><?= e($r['carrier'] ?? '') ?> · <?= e(euro((int) $r['bestellung_cent'])) ?> brutto · <?= e(versandstatusName((string) ($b['versandstatus'] ?? ''))) ?></dd>
        <dt>Kunde</dt><dd><?= e($r['kunde_name'] ?? '—') ?> · <a href="mailto:<?= e($r['kunde_email'] ?: $r['email']) ?>"><?= e($r['kunde_email'] ?: $r['email']) ?></a><?= $r['firma_name'] ? ' · ' . e($r['firma_name']) : '' ?></dd>
      </dl>
    </div>
    <?php if ($r['antwort'] !== '') { ?>
    <div class="karte karte--gelb">
      <div class="karte-kopf"><h2 class="h2">Antwort an den Kunden</h2><span class="leise"><?= e($r['bearbeiter']) ?> · <?= e(zeitAnzeigen($r['aktualisiert'])) ?></span></div>
      <p style="white-space:pre-line"><?= e($r['antwort']) ?></p>
      <?php if ((int) $r['erstattung_cent'] > 0) { ?><p class="leise" style="margin-top:.5rem">Erstattung <?= e(euro((int) $r['erstattung_cent'])) ?><?= (int) $r['erstattet_gebucht'] === 1 ? ' als Guthaben gebucht' : ' (noch nicht gebucht — erst mit Status „Erstattet“)' ?></p><?php } ?>
    </div>
    <?php } ?>
  </div>
  <div>
    <?php if ($darfB) { ?>
    <div class="karte">
      <h2 class="h2">Bearbeiten</h2>
      <form method="post" action="<?= e(url('reklamationen/' . $r['id'] . '/status')) ?>" class="formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="rk-status">Status</label><select id="rk-status" name="status"><?php foreach (REKLAMATION_STATUS as $code => $n) { ?><option value="<?= e($code) ?>" <?= $r['status'] === $code ? 'selected' : '' ?>><?= e($n['de']) ?></option><?php } ?></select></div>
        <div class="feld"><label for="rk-erstattung">Erstattung € (wird bei „Erstattet“ als Guthaben gebucht)</label><input id="rk-erstattung" name="erstattung" inputmode="decimal" value="<?= (int) $r['erstattung_cent'] > 0 ? e(number_format((int) $r['erstattung_cent'] / 100, 2, ',', '')) : ((int) $r['betrag_cent'] > 0 ? e(number_format((int) $r['betrag_cent'] / 100, 2, ',', '')) : '') ?>" <?= (int) $r['erstattet_gebucht'] === 1 ? 'readonly' : '' ?>></div>
        <div class="feld"><label for="rk-antwort">Antwort an den Kunden</label><textarea id="rk-antwort" name="antwort" rows="6"><?= e($r['antwort']) ?></textarea></div>
        <label class="schalter"><input type="checkbox" name="mail" value="1" checked> Antwort per E-Mail schicken (<?= e($r['kunde_email'] ?: $r['email']) ?>)</label>
        <button class="knopf knopf--primaer knopf--breit" type="submit">Speichern</button>
        <?php if ($abgeschlossen) { ?><span class="leise">Abgeschlossen — eine Änderung ist trotzdem möglich; eine gebuchte Erstattung wird nicht doppelt gebucht.</span><?php } ?>
      </form>
    </div>
    <?php } ?>
  </div>
</div>
