# God's Eye View — Einrichtung

[God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) (MIT, von
Bilawal Sidhu und Sameh Khamis) ist ein Lagebild der Erde im Browser: ein
3D-Globus, auf dem Flüge, Schiffe, Satelliten, Erdbeben, Waldbrände, öffentliche
Kameras, Radiosender, Raketenstarts, Rechenzentren, Staudämme und Seekabel
liegen — alles aus öffentlichen Quellen, live. Es ist fremde Software; dieses
Repository fügt nur hinzu, was es braucht, um sie auf dem Plesk-Server unter
einer eigenen Subdomain zu betreiben:

- [`.github/workflows/godview-einrichten.yml`](../../.github/workflows/godview-einrichten.yml) — richtet ein und aktualisiert,
- [`godview/godview-start.mjs`](../../godview/godview-start.mjs) — startet den Dienst eng gebunden,
- [`godview/dienst.sh`](../../godview/dienst.sh) — hält ihn am Leben,
- [`godview/htaccess-vorlage`](../../godview/htaccess-vorlage) — verdrahtet Webroot und Datenkanäle.

## Livegang über die Workflows (der kurze Weg)

`kandzior.de` läuft auf dem Plesk-Server `95.216.18.216`; die DNS-Zone liegt bei
Hetzner DNS. Zwei Workflows unter *Actions* genügen — Handarbeit auf dem Server
ist nicht nötig:

1. **„DNS-Eintrag setzen"** — Name `godview`, IPs auf Vorgabe lassen,
   Hetzner-DNS-Token eingeben. Legt A/AAAA für `godview.kandzior.de` an.
2. **„God View einrichten"** — Plesk-Admin-Passwort (oder Secret
   `PLESK_PASSWORT`) und ein Zugangspasswort eingeben. Der Workflow holt den
   gewünschten Stand von GitHub, baut ihn auf dem Runner, prüft ihn dort im
   Probelauf, legt die Subdomain an (Webroot `godview-app/public`), sorgt für
   ein passendes Node auf dem Server, überträgt Quelltext und gebaute Dateien,
   hinterlegt die Schlüssel, installiert die Abhängigkeiten, startet den Dienst,
   trägt den Aufpasser in die Cron-Tabelle ein, holt das Let's-Encrypt-Zertifikat
   und prüft am Ende Oberfläche, Zugangsschutz, Datenkanäle und die Dateirechte.

Scheitert nur der Let's-Encrypt-Schritt, fehlte meist der DNS-Eintrag — erst
Workflow 1, dann Workflow 2 erneut. Ein erneuter Lauf ist zugleich der Weg für
Updates: er setzt den Stand neu, baut, überträgt und startet den Dienst durch.

### Die Eingaben

| Eingabe | Bedeutung |
| --- | --- |
| `plesk_passwort` | leer = Repository-Secret `PLESK_PASSWORT` |
| `zugang_passwort` | Passwort der Basis-Anmeldung; leer = Secret `GODVIEW_ZUGANG_PASSWORT`; `-` = **kein** Schutz |
| `zugang_benutzer` | Benutzername dazu, Vorgabe `godview` |
| `version` | Zweig, Tag oder Commit von God's Eye View, Vorgabe `main` |
| `port` | Port des Node-Dienstes auf `127.0.0.1`, Vorgabe `4180` |
| `subdomain`, `domain` | Vorgaben `godview.kandzior.de` und `kandzior.de` |

Der Workflow erzeugt bewusst **kein** Zugangspasswort: es müsste sonst im
Protokoll oder in der Zusammenfassung des Laufs auftauchen. Entweder eingeben,
als Secret `GODVIEW_ZUGANG_PASSWORT` hinterlegen — oder mit `-` ausdrücklich
darauf verzichten.

### Warum `main` und nicht der letzte Tag

Die Datenkanäle der Anwendung (alles unter `/api/`) sind Vite-Erweiterungen.
Bis einschließlich Tag `v0.1.1` hängen sie nur im Entwicklungs-Server; der
Vorschau-Server, mit dem die Instanz hier läuft, kennt sie dort noch nicht — die
Oberfläche käme hoch und bliebe blind. Seit der Aufteilung nach `server/` in
`main` hängen sie in beiden. Der **Probelauf auf dem Runner** prüft genau das
und bricht ab, bevor irgendetwas auf den Server geht. Für einen reproduzierbaren
Stand statt `main` einen Commit eintragen; der gelaufene Commit steht in der
Zusammenfassung jedes Laufs.

