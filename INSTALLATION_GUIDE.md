# Installation & Setup Guide - Complete System

> **Komplettes Installations-Guide für das Affiliate Business Automation System**

## 📋 Überblick der neuen Dateien

Nach dem Master Script werden diese unterstützenden Dateien hinzugefügt:

### 1. **requirements.txt** - Python Dependencies
Enthält alle Python-Pakete die du brauchst.

### 2. **.env.template** - Environment Variables
Template für alle API Keys und Credentials - MUSS mit deinen echten Werten gefüllt werden!

### 3. **setup.sh** - Automatisiertes Setup Skript
Bash-Skript für automatische Installation aller Dependencies.

### 4. **database_schema.sql** - PostgreSQL Database
Komplette Database-Schema für Affiliate-Tracking.

### 5. **health_check.py** - System Monitoring
Prüft Gesundheit aller Komponenten (WordPress, n8n, Database, APIs).

### 6. **backup_manager.py** - Backup Management
Verwaltet Backups für WordPress, n8n und Datenbank.

### 7. **wordpress_plugin_config.json** - WordPress Config
Konfiguration für alle WordPress Plugins und Themes.

### 8. **docker-compose.yml** - Optional Docker Setup
Vollständige Docker-Umgebung als Alternative zu manueller Installation.

---

## 🚀 Installation in 3 Varianten

### VARIANTE A: Vollständig Automatisiert (Empfohlen)

```bash
# 1. Clone oder lade alles herunter
cd affiliate-automation

# 2. Starte automatisches Setup
bash setup.sh

# 3. Bearbeite Environment Variables
nano .env
# Fülle alle API Keys ein

# 4. Bearbeite Konfiguration
nano affiliate_business_config.yml
# Fülle deine Domains, Server IPs ein

# 5. Generiere Setup Plan
python3 affiliate_automation_master.py

# 6. Folge den generierten Anweisungen
```

**Dauer**: ~15 Minuten + Wartezeit für Account-Bestätigungen
**Schwierigkeit**: Einfach (mostly automated)

---

### VARIANTE B: Docker-Basiert (Modern, Isolated)

```bash
# 1. Docker & Docker Compose installieren
# Siehe: https://docs.docker.com/get-docker/

# 2. Environment vorbereiten
cp .env.template .env
nano .env  # Bearbeite API Keys

# 3. Starte alle Services
docker-compose up -d

# 4. Warte bis alle Services healthy sind
docker-compose ps

# 5. Zugriff auf Services
# WordPress AI:        http://localhost:8001
# WordPress Freelancer: http://localhost:8002
# WordPress Gaming:    http://localhost:8003
# n8n:                 http://localhost:5678
# pgAdmin:             http://localhost:5050

# 6. Health Check ausführen
docker-compose exec app python3 health_check.py --check all
```

**Vorteil**: 
- Alles läuft isoliert in Containern
- Einfach zu deployen auf Linux-Servern
- Automatische Skalierung möglich

**Nachteile**:
- Braucht Docker Installation
- Weniger direct Server-Zugriff

---

### VARIANTE C: Manuell (für Full Control)

```bash
# 1. Python Dependencies installieren
pip install -r requirements.txt

# 2. Environment Setup
cp .env.template .env
nano .env  # Bearbeite API Keys

# 3. VPS manuell provisionieren
# - Linode/Hetzner Server mieten
# - Ubuntu 24.04 installieren
# - SSH Access konfigurieren

# 4. Plesk manuell installieren (siehe QUICKSTART_GUIDE.md)

# 5. WordPress manuell installieren

# 6. n8n manuell installieren

# 7. Starte Master Script
python3 affiliate_automation_master.py
```

**Dauer**: ~7-10 Tage
**Schwierigkeit**: Schwierig (viel manuell)

---

## 📦 Detaillierte Installationsschritte

### Schritt 1: Repository vorbereiten

```bash
# Lade alle Dateien herunter in ein Verzeichnis
mkdir affiliate-automation
cd affiliate-automation

# Stelle sicher, dass diese Dateien vorhanden sind:
ls -la
# affiliate_automation_master.py       ✓
# n8n_workflow_manager.py              ✓
# affiliate_business_config.yml        ✓
# AffiliateAutomationDashboard.jsx     ✓
# QUICKSTART_GUIDE.md                  ✓
# README.md                            ✓
# requirements.txt                     ✓ (NEU)
# .env.template                        ✓ (NEU)
# setup.sh                             ✓ (NEU)
# database_schema.sql                  ✓ (NEU)
# health_check.py                      ✓ (NEU)
# backup_manager.py                    ✓ (NEU)
# wordpress_plugin_config.json         ✓ (NEU)
# docker-compose.yml                   ✓ (NEU)
```

