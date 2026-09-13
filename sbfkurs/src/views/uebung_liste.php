<?php
$modulNamen = ['funkverkehr' => 'Funkverkehr-Trainer', 'englisch' => 'Englisch für den Funkverkehr'];
$seitentitel = $modulNamen[$modul] . ' ' . $z['titel'];
$typNamen = ['lueckentext' => 'Lückentext', 'reihenfolge' => 'Reihenfolge', 'en-de' => 'Englisch → Deutsch', 'de-en' => 'Deutsch → Englisch'];
?>
<p class="brotkrumen"><a href="/">Kurse</a> › <a href="/kurs/<?= e($kennung) ?>"><?= e($z['titel']) ?></a> › <?= e($modulNamen[$modul]) ?></p>
<h1><?= e($modulNamen[$modul]) ?></h1>
<?php if ($modul === 'funkverkehr') { ?>
<p class="kurz">Notruf, Dringlichkeitsmeldung, Sicherheitsmeldung: Hier übst du den Wortlaut und die Reihenfolge, bis sie sitzen. Groß-/Kleinschreibung und Satzzeichen sind egal; ein Tippfehler in langen Wörtern kostet einen halben Punkt.</p>
<?php } else { ?>
<p class="kurz">Wie im schriftlichen Prüfungsteil: Du übersetzt Standardmeldungen und vergleichst mit der Musterlösung. Bewertet wird nach Schlüsselbegriffen — und nach deiner eigenen ehrlichen Einschätzung.</p>
<?php } ?>
<?php if ($uebungen === []) { ?>
<p class="karte">Für diesen Kurs sind noch keine Übungen hinterlegt.</p>
<?php } ?>
<ol class="uebungsliste">
<?php foreach ($uebungen as $id => $u) { $b = $stand['beste'][$id] ?? null; ?>
    <li class="karte <?= $b !== null && $b['beste'] >= 80 ? 'gelesen' : '' ?>">
        <a href="/uebung/<?= e($kennung) ?>/<?= e($modul) ?>/<?= e($id) ?>"><?= e($u['titel'] ?? $id) ?></a>
        <small><?= e($typNamen[$u['typ'] ?? $u['richtung'] ?? ''] ?? '') ?><?php if ($b !== null) { ?> · bestes Ergebnis <?= (int) $b['beste'] ?> % (<?= (int) $b['versuche'] ?>×)<?php } ?></small>
    </li>
<?php } ?>
</ol>