## Wie es auf dem Server liegt

```
godview-app/public/     ← Webroot der Subdomain: gebaute Dateien + .htaccess
godview-app/dienst.sh   ← Dienst starten, stoppen, nachsehen
godview-app/dienst.conf ← Port, Hostname, Node-Pfad (keine Geheimnisse)
godview-app/dienst.log  ← Protokoll des Dienstes
godview-app/.htpasswd   ← Zugangsschutz, oberhalb des Webroots
godview-quelle/         ← Quelltext, node_modules, dist und .env (Modus 600)
godview-node/           ← eigenes Node, falls der Server keines ≥ 24.14 hat
```

Die gebauten Dateien liegen im Webroot und werden vom Webserver direkt
ausgeliefert. Alles unter `/api/` — die Proxys, die OpenSky, Celestrak,
Overpass, TomTom, FIRMS, AISStream und OpenAI ansprechen — reicht die
`.htaccess` per `mod_proxy` an den Node-Dienst auf `127.0.0.1:<Port>` weiter.
Der Dienst lauscht **nur** auf `127.0.0.1` und nimmt als Host-Kopf nur die
eingerichtete Subdomain an; jeder andere bekommt 403 (Schutz gegen
DNS-Rebinding). Am Server vorbei ist er damit nicht erreichbar.

Wach bleibt er über zwei Einträge in der Cron-Tabelle des Systembenutzers —
alle fünf Minuten nachsehen und nach einem Neustart des Servers starten.
`systemd` steht uns als Domainbenutzer nicht zur Verfügung.

Von Hand auf dem Server:

```bash
godview-app/dienst.sh status     # läuft er? antwortet er?
godview-app/dienst.sh neustart   # z. B. nach geänderten Schlüsseln
godview-app/dienst.sh stop       # anhalten (der Aufpasser startet ihn
                                 # binnen fünf Minuten wieder — vorher den
                                 # Cron-Eintrag entfernen)
tail -f godview-app/dienst.log
```

## Schlüssel und Kosten

Ohne jeden Schlüssel läuft die Anwendung vollständig: Esri-Satellitenbilder,
Gelände, Flüge, Militärverkehr, Satelliten, Erdbeben, Kameras, Radio, Starts.
Schlüssel sind Zusatzstufen. Hinterlegt werden sie **ausschließlich** als
Repository-Secrets; der Workflow schreibt daraus `godview-quelle/.env`. Das
Einstellungsfeld der Anwendung (*POWER UP → Provider Settings*) ist auf dem
Server ohne Funktion: es antwortet nur auf Anfragen von `localhost` und ist im
Vorschau-Server ohnehin nicht eingehängt.

| Secret | Schaltet frei | Kosten |
| --- | --- | --- |
| `CESIUM_ION_TOKEN` | Photorealistischer 3D-Globus, Bing-Bilder, Weltgelände | kostenloses Kontingent, private Nutzung |
| `GOOGLE_MAPS_API_KEY` | Google-3D-Kacheln direkt, Ortssuche | **abgerechnet pro Aufruf** |
| `GOOGLE_MAPS_SERVER_API_KEY` | Orte und Street View serverseitig | abgerechnet |
| `OPENAI_API_KEY` | Sprachsteuerung | abgerechnet |
| `AISSTREAM_API_KEY` | Schiffe weltweit | kostenlos nach Anmeldung |
| `FIRMS_MAP_KEY` | Aktive Feuer (NASA) | kostenlos |
| `TOMTOM_API_KEY` | Echter Verkehr statt Simulation | kostenloses Kontingent |
| `OPENSKY_CLIENT_ID` / `..._SECRET` | Mehr Flug-Abfragen | kostenlos |
| `LL2_API_TOKEN` | Mehr Abfragen für Raketenstarts | kostenlos |

Drei Dinge gehören dazu:

