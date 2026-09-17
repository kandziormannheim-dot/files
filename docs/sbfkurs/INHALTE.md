# SBF-Kurs — Inhalte pflegen (Autorenhandbuch)

Die Anwendung unter [`sbfkurs/`](../../sbfkurs/) liest alle Lerninhalte aus
`sbfkurs/content/`. Dort liegt kein Code, sondern Text und Daten: je Zeugnis
ein Verzeichnis mit Lektionen, Fragenkatalog, Prüfungsregeln und Übungen.
Wer Inhalte ändert, fasst keine PHP-Datei an — und umgekehrt.

```
sbfkurs/content/
├── gemeinsam/
│   ├── buchstabiertafel.json       NATO-Alphabet, Zahlen, Übungswörter
│   └── rechtliches/impressum.md, datenschutz.md
├── src/                            ein Verzeichnis je Zeugnis: src, ubi, fkn, lrc
│   ├── zertifikat.json             Titel, Prüfungsregeln, Modulzusammensetzung
│   ├── lektionen.json              geordneter Index der Lektionen
│   ├── lektionen/01-….md           die Lektionstexte
│   ├── fragen.json                 Fragenkatalog (amtlich oder Beispiel)
│   ├── boegen.json                 optional: amtliche Bogen-Zusammenstellungen
│   ├── bilder/                     Abbildungen zu Fragen und Lektionen
│   └── uebungen/funkverkehr.json, englisch.json
└── dsc/szenarien.json              Szenarien des DSC-Simulators
```

Die Kennung eines Zeugnisses (`src`, `ubi`, `fkn`, `lrc`) ist zugleich der
Verzeichnisname, der Präfix der Fragen-IDs und der Bestandteil der URLs.

## Lektionen

### Index `lektionen.json`

```json
{
  "lektionen": [
    { "slug": "01-gmdss", "titel": "GMDSS und Seefunk — worum es geht",
      "kurz": "Was das weltweite Seenot- und Sicherheitsfunksystem leistet und wo das SRC hineinpasst.",
      "dauerMin": 15, "module": ["grundlagen"] }
  ]
}
```

- `slug` — Dateiname ohne Endung, nur `a-z`, `0-9`, `-`; die Nummer vorn
  bestimmt die Reihenfolge in der Anzeige nicht, die Reihenfolge im Index tut es.
- `module` — Modul-IDs aus `fragen.json`; daraus entsteht der Link
  „Fragen zu dieser Lektion" in den Lerntrainer.
- Die Datei `lektionen/<slug>.md` muss existieren (`katalog-pruefen.php` meckert sonst).

### Textformat

Lektionen sind Markdown in einer **bewussten Teilmenge**. Der Renderer
(`sbfkurs/src/markdown.php`) kennt genau das Folgende und maskiert alles
andere — rohes HTML wird als Text angezeigt, nie ausgeführt.

```markdown
## Überschrift zweiter Ordnung        (die Lektion selbst hat den Titel aus lektionen.json)
### Überschrift dritter Ordnung

Absätze durch Leerzeilen getrennt. **fett**, _kursiv_, `Code oder Kanalnummer`.

- Aufzählung
- noch ein Punkt
    - eingerückt mit vier Leerzeichen

1. nummerierte Liste
2. zweiter Schritt

| Kanal | Zweck |
|---|---|
| 16 | Not-, Dringlichkeits-, Sicherheits- und Anrufkanal |
| 70 | ausschließlich DSC |

> Zitat oder Gesetzestext.

![Bildbeschreibung](bilder/dsc-controller.png)     (Datei liegt in content/<zert>/bilder/)

[Linktext](https://www.elwis.de/…)                  (nur http(s)-Links)

:::merke
Ein hervorgehobener Merksatz. Mehrere Absätze sind erlaubt.
:::

:::beispiel
Ein durchgerechnetes oder erzähltes Beispiel.
:::

:::achtung
Warnung oder häufiger Fehler.
:::

:::funk
SEEADLER: MAYDAY MAYDAY MAYDAY
SEEADLER: THIS IS SEEADLER SEEADLER SEEADLER
BREMEN RESCUE: SEEADLER, THIS IS BREMEN RESCUE, RECEIVED MAYDAY
:::
```

Im `:::funk`-Block ist jede Zeile ein Funkspruch: alles vor dem ersten
Doppelpunkt ist die sprechende Station, der Rest der Spruch. Zeilen ohne
Doppelpunkt werden als Regieanweisung kursiv gesetzt (z. B. `(Pause)`).

Umfang: 600 bis 1000 Wörter je Lektion, drei bis sechs Zwischenüberschriften,
mindestens ein `:::merke`. Am Ende jeder Lektion steht ein kurzer Abschnitt
`## Das Wichtigste in Kürze` mit drei bis sechs Aufzählungspunkten.

