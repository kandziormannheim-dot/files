<?php
/** Partial: Fortschrittsbalken mit Ampel. Erwartet $stand (aus lernstandBerechnen). */
?>
<div class="lernstand ampel-<?= e($stand['ampel']) ?>">
    <progress value="<?= (int) $stand['prozent'] ?>" max="100" aria-label="Lernstand"></progress>
    <span class="lernstand-zahl"><?= (int) $stand['prozent'] ?> %</span>
</div>