- **Die beiden browserseitigen Schlüssel stehen im Quelltext der Seite.**
  `GOOGLE_MAPS_API_KEY` und `CESIUM_ION_TOKEN` werden beim Bauen fest in die
  Dateien gebacken — so ist die Anwendung gebaut. Beschränke sie beim Anbieter
  (Google: HTTP-Referrer auf `https://godview.kandzior.de/*` plus Beschränkung
  auf die genutzten APIs; Cesium: `assets:read` mit URL-Beschränkung). Ändern
  sie sich, braucht es einen neuen Lauf des Workflows.
- **Budgetgrenzen setzt man beim Anbieter**, nicht in der Anwendung. Die
  eingetragenen Bremsen (`GEV_RATELIMIT_*` in der `.env`) sind Notbremsen im
  Prozess, keine Abrechnungsgrenzen — und weil hinter dem Reverse-Proxy alle
  Anfragen von `127.0.0.1` kommen, wirken sie für die Instanz insgesamt statt
  je Besucher.
- **Eine erreichbare Instanz vermittelt ihre Schlüssel an jeden, der sie
  aufruft.** Genau deshalb ist der Zugangsschutz voreingestellt an.

## Zugangsschutz

Der Workflow legt `godview-app/.htpasswd` an und lässt die `.htaccess` eine
Basis-Anmeldung verlangen. Damit ist alles geschützt, was Apache ausliefert —
insbesondere sämtliche Datenkanäle unter `/api/`. Der Selbsttest prüft das:
ohne Anmeldung muss `/api/gbfs` mit 401 antworten.

Statische Dateien kann nginx in Plesk am Apache vorbei direkt ausliefern; dann
ist die Oberfläche selbst sichtbar, ohne dass sie Daten zeigen könnte. Wer das
nicht will, trägt in Plesk unter *Apache & nginx Settings → Zusätzliche
nginx-Direktiven* zwei Zeilen ein (Pfad aus dem Protokoll des Laufs, Zeile
`AuthUserFile`):

```nginx
auth_basic "God's Eye View";
auth_basic_user_file /var/www/vhosts/kandzior.de/godview-app/.htpasswd;
```

Sie gelten für die ganze Subdomain; dieselbe Anmeldung greift dann auch für
die Dateien, die nginx selbst ausliefert.

## Wenn `/api/` nicht durchgeht

Die Weiterleitung in der `.htaccess` braucht `mod_proxy` und `mod_proxy_http`.
Fehlen sie, antwortet Apache auf `/api/…` mit 500 oder liefert die Oberfläche
aus — der Selbsttest bricht dann mit genau dieser Meldung ab. Ersatzweise
übernimmt nginx die Weiterleitung, wieder unter *Apache & nginx Settings →
Zusätzliche nginx-Direktiven*:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4180;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

Port anpassen, falls beim Lauf ein anderer gewählt wurde. `location /` darf
dort **nicht** noch einmal auftauchen — Plesk legt diesen Block schon an, ein
zweiter macht die nginx-Konfiguration ungültig.

## Abbauen

```bash
godview-app/dienst.sh stop
crontab -l | grep -v godview-app/dienst.sh | crontab -
rm -rf godview-app godview-quelle godview-node
```

Die Subdomain selbst verschwindet in Plesk unter *Websites & Domains*.

## Grenzen

Upstream nennt das Projekt ausdrücklich „a fast, hackable foundation, not a
hardened production service" — ein Werkzeug zum Erkunden, kein Betriebssystem
für Kritisches. Die Daten sind verzögert, unvollständig, teils modelliert oder
schlicht falsch; für Navigation, Notfälle, medizinische oder finanzielle
Entscheidungen taugen sie nicht. Die einzelnen Quellen haben eigene
Nutzungsbedingungen
([DATA_SOURCES.md](https://github.com/bilawalsidhu/gods-eye-view/blob/main/DATA_SOURCES.md)),
das Sicherheitsmodell steht in
[SECURITY.md](https://github.com/bilawalsidhu/gods-eye-view/blob/main/SECURITY.md).
Die Anwendung modelliert Ereignisse, Fahrzeuge und Infrastruktur — keine
Personensuche; das ist die erklärte Linie des Projekts.
