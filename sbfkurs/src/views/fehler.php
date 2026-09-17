<?php $seitentitel = $titel; ?>
<section class="karte schmal">
    <h1><?= e($titel) ?></h1>
    <?php if ($text !== '') { ?><p><?= e($text) ?></p><?php } ?>
    <p class="nachsatz"><a href="/">Zur Übersicht</a></p>
</section>
