#!/usr/bin/env bash
#
# vault-sync.sh — die Obsidian-Vault auf dem Server aktuell halten.
#
# Gegenstück zu Vault-Sync.ps1 auf dem Windows-Rechner. Dort hält eine geplante
# Aufgabe die Vault mit dem privaten GitHub-Repository im Takt, hier tut das ein
# systemd-Timer (ersatzweise ein Cron-Eintrag). Dazwischen liegt GitHub; einen
# direkten Draht zwischen Laptop und Server gibt es nicht:
#
#     Windows  <->  GitHub (privat)  <->  Server mit OpenClaw
#
# Unterbefehle:
#   einrichten   Schlüssel, Klon, Zeitplan — einmalig
#   abgleich     ein Durchlauf; das ist, was der Timer aufruft
#   pruefen      Zustand anzeigen, ändert nichts
#   entfernen    Zeitplan abbauen; die Vault bleibt liegen
#
# Beispiele:
#   ./vault-sync.sh einrichten --workspace ~/.openclaw/workspace
#   ./vault-sync.sh pruefen
#   ./vault-sync.sh abgleich --leise

set -uo pipefail

# ------------------------------------------------------------------ Vorgaben
VAULT="${OBSIDIAN_VAULT:-$HOME/obsidian-vault}"
REMOTE="${OBSIDIAN_REMOTE:-git@github.com:kandziormannheim-dot/obsidian-vault.git}"
ZWEIG="${OBSIDIAN_ZWEIG:-main}"
INTERVALL="${OBSIDIAN_INTERVALL:-15}"
SCHLUESSEL="${OBSIDIAN_SCHLUESSEL:-$HOME/.ssh/obsidian-vault}"
WORKSPACE="${OBSIDIAN_WORKSPACE:-}"
GIT_NAME="${OBSIDIAN_GIT_NAME:-OpenClaw}"
GIT_MAIL="${OBSIDIAN_GIT_MAIL:-openclaw@$(hostname -s 2>/dev/null || echo server)}"
LEISE=0

STATUSDIR="${XDG_STATE_HOME:-$HOME/.local/state}/obsidian-vault-sync"
LOG="$STATUSDIR/sync.log"
SPERRE="$STATUSDIR/sync.lock"
SELBST="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

# Kandidaten, unter denen OpenClaw sein Arbeitsverzeichnis haben kann. Trifft
# keiner zu, bleibt die Verknüpfung einfach aus — --workspace setzt sie gezielt.
WORKSPACE_KANDIDATEN=(
    "$HOME/.openclaw/workspace"
    "$HOME/openclaw/workspace"
    "/opt/openclaw/workspace"
    "/srv/openclaw/workspace"
)

BEFEHL="${1:-abgleich}"
[ $# -gt 0 ] && shift

while [ $# -gt 0 ]; do
    case "$1" in
        --vault)      VAULT="$2"; shift 2 ;;
        --remote)     REMOTE="$2"; shift 2 ;;
        --zweig)      ZWEIG="$2"; shift 2 ;;
        --intervall)  INTERVALL="$2"; shift 2 ;;
        --schluessel) SCHLUESSEL="$2"; shift 2 ;;
        --workspace)  WORKSPACE="$2"; shift 2 ;;
        --leise)      LEISE=1; shift ;;
        *)            echo "Unbekannte Angabe: $1" >&2; exit 2 ;;
    esac
done

mkdir -p "$STATUSDIR"
# Protokoll bei 1 MB einmal wegrollen, damit es nicht unbegrenzt wächst.
if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 1048576 ]; then
    mv -f "$LOG" "$LOG.alt" 2>/dev/null || true
fi

schreibe() {
    local text="$1" stufe="${2:-INFO}"
    local zeile
    zeile="$(printf '%s  %-7s %s' "$(date '+%d.%m.%Y %H:%M:%S')" "$stufe" "$text")"
    printf '%s\n' "$zeile" >>"$LOG"
    [ "$LEISE" -eq 1 ] || printf '%s\n' "$zeile"
}

