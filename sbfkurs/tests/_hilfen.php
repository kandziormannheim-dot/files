<?php

/**
 * Gemeinsame Handgriffe der Tests: Prüfzähler, Testdatenbank in einem
 * temporären Verzeichnis, Beispielkonfiguration. Kein Framework — jede
 * Testdatei ist ein PHP-Skript, tests/lauf.php führt sie nacheinander aus.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

$GLOBALS['__tests'] = ['ok' => 0, 'fehl' => 0];

/** Eine Behauptung prüfen und protokollieren. */
function pruefe(bool $bedingung, string $beschreibung): void
{
    $GLOBALS['__tests'][$bedingung ? 'ok' : 'fehl']++;
    echo ($bedingung ? 'OK   ' : 'FEHL ') . $beschreibung . "\n";
}

/** Zwei Werte auf Gleichheit prüfen; bei Fehlschlag beide zeigen. */
function pruefeGleich(mixed $erwartet, mixed $tatsaechlich, string $beschreibung): void
{
    $gleich = $erwartet === $tatsaechlich;
    pruefe($gleich, $beschreibung . ($gleich ? '' : ' — erwartet ' . var_export($erwartet, true) . ', bekommen ' . var_export($tatsaechlich, true)));
}

/** Testkonfiguration mit frischem Datenverzeichnis. */
function testKonfig(): array
{
    $verzeichnis = sys_get_temp_dir() . '/sbfkurs-test-' . bin2hex(random_bytes(4));
    mkdir($verzeichnis, 0700, true);
    register_shutdown_function(static function () use ($verzeichnis): void {
        foreach (glob("$verzeichnis/*") ?: [] as $datei) {
            if (is_dir($datei)) {
                foreach (glob("$datei/*") ?: [] as $d) {
                    @unlink($d);
                }
                @rmdir($datei);
            } else {
                @unlink($datei);
            }
        }
        @rmdir($verzeichnis);
    });

    $standard = konfigLaden();

    return array_replace($standard, [
        'adminEmail' => 'admin@test.invalid',
        'adminPasswortHash' => password_hash('AdminPasswort123', PASSWORD_DEFAULT),
        'einladungscode' => 'EINLADUNG',
        'daten' => $verzeichnis,
        'salz' => 'testsalz',
        'sperreVersuche' => 3,
        'sperreMinuten' => 15,
        'bereit' => true,
    ]);
}

/** Datenbank zur Testkonfiguration. */
function testDb(array $konfig): PDO
{
    return dbOeffnen($konfig);
}

/** Sitzung für Tests simulieren, ohne Cookies. */
function testSitzung(): void
{
    if (!isset($_SESSION)) {
        $_SESSION = [];
    }
}

/** Zusammenfassung ausgeben und Exit-Code liefern. */
function testErgebnis(): int
{
    $z = $GLOBALS['__tests'];
    echo "\n{$z['ok']} bestanden, {$z['fehl']} fehlgeschlagen.\n";

    return $z['fehl'] > 0 ? 1 : 0;
}