Eine Lektion darf statt `.md` auch `.php` heißen — für interaktive Einschübe.
Solche Dateien sind Anwendungscode und werden wie Code geprüft.

## Fragenkatalog `fragen.json`

```json
{
  "zertifikat": "src",
  "quelle": { "name": "Beispielfragen, selbst verfasst", "stand": "2026-09", "amtlich": false },
  "module": [
    { "id": "grundlagen", "titel": "Grundlagen und Rechtliches" },
    { "id": "verkehrsabwicklung", "titel": "Verkehrsabwicklung" }
  ],
  "fragen": [
    {
      "id": "src-001",
      "nr": 1,
      "modul": "grundlagen",
      "text": "Wofür steht die Abkürzung GMDSS?",
      "antworten": [
        "Global Maritime Distress and Safety System",
        "General Maritime Digital Selective System",
        "German Maritime Distress Signalling Service",
        "Global Marine Data and Surveillance System"
      ],
      "richtig": 0,
      "bild": null,
      "hinweis": "Das GMDSS ist das weltweite Seenot- und Sicherheitsfunksystem der IMO.",
      "lektion": "01-gmdss",
      "beispiel": true
    }
  ]
}
```

Regeln, die `katalog-pruefen.php` durchsetzt:

- `id` eindeutig, Muster `<zert>-<dreistellig>`; `nr` ist die Nummer im
  amtlichen Katalog (bei Beispielfragen fortlaufend).
- Genau vier `antworten`; die richtige steht an Index `richtig`. Die Anwendung
  mischt beim Anzeigen — im Katalog darf die richtige Antwort also ruhig immer
  vorn stehen, wie es die amtlichen Kataloge tun.
- `modul` muss in `module` vorkommen, `lektion` (falls gesetzt) im Lektionsindex,
  `bild` (falls gesetzt) unter `bilder/`.
- `hinweis` ist die Erklärung, die der Trainer nach der Antwort zeigt — ein bis
  drei Sätze, eigene Worte.
- `beispiel: true` kennzeichnet selbst formulierte Fragen. Solange auch nur eine
  Beispielfrage im Katalog steht oder `quelle.amtlich` falsch ist, zeigt die
  Anwendung das Band „Beispielfragen — noch nicht der amtliche Katalog".
- `pruefen: true` setzt das Importskript bei Fragen, die es nicht sauber
  lesen konnte; die Admin-Seite „Inhalte" listet sie auf.

## Prüfungsregeln `zertifikat.json`

```json
{
  "id": "src",
  "titel": "SRC — Short Range Certificate",
  "kurz": "Beschränkt gültiges Funkbetriebszeugnis für den Seefunk (UKW, GMDSS-Seegebiet A1).",
  "reihenfolge": 1,
  "freigeschaltet": true,
  "praxis": ["funkverkehr", "buchstabieren", "englisch", "dsc"],
  "trainer": { "sicherAb": 2 },
  "pruefung": {
    "_zuPruefen": "Zahlen nach bestem Wissen; gegen die aktuelle Prüfungsordnung abgleichen.",
    "fragenProBogen": 24,
    "zeitMinuten": 30,
    "mindestRichtig": 18,
    "fragenMischen": true,
    "antwortenMischen": true,
    "amtlicheBoegen": "boegen.json",
    "zusammensetzung": { "grundlagen": 6, "verkehrsabwicklung": 8, "dsc-gmdss": 6, "notverkehr": 4 },
    "weitereTeile": [
      { "id": "uebersetzung", "titel": "Übersetzung Englisch → Deutsch, Fragen Deutsch → Englisch", "simuliert": "englisch" },
      { "id": "diktat", "titel": "Aufnahme einer englischen Notmeldung nach Diktat", "simuliert": null },
      { "id": "praxis", "titel": "Praktische Prüfung am Gerät", "simuliert": "dsc" }
    ]
  }
}
```

- `zusammensetzung` muss in Summe `fragenProBogen` ergeben; die Schlüssel sind
  Modul-IDs aus `fragen.json`. Fehlt sie, zieht die Anwendung gleichmäßig.
- `mindestRichtigJeModul` (optional) — eigene Bestehensgrenze je Modul, etwa
  `{ "basis": 5, "see": 18 }` für die Sportbootführerscheine, bei denen
  Basisfragen und spezifische Fragen getrennt zählen. Jedes genannte Modul
  braucht einen Eintrag in `zusammensetzung`; der Wert darf dessen Anzahl nicht
  übersteigen. Bestanden ist eine Prüfung nur, wenn `mindestRichtig` **und**
  alle Modulgrenzen erreicht sind; die Ergebnisseite schlüsselt je Modul auf.
  Bei verkürzten Bögen werden auch die Modulgrenzen anteilig gesenkt.