# Der eigene Schlüssel statt der Standard-Identität: so hängt der Abgleich
# nicht davon ab, was sonst noch in ~/.ssh liegt, und ein Agent ohne
# Passphrase-Eingabe stört ihn nicht.
if [ -f "$SCHLUESSEL" ]; then
    export GIT_SSH_COMMAND="ssh -i $SCHLUESSEL -o IdentitiesOnly=yes -o BatchMode=yes"
fi

git_auf() { git -C "$VAULT" "$@" 2>&1; }

fehlt() { ! command -v "$1" >/dev/null 2>&1; }

# ------------------------------------------------------------------ einrichten
tu_einrichten() {
    if fehlt git; then
        schreibe 'Git ist nicht installiert (apt install git).' 'FEHLER'; exit 2
    fi
    if fehlt ssh-keygen; then
        schreibe 'OpenSSH fehlt (apt install openssh-client).' 'FEHLER'; exit 2
    fi

    # 1. Schlüssel
    if [ ! -f "$SCHLUESSEL" ]; then
        mkdir -p "$(dirname "$SCHLUESSEL")"; chmod 700 "$(dirname "$SCHLUESSEL")"
        ssh-keygen -t ed25519 -N '' -C "obsidian-vault@$(hostname -s 2>/dev/null || echo server)" \
            -f "$SCHLUESSEL" >/dev/null || { schreibe 'Schlüssel ließ sich nicht anlegen.' 'FEHLER'; exit 2; }
        schreibe "Schlüssel angelegt: $SCHLUESSEL"
    else
        schreibe "Schlüssel vorhanden: $SCHLUESSEL"
    fi
    export GIT_SSH_COMMAND="ssh -i $SCHLUESSEL -o IdentitiesOnly=yes -o BatchMode=yes"

    # 2. Zugang prüfen — vor dem Klonen, sonst steht man mit halbem Ergebnis da
    if ! ssh -i "$SCHLUESSEL" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
            -T git@github.com 2>&1 | grep -q 'successfully authenticated'; then
        echo
        echo "  Der Server darf noch nicht an das Repository. Einmalig eintragen:"
        echo
        echo "  1. Diesen öffentlichen Schlüssel kopieren:"
        echo
        sed 's/^/     /' "$SCHLUESSEL.pub"
        echo
        echo "  2. Auf GitHub öffnen: Repository -> Settings -> Deploy keys -> Add deploy key"
        echo "     Titel frei, Schlüssel einfügen, und -- wichtig --"
        echo "     \"Allow write access\" ankreuzen. Ohne das kann der Server nur lesen."
        echo
        echo "  3. Danach diesen Befehl erneut aufrufen."
        echo
        schreibe 'Deploy-Key noch nicht hinterlegt — Einrichtung angehalten.' 'WARNUNG'
        exit 7
    fi
    schreibe 'Zugang zu GitHub steht.'

    # 3. Klon oder vorhandene Vault verkabeln
    if [ ! -d "$VAULT/.git" ]; then
        if [ -d "$VAULT" ] && [ -n "$(ls -A "$VAULT" 2>/dev/null)" ]; then
            schreibe "$VAULT ist nicht leer und kein Repository — bitte klären." 'FEHLER'; exit 2
        fi
        mkdir -p "$(dirname "$VAULT")"
        if ! git clone "$REMOTE" "$VAULT" 2>&1 | sed 's/^/         /'; then
            schreibe 'Klonen fehlgeschlagen.' 'FEHLER'; exit 2
        fi
        schreibe "Vault geklont nach $VAULT"
    else
        if git -C "$VAULT" remote get-url origin >/dev/null 2>&1; then
            git_auf remote set-url origin "$REMOTE" >/dev/null
        else
            git_auf remote add origin "$REMOTE" >/dev/null
        fi
        schreibe "Vorhandene Vault unter $VAULT auf $REMOTE gesetzt."
    fi

    ZWEIG="$(git_auf rev-parse --abbrev-ref HEAD)"
    git_auf config user.name "$GIT_NAME" >/dev/null
    git_auf config user.email "$GIT_MAIL" >/dev/null
    # Ohne Konfiguration verweigert Git neuerer Fassungen "pull" die Auskunft.
    git_auf config pull.rebase true >/dev/null
    schreibe "Zweig $ZWEIG, Änderungen vom Server zeichnen als $GIT_NAME <$GIT_MAIL>."

    # 4. Verknüpfung in das Arbeitsverzeichnis von OpenClaw
    if [ -z "$WORKSPACE" ]; then
        for k in "${WORKSPACE_KANDIDATEN[@]}"; do
            [ -d "$k" ] && { WORKSPACE="$k"; break; }
        done
    fi
    if [ -n "$WORKSPACE" ] && [ -d "$WORKSPACE" ]; then
        local ziel="$WORKSPACE/obsidian"
        if [ -L "$ziel" ]; then
            ln -sfn "$VAULT" "$ziel"; schreibe "Verknüpfung erneuert: $ziel -> $VAULT"
        elif [ -e "$ziel" ]; then
            schreibe "$ziel gibt es schon und ist keine Verknüpfung — unangetastet gelassen." 'WARNUNG'
        else
            ln -s "$VAULT" "$ziel"; schreibe "Verknüpft: $ziel -> $VAULT"
        fi
    else
        schreibe 'Kein Arbeitsverzeichnis von OpenClaw gefunden — mit --workspace nachreichen.' 'WARNUNG'
    fi

    # 5. Zeitplan
    zeitplan_einrichten

    # 6. Ein erster Durchlauf, damit der Erfolg gleich sichtbar ist
    echo
    tu_abgleich
}

