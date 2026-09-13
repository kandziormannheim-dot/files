# Build Tasks: SBF-Kurs

Generiert aus: `.design/sbfkurs/DESIGN_BRIEF.md`, `INFORMATION_ARCHITECTURE.md`, `DESIGN_TOKENS.css`
Datum: 2026-09-13
Ästhetik: **Scandinavian Functionalism, hell** — festgelegt in F1.

**Bestandsaufnahme:** Vorlage ist `womo/` (Front-Controller, Config außerhalb des Webroots, CSRF, Missbrauchsbremse, Karten-CSS). Alles Übrige entsteht neu unter `sbfkurs/`.

**Umgang mit fehlenden Inhalten:** Die amtlichen Fragenkataloge liegen nicht vor. Jeder Kurs bekommt zehn selbst formulierte Beispielfragen mit `beispiel: true`; die Anwendung zeigt an jeder Fragestelle das Band „Beispielfragen — noch nicht der amtliche Katalog". Prüfungsregeln tragen `_zuPruefen`. Impressum/Datenschutz tragen `PLATZHALTER:`.

---

## Foundation

- [x] **F1 — Gerüst und Konten.** Config-Vorlage, Dev-Router, Bootstrap mit vollständigem SQLite-Schema, Admin-Bootstrap aus der Config, Auth mit Registrierung (Einladungscode, Einmalcodes), Kontosperre, erzwungenem Passwortwechsel. **Fertig, wenn** `tests/auth_test.php` grün ist und `/status` `bereit:true` meldet. _Neu, nach womo/-Muster._
- [x] **F2 — Inhalte-Lader und Markdown.** Markdown-Teilmenge mit `:::`-Blöcken, `katalogPruefen()` als einzige Validierung für Import, Admin und Tests, `werkzeuge/katalog-pruefen.php`. **Fertig, wenn** alle vier Kataloge ohne Fehler validieren und `markdown_test` HTML maskiert. _Neu._
- [x] **F3 — Theme.** `style.css` aus den Tokens: helles Lese-Theme, Dark-Mode-Zweig, Druckansicht. **Fertig, wenn** Dashboard, Lektion, Trainer und Bogen bei 375 und 1280 px ohne horizontales Scrollen stehen. _Neu; Klassennamen wie in womo/._

## Core Sections

- [x] **C1 — Dashboard und Kurs.** Karte je Kurs mit Lernstand (40 % Lektionen, 40 % sichere Fragen, 20 % Prüfungen), Ampel, „Weiter lernen". Kursseite mit Lektionsliste, Trainer-, Prüfungs- und Praxis-Kacheln. **Fertig, wenn** der Balken nach einer gelesenen Lektion steigt.
- [x] **C2 — Lektionen.** Lesebreite 68ch, Inhaltsverzeichnis aus H2, Merke/Beispiel/Achtung/Funk-Kästen, Vor/Zurück, „Gelesen — weiter", „Fragen zu dieser Lektion". **Fertig, wenn** alle 36 Lektionen rendern und „Gelesen" zur nächsten springt.
- [x] **C3 — Lerntrainer.** Modul- und Moduswahl, gemischte Antworten mit Permutation in der Sitzung, Auflösung mit Hinweis und Lektionslink, Tasten 1–4/Enter, Statistik mit Wackelkandidaten. **Fertig, wenn** `trainer_test` grün ist und der Browser-Durchlauf drei Fragen per Tastatur beantwortet.
- [x] **C4 — Prüfungssimulation.** Bogen amtlich oder nach Zusammensetzung, Auffüllen/Verkürzen bei kleinem Katalog, Serverzeit maßgeblich, Timer und Entwurf im Browser, idempotente Abgabe, Ergebnis je Frage. **Fertig, wenn** `pruefung_test` grün ist und ein Neuladen des Bogens keine Antwort verliert.
- [x] **C5 — Praxismodule.** Lückentext (Toleranz für Tippfehler), Reihenfolge (▲▼, tastaturbedienbar), Buchstabiertafel (beide Richtungen, Alfa/Alpha), Englisch (Schlüsselwörter + Selbsteinschätzung). **Fertig, wenn** `uebungen_test` grün ist.
- [x] **C6 — DSC-Simulator.** Zustandsautomat mit Menübaum, Ziffernblock, Kanalwahl, DISTRESS unter Klappe mit 5-s-Haltezeit, Szenario-Abgleich, Ergebnis per Formular. **Fertig, wenn** der Browser-Durchlauf den Routineanruf mit 6 von 6 Schritten abschließt.
- [x] **C7 — Admin.** Kennzahlen, Konten (anlegen, Rolle, Sperre, Übergangspasswort, Löschen, Lernstand), Einmalcodes, Inhaltsstatus. **Fertig, wenn** jede Aktion mit CSRF läuft und das eigene Konto nicht gesperrt/gelöscht werden kann.

## Inhalte

- [x] **I1 — SRC, UBI, FKN, LRC.** Je Kurs `zertifikat.json`, `lektionen.json`, 8–10 Lektionen, 10 Beispielfragen, Übungen (FKN ohne Funk/Englisch). **Fertig, wenn** `katalog-pruefen.php` 0 Fehler meldet.
- [x] **I2 — Import.** `katalog-import.php` mit Profilen je Katalog, Bericht, `--zusammenfuehren`; Fixture, das die vermutete ELWIS-Struktur nachstellt. **Fertig, wenn** `import_test` vier Fragen samt Modulwechsel, Silbentrennung und Prüfmarkierung liefert.

## Polish

- [x] **P1 — Browser-Durchlauf.** `tests/ablauf.mjs`: Registrieren → Lektion → Trainer → Prüfung → Übungen → DSC → Lernstand → Abmelden; keine JS-Fehler, keine Fremdanfragen. _Nutzt das Muster aus site/tests/._
- [x] **P2 — Doku und Deploy.** `docs/sbfkurs/README.md`, `INHALTE.md`, Workflows „SBF-Kurs einrichten" und „SBF-Kurs Tests". **Fertig, wenn** der Einrichtungs-Workflow vor dem rsync Tests und Inhaltsprüfung erzwingt.
- [ ] **P3 — Amtliche Kataloge.** PDFs importieren, Profile nachschärfen, `boegen.json` falls Bögen vorliegen, Prüfungsregeln gegen die Prüfungsordnung setzen, `_zuPruefen` entfernen, Beispielfragen abschalten. _Wartet auf die PDFs._
- [ ] **P4 — Rechtstexte.** `PLATZHALTER` in Impressum/Datenschutz durch den Verantwortlichen ersetzen. _Vor dem Livegang._
