<?php
$ich = kundeAktuell(); $sp = sprache(); $business = $ich['art'] === 'business';
$abs = json_decode((string) $b['absender_json'], true) ?: [];
$emp = json_decode((string) $b['empfaenger_json'], true) ?: [];
$landInfo = preisliste()['laender'][$b['zielland']] ?? null;
$land = $landInfo['name'][$sp] ?? $b['zielland'];
$laufzeit = $landInfo['klassen'][$b['gewichtsklasse']]['laufzeit'][$sp] ?? '—';
?>
<header class="k-kopfzeile">
  <div><a class="k-zurueck" href="<?= e(url($pfad)) ?>"><?= e(t('detail.zurueck')) ?></a><h1 class="h2 k-mono"><?= e($b['ext_ref']) ?></h1></div>
  <div><?= statusPille((string) $b['status'], statusName((string) $b['status'], $sp)) ?></div>
</header>
<?php if ($b['art'] === 'nachberechnung') { $nb = json_decode((string) $b['nachberechnung_json'], true) ?: []; $orig = $b['nachberechnung_zu'] ? datenbank()->query('SELECT ext_ref FROM bestellungen WHERE id = ' . (int) $b['nachberechnung_zu'])->fetchColumn() : '';
  $frist = (int) (konfig()['rechnungspruefung']['widerspruchTage'] ?? 14); $fristOffen = strtotime((string) $b['erstellt']) >= time() - $frist * 86400; $storniert = $b['status'] === 'storniert';
  $nachweisDa = nachberechnungNachweisPfad($b) !== '' && is_file(nachberechnungNachweisPfad($b)); $rechnungDa = lexwarePdfPfad((string) ($b['lexware_id'] ?? '')) !== '' && is_file(lexwarePdfPfad((string) $b['lexware_id'])); ?>
<div class="k-spalten k-spalten--2-1">
  <div>
    <div class="card">
      <span class="eyebrow eyebrow--magenta"><?= e(t('nachberechnung')) ?></span>
      <h2 class="h3" style="margin-top:.4rem"><?= e(t('nachberechnung.titel')) ?></h2>
      <p class="k-text" style="margin:.75rem 0"><?= e(t('nachberechnung.text', $orig ?: ($nb['original'] ?? ''), number_format((int) ($nb['gewicht_gramm'] ?? 0) / 1000, 2, $sp === 'en' ? '.' : ',', ''), $nb['gk_bestellt'] ?? '', $nb['gk_ist'] ?? '')) ?></p>
      <?php if ((int) ($nb['gebuehr'] ?? 0) > 0) { ?><p class="k-klein"><?= e(t('nachberechnung.gebuehr', euro((int) $nb['gebuehr'], $sp))) ?></p><?php } ?>
      <p class="k-text"><?= e($storniert ? t('nachberechnung.storniert') : ($b['status'] === 'offen' || $b['status'] === 'angelegt' || $b['status'] === 'fehlgeschlagen' ? t('nachberechnung.offen') : ($b['zahlungsart'] === 'rechnung' ? t('nachberechnung.rechnung') : ($b['zahlungsart'] === 'guthaben' ? t('nachberechnung.guthaben') : t('nachberechnung.bezahlt'))))) ?></p>
      <p class="k-klein" style="margin-top:.75rem"><?= e(t('nachberechnung.tipp')) ?></p>
      <p style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">
        <?php if ($nachweisDa) { ?><a class="btn btn--sm btn--ink" href="<?= e(url($pfad . '/' . $b['ext_ref'] . '/nachweis.pdf')) ?>" target="_blank" rel="noopener"><?= e(t('nachberechnung.nachweis')) ?> ↓</a><?php } ?>
        <?php if ($rechnungDa) { ?><a class="btn btn--sm btn--ink" href="<?= e(url($pfad . '/' . $b['ext_ref'] . '/rechnung.pdf')) ?>" target="_blank" rel="noopener"><?= e(t('nachberechnung.rechnung_pdf')) ?><?= $b['lexware_nummer'] ? ' ' . e($b['lexware_nummer']) : '' ?> ↓</a><?php } ?>
        <?php if ($orig) { ?><a class="btn btn--sm k-btn-leise" href="<?= e(url($pfad . '/' . $orig)) ?>"><?= e(t('nachberechnung.zu')) ?> <?= e($orig) ?> →</a><?php } ?>
      </p>
    </div>
    <?php if (!$storniert) { ?>
    <div class="card">
      <h2 class="h3"><?= e(t('nachberechnung.widerspruch')) ?></h2>
      <?php if ($reklamation !== null) { ?>
        <p class="k-text"><a href="<?= e(url('reklamationen')) ?>"><?= e(t('nachberechnung.widerspruch.offen')) ?> · <?= e(REKLAMATION_STATUS[$reklamation['status']][$sp] ?? $reklamation['status']) ?></a></p>
      <?php } elseif (!$fristOffen) { ?>
        <p class="k-text"><?= e(t('nachberechnung.widerspruch.frist')) ?></p>
      <?php } else { ?>
        <p class="k-text" style="margin-bottom:.75rem"><?= e(t('nachberechnung.widerspruch.text', $frist)) ?></p>
        <form method="post" action="<?= e(url($pfad . '/' . $b['ext_ref'] . '/widerspruch')) ?>" class="form k-form">
          <?= csrfFeld() ?>
          <div class="field"><label for="w-text"><?= e(t('reklamationen.beschreibung')) ?></label><textarea id="w-text" name="beschreibung" rows="4" required minlength="10"></textarea></div>
          <button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('nachberechnung.widerspruch.knopf')) ?></button>
        </form>
      <?php } ?>
    </div>
    <?php } ?>
  </div>
  <div>
    <div class="card card--ink">
      <h2 class="h3"><?= e(t('detail.zahlung')) ?></h2>
      <dl class="k-liste k-liste--ink">
        <dt><?= e(t('detail.netto')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['netto_cent'], $sp)) ?></dd>
        <?php if (!$business) { ?><dt><?= e(t('detail.mwst')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['mwst_cent'], $sp)) ?></dd><dt><?= e(t('detail.brutto')) ?></dt><dd class="k-mono"><strong><?= e(euro((int) $b['betrag_cent'], $sp)) ?></strong></dd><?php } ?>
        <dt><?= e(t('detail.zahlung')) ?></dt><dd><?= e($b['zahlungsart'] === 'rechnung' ? t('detail.zahlung.rechnung') : ($b['zahlungsart'] === 'guthaben' ? t('nav.guthaben') : t('detail.zahlung.revolut'))) ?></dd>
        <?php if ($business && $b['rechnung_nummer']) { ?><dt><?= e(t('detail.rechnung')) ?></dt><dd><a href="<?= e(url('rechnungen/' . $b['rechnung_nummer'])) ?>"><?= e($b['rechnung_nummer']) ?></a></dd><?php } ?>
      </dl>
    </div>
    <?php if (!$storniert && $b['zahlungsart'] === 'revolut' && in_array($b['status'], ['offen', 'angelegt', 'fehlgeschlagen'], true)) { ?>
    <div class="card"><a class="btn btn--primary k-btn-breit" href="<?= e(url('bestellungen/' . $b['ext_ref'] . '/bezahlen')) ?>"><?= e(t('bezahlen.knopf')) ?> →</a></div>
    <?php } ?>
  </div>
