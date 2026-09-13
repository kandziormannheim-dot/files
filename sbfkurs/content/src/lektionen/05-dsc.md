Der digitale Selektivruf — kurz **DSC** für _Digital Selective Calling_ — ist der Baustein, der den UKW-Seefunk ins GMDSS geholt hat. Er ersetzt nicht den Sprechfunk, sondern geht ihm voraus: DSC klingelt, gesprochen wird danach. In dieser Lektion lernst du das Prinzip, die vier Kategorien und die wichtigsten Anrufarten kennen.

## Das Prinzip

Vor DSC musste jemand ständig Kanal 16 abhören, um einen Anruf oder Notruf mitzubekommen. DSC macht den Anruf zu einem kurzen **Datentelegramm**, das auf **Kanal 70** gesendet wird. Ein eigener Wachempfänger im Gerät überwacht Kanal 70 dauerhaft; empfängt er einen Anruf, der an die eigene MMSI, an alle Schiffe oder an eine Gruppe gerichtet ist, schlägt das Gerät Alarm und zeigt die Daten an. Der eigentliche Verkehr — das Gespräch — findet anschließend im Sprechfunk auf Kanal 16 oder einem Arbeitskanal statt.

Ein DSC-Anruf enthält immer die **MMSI des Absenders**, die Kennung des Adressaten, die **Kategorie** des Anrufs und den gewünschten Folgeverkehr, meist Sprechfunk auf einem bestimmten Kanal. Ein Notalarm enthält zusätzlich Position, Uhrzeit und die Art der Not. Weil die MMSI fest im Gerät programmiert ist, weiß der Empfänger sofort, wer ruft — auch wenn niemand mehr sprechen kann.

:::merke
Kanal 70 ist ausschließlich für DSC reserviert. Auf Kanal 70 wird niemals gesprochen; nach dem DSC-Anruf wechseln beide Stationen auf den Sprechfunkkanal.
:::

## Geräteklassen

DSC-Controller gibt es in mehreren Klassen. Berufsschiffe unter SOLAS fahren Anlagen der **Klasse A** mit vollem Funktionsumfang. In der Sportschifffahrt sind Geräte der **Klasse D** üblich: eine UKW-Anlage mit eingebautem DSC-Controller und einem eigenen Wachempfänger für Kanal 70. Sie beherrschen Notalarm, Notalarmquittung, Anrufe an einzelne Stationen, an alle Schiffe und an Gruppen. Die Bedienung unterscheidet sich von Hersteller zu Hersteller, die Verfahren sind aber genormt.

## Die vier Kategorien

Jeder DSC-Anruf trägt eine Kategorie, die seine Dringlichkeit festlegt. Sie entsprechen den Stufen des Sprechfunks:

| Kategorie | Sprechfunk-Entsprechung | Anlass |
|---|---|---|
| Distress (Not) | MAYDAY | schwere, unmittelbare Gefahr für Schiff oder Menschenleben; sofortige Hilfe nötig |
| Urgency (Dringlichkeit) | PAN PAN | Sicherheit von Schiff oder Person bedroht, aber keine unmittelbare Lebensgefahr |
| Safety (Sicherheit) | SÉCURITÉ | Navigations- oder Wetterwarnung |
| Routine | — | alltäglicher Verkehr, z. B. Anruf eines anderen Bootes |

Die Kategorie bestimmt, wie das Gerät der Gegenstation reagiert. Ein Distress- oder Urgency-Anruf löst einen lauten Alarm aus, ein Routineanruf einen dezenten Hinweiston. Die Kategorie muss zur Lage passen — ein Routineanruf ist kein Not-Ersatz, und ein Notalarm für eine Bagatelle ist Missbrauch.

## Die Anrufarten

### Notalarm (Distress Alert)

Der Notalarm ist der Grund, warum es DSC gibt. Er wird mit der roten **DISTRESS**-Taste ausgelöst und geht an **alle Stationen**. Er enthält MMSI, Position, Uhrzeit und — falls du sie vorher gewählt hast — die Art der Not, etwa _Flooding_, _Fire_, _Collision_, _Grounding_, _Sinking_ oder _Man overboard_. Wählst du nichts, geht der Alarm als _Undesignated_ hinaus. Das Gerät wiederholt den Alarm automatisch in Abständen von wenigen Minuten, bis eine Quittung eintrifft.

