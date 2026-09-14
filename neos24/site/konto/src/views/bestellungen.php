<?php $ich = kundeAktuell(); $sp = sprache(); $business = $ich['art'] === 'business'; ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e(t('portal')) ?></span><h1 class="h2"><?= e($titel) ?></h1></div>
  <?php if (!$business || darfKunde('versand', 'bearbeiten')) { ?><a class="btn btn--primary" href="<?= e(url('sendungen/neu')) ?>"><?= e(t('nav.neu')) ?> →</a><?php } ?>
</header>
<form class="k-werkzeuge" method="get" action="<?= e(url($pfad)) ?>">
  <input type="search" name="q" value="<?= e($q) ?>" placeholder="<?= e(t('liste.suche')) ?>" aria-label="<?= e(t('liste.suche')) ?>">
  <select name="status" aria-label="<?= e(t('liste.status')) ?>">
    <option value=""><?= e(t('liste.alle_status')) ?></option>
    <?php foreach ($business ? ['beauftragt', 'storniert'] : ['angelegt', 'bezahlt', 'fehlgeschlagen', 'storniert'] as $s) { ?><option value="<?= $s ?>" <?= $status === $s ? 'selected' : '' ?>><?= e(statusName($s, $sp)) ?></option><?php } ?>
  </select>
  <?php $unterkunden = $unterkunden ?? []; $unterkundeFilter = $unterkundeFilter ?? null; if ($unterkunden !== []) { ?>
  <select name="unterkunde" aria-label="<?= e(t('unterkunde.abrechnen')) ?>">
    <option value=""><?= e(t('unterkunde.alle')) ?></option>
    <option value="-1" <?= $unterkundeFilter === -1 ? 'selected' : '' ?>><?= e(t('unterkunde.hauptfirma')) ?></option>
    <?php foreach ($unterkunden as $u) { ?><option value="<?= (int) $u['id'] ?>" <?= $unterkundeFilter === (int) $u['id'] ? 'selected' : '' ?>><?= e($u['nummer']) ?> · <?= e($u['name']) ?></option><?php } ?>
  </select>
  <?php } ?>
  <button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('liste.filter')) ?></button>
</form>
<div class="card k-karte-tabelle" data-labelauswahl data-url="<?= e(url($pfad . '/labels.pdf')) ?>">
  <?php if ($zeilen === []) { ?><p class="k-leer"><?= e(t('liste.leer')) ?></p><?php } else { ?>
  <div class="k-scroll"><table class="table k-tabelle">
    <thead><tr><th><input type="checkbox" data-alle aria-label="alle"></th><th><?= e(t('liste.nummer')) ?></th><th><?= e(t('liste.status')) ?></th><th><?= e(t('liste.ziel')) ?></th><th><?= e(t('liste.empfaenger')) ?></th><?php if ($business) { ?><th><?= e(t('liste.referenz')) ?></th><th><?= e(t('liste.angelegt_von')) ?></th><?php if ($unterkunden !== []) { ?><th><?= e(t('liste.fuer')) ?></th><?php } ?><?php } ?><th><?= e(t('liste.carrier')) ?></th><th><?= e($business ? t('liste.netto') : t('liste.betrag')) ?></th></tr></thead>
    <tbody>
    <?php foreach ($zeilen as $z) { $emp = json_decode((string) $z['empfaenger_json'], true) ?: []; ?>
      <tr>
        <td><?php if (in_array($z['status'], ['bezahlt', 'beauftragt'], true) && $z['art'] !== 'nachberechnung') { ?><input type="checkbox" value="<?= e($z['ext_ref']) ?>" data-label-ref aria-label="<?= e($z['ext_ref']) ?>"><?php } ?></td>
        <td><a class="k-mono" href="<?= e(url($pfad . '/' . $z['ext_ref'])) ?>"><?= e($z['ext_ref']) ?></a><?= $z['art'] === 'retoure' ? ' <span class="k-klein">↩</span>' : ($z['art'] === 'nachberechnung' ? ' <span class="status status--vs-problem">' . e(t('nachberechnung')) . '</span>' : '') ?><br><span class="k-klein"><?= e(datumAnzeigen($z['erstellt'], $sp)) ?></span></td>
        <td><?= statusPille((string) $z['status'], statusName((string) $z['status'], $sp)) ?><?= $z['art'] !== 'nachberechnung' ? '<br><span class="k-klein">' . e(versandstatusName((string) $z['versandstatus'], $sp)) . '</span>' : '' ?></td>
        <td><span class="flag"><?= e($z['zielland']) ?></span><?= e($z['gewichtsklasse']) ?></td>
        <td><?= e($emp['name'] ?? '') ?><br><span class="k-klein"><?= e(trim(($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''))) ?></span></td>
        <?php if ($business) { ?><td><?= e($z['referenz'] ?: '—') ?></td><td><?= e($z['angelegt_von'] ?? '—') ?></td><?php if ($unterkunden !== []) { ?><td class="k-klein k-mono"><?= e($z['unterkunde_nummer'] ?: t('unterkunde.hauptfirma')) ?></td><?php } ?><?php } ?>
        <td><?= e($z['carrier'] ?? '—') ?></td>
        <td class="k-mono"><?= e(euro((int) ($business ? $z['netto_cent'] : $z['betrag_cent']), $sp)) ?></td>
      </tr>
    <?php } ?>
    </tbody>
  </table></div>
  <?php if (!$business || darfKunde('lager', 'bearbeiten') || darfKunde('versand', 'bearbeiten')) { ?><div class="k-form-fuss" style="margin-top:1rem"><button type="button" class="btn btn--sm btn--ink" data-labels-drucken disabled><?= e(t('label.sammeldruck')) ?></button></div><?php } ?>
  <?= blaettern($seite, $gesamt, 50, $pfad, ['q' => $q, 'status' => $status, 'unterkunde' => $unterkundeFilter !== null ? (string) $unterkundeFilter : ''], $sp) ?>
  <?php } ?>
</div>
