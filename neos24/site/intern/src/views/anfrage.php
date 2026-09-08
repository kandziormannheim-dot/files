<header class="kopfzeile">
  <div><a class="zurueck" href="<?= e(url('kunden')) ?>">← Anfragen</a><h1 class="h1"><?= e($a['name']) ?><?= $a['firma'] !== '' ? ' <span class="leise">· ' . e($a['firma']) . '</span>' : '' ?></h1></div>
  <div><?= statusPille((string) $a['status'], anfrageStatusName((string) $a['status'])) ?></div>
</header>
<div class="spalten spalten--2-1">
  <div>
    <div class="karte">
      <div class="karte-kopf"><h2 class="h2">Nachricht</h2><span class="leise"><?= $a['art'] === 'privat' ? 'Privatkunde' : 'Business' ?> · <?= e(strtoupper((string) $a['sprache'])) ?> · <?= e(zeitAnzeigen($a['erstellt'])) ?></span></div>
      <dl class="liste">
        <dt>E-Mail</dt><dd><a href="mailto:<?= e($a['email']) ?>"><?= e($a['email']) ?></a></dd>
        <?php if ($a['volumen'] !== '') { ?><dt>Sendungen / Monat</dt><dd><?= e($a['volumen']) ?></dd><?php } ?>
      </dl>
      <p class="nachricht"><?= nl2br(e($a['nachricht'] !== '' ? $a['nachricht'] : '(keine Nachricht)')) ?></p>
    </div>
    <?php if ($bestellungen !== []) { ?>
    <div class="karte karte--tabelle">
      <div class="karte-kopf"><h2 class="h2">Bestellungen dieser E-Mail</h2></div>
      <table class="tabelle tabelle--kompakt"><tbody>
      <?php foreach ($bestellungen as $b) { ?><tr><td><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $b['ext_ref'])) ?>"><?= e($b['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($b['ext_ref']) ?></span><?php } ?></td><td><?= statusPille((string) $b['status']) ?></td><td><?= e($b['zielland']) ?></td><td class="mono rechts"><?= e(euro((int) $b['betrag_cent'])) ?></td><td class="mono rechts leise"><?= e(zeitAnzeigen($b['erstellt'])) ?></td></tr><?php } ?>
      </tbody></table>
    </div>
    <?php } ?>
  </div>
  <div>
    <div class="karte">
      <h2 class="h2">Bearbeitung</h2>
      <?php if (darf('kunden', 'bearbeiten')) { ?>
      <form method="post" action="<?= e(url('kunden/anfragen/' . $a['id'] . '/status')) ?>" class="formular">
        <?= csrfFeld() ?>
        <div class="feld"><label for="status">Status</label>
          <select id="status" name="status">
            <?php foreach (['neu', 'in_bearbeitung', 'konto_angelegt', 'erledigt'] as $s) { ?><option value="<?= $s ?>" <?= $a['status'] === $s ? 'selected' : '' ?>><?= e(anfrageStatusName($s)) ?></option><?php } ?>
          </select></div>
        <div class="feld"><label for="notiz">Interne Notiz</label><textarea id="notiz" name="notiz" rows="5" maxlength="2000"><?= e($a['notiz']) ?></textarea></div>
        <div class="formular-fuss"><button class="knopf knopf--primaer knopf--breit" type="submit">Speichern</button></div>
      </form>
      <?php } else { ?>
        <p><?= nl2br(e($a['notiz'] !== '' ? $a['notiz'] : 'Keine Notiz.')) ?></p>
      <?php } ?>
      <dl class="liste" style="margin-top:1rem">
        <dt>Bearbeiter</dt><dd><?= e($a['bearbeiter'] ?? '—') ?></dd>
        <dt>Aktualisiert</dt><dd><?= e(zeitAnzeigen($a['aktualisiert'])) ?></dd>
      </dl>
    </div>
    <?php if (darf('kunden', 'loeschen')) { ?>
    <div class="karte">
      <form method="post" action="<?= e(url('kunden/anfragen/' . $a['id'] . '/loeschen')) ?>" data-bestaetigen="Anfrage von <?= e($a['name']) ?> endgültig löschen?"><?= csrfFeld() ?><button class="knopf knopf--gefahr knopf--breit" type="submit">Anfrage löschen</button></form>
    </div>
    <?php } ?>
  </div>
</div>
