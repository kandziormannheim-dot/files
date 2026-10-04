#!/usr/bin/env bash
# Wiederherstellung aus einer Sicherung von backup.sh. ÜBERSCHREIBT Datenbank und Dateien!
#
# Aufruf: scripts/restore.sh /pfad/ov-tool-2026-10-04_0315.tar.age /pfad/age-schluessel.txt
# Empfehlung: einmal auf einem Testsystem durchspielen (SPEC.md 5: „Wiederherstellung einmal testen“).
set -euo pipefail
cd "$(dirname "$0")/.."
archive="${1:?Sicherungsdatei angeben}"
key="${2:?privaten age-Schlüssel angeben}"

read -r -p "Datenbank und Dateien werden überschrieben. Fortfahren? (ja/nein) " ok
[ "$ok" = "ja" ] || exit 1

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
age -d -i "$key" -o "$work/backup.tar" "$archive"
tar -xf "$work/backup.tar" -C "$work"

docker compose stop app
docker compose exec -T db dropdb -U ovtool --if-exists ovtool
docker compose exec -T db createdb -U ovtool ovtool
docker compose exec -T db pg_restore -U ovtool -d ovtool --no-owner < "$work/db.dump"
docker compose run --rm --no-deps --user root -v "$work:/backup" --entrypoint sh app \
  -c 'rm -rf /data/files/* && tar -xzf /backup/files.tar.gz -C /data'
docker compose up -d app
echo "Wiederhergestellt. Bitte Anmeldung und ein Protokoll-PDF prüfen."
