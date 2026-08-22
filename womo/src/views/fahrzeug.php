<h1>🚐 <?= e($fahrzeug['name']) ?></h1>

<section class="karte">
    <h2>Schadenspunkte</h2>
    <?php require __DIR__ . '/_skizze.php'; ?>
    <?php if ($offene !== []) { ?>
    <ul>
        <?php foreach ($offene as $schaden) { ?>
        <li>
            <a href="/schaden/<?= (int) $schaden['id'] ?>">
                <?= e(vorgangsnummer((int) $schaden['id'], (string) $schaden['erstellt_am'])) ?> —
                <?= e(zonenName($schaden['zone'])) ?>: <?= e(mb_substr($schaden['beschreibung'], 0, 70)) ?>
            </a>
            <small>(<?= e(typName((string) ($schaden['typ'] ?? 'schaden'))) ?>,
                <?= e(statusName($schaden['status'])) ?>)</small>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>
</section>

<section class="karte">
    <h2>Fahrzeugdaten</h2>
    <form method="post" action="/fahrzeug/<?= (int) $fahrzeug['id'] ?>">
        <?= csrfFeld() ?>
        <div class="reihe">
            <label>Name
                <input type="text" name="name" maxlength="100" required value="<?= e($fahrzeug['name']) ?>">
            </label>
            <label>Kennzeichen
                <input type="text" name="kennzeichen" maxlength="20" value="<?= e($fahrzeug['kennzeichen']) ?>">
            </label>
        </div>
        <div class="reihe">
            <label>Hersteller
                <input type="text" name="hersteller" maxlength="100" value="<?= e($fahrzeug['hersteller']) ?>"
                    placeholder="z. B. Knaus">
            </label>
            <label>Modell
                <input type="text" name="modell" maxlength="100" value="<?= e($fahrzeug['modell']) ?>"
                    placeholder="z. B. Boxstar 600">
            </label>
        </div>
        <div class="reihe">
            <label>Fahrgestellnummer (FIN)
                <input type="text" name="fin" maxlength="30" value="<?= e($fahrzeug['fin']) ?>">
            </label>
            <label>Erstzulassung
                <input type="date" name="erstzulassung" value="<?= e($fahrzeug['erstzulassung']) ?>">
            </label>
        </div>
        <div class="reihe">
            <label>km-Stand
                <input type="text" name="km_stand" maxlength="20" inputmode="numeric"
                    value="<?= e($fahrzeug['km_stand']) ?>">
            </label>
            <label>TÜV / HU bis
                <input type="date" name="tuev_bis" value="<?= e($fahrzeug['tuev_bis']) ?>">
            </label>
        </div>
        <label>Versicherung
            <input type="text" name="versicherung" maxlength="200" value="<?= e($fahrzeug['versicherung']) ?>"
                placeholder="Gesellschaft, Versicherungsnummer">
        </label>
        <label>Notizen
            <textarea name="notizen" rows="3" maxlength="2000"><?= e($fahrzeug['notizen']) ?></textarea>
        </label>
        <button type="submit">Fahrzeugdaten speichern</button>
    </form>
</section>
