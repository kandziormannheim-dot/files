<?php

/**
 * Tests der KI-Werkstatt ohne Framework: Schnittstelle (Konten, Einladungen,
 * Lernstand, Admin) direkt über apiBearbeiten() und die Kursdaten in
 * public/inhalte.js auf Vollständigkeit. Aufruf: php kikurs/tests/lauf.php
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/api.php';

$ok = 0;
$fehl = 0;
function pruefe(bool $b, string $text): void
{
    global $ok, $fehl;
    $b ? $ok++ : $fehl++;
    echo ($b ? 'OK   ' : 'FEHL ') . $text . "\n";
}

$verz = sys_get_temp_dir() . '/kikurs-test-' . bin2hex(random_bytes(4));
mkdir($verz, 0700, true);
$konfig = array_replace_recursive(konfigLaden(), [
    'adminEmail' => 'leitung@example.org',
    'adminPasswortHash' => password_hash('leitung-geheim-1', PASSWORD_DEFAULT),
    'einladungscode' => 'KICKOFF26',
    'aussteller' => 'Martin Kandzior',
    'daten' => $verz,
    'salz' => 'test',
    'limit' => ['anfragen' => 5, 'fenster' => 3600],
    'sperreVersuche' => 3,
]);
$konfig['bereit'] = true;
$db = dbOeffnen($konfig);

/** Eine Anfrage wie der Browser: ich → csrf, dann Aktion. */
function anfrage(string $aktion, string $methode = 'GET', array $eingabe = [], ?array &$sitzung = null, string $ip = '10.0.0.1', ?string $csrf = null): array
{
    global $db, $konfig;
    $sitzung ??= [];
    if ($methode === 'POST' && $csrf === null) {
        apiBearbeiten($db, $konfig, 'ich', 'GET', [], $sitzung);
        $csrf = $sitzung['csrf'];
    }

    return apiBearbeiten($db, $konfig, $aktion, $methode, $eingabe, $sitzung, ['ip' => $ip, 'csrf' => (string) $csrf]);
}

// --- Grundlagen
[$s, $a] = anfrage('ich');
pruefe($s === 200 && $a['angemeldet'] === false && strlen($a['csrf']) === 32, 'ich: ohne Anmeldung, mit CSRF-Wert');
pruefe($a['aussteller'] === 'Martin Kandzior', 'ich: liefert den Aussteller aus der Konfiguration');
$leer = [];
[$s] = anfrage('stand', 'POST', ['stand' => []], $leer);
pruefe($s === 401, 'stand ohne Anmeldung: 401');
$x = [];
[$s] = anfrage('anmelden', 'POST', ['email' => 'leitung@example.org', 'passwort' => 'leitung-geheim-1'], $x, '10.0.0.1', 'falsch');
pruefe($s === 403, 'POST mit falschem CSRF-Wert: 403');
[$s] = anfrage('anmelden', 'GET', [], $x);
pruefe($s === 405, 'anmelden per GET: 405');

// --- Registrierung
$lerner = [];
[$s, $a] = anfrage('registrieren', 'POST', ['code' => 'FALSCH', 'name' => 'Anna', 'email' => 'anna@example.org', 'passwort' => 'sehr-geheim-1'], $lerner, '10.0.0.2');
pruefe($s === 400 && str_contains($a['fehler'], 'Einladungscode'), 'Registrierung mit falschem Code abgewiesen');
[$s, $a] = anfrage('registrieren', 'POST', ['code' => 'kickoff26', 'name' => 'Anna', 'email' => 'anna@example.org', 'passwort' => 'kurz'], $lerner, '10.0.0.2');
pruefe($s === 400 && str_contains($a['fehler'], '10 Zeichen'), 'zu kurzes Passwort abgewiesen');
[$s, $a] = anfrage('registrieren', 'POST', ['code' => 'kickoff26', 'name' => 'Anna', 'email' => 'anna@example.org', 'passwort' => 'sehr-geheim-1'], $lerner, '10.0.0.2');
pruefe($s === 200 && $a['benutzer']['rolle'] === 'lerner' && !empty($lerner['benutzer_id']), 'Registrierung mit gemeinsamem Code (Groß/klein egal) meldet an');
$zweit = [];
[$s, $a] = anfrage('registrieren', 'POST', ['code' => 'KICKOFF26', 'name' => 'Anna 2', 'email' => 'ANNA@example.org', 'passwort' => 'sehr-geheim-1'], $zweit, '10.0.0.3');
pruefe($s === 400 && str_contains($a['fehler'], 'schon ein Konto'), 'doppelte E-Mail (Groß/klein) abgewiesen');

