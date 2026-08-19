# Design Review: kandzior.de

Geprüft gegen: `DESIGN_BRIEF.md`
Philosophie: **Scandinavian Functionalism**
Datum: 2026-08-16
Prüfumgebung: gebaute Seite (`npm run build`) in Chromium, beide Themes, plus die zwölf automatisierten Prüfsuiten (axe-core WCAG 2.2 AA, Kontrast gerechnet, Netzwerkmitschnitt, Fokusprotokoll).

## Screenshots Captured

| Screenshot | Breakpoint | Zeigt |
| --- | --- | --- |
| `screenshots/review-home-desktop-1280.png` | Desktop (1280) | Vollständige Startseite, Hell |
| `screenshots/review-home-tablet-768.png` | Tablet (768) | Vollständige Startseite, Hell |
| `screenshots/review-home-mobile-375.png` | Mobil (375) | Vollständige Startseite, Hell |
| `screenshots/review-home-dark-mode-desktop-1280.png` | Desktop | Vollständige Startseite, Dunkel |
| `screenshots/review-home-dark-mode-mobile-375.png` | Mobil | Vollständige Startseite, Dunkel |
| `screenshots/review-home-en-desktop-1280.png` | Desktop | Englische Startseite |
| `screenshots/review-datenschutz-desktop-1280.png` | Desktop | Datenschutzerklärung |
| `screenshots/review-impressum-dark-mode-1280.png` | Desktop | Impressum, Dunkel |
| `screenshots/review-404-desktop-1280.png` | Desktop | Fehlerseite |
| `screenshots/review-menu-open-mobile-375.png` | Mobil | Offenes Vollbild-Menü |
| `screenshots/review-social-tab-x-desktop.png` | Desktop | X-Tab mit Einwilligungs-Vorschau |
| `screenshots/review-form-validation-desktop.png` | Desktop | Formular mit allen drei Fehlermeldungen |
| `screenshots/review-form-focus-desktop.png` | Desktop | Fokusring auf Eingabefeld |
| `screenshots/review-card-hover-desktop.png` | Desktop | Expertise-Karte im Hover-Zustand |

> Alle Aufnahmen liegen in `.design/kandzior-de/screenshots/`.

**Methodischer Hinweis:** In einer verkleinerten Bildvorschau erschien das Zahlen-Band im hellen Theme dunkel. Die Pixel-Analyse der PNG-Datei ergab: Das Band ist korrekt hell (`#f8fafc`, y 900–1180 in der Desktop-Aufnahme) — das Dunkel war ein Artefakt der Vorschau-Skalierung, kein Fehler der Seite. Befunde in diesem Review beruhen auf gemessenen Pixeln beziehungsweise berechneten Werten, nicht auf dem Augenschein verkleinerter Bilder.

## Summary

Die Seite setzt den Brief präzise um: Die Leserichtung folgt exakt der Fragefolge aus der IA, der Haltungsblock bricht sichtbar aus der Kartenlogik aus, beide Themes sind eigenständig abgestimmt statt invertiert, und die messbaren Versprechen sind eingelöst — null Fremdanfragen, 156,6 KB, null axe-Verstöße, CLS 0,0000. **Die größten offenen Punkte sind keine Gestaltungsfehler, sondern fehlende Zulieferungen:** Ohne die beiden Portraits und einen echten Formular-Endpunkt kann die Seite nicht live gehen, und der Social-Bereich verspricht mehr Beleg, als er derzeit zeigt.

## Must Fix

