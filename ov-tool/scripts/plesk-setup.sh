#!/usr/bin/env bash
# Richtet das OV-Tool auf einem Plesk-Server ein (docs/betrieb.md Abschnitt 7). Als root ausführen:
#   curl -fsSL https://raw.githubusercontent.com/kandziormannheim-dot/files/main/ov-tool/scripts/plesk-setup.sh | bash
# Mehrfach ausführbar: vorhandene .env, Subdomain, Postfach und Zertifikat bleiben erhalten; der Code wird aktualisiert.
# Anpassbar über Umgebungsvariablen: OVTOOL_DOMAIN, OVTOOL_SUB, OVTOOL_DIR, OVTOOL_REPO, OVTOOL_REF.
set -euo pipefail

main() {
  local domain="${OVTOOL_DOMAIN:-kandzior.cc}"
  local sub="${OVTOOL_SUB:-cduverwaltung}"
  local fqdn="$sub.$domain"
  local repo_dir="${OVTOOL_DIR:-/opt/ovtool}"
  local repo_url="${OVTOOL_REPO:-https://github.com/kandziormannheim-dot/files.git}"
  local ref="${OVTOOL_REF:-main}"
  local app_dir="$repo_dir/ov-tool"
  local env_file="$app_dir/.env"
  local nginx_file="/root/ovtool-nginx.conf"

  schritt "Voraussetzungen prüfen"
  [ "$(id -u)" -eq 0 ] || fehler "Bitte als root ausführen."
  command -v plesk >/dev/null || fehler "Plesk-Kommandozeile (plesk) nicht gefunden – ist das ein Plesk-Server?"
  command -v curl >/dev/null || apt-get install -y curl >/dev/null
  command -v git >/dev/null || apt-get install -y git >/dev/null
  command -v openssl >/dev/null || apt-get install -y openssl >/dev/null
  command -v ss >/dev/null || apt-get install -y iproute2 >/dev/null
  plesk bin domain --info "$domain" >/dev/null 2>&1 || plesk bin site --info "$domain" >/dev/null 2>&1 \
    || fehler "Domain $domain ist in Plesk nicht angelegt."
  ok "Plesk gefunden, Domain $domain vorhanden"

  # ---------------------------------------------------------------- Eingaben (nur beim ersten Lauf)
  local neu=0 admin_email="" admin_name="" mail_addr="" mail_pass="" smtp_host="" api_key=""
  if [ ! -f "$env_file" ]; then
    neu=1
    schritt "Angaben für die Ersteinrichtung"
    admin_email=$(frage "E-Mail-Adresse des ersten Admins (Login)" "")
    [ -n "$admin_email" ] || fehler "Admin-Adresse fehlt."
    admin_name=$(frage "Name des ersten Admins" "")
    mail_addr=$(frage "Absender-Postfach für Mails der App" "verwaltung@$domain")
    smtp_host=$(frage "SMTP-Server" "$(hostname -f)")
    api_key=$(frage "Claude-API-Schlüssel für Protokollentwürfe (leer = später)" "")
  fi

  # ---------------------------------------------------------------- Docker
  schritt "Docker"
  if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    echo "Docker wird installiert …"
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true
  ok "$(docker --version), $(docker compose version --short 2>/dev/null || echo compose)"

  # ---------------------------------------------------------------- Code
  schritt "Code nach $repo_dir"
  if [ -d "$repo_dir/.git" ]; then
    git -C "$repo_dir" fetch --quiet origin "$ref"
    git -C "$repo_dir" checkout --quiet "$ref"
    git -C "$repo_dir" pull --quiet --ff-only origin "$ref"
  else
    git clone --quiet --branch "$ref" "$repo_url" "$repo_dir"
  fi
  ok "Stand $(git -C "$repo_dir" log -1 --format='%h %s')"

  # ---------------------------------------------------------------- Postfach
  if [ "$neu" -eq 1 ]; then
    schritt "Postfach $mail_addr"
    if plesk bin mail --info "$mail_addr" >/dev/null 2>&1; then
      mail_pass=$(frage_geheim "Passwort des vorhandenen Postfachs $mail_addr")
    elif [ "${mail_addr##*@}" = "$domain" ]; then
      mail_pass="$(openssl rand -hex 16)Aa1-"
      PSA_PASSWORD="$mail_pass" plesk bin mail --create "$mail_addr" -mailbox true -passwd "" >/dev/null \
        || fehler "Postfach konnte nicht angelegt werden – in Plesk anlegen und Skript erneut starten."
      ok "Postfach angelegt (Passwort steht nur in $env_file)"
    else
      mail_pass=$(frage_geheim "Passwort des Postfachs $mail_addr")
    fi
  fi

  # ---------------------------------------------------------------- .env
  schritt "Konfiguration $env_file"
  if [ "$neu" -eq 1 ]; then
    local app_port
    app_port=$(freier_port 3000 3099)
    for v in "$admin_email" "$admin_name" "$mail_addr" "$mail_pass" "$smtp_host" "$api_key"; do
      case "$v" in *"'"*) fehler "Eingaben dürfen kein Hochkomma (') enthalten.";; esac
    done
    umask 077
    cat > "$env_file" <<EOF
