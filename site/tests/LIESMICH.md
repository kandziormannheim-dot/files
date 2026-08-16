# Prüfsuiten

Die Browser-Prüfungen, mit denen jede Bauaufgabe (F1–P5) abgenommen wurde —
entstanden im Design-Flow am 16.08.2026 und hierher gesichert, weil sie
zuvor nur im flüchtigen Arbeitsverzeichnis lagen.

## Ausführen

Voraussetzungen: gebaute Seite wird lokal ausgeliefert, Playwright verfügbar.

```bash
cd site && npm run build
npx http-server dist -p 4321 --silent &     # Testserver
npm i -D playwright                          # einmalig; nutzt den System-Chromium
node tests/verify.mjs                        # oder jede andere Suite
```

Der Chromium-Pfad ist in den Suiten auf `/opt/pw-browsers/chromium-1194/...`
gesetzt (Umgebung des Design-Flows) — auf anderen Rechnern die Konstante
`EXE` anpassen oder entfernen, dann nimmt Playwright seinen eigenen Browser.

| Suite | Prüft |
| --- | --- |
| `verify.mjs` | Zweisprachigkeit, hreflang, Theme-Start ohne Aufblitzen, Kopfzeile, mobiles Menü |
| `hero.mjs` | Hero vollständig auf 375×667, Ruhebewegung, Bewegungsreduktion |
| `stats.mjs` | Zahlen ohne JavaScript, Zähler-Bedingungen, Zugänglichkeitsbaum |
| `expertise.mjs` | Zeilenlängen (gemessen), Rasterbrüche, Hover nur bei Zeigern |
| `outlook.mjs` | Abgrenzung vom Kartenraster, Kontrast auf getönter Fläche (gerechnet) |
| `about.mjs` | Lesebreite, Bildkante in beiden Themes, Mannheim im Fließtext |
| `footer.mjs` | Logo-Invertierung (Kontrast gerechnet), keine Nav-Wiederholung |
| `consent.mjs` | Zwei-Klick: null Fremdanfragen ohne Klick, Fehlerzustand, Tastatur |
| `socialtabs.mjs` | ARIA-Tab-Muster, Pfeiltasten, Profil-Wege ohne Laden |
| `contact.mjs` | Formular: alle Zustände, Honeypot sendet nicht, Eingabenerhalt |
| `legal.mjs` | Fokus-Falle (12×Tab-Protokoll), Rechtstexte beschreiben die echte Seite |
| `polish.mjs` | SEO-Artefakte, 13 Breiten, axe-core WCAG 2.2 AA, Gewicht/CLS |
| `previewcheck.mjs` | Eigenständigkeit der Ein-Datei-Vorschau (Artifact) |