1. **Die Portraits fehlen — die Seite zeigt an ihren zwei wichtigsten Stellen Platzhalter.** Der Brief nennt das Foto „nicht verhandelbar": „Kein Foto = keine Person = kein Vertrauen." Hero und Über-mich zeigen derzeit gestrichelte Flächen (`review-home-desktop-1280.png`, oben und Mitte). _Fix: `portrait-freigestellt.png` (transparent!) und `portrait-wasserturm.jpg` nach `site/public/assets/` legen — die Komponente schaltet beim nächsten Build selbst um._
2. **Formular im Simulationsmodus.** Der Besucher sieht Erfolg, die Anfrage landet nur in der Konsole. Live wäre das ein gebrochenes Versprechen („innerhalb von zwei Werktagen") auf der einen Aktion, für die die Seite existiert. _Fix: Endpunkt in `site/src/content/site.json` konfigurieren — bei Hetzner-Hosting als kleines Skript auf dem eigenen Server — und den Formular-Abschnitt der Datenschutzerklärung daraufhin prüfen._

## Should Fix

1. **Frankfurt gegen Mannheim.** Positionierung, Biografie und Bildunterschrift sagen Mannheim; das Impressum nennt Frankfurt. Der 90-Sekunden-Prüfer, der ins Impressum klickt, findet eine Unstimmigkeit genau dort, wo er Stimmigkeit sucht. _Fix (ein Satz): Biografie ergänzen um „zu Hause in Mannheim, geschäftlich in Frankfurt" — dann ist es eine Angabe statt eines Widerspruchs._
2. **Der Social-Bereich heißt „Nachprüfbar, nicht behauptet" — zeigt aber nur Karten.** LinkedIn und Facebook sind derzeit reine Profilkarten (`review-home-desktop-1280.png`, unten), nur X bietet die geladene Timeline. Die Überschrift verspricht mehr Beleg, als der Bereich einlöst. _Fix: Zwei bis drei LinkedIn-Beiträge einbetten (Anleitung steht in `social.json`) — oder, falls die vierteljährliche Pflege nicht realistisch ist, die Überschrift eine Stufe leiser stellen._
3. **Die Wortmarke ist die typografische Ersatzfassung.** Sie funktioniert, ist aber nicht das gelieferte MK-Monogramm. Als PNG auf Weiß ist das Original auf dunklen Flächen unbrauchbar. _Fix: `logo-mk.svg` (Vektor, transparent, `currentColor`) nach `site/public/assets/` — die Komponente übernimmt es automatisch._
4. **Events-Schalter im Blick behalten.** Der Bereich ist korrekt ausgeblendet (`visible: false`), und genau deshalb wird er beim ersten echten Termin vergessen werden. _Fix: Beim Anlegen des ersten Ticket-Tailor-Termins `events.json` auf `true` stellen; das Widget-Snippet aus dem Konto übernehmen._

## Could Improve

1. **Leere rechte Hälfte im Social-Panel** (Desktop, `review-social-tab-x-desktop.png`): Das Panel ist auf 680px begrenzt, rechts bleibt viel Fläche. Vertretbar im Sinne der Philosophie („Weißräume sind Absicht"), aber eine dezente Begleitspalte — etwa der Pflege-Hinweis „zuletzt geprüft“ als Vertrauenssignal — könnte die Fläche verdienen. _Vorschlag: erst nach dem Einbetten echter LinkedIn-Beiträge entscheiden._
2. **Hero-Platzhalter prägt derzeit den Ersteindruck.** Die gestrichelte Fläche mit Dateinamen ist als Entwicklungszustand richtig, wirkt in Demos aber unfertig. _Vorschlag: nichts tun — das echte Foto ist die Lösung, jede Zwischenlösung wäre Doppelarbeit._
3. **Zähler-Schwelle:** Die Zahlen zählen erst bei 60% Sichtbarkeit; wer schnell scrollt, sieht gelegentlich das Ende der Animation statt ihres Anfangs. _Vorschlag: Schwelle auf 0,4 senken — Geschmacksfrage, kein Fehler._
4. **`Datenschutz`-Seite auf sehr großen Bildschirmen:** Die schmale Lesespalte (672px) auf 1920px lässt die Seite karg wirken. Bewusste Entscheidung für Lesbarkeit — könnte aber mit einer dezenten Sprungnavigation („Auf dieser Seite") gefüllt werden, die bei elf Abschnitten auch funktional wäre.

## What Works Well

- **Der Bruch am Haltungsblock funktioniert.** Karten enden, die getönte Fläche beginnt randlos, der Zitatstrich markiert Meinung statt Leistung (`review-home-desktop-1280.png`, Mitte). Genau die im Brief geforderte Trennung von Arbeit und Haltung — man bemerkt den Wechsel vor dem Lesen.
- **Beide Themes sind entworfen, nicht invertiert.** Dunkles Theme mit `slate-200`-Text statt Weiß, eigene Schattenwerte, die Fußzeile geht eine Stufe tiefer statt hell zu werden (`review-home-dark-mode-desktop-1280.png`). Kein einziger hartkodierter Farbwert in den Komponenten.
- **Die Leserichtung ist die Fragefolge.** Wer ist das → kann der was → woran arbeitet er → wo steht er → wer ist er → stimmt das → wie erreiche ich ihn. Auf allen drei Breakpoints bleibt diese Reihenfolge erhalten; auf Mobil reorganisieren die Bereiche, statt nur zu schrumpfen (Hero-Portrait wechselt Position und Größe, Karten werden liegend, dann stehend).
- **Zustände sind vollständig.** Formular mit Ruhe/Fokus/Fehler/Laden/Erfolg/Fehlschlag inklusive Eingabenerhalt und Ausweichweg (`review-form-validation-desktop.png`), Einwilligungs-Vorschau mit Fehlerzustand und permanentem Direktlink, Menü mit echter Fokus-Falle.
- **Die messbaren Versprechen des Briefs sind eingelöst und belegt:** 0 Fremdanfragen (Netzwerkmitschnitt), 156,6 KB Gesamtgewicht, 0 axe-Verstöße über fünf Seiten-Theme-Kombinationen, CLS 0,0000, Kontraste gerechnet statt geschätzt — inklusive der halbtransparenten Flächen.
- **Konsistenz durch Tokens ist real, nicht behauptet:** Die vier Korrekturen aus P4 (Suffix, Eyebrow, Platzhalter, Knopfhöhe) waren je eine Token- oder Einzeilenänderung — das System trägt.

## Empfohlene Reihenfolge bis zum Livegang

1. Portraits + Logo-SVG ablegen (Must 1, Should 3) — reine Dateikopien
2. Formular-Endpunkt aufsetzen und in `site.json` eintragen (Must 2)
3. Frankfurt/Mannheim-Satz in der Biografie ergänzen (Should 1)
4. Texte in `de.json`/`en.json` freigeben — sie sind Entwurf des Design-Prozesses
5. Anwaltsprüfung der Rechtstexte
6. 2–3 LinkedIn-Beiträge einbetten (Should 2)
7. `astro.config.mjs`: `site` prüfen, DNS, Deploy auf Hetzner