### Schritt 2: Setup Script ausführen

```bash
# Mache setup.sh ausführbar
chmod +x setup.sh

# Führe aus (als root für systemd services)
sudo bash setup.sh

# Oder ohne root (nur Python venv)
bash setup.sh

# Automatisch:
# ✓ Virtuelle Python-Umgebung erstellt
# ✓ Dependencies installiert
# ✓ .env aus Template kopiert
# ✓ Verzeichnisse erstellt
# ✓ Log-Dateien eingerichtet
```

### Schritt 3: Environment Variables konfigurieren

```bash
# Bearbeite .env
nano .env

# Fülle folgende KRITISCHE Werte ein:
OPENCLAW_API_KEY=xxx
N8N_API_KEY=xxx
OPENAI_API_KEY=xxx
AWIN_API_KEY=xxx
DATABASE_PASSWORD=strong_password
PLESK_PASSWORD=strong_password
WORDPRESS_ADMIN_PASSWORD=strong_password
GMAIL_APP_PASSWORD=xxx
CLOUDFLARE_API_KEY=xxx
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

**Wichtig**: 
- NIEMALS .env in Git/GitHub committen!
- Nur auf deinem lokalen System speichern
- API Keys sind vertraulich!

### Schritt 4: System-Konfiguration

```bash
# Bearbeite affiliate_business_config.yml
nano affiliate_business_config.yml

# Wichtigste Anpassungen:
niches:
  - domain: deine-domain-1.com      # ← Ändere!
    email: admin@deine-domain-1.com # ← Ändere!
    niche: ai_tools
  [...]

server:
  ip: deine.server.ip.hier           # ← Ändere!
  provider: linode  # oder hetzner

plesk:
  password: from_your_.env            # ← Ändere!

email:
  domain: deine-domain.com            # ← Ändere!
  smtp_user: deine-email@gmail.com   # ← Ändere!
```

### Schritt 5: Database einrichten

#### Option A: PostgreSQL lokal

```bash
# Installiere PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Starte PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Stelle Verbindung her
sudo -u postgres psql

# In psql:
CREATE DATABASE affiliate_db;
CREATE USER affiliate_user WITH PASSWORD 'dein_password';
GRANT ALL PRIVILEGES ON DATABASE affiliate_db TO affiliate_user;

# Exit
\q

# Laden Schema
psql -U affiliate_user -d affiliate_db -f database_schema.sql
```

#### Option B: Docker PostgreSQL

```bash
# Starte nur Postgres via Docker
docker-compose up -d postgres

# Warte bis healthy
docker-compose ps

# Lade Schema
docker-compose exec postgres psql -U affiliate_user -d affiliate_db -f /docker-entrypoint-initdb.d/schema.sql
```

#### Option C: Managed Database (Kinsta, PlanetScale)

Für gehostete Datenbank:
1. Gehe zu deinem Hosting-Anbieter
2. Erstelle neue PostgreSQL Datenbank
3. Notiere Connection Details
4. Trage in .env ein:
```
DATABASE_HOST=hosted-db.host.com
DATABASE_PORT=5432
DATABASE_USER=dein_user
DATABASE_PASSWORD=dein_pass
```

### Schritt 6: Health Check ausführen

```bash
# Aktiviere Virtual Environment
source venv/bin/activate

# Führe Health Check aus
python3 health_check.py --check all

# Output sollte zeigen:
# ✓ Healthy: 5
# ⚠ Warnings: 2
# ✗ Critical: 0
```

**Wenn Critical Issues**: Siehe Troubleshooting unten

### Schritt 7: Master Script ausführen

```bash
# Aktiviere venv
source venv/bin/activate

# Führe Master Setup aus
python3 affiliate_automation_master.py

# Output: setup_results.json mit kompletten Anweisungen
# Speichert auch Logs in logs/setup.log
```

### Schritt 8: n8n Workflows importieren

```bash
# Warte bis n8n läuft (check health_check.py)

# Importiere Workflows
python3 n8n_workflow_manager.py \
  --url https://n8n.yourdomain.com \
  --api-key YOUR_API_KEY \
  --action import-all

# Bestätige import successful
python3 n8n_workflow_manager.py --action list-workflows
```

### Schritt 9: Backups konfigurieren

```bash
# Test Backup erstellen
python3 backup_manager.py --action full

# Überprüfe Backup
ls -lh backups/

# Für S3 Upload:
python3 backup_manager.py --action full --s3
```

### Schritt 10: Dashboard testen

```bash
# Dashboard ist in AffiliateAutomationDashboard.jsx
# Integriere in React App oder:
# Öffne START_HERE.html im Browser für Übersicht
```

---

## 🔍 Health Check Commands

```bash
# Check all systems
python3 health_check.py --check all