// --- Lernstand
[$s] = anfrage('stand', 'POST', ['stand' => ['fertig' => ['m1l1' => true], 'quiz' => ['m1' => ['quote' => 1]]]], $lerner, '10.0.0.2');
pruefe($s === 200, 'Lernstand speichern');
[$s, $a] = anfrage('ich', 'GET', [], $lerner);
pruefe($a['angemeldet'] === true && $a['stand']['fertig']['m1l1'] === true, 'Lernstand kommt beim nächsten Laden zurück');
[$s] = anfrage('stand', 'POST', ['stand' => ['gross' => str_repeat('x', KIKURS_STAND_MAX)]], $lerner, '10.0.0.2');
pruefe($s === 413, 'zu großer Lernstand abgewiesen');
[$s] = anfrage('stand', 'POST', ['stand' => 'kein array'], $lerner, '10.0.0.2');
pruefe($s === 400, 'kaputter Lernstand abgewiesen');

// --- Rechte
[$s] = anfrage('admin_uebersicht', 'POST', [], $lerner, '10.0.0.2');
pruefe($s === 403, 'Lernende sehen keine Admin-Übersicht');

// --- Anmeldung und Sperre
$admin = [];
[$s, $a] = anfrage('anmelden', 'POST', ['email' => 'leitung@example.org', 'passwort' => 'leitung-geheim-1'], $admin, '10.0.0.4');
pruefe($s === 200 && $a['benutzer']['rolle'] === 'admin', 'Admin aus der Konfiguration kann sich anmelden');
[$s, $a] = anfrage('admin_uebersicht', 'POST', [], $admin, '10.0.0.4');
$anna = array_values(array_filter($a['teilnehmende'], fn ($t) => $t['email'] === 'anna@example.org'))[0] ?? null;
pruefe($s === 200 && $anna !== null && $anna['stand']['fertig']['m1l1'] === true, 'Admin sieht Teilnehmende samt Lernstand');
[$s, $a] = anfrage('admin_einladung', 'POST', ['bemerkung' => 'Team Blau'], $admin, '10.0.0.4');
$einmal = $a['code'] ?? '';
pruefe($s === 200 && preg_match('/^[A-Z2-9]{8}$/', $einmal) === 1, 'Einmalcode erzeugt');
$bert = [];
[$s] = anfrage('registrieren', 'POST', ['code' => $einmal, 'name' => 'Bert', 'email' => 'bert@example.org', 'passwort' => 'sehr-geheim-2'], $bert, '10.0.0.5');
pruefe($s === 200, 'Registrierung mit Einmalcode');
$carla = [];
[$s] = anfrage('registrieren', 'POST', ['code' => $einmal, 'name' => 'Carla', 'email' => 'carla@example.org', 'passwort' => 'sehr-geheim-3'], $carla, '10.0.0.6');
pruefe($s === 400, 'Einmalcode ist danach verbraucht');

$fremd = [];
for ($i = 0; $i < 3; $i++) {
    anfrage('anmelden', 'POST', ['email' => 'bert@example.org', 'passwort' => 'falsch-falsch'], $fremd, '10.0.1.' . $i);
}
[$s] = anfrage('anmelden', 'POST', ['email' => 'bert@example.org', 'passwort' => 'sehr-geheim-2'], $fremd, '10.0.2.1');
pruefe($s === 401, 'nach drei Fehlversuchen ist das Konto vorübergehend gesperrt');