</div>
<?php return; } ?>
<div class="k-spalten k-spalten--2-1">
  <div>
    <div class="card">
      <div class="k-karte-kopf"><h2 class="h3"><?= e(t('detail.sendung')) ?></h2><span class="k-klein"><?= e(zeitAnzeigen($b['erstellt'], $sp)) ?></span></div>
      <dl class="k-liste">
        <dt><?= e(t('liste.ziel')) ?></dt><dd><span class="flag"><?= e($b['zielland']) ?></span><?= e($land) ?></dd>
        <dt><?= e(t('neu.kategorie')) ?></dt><dd><?= e(kategorieName((string) ($b['kategorie'] ?? 'paket'), $sp)) ?></dd>
        <dt><?= e(t('detail.gewicht')) ?></dt><dd><?= e(preisliste()['gewichtsklassen'][$b['gewichtsklasse']][$sp] ?? $b['gewichtsklasse']) ?></dd>
        <dt><?= e(t('liste.carrier')) ?></dt><dd><?= e($b['carrier'] ?? '—') ?></dd>
        <dt><?= e(t('detail.laufzeit')) ?></dt><dd><?= e($laufzeit) ?></dd>
        <?php if ($business) { ?><dt><?= e(t('liste.referenz')) ?></dt><dd><?= e($b['referenz'] ?: '—') ?></dd><dt><?= e(t('liste.angelegt_von')) ?></dt><dd><?= e($b['angelegt_von'] ?? '—') ?></dd><?php if (!empty($b['unterkunde_nummer'])) { ?><dt><?= e(t('liste.fuer')) ?></dt><dd><?= e($b['unterkunde']) ?> <span class="k-klein k-mono"><?= e($b['unterkunde_nummer']) ?></span></dd><?php } ?><?php } ?>
        <?php $masse = json_decode((string) ($b['masse_json'] ?? '{}'), true) ?: []; $zusatz = json_decode((string) ($b['zusatz_json'] ?? '[]'), true) ?: []; $abholung = json_decode((string) ($b['abholung_json'] ?? '{}'), true) ?: []; ?>
        <dt><?= e(t('detail.gewicht_masse')) ?></dt><dd><?= (int) $b['gewicht_gramm'] > 0 ? e(number_format((int) $b['gewicht_gramm'] / 1000, 2, $sp === 'en' ? '.' : ',', '') . ' kg') : '—' ?><?= !empty($masse['l']) ? e(' · ' . $masse['l'] . ' × ' . $masse['b'] . ' × ' . $masse['h'] . ' cm') : '' ?></dd>
        <dt><?= e(t('detail.zusatz')) ?></dt><dd><?= $zusatz !== [] ? e(implode(', ', array_map(static fn (array $z): string => $z['name'][$sp] ?? $z['code'], $zusatz))) : e(t('detail.keine')) ?></dd>
        <?php if (!empty($abholung['datum'])) { ?><dt><?= e(t('detail.abholung')) ?></dt><dd><?= e(datumLesbar($abholung['datum'], $sp)) ?>, <?= e(str_replace('-', '–', $abholung['fenster'] ?? '')) ?> h</dd><?php } ?>
        <?php if ((int) $b['gewicht_carrier_gramm'] > 0) { ?><dt><?= e(t('detail.gewicht_carrier')) ?></dt><dd><?= e(number_format((int) $b['gewicht_carrier_gramm'] / 1000, 2, $sp === 'en' ? '.' : ',', '')) ?> kg</dd><?php } ?>
        <?php if ($b['art'] === 'retoure' && $b['retoure_zu']) { $orig = datenbank()->query('SELECT ext_ref FROM bestellungen WHERE id = ' . (int) $b['retoure_zu'])->fetchColumn(); ?><dt><?= e(t('detail.retoure.zu')) ?></dt><dd><a class="k-mono" href="<?= e(url($pfad . '/' . $orig)) ?>"><?= e($orig) ?></a></dd><?php } ?>
      </dl>
    </div>
    <div class="k-spalten k-spalten--2">
      <div class="card"><h2 class="h3"><?= e(t('detail.absender')) ?></h2><p class="k-text"><strong><?= e($abs['name'] ?? '') ?></strong><br><?= e($abs['strasse'] ?? '') ?><br><?= e(trim(($abs['plz'] ?? '') . ' ' . ($abs['ort'] ?? ''))) ?></p></div>
      <div class="card"><h2 class="h3"><?= e(t('detail.empfaenger')) ?></h2><p class="k-text"><strong><?= e($emp['name'] ?? '') ?></strong><br><?= e($emp['strasse'] ?? '') ?><br><?= e(trim(($emp['plz'] ?? '') . ' ' . ($emp['ort'] ?? ''))) ?><br><?= e($land) ?></p></div>
    </div>
    <div class="card">
      <div class="k-karte-kopf"><h2 class="h3"><?= e(t('detail.verlauf')) ?></h2><span class="status status--vs-<?= e($b['versandstatus']) ?>"><?= e(versandstatusName((string) $b['versandstatus'], $sp)) ?></span></div>
      <ol class="k-verlauf">
        <?php foreach (array_reverse($ereignisse) as $ev) { ?><li><span class="k-mono k-klein"><?= e(zeitAnzeigen($ev['zeit'], $sp)) ?></span> <?= e($ev[$sp === 'en' ? 'text_en' : 'text_de']) ?><?= $ev['ort'] !== '' ? ' <span class="k-klein">· ' . e($ev['ort']) . '</span>' : '' ?></li><?php } ?>
        <?php if ($ereignisse === []) { foreach (array_reverse(kundenVerlauf($b)) as $v) { ?><li><span class="k-mono k-klein"><?= e(zeitAnzeigen($v['zeit'], $sp)) ?></span> <?= e($v['text']) ?></li><?php } } ?>
      </ol>
      <p class="k-klein" style="margin-top:.75rem"><?= e(t('tracking.hinweis')) ?></p>
    </div>
  </div>
  <div>
    <div class="card card--ink">
      <h2 class="h3"><?= e(t('detail.zahlung')) ?></h2>
      <dl class="k-liste k-liste--ink">
        <?php if ($business) { ?>
          <dt><?= e(t('detail.netto')) ?></dt><dd class="k-mono"><strong><?= e(euro((int) $b['netto_cent'], $sp)) ?></strong></dd>
          <dt><?= e(t('detail.zahlung')) ?></dt><dd><?= e(t('detail.zahlung.rechnung')) ?></dd>
          <dt><?= e(t('detail.rechnung')) ?></dt><dd><?= $b['rechnung_nummer'] ? '<a href="' . e(url('rechnungen/' . $b['rechnung_nummer'])) . '">' . e($b['rechnung_nummer']) . '</a>' : e(t('detail.rechnung.offen')) ?></dd>
        <?php } else { ?>
          <dt><?= e(t('detail.netto')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['netto_cent'], $sp)) ?></dd>
          <dt><?= e(t('detail.mwst')) ?></dt><dd class="k-mono"><?= e(euro((int) $b['mwst_cent'], $sp)) ?></dd>
          <dt><?= e(t('detail.brutto')) ?></dt><dd class="k-mono"><strong><?= e(euro((int) $b['betrag_cent'], $sp)) ?></strong></dd>
          <dt><?= e(t('detail.zahlung')) ?></dt><dd><?= e($b['zahlungsart'] === 'guthaben' ? t('nav.guthaben') : t('detail.zahlung.revolut')) ?></dd>
        <?php } ?>
      </dl>
      <?php $gs = json_decode((string) ($b['nachberechnung_json'] ?? '{}'), true) ?: []; $gsDa = !empty($gs['lexware_gutschrift_id']) && is_file(lexwarePdfPfad((string) $gs['lexware_gutschrift_id'])); ?>
      <?php if ((!$business && lexwarePdfPfad((string) ($b['lexware_id'] ?? '')) !== '' && is_file(lexwarePdfPfad((string) $b['lexware_id']))) || $gsDa) { ?>
        <p style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap">
          <?php if (!$business && lexwarePdfPfad((string) ($b['lexware_id'] ?? '')) !== '' && is_file(lexwarePdfPfad((string) $b['lexware_id']))) { ?><a class="btn btn--sm btn--ink" href="<?= e(url($pfad . '/' . $b['ext_ref'] . '/rechnung.pdf')) ?>" target="_blank" rel="noopener"><?= e(t('detail.rechnung.pdf')) ?><?= $b['lexware_nummer'] ? ' ' . e($b['lexware_nummer']) : '' ?> ↓</a><?php } ?>
          <?php if ($gsDa) { ?><a class="btn btn--sm k-btn-leise" href="<?= e(url($pfad . '/' . $b['ext_ref'] . '/gutschrift.pdf')) ?>" target="_blank" rel="noopener"><?= e(t('archiv.art.gutschrift')) ?> <?= e($gs['lexware_gutschrift_nummer'] ?? '') ?> ↓</a><?php } ?>
        </p>
      <?php } ?>
    </div>
    <div class="card">
      <h2 class="h3"><?= e(t('detail.label')) ?></h2>
      <?php if ($business && !darfKunde('lager', 'bearbeiten') && !darfKunde('versand', 'bearbeiten')) { ?>
        <p class="k-text"><?= e(t('gruppen.kein_recht', t('gruppen.bereich.lager'), t('gruppen.stufe.bearbeiten'))) ?></p>
      <?php } elseif (in_array($b['status'], ['bezahlt', 'beauftragt'], true)) { ?>
        <p class="k-text" style="margin-bottom:1rem"><?= e(t('label.hinweis')) ?></p>
        <a class="btn btn--primary k-btn-breit" href="<?= e(url($pfad . '/' . $b['ext_ref'] . '/label.pdf')) ?>" target="_blank" rel="noopener"><?= e(t('label.knopf')) ?> ↓</a>
      <?php } elseif ($b['zahlungsart'] === 'revolut' && in_array($b['status'], ['offen', 'angelegt', 'fehlgeschlagen'], true)) { ?>
        <p class="k-text" style="margin-bottom:1rem"><?= e(t('label.noch_nicht')) ?></p>
        <a class="btn btn--primary k-btn-breit" href="<?= e(url('bestellungen/' . $b['ext_ref'] . '/bezahlen')) ?>"><?= e(t('bezahlen.knopf')) ?> →</a>
      <?php } else { ?>
        <p class="k-text"><?= e(t('label.noch_nicht')) ?></p>
      <?php } ?>
    </div>
    <?php if (in_array($b['status'], ['bezahlt', 'beauftragt'], true) && $b['art'] !== 'retoure' && (!$business || darfKunde('retouren', 'bearbeiten'))) { ?>
    <div class="card">
      <h2 class="h3"><?= e(t('detail.retoure')) ?></h2>
      <p class="k-text" style="margin-bottom:1rem"><?= e(t('detail.retoure.text')) ?></p>
      <form method="post" action="<?= e(url($pfad . '/' . $b['ext_ref'] . '/retoure')) ?>" data-bestaetigen="<?= e(t('detail.retoure.knopf')) ?>?"><?= csrfFeld() ?><button class="btn btn--sm btn--ink" type="submit"><?= e(t('detail.retoure.knopf')) ?></button></form>
    </div>
    <?php } ?>
    <?php if (!$business || darfKunde('retouren')) { ?>
    <div class="card">
      <h2 class="h3"><?= e(t('nav.reklamationen')) ?></h2>
      <?php if ($reklamation !== null) { ?>
        <p class="k-text"><a href="<?= e(url('reklamationen')) ?>"><?= e(t('detail.reklamation.vorhanden')) ?> · <?= e(REKLAMATION_STATUS[$reklamation['status']][$sp] ?? $reklamation['status']) ?></a></p>
      <?php } else { ?>
        <?php if (!$business || darfKunde('retouren', 'bearbeiten')) { ?><a class="btn btn--sm k-btn-leise" href="<?= e(url($pfad . '/' . $b['ext_ref'] . '/reklamation')) ?>"><?= e(t('detail.reklamation.knopf')) ?></a><?php } ?>
      <?php } ?>
    </div>
    <?php } ?>
  </div>
</div>
