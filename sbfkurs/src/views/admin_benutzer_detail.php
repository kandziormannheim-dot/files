<?php $seitentitel = $konto['email']; ?>
<p class="brotkrumen"><a href="/admin">Verwaltung</a> › <a href="/admin/benutzer">Konten</a> › <?= e($konto['email']) ?></p>
<h1><?= e($konto['name'] !== '' ? $konto['name'] : $konto['email']) ?></h1>
<?php if ($fehler !== null) { ?><p class="fehler" role="alert"><?= e($fehler) ?></p><?php } ?>
<div class="zweispaltig">
<section class="karte">
    <h2>Konto</h2>
    <p><?= e($konto['email']) ?> · Rolle <strong><?= e($konto['rolle']) ?></strong> · <?= (int) $konto['aktiv'] === 1 ? 'aktiv' : 'gesperrt' ?><br>
    <small>angelegt <?= e(zeitAnzeigen($konto['erstellt_am'])) ?>, zuletzt angemeldet <?= e(zeitAnzeigen($konto['letzte_anmeldung']) ?: 'nie') ?><?= (int) $konto['passwort_wechsel_noetig'] === 1 ? ', Passwortwechsel steht aus' : '' ?></small></p>
    <?php if ($selbst) { ?><p><small>Das ist dein eigenes Konto — Rolle, Sperre und Löschung sind hier nicht möglich.</small></p><?php } ?>

    <?php if (!$selbst) { ?>
    <form method="post" action="/admin/benutzer/<?= (int) $konto['id'] ?>" class="inline">
        <?= csrfFeld() ?><input type="hidden" name="aktion" value="rolle">
        <input type="hidden" name="rolle" value="<?= $konto['rolle'] === 'admin' ? 'lerner' : 'admin' ?>">
        <button type="submit" class="zweit"><?= $konto['rolle'] === 'admin' ? 'Zum Lernenden machen' : 'Zum Admin machen' ?></button>
    </form>
    <?php } ?>
    <?php if ((int) $konto['aktiv'] === 1 && !$selbst) { ?>
    <form method="post" action="/admin/benutzer/<?= (int) $konto['id'] ?>" class="inline">
        <?= csrfFeld() ?><input type="hidden" name="aktion" value="sperren">
        <button type="submit" class="zweit">Sperren</button>
    </form>
    <?php } elseif ((int) $konto['aktiv'] !== 1 || $konto['gesperrt_bis'] !== null) { ?>
    <form method="post" action="/admin/benutzer/<?= (int) $konto['id'] ?>" class="inline">
        <?= csrfFeld() ?><input type="hidden" name="aktion" value="entsperren">
        <button type="submit" class="zweit">Entsperren</button>
    </form>
    <?php } ?>

    <h2>Passwort zurücksetzen</h2>
    <form method="post" action="/admin/benutzer/<?= (int) $konto['id'] ?>">
        <?= csrfFeld() ?><input type="hidden" name="aktion" value="passwort">
        <label><?= $selbst ? 'Neues Passwort' : 'Übergangspasswort' ?> <small>(mind. 10 Zeichen)</small>
            <input type="text" name="passwort" minlength="10" required autocomplete="off">
        </label>
        <button type="submit">Setzen</button>
    </form>

    <?php if (!$selbst) { ?>
    <h2>Löschen</h2>
    <form method="post" action="/admin/benutzer/<?= (int) $konto['id'] ?>" data-bestaetigen="Konto und gesamten Lernstand unwiderruflich löschen?">
        <?= csrfFeld() ?><input type="hidden" name="aktion" value="loeschen">
        <button type="submit" class="gefahr">Konto löschen</button>
    </form>
    <?php } ?>
</section>

<section class="karte">
    <h2>Lernstand</h2>
    <?php foreach ($lernstand as $kennung => $stand) { ?>
    <h3><?= e($stand['zertifikat']['titel']) ?></h3>
    <?php require __DIR__ . '/_lernstand.php'; ?>
    <ul class="kennzahlen">
        <li><?= $stand['lektionen']['gelesen'] ?>/<?= $stand['lektionen']['gesamt'] ?> Lektionen</li>
        <li><?= $stand['fragen']['sicher'] ?>/<?= $stand['fragen']['gesamt'] ?> Fragen sicher</li>
        <li><?= $stand['pruefungen']['bestanden'] ?>/<?= $stand['pruefungen']['versuche'] ?> Prüfungen bestanden</li>
    </ul>
    <?php } ?>
</section>
</div>
