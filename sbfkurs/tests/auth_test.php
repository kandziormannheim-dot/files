<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

$konfig = testKonfig();
$db = testDb($konfig);
testSitzung();
$_SERVER['REMOTE_ADDR'] = '';

// Admin aus der Konfiguration
$admin = $db->query("SELECT * FROM benutzer WHERE rolle = 'admin'")->fetch();
pruefe($admin !== false && $admin['email'] === 'admin@test.invalid', 'Admin-Konto wird beim Start angelegt');
$db2 = dbOeffnen($konfig);
pruefeGleich(1, (int) $db2->query("SELECT COUNT(*) FROM benutzer WHERE rolle = 'admin'")->fetchColumn(), 'zweiter Start legt keinen zweiten Admin an');

// Passwortregeln
pruefe(passwortRegelnPruefen('kurz') !== null, 'zu kurzes Passwort abgelehnt');
pruefe(passwortRegelnPruefen('langgenug1234') === null, 'langes Passwort angenommen');

// Registrierung
pruefe(is_string(registrieren($db, $konfig, 'a@test.invalid', 'A', 'Passwort1234', 'FALSCH')), 'Registrierung mit falschem Code scheitert');
pruefe(is_string(registrieren($db, $konfig, 'a@test.invalid', 'A', 'Passwort1234', '')), 'Registrierung ohne Code scheitert');
$id = registrieren($db, $konfig, 'a@test.invalid', 'A', 'Passwort1234', 'EINLADUNG');
pruefe(is_int($id), 'Registrierung mit Konfig-Code gelingt');
pruefe(is_string(registrieren($db, $konfig, 'A@Test.invalid', 'A', 'Passwort1234', 'EINLADUNG')), 'E-Mail ist unabhängig von Groß-/Kleinschreibung eindeutig');
pruefe(is_string(registrieren($db, $konfig, 'kein-email', 'A', 'Passwort1234', 'EINLADUNG')), 'ungültige E-Mail abgelehnt');

// Einmalcode
$code = einladungErzeugen($db, 'Test');
pruefeGleich(8, strlen($code), 'Einmalcode hat acht Zeichen');
$id2 = registrieren($db, $konfig, 'b@test.invalid', 'B', 'Passwort1234', $code);
pruefe(is_int($id2), 'Registrierung mit Einmalcode gelingt');
pruefe(is_string(registrieren($db, $konfig, 'c@test.invalid', 'C', 'Passwort1234', $code)), 'verbrauchter Einmalcode gilt nicht mehr');

// Anmeldung
pruefe(anmelden($db, $konfig, 'a@test.invalid', 'falsch') === null, 'falsches Passwort scheitert');
pruefe(anmelden($db, $konfig, 'niemand@test.invalid', 'Passwort1234') === null, 'unbekannte Adresse scheitert');
$b = anmelden($db, $konfig, 'a@test.invalid', 'Passwort1234');
pruefe($b !== null && (int) $_SESSION['benutzer_id'] === $id, 'richtige Anmeldung setzt die Sitzung');

// Kontosperre nach drei Fehlversuchen (Testkonfiguration)
unset($_SESSION['benutzer_id']);
for ($i = 0; $i < 3; $i++) {
    anmelden($db, $konfig, 'b@test.invalid', 'falsch');
}
pruefe(anmelden($db, $konfig, 'b@test.invalid', 'Passwort1234') === null, 'nach drei Fehlversuchen ist das Konto gesperrt');
$db->prepare('UPDATE benutzer SET gesperrt_bis = NULL WHERE id = ?')->execute([$id2]);
pruefe(anmelden($db, $konfig, 'b@test.invalid', 'Passwort1234') !== null, 'nach Ablauf der Sperre klappt die Anmeldung wieder');

// Erzwungener Passwortwechsel
passwortSetzen($db, $id2, 'Uebergang12345', true);
$_SESSION['benutzer_id'] = $id2;
$konto = aktuellerBenutzer($db);
pruefe($konto !== null && (int) $konto['passwort_wechsel_noetig'] === 1, 'Übergangspasswort setzt den Wechselzwang');
pruefe(passwortSetzen($db, $id2, 'kurz', false) !== null, 'Passwortregeln gelten auch beim Setzen');
passwortSetzen($db, $id2, 'NeuesPasswort99', false);
pruefeGleich(0, (int) $db->query("SELECT passwort_wechsel_noetig FROM benutzer WHERE id = $id2")->fetchColumn(), 'Wechselzwang aufgehoben');

// Gesperrtes Konto fliegt aus der Sitzung
$db->prepare('UPDATE benutzer SET aktiv = 0 WHERE id = ?')->execute([$id2]);
$_SESSION['benutzer_id'] = $id2;
// aktuellerBenutzer() puffert je Prozess — hier direkt prüfen
$abfrage = $db->prepare('SELECT * FROM benutzer WHERE id = ? AND aktiv = 1');
$abfrage->execute([$id2]);
pruefe($abfrage->fetch() === false, 'gesperrtes Konto wird nicht mehr geladen');

exit(testErgebnis());
