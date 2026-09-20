#!/bin/sh
# God's-Eye-View-Dienst starten, stoppen, nachsehen.
#
# Läuft als Systembenutzer der Domain — ohne root, ohne systemd. Der
# Node-Prozess hängt deshalb an keiner Sitzung, sondern wird mit nohup
# abgehängt; wiederbelebt wird er vom Cron-Eintrag, den "God View
# einrichten" anlegt:
#
#   */5 * * * *  $HOME/godview-app/dienst.sh start   (Aufpasser)
#   @reboot      $HOME/godview-app/dienst.sh start   (nach Neustart)
#
# "start" ist deshalb absichtlich stumm und folgenlos, wenn der Dienst
# schon läuft.
#
# Aufrufe:
#   dienst.sh start     startet, falls er nicht läuft
#   dienst.sh stop      beendet ihn (SIGTERM, zur Not SIGKILL)
#   dienst.sh neustart  stop + start, z. B. nach neuen Schlüsseln
#   dienst.sh status    sagt, ob er läuft, und fragt ihn einmal an

set -u

BASIS=$(cd "$(dirname "$0")" && pwd)
KONF="$BASIS/dienst.conf"
[ -r "$KONF" ] || { echo "Keine Konfiguration: $KONF"; exit 1; }
# Die Konfiguration enthält nur PORT, HOSTNAMEN, NODE und QUELLE —
# keine Schlüssel. Die stehen in $QUELLE/.env (nur für den Besitzer lesbar).
. "$KONF"

PORT=${PORT:-4180}
HOST=${HOST:-127.0.0.1}
HOSTNAMEN=${HOSTNAMEN:-}
NODE=${NODE:-node}
QUELLE=${QUELLE:-$(dirname "$BASIS")/godview-quelle}
PID_DATEI="$BASIS/dienst.pid"
PROTOKOLL="$BASIS/dienst.log"
MAX_PROTOKOLL=5242880 # 5 MiB, dann wird einmal weggerollt

laeuft() {
  [ -f "$PID_DATEI" ] || return 1
  PID=$(cat "$PID_DATEI" 2>/dev/null)
  [ -n "${PID:-}" ] || return 1
  kill -0 "$PID" 2>/dev/null || return 1
  # Nach einem Neustart des Servers kann dieselbe PID einem fremden Prozess
  # gehören — deshalb zusätzlich prüfen, dass es unser Startskript ist.
  ps -p "$PID" -o args= 2>/dev/null | grep -q 'godview-start.mjs' || return 1
  return 0
}

protokoll_rollen() {
  [ -f "$PROTOKOLL" ] || return 0
  GROESSE=$(wc -c < "$PROTOKOLL" 2>/dev/null || echo 0)
  [ "$GROESSE" -gt "$MAX_PROTOKOLL" ] 2>/dev/null && mv -f "$PROTOKOLL" "$PROTOKOLL.alt"
  return 0
}

start() {
  if laeuft; then
    [ "${LEISE:-}" = ja ] || echo "Läuft schon (PID $(cat "$PID_DATEI"))."
    return 0
  fi
  [ -d "$QUELLE" ] || { echo "Quellverzeichnis fehlt: $QUELLE"; return 1; }
  [ -f "$QUELLE/godview-start.mjs" ] || { echo "Startskript fehlt: $QUELLE/godview-start.mjs"; return 1; }
  [ -d "$QUELLE/dist" ] || { echo "Gebaute Dateien fehlen: $QUELLE/dist — Workflow »God View einrichten« laufen lassen."; return 1; }
  [ -x "$NODE" ] || command -v "$NODE" >/dev/null 2>&1 \
    || { echo "Node nicht gefunden: $NODE"; return 1; }
  protokoll_rollen
  cd "$QUELLE" || return 1
  GODVIEW_PORT="$PORT" GODVIEW_HOST="$HOST" GODVIEW_HOSTNAMEN="$HOSTNAMEN" \
    nohup "$NODE" godview-start.mjs >> "$PROTOKOLL" 2>&1 &
  echo $! > "$PID_DATEI"
  # Kurz Luft lassen und nachsehen, ob er auch oben bleibt.
  sleep 3
  if laeuft; then
    echo "Gestartet (PID $(cat "$PID_DATEI"), Port $PORT)."
    return 0
  fi
  echo "Start fehlgeschlagen — letzte Protokollzeilen:"
  tail -20 "$PROTOKOLL" 2>/dev/null
  rm -f "$PID_DATEI"
  return 1
}

stop() {
  if ! laeuft; then
    echo "Läuft nicht."
    rm -f "$PID_DATEI"
    return 0
  fi
  PID=$(cat "$PID_DATEI")
  kill "$PID" 2>/dev/null
  i=0
  while [ "$i" -lt 15 ]; do
    laeuft || break
    sleep 1
    i=$((i + 1))
  done
  if laeuft; then
    echo "Reagiert nicht auf SIGTERM — SIGKILL."
    kill -9 "$PID" 2>/dev/null
    sleep 1
  fi
  rm -f "$PID_DATEI"
  echo "Beendet."
}

status() {
  if laeuft; then
    echo "Dienst: läuft (PID $(cat "$PID_DATEI"))"
  else
    echo "Dienst: läuft nicht"
  fi
  echo "Port:   $PORT ($HOST), erlaubter Hostname: ${HOSTNAMEN:-(keiner!)}"
  echo "Node:   $NODE ($("$NODE" -v 2>/dev/null || echo 'nicht aufrufbar'))"
  echo "Quelle: $QUELLE"
  ANTWORT=$(curl -s -o /dev/null -m 10 -w '%{http_code}' \
    -H "Host: ${HOSTNAMEN%%,*}" "http://$HOST:$PORT/" 2>/dev/null)
  echo "Selbstanfrage /: HTTP ${ANTWORT:-(keine Antwort)}"
  echo "Protokoll: $PROTOKOLL"
  tail -5 "$PROTOKOLL" 2>/dev/null | sed 's/^/  | /'
  laeuft
}

case "${1:-status}" in
  start) LEISE=${LEISE:-ja} start ;;
  stop) stop ;;
  neustart) stop; LEISE=nein start ;;
  status) status ;;
  *) echo "Aufruf: $0 start|stop|neustart|status"; exit 64 ;;
esac
