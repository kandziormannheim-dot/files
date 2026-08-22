<?php

/**
 * Seitenrahmen aller Ansichten. Erwartet $inhaltDatei (die eigentliche
 * Ansicht) und optional $sprache; Admin-Seiten bekommen die Navigation.
 */

$sprache = $sprache ?? 'de';
$hinweis = $_SESSION['hinweis'] ?? null;
unset($_SESSION['hinweis']);
?>
<!doctype html>
<html lang="<?= e($sprache) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($konfig['fahrzeugName']) ?> — Schadensakte</title>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<header class="kopf">
    <div class="kopf-innen">
        <span class="marke">🚐 <?= e($konfig['fahrzeugName']) ?></span>
        <?php if (adminAngemeldet()) { ?>
        <nav>
            <a href="/">Vorgänge</a>
            <a href="/schaden/neu">Neuer Vorgang</a>
            <a href="/protokolle">Protokolle</a>
            <a href="/vermietungen">Vermietungen</a>
            <a href="/fahrzeuge">Fahrzeuge</a>
            <form method="post" action="/logout" class="inline"><?= csrfFeld() ?>
                <button class="leise" type="submit">Abmelden</button>
            </form>
        </nav>
        <?php } ?>
    </div>
</header>
<main>
<?php if ($hinweis !== null) { ?>
    <p class="hinweis"><?= e($hinweis) ?></p>
<?php } ?>
<?php require $inhaltDatei; ?>
</main>
<script src="/assets/app.js"></script>
</body>
</html>
