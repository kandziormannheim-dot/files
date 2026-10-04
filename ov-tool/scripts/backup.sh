#!/usr/bin/env bash
# Nächtliche Sicherung (SPEC.md 5): pg_dump + Datei-Volume, verschlüsselt (age), mit Kopie außerhalb des Servers.
#
# Aufruf (im Verzeichnis ov-tool/ auf dem Server):  scripts/backup.sh
# Cron (03:15 Uhr):  15 3 * * *  cd /srv/files/ov-tool && scripts/backup.sh >> /var/log/ov-backup.log 2>&1
#
# Einstellungen in .env:
#   BACKUP_DIR=/var/backups/ov-tool       lokales Zielverzeichnis
#   BACKUP_AGE_RECIPIENT=age1...          öffentlicher age-Schlüssel (privater Schlüssel NICHT auf dem Server!)
#   BACKUP_KEEP_DAYS=30                   lokale Aufbewahrung
#   BACKUP_REMOTE=                        z. B. "rclone copy {file} storagebox:ov-backups" ({file} wird ersetzt)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ov-tool}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT fehlt (öffentlicher age-Schlüssel)}"
command -v age >/dev/null || { echo "age ist nicht installiert (apt install age)"; exit 1; }

stamp="$(date +%Y-%m-%d_%H%M)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] Datenbank sichern …"
docker compose exec -T db pg_dump -U ovtool -d ovtool --format=custom --no-owner > "$work/db.dump"

echo "[$(date -Is)] Dateien sichern …"
docker compose run --rm --no-deps --user root -v "$work:/backup" --entrypoint sh app \
  -c 'tar -czf /backup/files.tar.gz -C /data files' >/dev/null

tar -cf "$work/ov-tool-$stamp.tar" -C "$work" db.dump files.tar.gz
age -r "$BACKUP_AGE_RECIPIENT" -o "$BACKUP_DIR/ov-tool-$stamp.tar.age" "$work/ov-tool-$stamp.tar"
echo "[$(date -Is)] Sicherung: $BACKUP_DIR/ov-tool-$stamp.tar.age ($(du -h "$BACKUP_DIR/ov-tool-$stamp.tar.age" | cut -f1))"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  cmd="${BACKUP_REMOTE//\{file\}/$BACKUP_DIR/ov-tool-$stamp.tar.age}"
  echo "[$(date -Is)] Kopie außerhalb des Servers: $cmd"
  eval "$cmd"
fi

find "$BACKUP_DIR" -name 'ov-tool-*.tar.age' -mtime +"$KEEP" -delete
echo "[$(date -Is)] fertig"
