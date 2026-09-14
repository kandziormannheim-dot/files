<header class="kopfzeile">
  <div><span class="eyebrow">Reklamationen</span><h1 class="h1">Reklamationen</h1></div>
  <span class="leise"><?= count($zeilen) ?> Treffer</span>
</header>
<form class="werkzeuge" method="get" action="<?= e(url('reklamationen')) ?>">
  <select name="status" aria-label="Status">
    <option value="">Offen (neu, in Prüfung, anerkannt)</option>
    <?php foreach (REKLAMATION_STATUS as $code => $n) { ?><option value="<?= e($code) ?>" <?= $status === $code ? 'selected' : '' ?>><?= e($n['de']) ?></option><?php } ?>
  </select>
  <button class="knopf knopf--leise" type="submit">Filtern</button>
</form>
<div class="karte karte--tabelle">
  <?php if ($zeilen === []) { ?><p class="leer">Keine Reklamationen in dieser Auswahl.</p><?php } else { ?>
  <div class="scrollen">
  <table class="tabelle">
    <thead><tr><th>#</th><th>Status</th><th>Sendung</th><th>Kunde</th><th>Art</th><th>Beschreibung</th><th class="rechts">Gefordert</th><th class="rechts">Erstattet</th><th class="rechts">Eingang</th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $r) { ?>
      <tr>
        <td><a class="mono" href="<?= e(url('reklamationen/' . $r['id'])) ?>">#<?= (int) $r['id'] ?></a></td>
        <td><span class="status status--rk-<?= e($r['status']) ?>"><?= e(REKLAMATION_STATUS[$r['status']]['de'] ?? $r['status']) ?></span></td>
        <td><?php if (darf('bestellungen')) { ?><a class="mono" href="<?= e(url('bestellungen/' . $r['ext_ref'])) ?>"><?= e($r['ext_ref']) ?></a><?php } else { ?><span class="mono"><?= e($r['ext_ref']) ?></span><?php } ?><br><span class="leise"><span class="flagge"><?= e($r['zielland']) ?></span><?= e($r['carrier'] ?? '') ?></span></td>
        <td><?= e($r['kunde_name'] ?? '—') ?><?= $r['firma_name'] ? '<br><span class="leise">' . e($r['firma_name']) . '</span>' : '' ?></td>
        <td><?= e(REKLAMATION_ARTEN[$r['art']]['de'] ?? $r['art']) ?></td>
        <td class="leise"><?= e(mb_substr((string) $r['beschreibung'], 0, 90)) ?><?= mb_strlen((string) $r['beschreibung']) > 90 ? '…' : '' ?></td>
        <td class="mono rechts"><?= (int) $r['betrag_cent'] > 0 ? e(euro((int) $r['betrag_cent'])) : '—' ?></td>
        <td class="mono rechts"><?= (int) $r['erstattung_cent'] > 0 ? e(euro((int) $r['erstattung_cent'])) : '—' ?></td>
        <td class="mono rechts leise"><?= e(zeitAnzeigen($r['erstellt'])) ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table>
  </div>
  <?php } ?>
</div>
