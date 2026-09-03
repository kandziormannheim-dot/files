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
| `index.html` | Die komplette deutsche Seite, semantisch, `lang="de"`, mit Meta/OG/JSON-LD |
| `en/index.html` | Englische Fassung, gleiche Struktur und Assets, verlinkt per Sprachumschalter (Header, Mobilmenü, Footer) und `hreflang` |
| `assets/neos.css` | Design-Tokens (`:root`), Komponenten, Sektionen, Breakpoints, Bewegungsreduktion |
| `assets/checkout.js` | Privatkunden-Checkout: Preissumme, Validierung, Bestellung anlegen, Revolut-Popup, Statusabfrage — siehe `api/revolut/README.md` |
| `api/revolut/` | PHP-Endpunkte für die Revolut-Zahlung (Bestellung, Status, Webhook) plus Konfigurationsvorlage |
| `assets/neos.js` | Zielgruppen-Reiter, Burger-Menü, Scroll-Reveal, FAQ-Einzelöffnung, Formular-Validierung, aktiver Nav-Punkt — die Seite läuft auch ohne JS (dann Business) |
| `assets/fonts.css` + `assets/fonts/` | Sora, Hanken Grotesk, JetBrains Mono als variable WOFF2 (OFL), selbst gehostet — kein Google-Fonts-Aufruf beim Besuch |
| `screenshots/` | Playwright-Aufnahmen bei 1280 und 375 px zur Abnahme (`en-*` englische Seite, `*-privat` / `*-private` Privatkunden-Reiter, `checkout-*` Bezahlformular) |

## Zuordnung zu den PDFs

| Sektion | Quelle |
|---|---|
| Header, Hero, Carrier-Band, Warum NEOS, So funktioniert's, Netzwerk, CTA, Footer | `Startseite.pdf` S. 1–3, 5–6 |
| Die Plattform (Dashboard-Vorschau) | `Dashboard.pdf` S. 1–2, in CSS nachgebaut |
| Palette, Typografie, Wortmarke, Routing-Linie, Tonfall | `Neos_Brand_Guidelines.pdf` S. 5–9 |
| Integrationen, Preise, Kundenstimmen, FAQ, Kontakt | Ergänzt nach dem Muster vergleichbarer Multi-Carrier-Anbieter |

Bewusst weggelassen: der Spar-Rechner (`Startseite.pdf` S. 4).

## Platzhalter — vor dem Livegang ersetzen

- **Preise** (`#preise`): Beispielwerte, aus den Sendungskosten im Dashboard-PDF abgeleitet. Privatkunden-Preise sind dieselben Werte × 1,19, kaufmännisch gerundet, beide Fassungen stehen fertig formatiert in der Tabelle.
- **Kundenstimmen** (`#kunden`): fiktive Zitate und Firmen bzw. Privatpersonen zur Layout-Abnahme.
- **Abgabe & Abholung** (`#abgabe`, nur Privatkunden): „über 40.000 Paketshops“ ist eine Platzhalterzahl.
- **Paket verschicken** (`#paket`, nur Privatkunden): Zahlung läuft, das Versandlabel selbst entsteht erst mit der Carrier-Anbindung (`labelBeauftragen()` in `api/revolut/_bootstrap.php`). Preise im Formular (`data-netto`) müssen mit `api/revolut/preise.php` übereinstimmen.
- **Kontaktformular** (`#kontakt`): `action="mailto:info@neos24.com"` als Übergang. Mit Backend in `neos.js` beim Submit ein `fetch()` einsetzen.
- **Impressum / Datenschutz**: Links zeigen auf `#`.
- **Open-Graph-Bild**: noch keins hinterlegt (`og:image`).
- **URL-Schema**: `hreflang` und `canonical` gehen von `neos24.com/` (DE) und `neos24.com/en/` (EN) aus. Bei anderem Schema beide Dateien anpassen.

## Zielgruppen-Reiter „Business / Privatkunden“

Eine Seite je Sprache, zwei Fassungen. Der Zustand steht in `<html data-audience="business|private">`;
Inhalte nur für eine Gruppe tragen `data-for="business"` bzw. `data-for="private"`, alles ohne
`data-for` ist gemeinsam. CSS blendet die jeweils andere Gruppe aus, JS schaltet um.

- **Standard** ist Business. Reihenfolge beim Laden: URL-Parameter → `localStorage` → Business.
- **URL-Parameter**: DE `?kunde=privat` / `?kunde=business`, EN `?customer=private` / `?customer=business`. Beide Namen werden auf beiden Seiten gelesen. Die Sprachlinks bekommen den Parameter automatisch angehängt.
- **Preise**: Business netto, Privatkunden inkl. 19 % MwSt. Beide Werte stehen im Markup (`<span data-for="…">`), nichts wird im Browser gerechnet.
- **Nur Business**: Plattform (Dashboard), Integrationen, Business-FAQ, Business-Zitate, Felder „Shop / Unternehmen“ und „Sendungen pro Monat“.
- **Nur Privatkunden**: Abgabe & Abholung, Privat-FAQ, Privat-Zitate, eigenes E-Mail-Feld im Formular.
- **Ohne JS**: Business-Fassung, Reiter sichtbar aber ohne Funktion.
- **Neuen Inhalt zuordnen**: Element mit `data-for="business"` oder `data-for="private"` versehen, fertig. Gemeinsame Überschriften mit zwei Varianten bekommen zwei `<span data-for="…">` im selben Element.

## Zahlung (Privatkunden, Revolut)

Der Abschnitt „Paket verschicken“ legt über `api/revolut/bestellung.php` eine Bestellung an und öffnet das Revolut-Popup; Einrichtung, Ablauf, Webhook und Prüfpunkte stehen in [`api/revolut/README.md`](api/revolut/README.md). Ohne Konfiguration (kein Secret Key) meldet das Formular „Zahlung nicht verfügbar“ und die Seite bleibt sonst voll nutzbar.

## Zwei Sprachen pflegen

Beide Seiten haben identische Sektionen in identischer Reihenfolge; nur Texte, Anker-IDs (`#preise` / `#pricing`) und Zahlenformate (`€2,40` / `€2.40`) unterscheiden sich. Eine Änderung am Layout gehört in `assets/`, eine Änderung am Text in beide HTML-Dateien.

## Design-Regeln (Kurzfassung)

- Vier Markenfarben nur in ihren Rollen: Cyan Tech/Tracking, Coral Aktion, Gelb Ersparnis, Magenta Akzent. Auf hellem Grund tragen nur Coral und Magenta Text; Cyan und Gelb füllen Flächen.
- Wortmarke `NEOS` liegt einmal als `<symbol id="neos-logo">` im HTML und wird per `<use>` eingesetzt. Mindesthöhe 22 px, Farben nie ändern.
- Kontrastwerte stehen im Kopf von `assets/neos.css`. Weiß auf Coral (3,1:1) ist eine bewusste Markenentscheidung für Knöpfe; `--btn-primary-fg: var(--ink)` schaltet auf 6,2:1 um.
