<?php

/**
 * Synchronisation der Stammdaten mit Lexware Office und Odoo.
 *
 * Hinrichtung (Plattform → Systeme) über die Warteschlange sync_auftraege:
 * jede Änderung an Firma, Unterkunde, Kunde (syncMarkieren) sowie beauftragte
 * Sendungen und Rechnungen (nur Odoo) erzeugen je aktivem System einen
 * Auftrag, der sofort (best effort) und per Cron abgearbeitet wird —
 * php intern/aufgaben.php sync. Ein Ausfall blockiert nichts, nichts wird
 * doppelt angelegt (Kennungen odoo_id / lexware_kontakt_id am Datensatz).
 *
 * Rückrichtung (Systeme → Plattform) per syncAbholen(): geänderte Partner in
 * Odoo (write_date) und Kontakte in Lexware (updatedDate/version) werden
 * gelesen. Regel: die jüngere Änderung gewinnt. Änderten beide Seiten seit
 * dem letzten Abgleich, gewinnt die jüngere und der Konflikt wird je Feld in
 * sync_konflikte protokolliert (Dashboard → Sync). Neue Partner, die nur in
 * Odoo angelegt wurden, werden nicht importiert — Kunden entstehen in der
 * Plattform (Portal, Dashboard), damit sie Nummer und Zugang bekommen.
 */

declare(strict_types=1);

const SYNC_FELDER = ['firmen' => ['name', 'strasse', 'plz', 'ort', 'land', 'ust_id', 'rechnungs_email'], 'unterkunden' => ['name', 'strasse', 'plz', 'ort', 'land', 'ust_id', 'rechnungs_email'], 'kunden' => ['name', 'email']];

/** Aktive Zielsysteme. */
function syncSysteme(): array
{
    $aus = [];
    if (lexwareAktiv()) {
        $aus[] = 'lexware';
    }
    if (odooAktiv()) {
        $aus[] = 'odoo';
    }

    return $aus;
}

function syncZeileLaden(string $tabelle, int $id): ?array
{
    return match ($tabelle) {
        'firmen' => firmaLaden($id),
        'unterkunden' => unterkundeLaden($id),
        'kunden' => kundeLaden($id),
        'bestellungen' => bestellungLaden('id', (string) $id),
        'rechnungen' => rechnungLaden($id),
        default => null,
    };
}

/** Gehört ein Auftrag (System, Art, Tabelle) überhaupt angelegt? */
function syncZustaendig(string $system, string $art, string $tabelle, ?array $zeile): bool
{
    if ($zeile === null) {
        return false;
    }
    if ($art === 'kontakt') {
        if (!in_array($tabelle, ['firmen', 'unterkunden', 'kunden'], true)) {
            return false;
        }
        if ($tabelle === 'kunden' && $system === 'lexware') {
            return $zeile['art'] === 'privat' && !empty(lexwareKonfig()['privatkunden']); // Firmenbenutzer stehen als Ansprechpartner am Firmenkontakt
        }

        return true;
    }
    if ($system !== 'odoo') {
        return false;
    }
    if ($art === 'auftrag') {
        return $tabelle === 'bestellungen' && !empty(odooKonfig()['auftraege']) && in_array($zeile['status'], ['beauftragt', 'bezahlt', 'storniert'], true);
    }
    if ($art === 'rechnung') {
        return $tabelle === 'rechnungen' && !empty(odooKonfig()['rechnungsInfo']);
    }

    return false;
}

/**
 * Änderung vormerken: je aktivem System ein Auftrag (idempotent, solange ein
 * offener Auftrag gleichen Bezugs existiert), danach sofortige Abarbeitung
 * (best effort, nie innerhalb einer offenen Transaktion).
 * $arten: kontakt | auftrag | rechnung. $ausser: System, das nicht beliefert
 * wird (Rückrichtung: die Quelle der Änderung).
 */
