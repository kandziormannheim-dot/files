<?php

/**
 * Wiederkehrende Aufgaben (nur Kommandozeile, für Cron):
 *
 *   php intern/aufgaben.php lexware              Lexware-Warteschlange abarbeiten, Zahlungsstatus abgleichen
 *   php intern/aufgaben.php lexware einrichten <Basis-URL>   Webhook-Abonnements bei Lexware anlegen
 *   php intern/aufgaben.php erinnern             Erinnerung an offene Nachberechnungen (Revolut)
 *   php intern/aufgaben.php postfach             Carrier-Rechnungen aus dem IMAP-Postfach einlesen
 *   php intern/aufgaben.php alle                 alles nacheinander
 *
 * Beispiel-Cron (stündlich): 0 * * * * cd /pfad/httpdocs && php intern/aufgaben.php alle >> ../neos24-daten/aufgaben.log 2>&1
 * Konfiguration wie überall: neos24-config.php oberhalb des Webroots oder Umgebungsvariable NEOS_KONFIG.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/src/bootstrap.php';
require_once dirname(__DIR__) . '/lib/postfach.php';

$aufgabe = (string) ($argv[1] ?? '');
$ausgabe = static fn (string $zeile) => fwrite(STDOUT, gmdate('Y-m-d H:i:s') . ' ' . $zeile . "\n");

if (!in_array($aufgabe, ['lexware', 'erinnern', 'postfach', 'alle'], true)) {
    fwrite(STDERR, "Aufruf: php intern/aufgaben.php lexware|erinnern|postfach|alle\n");
    exit(1);
}
datenbank();

if ($aufgabe === 'lexware' && ($argv[2] ?? '') === 'einrichten') {
    $basis = rtrim((string) ($argv[3] ?? konfig()['basisUrl']), '/');
    if ($basis === '' || !lexwareAktiv()) {
        fwrite(STDERR, "Lexware ist nicht aktiv (lexware.aktiv, lexware.apiKey) oder keine Basis-URL angegeben.\n");
        exit(1);
    }
    try {
        $antwort = lexwareEinrichten($basis . '/api/lexware/webhook.php');
        $ausgabe('Webhook-Abonnements angelegt: ' . json_encode($antwort, JSON_UNESCAPED_SLASHES));
        $ausgabe('Hinweis: Lexware signiert Ereignisse nicht mit einem geteilten Geheimnis; der Empfänger lädt jeden Beleg nach.');
    } catch (Throwable $e) {
        fwrite(STDERR, 'Einrichtung fehlgeschlagen: ' . $e->getMessage() . "\n");
        exit(1);
    }
    exit;
}

if ($aufgabe === 'lexware' || $aufgabe === 'alle') {
    if (!lexwareAktiv()) {
        $ausgabe('lexware: nicht aktiv (lexware.aktiv / apiKey in der Konfiguration)');
    } else {
        $z = lexwareAuftraegeAbarbeiten(100);
        $ausgabe('lexware: Warteschlange ' . $z['erledigt'] . ' erledigt, ' . $z['fehler'] . ' Fehler');
        $ausgabe('lexware: Zahlungsstatus — ' . lexwareStatusAbgleichen() . ' Rechnung(en) geändert');
    }
}

if ($aufgabe === 'erinnern' || $aufgabe === 'alle') {
    $ausgabe('erinnern: ' . rpErinnerungenSenden() . ' Erinnerung(en) verschickt');
}

if ($aufgabe === 'postfach' || $aufgabe === 'alle') {
    $p = (array) (konfig()['postfach'] ?? []);
    if ((string) ($p['host'] ?? '') === '') {
        $ausgabe('postfach: nicht konfiguriert (postfach.host)');
    } else {
        try {
            $z = rpPostfachVerarbeiten();
            $ausgabe('postfach: ' . $z['mails'] . ' Mails, ' . $z['rechnungen'] . ' Rechnungen angelegt, ' . $z['geprueft'] . ' automatisch geprüft, ' . $z['uebersprungen'] . ' übersprungen');
            foreach ($z['protokoll'] as $zeile) {
                $ausgabe('  ' . $zeile);
            }
        } catch (Throwable $e) {
            fwrite(STDERR, 'postfach: ' . $e->getMessage() . "\n");
            exit(1);
        }
    }
}
