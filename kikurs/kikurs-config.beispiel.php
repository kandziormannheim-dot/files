<?php

/**
 * Konfiguration der KI-Werkstatt — gehört OBERHALB des Webroots
 * (neben kikurs-app/), nie nach public/. Der Workflow „KI-Werkstatt
 * einrichten“ schreibt sie selbst; diese Datei ist das Muster für Handbetrieb.
 */
return [
    'titel' => 'KI-Werkstatt',
    'adminEmail' => 'mail@example.org',
    // php -r 'echo password_hash("…", PASSWORD_DEFAULT), "\n";'
    'adminPasswortHash' => '',
    // Gemeinsamer Code für die Selbstregistrierung; '' = nur Einmalcodes.
    'einladungscode' => '',
    'daten' => '/pfad/zu/kikurs-daten',
    'salz' => 'zufaellig-und-lang',
];
