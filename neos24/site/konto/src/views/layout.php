<?php

/**
 * Seitenrahmen des Kundenportals im Look der Startseite: Kopf mit
 * Wortmarke, Reiter-Navigation je Kundenart, Sprachumschalter, Inhalt.
 * Erwartet $inhaltDatei, $titel, $aktiv.
 */

$ich = kundeAktuell();
$hinweis = hinweisHolen();
$titel = $titel ?? t('portal');
$aktiv = $aktiv ?? '';
$sprache = sprache();
$andere = $sprache === 'en' ? 'de' : 'en';
$aktuellePfad = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$wechsel = $aktuellePfad . '?' . http_build_query(array_merge(array_diff_key($_GET, ['sprache' => 1, 'pfad' => 1]), ['sprache' => $andere]));
$navi = [];
if ($ich !== null) {
    if ($ich['art'] === 'business') {
        $navi = ['uebersicht' => ['', t('nav.uebersicht')], 'sendungen' => ['sendungen', t('nav.sendungen')], 'neu' => ['sendungen/neu', t('nav.neu')], 'preise' => ['preise', t('nav.preise')], 'rechnungen' => ['rechnungen', t('nav.rechnungen')]];
        if ($ich['firmenrolle'] === 'inhaber') {
            $navi['benutzer'] = ['benutzer', t('nav.benutzer')];
            $navi['firma'] = ['firma', t('nav.firma')];
        }
    } else {
        $navi = ['uebersicht' => ['', t('nav.uebersicht')], 'bestellungen' => ['bestellungen', t('nav.bestellungen')]];
    }
    $navi['einstellungen'] = ['einstellungen', t('nav.einstellungen')];
}
?>
<!doctype html>
<html lang="<?= e($sprache) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0C0E16">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230C0E16'/%3E%3Ctext x='32' y='44' text-anchor='middle' font-family='Sora,Arial,sans-serif' font-weight='800' font-size='34' fill='none' stroke='%2329D3F5' stroke-width='2'%3EN%3C/text%3E%3C/svg%3E">
<title><?= e($titel) ?> · NEOS <?= e(t('portal')) ?></title>
<link rel="stylesheet" href="<?= e(url('../assets/fonts.css')) ?>">
<link rel="stylesheet" href="<?= e(url('../assets/neos.css')) ?>">
<link rel="stylesheet" href="<?= e(url('assets/konto.css')) ?>">
</head>
<body class="konto <?= $ich === null ? 'konto--gast' : '' ?>">
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="neos-logo" viewBox="0 0 112 40">
    <text x="2" y="31" font-family="Sora, 'Hanken Grotesk', sans-serif" font-weight="800" font-size="34" fill="none" stroke-width="1.7" stroke-linejoin="round" letter-spacing="1.5"><tspan stroke="#29D3F5">N</tspan><tspan stroke="#FF5A2C">E</tspan><tspan stroke="#F4ED20">O</tspan><tspan stroke="#FF26A1">S</tspan></text>
  </symbol>
</svg>
<header class="k-kopf">
  <div class="container k-kopf-innen">
    <a class="k-marke" href="<?= e(startseite()) ?>" aria-label="neos24.com"><svg viewBox="0 0 112 40" width="84" height="30" aria-hidden="true"><use href="#neos-logo"></use></svg><span class="k-marke-zusatz"><?= e(t('portal')) ?></span></a>
    <?php if ($ich !== null) { ?>
    <input type="checkbox" id="k-navi-schalter" class="k-navi-schalter" hidden>
    <label for="k-navi-schalter" class="k-navi-knopf" aria-label="Menü">☰</label>
    <nav class="k-navi" aria-label="<?= e(t('portal')) ?>">
      <?php foreach ($navi as $schluessel => [$naviPfad, $naviName]) { ?>
        <a href="<?= e(url($naviPfad)) ?>" class="<?= $aktiv === $schluessel ? 'aktiv' : '' ?>"><?= e($naviName) ?></a>
      <?php } ?>
      <span class="k-navi-rest">
        <a class="k-sprache" href="<?= e($wechsel) ?>" hreflang="<?= e($andere) ?>"><?= e(t('sprache_wechseln')) ?></a>
        <form method="post" action="<?= e(url('logout')) ?>" class="k-inline"><?= csrfFeld() ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('abmelden')) ?></button></form>
      </span>
    </nav>
    <?php } else { ?>
    <nav class="k-navi k-navi--gast">
      <a class="k-sprache" href="<?= e($wechsel) ?>" hreflang="<?= e($andere) ?>"><?= e(t('sprache_wechseln')) ?></a>
      <a class="k-sprache" href="<?= e(startseite()) ?>"><?= e(t('zur_seite')) ?></a>
    </nav>
    <?php } ?>
  </div>
</header>
<main class="container k-inhalt">
<?php if ($ich !== null) { ?>
  <p class="k-ich"><?= e($ich['name']) ?><?= $ich['art'] === 'business' ? ' · ' . e($ich['firma'] ?? '') . ' (' . e(t('benutzer.rolle.' . ($ich['firmenrolle'] ?: 'mitarbeiter'))) . ')' : '' ?></p>
<?php } ?>
<?php if ($hinweis !== null) { ?>
  <p class="k-hinweis k-hinweis--<?= e($hinweis['art']) ?>" role="status"><?= e($hinweis['text']) ?></p>
<?php } ?>
<?php require $inhaltDatei; ?>
</main>
<footer class="k-fuss container">
  <span>© <?= date('Y') ?> NEOS Logistics UG</span>
  <a href="<?= e(startseite()) ?>"><?= e(t('zur_seite')) ?></a>
  <a href="mailto:info@neos24.com">info@neos24.com</a>
</footer>
<script src="<?= e(url('assets/konto.js')) ?>" defer></script>
</body>
</html>
