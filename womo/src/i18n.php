<?php

/**
 * Zweisprachigkeit für alles, was Mieter sehen: Formulare, Mails, PDF.
 * Die Admin-Oberfläche bleibt deutsch. Die Sprache hängt an der Vermietung.
 */

declare(strict_types=1);

/** Wörterbuch beider Sprachen. */
function woerterbuch(): array
{
    return [
        'de' => [
            'titel.mieter' => 'Schadensdokumentation',
            'titel.qr' => 'Schaden melden',
            'begruessung' => 'Hallo %s,',
            'mieter.einleitung' => 'hier dokumentierst du Schäden am Fahrzeug — bei Übergabe, unterwegs und bei Rückgabe. Jeder Eintrag braucht mindestens ein Foto.',
            'mieter.zeitraum' => 'Mietzeitraum',
            'vorschaeden' => 'Bereits dokumentierte Vorschäden',
            'vorschaeden.hinweis' => 'Diese Schäden sind bereits erfasst — du haftest nicht für sie.',
            'vorschaeden.keine' => 'Keine offenen Vorschäden dokumentiert.',
            'eigene' => 'Deine Meldungen',
            'eigene.keine' => 'Du hast noch nichts gemeldet.',
            'neu.melden' => 'Neuen Schaden melden',
            'zone' => 'Wo am Fahrzeug?',
            'beschreibung' => 'Was ist passiert?',
            'beschreibung.platzhalter' => 'Kurz beschreiben: Was, wie groß, wie ist es passiert?',
            'fotos' => 'Fotos (Pflicht, bis zu %d)',
            'fotos.hinweis' => 'Am Handy öffnet sich direkt die Kamera.',
            'absenden' => 'Schaden melden',
            'gemeldet.danke' => 'Danke — der Schaden ist dokumentiert und der Vermieter wurde benachrichtigt.',
            'link.abgelaufen' => 'Dieser Link ist nicht mehr gültig. Bitte wende dich an den Vermieter.',
            'qr.einleitung' => 'Du hast den QR-Code im Fahrzeug gescannt. Beschreibe den Schaden — mit Foto — und hinterlasse deinen Namen, damit die Meldung zugeordnet werden kann.',
            'qr.name' => 'Dein Name',
            'qr.kontakt' => 'Telefon oder E-Mail (freiwillig)',
            'fehler.zone' => 'Bitte eine Stelle am Fahrzeug wählen.',
            'fehler.beschreibung' => 'Bitte den Schaden beschreiben (mindestens 5 Zeichen).',
            'fehler.foto' => 'Mindestens ein Foto ist Pflicht.',
            'fehler.foto_format' => 'Ein Foto konnte nicht gelesen werden (JPEG/PNG/WebP, höchstens %d MB).',
            'fehler.name' => 'Bitte deinen Namen angeben.',
            'fehler.zu_viele' => 'Zu viele Meldungen in kurzer Zeit — bitte später erneut versuchen.',
            'protokoll.uebergabe' => 'Übergabeprotokoll',
            'protokoll.rueckgabe' => 'Rückgabeprotokoll',
            'protokoll.fahrzeug' => 'Fahrzeug',
            'protokoll.kennzeichen' => 'Kennzeichen',
            'protokoll.mieter' => 'Mieter',
            'protokoll.zeitraum' => 'Mietzeitraum',
            'protokoll.datum' => 'Erstellt am',
            'protokoll.km' => 'Kilometerstand',
            'protokoll.bemerkung' => 'Bemerkung',
            'protokoll.vorschaeden' => 'Vorschäden (bereits vor diesem Protokoll dokumentiert)',
            'protokoll.neue' => 'In diesem Protokoll festgehaltene Schäden',
            'protokoll.keine_neuen' => 'Keine neuen Schäden festgehalten.',
            'protokoll.unterschrift_mieter' => 'Unterschrift Mieter',
            'protokoll.unterschrift_vermieter' => 'Unterschrift Vermieter',
            'protokoll.abgeschlossen' => 'Abgeschlossen am',
            'protokoll.foto' => 'Foto',
            'mail.protokoll.betreff' => '%s vom %s — %s',
            'mail.protokoll.text' => "im Anhang findest du das %s für das Fahrzeug „%s“ als PDF.\n\nMietzeitraum: %s bis %s\n\nBitte bewahre das Dokument auf.",
            'mail.gruss' => "Viele Grüße\n%s",
            'mail.schaden.betreff' => 'Neue Schadensmeldung — %s',
            'mail.schaden.text' => "es gibt eine neue Schadensmeldung.\n\nFahrzeug: %s\nGemeldet von: %s\nStelle: %s\nBeschreibung:\n%s",
        ],
        'en' => [
            'titel.mieter' => 'Damage documentation',
            'titel.qr' => 'Report damage',
            'begruessung' => 'Hello %s,',
            'mieter.einleitung' => 'this is where you document damage to the vehicle — at handover, during your trip and at return. Every entry needs at least one photo.',
            'mieter.zeitraum' => 'Rental period',
            'vorschaeden' => 'Pre-existing damage on record',
            'vorschaeden.hinweis' => 'These damages are already on record — you are not liable for them.',
            'vorschaeden.keine' => 'No open pre-existing damage on record.',
            'eigene' => 'Your reports',
            'eigene.keine' => 'You have not reported anything yet.',
            'neu.melden' => 'Report new damage',
            'zone' => 'Where on the vehicle?',
            'beschreibung' => 'What happened?',
            'beschreibung.platzhalter' => 'Briefly describe: what, how big, how did it happen?',
            'fotos' => 'Photos (required, up to %d)',
            'fotos.hinweis' => 'On a phone this opens the camera directly.',
            'absenden' => 'Report damage',
            'gemeldet.danke' => 'Thank you — the damage is documented and the owner has been notified.',
            'link.abgelaufen' => 'This link is no longer valid. Please contact the owner.',
            'qr.einleitung' => 'You scanned the QR code in the vehicle. Describe the damage — with a photo — and leave your name so the report can be matched.',
            'qr.name' => 'Your name',
            'qr.kontakt' => 'Phone or e-mail (optional)',
            'fehler.zone' => 'Please pick a spot on the vehicle.',
            'fehler.beschreibung' => 'Please describe the damage (at least 5 characters).',
            'fehler.foto' => 'At least one photo is required.',
            'fehler.foto_format' => 'A photo could not be read (JPEG/PNG/WebP, at most %d MB).',
            'fehler.name' => 'Please state your name.',
            'fehler.zu_viele' => 'Too many reports in a short time — please try again later.',
            'protokoll.uebergabe' => 'Handover protocol',
            'protokoll.rueckgabe' => 'Return protocol',
            'protokoll.fahrzeug' => 'Vehicle',
            'protokoll.kennzeichen' => 'Registration',
            'protokoll.mieter' => 'Renter',
            'protokoll.zeitraum' => 'Rental period',
            'protokoll.datum' => 'Created on',
            'protokoll.km' => 'Mileage',
            'protokoll.bemerkung' => 'Remarks',
            'protokoll.vorschaeden' => 'Pre-existing damage (documented before this protocol)',
            'protokoll.neue' => 'Damage recorded in this protocol',
            'protokoll.keine_neuen' => 'No new damage recorded.',
            'protokoll.unterschrift_mieter' => 'Signature renter',
            'protokoll.unterschrift_vermieter' => 'Signature owner',
            'protokoll.abgeschlossen' => 'Completed on',
            'protokoll.foto' => 'Photo',
            'mail.protokoll.betreff' => '%s of %s — %s',
            'mail.protokoll.text' => "attached you will find the %s for the vehicle “%s” as a PDF.\n\nRental period: %s to %s\n\nPlease keep this document.",
            'mail.gruss' => "Best regards\n%s",
            'mail.schaden.betreff' => 'New damage report — %s',
            'mail.schaden.text' => "there is a new damage report.\n\nVehicle: %s\nReported by: %s\nLocation: %s\nDescription:\n%s",
        ],
    ];
}

/** Übersetzen; %s/%d-Platzhalter werden mit den weiteren Argumenten gefüllt. */
function t(string $sprache, string $schluessel, mixed ...$argumente): string
{
    $sprache = $sprache === 'en' ? 'en' : 'de';
    $text = woerterbuch()[$sprache][$schluessel] ?? $schluessel;

    return $argumente === [] ? $text : vsprintf($text, $argumente);
}
