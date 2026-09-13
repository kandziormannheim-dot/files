# Information Architecture: SBF-Kurs

> Phase 3 von 7 im Designer-Flow. Vorgänger: `DESIGN_BRIEF.md` (Phase 2).
> Nachfolger: `DESIGN_TOKENS.css` (Phase 4).

**Ausgangslage:** Neues Teilprojekt `sbfkurs/`; kein bestehendes Routing.
Übernommen wird nur das Muster des Front-Controllers aus `womo/`.

---

## Grundentscheidung: Kurs als Namensraum

Jede URL nennt zuerst das Zeugnis (`src`, `ubi`, `fkn`, `lrc`), dann die
Tätigkeit. So bleibt die Adresse lesbar („/pruefung/src“), Kurse lassen sich
einzeln freischalten, und ein fünfter Kurs ist ein Verzeichnis unter
`content/`, kein Code. Zertifikatsübergreifende Übungen (Buchstabieren, DSC)
liegen ohne Kurs-Präfix.

## Site Map

```
ÖFFENTLICH
- /login                 Anmeldung
- /registrieren          Konto mit Einladungscode
- /impressum, /datenschutz
- /status                Selbsttest (JSON)

ANGEMELDET
- /                      Dashboard: eine Karte je Kurs, Lernstand, „Weiter lernen“
- /konto                 Name, Passwort (auch erzwungener Wechsel)
- /kurs/{zert}           Kursübersicht: Lektionen · Trainer · Prüfung · Praxis
  ├── /lektion/{zert}/{slug}            Lektion, Inhaltsverzeichnis, Vor/Zurück
  │     └── POST …/gelesen              markiert, springt weiter
  ├── /trainer/{zert}                   Modul- und Moduswahl
  │     ├── /trainer/{zert}/frage       eine Frage → POST → Auflösung
  │     └── /trainer/{zert}/statistik   je Modul geübt/sicher/wackelig
  ├── /pruefung/{zert}                  Regeln, Bogenwahl, Verlauf
  │     ├── POST /pruefung/{zert}/start → /pruefung/{id}
  │     ├── /pruefung/{id}              Bogen mit Timer
  │     ├── POST /pruefung/{id}/abgeben → /pruefung/{id}/ergebnis
  │     └── /pruefung/{id}/ergebnis     Auswertung je Frage
  ├── /uebung/{zert}/funkverkehr[/{id}] Lückentext / Reihenfolge
  └── /uebung/{zert}/englisch[/{id}]    Übersetzung + Selbsteinschätzung
- /uebung/buchstabieren  zertifikatsübergreifend
- /uebung/dsc[?kurs=]    DSC-Simulator, Szenarien nach Kurs gefiltert
- /bild/{zert}/{datei}   Abbildungen aus content/ (nur angemeldet)

ADMIN
- /admin                 Kennzahlen, Inhaltsstatus
- /admin/benutzer[/{id}] Konten anlegen, Rolle, Sperre, Passwort, Löschen, Lernstand
- /admin/einladungen     Einmalcodes
- /admin/inhalte         Validierungsbefunde je Kurs
```

## Flüsse

**Erster Besuch:** `/registrieren` (Code) → `/` (Dashboard, 0 %) → „Weiter
lernen“ = erste ungelesene Lektion → „Gelesen — weiter“ hangelt durch alle
Lektionen → am Ende Hinweis „weiter im Lerntrainer“.

**Lernen:** `/trainer/{zert}` → Modus wählen → Frage → Antwort → Auflösung →
Enter → nächste Frage. Aus der Auflösung heraus „Zur Lektion“. Aus der
Lektion heraus „Fragen zu dieser Lektion üben“ (Modulfilter).

**Prüfen:** `/pruefung/{zert}` → Start → Bogen (Timer, Entwurf im Browser) →
Abgeben → Ergebnis → „Falsche im Trainer üben“ (Modus Wackelkandidaten).
Eine offene Prüfung wird auf Dashboard und Kursseite als „fortsetzen“
angeboten; ein zweiter Start setzt sie fort statt neu zu beginnen.

**Admin-Reset:** Admin setzt Übergangspasswort → Nutzer meldet sich an → jede
Seite außer `/konto` leitet dorthin → neues Passwort → frei.

## Navigation

Kopfzeile: Marke · Kurse · Buchstabieren · DSC · Name (= Konto) · Admin (nur
Rolle) · Abmelden. Innerhalb eines Kurses führen Brotkrumen zurück
(Kurse › Kurs › Bereich). Keine Seitenleiste: auf dem Handy wäre sie im Weg,
auf dem Desktop lenkt sie beim Lesen ab.

## Inhaltsmodell

Siehe `docs/sbfkurs/INHALTE.md`: `zertifikat.json` (Regeln), `lektionen.json`
+ `lektionen/*.md`, `fragen.json`, optional `boegen.json`, `uebungen/*.json`,
`gemeinsam/buchstabiertafel.json`, `dsc/szenarien.json`.