zeitplan_einrichten() {
    if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
        local dir="$HOME/.config/systemd/user"
        mkdir -p "$dir"
        cat > "$dir/obsidian-vault-sync.service" <<UNIT
[Unit]
Description=Obsidian-Vault mit GitHub abgleichen
After=network-online.target

[Service]
Type=oneshot
ExecStart=$SELBST abgleich --vault $VAULT --zweig $ZWEIG --schluessel $SCHLUESSEL --leise
UNIT
        cat > "$dir/obsidian-vault-sync.timer" <<TIMER
[Unit]
Description=Obsidian-Vault alle $INTERVALL Minuten abgleichen

[Timer]
OnBootSec=2min
OnUnitActiveSec=${INTERVALL}min
Persistent=true

[Install]
WantedBy=timers.target
TIMER
        systemctl --user daemon-reload
        systemctl --user enable --now obsidian-vault-sync.timer >/dev/null 2>&1
        # Ohne "lingering" laufen Nutzer-Timer nur, solange jemand angemeldet ist.
        if command -v loginctl >/dev/null 2>&1; then
            loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || \
                schreibe 'loginctl enable-linger ging nicht — Timer ruht ohne Anmeldung.' 'WARNUNG'
        fi
        schreibe "Timer eingerichtet: alle $INTERVALL Minuten (systemctl --user list-timers)."
    elif command -v crontab >/dev/null 2>&1; then
        local zeile="*/$INTERVALL * * * * $SELBST abgleich --vault $VAULT --zweig $ZWEIG --schluessel $SCHLUESSEL --leise"
        ( crontab -l 2>/dev/null | grep -v 'vault-sync.sh abgleich'; echo "$zeile" ) | crontab -
        schreibe "Cron-Eintrag gesetzt: alle $INTERVALL Minuten."
    else
        schreibe 'Weder systemd noch cron gefunden — Zeitplan bitte von Hand anlegen.' 'WARNUNG'
    fi
}

