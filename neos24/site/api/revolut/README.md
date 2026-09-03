# Revolut-Zahlung für Privatkunden

Privatkunden frankieren ein Paket direkt auf der Startseite (Reiter „Privatkunden“,
Abschnitt „Paket verschicken“) und bezahlen über **Revolut Checkout** (Karte,
Revolut Pay, Apple Pay, Google Pay). Geschäftskunden bleiben beim Konto auf Rechnung.

## Ablauf

```
Browser (assets/checkout.js)            Server (api/revolut/)               Revolut
────────────────────────────            ─────────────────────               ───────
Formular ausfüllen
POST bestellung.php  ────────────────▶  Betrag aus preise.php rechnen
                                        Bestellung in SQLite anlegen
                                        POST /api/orders ─────────────────▶ Order (token)
◀──────── { token, bestellung, modus }
embed.js laden, payWithPopup(token)  ────────────────────────────────────▶ Zahlung im Popup
onSuccess → GET status.php?id=…  ───▶  ggf. GET /api/orders/{id} ───────▶
                                        Status „bezahlt“, Mail, Label-Auftrag
                                        POST webhook.php  ◀──────────────── ORDER_COMPLETED (signiert)
```

Der Betrag kommt **ausschließlich** aus `preise.php` (netto × 1,19, auf den Cent
gerundet). Was der Browser schickt, wird nur zur Validierung von Land und
Adressen gelesen.

## Dateien

| Datei | Zweck |
|---|---|
| `_bootstrap.php` | Konfiguration, SQLite, Herkunftsprüfung, Missbrauchsbremse, Revolut-Client, Statuspflege, Mail |
| `preise.php` | Preisquelle (netto, Cent). Muss mit der Tabelle in `index.html` / `en/index.html` und den `data-netto`-Werten im Formular übereinstimmen |
| `angebot.php` | GET · Preisliste, Modus und Bereitschaft für das Formular |
| `bestellung.php` | POST · Bestellung anlegen, Revolut-Order eröffnen, Token zurückgeben |
| `status.php` | GET `?id=NE-…` · Status, gleicht bei Bedarf mit Revolut ab |
| `webhook.php` | POST · Empfänger für Revolut-Ereignisse, prüft die Signatur |
| `webhook-einrichten.php` | CLI · registriert den Webhook und gibt das Signing Secret aus |
| `neos24-config.beispiel.php` | Vorlage der Konfiguration (ohne Geheimnisse) |
| `.htaccess` | interne Dateien nicht ausliefern |

Daten liegen in `<daten>/bestellungen.sqlite` (Tabelle `bestellungen`, Ereignisse als
JSON je Zeile). Statuswerte: `offen` → `angelegt` → `autorisiert` → `bezahlt`, sonst
`fehlgeschlagen` / `storniert`.

## Einrichtung

1. **Revolut Business** → Merchant API → API keys. Sandbox- und Live-Schlüssel sind getrennt
   (Sandbox-Konto unter `sandbox-business.revolut.com`).
2. `neos24-config.beispiel.php` als `neos24-config.php` **eine Ebene über dem Webroot** ablegen
   (siehe Kopf der Vorlage), `geheimerSchluessel`, `daten`, `basisUrl`, Mail und `salz` füllen.
   Rechte 640; das Datenverzeichnis muss dem Webserver gehören.
3. Webhook registrieren und das Secret eintragen:
   ```bash
   php api/revolut/webhook-einrichten.php https://neos24.com/api/revolut/webhook.php
   ```
   Das ausgegebene Signing Secret als `webhookSchluessel` in die Konfiguration. Je Modus
   (sandbox/prod) einmal ausführen.
4. Selbsttest: `curl https://neos24.com/api/revolut/bestellung.php` → `{"ok":true,"bereit":true,…}`.
   Kommt Quelltext, läuft kein PHP für das Verzeichnis.
5. Testzahlung im Sandbox-Modus mit den Revolut-Testkarten (in der Revolut-Doku: „Test cards“),
   danach in der Datenbank prüfen: `status = bezahlt`, Ereignis `webhook.order_completed`.
6. Go-live: `modus => 'prod'`, Live-Schlüssel, Webhook erneut registrieren (Live-Secret),
   Testbestellung mit echter Karte und Storno über das Revolut-Dashboard.

## Vor Go-live gegen die aktuelle Revolut-Doku prüfen

Die Doku (`developer.revolut.com/docs/merchant`) war beim Bau nicht erreichbar. Implementiert
ist der Stand der Merchant API mit `Revolut-Api-Version: 2024-09-01`. Prüfpunkte:

- `POST /api/orders`: Felder `amount` (Minor Units), `currency`, `description`,
  `merchant_order_ext_ref`, `customer.email`, `capture_mode`, `redirect_url`; Antwortfelder
  `id`, `token`, `state`.
- `GET /api/orders/{id}`: Feld `state` (`pending`, `processing`, `authorised`, `completed`,
  `cancelled`, `failed`).
- Webhook: Kopf `Revolut-Signature` (`v1=…`, mehrere kommagetrennt) und
  `Revolut-Request-Timestamp` (ms); signiert wird `v1.<timestamp>.<body>` mit HMAC-SHA256.
  Registrierung über `POST /api/1.0/webhooks`, Antwortfeld `signing_secret`.
- Web-SDK: `https://sandbox-merchant.revolut.com/embed.js` bzw. `https://merchant.revolut.com/embed.js`,
  Aufruf `RevolutCheckout(token, 'sandbox' | 'prod')` → `payWithPopup({ email, name, onSuccess, onError, onCancel })`.

Alle vier Punkte sitzen an einer Stelle (`_bootstrap.php`, `webhook.php`, `assets/checkout.js`)
und lassen sich ohne Umbau anpassen.

## Lokal testen

Ohne Revolut-Konto lässt sich der ganze Weg mit einer Attrappe durchspielen: Testkonfiguration
mit `basis.sandbox => 'http://127.0.0.1:8899'`, `transport => ''` und `NEOS_KONFIG=<pfad> php -S
127.0.0.1:8901 -t neos24/site`. Der Webhook lässt sich mit einem selbst berechneten HMAC
(`hash_hmac('sha256', "v1.$ts.$body", $secret)`) auslösen. Fehlerfälle: falsche Signatur → 401,
Zeitstempel älter als 5 Minuten → 401, unbekanntes Zielland → 422, fremde Herkunft → 403.

## Was noch fehlt

- **Versandlabel**: `labelBeauftragen()` vermerkt nur den Auftrag. Die Carrier-Anbindung erzeugt
  später das Label und schickt es als zweite Mail.
- Mehrere Pakete, weitere Gewichtsklassen, Abholung an der Haustür.
- Rechnung als PDF (die Bestätigungsmail nennt Betrag und MwSt., ist aber keine Rechnung).