function syncMarkieren(string $tabelle, int $id, array $arten = ['kontakt'], string $ausser = ''): void
{
    $systeme = array_values(array_diff(syncSysteme(), [$ausser]));
    if ($systeme === [] || $id <= 0) {
        return;
    }
    $db = datenbank();
    $zeile = syncZeileLaden($tabelle, $id);
    if ($zeile === null) {
        return;
    }
    $neu = false;
    foreach ($systeme as $system) {
        foreach ($arten as $art) {
            if (!syncZustaendig($system, $art, $tabelle, $zeile)) {
                // Firmenbenutzer: Lexware führt ihn als Ansprechpartner am Kontakt der Firma / des Unterkunden
                if ($system === 'lexware' && $art === 'kontakt' && $tabelle === 'kunden' && $zeile['art'] === 'business' && (int) ($zeile['firma_id'] ?? 0) > 0) {
                    $elternTabelle = (int) ($zeile['unterkunde_id'] ?? 0) > 0 ? 'unterkunden' : 'firmen';
                    $elternId = $elternTabelle === 'unterkunden' ? (int) $zeile['unterkunde_id'] : (int) $zeile['firma_id'];
                    $neu = syncAuftragAnlegen($db, 'lexware', 'kontakt', $elternTabelle, $elternId) || $neu;
                }
                continue;
            }
            $neu = syncAuftragAnlegen($db, $system, $art, $tabelle, $id) || $neu;
        }
    }
    if ($neu && !$db->inTransaction()) {
        try {
            syncAuftraegeAbarbeiten(5);
        } catch (Throwable $e) {
            error_log('[sync] Sofortabgleich: ' . $e->getMessage());
        }
    }
}

/** Auftrag anlegen, wenn kein offener/fehlgeschlagener gleichen Bezugs existiert; liefert true bei neuem Auftrag. */
function syncAuftragAnlegen(PDO $db, string $system, string $art, string $tabelle, int $id): bool
{
    $st = $db->prepare("SELECT id, status FROM sync_auftraege WHERE system = ? AND art = ? AND bezug_tabelle = ? AND bezug_id = ? AND status IN ('offen','fehler') ORDER BY id DESC LIMIT 1");
    $st->execute([$system, $art, $tabelle, $id]);
    $vorhanden = $st->fetch();
    if (is_array($vorhanden)) {
        if ($vorhanden['status'] === 'fehler') {
            $db->prepare("UPDATE sync_auftraege SET status = 'offen', versuche = 0 WHERE id = ?")->execute([$vorhanden['id']]);

            return true;
        }

        return false;
    }
    $db->prepare('INSERT INTO sync_auftraege (system, art, bezug_tabelle, bezug_id, status, erstellt) VALUES (?, ?, ?, ?, ?, ?)')->execute([$system, $art, $tabelle, $id, 'offen', jetzt()]);

    return true;
}

/** Warteschlange abarbeiten; liefert ['erledigt' => n, 'fehler' => n]. */
function syncAuftraegeAbarbeiten(int $max = 20): array
{
    $aus = ['erledigt' => 0, 'fehler' => 0];
    $systeme = syncSysteme();
    if ($systeme === []) {
        return $aus;
    }
    $db = datenbank();
    $platzhalter = implode(',', array_fill(0, count($systeme), '?'));
    $st = $db->prepare("SELECT * FROM sync_auftraege WHERE status IN ('offen','fehler') AND versuche < 6 AND system IN ($platzhalter) ORDER BY id LIMIT " . max(1, $max));
    $st->execute($systeme);
    $ausgefallen = [];
    foreach ($st->fetchAll() as $auftrag) {
        if (isset($ausgefallen[$auftrag['system']])) {
            continue; // System ist in diesem Lauf nicht erreichbar — nicht jeden Auftrag einzeln scheitern lassen
        }
        try {
            syncAuftragAusfuehren($auftrag);
            $db->prepare("UPDATE sync_auftraege SET status = 'erledigt', versuche = versuche + 1, fehler_text = '', erledigt = ? WHERE id = ?")->execute([jetzt(), $auftrag['id']]);
            $aus['erledigt']++;
        } catch (Throwable $e) {
            $db->prepare("UPDATE sync_auftraege SET status = 'fehler', versuche = versuche + 1, fehler_text = ? WHERE id = ?")->execute([mb_substr($e->getMessage(), 0, 500), $auftrag['id']]);
            $aus['fehler']++;
            if (str_contains($e->getMessage(), 'nicht erreichbar') || str_contains($e->getMessage(), 'keine Antwort')) {
                $ausgefallen[$auftrag['system']] = true;
            }
            error_log('[sync] ' . $auftrag['system'] . '/' . $auftrag['art'] . ' ' . $auftrag['bezug_tabelle'] . '#' . $auftrag['bezug_id'] . ': ' . $e->getMessage());
        }
    }

    return $aus;
}

