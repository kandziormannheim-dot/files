<?php

/**
 * Ersten Admin anlegen (nur Kommandozeile):
 *
 *   php intern/einrichten.php admin@neos24.com "Vorname Nachname"
 *
 * Legt die Systemrolle „Admin“ an (falls nicht vorhanden) und den Benutzer
 * mit einem erzeugten Startpasswort, das einmal ausgegeben wird. Beim ersten
 * Anmelden muss ein eigenes Passwort gesetzt werden. Läuft mehrfach
 * unschädlich: eine vorhandene E-Mail wird gemeldet, nichts überschrieben.
 * Konfiguration wie überall: neos24-config.php oberhalb des Webroots oder
 * Umgebungsvariable NEOS_KONFIG.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/src/bootstrap.php';

$email = mb_strtolower(trim((string) ($argv[1] ?? '')));
$name = trim((string) ($argv[2] ?? 'Admin'));
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    fwrite(STDERR, "Aufruf: php intern/einrichten.php <E-Mail> [\"Name\"]\n");
    exit(1);
}

$db = datenbank();
$rolleId = adminRolleSicherstellen();
try {
    $neu = benutzerAnlegen($email, $name, $rolleId);
} catch (InvalidArgumentException $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
protokollieren('benutzer.angelegt', 'benutzer', $neu['id'], ['email' => $email, 'quelle' => 'einrichten.php']);

echo "Admin angelegt.\n";
echo '  E-Mail:         ' . $email . "\n";
echo '  Startpasswort:  ' . $neu['passwort'] . "\n";
echo "  Beim ersten Anmelden wird ein eigenes Passwort verlangt.\n";
echo '  Anmeldung:      ' . rtrim((string) konfig()['basisUrl'], '/') . "/intern/login\n";
