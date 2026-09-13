<?php
$darfB = darf('rechnungspruefung', 'bearbeiten');
$tol = rpToleranzCent();
$pdfSumme = (int) $r['betrag_netto_cent'];
$summeOk = $pdfSumme <= 0 || abs($pdfSumme - $z['summe']) <= $tol;
$pdfDa = $r['datei_pdf'] !== '';
$befundKlasse = ['ok' => 'ok', 'gewicht_hoeher' => 'warn', 'gewicht_niedriger' => 'info', 'preis_abweichung' => 'fehler', 'nicht_zugeordnet' => 'fehler', 'doppelt' => 'fehler', 'storniert' => 'fehler', 'unbekannte_klasse' => 'warn'];
?>
<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('rechnungspruefung')) ?>">← Rechnungsprüfung</a><h1 class="h1"><?= e($r['carrier'] ?? '') ?> · <span class="mono"><?= e($r['nummer'] ?: '#' . $r['id']) ?></span></h1></div>
  <div class="kopf-aktionen">
    <span class="status status--lr-<?= e($r['status']) ?>"><?= e(RP_STATUS[$r['status']] ?? $r['status']) ?></span>
    <?php if ($pdfDa) { ?><a class="knopf knopf--leise knopf--klein" href="<?= e(url('rechnungspruefung/' . $r['id'] . '/rechnung.pdf')) ?>" target="_blank" rel="noopener">PDF</a><?php } ?>
    <a class="knopf knopf--leise knopf--klein" href="<?= e(url('rechnungspruefung/' . $r['id'] . '/zuordnung')) ?>">Spalten</a>
    <a class="knopf knopf--leise knopf--klein" href="<?= e(url('rechnungspruefung/' . $r['id'] . '/beanstandung.csv')) ?>">Beanstandung CSV</a>
  </div>
</header>

<div class="kpi-raster">
  <div class="kpi kpi--cyan"><span class="kpi-name">Positionen</span><strong class="kpi-wert"><?= $z['positionen'] ?></strong><span class="kpi-zusatz"><?= (int) ($z['befunde']['ok']['n'] ?? 0) ?> in Ordnung · <?= $z['positionen'] - (int) ($z['befunde']['ok']['n'] ?? 0) ?> auffällig</span></div>
  <div class="kpi kpi--gelb"><span class="kpi-name">Summe netto</span><strong class="kpi-wert"><?= e(euro($z['summe'])) ?></strong><span class="kpi-zusatz"><?= $pdfSumme > 0 ? ($summeOk ? 'stimmt mit dem PDF überein' : 'laut PDF ' . e(euro($pdfSumme)) . ' — Abweichung ' . e(euro($pdfSumme - $z['summe']))) : 'keine Summe aus dem PDF' ?></span></div>
  <div class="kpi kpi--coral"><span class="kpi-name">Beanstandung Lieferant</span><strong class="kpi-wert"><?= e(euro($z['beanstandung'])) ?></strong><span class="kpi-zusatz"><?= $z['beanstandungen'] ?> Positionen (zu viel berechnet, doppelt, storniert, nicht zuzuordnen)</span></div>
  <div class="kpi kpi--magenta"><span class="kpi-name">Nachberechnung Kunden</span><strong class="kpi-wert"><?= e(euro($z['nachberechnung_offen'])) ?></strong><span class="kpi-zusatz">offen netto · <?= e(euro($z['nachberechnung_gebucht'])) ?> schon gebucht</span></div>
</div>

