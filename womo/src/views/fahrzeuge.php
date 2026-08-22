<h1>Fahrzeuge</h1>

<?php foreach ($fehler as $meldung) { ?>
<p class="fehler"><?= e($meldung) ?></p>
<?php } ?>

<table class="liste">
    <thead>
        <tr><th>Fahrzeug</th><th>Kennzeichen</th><th>Hersteller / Modell</th><th>TÜV bis</th><th>km-Stand</th><th></th></tr>
    </thead>
    <tbody>
        <?php foreach ($fahrzeuge as $fahrzeug) { ?>
        <tr>
            <td><a href="/fahrzeug/<?= (int) $fahrzeug['id'] ?>">🚐 <?= e($fahrzeug['name']) ?></a></td>
            <td><?= e($fahrzeug['kennzeichen']) ?></td>
            <td><?= e(trim($fahrzeug['hersteller'] . ' ' . $fahrzeug['modell'])) ?></td>
            <td><?= e(datumAnzeigen($fahrzeug['tuev_bis'])) ?></td>
            <td><?= e($fahrzeug['km_stand']) ?></td>
            <td><a href="/fahrzeug/<?= (int) $fahrzeug['id'] ?>">Öffnen</a></td>
        </tr>
        <?php } ?>
    </tbody>
</table>

<section class="karte">
    <h2>Fahrzeug hinzufügen</h2>
    <form method="post" action="/fahrzeuge">
        <?= csrfFeld() ?>
        <div class="reihe">
            <label>Name
                <input type="text" name="name" maxlength="100" required placeholder="z. B. Wohnmobil 2">
            </label>
            <label>Kennzeichen
                <input type="text" name="kennzeichen" maxlength="20" placeholder="z. B. MA-XX 123">
            </label>
        </div>
        <button type="submit">Fahrzeug anlegen</button>
    </form>
</section>
