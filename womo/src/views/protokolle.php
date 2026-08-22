<h1>Protokolle</h1>

<?php if ($protokolle === []) { ?>
<p>Noch keine Protokolle erstellt. Protokolle werden auf der Seite einer
    <a href="/vermietungen">Vermietung</a> gestartet.</p>
<?php } else { ?>
<table class="liste">
    <thead>
        <tr><th>Nr.</th><th>Art</th><th>Mieter</th><th>Fahrzeug</th><th>Zeitraum</th><th>Status</th><th>PDF</th></tr>
    </thead>
    <tbody>
        <?php foreach ($protokolle as $protokoll) { ?>
        <tr>
            <td><a href="/protokoll/<?= (int) $protokoll['id'] ?>">P-<?= sprintf('%04d', (int) $protokoll['id']) ?></a></td>
            <td><a href="/protokoll/<?= (int) $protokoll['id'] ?>"><?= e(t('de', 'protokoll.' . $protokoll['typ'])) ?></a></td>
            <td><?= e($protokoll['mieter_name']) ?></td>
            <td><?= e($protokoll['fahrzeug_name'] ?? '') ?></td>
            <td><?= e(datumAnzeigen($protokoll['von'])) ?> – <?= e(datumAnzeigen($protokoll['bis'])) ?></td>
            <td>
                <?php if ($protokoll['status'] === 'entwurf') { ?>
                <span class="status status-offen">Entwurf</span>
                <?php } else { ?>
                <span class="status status-repariert">abgeschlossen</span>
                <small><?= e(zeitAnzeigen($protokoll['abgeschlossen_am'])) ?></small>
                <?php } ?>
            </td>
            <td>
                <?php if ((string) $protokoll['pdf_datei'] !== '') { ?>
                <a href="/pdf/<?= (int) $protokoll['id'] ?>" target="_blank">PDF öffnen</a>
                <?php } elseif ((int) $protokoll['anonymisiert'] === 1) { ?>
                <small>anonymisiert</small>
                <?php } else { ?>
                <small>—</small>
                <?php } ?>
            </td>
        </tr>
        <?php } ?>
    </tbody>
</table>
<?php } ?>
