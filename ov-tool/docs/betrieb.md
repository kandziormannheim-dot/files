# Betrieb: Installation, Updates, Sicherung

Zielsystem laut SPEC.md 5: bestehender VPS (Ubuntu 24.04, Docker), **ohne Cloudflare**, Caddy mit automatischem HTTPS,
Adresse `https://management.cdu-sf.de`.

## 1. DNS bei manitu

Im manitu-Kundenmenü für die Domain `cdu-sf.de`:

| Typ | Name | Wert |
|---|---|---|
| A | `management` | IPv4 des VPS |
| AAAA | `management` | IPv6 des VPS (falls vorhanden) |

Prüfen: `dig +short management.cdu-sf.de` liefert die IP des VPS. Erst dann Caddy starten, sonst schlägt die
Zertifikatsanforderung fehl (Let's Encrypt sperrt nach mehreren Fehlversuchen für eine Stunde).

## 2. Server vorbereiten (einmalig)

```bash
# Docker ist vorhanden; zusätzlich für Sicherungen:
sudo apt install -y age git
# Ports 80 und 443 müssen offen sein (ufw/Hoster-Firewall)
sudo git clone https://github.com/kandziormannheim-dot/files.git /srv/files
cd /srv/files/ov-tool
cp .env.example .env
chmod 600 .env
```

In `.env` mindestens setzen:

| Variable | Wert |
|---|---|
| `POSTGRES_PASSWORD` | langes Zufallspasswort (`openssl rand -base64 32`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://management.cdu-sf.de` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Postfach des OV bei manitu, z. B. `MAIL_FROM="CDU Seckenheim-Friedrichsfeld <vorstand@cdu-sf.de>"` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` (Bürgerkontaktdaten; **sicher aufbewahren** – ohne ihn sind gespeicherte Kontakte unlesbar) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | für Protokollentwürfe aus Transkripten (optional) |
| `WHISPER_MODEL` | `small` (CPU-schonend) oder `medium` (genauer, langsamer) |
| `ACME_EMAIL` | Kontaktadresse für Let's Encrypt |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` | erster Admin; wird beim ersten Start angelegt, wenn es noch keinen gibt |

`DATABASE_URL`, `FILE_STORAGE_PATH`, `WHISPER_URL` und `CHROMIUM_PATH` setzt `docker-compose.yml` selbst.

## 3. Erster Start

```bash
cd /srv/files/ov-tool
docker compose --profile prod up -d --build
docker compose logs -f app     # „Vorlagen angelegt …“, „Erster Admin angelegt …“
```

Beim Start wendet der App-Container die Datenbank-Migrationen an (`prisma migrate deploy`), legt fehlende
Standardvorlagen aus `templates/` an und den ersten Admin aus `SEED_ADMIN_*`. Danach unter
`https://management.cdu-sf.de/login` mit der Admin-Adresse anmelden und unter **Einstellungen → Allgemein**
Vorsitz, Stellvertretung, E-Mail der Kreisgeschäftsstelle und Fristen prüfen.

Ohne Whisper (kleiner VPS): `docker compose up -d --build app db caddy` und `caddy` per `--profile prod`; Audio-Uploads
sind dann nicht möglich, Text-Transkripte (Teams/Zoom/Plaud) schon.

## 4. Updates

```bash
cd /srv/files && git pull
cd ov-tool && docker compose --profile prod up -d --build
```

Oder über GitHub: Workflow **„OV-Tool deployen“** (`.github/workflows/ov-tool-deploy.yml`, manuell auslösbar) –
Einrichtung siehe `.github/workflows/README.md`.

## 5. Sicherung

`scripts/backup.sh` sichert Datenbank (`pg_dump`) und Datei-Volume, verschlüsselt mit [age](https://github.com/FiloSottile/age)
und kopiert optional außer Haus.

1. Schlüssel **auf einem anderen Rechner** erzeugen: `age-keygen -o ov-backup-key.txt`. Den privaten Schlüssel sicher
   aufbewahren (Passwortmanager/Tresor), nur die Zeile `public key: age1…` als `BACKUP_AGE_RECIPIENT` in `.env` eintragen.
2. Kopie außerhalb des Servers, z. B. Hetzner Storage Box über rclone: `BACKUP_REMOTE="rclone copy {file} storagebox:ov-backups"`.
3. Cron: `15 3 * * * cd /srv/files/ov-tool && scripts/backup.sh >> /var/log/ov-backup.log 2>&1`

**Wiederherstellung einmal testen** (SPEC.md 5): auf einem Testsystem `scripts/restore.sh <datei.tar.age> <schlüssel.txt>`,
dann anmelden, eine Sitzung öffnen und ein Protokoll-PDF erzeugen.

## 6. Datenschutz und Betrieb

- AV-Vertrag mit dem VPS-Hoster abschließen; Bedingungen der Claude API prüfen (SPEC.md 10, offene Punkte).
- Audio verlässt den Server nicht (Whisper läuft lokal); nur Transkripttext geht an die Claude API.
- Löschfristen setzt der Hintergrundjob durch (Einstellungen → Löschfristen).
- Logs: `docker compose logs app`. Mails ohne `SMTP_HOST` landen im Log statt im Postfach.
