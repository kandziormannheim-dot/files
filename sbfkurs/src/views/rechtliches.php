<?php $seitentitel = $titel; ?>
<article class="lesetext">
    <h1><?= e($titel) ?></h1>
    <?php if ($html === null) { ?>
    <p>Dieser Text ist noch nicht hinterlegt (content/gemeinsam/rechtliches/).</p>
    <?php } else { ?>
    <?= $html ?>
    <?php } ?>
</article>