<div class="spalten spalten--2-1">
  <div>
    <div class="karte karte--tabelle">
      <div class="karte-kopf">
        <h2 class="h2">Positionen</h2>
        <form class="werkzeuge" method="get" action="<?= e(url('rechnungspruefung/' . $r['id'])) ?>" style="margin:0">
          <select name="befund" aria-label="Befund" onchange="this.form.submit()"><option value="">Alle Befunde</option><?php foreach (RP_BEFUNDE as $code => $n) { ?><option value="<?= e($code) ?>" <?= $befund === $code ? 'selected' : '' ?>><?= e($n) ?> (<?= (int) ($z['befunde'][$code]['n'] ?? 0) ?>)</option><?php } ?></select>
          <noscript><button class="knopf knopf--leise knopf--klein" type="submit">Filtern</button></noscript>
        </form>
      </div>
      <?php if ($positionen === []) { ?><p class="leer">Keine Positionen in dieser Auswahl.</p><?php } else { ?>
      <div class="scrollen"><table class="tabelle tabelle--kompakt">
        <thead><tr><th>Zeile</th><th>Sendung</th><th>Befund</th><th class="rechts">Gewogen</th><th>Klasse</th><th class="rechts">Berechnet</th><th class="rechts">Differenz</th><th class="rechts">Nachberechnung</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($positionen as $p) { $beanstandet = in_array($p['befund'], ['preis_abweichung', 'doppelt', 'storniert', 'nicht_zugeordnet'], true) || abs((int) $p['differenz_cent']) > $tol; ?>
          <tr class="lr-<?= e($befundKlasse[$p['befund']] ?? '') ?>">
            <td class="mono leise"><?= (int) $p['zeile'] ?></td>
            <td>
              <?php if ($p['ext_ref']) { ?><a class="mono" href="<?= e(url('bestellungen/' . $p['ext_ref'])) ?>"><?= e($p['ext_ref']) ?></a><?php } else { ?><span class="mono leise"><?= e($p['referenz'] ?: '—') ?></span><?php } ?>
              <?= $p['sendungsnummer'] !== '' ? '<br><span class="leise mono">' . e($p['sendungsnummer']) . '</span>' : '' ?>
              <?= $p['b_zielland'] || $p['zielland'] ? '<br><span class="leise"><span class="flagge">' . e($p['b_zielland'] ?: $p['zielland']) . '</span>' . e($p['b_carrier'] ?? '') . '</span>' : '' ?>
            </td>
            <td><span class="status status--bf-<?= e($p['befund']) ?>"><?= e(RP_BEFUNDE[$p['befund']] ?? $p['befund']) ?></span><?= $p['hinweis'] !== '' ? '<br><span class="leise">' . e($p['hinweis']) . '</span>' : '' ?></td>
            <td class="mono rechts"><?= (int) $p['gewicht_gramm'] > 0 ? e(number_format((int) $p['gewicht_gramm'] / 1000, 2, ',', '')) . ' kg' : '—' ?><?= (int) $p['b_gewicht'] > 0 ? '<br><span class="leise">gebucht ' . e(number_format((int) $p['b_gewicht'] / 1000, 2, ',', '')) . '</span>' : '' ?></td>
            <td class="mono"><?= $p['gk_bestellt'] !== '' ? e($p['gk_bestellt']) . ($p['gk_ist'] !== '' && $p['gk_ist'] !== $p['gk_bestellt'] ? ' → <strong>' . e($p['gk_ist']) . '</strong>' : '') : '—' ?></td>
            <td class="mono rechts"><?= e(euro((int) $p['betrag_cent'])) ?><?= (int) $p['zuschlag_cent'] > 0 ? '<br><span class="leise">+ ' . e(euro((int) $p['zuschlag_cent'])) . '</span>' : '' ?></td>
            <td class="mono rechts <?= $beanstandet ? 'ueberfaellig' : '' ?>"><?= $p['bestellung_id'] ? e(((int) $p['differenz_cent'] > 0 ? '+' : '') . euro((int) $p['differenz_cent'])) : '—' ?></td>
            <td class="mono rechts">
              <?php if ($p['nachberechnung_status'] === 'gebucht') { ?><?= e(euro((int) $p['nachberechnung_cent'])) ?><br><a class="leise mono" href="<?= e(url('bestellungen/' . $p['nachberechnung_ref'])) ?>"><?= e($p['nachberechnung_ref']) ?></a>
              <?php } elseif ($p['nachberechnung_status'] === 'gutschrift') { ?><?= e(euro((int) $p['nachberechnung_cent'])) ?><br><span class="leise">Gutschrift</span>
              <?php } elseif ($p['nachberechnung_status'] === 'verzichtet') { ?><span class="leise">verzichtet</span>
              <?php } elseif ($p['nachberechnung_status'] === 'offen') { ?><strong><?= e(euro((int) $p['nachberechnung_cent'])) ?></strong><br><span class="leise">offen</span>
              <?php } else { ?>—<?php } ?>
            </td>
            <td class="rechts zeilen-aktionen">
              <?php if ($darfB) { ?>
                <?php if ($p['befund'] === 'nicht_zugeordnet' || !$p['bestellung_id']) { ?>
                  <form method="post" action="<?= e(url('rechnungspruefung/position/' . $p['id'] . '/zuordnen')) ?>" class="lr-inline"><?= csrfFeld() ?><input name="ext_ref" placeholder="NE-…" pattern="NE-\d{4}-[0-9A-Fa-f]{8}" size="16" required aria-label="Bestellnummer"><button class="knopf knopf--leise knopf--klein" type="submit">Zuordnen</button></form>
                <?php } ?>
                <?php if ($p['bestellung_id'] && in_array($p['nachberechnung_status'], ['offen', 'keine', 'verzichtet'], true) && in_array($p['befund'], ['gewicht_hoeher', 'unbekannte_klasse'], true)) { ?>
                  <form method="post" action="<?= e(url('rechnungspruefung/position/' . $p['id'] . '/buchen')) ?>" class="lr-inline" data-bestaetigen="Nachberechnung für <?= e($p['ext_ref']) ?> buchen und den Kunden per Mail informieren?"><?= csrfFeld() ?><input name="betrag" value="<?= (int) $p['nachberechnung_cent'] > 0 ? e(number_format((int) $p['nachberechnung_cent'] / 100, 2, ',', '')) : '' ?>" placeholder="netto €" size="7" inputmode="decimal" aria-label="Betrag netto"><button class="knopf knopf--primaer knopf--klein" type="submit">Nachberechnen</button></form>
                  <?php if ($p['nachberechnung_status'] === 'offen') { ?><form method="post" action="<?= e(url('rechnungspruefung/position/' . $p['id'] . '/verzichten')) ?>" class="lr-inline"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--klein" type="submit">Verzichten</button></form><?php } ?>
                <?php } ?>
                <?php if ($p['befund'] === 'gewicht_niedriger' && $p['nachberechnung_status'] === 'keine' && (int) $p['verkauf_bestellt_cent'] > (int) $p['verkauf_ist_cent']) { ?>
                  <form method="post" action="<?= e(url('rechnungspruefung/position/' . $p['id'] . '/gutschrift')) ?>" class="lr-inline" data-bestaetigen="<?= e(euro((int) $p['verkauf_bestellt_cent'] - (int) $p['verkauf_ist_cent'])) ?> netto als Guthaben gutschreiben?"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--klein" type="submit">Gutschrift</button></form>
                <?php } ?>
              <?php } ?>
            </td>
          </tr>
        <?php } ?>
        </tbody>
      </table></div>
      <?php } ?>
    </div>
    <?php if ($r['pdf_text'] !== '') { ?>
    <details class="karte">
      <summary class="h2" style="cursor:pointer">Text aus dem PDF</summary>
      <pre class="lr-pdftext"><?= e(mb_substr((string) $r['pdf_text'], 0, 6000)) ?></pre>
    </details>
    <?php } ?>
  </div>
  <div>
    <div class="karte karte--ink">
      <h2 class="h2">Kopfdaten</h2>
      <?php if ($darfB) { ?>
      <form method="post" action="<?= e(url('rechnungspruefung/' . $r['id'] . '/kopf')) ?>" class="formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="k-nummer">Rechnungsnummer</label><input id="k-nummer" name="nummer" value="<?= e($r['nummer']) ?>" maxlength="40"></div>
        <div class="feld"><label for="k-datum">Datum</label><input id="k-datum" name="datum" type="date" value="<?= e($r['datum']) ?>"></div>
        <div class="feld"><label for="k-netto">Summe netto laut Rechnung €</label><input id="k-netto" name="netto" inputmode="decimal" value="<?= $pdfSumme > 0 ? e(number_format($pdfSumme / 100, 2, ',', '')) : '' ?>"></div>
        <button class="knopf knopf--leise knopf--breit" type="submit">Speichern</button>
        <?php if (($pdfKopf['nummer'] ?? '') !== '' || ($pdfKopf['netto_cent'] ?? 0) > 0) { ?><span class="leise">aus dem PDF gelesen: <?= e($pdfKopf['nummer'] ?? '') ?> <?= e($pdfKopf['datum'] ?? '') ?> <?= ($pdfKopf['netto_cent'] ?? 0) > 0 ? e(euro((int) $pdfKopf['netto_cent'])) : '' ?></span><?php } ?>
      </form>
      <?php } else { ?>
      <dl class="liste liste--ink"><dt>Nummer</dt><dd><?= e($r['nummer'] ?: '—') ?></dd><dt>Datum</dt><dd><?= e($r['datum'] ?: '—') ?></dd><dt>Netto</dt><dd class="mono"><?= $pdfSumme > 0 ? e(euro($pdfSumme)) : '—' ?></dd></dl>
      <?php } ?>
      <p class="leise" style="margin-top:.75rem">hochgeladen <?= e(zeitAnzeigen($r['erstellt'])) ?> von <?= e($r['hochgeladen_von']) ?> · Gewicht in <?= e($r['gewicht_einheit']) ?></p>
    </div>
    <?php if ($darfB) { ?>
    <div class="karte">
      <h2 class="h2">Aktionen</h2>
      <form method="post" action="<?= e(url('rechnungspruefung/' . $r['id'] . '/alle-buchen')) ?>" class="aktion" data-bestaetigen="Alle offenen Nachberechnungen (<?= e(euro($z['nachberechnung_offen'])) ?> netto) buchen und die Kunden per Mail informieren?"><?= csrfFeld() ?><button class="knopf knopf--primaer knopf--breit" type="submit" <?= $z['nachberechnung_offen'] > 0 ? '' : 'disabled' ?>>Alle offenen Nachberechnungen buchen</button><span class="leise">Firmen: Position auf der nächsten Sammelrechnung · Privatkunden: vom Guthaben, sonst offene Zahlung</span></form>
      <form method="post" action="<?= e(url('rechnungspruefung/' . $r['id'] . '/pruefen')) ?>" class="aktion"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--breit" type="submit">Neu prüfen</button><span class="leise">nach Änderungen an Routingmatrix oder Zuordnung</span></form>
      <form method="post" action="<?= e(url('rechnungspruefung/' . $r['id'] . '/status')) ?>" class="aktion formular"><?= csrfFeld() ?>
        <div class="feld"><label for="lr-status">Status setzen</label><select id="lr-status" name="status"><?php foreach (RP_STATUS as $code => $n) { if ($code === 'zuordnung') { continue; } ?><option value="<?= e($code) ?>" <?= $r['status'] === $code ? 'selected' : '' ?>><?= e($n) ?></option><?php } ?></select></div>
        <button class="knopf knopf--leise knopf--breit" type="submit">Status speichern</button>
      </form>
    </div>
    <div class="karte">
      <form method="post" action="<?= e(url('rechnungspruefung/' . $r['id'] . '/notiz')) ?>" class="formular"><?= csrfFeld() ?>
        <div class="feld"><label for="lr-notiz">Notiz</label><textarea id="lr-notiz" name="notiz" rows="4"><?= e($r['notiz']) ?></textarea></div>
        <button class="knopf knopf--leise" type="submit">Notiz speichern</button>
      </form>
    </div>
    <?php if (darf('rechnungspruefung', 'loeschen')) { ?>
    <div class="karte"><form method="post" action="<?= e(url('rechnungspruefung/' . $r['id'] . '/loeschen')) ?>" data-bestaetigen="Lieferantenrechnung samt Positionen und Dateien löschen?"><?= csrfFeld() ?><button class="knopf knopf--gefahr knopf--breit" type="submit">Rechnung löschen</button><span class="leise">nur ohne gebuchte Nachberechnungen</span></form></div>
    <?php } ?>
    <?php } ?>
    <div class="karte karte--gelb">
      <h2 class="h2">So wird geprüft</h2>
      <p class="leise">Jede Zeile wird über die NEOS-Nummer der Bestellung zugeordnet. Das gewogene Gewicht ergibt die tatsächliche Gewichtsklasse; liegt sie über der gebuchten, ist die Differenz der Verkaufspreise die Nachberechnung an den Kunden. Der berechnete Betrag wird mit dem Einkaufspreis der Routingmatrix für die tatsächliche Klasse verglichen (Toleranz <?= e(euro($tol)) ?>); Abweichungen, doppelte, stornierte und nicht zuzuordnende Zeilen gehen in die Beanstandung.</p>
    </div>
  </div>
</div>