# Check specific component
python3 health_check.py --check wordpress
python3 health_check.py --check n8n
python3 health_check.py --check database
python3 health_check.py --check api

# Generiere JSON Report
python3 health_check.py --report
```

---

## 💾 Backup Commands

```bash
# Vollständiges Backup
python3 backup_manager.py --action full

# Nur WordPress
python3 backup_manager.py --action wordpress --domain ai-tools-guide.com

# Nur Database
python3 backup_manager.py --action database

# Nur n8n
python3 backup_manager.py --action n8n

# Liste alle Backups
python3 backup_manager.py --action list

# Restore Backup
python3 backup_manager.py --action restore --file backups/wordpress_ai-tools-guide.com_20250210_120000.tar.gz

# Alte Backups löschen (älter als 90 Tage)
python3 backup_manager.py --action cleanup --days 90

# Mit S3 Upload
python3 backup_manager.py --action full --s3
```

---

## 🐛 Troubleshooting

### Problem: "Python dependencies not found"

**Lösung**:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Problem: "Database connection failed"

**Lösung**:
```bash
# Überprüfe Credentials in .env
cat .env | grep DATABASE

# Überprüfe wenn PostgreSQL läuft
psql -U affiliate_user -d affiliate_db -c "SELECT version();"

# Starte Docker Postgres neu
docker-compose down postgres
docker-compose up -d postgres
docker-compose logs postgres
```

### Problem: "n8n API key invalid"

**Lösung**:
```bash
# Generiere neue API Key in n8n
# 1. Öffne n8n Dashboard
# 2. Settings → API Keys
# 3. Create new key
# 4. Trage in .env ein
# 5. Update workflow manager

python3 n8n_workflow_manager.py \
  --api-key NEW_KEY \
  --action test-all
```

### Problem: "Workflows not running"

**Lösung**:
```bash
# Check workflow status
python3 n8n_workflow_manager.py --action get-status

# Aktiviere alle Workflows
python3 n8n_workflow_manager.py --action activate-all

# Check logs
docker-compose logs n8n
```

### Problem: "WordPress REST API not accessible"

**Lösung**:
```bash
# Check SSL Certificate
curl -I https://ai-tools-guide.com/wp-json/

# Test REST API
curl -H "Authorization: Bearer TOKEN" \
  https://ai-tools-guide.com/wp-json/wp/v2/posts

# Check Wordfence Firewall Settings
# Might be blocking API calls
```

---

## 📊 Empfohlene Automatisierungen

Nach erfolgreichem Setup, aktiviere diese Cronjobs:

```bash
# Daily Health Check (6 AM)
0 6 * * * cd /path/to/affiliate-automation && python3 health_check.py --check all

# Daily Backup (2 AM)
0 2 * * * cd /path/to/affiliate-automation && python3 backup_manager.py --action full

# Weekly Backup Cleanup (Sunday 3 AM)
0 3 * * 0 cd /path/to/affiliate-automation && python3 backup_manager.py --action cleanup

# Monitor Workflows (Every 6 hours)
0 */6 * * * cd /path/to/affiliate-automation && python3 n8n_workflow_manager.py --action get-status
```

---

## ✅ Checkliste nach Installation

- [ ] setup.sh erfolgreich ausgeführt
- [ ] .env mit echten Werten gefüllt
- [ ] affiliate_business_config.yml angepasst
- [ ] PostgreSQL Database erstellt
- [ ] Health Check zeigt "healthy" Status
- [ ] WordPress Seiten erreichbar
- [ ] n8n Workflows importiert
- [ ] Erste Backups erstellt
- [ ] S3 Uploads funktionieren (optional)
- [ ] Email-Notifikationen konfiguriert
- [ ] Cronjobs eingerichtet

---

## 📞 Support bei Problemen

1. **Setup Fehler**: Siehe Troubleshooting oben
2. **Database Issues**: Check database_schema.sql Dokumentation
3. **n8n Problems**: Visit n8n.io/docs
4. **WordPress Issues**: Check WordPress Support
5. **Backup Issues**: Review backup_manager.py Logs

---

## 🎯 Nächste Schritte nach Installation

1. ✅ Installation abgeschlossen
2. → QUICKSTART_GUIDE.md für Day 1-10 Plan folgen
3. → Erste Content manuell mit OpenClaw generieren
4. → Erste Workflows testen
5. → Social Media Accounts aktivieren
6. → Affiliate Programme registrieren
7. → Dashboard monitoren und optimieren

---

**Glückwunsch! Dein System ist installiert! 🎉**

Folge nun dem QUICKSTART_GUIDE.md für die nächsten Schritte.