$ipTest = [];
for ($i = 0; $i < 5; $i++) {
    anfrage('anmelden', 'POST', ['email' => 'niemand@example.org', 'passwort' => 'x'], $ipTest, '10.9.9.9');
}
[$s] = anfrage('anmelden', 'POST', ['email' => 'niemand@example.org', 'passwort' => 'x'], $ipTest, '10.9.9.9');
pruefe($s === 429, 'Missbrauchsbremse je IP greift');

// --- Admin-Aktionen
$bertId = (int) $db->query("SELECT id FROM benutzer WHERE email = 'bert@example.org'")->fetchColumn();
[$s, $a] = anfrage('admin_konto', 'POST', ['id' => $bertId, 'was' => 'passwort'], $admin, '10.0.0.4');
pruefe($s === 200 && strlen($a['passwort']) === 14, 'Admin setzt Passwort zurück (hebt Sperre auf)');
$neu = [];
[$s, $a] = anfrage('anmelden', 'POST', ['email' => 'bert@example.org', 'passwort' => $a['passwort']], $neu, '10.0.3.1');
pruefe($s === 200 && $a['benutzer']['wechselNoetig'] === true, 'Anmeldung mit neuem Passwort verlangt Wechsel');
[$s] = anfrage('passwort', 'POST', ['alt' => 'falsch', 'neu' => 'noch-geheimer-1'], $neu, '10.0.3.1');
pruefe($s === 400, 'Passwortwechsel mit falschem alten Passwort abgewiesen');
[$s] = anfrage('admin_konto', 'POST', ['id' => $bertId, 'was' => 'sperren'], $admin, '10.0.0.4');
[$s2, $a2] = anfrage('ich', 'GET', [], $neu);
pruefe($s === 200 && $a2['angemeldet'] === false, 'gesperrtes Konto fliegt sofort aus der Sitzung');
$adminId = (int) $db->query("SELECT id FROM benutzer WHERE email = 'leitung@example.org'")->fetchColumn();
[$s] = anfrage('admin_konto', 'POST', ['id' => $adminId, 'was' => 'loeschen'], $admin, '10.0.0.4');
pruefe($s === 400, 'eigenes Konto lässt sich nicht löschen');
[$s] = anfrage('admin_konto', 'POST', ['id' => $bertId, 'was' => 'loeschen'], $admin, '10.0.0.4');
pruefe($s === 200 && $db->query("SELECT COUNT(*) FROM benutzer WHERE id = $bertId")->fetchColumn() == 0, 'Konto löschen');
[$s] = anfrage('abmelden', 'POST', [], $lerner, '10.0.0.2');
[$s2, $a2] = anfrage('ich', 'GET', [], $lerner);
pruefe($s === 200 && $a2['angemeldet'] === false, 'Abmelden');

pruefe(herkunftErlaubt('https://ki-ckoff.kandzior.de', [], 'ki-ckoff.kandzior.de'), 'Herkunft: eigener Host erlaubt');
pruefe(!herkunftErlaubt('https://boese.example', [], 'ki-ckoff.kandzior.de'), 'Herkunft: fremder Host abgewiesen');

