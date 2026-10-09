# Betrieb: Installation, Updates, Sicherung

Zwei Varianten, gleiche Container:

- **Eigener VPS** (SPEC.md 5): Ubuntu 24.04 mit Docker, **ohne Cloudflare**, Caddy mit automatischem HTTPS,
  Adresse `https://management.cdu-sf.de` – Abschnitte 1–4.
- **Plesk-Server**, z. B. `https://cduverwaltung.kandzior.cc`: Plesk behält Ports 80/443 und das Zertifikat, sein nginx
  leitet an die App weiter, kein Caddy – [Abschnitt 7](#7-variante-plesk). Sicherung und Datenschutz (5, 6) gelten für beide.

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
| `POSTGRES_PASSWORD` | langes Zufallspasswort (`openssl rand -hex 32` – nur Hex, da es in `DATABASE_URL` landet) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://management.cdu-sf.de` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Postfach des OV bei manitu, z. B. `MAIL_FROM="CDU Seckenheim-Friedrichsfeld <vorstand@cdu-sf.de>"` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` (Bürgerkontaktdaten; **sicher aufbewahren** – ohne ihn sind gespeicherte Kontakte unlesbar) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | für Protokollentwürfe aus Transkripten (optional) |
| `WHISPER_MODEL` | `small` (CPU-schonend) oder `medium` (genauer, langsamer) |
| `ACME_EMAIL` | Kontaktadresse für Let's Encrypt |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` | erster Admin; wird beim ersten Start angelegt, wenn es noch keinen gibt |
| `COMPOSE_PROFILES` | `prod` (startet zusätzlich Whisper und Caddy) |

`DATABASE_URL`, `FILE_STORAGE_PATH`, `WHISPER_URL` und `CHROMIUM_PATH` setzt `docker-compose.yml` selbst.

## 3. Erster Start

```bash
cd /srv/files/ov-tool
docker compose up -d --build
docker compose logs -f app     # „Vorlagen angelegt …“, „Erster Admin angelegt …“
```

Beim Start wendet der App-Container die Datenbank-Migrationen an (`prisma migrate deploy`), legt fehlende
Standardvorlagen aus `templates/` an und den ersten Admin aus `SEED_ADMIN_*`. Danach unter
`https://management.cdu-sf.de/login` mit der Admin-Adresse anmelden und unter **Einstellungen → Allgemein**
Vorsitz, Stellvertretung, E-Mail der Kreisgeschäftsstelle und Fristen prüfen.

Ohne Whisper (kleiner VPS): `docker compose up -d --build app db caddy`; Audio-Uploads sind dann nicht möglich,
Text-Transkripte (Teams/Zoom/Plaud) schon.

## 4. Updates

```bash
cd /srv/files && git pull
cd ov-tool && docker compose up -d --build
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

## 5a. Mailversand über Brevo (Absender info@cdu-sf.de)

Die Domain cdu-sf.de ist bei Brevo authentifiziert (DKIM `brevo1/brevo2._domainkey`, DMARC). Mails mit Absender
info@cdu-sf.de deshalb über Brevo verschicken, nicht über den eigenen Server (dessen IP steht nicht im SPF von cdu-sf.de).
Brevo → Einstellungen → SMTP & API → „SMTP-Schlüssel erzeugen“; Login und Schlüssel in die `.env`:
`BREVO_SMTP_LOGIN=…`, `BREVO_SMTP_KEY=…`, danach `docker compose up -d`. Brevo hat Vorrang vor `SMTP_*`.
Kontrolle: Einstellungen → Allgemein → „Testmail an mich senden“. Ohne Brevo gilt `MAIL_FROM`, Antworten über `MAIL_REPLY_TO`.

## 6a. Marketing: WordPress-Anbindung

Blogartikel werden nach Freigabe über die WordPress-REST-API übertragen (als Entwurf oder direkt veröffentlicht).
Einrichtung je Webseite: in WP-Admin einen Redaktionsnutzer (Rolle „Autor“ oder „Redakteur“) anlegen, unter
Benutzer → Profil → Anwendungspasswörter ein Passwort „OV-Tool“ erzeugen und in der `.env` eintragen
(`WP_SF_USER`, `WP_SF_APP_PASSWORD`, analog `WP_BBR_…`), danach `docker compose up -d`. Das Passwort steht nur in der `.env`.
Social-Media-Beiträge werden kopiert/geteilt oder in der Meta Business Suite eingeplant; direktes Posten bräuchte eine
freigegebene Meta-App und ist nicht eingebaut.

## 6b. Gemeinsamer Login und Zusammenarbeit mit der CDU-Cloud (Nextcloud)

1. In der Nextcloud (cloud.cdu-sf.de) als Admin: Verwaltungseinstellungen → Sicherheit → „OAuth 2.0-Clients“ →
   Name „OV-Management“, Weiterleitungs-URL `https://management.cdu-sf.de/api/auth/callback/nextcloud` → Hinzufügen.
2. Client-ID und Geheimnis in die `.env` auf dem Server: `NEXTCLOUD_URL=https://cloud.cdu-sf.de`,
   `NEXTCLOUD_CLIENT_ID=…`, `NEXTCLOUD_CLIENT_SECRET=…`, danach `docker compose up -d`.
3. Auf der Anmeldeseite erscheint „Mit CDU-Cloud anmelden“. Zugelassen wird nur, wessen E-Mail-Adresse im Cloud-Profil
   mit einer aktiven Person im Tool übereinstimmt; neue Personen legt weiterhin der Admin an.
4. Optional: In der Nextcloud die App „Externe Seiten“ (External sites) aktivieren und `https://management.cdu-sf.de`
   als Eintrag anlegen – das Tool erscheint dann als Menüpunkt in der Cloud. Die App erlaubt per
   `Content-Security-Policy: frame-ancestors` nur die Einbettung in die eigene Cloud.

## 6c. Inventar

Codes nach dem Muster `OVMASF01234.20` (laufende Nummer, Anschaffungsjahr). Etiketten: Inventar → „Etiketten“ mit wählbarem
Druckformat (`src/lib/label-formats.ts`), Standard Etikettendrucker 50 × 30 mm (Name und QR oben, Barcode über die volle Breite); außerdem A4-Bögen 3 × 8 (70 × 37/36/35 mm), 3 × 7 (63,5 × 38,1), 5 × 13 (38,1 × 21,2, nur Barcode),
2 × 4 (105 × 74, mit Standort/Kategorie) sowie Etikettendrucker 62 × 29 mm (Brother) und 89 × 36 mm (Dymo). Etiketten je Gegenstand,
freie Plätze überspringen und Versatz in mm einstellbar; das gewählte Format merkt sich der Browser. Druck in tatsächlicher Größe.
Inventarliste: „PDF-Liste“ bzw. „Inventurliste“ (mit Prüfspalte und Unterschriftszeile) übernimmt die Filter der Übersicht
(Vorlage `inventar.liste`, unter Vorlagen anpassbar).
Jedes Etikett trägt einen Code-128-Barcode (Handscanner, Android-Kamera) und einen QR-Code (iPhone-Kamera öffnet den Eintrag).
Fotos werden beim Hochladen verkleinert und ohne Metadaten (GPS) gespeichert.
Leihprotokoll: Beim Verleih werden Abholdatum, übergebende Person, ausleihende Person, Organisation, optional E-Mail, Zubehör,
Zustand und Fotos erfasst, bei der Rückgabe Datum, wer zurückbringt und wer annimmt, Zustand (wird als aktueller Zustand übernommen),
Vollständigkeit des Zubehörs, Bemerkung und Fotos. Jeweils entsteht ein PDF im Briefbogen (Vorlage `inventar.leihprotokoll`,
Fotos eingebettet), das per Mail (`inventar.ausgabe` / `inventar.rueckgabe`) an die beteiligten Nutzer, die ausleihende Person
und den Verteiler aus Einstellungen → Allgemein geht. Die E-Mail der ausleihenden Person wird verschlüsselt gespeichert
(`ENCRYPTION_KEY`) und vom Retention-Job 12 Monate nach der Rückgabe gelöscht.

## 6d. Satzung, Wahlen, Presse, Landing Pages, Beschlüsse

- **Satzung** (`/satzung`): Volltexte aus `src/data/statutes.json` (Statut CDU Deutschlands Stand 21.02.2026 mit GO, FBO, PGO, DSO, BFAO, PartG; Satzung/Verfahrens-/Finanzordnung CDU BW Stand 27.04.2024). Neue Fassung: PDFs laden, `pdftotext -layout` und `python3 scripts/statute/parse.py statut.txt bw.txt > src/data/statutes.json` (Zeilenbereiche im Skript prüfen), Tests laufen lassen. Suche läuft im Browser und offline (Service Worker `public/sw.js`). Der Frage-Antwort-Assistent braucht `ANTHROPIC_API_KEY`.
- **Wahlen** (`/elections`): Stimmzettel drucken, Auszählung nach LV-Satzung § 57, Niederschrift nach § 51 Abs. 2. Die Auszählung speichert ohne Netz auf dem Gerät und überträgt später. Keine Mitgliederlisten, keine elektronische Stimmabgabe.
- **Presse** (`/press` intern, `/presse` öffentlich): Freigabe durch Recht `press.publish`, Einzelversand an aktive Verteiler-Kontakte. Pressekontakt, Impressum- und Datenschutz-Link unter Einstellungen → Allgemein.
- **Landing Pages** (`/landing`, öffentlich `/p/<kurzname>`): erst nach Freigabe online; Einträge verschlüsselt, wenn `ENCRYPTION_KEY` gesetzt ist; automatische Löschung im nächtlichen Retention-Job.
- **Notizen und Anlagen je TOP** (Sitzung → „Notizen und Anlagen zu den TOPs“, auch im Protokoll-Editor): Notiz steht im Protokoll unter dem TOP, Anhänge werden als „Anlage n“ nummeriert; PDF und Bilder werden ans Protokoll-PDF angehängt (pdf-lib), andere Formate gehen beim Versand als eigene Datei mit. Nach dem Versand gesperrt (neue Version).
- **Auslagen** (`/expenses`): Belege als Foto (ohne EXIF/GPS, WebP) oder PDF, Name, Anschrift und E-Mail des Mitglieds werden je Antrag erfasst; Erstattung als Überweisung (IBAN mit Prüfziffer), bar oder Spendenbescheinigung (Aufwandsspende). Anschrift, E-Mail und Bankdaten verschlüsselt, 12 Monate nach Versand gelöscht. Freigabe (`expense.approve`) sendet Antrag + Belege als ein PDF an die E-Mail der Kreisgeschäftsstelle, Kopie (Cc) an das Mitglied.
- **Beschlüsse** (`/resolutions`): PDF je Beschluss; „Als Antrag an den Kreisverband“ sendet Antrag + Beschluss als PDF an die E-Mail der Kreisgeschäftsstelle (Einstellungen → Allgemein, Vorbelegung).

## 6e. BBR-Anliegen → Social Media & Blog

- Quelle: Nextcloud-Deck-Boards „BBR Seckenheim“ und „BBR Friedrichsfeld“ (Tool bbr-anliegen.cdu-sf.de). Dienstnutzer `ov-tool` mit **lesender** Freigabe der Boards und eigenem App-Passwort. Umgebungsvariablen `NEXTCLOUD_URL`, `NEXTCLOUD_DECK_USER`, `NEXTCLOUD_DECK_APP_PASSWORD` (nur in der Server-`.env`, nie im Chat oder Repo). Board-Name als Einstellung `bbr.deckBoards` (Standard: beide Boards, je Zeile ein Name; der Bezirk ergibt sich aus dem Board).
- **Keine Automatik:** „Anliegen abrufen“ (Marketing → BBR-Anliegen) übernimmt nur Kartentitel, Bezirk und Kurzfassung – nie Hinweisgeber oder Erläuterung. „Beiträge erstellen“ je Anliegen erzeugt die gewählten Entwürfe: BBR-Kanal (sachlich) und OV-Kanal (politisch) mit Facebook-, Instagram-, X- und TikTok-Text, Bildkachel 1080×1350 und Video 1080×1920 (Chromium + ffmpeg im Container), sowie einen Blogartikel für bbr.cdu-sf.de oder cdu-sf.de mit Kachel als Beitragsbild.
- Texte über Claude (`ANTHROPIC_API_KEY`, Prompt `prompt.bbr-social` unter Vorlagen anpassbar); ohne Schlüssel wird die Kurzfassung übernommen.
- Erneutes Erstellen ersetzt Entwürfe; freigegebene/veröffentlichte Beiträge bleiben, dann entsteht ein zusätzlicher Entwurf. Veröffentlicht wird erst nach Freigabe (`marketing.publish`): Blog per WordPress-REST (`WP_SF_*`/`WP_BBR_*`, Beitragsbild wird mit hochgeladen), Social Media derzeit über Teilen/Herunterladen.

**Facebook/Instagram direkt:** Meta-App (Entwicklungsmodus genügt, solange nur Rolleninhaber der App posten) mit `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`. Je Kanal `META_<OV|BBR>_PAGE_ID`, `_PAGE_TOKEN` (Seiten-Token aus langlebigem Nutzer-Token, läuft nicht ab), `_IG_ID` (Instagram-Business-Konto der Seite). Blogartikel: nach Freigabe Häkchen bei cdu-sf.de, bbr.cdu-sf.de oder beiden, dann als Entwurf oder direkt veröffentlichen (je Seite ein WordPress-Beitrag, Tabelle `WordpressPublication`; erneutes Senden aktualisiert). Im Social-Beitrag nach Freigabe: „Facebook: Kachel/Video posten“, „Instagram: Kachel/Reel posten“; optional mit Link zum veröffentlichten Blogartikel. Instagram holt die Datei über einen signierten, 1 Stunde gültigen Link `/api/public-media/…` ab. X und TikTok bewusst nicht angebunden (Teilen übers Handy).


## 6f. Videoschnitt (Marketing → Videos schneiden)

Clips hochladen → automatisch ein Aufklärungsvideo (Standard höchstens 30 s) in 9:16, 1:1 und/oder 16:9.
Ablauf (Job `video-process`, `src/server/services/video.ts`):
1. Upload in Abschnitten zu 32 MB (`/api/video/[id]/upload`), weil Plesk-nginx je Anfrage nur 128 MB annimmt; je Clip bis 2 GB / 15 min, bis 12 Clips.
2. Analyse: ffprobe, drei Standbilder je Clip, Tonspur an den eigenen Whisper-Dienst (`output=json&word_timestamps=true`).
   Whisper läuft nur mit `COMPOSE_PROFILES=whisper` (bzw. `prod`); ohne Whisper geht es ohne Untertitel weiter (Hinweis am Video).
3. Schnittplan von Claude nach den Regievorgaben (Vorlage `prompt.video`, je Video ergänzbar) mit Standbildern und Transkript;
   ohne `ANTHROPIC_API_KEY` ein einfacher Schnitt. Der Plan wird geprüft (`src/lib/video-plan.ts`): O-Töne an Wortgrenzen, Zeitbudget, Mindestlänge.
4. Rendern mit ffmpeg (`src/server/media/video-edit.ts`): Titelzeile, Texteinblendungen, Untertitel, Logo (auf Weiß), Abschlusstafel,
   Lautheit nach EBU R128, optional Musik (wird unter Sprache automatisch leiser).
Der Schnitt bleibt ein Vorschlag: im Editor änderbar, danach neu rendern. „Als Social-Media-Beitrag übernehmen“ legt einen Entwurf an;
veröffentlicht wird erst nach Freigabe. Beim Anlegen muss das Einverständnis der gezeigten Personen bestätigt werden, bei Musik die Nutzungsrechte.
Clips liegen unter `video/<Projekt>/` in der Dateiablage, bis das Video gelöscht wird.
## 7. Variante: Plesk

Auf einem Plesk-Server gehören Ports 80/443 und die Zertifikate Plesk. Die App läuft trotzdem in Docker (app, db,
optional whisper), aber **ohne Caddy**; Plesks nginx leitet an `127.0.0.1:3000` weiter. Beispiel-Adresse:
`https://cduverwaltung.kandzior.cc`.

**Kurzweg:** [`scripts/plesk-setup.sh`](../scripts/plesk-setup.sh) erledigt 7.1–7.3 automatisch (Subdomain, Postfach,
Zertifikat, nginx, Docker, `.env` mit erzeugten Schlüsseln, Start mit Funktionsprüfung). Per SSH als root:

```bash
curl -fsSL https://raw.githubusercontent.com/kandziormannheim-dot/files/main/ov-tool/scripts/plesk-setup.sh | bash
```

Es fragt nur Admin-Adresse, Absender-Postfach, SMTP-Server und optional den Claude-API-Schlüssel ab. Erneut
ausgeführt aktualisiert es den Code und startet neu (vorhandene `.env` bleibt). Andere Adresse:
`OVTOOL_DOMAIN=… OVTOOL_SUB=…` voranstellen (bei `curl … | bash` vor `bash`). Was nicht automatisch klappt, meldet
es mit dem passenden Handgriff aus den folgenden Abschnitten.

### 7.1 Domain und Zertifikat (Plesk-Oberfläche)

1. **Websites & Domains → Subdomain hinzufügen:** `cduverwaltung` unter `kandzior.cc`. Liegt das DNS nicht bei Plesk,
   beim DNS-Anbieter einen A-Record (und ggf. AAAA) `cduverwaltung` auf die Server-IP setzen.
2. **SSL/TLS-Zertifikate → Let's Encrypt** für die Subdomain ausstellen, „HTTP auf HTTPS umleiten“ aktivieren.
3. Für den Mailversand ein Postfach anlegen (**Mail → E-Mail-Adresse erstellen**), z. B. `verwaltung@kandzior.cc`.

### 7.2 Docker und App (SSH als root)

Docker installieren, falls noch nicht vorhanden (**Erweiterungen → Docker** oder per SSH). Die Container nicht in der
Plesk-Docker-Oberfläche verwalten, sondern per `docker compose`.

```bash
apt install -y git age
git clone https://github.com/kandziormannheim-dot/files.git /opt/ovtool
cd /opt/ovtool/ov-tool
cp .env.example .env && chmod 600 .env
```

In `.env` wie in Abschnitt 2, mit diesen Abweichungen:

| Variable | Wert |
|---|---|
| `APP_URL` | `https://cduverwaltung.kandzior.cc` (bestimmt die Login-Links) |
| `COMPOSE_PROFILES` | `whisper` (ohne Caddy); ohne Audio-Transkription leer lassen |
| `APP_PORT` | `3000`, oder ein freier Port, falls belegt (`ss -ltn \| grep :3000`) – dann auch in der nginx-Anweisung ändern |
| `DB_PORT` | `55432`, damit es keinen Konflikt mit einem PostgreSQL von Plesk gibt (nur auf 127.0.0.1, für Wartung) |
| `SMTP_HOST`, `SMTP_PORT` | Hostname des Plesk-Servers, `587` |
| `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | das Postfach aus 7.1, z. B. `MAIL_FROM="OV-Verwaltung <verwaltung@kandzior.cc>"` |
| `APP_DOMAIN`, `ACME_EMAIL` | nicht nötig (nur für Caddy) |

```bash
docker compose up -d --build
docker compose logs -f app
```

### 7.3 Weiterleitung (Plesk-Oberfläche)

Subdomain → **Apache & nginx-Einstellungen**:

1. **„Proxy-Modus“ deaktivieren** (sonst beantwortet Apache die Anfragen).
2. Inhalt von [`docker/plesk-nginx.conf`](../docker/plesk-nginx.conf) in **„Zusätzliche nginx-Anweisungen“** einfügen
   (bei geändertem `APP_PORT` den Port in `proxy_pass` anpassen) und speichern.

Danach `https://cduverwaltung.kandzior.cc/login` aufrufen, mit `SEED_ADMIN_EMAIL` anmelden und unter
**Einstellungen → Allgemein** Vorsitz, Geschäftsstelle und Fristen prüfen.

### 7.4 Updates und Sicherung

```bash
cd /opt/ovtool && git pull && cd ov-tool && docker compose up -d --build
```

Oder per GitHub-Workflow „OV-Tool deployen“ mit `OVTOOL_PATH=/opt/ovtool` (siehe `.github/workflows/README.md`).
Sicherung wie in Abschnitt 5 (`scripts/backup.sh` per Cron, Pfad `/opt/ovtool/ov-tool`); die Plesk-eigene
Datensicherung erfasst die Docker-Volumes **nicht**.
