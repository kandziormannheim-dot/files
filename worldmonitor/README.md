# Weltmonitor

Ein eigenständiger Nachbau eines globalen Lagezentrum-Dashboards im Stil von
„World Monitor" (Play-Store-App `com.kmzapps.worldmonitor` / Open-Source-Projekt
[koala73/worldmonitor](https://github.com/koala73/worldmonitor)) — als einzelne
HTML-Datei ohne Build-Schritt und ohne externe Bibliotheken.

## Funktionen

- **Lagekarte:** Punktraster-Weltkarte (aus Natural-Earth-Umrissen gerastert,
  240×120-Gitter, als Base64 eingebettet) mit pulsierenden Ereignis-Markern
  und Hover-Tooltips
- **Feeds:** Geopolitik, Cyber & Technologie, Katastrophen & Klima — mit
  Schweregrad (Kritisch/Hoch/Beobachtung/Entspannung), Region, Quelle und
  relativer Zeit
- **Eilmeldungs-Ticker**, UTC- + Lokalzeit-Uhr, Ereignisprotokoll
- **Instabilitäts-Index** (Ranking mit Balken) und **Märkte** mit
  Canvas-Sparklines
- Simulierter Live-Betrieb: neue Meldungen und Kursbewegungen im
  Sekunden-/Minutentakt

## Hinweise

- **Alle Daten sind simuliert und fiktiv** (Demo-Banner im Header). Die
  Datenschicht (`EVENTS`, `MKTS`) ist bewusst so gebaut, dass sie später gegen
  echte Quellen (RSS/GDACS/Markt-APIs) getauscht werden kann.
- Öffnen genügt: `worldmonitor/index.html` im Browser — keine Abhängigkeiten,
  kein Server nötig.
- Bewusst dunkles Single-Theme (Lagezentrum-Ästhetik); respektiert
  `prefers-reduced-motion`.
