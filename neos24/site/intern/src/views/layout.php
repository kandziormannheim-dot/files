<?php

/**
 * Seitenrahmen: Seitenleiste mit Wortmarke und Modulen (nur die, die der
 * Benutzer sehen darf), Kopfzeile mit Titel, Hinweis, Inhalt.
 * Erwartet $inhaltDatei, $titel, $aktiv (Nav-Schlüssel).
 */

$ich = benutzerAktuell();
$hinweis = hinweisHolen();
$titel = $titel ?? 'Dashboard';
$aktiv = $aktiv ?? '';
$symbole = ['uebersicht' => '◎', 'bestellungen' => '▤', 'preise' => '€', 'routing' => '⇄', 'kunden' => '☺', 'rechnungen' => '▣', 'benutzer' => '⚙'];
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0C0E16">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230C0E16'/%3E%3Ctext x='32' y='44' text-anchor='middle' font-family='Sora,Arial,sans-serif' font-weight='800' font-size='34' fill='none' stroke='%2329D3F5' stroke-width='2'%3EN%3C/text%3E%3C/svg%3E">
<title><?= e($titel) ?> · NEOS intern</title>
<link rel="stylesheet" href="<?= e(url('../assets/fonts.css')) ?>">
<link rel="stylesheet" href="<?= e(url('assets/intern.css')) ?>">
</head>
<body class="<?= $ich === null ? 'ohne-navi' : '' ?>">
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="neos-logo" viewBox="0 0 112 40">
    <text x="2" y="31" font-family="Sora, 'Hanken Grotesk', sans-serif" font-weight="800" font-size="34" fill="none" stroke-width="1.7" stroke-linejoin="round" letter-spacing="1.5"><tspan stroke="#29D3F5">N</tspan><tspan stroke="#FF5A2C">E</tspan><tspan stroke="#F4ED20">O</tspan><tspan stroke="#FF26A1">S</tspan></text>
  </symbol>
</svg>
<?php if ($ich !== null) { ?>
<input type="checkbox" id="navi-schalter" class="navi-schalter" hidden>
<aside class="seitenleiste">
  <div class="marke">
    <a href="<?= e(url()) ?>" aria-label="NEOS intern — Übersicht"><svg class="logo" viewBox="0 0 112 40" width="78" height="28" aria-hidden="true"><use href="#neos-logo"></use></svg></a>
    <span class="marke-zusatz">intern</span>
    <label for="navi-schalter" class="navi-knopf" aria-label="Menü">☰</label>
  </div>
  <nav class="navi" aria-label="Module">
    <?php foreach (moduleSichtbar() as $modul => $name) { ?>
      <a href="<?= e(url($modul === 'uebersicht' ? '' : $modul)) ?>" class="<?= $aktiv === $modul ? 'aktiv' : '' ?>"><span class="symbol" aria-hidden="true"><?= $symbole[$modul] ?? '•' ?></span><?= e($name) ?></a>
    <?php } ?>
  </nav>
  <div class="seitenleiste-fuss">
    <a href="<?= e(url('konto')) ?>" class="ich <?= $aktiv === 'konto' ? 'aktiv' : '' ?>">
      <strong><?= e($ich['name']) ?></strong>
      <span><?= e($ich['rolle']) ?></span>
    </a>
    <form method="post" action="<?= e(url('logout')) ?>"><?= csrfFeld() ?><button class="knopf knopf--leise knopf--klein" type="submit">Abmelden</button></form>
    <a class="zur-seite" href="<?= e(url('../')) ?>" target="_blank" rel="noopener">neos24.com ↗</a>
  </div>
</aside>
<?php } ?>
<main class="inhalt">
<?php if ($hinweis !== null) { ?>
  <p class="hinweis hinweis--<?= e($hinweis['art']) ?>" role="status"><?= e($hinweis['text']) ?></p>
<?php } ?>
<?php require $inhaltDatei; ?>
</main>
<script src="<?= e(url('assets/intern.js')) ?>" defer></script>
</body>
</html>