- `_zuPruefen` — solange dieser Schlüssel existiert, zeigt die Prüfungsseite die
  Fußnote „Regeln nach bestem Wissen; maßgeblich ist die aktuelle
  Prüfungsordnung". Wer die Werte gegen die Prüfungsordnung geprüft hat,
  löscht den Schlüssel.
- `freigeschaltet: false` versteckt das Zeugnis für Lernende; Admins sehen es
  mit Hinweisband. So lässt sich ein Kurs im Betrieb vorbereiten.
- `praxis` — welche Praxismodule der Kurs anbietet: `funkverkehr`,
  `buchstabieren`, `englisch`, `dsc`.
- `trainer.sicherAb` — so viele richtige Antworten in Folge gelten als „sicher".

## Amtliche Bögen `boegen.json` (optional)

```json
{ "quelle": "Amtliche Fragebögen SRC, Stand 2023-08",
  "boegen": [ { "nr": 1, "fragen": [3, 17, 25, 41] } ] }
```

Die Zahlen sind `nr`-Werte aus dem Katalog. Existiert die Datei, bietet die
Prüfungssimulation „amtlicher Bogen Nr. N" zusätzlich zum Zufallsbogen an.

## Übungen

### `uebungen/funkverkehr.json` — Lückentext und Reihenfolge

```json
{
  "uebungen": [
    {
      "id": "mayday-ruf", "typ": "lueckentext", "titel": "Der Notruf",
      "einleitung": "Die Yacht SEEADLER (MMSI 211123450) hat Wassereinbruch, 2 sm südlich des Leuchtturms Kiel.",
      "text": "{{1}} {{1}} {{1}}\nTHIS IS {{2}} {{2}} {{2}}\nMMSI {{3}}\n{{1}} {{2}}\nPOSITION {{4}}\n{{5}}\nI REQUIRE IMMEDIATE ASSISTANCE\n{{6}}",
      "luecken": {
        "1": { "loesung": ["MAYDAY"], "hinweis": "das Notzeichen" },
        "2": { "loesung": ["SEEADLER"] },
        "3": { "loesung": ["211123450"] },
        "4": { "loesung": ["2 NM SOUTH OF KIEL LIGHTHOUSE", "2 MILES SOUTH OF KIEL LIGHTHOUSE"] },
        "5": { "loesung": ["WE ARE TAKING WATER", "TAKING WATER"] },
        "6": { "loesung": ["OVER"] }
      }
    },
    {
      "id": "notmeldung-aufbau", "typ": "reihenfolge", "titel": "Aufbau der Notmeldung",
      "einleitung": "Bringe die Bestandteile in die richtige Reihenfolge.",
      "elemente": ["MAYDAY (dreimal)", "THIS IS + Name (dreimal), MMSI", "MAYDAY + Name, MMSI", "Position", "Art der Not", "Erbetene Hilfe", "OVER"],
      "loesung": [0, 1, 2, 3, 4, 5, 6]
    }
  ]
}
```

- Lückentext: `{{n}}` im Text; dieselbe Nummer darf mehrfach vorkommen und wird
  dann jeweils abgefragt. Verglichen wird ohne Groß-/Kleinschreibung,
  Satzzeichen und doppelte Leerzeichen; bei Wörtern ab sechs Zeichen ist ein
  Tippfehler erlaubt (halber Punkt).
- Reihenfolge: `elemente` in der Reihenfolge, wie sie angezeigt werden dürfen
  (die Anwendung mischt); `loesung` ist die richtige Abfolge als Indizes.

### `uebungen/englisch.json` — Übersetzung

```json
{
  "uebungen": [
    {
      "id": "en-de-01", "richtung": "en-de", "titel": "Sicherheitsmeldung",
      "quelle": "SÉCURITÉ SÉCURITÉ SÉCURITÉ. ALL SHIPS ALL SHIPS ALL SHIPS. THIS IS BREMEN RESCUE. A CONTAINER IS ADRIFT IN POSITION 54 10 NORTH 007 50 EAST. DANGER TO NAVIGATION. OUT.",
      "musterloesung": "Sicherheitsmeldung an alle Schiffe von Bremen Rescue: Ein Container treibt auf Position 54°10' N, 007°50' E. Gefahr für die Schifffahrt.",
      "schluesselwoerter": [["Container"], ["treibt", "treibend", "abgetrieben"], ["Position"], ["Gefahr"]],
      "mindestTreffer": 3
    }
  ]
}
```