// --- Kursdaten: Struktur prüfen (inhalte.js ist JSON-nah genug für Node)
$node = trim((string) shell_exec('command -v node'));
if ($node !== '') {
    $skript = <<<'JS'
        global.window = {};
        require(process.argv[1] + '/public/einstieg.js');
        require(process.argv[1] + '/public/inhalte.js');
        require(process.argv[1] + '/public/grafiken.js');
        const K = window.KURS, G = window.GRAFIKEN, fs = require('fs'), fehler = [];
        const ids = new Set();
        const kurse = [window.EINSTIEG, window.KURS];
        if (!window.EINSTIEG) fehler.push('einstieg.js definiert window.EINSTIEG nicht');
        const html = fs.readFileSync(process.argv[1] + '/public/index.html', 'utf8');
        if (!html.includes('einstieg.js')) fehler.push('index.html bindet einstieg.js nicht ein');
        kurse.filter(Boolean).forEach((kurs) => {
        ['id', 'titel', 'kurzname', 'untertitel', 'lead', 'heldGrafik', 'einheit', 'wochen', 'planTitel', 'zertifikatText'].forEach((f) => kurs[f] == null && fehler.push(kurs.id + ': ' + f + ' fehlt'));
        if (!G[kurs.heldGrafik]) fehler.push(kurs.id + ': heldGrafik ' + kurs.heldGrafik + ' fehlt');
        kurs.module.forEach((m) => {
          if (ids.has(m.id)) fehler.push('doppelte Modul-ID ' + m.id); ids.add(m.id);
          if (!/^\d+(,\d+)? h$/.test(m.dauer)) fehler.push(m.id + ': dauer muss „x h“ bzw. „x,y h“ sein');
          ['id', 'titel', 'kurztitel', 'dauer', 'woche'].forEach((f) => m[f] == null && fehler.push(m.id + ': ' + f + ' fehlt'));
          m.lektionen.forEach((l) => { if (ids.has(l.id)) fehler.push('doppelte Lektion ' + l.id); ids.add(l.id);
            (l.html.match(/data-grafik="([a-zA-Z]+)"/g) || []).forEach((g) => { const n = g.slice(13, -1); if (!G[n]) fehler.push(l.id + ': Grafik ' + n + ' fehlt'); }); });
          m.quiz.forEach((q, i) => { if (!(q.richtig >= 0 && q.richtig < q.antworten.length)) fehler.push(m.id + ' Quiz ' + i + ': richtig außerhalb'); });
          if (!m.film) fehler.push(m.id + ': Erklärfilm fehlt');
          else { ['mp4', 'vtt', 'jpg'].forEach((e) => { if (!fs.existsSync(process.argv[1] + '/public/filme/' + m.id + '.' + e)) fehler.push(m.id + ': filme/' + m.id + '.' + e + ' fehlt (werkzeuge/filme-rendern.mjs)'); });
            if (!G[m.film.grafik]) fehler.push(m.id + ': Filmgrafik ' + m.film.grafik + ' fehlt');
            const svg = G[m.film.grafik]();
            m.film.szenen.forEach((s, i) => { if (s.schritt > 0 && !svg.includes('data-schritt="' + s.schritt + '"')) fehler.push(m.id + ' Szene ' + i + ': Schritt ' + s.schritt + ' nicht in Grafik'); }); }
        });
        });
        (K.vorlagen || []).forEach((v) => { if (!fs.existsSync(process.argv[1] + '/public/' + v.datei)) fehler.push('Vorlage fehlt: ' + v.datei); });
        console.log(JSON.stringify(fehler));
        JS;
    $aus = shell_exec(escapeshellarg($node) . ' -e ' . escapeshellarg($skript) . ' ' . escapeshellarg(dirname(__DIR__)) . ' 2>&1');
    $fehlerListe = json_decode((string) $aus, true);
    pruefe(is_array($fehlerListe) && $fehlerListe === [], 'Kursdaten vollständig' . (is_array($fehlerListe) && $fehlerListe ? ': ' . implode('; ', $fehlerListe) : ($fehlerListe === null ? ': ' . trim((string) $aus) : '')));
    foreach (glob(dirname(__DIR__) . '/public/vorlagen/*.json') ?: [] as $datei) {
        $w = json_decode((string) file_get_contents($datei), true);
        $namen = array_column($w['nodes'] ?? [], 'name');
        $verbindungenOk = true;
        foreach ($w['connections'] ?? [] as $von => $arten) {
            $verbindungenOk = $verbindungenOk && in_array($von, $namen, true);
            foreach ($arten as $ausgaenge) {
                foreach ($ausgaenge as $ziele) {
                    foreach ($ziele as $z) {
                        $verbindungenOk = $verbindungenOk && in_array($z['node'], $namen, true);
                    }
                }
            }
        }
        pruefe(is_array($w) && $namen !== [] && $verbindungenOk, 'n8n-Vorlage ' . basename($datei) . ': gültiges JSON, Verbindungen zeigen auf vorhandene Knoten');
    }
} else {
    echo "(node fehlt — Prüfung der Kursdaten übersprungen)\n";
}

echo "\n$ok bestanden, $fehl fehlgeschlagen\n";
exit($fehl === 0 ? 0 : 1);
