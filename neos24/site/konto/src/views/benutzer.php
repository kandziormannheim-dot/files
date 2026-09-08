<?php $ich = kundeAktuell(); $sp = sprache(); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e($firma['name']) ?></span><h1 class="h2"><?= e(t('benutzer.titel')) ?></h1><p class="k-text"><?= e(t('benutzer.text', $firma['name'])) ?></p></div>
</header>
<div class="k-spalten k-spalten--2-1">
  <div class="card k-karte-tabelle">
    <div class="k-scroll"><table class="table k-tabelle">
      <thead><tr><th><?= e(t('registrieren.name')) ?></th><th><?= e(t('login.email')) ?></th><th><?= e(t('liste.status')) ?></th><th></th></tr></thead>
      <tbody>
      <?php foreach ($zeilen as $b) { $selbst = (int) $b['id'] === (int) $ich['id']; ?>
        <tr class="<?= (int) $b['aktiv'] === 1 ? '' : 'k-inaktiv' ?>">
          <td><?= e($b['name']) ?><br><span class="k-klein"><?= e(t('benutzer.rolle.' . ($b['firmenrolle'] ?: 'mitarbeiter'))) ?></span></td>
          <td><?= e($b['email']) ?></td>
          <td><?= (int) $b['aktiv'] !== 1 ? '<span class="status status--storniert">' . e(t('benutzer.inaktiv')) . '</span>' : ((int) $b['email_bestaetigt'] !== 1 ? '<span class="status status--angelegt">' . e(t('benutzer.ausstehend')) . '</span>' : '<span class="status status--bezahlt">✓</span>') ?></td>
          <td class="k-aktionen">
            <?php if (!$selbst) { ?>
              <?php if ((int) $b['email_bestaetigt'] !== 1 && (int) $b['aktiv'] === 1) { ?><form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/einladen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('benutzer.erneut')) ?></button></form><?php } ?>
              <form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/' . ((int) $b['aktiv'] === 1 ? 'deaktivieren' : 'aktivieren'))) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e((int) $b['aktiv'] === 1 ? t('benutzer.deaktivieren') : t('benutzer.aktivieren')) ?></button></form>
            <?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table></div>
  </div>
  <div class="card">
    <h2 class="h3"><?= e(t('benutzer.einladen')) ?></h2>
    <form method="post" action="<?= e(url('benutzer/einladen')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <div class="field"><label for="b-name"><?= e(t('registrieren.name')) ?></label><input id="b-name" name="name" type="text" minlength="2" required></div>
      <div class="field"><label for="b-email"><?= e(t('login.email')) ?></label><input id="b-email" name="email" type="email" required></div>
      <button class="btn btn--primary" type="submit"><?= e(t('benutzer.einladen')) ?></button>
    </form>
  </div>
</div>