# Erzeugt von scripts/plesk-setup.sh am $(date '+%d.%m.%Y %H:%M') – Erläuterungen: .env.example, docs/betrieb.md
COMPOSE_PROFILES=whisper
APP_URL='https://$fqdn'
APP_PORT=$app_port
DB_PORT=55432
POSTGRES_PASSWORD='$(openssl rand -hex 32)'
AUTH_SECRET='$(openssl rand -base64 32)'
ENCRYPTION_KEY='$(openssl rand -base64 32)'
SMTP_HOST='$smtp_host'
SMTP_PORT=587
SMTP_USER='$mail_addr'
SMTP_PASSWORD='$mail_pass'
MAIL_FROM='OV-Verwaltung <$mail_addr>'
ANTHROPIC_API_KEY='$api_key'
ANTHROPIC_MODEL=
WHISPER_MODEL=small
SEED_ADMIN_EMAIL='$admin_email'
SEED_ADMIN_NAME='$admin_name'
SEED_ADMIN_FUNCTION=
JOBS_ENABLED=true
BACKUP_DIR=/var/backups/ov-tool
BACKUP_AGE_RECIPIENT=
BACKUP_KEEP_DAYS=30
BACKUP_REMOTE=
EOF
    umask 022
    ok "angelegt (App-Port $app_port). ENCRYPTION_KEY zusätzlich sicher aufbewahren!"
  else
    ok "vorhanden – bleibt unverändert"
  fi
  local port
  port=$(sed -n 's/^APP_PORT=//p' "$env_file" | tr -d "'\"")
  port=${port:-3000}

  # ---------------------------------------------------------------- Subdomain
  schritt "Subdomain $fqdn"
  if plesk bin subdomain --info "$sub" -domain "$domain" >/dev/null 2>&1 || plesk bin site --info "$fqdn" >/dev/null 2>&1; then
    ok "vorhanden"
  else
    plesk bin subdomain --create "$sub" -domain "$domain" -www-root "/$fqdn" >/dev/null
    ok "angelegt"
  fi
  local ziel_ip server_ips
  ziel_ip=$(getent ahostsv4 "$fqdn" | awk 'NR==1{print $1}' || true)
  server_ips=" $(hostname -I) "
  if [ -z "$ziel_ip" ] || [[ "$server_ips" != *" $ziel_ip "* ]]; then
    warnung "$fqdn zeigt (noch) nicht auf diesen Server (DNS: ${ziel_ip:-kein Eintrag}, Server: $(hostname -I))."
    warnung "Liegt das DNS nicht bei Plesk: A-Record '$sub' auf die Server-IP setzen. Zertifikat wird erst danach klappen."
  fi

  # ---------------------------------------------------------------- Zertifikat
  schritt "Let's-Encrypt-Zertifikat"
  local acme_mail
  acme_mail=$(sed -n 's/^SEED_ADMIN_EMAIL=//p' "$env_file" | tr -d "'\"")
  if curl -s -o /dev/null --max-time 10 "https://$fqdn"; then
    ok "gültiges Zertifikat vorhanden"
  elif plesk bin extension --list 2>/dev/null | grep -qi letsencrypt; then
    if plesk bin extension --exec letsencrypt cli.php -d "$fqdn" -m "$acme_mail"; then
      ok "Zertifikat ausgestellt"
    else
      warnung "Zertifikat fehlgeschlagen (meist DNS). Später in Plesk: SSL/TLS-Zertifikate → Let's Encrypt."
    fi
  else
    warnung "Let's-Encrypt-Erweiterung fehlt – in Plesk unter Erweiterungen installieren."
  fi
  plesk bin site --update "$fqdn" -ssl-redirect true >/dev/null 2>&1 \
    || plesk bin subdomain --update "$sub" -domain "$domain" -ssl-redirect true >/dev/null 2>&1 \
    || warnung "HTTPS-Umleitung bitte in Plesk aktivieren (Hosting-Einstellungen)."

  # ---------------------------------------------------------------- nginx
  schritt "Weiterleitung nginx → 127.0.0.1:$port"
  sed "s#http://127.0.0.1:3000#http://127.0.0.1:$port#" "$app_dir/docker/plesk-nginx.conf" > "$nginx_file"
  if plesk bin site --update-web-server-settings "$fqdn" -nginx-proxy-mode false -additional-nginx-settings-file "$nginx_file" >/dev/null 2>&1 \
    || plesk bin subdomain --update-web-server-settings "$sub" -domain "$domain" -nginx-proxy-mode false -additional-nginx-settings-file "$nginx_file" >/dev/null 2>&1 \
    || plesk bin domain --update-web-server-settings "$fqdn" -nginx-proxy-mode false -additional-nginx-settings-file "$nginx_file" >/dev/null 2>&1; then
    ok "Proxy-Modus aus, Anweisungen eingetragen"
  else
    warnung "Automatisch nicht möglich. In Plesk: $fqdn → Apache & nginx-Einstellungen → „Proxy-Modus“ aus,"
    warnung "Inhalt von $nginx_file in „Zusätzliche nginx-Anweisungen“ einfügen."
  fi

  # ---------------------------------------------------------------- Container
  schritt "Container bauen und starten (erster Build dauert einige Minuten)"
  cd "$app_dir"
  docker compose up -d --build
  echo -n "Warte auf die App "
  local bereit=0
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then bereit=1; break; fi
    echo -n "."; sleep 5
  done
  echo
  if [ "$bereit" -ne 1 ]; then
    docker compose logs --tail 60 app
    fehler "Die App antwortet nicht. Ausgabe oben bzw. 'cd $app_dir && docker compose logs app' an Claude schicken."
  fi
  ok "App läuft auf 127.0.0.1:$port"
  if curl -fsS --max-time 10 "https://$fqdn/api/health" >/dev/null 2>&1; then
    ok "https://$fqdn ist erreichbar"
  else
    warnung "https://$fqdn antwortet noch nicht (Zertifikat/DNS/nginx prüfen, siehe Warnungen oben)."
  fi

  schritt "Fertig"
  echo "  Anmelden:     https://$fqdn/login  (mit $acme_mail)"
  echo "  Danach:       Einstellungen → Allgemein prüfen"
  echo "  Updates:      dieses Skript erneut ausführen"
  echo "  Logs:         cd $app_dir && docker compose logs -f app"
  echo "  Keine Login-Mail? cd $app_dir && docker compose logs app | grep -i mail  (SMTP-Werte in .env prüfen)"
  echo "  Sicherung:    docs/betrieb.md Abschnitt 5 (Plesk-Backup erfasst die Docker-Daten nicht)"
}

schritt() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok() { printf '    \033[32m✓\033[0m %s\n' "$1"; }
warnung() { printf '    \033[33m!\033[0m %s\n' "$1"; }
fehler() { printf '\n\033[31mFehler:\033[0m %s\n' "$1" >&2; exit 1; }

# Eingaben von /dev/tty lesen, damit das Skript auch per „curl … | bash“ fragen kann (OVTOOL_TTY nur für Tests).
TTY="${OVTOOL_TTY:-/dev/tty}"
frage() {
  local antwort
  if [ -n "$2" ]; then printf '    %s [%s]: ' "$1" "$2" >&2; else printf '    %s: ' "$1" >&2; fi
  read -r antwort <&3
  echo "${antwort:-$2}"
}
frage_geheim() {
  local antwort
  printf '    %s: ' "$1" >&2
  read -rs antwort <&3
  echo >&2
  echo "$antwort"
}
freier_port() {
  local p
  for p in $(seq "$1" "$2"); do
    if [ -z "$(ss -ltnH "sport = :$p")" ]; then echo "$p"; return; fi
  done
  fehler "Kein freier Port zwischen $1 und $2."
}

exec 3<"$TTY"
main "$@"
