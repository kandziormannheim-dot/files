<?php $seitentitel = 'Einladungen'; ?>
<h1>Einladungen</h1>
<nav class="filter" aria-label="Admin">
    <a href="/admin">Übersicht</a>
    <a href="/admin/benutzer">Konten</a>
    <a href="/admin/einladungen" class="aktiv">Einladungen</a>
    <a href="/admin/inhalte">Inhalte</a>
</nav>
<section class="karte">
    <p><?= $konfigCode ? 'In der Konfiguration ist ein allgemeiner Einladungscode gesetzt; er gilt unbegrenzt oft.' : 'In der Konfiguration ist kein allgemeiner Einladungscode gesetzt — Registrierung nur mit Einmalcodes.' ?></p>
    <form method="post" action="/admin/einladungen" class="reihe">
        <?= csrfFeld() ?>
        <input type="hidden" name="aktion" value="erzeugen">
        <label>Bemerkung <small>(für wen?)</small> <input type="text" name="bemerkung" maxlength="100"></label>
        <p><button type="submit">Einmalcode erzeugen</button></p>
    </form>
</section>
<div class="tabelle-rahmen">
<table class="liste">
    <thead><tr><th>Code</th><th>Bemerkung</th><th>Erstellt</th><th>Verbraucht</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($liste as $e) { ?>
        <tr>
            <td><code><?= e($e['code']) ?></code></td>
            <td><?= e($e['bemerkung']) ?></td>
            <td><?= e(zeitAnzeigen($e['erstellt_am'])) ?></td>
            <td><?= $e['verbraucht_am'] !== null ? e(zeitAnzeigen($e['verbraucht_am'])) . ' von ' . e($e['verbraucht_email'] ?? '?') : '—' ?></td>
            <td><?php if ($e['verbraucht_am'] === null) { ?>
                <form method="post" action="/admin/einladungen" class="inline"><?= csrfFeld() ?><input type="hidden" name="aktion" value="loeschen"><input type="hidden" name="code" value="<?= e($e['code']) ?>"><button type="submit" class="leise">Löschen</button></form>
            <?php } ?></td>
        </tr>
    <?php } ?>
    </tbody>
</table>
</div>