# -------------------------------------------------------------------- abgleich
tu_abgleich() {
    [ -d "$VAULT" ]      || { schreibe "Vault-Ordner nicht gefunden: $VAULT" 'FEHLER'; exit 2; }
    fehlt git            && { schreibe 'Git ist nicht im PATH.' 'FEHLER'; exit 2; }
    [ -d "$VAULT/.git" ] || { schreibe "Kein Repository unter $VAULT — erst \"einrichten\" laufen lassen." 'FEHLER'; exit 2; }

    # Zwei Läufe gleichzeitig wären ein Rebase auf einen Rebase. Der zweite
    # geht kommentarlos wieder, der Timer holt ihn in Kürze nach.
    exec 9>"$SPERRE"
    if command -v flock >/dev/null 2>&1 && ! flock -n 9; then
        exit 0
    fi

    # Ein hängengebliebener Rebase aus einem früheren Lauf: nicht blind
    # daraufsetzen, sondern melden und aussteigen.
    for marker in rebase-merge rebase-apply MERGE_HEAD; do
        if [ -e "$VAULT/.git/$marker" ]; then
            schreibe "Unaufgelöster Zustand im Repository (.git/$marker). Bitte von Hand klären." 'FEHLER'
            exit 3
        fi
    done

    ZWEIG="$(git_auf rev-parse --abbrev-ref HEAD)"
    [ -n "$ZWEIG" ] && [ "$ZWEIG" != HEAD ] || { schreibe 'Kein benannter Zweig ausgecheckt.' 'FEHLER'; exit 2; }

    # ---- Einchecken
    git_auf add -A >/dev/null
    if ! git -C "$VAULT" diff --cached --quiet; then
        local anzahl nachricht
        anzahl="$(git_auf diff --cached --name-only | grep -c . )"
        nachricht="$(printf 'Obsidian-Abgleich %s (%s) — %s Datei(en)' \
            "$(date '+%Y-%m-%d %H:%M')" "$(hostname -s 2>/dev/null || echo server)" "$anzahl")"
        if ! git_auf commit -m "$nachricht" >/dev/null; then
            schreibe 'Commit fehlgeschlagen.' 'FEHLER'; exit 4
        fi
        schreibe "Eingecheckt: $anzahl Datei(en)."
    else
        schreibe 'Nichts zu tun — keine Änderungen.'
    fi

    # ---- Abgleich
    local remote=''
    if git -C "$VAULT" remote get-url origin >/dev/null 2>&1; then
        remote="$(git -C "$VAULT" remote get-url origin)"
    else
        schreibe 'Kein Remote gesetzt — nur lokale Historie. Fertig.'
        exit 0
    fi

    local ausgabe=''
    local geholt=0
    for warte in 0 2 4 8 16; do
        [ "$warte" -gt 0 ] && sleep "$warte"
        if ausgabe="$(git_auf fetch origin "$ZWEIG")"; then geholt=1; break; fi
        schreibe "Fetch fehlgeschlagen, neuer Versuch in $warte s." 'WARNUNG'
    done
    if [ "$geholt" -ne 1 ]; then
        schreibe "Remote nicht erreichbar: $ausgabe" 'WARNUNG'
        schreibe 'Lokal ist alles eingecheckt — der nächste Lauf holt den Push nach.'
        exit 0
    fi

    if ! ausgabe="$(git_auf pull --rebase --autostash origin "$ZWEIG")"; then
        git_auf rebase --abort >/dev/null 2>&1
        schreibe 'Konflikt beim Zusammenführen — Rebase abgebrochen, lokaler Stand unverändert.' 'FEHLER'
        schreibe "$ausgabe" 'FEHLER'
        schreibe "Von Hand auflösen: git -C \"$VAULT\" pull --rebase origin $ZWEIG" 'FEHLER'
        exit 3
    fi

    local gepusht=0
    for warte in 0 2 4 8 16; do
        [ "$warte" -gt 0 ] && sleep "$warte"
        if ausgabe="$(git_auf push origin "$ZWEIG")"; then gepusht=1; break; fi
        schreibe "Push fehlgeschlagen, neuer Versuch in $warte s." 'WARNUNG'
    done
    if [ "$gepusht" -ne 1 ]; then
        schreibe "Push endgültig fehlgeschlagen: $ausgabe" 'FEHLER'
        exit 5
    fi

    schreibe "Abgeglichen mit $remote (Zweig $ZWEIG)."
    exit 0
}

