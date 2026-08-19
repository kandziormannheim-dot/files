# Deploy nach Hetzner — Einrichtung

[`deploy-hetzner.yml`](deploy-hetzner.yml) baut die Astro-Site und lädt sie per
`rsync` über SSH auf den Hetzner-Cloud-Server. Der Workflow ist fertig, aber er
läuft erst, wenn die fünf Werte unten gesetzt sind — er bricht sonst mit einer
Meldung ab, statt halb zu deployen.

## 1. Was du anlegen musst

**Variables** (Settings → Secrets and variables → Actions → *Variables*):

| Name | Beispiel | Bedeutung |
| --- | --- | --- |
| `HETZNER_HOST` | `188.34.xxx.xxx` oder `srv1.example.de` | IP oder Hostname des Servers |
| `HETZNER_USER` | `deploy` | SSH-Benutzer |
| `HETZNER_PATH` | `/var/www/kandzior.de/html` | Webroot, **absolut**, mit Inhalt der Site |

**Secrets** (dieselbe Seite, Reiter *Secrets*):

| Name | Inhalt |
| --- | --- |
| `HETZNER_SSH_KEY` | privater Deploy-Schlüssel, kompletter PEM-Block |
| `HETZNER_KNOWN_HOSTS` | Host-Fingerprint des Servers |

Variables sind sichtbar, Secrets nicht — deshalb die Aufteilung. Host und Pfad
sind keine Geheimnisse, der Schlüssel schon.

## 2. Deploy-Schlüssel erzeugen

Auf deinem Rechner, **nicht** auf dem Server:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/kandzior-deploy -C "github-actions deploy"
```

Öffentlichen Teil auf den Server, in die `authorized_keys` des Deploy-Benutzers:

```bash
ssh-copy-id -i ~/.ssh/kandzior-deploy.pub deploy@<host>
```

Privaten Teil als `HETZNER_SSH_KEY` einfügen — **vollständig**, inklusive
`-----BEGIN OPENSSH PRIVATE KEY-----` und Schlusszeile:

```bash
cat ~/.ssh/kandzior-deploy
```

## 3. Host-Fingerprint holen

```bash
ssh-keyscan -t ed25519 <host>
```

Die Ausgabezeile als `HETZNER_KNOWN_HOSTS` eintragen.

Der Workflow setzt bewusst **nicht** `StrictHostKeyChecking=no`. Ohne
hinterlegten Fingerprint wäre der erste Kontakt ungeprüft — ein
Man-in-the-Middle könnte sich als dein Server ausgeben und bekäme den
Deploy-Schlüssel. Führe `ssh-keyscan` daher aus einem Netz aus, dem du traust,
und vergleiche das Ergebnis mit dem, was die Hetzner-Konsole beim Serverstart
angezeigt hat.

## 4. Server vorbereiten

Der Deploy-Benutzer braucht Schreibrecht auf das Webroot, sonst nichts:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/kandzior.de/html
sudo chown -R deploy:deploy /var/www/kandzior.de/html
```

`rsync` muss auf dem Server installiert sein (`sudo apt install rsync`) — der
Workflow ruft es dort auf, nicht nur lokal.

Der Webserver (nginx/Apache) liefert dieses Verzeichnis aus. Die Site ist
`output: "static"` mit `format: "directory"`, also reine Dateien ohne
Rewrite-Regeln.

## 5. Erster Lauf: trocken

Actions → *Deploy nach Hetzner* → *Run workflow* → **Trockenlauf ankreuzen**.

`rsync --dry-run` zeigt dann, was übertragen *würde*, ohne etwas zu schreiben.
Prüfe im Log, dass der Zielpfad stimmt und keine fremden Dateien zur Löschung
anstehen. Erst danach ohne Haken laufen lassen.

## Warum das wichtig ist

Der Workflow überträgt mit `--delete`: Was im Zielverzeichnis liegt, aber nicht
im Build, wird **gelöscht**. Das hält den Server sauber, ist aber scharf, wenn
`HETZNER_PATH` falsch zeigt. Zwei Schutzmaßnahmen sind eingebaut:

- Der Workflow lehnt zu breite Pfade ab (`/`, `/var`, `/var/www`, `/etc/*`, …)
  und verlangt einen absoluten Pfad.
- `.well-known/` ist von der Löschung ausgenommen, damit Let's Encrypt seine
  ACME-Challenge behält und die Zertifikatserneuerung nicht am Deploy scheitert.

## Noch kein automatischer Deploy

Ausgelöst wird nur von Hand. Grund steht in `DESIGN_REVIEW.md`: die Portraits
fehlen (Hero zeigt Platzhalter) und das Kontaktformular läuft im
Simulationsmodus — Anfragen landen in der Konsole statt beim Empfänger. Ein
`push`-Trigger würde diesen Zustand bei jedem Merge veröffentlichen.

Sind beide Punkte erledigt, reicht dieser Zusatz in `deploy-hetzner.yml`:

```yaml
on:
  workflow_dispatch:
    # ... unverändert ...
  push:
    branches: [main]
    paths:
      - "site/**"
      - ".design/kandzior-de/DESIGN_TOKENS.css"
```

Der zweite Pfad steht dort, weil `npm run build` per `sync:tokens` die
Token-Datei aus `.design/` nach `site/src/styles/tokens.css` kopiert — eine
Änderung dort verändert die gebaute Site, ohne dass `site/` angefasst wird.

## Vor dem Livegang

`astro.config.mjs` setzt `site: "https://kandzior.de"` — das steuert kanonische
URLs, hreflang und die Sitemap. Vor dem ersten echten Deploy prüfen, ob die
Domain stimmt und das DNS auf den Server zeigt.