### Notalarmquittung (Distress Acknowledgement)

Die Quittung bestätigt dem Havaristen, dass sein Alarm empfangen wurde, und stoppt die automatische Wiederholung. Im Seegebiet A1 quittiert die **Küstenfunkstelle** beziehungsweise die Rettungsleitstelle. Schiffe quittieren per DSC grundsätzlich nicht — sie würden die Wiederholung abschalten, obwohl vielleicht noch keine Landstelle den Alarm gehört hat. Ein Schiff, das den Alarm empfängt, bestätigt stattdessen im Sprechfunk auf Kanal 16, sofern keine Küstenfunkstelle das übernimmt.

### Notalarmweiterleitung (Distress Relay)

Kann ein Schiff in Not selbst keinen Alarm senden, oder hörst du einen Notalarm, den niemand quittiert, leitest du die Not weiter. Per DSC richtet sich die Weiterleitung an die Küstenfunkstelle; viele Klasse-D-Geräte bieten diese Funktion nicht, dann erfolgt die Weiterleitung als MAYDAY RELAY im Sprechfunk.

### Anruf an alle Schiffe (All Ships Call)

Ein Anruf an alle Stationen in Reichweite, in den Kategorien Urgency oder Safety. Damit kündigt eine Küstenfunkstelle zum Beispiel eine Sturmwarnung an, oder ein Schiff bittet nach einem Mann-über-Bord-Unfall alle in der Nähe um Ausschau. Der anschließende Sprechfunk läuft auf Kanal 16.

### Individueller Anruf (Individual Call)

Der Anruf an eine bestimmte MMSI — die DSC-Form des Routineanrufs. Du gibst die MMSI der Gegenstation ein, wählst den gewünschten Arbeitskanal und sendest. Das Gerät der Gegenstation quittiert, oft automatisch, und stellt den vorgeschlagenen Kanal ein. Dann rufst du dort im Sprechfunk an, wie du es aus der Verkehrsabwicklung kennst. Kanal 16 bleibt dabei unbenutzt.

### Gruppenanruf (Group Call)

Ein Anruf an alle Schiffe mit derselben Gruppen-MMSI, etwa die Teilnehmer einer Regatta oder eines Flottillentörns.

:::beispiel
Die Yacht ALBATROS möchte die MÖWE erreichen, ohne Kanal 16 zu belegen. Der Skipper wählt am Controller _Individual Call_, gibt die MMSI der MÖWE ein, Kategorie _Routine_, Arbeitskanal 72, und sendet. An Bord der MÖWE piept das Gerät, zeigt „ALBATROS, 211xxxxxx, Routine, Ch 72" und schaltet nach der Quittung auf Kanal 72. Dort beginnt das Gespräch: „MÖWE, THIS IS ALBATROS, OVER".
:::

## Position und Zeit

Ein Notalarm ist nur so gut wie die Position, die er enthält. Ist der DSC-Controller mit dem GPS verbunden, übernimmt er Position und Uhrzeit laufend. Fehlt die Verbindung, musst du beide **von Hand eingeben** und regelmäßig aktualisieren — ein veralteter Eintrag schickt die Retter an die falsche Stelle. Prüfe deshalb beim Einschalten der Anlage, ob die Position angezeigt wird.

:::achtung
Ein DSC-Notalarm ohne gültige Position verliert seinen größten Vorteil. Sorge dafür, dass der Controller mit dem GPS verbunden ist, oder trage die Position manuell ein.
:::

## Das Wichtigste in Kürze

- DSC ist ein digitaler Anruf auf Kanal 70; das Gespräch folgt im Sprechfunk auf Kanal 16 oder einem Arbeitskanal.
- Vier Kategorien: Distress, Urgency, Safety, Routine — sie entsprechen MAYDAY, PAN PAN, SÉCURITÉ und Routineverkehr.
- Anrufarten: Notalarm, Notalarmquittung, Notalarmweiterleitung, Anruf an alle Schiffe, individueller Anruf, Gruppenanruf.
- Der Notalarm enthält MMSI, Position, Zeit und Art der Not und wird automatisch wiederholt, bis eine Küstenfunkstelle quittiert.
- Position und Zeit müssen stimmen: GPS anschließen oder manuell eintragen und aktuell halten.
