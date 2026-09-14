<?php $ich = kundeAktuell(); $sp = sprache(); $darf = $darf ?? false; $inhaber = $inhaber ?? false; $gruppen = $gruppen ?? []; $unterkunden = $unterkunden ?? []; $uNummern = array_column($unterkunden, 'nummer', 'id'); ?>
<header class="k-kopfzeile">
  <div><span class="eyebrow eyebrow--magenta"><?= e($firma['name']) ?></span><h1 class="h2"><?= e(t('benutzer.titel')) ?></h1><p class="k-text"><?= e(t('benutzer.text', $firma['name'])) ?> <?= e(t('benutzer.gruppe.text')) ?></p></div>
  <a class="btn btn--sm k-btn-leise" href="<?= e(url('benutzer/gruppen')) ?>"><?= e(t('gruppen.verwalten')) ?> →</a>
</header>
<div class="k-spalten k-spalten--2-1">
  <div class="card k-karte-tabelle">
    <div class="k-scroll"><table class="table k-tabelle">
      <thead><tr><th><?= e(t('registrieren.name')) ?></th><th><?= e(t('login.email')) ?></th><th><?= e(t('benutzer.gruppe')) ?></th><?php if ($unterkunden !== []) { ?><th><?= e(t('benutzer.unterkunde')) ?></th><?php } ?><th><?= e(t('liste.status')) ?></th><th></th></tr></thead>
      <tbody>
      <?php foreach ($zeilen as $b) { $selbst = (int) $b['id'] === (int) $ich['id']; $istInh = ($b['firmenrolle'] ?? '') === 'inhaber'; $aenderbar = $darf && (!$istInh || $inhaber); ?>
        <tr class="<?= (int) $b['aktiv'] === 1 ? '' : 'k-inaktiv' ?>">
          <td><?= e($b['name']) ?><br><span class="k-klein"><?= e(t('benutzer.rolle.' . ($b['firmenrolle'] ?: 'mitarbeiter'))) ?></span></td>
          <td><?= e($b['email']) ?></td>
          <td>
            <?php if ($istInh) { ?><span class="k-klein"><?= e(t('benutzer.gruppe.inhaber')) ?></span>
            <?php } elseif ($aenderbar && !($selbst && !$inhaber)) { ?>
              <form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/gruppe')) ?>"><?= csrfFeld() ?><select name="gruppe_id" class="k-adresswahl" aria-label="<?= e(t('benutzer.gruppe')) ?>" onchange="this.form.requestSubmit()"><option value="0"><?= e(t('benutzer.gruppe.keine')) ?></option><?php foreach ($gruppen as $g) { ?><option value="<?= (int) $g['id'] ?>" <?= (int) ($b['gruppe_id'] ?? 0) === (int) $g['id'] ? 'selected' : '' ?>><?= e($g['name']) ?></option><?php } ?></select></form>
            <?php } else { ?><?= e($b['gruppe_name'] ?? '' ?: t('benutzer.gruppe.keine')) ?><?php } ?>
          </td>
          <?php if ($unterkunden !== []) { ?>
          <td>
            <?php if ($aenderbar) { ?>
              <form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/unterkunde')) ?>"><?= csrfFeld() ?><select name="unterkunde_id" class="k-adresswahl" aria-label="<?= e(t('benutzer.unterkunde')) ?>" onchange="this.form.requestSubmit()"><option value="0"><?= e(t('unterkunde.hauptfirma')) ?></option><?php foreach ($unterkunden as $u) { ?><option value="<?= (int) $u['id'] ?>" <?= (int) ($b['unterkunde_id'] ?? 0) === (int) $u['id'] ? 'selected' : '' ?>><?= e($u['nummer']) ?> · <?= e($u['name']) ?></option><?php } ?></select></form>
            <?php } else { ?><span class="k-mono k-klein"><?= e($uNummern[(int) ($b['unterkunde_id'] ?? 0)] ?? t('unterkunde.hauptfirma')) ?></span><?php } ?>
          </td>
          <?php } ?>
          <td><?= (int) $b['aktiv'] !== 1 ? '<span class="status status--storniert">' . e(t('benutzer.inaktiv')) . '</span>' : ((int) $b['email_bestaetigt'] !== 1 ? '<span class="status status--angelegt">' . e(t('benutzer.ausstehend')) . '</span>' : '<span class="status status--bezahlt">✓</span>') ?></td>
          <td class="k-aktionen">
            <?php if (!$selbst && $aenderbar) { ?>
              <?php if ((int) $b['email_bestaetigt'] !== 1 && (int) $b['aktiv'] === 1) { ?><form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/einladen')) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e(t('benutzer.erneut')) ?></button></form><?php } ?>
              <?php if ($inhaber) { ?><form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/rolle')) ?>" data-bestaetigen="<?= e($istInh ? t('benutzer.rolle.entziehen') : t('benutzer.rolle.ernennen')) ?>?"><?= csrfFeld() ?><input type="hidden" name="inhaber" value="<?= $istInh ? '0' : '1' ?>"><button class="btn btn--sm k-btn-leise" type="submit"><?= e($istInh ? t('benutzer.rolle.entziehen') : t('benutzer.rolle.ernennen')) ?></button></form><?php } ?>
              <form method="post" action="<?= e(url('benutzer/' . $b['id'] . '/' . ((int) $b['aktiv'] === 1 ? 'deaktivieren' : 'aktivieren'))) ?>"><?= csrfFeld() ?><button class="btn btn--sm k-btn-leise" type="submit"><?= e((int) $b['aktiv'] === 1 ? t('benutzer.deaktivieren') : t('benutzer.aktivieren')) ?></button></form>
            <?php } ?>
          </td>
        </tr>
      <?php } ?>
      </tbody>
    </table></div>
  </div>
  <?php if ($darf) { ?>
  <div class="card">
    <h2 class="h3"><?= e(t('benutzer.einladen')) ?></h2>
    <p class="k-klein" style="margin:.35rem 0 1rem"><?= e(t('benutzer.einladen.text')) ?></p>
    <form method="post" action="<?= e(url('benutzer/einladen')) ?>" class="form k-form" novalidate>
      <?= csrfFeld() ?>
      <div class="field"><label for="b-name"><?= e(t('registrieren.name')) ?></label><input id="b-name" name="name" type="text" minlength="2" required></div>
      <div class="field"><label for="b-email"><?= e(t('login.email')) ?></label><input id="b-email" name="email" type="email" required></div>
      <div class="field"><label for="b-gruppe"><?= e(t('benutzer.gruppe')) ?></label><select id="b-gruppe" name="gruppe_id"><option value="0"><?= e(t('benutzer.gruppe.keine')) ?></option><?php foreach ($gruppen as $g) { ?><option value="<?= (int) $g['id'] ?>"><?= e($g['name']) ?></option><?php } ?></select></div>
      <?php if ($unterkunden !== []) { ?><div class="field"><label for="b-unterkunde"><?= e(t('benutzer.unterkunde')) ?></label><select id="b-unterkunde" name="unterkunde_id"><option value="0"><?= e(t('unterkunde.hauptfirma')) ?></option><?php foreach ($unterkunden as $u) { ?><option value="<?= (int) $u['id'] ?>"><?= e($u['nummer']) ?> · <?= e($u['name']) ?></option><?php } ?></select></div><?php } ?>
      <button class="btn btn--primary" type="submit"><?= e(t('benutzer.einladen')) ?></button>
    </form>
  </div>
  <?php } ?>
</div>
