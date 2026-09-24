<?php

/**
 * Konfiguration von KI-ckoff — gehört OBERHALB des Webroots
 * (neben kikurs-app/), nie nach public/. Der Workflow „KI-ckoff
 * einrichten“ schreibt sie selbst; diese Datei ist das Muster für Handbetrieb.
 */
return [
    'titel' => 'KI-ckoff',
    'adminEmail' => 'mail@example.org',
    // php -r 'echo password_hash("…", PASSWORD_DEFAULT), "\n";'
    'adminPasswortHash' => '',
    // Gemeinsamer Code für die Selbstregistrierung; '' = nur Einmalcodes.
    'einladungscode' => '',
    // Name der ausstellenden Person auf den Teilnahmebestätigungen (PDF).
    'aussteller' => 'Martin Kandzior',
    'daten' => '/pfad/zu/kikurs-daten',
    'salz' => 'zufaellig-und-lang',
];