`richtung` ist `en-de` oder `de-en`. Jeder Eintrag in `schluesselwoerter` ist
eine Liste von Schreibvarianten; ein Treffer je Eintrag genügt. Die Anwendung
zeigt nach der Eingabe die Musterlösung, markiert gefundene Schlüsselwörter
und lässt den Lernenden selbst bewerten (richtig / teilweise / falsch).

### `gemeinsam/buchstabiertafel.json`

```json
{
  "buchstaben": { "A": "Alfa", "B": "Bravo" },
  "ziffern": { "0": "Nadazero", "1": "Unaone" },
  "varianten": { "Alfa": ["Alpha"], "Juliett": ["Juliet"] },
  "woerter": ["SEEADLER", "KIEL", "CUXHAVEN"]
}
```

### `dsc/szenarien.json`

Siehe Kommentar in der Datei selbst; jedes Szenario beschreibt eine Lage und
die erwartete Bedienfolge am simulierten Controller.

## Amtliche Fragenkataloge importieren

Die amtlichen Kataloge (SRC, UBI, LRC auf elwis.de; FKN bei DSV/DMYV) sind
amtliche Werke und dürfen übernommen werden. Die Lektionstexte bleiben eigenes
Werk.

Voraussetzung: `pdftotext` (Paket `poppler-utils`). Alternativ die PDF
anderweitig als Text speichern und mit `--txt` übergeben.

```bash
php sbfkurs/werkzeuge/katalog-import.php \
    --profil sbfkurs/werkzeuge/import-profile/elwis-src.json \
    --pdf ~/Downloads/Fragenkatalog-SRC.pdf \
    --ziel sbfkurs/content/src/fragen.json \
    --zusammenfuehren
```

Die Kataloge zu den Sportbootführerscheinen bestehen aus mehreren Dateien
(Basisfragen, spezifische Fragen See bzw. Binnen und Segeln). `--pdf` und
`--txt` dürfen deshalb mehrfach vorkommen; die Fragennummern laufen über die
Dateien durch, und das Profil ordnet die Module über `modulNachNummer`
(Nummernbereiche) statt über Überschriften zu:

```bash
php sbfkurs/werkzeuge/katalog-import.php \
    --profil sbfkurs/werkzeuge/import-profile/elwis-sbf-see.json \
    --pdf ~/Downloads/Basisfragen.pdf \
    --pdf ~/Downloads/Spezifische-Fragen-See.pdf \
    --ziel sbfkurs/content/see/fragen.json \
    --zusammenfuehren
```

Für den SBF Binnen kommt `--pdf Spezifische-Fragen-Segeln.pdf` hinzu (Profil
`elwis-sbf-binnen.json`). Die Bereichsgrenzen in den Profilen sind Annahmen —
nach dem Import zeigt der Bericht die Fragenzahl je Modul; stimmt sie nicht mit
dem Katalog überein, die Grenzen im Profil anpassen und erneut importieren.

Was passiert:

1. Text extrahieren, Kopf- und Fußzeilen nach dem Profil entfernen,
   Silbentrennungen am Zeilenende zusammenziehen.
2. Fragen und Antworten nach den regulären Ausdrücken im Profil erkennen.
   Das Textlayout der PDFs ist von Ausgabe zu Ausgabe verschieden — passt ein
   Muster nicht, wird es im Profil angepasst, nicht im Skript.
3. Bericht schreiben: `content/<zert>/import-bericht.json` listet Fragen ohne
   vier Antworten, mit Bildverweis oder auffällig kurzem Text. Diese Fragen
   bekommen `pruefen: true`.
4. Mit `--zusammenfuehren` bleiben `hinweis`, `lektion` und `bild` der
   bestehenden Datei je `id` erhalten; Beispielfragen werden verworfen.
5. Am Ende läuft dieselbe Validierung wie `katalog-pruefen.php`. Bei Fehlern
   landet das Ergebnis in `fragen.import.json` daneben, die alte Datei bleibt.

Bilder: `pdfimages -png Katalog.pdf content/<zert>/bilder/roh` extrahiert alle
Abbildungen; die passenden werden umbenannt (`<frage-id>.png`) und im JSON unter
`bild` eingetragen.

Nach dem Import: `quelle.amtlich` auf `true` setzen, `stand` eintragen,
Prüfungsregeln in `zertifikat.json` gegen die aktuelle Prüfungsordnung
abgleichen und den Schlüssel `_zuPruefen` entfernen.

## Prüfen

```bash
php sbfkurs/werkzeuge/katalog-pruefen.php     # alle Zeugnisse
php sbfkurs/tests/lauf.php                    # Anwendungstests
```

Beides läuft auch im Workflow „SBF-Kurs einrichten" vor dem Deploy — mit
kaputten Inhalten wird nichts übertragen.
