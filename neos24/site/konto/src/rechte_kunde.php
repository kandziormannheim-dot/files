<?php

/**
 * Rechte des angemeldeten Kunden je Bereich (versand, lager, retouren,
 * buchhaltung, verwaltung) — Definition und Gruppen in lib/kunden.php.
 * Inhaber, Benutzer ohne Gruppe und Privatkunden haben alle Rechte.
 */

declare(strict_types=1);

/** Rechte des angemeldeten Kontos, je Request gecacht. */
function kundenRechte(): array
{
    static $rechte = null;
    if ($rechte === null) {
        $k = kundeAktuell();
        $rechte = $k === null ? array_fill_keys(KUNDEN_BEREICHE, '') : kundenRechteVon($k);
    }

    return $rechte;
}

function darfKunde(string $bereich, string $stufe = 'sehen'): bool
{
    return rechtDeckt((string) (kundenRechte()[$bereich] ?? ''), $stufe);
}

/** Sendungsliste und -detail: sobald irgendein Bereich sehen darf. */
function sendungenSehenErlaubt(): bool
{
    foreach (kundenRechte() as $stufe) {
        if ($stufe !== '') {
            return true;
        }
    }

    return false;
}

function istInhaber(array $kunde): bool
{
    return ($kunde['art'] ?? '') === 'business' && ($kunde['firmenrolle'] ?? '') === 'inhaber';
}

/** 403 mit Bereich und Stufe im Text, wenn das Recht fehlt. */
function kundenRechtErzwingen(string $bereich, string $stufe = 'sehen'): void
{
    if (!darfKunde($bereich, $stufe)) {
        fehlerSeite(403, t('fehler.403'), t('gruppen.kein_recht', t('gruppen.bereich.' . $bereich), t('gruppen.stufe.' . $stufe)));
    }
}

/** Mindestens eines der Rechte (z. B. Labels: lager oder versand bearbeiten). */
function kundenRechtEinesErzwingen(array $paare): void
{
    foreach ($paare as [$bereich, $stufe]) {
        if (darfKunde($bereich, $stufe)) {
            return;
        }
    }
    [$bereich, $stufe] = $paare[0];
    fehlerSeite(403, t('fehler.403'), t('gruppen.kein_recht', t('gruppen.bereich.' . $bereich), t('gruppen.stufe.' . $stufe)));
}
