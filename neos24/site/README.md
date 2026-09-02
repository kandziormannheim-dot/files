# neos24.com — Startseite (Rebranding 2026)

Statische HTML-Startseite nach den drei Vorlagen `Neos_Brand_Guidelines.pdf`,
`Startseite.pdf` und `Dashboard.pdf`. Keine Build-Kette, keine Abhängigkeiten:
Datei öffnen oder einen beliebigen Webserver auf dieses Verzeichnis zeigen.

```bash
cd neos24/site && python3 -m http.server 8080   # http://localhost:8080
```

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Die komplette Seite, semantisch, `lang="de"`, mit Meta/OG/JSON-LD |
| `assets/neos.css` | Design-Tokens (`:root`), Komponenten, Sektionen, Breakpoints, Bewegungsreduktion |
| `assets/neos.js` | Burger-Menü, Scroll-Reveal, FAQ-Einzelöffnung, Formular-Validierung, aktiver Nav-Punkt — die Seite läuft auch ohne JS |
| `assets/fonts.css` + `assets/fonts/` | Sora, Hanken Grotesk, JetBrains Mono als variable WOFF2 (OFL), selbst gehostet — kein Google-Fonts-Aufruf beim Besuch |
| `screenshots/` | Playwright-Aufnahmen bei 1280 und 375 px zur Abnahme |

## Zuordnung zu den PDFs

| Sektion | Quelle |
|---|---|
| Header, Hero, Carrier-Band, Warum NEOS, So funktioniert's, Netzwerk, CTA, Footer | `Startseite.pdf` S. 1–3, 5–6 |
| Die Plattform (Dashboard-Vorschau) | `Dashboard.pdf` S. 1–2, in CSS nachgebaut |
| Palette, Typografie, Wortmarke, Routing-Linie, Tonfall | `Neos_Brand_Guidelines.pdf` S. 5–9 |
| Integrationen, Preise, Kundenstimmen, FAQ, Kontakt | Ergänzt nach dem Muster vergleichbarer Multi-Carrier-Anbieter |

Bewusst weggelassen: der Spar-Rechner (`Startseite.pdf` S. 4).

## Platzhalter — vor dem Livegang ersetzen

- **Preise** (`#preise`): Beispielwerte, aus den Sendungskosten im Dashboard-PDF abgeleitet.
- **Kundenstimmen** (`#kunden`): fiktive Zitate und Firmen zur Layout-Abnahme.
- **Kontaktformular** (`#kontakt`): `action="mailto:info@neos24.com"` als Übergang. Mit Backend in `neos.js` beim Submit ein `fetch()` einsetzen.
- **Impressum / Datenschutz**: Links zeigen auf `#`.
- **Open-Graph-Bild**: noch keins hinterlegt (`og:image`).

## Design-Regeln (Kurzfassung)

- Vier Markenfarben nur in ihren Rollen: Cyan Tech/Tracking, Coral Aktion, Gelb Ersparnis, Magenta Akzent. Auf hellem Grund tragen nur Coral und Magenta Text; Cyan und Gelb füllen Flächen.
- Wortmarke `NEOS` liegt einmal als `<symbol id="neos-logo">` im HTML und wird per `<use>` eingesetzt. Mindesthöhe 22 px, Farben nie ändern.
- Kontrastwerte stehen im Kopf von `assets/neos.css`. Weiß auf Coral (3,1:1) ist eine bewusste Markenentscheidung für Knöpfe; `--btn-primary-fg: var(--ink)` schaltet auf 6,2:1 um.