# --------------------------------------------------------------------- pruefen
tu_pruefen() {
    echo
    echo "  Obsidian-Vault auf diesem Server"
    echo "  ================================"
    echo
    printf '  Ordner:  %s' "$VAULT"
    if [ -d "$VAULT/.git" ]; then echo '  [OK]'; else echo '  [FEHLT]'; echo; echo "  Erst \"$SELBST einrichten\" laufen lassen."; echo; return 1; fi

    ZWEIG="$(git_auf rev-parse --abbrev-ref HEAD)"
    local anzahl; anzahl="$(find "$VAULT" -name '*.md' -not -path '*/.git/*' 2>/dev/null | grep -c .)"
    echo "  Notizen: $anzahl Markdown-Dateien"
    echo "  Remote:  $(git -C "$VAULT" remote get-url origin 2>/dev/null || echo 'keiner gesetzt')"
    echo "  Zweig:   $ZWEIG"
    echo "  Zuletzt: $(git_auf log -1 --format='%cd — %s' --date=format:'%d.%m.%Y %H:%M')"

    local offen; offen="$(git_auf status --porcelain | grep -c .)"
    if [ "$offen" -gt 0 ]; then
        echo "  Offen:   $offen Änderung(en), noch nicht eingecheckt"
    else
        echo "  Offen:   nichts — alles eingecheckt"
    fi

    if git_auf fetch origin "$ZWEIG" >/dev/null 2>&1; then
        local stand; stand="$(git_auf rev-list --left-right --count "origin/$ZWEIG...HEAD" | tr '\t' ' ')"
        local hinten vorne; hinten="${stand% *}"; vorne="${stand#* }"
        if [ "$hinten" = 0 ] && [ "$vorne" = 0 ]; then
            echo "  Stand:   Gleichstand mit origin/$ZWEIG"
        elif [ "$hinten" != 0 ] && [ "$vorne" != 0 ]; then
            echo "  Stand:   [ACHTUNG] auseinandergelaufen — $vorne lokal, $hinten auf dem Remote"
        elif [ "$vorne" != 0 ]; then
            echo "  Stand:   $vorne Commit(s) noch nicht gepusht"
        else
            echo "  Stand:   $hinten Commit(s) noch nicht geholt"
        fi
    else
        echo '  Stand:   Remote gerade nicht erreichbar'
    fi

    echo
    if systemctl --user is-active obsidian-vault-sync.timer >/dev/null 2>&1; then
        echo "  Zeitplan: systemd-Timer läuft — nächster Lauf:"
        systemctl --user list-timers obsidian-vault-sync.timer --no-pager 2>/dev/null | sed -n '2p' | sed 's/^/            /'
    elif crontab -l 2>/dev/null | grep -q 'vault-sync.sh abgleich'; then
        echo '  Zeitplan: Cron-Eintrag vorhanden'
    else
        echo '  Zeitplan: [FEHLT] — kein Timer, kein Cron-Eintrag'
    fi

    for k in "${WORKSPACE_KANDIDATEN[@]}" "$WORKSPACE"; do
        [ -n "$k" ] && [ -L "$k/obsidian" ] && echo "  OpenClaw: $k/obsidian -> $(readlink "$k/obsidian")"
    done

    echo
    if [ -f "$LOG" ]; then
        echo "  Protokoll ($LOG), letzte Zeilen:"
        tail -n 5 "$LOG" | sed 's/^/    /'
    else
        echo '  Protokoll: noch keins — der erste Lauf steht aus.'
    fi
    echo
}

# ------------------------------------------------------------------ entfernen
tu_entfernen() {
    if systemctl --user list-unit-files obsidian-vault-sync.timer >/dev/null 2>&1; then
        systemctl --user disable --now obsidian-vault-sync.timer >/dev/null 2>&1
        rm -f "$HOME/.config/systemd/user/obsidian-vault-sync."{timer,service}
        systemctl --user daemon-reload
        schreibe 'systemd-Timer entfernt.'
    fi
    if crontab -l 2>/dev/null | grep -q 'vault-sync.sh abgleich'; then
        crontab -l 2>/dev/null | grep -v 'vault-sync.sh abgleich' | crontab -
        schreibe 'Cron-Eintrag entfernt.'
    fi
    schreibe "Die Vault unter $VAULT bleibt liegen — samt Historie."
}

case "$BEFEHL" in
    hilfe|--hilfe|-h|--help)
                awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$SELBST" ;;
    einrichten) tu_einrichten ;;
    abgleich)   tu_abgleich ;;
    pruefen)    tu_pruefen ;;
    entfernen)  tu_entfernen ;;
    *)          echo "Unbekannter Unterbefehl: $BEFEHL (einrichten | abgleich | pruefen | entfernen)" >&2; exit 2 ;;
esac