function syncAuftragAusfuehren(array $a): void
{
    $zeile = syncZeileLaden((string) $a['bezug_tabelle'], (int) $a['bezug_id']);
    if ($zeile === null) {
        return; // gelöscht — nichts zu tun
    }
    $system = (string) $a['system'];
    $tabelle = (string) $a['bezug_tabelle'];
    if ($a['art'] === 'kontakt') {
        syncPartnerSichern($system, $tabelle, $zeile);

        return;
    }
    if ($system !== 'odoo') {
        return;
    }
    $db = datenbank();
    if ($a['art'] === 'auftrag') {
        $o = odooAuftragSichern($zeile);
        $db->prepare('UPDATE bestellungen SET odoo_id = ?, odoo_nummer = ? WHERE id = ?')->execute([(int) $o['id'], (string) $o['nummer'], $zeile['id']]);
    } elseif ($a['art'] === 'rechnung') {
        $nachricht = odooRechnungsInfo($zeile);
        $db->prepare('UPDATE rechnungen SET odoo_info = ? WHERE id = ?')->execute([$zeile['status'] . ' · Nachricht ' . $nachricht . ' · ' . jetzt(), $zeile['id']]);
    }
}

/**
 * Partner/Kontakt in einem System anlegen oder aktualisieren und die
 * Kennung samt Stand (sync_json) am Datensatz speichern; liefert die
 * Kennung (Odoo: int, Lexware: Kontakt-ID als string → hier int 0 für Odoo-Aufrufer irrelevant).
 */
function syncPartnerSichern(string $system, string $tabelle, array $zeile): int
{
    $db = datenbank();
    $stand = json_decode((string) ($zeile['sync_json'] ?? '{}'), true) ?: [];
    if ($system === 'odoo') {
        $id = odooPartnerSichern($tabelle, $zeile);
        $p = odooLesen('res.partner', $id, ['write_date']);
        $stand['odoo'] = ['zeit' => jetzt(), 'entfernt' => odooZeit((string) ($p['write_date'] ?? '')), 'lokal' => (string) $zeile['aktualisiert']];
        $db->prepare("UPDATE $tabelle SET odoo_id = ?, synchronisiert = ?, sync_json = ? WHERE id = ?")->execute([$id, jetzt(), json_encode($stand, JSON_UNESCAPED_UNICODE), $zeile['id']]);

        return $id;
    }
    $kontakt = lexwareKontaktSichern($zeile, $tabelle);
    $stand['lexware'] = ['zeit' => jetzt(), 'entfernt' => (string) ($kontakt['updatedDate'] ?? ''), 'version' => (int) ($kontakt['version'] ?? 0), 'lokal' => (string) $zeile['aktualisiert']];
    $db->prepare("UPDATE $tabelle SET synchronisiert = ?, sync_json = ? WHERE id = ?")->execute([jetzt(), json_encode($stand, JSON_UNESCAPED_UNICODE), $zeile['id']]);

    return 0;
}

// -------------------------------------------------------------- Rückrichtung

/**
 * Entfernte Werte auf einen lokalen Datensatz anwenden — Regel „jüngere
 * Änderung gewinnt“, Konflikte je Feld protokollieren. Liefert die Zahl der
 * übernommenen Felder. $entfernt: lokale Feldnamen => Wert; $entferntZeit: ISO.
 */
