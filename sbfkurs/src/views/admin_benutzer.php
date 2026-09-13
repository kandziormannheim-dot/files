<?php $seitentitel = 'Konten'; ?>
<h1>Konten</h1>
<nav class="filter" aria-label="Admin">
    <a href="/admin">Übersicht</a>
    <a href="/admin/benutzer" class="aktiv">Konten</a>
    <a href="/admin/einladungen">Einladungen</a>
    <a href="/admin/inhalte">Inhalte</a>
</nav>
<div class="tabelle-rahmen">
<table class="liste">
    <thead><tr><th>E-Mail</th><th>Name</th><th>Rolle</th><th>Status</th><th>Zuletzt</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($liste as $k) { ?>
        <tr>
            <td><?= e($k['email']) ?></td>
            <td><?= e($k['name']) ?></td>
            <td><?= e($k['rolle']) ?></td>
            <td><?php if ((int) $k['aktiv'] !== 1) { ?><span class="status status-schlecht">gesperrt</span><?php } elseif ($k['gesperrt_bis'] !== null && $k['gesperrt_bis'] > gmdate('Y-m-d H:i:s')) { ?><span class="status status-warn">Fehlversuche</span><?php } else { ?><span class="status status-gut">aktiv</span><?php } ?></td>
            <td><?= e(zeitAnzeigen($k['letzte_anmeldung'])) ?></td>
            <td><a href="/admin/benutzer/<?= (int) $k['id'] ?>">Öffnen</a></td>
        </tr>
    <?php } ?>
    </tbody>
</table>
</div>
<section class="karte">
    <h2>Konto anlegen</h2>
    <?php if ($fehler !== null) { ?><p class="fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
    <form method="post" action="/admin/benutzer">
        <?= csrfFeld() ?>
        <div class="reihe">
            <label>E-Mail-Adresse <input type="email" name="email" required></label>
            <label>Name <input type="text" name="name" maxlength="100"></label>
            <label>Startpasswort <small>(mind. 10 Zeichen; muss beim ersten Anmelden geändert werden)</small> <input type="text" name="passwort" minlength="10" required autocomplete="off"></label>
            <label>Rolle <select name="rolle"><option value="lerner">Lernende/r</option><option value="admin">Admin</option></select></label>
        </div>
        <button type="submit">Anlegen</button>
    </form>
</section>
