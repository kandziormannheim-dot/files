<?php

/**
 * Seitenrahmen aller Ansichten. Erwartet $inhaltDatei (die eigentliche
 * Ansicht) und optional $seitentitel; Angemeldete bekommen die Navigation.
 */

$hinweis = $_SESSION['hinweis'] ?? null;
unset($_SESSION['hinweis']);
// Die Ansicht zuerst rendern: sie setzt $seitentitel und $breit für den Rahmen.
ob_start();
require $inhaltDatei;
$inhalt = (string) ob_get_clean();
$seitentitel = isset($seitentitel) ? $seitentitel . ' — ' . $konfig['titel'] : $konfig['titel'];
$breit = $breit ?? false;
$skripte = $skripte ?? [];
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($seitentitel) ?></title>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<a class="sprung" href="#inhalt">Zum Inhalt</a>
<header class="kopf">
    <div class="kopf-innen">
        <a class="marke" href="/">⚓ <?= e($konfig['titel']) ?></a>
        <?php if ($benutzer !== null) { ?>
        <nav aria-label="Hauptnavigation">
            <a href="/">Kurse</a>
            <a href="/uebung/buchstabieren">Buchstabieren</a>
            <a href="/uebung/dsc">DSC</a>
            <a href="/konto"><?= e($benutzer['name'] !== '' ? $benutzer['name'] : 'Konto') ?></a>
            <?php if (istAdmin($benutzer)) { ?><a href="/admin">Admin</a><?php } ?>
            <form method="post" action="/logout" class="inline"><?= csrfFeld() ?>
                <button class="leise" type="submit">Abmelden</button>
            </form>
        </nav>
        <?php } else { ?>
        <nav aria-label="Hauptnavigation">
            <a href="/login">Anmelden</a>
            <a href="/registrieren">Registrieren</a>
        </nav>
        <?php } ?>
    </div>
</header>
<main id="inhalt"<?= $breit ? ' class="breit"' : '' ?>>
<?php if ($hinweis !== null) { ?>
    <p class="hinweis" role="status"><?= e($hinweis) ?></p>
<?php } ?>
<?= $inhalt ?>
</main>
<footer class="fuss">
    <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a>
    <span class="fuss-hinweis">Lernplattform — maßgeblich für Prüfungen ist die jeweils aktuelle Prüfungsordnung.</span>
</footer>
<script src="/assets/app.js"></script>
<?php foreach ($skripte as $skript) { ?><script src="<?= e($skript) ?>"></script>
<?php } ?>
</body>
</html>