function syncAbgleichen(string $system, string $tabelle, array $zeile, array $entfernt, string $entferntZeit): int
{
    $db = datenbank();
    $stand = json_decode((string) ($zeile['sync_json'] ?? '{}'), true) ?: [];
    $letzter = (string) ($stand[$system]['zeit'] ?? '');
    $lokalZeit = (string) $zeile['aktualisiert'];
    $unterschiede = [];
    foreach (SYNC_FELDER[$tabelle] ?? [] as $feld) {
        if (!array_key_exists($feld, $entfernt)) {
            continue;
        }
        $lokal = trim((string) ($zeile[$feld] ?? ''));
        $fern = trim((string) $entfernt[$feld]);
        if ($feld === 'land') {
            $lokal = strtoupper($lokal);
            $fern = strtoupper($fern);
        }
        if ($lokal !== $fern && !($fern === '' && $feld === 'land')) {
            $unterschiede[$feld] = [$lokal, $fern];
        }
    }
    $stand[$system] = ['zeit' => jetzt(), 'entfernt' => $entferntZeit, 'lokal' => $lokalZeit] + (array) ($stand[$system] ?? []);
    if ($unterschiede === []) {
        $db->prepare("UPDATE $tabelle SET synchronisiert = ?, sync_json = ? WHERE id = ?")->execute([jetzt(), json_encode($stand, JSON_UNESCAPED_UNICODE), $zeile['id']]);

        return 0;
    }
    $fernNeuer = $entferntZeit !== '' && $entferntZeit > $lokalZeit;
    $beide = $letzter !== '' && $lokalZeit > $letzter && $entferntZeit > $letzter;
    foreach ($unterschiede as $feld => [$lokal, $fern]) {
        if ($beide) {
            $db->prepare('INSERT INTO sync_konflikte (system, bezug_tabelle, bezug_id, feld, lokal, entfernt, gewonnen, zeit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
               ->execute([$system, $tabelle, $zeile['id'], $feld, $lokal, $fern, $fernNeuer ? $system : 'plattform', jetzt()]);
        }
    }
    if (!$fernNeuer) {
        // Plattform ist jünger: eigenen Stand erneut hinschieben
        $db->prepare("UPDATE $tabelle SET sync_json = ? WHERE id = ?")->execute([json_encode($stand, JSON_UNESCAPED_UNICODE), $zeile['id']]);
        syncAuftragAnlegen($db, $system, 'kontakt', $tabelle, (int) $zeile['id']);

        return 0;
    }
    $setzen = [];
    $werte = [];
    foreach ($unterschiede as $feld => [, $fern]) {
        if ($tabelle === 'kunden' && $feld === 'email') {
            if (filter_var($fern, FILTER_VALIDATE_EMAIL) === false || kundeNachEmail($fern) !== null) {
                continue; // E-Mail ist Anmeldename — nur übernehmen, wenn gültig und frei
            }
            $fern = mb_strtolower($fern);
        }
        $setzen[] = "$feld = ?";
        $werte[] = $fern;
    }
    if ($setzen === []) {
        return 0;
    }
    $jetzt = jetzt();
    $stand[$system]['lokal'] = $jetzt;
    $setzen[] = 'aktualisiert = ?';
    $werte[] = $jetzt;
    $setzen[] = 'synchronisiert = ?';
    $werte[] = $jetzt;
    $setzen[] = 'sync_json = ?';
    $werte[] = json_encode($stand, JSON_UNESCAPED_UNICODE);
    $werte[] = $zeile['id'];
    $db->prepare("UPDATE $tabelle SET " . implode(', ', $setzen) . ' WHERE id = ?')->execute($werte);
    if ($tabelle === 'kunden' && isset($unterschiede['name']) && $zeile['art'] === 'privat') {
        $abs = json_decode((string) $zeile['absender_json'], true) ?: [];
        if (isset($abs['name'])) {
            $abs['name'] = $entfernt['name'];
            $db->prepare('UPDATE kunden SET absender_json = ? WHERE id = ?')->execute([json_encode($abs, JSON_UNESCAPED_UNICODE), $zeile['id']]);
        }
    }
    protokollierenSync($system, $tabelle, (int) $zeile['id'], array_keys($unterschiede));
    // Das jeweils andere System bekommt den neuen Stand
    syncMarkieren($tabelle, (int) $zeile['id'], ['kontakt'], $system);

    return count($setzen) - 3;
}

/** Ereignis für das Protokoll (Dashboard) — ohne Abhängigkeit vom Dashboard-Bootstrap. */
function protokollierenSync(string $system, string $tabelle, int $id, array $felder): void
{
    if (function_exists('protokollieren')) {
        try {
            protokollieren('sync.uebernommen', $tabelle, $id, ['system' => $system, 'felder' => $felder]);
        } catch (Throwable) {
        }
    }
}

/** Geänderte Odoo-Partner abholen; liefert die Zahl geprüfter Datensätze. */
function syncAbholenOdoo(?string $seit): int
{
    $n = 0;
    $db = datenbank();
    foreach (['firmen', 'unterkunden', 'kunden'] as $tabelle) {
        $ids = array_map('intval', array_column($db->query("SELECT odoo_id FROM $tabelle WHERE odoo_id > 0")->fetchAll(), 'odoo_id'));
        foreach (array_chunk($ids, 80) as $teil) {
            $domain = [['id', 'in', $teil], ['active', 'in', [true, false]]];
            if ($seit !== null) {
                $domain[] = ['write_date', '>', gmdate('Y-m-d H:i:s', strtotime($seit) - 5)];
            }
            foreach (odooSuchen('res.partner', $domain, ODOO_PARTNER_FELDER, 80) as $p) {
                $st = $db->prepare("SELECT * FROM $tabelle WHERE odoo_id = ?");
                $st->execute([(int) $p['id']]);
                $zeile = $st->fetch();
                if (!is_array($zeile)) {
                    continue;
                }
                $stand = json_decode((string) $zeile['sync_json'], true) ?: [];
                $fernZeit = odooZeit((string) ($p['write_date'] ?? ''));
                if ($fernZeit !== '' && $fernZeit === (string) ($stand['odoo']['entfernt'] ?? '')) {
                    continue; // unverändert seit dem letzten Abgleich (unser eigenes Schreiben)
                }
                syncAbgleichen('odoo', $tabelle, $zeile, odooPartnerNachLokal($tabelle, $p), $fernZeit);
                $n++;
            }
        }
    }

    return $n;
}

/** Einen Lexware-Kontakt in lokale Felder übersetzen. */
function lexwareKontaktNachLokal(string $tabelle, array $k): array
{
    $adresse = (array) ($k['addresses']['billing'][0] ?? []);
    $aus = ['strasse' => (string) ($adresse['street'] ?? ''), 'plz' => (string) ($adresse['zip'] ?? ''), 'ort' => (string) ($adresse['city'] ?? ''), 'land' => strtoupper((string) ($adresse['countryCode'] ?? ''))];
    if ($tabelle === 'kunden') {
        $p = (array) ($k['person'] ?? []);

        return $aus + ['name' => trim((string) ($p['firstName'] ?? '') . ' ' . (string) ($p['lastName'] ?? '')), 'email' => (string) ($k['emailAddresses']['private'][0] ?? $k['emailAddresses']['business'][0] ?? '')];
    }

    return $aus + ['name' => (string) ($k['company']['name'] ?? ''), 'ust_id' => (string) ($k['company']['vatRegistrationId'] ?? ''), 'rechnungs_email' => (string) ($k['emailAddresses']['business'][0] ?? '')];
}

/** Lexware-Kontakte seitenweise abholen und abgleichen; liefert die Zahl geprüfter Datensätze. */
function syncAbholenLexware(): int
{
    $n = 0;
    $db = datenbank();
    $lokal = [];
    foreach (['firmen', 'unterkunden', 'kunden'] as $tabelle) {
        foreach ($db->query("SELECT id, lexware_kontakt_id FROM $tabelle WHERE lexware_kontakt_id <> ''")->fetchAll() as $z) {
            $lokal[(string) $z['lexware_kontakt_id']] = [$tabelle, (int) $z['id']];
        }
    }
    if ($lokal === []) {
        return 0;
    }
    for ($seite = 0; $seite < 50; $seite++) {
        $antwort = lexwareAnfrage('GET', '/contacts?customer=true&page=' . $seite . '&size=100')['daten'];
        foreach ((array) ($antwort['content'] ?? []) as $k) {
            $kid = (string) ($k['id'] ?? '');
            if (!isset($lokal[$kid])) {
                continue;
            }
            [$tabelle, $id] = $lokal[$kid];
            $zeile = syncZeileLaden($tabelle, $id);
            if ($zeile === null) {
                continue;
            }
            $stand = json_decode((string) $zeile['sync_json'], true) ?: [];
            $version = (int) ($k['version'] ?? 0);
            if ($version === (int) ($stand['lexware']['version'] ?? -1)) {
                continue; // unverändert
            }
            $fernZeit = (string) ($k['updatedDate'] ?? '');
            $fernZeit = $fernZeit !== '' ? gmdate('Y-m-d\TH:i:s\Z', strtotime($fernZeit) ?: time()) : jetzt();
            $stand['lexware']['version'] = $version;
            $db->prepare("UPDATE $tabelle SET sync_json = ? WHERE id = ?")->execute([json_encode($stand, JSON_UNESCAPED_UNICODE), $id]);
            $zeile['sync_json'] = json_encode($stand);
            syncAbgleichen('lexware', $tabelle, $zeile, lexwareKontaktNachLokal($tabelle, $k), $fernZeit);
            $n++;
        }
        if (!empty($antwort['last']) || (array) ($antwort['content'] ?? []) === []) {
            break;
        }
    }

    return $n;
}

/** Einzelnen Datensatz nach einem Webhook abholen (Lexware: Kontakt-ID, Odoo: Partner-ID). */
function syncAbholenEinzeln(string $system, string $kennung): bool
{
    $db = datenbank();
    foreach (['firmen', 'unterkunden', 'kunden'] as $tabelle) {
        $st = $db->prepare("SELECT * FROM $tabelle WHERE " . ($system === 'odoo' ? 'odoo_id = ?' : 'lexware_kontakt_id = ?'));
        $st->execute([$system === 'odoo' ? (int) $kennung : $kennung]);
        $zeile = $st->fetch();
        if (!is_array($zeile)) {
            continue;
        }
        if ($system === 'odoo') {
            $p = odooLesen('res.partner', (int) $kennung, ODOO_PARTNER_FELDER);
            if ($p === null) {
                return false;
            }
            syncAbgleichen('odoo', $tabelle, $zeile, odooPartnerNachLokal($tabelle, $p), odooZeit((string) ($p['write_date'] ?? '')));
        } else {
            $k = lexwareAnfrage('GET', '/contacts/' . rawurlencode($kennung))['daten'];
            $stand = json_decode((string) $zeile['sync_json'], true) ?: [];
            $stand['lexware']['version'] = (int) ($k['version'] ?? 0);
            $db->prepare("UPDATE $tabelle SET sync_json = ? WHERE id = ?")->execute([json_encode($stand, JSON_UNESCAPED_UNICODE), $zeile['id']]);
            $zeile['sync_json'] = json_encode($stand);
            $fernZeit = (string) ($k['updatedDate'] ?? '');
            syncAbgleichen('lexware', $tabelle, $zeile, lexwareKontaktNachLokal($tabelle, $k), $fernZeit !== '' ? gmdate('Y-m-d\TH:i:s\Z', strtotime($fernZeit) ?: time()) : jetzt());
        }

        return true;
    }

    return false;
}

/**
 * Rückrichtung für alle aktiven Systeme; höchstens alle sync.abholenMinuten
 * (außer $erzwingen). Liefert ['odoo' => n, 'lexware' => n, 'uebersprungen' => bool].
 */
function syncAbholen(bool $erzwingen = false): array
{
    $aus = ['odoo' => 0, 'lexware' => 0, 'uebersprungen' => false];
    $db = datenbank();
    $st = $db->prepare("SELECT wert FROM zaehler WHERE name = 'sync_abholen'");
    $st->execute();
    $letzter = (int) $st->fetchColumn();
    $minuten = (int) (konfig()['sync']['abholenMinuten'] ?? 30);
    if (!$erzwingen && $letzter > 0 && time() - $letzter < $minuten * 60) {
        $aus['uebersprungen'] = true;

        return $aus;
    }
    $seit = $letzter > 0 ? gmdate('Y-m-d\TH:i:s\Z', $letzter) : null;
    $db->prepare("INSERT INTO zaehler (name, wert) VALUES ('sync_abholen', ?) ON CONFLICT(name) DO UPDATE SET wert = excluded.wert")->execute([time()]);
    foreach (syncSysteme() as $system) {
        try {
            $aus[$system] = $system === 'odoo' ? syncAbholenOdoo($seit) : syncAbholenLexware();
        } catch (Throwable $e) {
            error_log('[sync] Abholen ' . $system . ': ' . $e->getMessage());
            $aus[$system . '_fehler'] = $e->getMessage();
        }
    }

    return $aus;
}

// ------------------------------------------------------------------ Dashboard

/** Kennzahlen: offene/fehlgeschlagene Aufträge, offene Konflikte, letzte Abholung. */
function syncStatus(): array
{
    $db = datenbank();
    $z = $db->query("SELECT SUM(CASE WHEN status = 'fehler' THEN 1 ELSE 0 END) AS fehler, SUM(CASE WHEN status = 'offen' THEN 1 ELSE 0 END) AS offen FROM sync_auftraege")->fetch() ?: [];
    $st = $db->prepare("SELECT wert FROM zaehler WHERE name = 'sync_abholen'");
    $st->execute();
    $letzter = (int) $st->fetchColumn();

    return ['fehler' => (int) ($z['fehler'] ?? 0), 'offen' => (int) ($z['offen'] ?? 0), 'konflikte' => (int) $db->query('SELECT COUNT(*) FROM sync_konflikte WHERE erledigt = 0')->fetchColumn(),
        'abgeholt' => $letzter > 0 ? gmdate('Y-m-d\TH:i:s\Z', $letzter) : null, 'systeme' => syncSysteme()];
}

/** Alle Kundenstammdaten neu vormerken (z. B. nach Einrichtung eines Systems). Liefert die Zahl der Aufträge. */
function syncAlleVormerken(): int
{
    $db = datenbank();
    $n = 0;
    foreach (['firmen' => 'SELECT id FROM firmen', 'unterkunden' => 'SELECT id FROM unterkunden', 'kunden' => "SELECT id FROM kunden WHERE aktiv = 1"] as $tabelle => $sql) {
        foreach ($db->query($sql)->fetchAll() as $z) {
            $zeile = syncZeileLaden($tabelle, (int) $z['id']);
            foreach (syncSysteme() as $system) {
                if (syncZustaendig($system, 'kontakt', $tabelle, $zeile) && syncAuftragAnlegen($db, $system, 'kontakt', $tabelle, (int) $z['id'])) {
                    $n++;
                }
            }
        }
    }

    return $n;
}

/** Sync-Stand eines Datensatzes für die Karte „Systeme“ im Dashboard. */
function syncKarte(string $tabelle, array $zeile): array
{
    $stand = json_decode((string) ($zeile['sync_json'] ?? '{}'), true) ?: [];
    $db = datenbank();
    $st = $db->prepare("SELECT system, art, status, fehler_text, erstellt FROM sync_auftraege WHERE bezug_tabelle = ? AND bezug_id = ? AND status <> 'erledigt' ORDER BY id DESC");
    $st->execute([$tabelle, $zeile['id']]);

    return ['kundennummer' => (string) ($zeile['nummer'] ?? $zeile['kundennummer'] ?? ''), 'lexware' => ['aktiv' => lexwareAktiv(), 'kontakt' => (string) ($zeile['lexware_kontakt_id'] ?? ''), 'nummer' => (string) ($zeile['lexware_kundennummer'] ?? ''), 'zeit' => (string) ($stand['lexware']['zeit'] ?? '')],
        'odoo' => ['aktiv' => odooAktiv(), 'id' => (int) ($zeile['odoo_id'] ?? 0), 'link' => odooLink('res.partner', (int) ($zeile['odoo_id'] ?? 0)), 'zeit' => (string) ($stand['odoo']['zeit'] ?? '')],
        'offen' => $st->fetchAll(), 'synchronisiert' => (string) ($zeile['synchronisiert'] ?? '')];
}
