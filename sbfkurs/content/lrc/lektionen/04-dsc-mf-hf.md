Den digitalen Selektivruf kennst du von Kanal 70: ein kurzes Datentelegramm, das eine Station gezielt anspricht oder einen Notalarm mit MMSI und Position an alle sendet. Auf Grenz- und Kurzwelle funktioniert DSC nach demselben Prinzip, aber es gibt keinen einzelnen Kanal 70, sondern eine feste DSC-Frequenz im Grenzwellenbereich und je eine in jedem Kurzwellenband. Welche du wählst, entscheidet darüber, ob dein Alarm ankommt.

## Die DSC-Frequenzen

Für Not-, Dringlichkeits- und Sicherheitsverkehr per DSC sind international festgelegt:

| Band | DSC-Notfrequenz | zugehörige Sprechfunk-Notfrequenz | zugehörige NBDP-Notfrequenz |
|---|---|---|---|
| MF | 2187,5 kHz | 2182 kHz | 2174,5 kHz |
| 4 MHz | 4207,5 kHz | 4125 kHz | 4177,5 kHz |
| 6 MHz | 6312 kHz | 6215 kHz | 6268 kHz |
| 8 MHz | 8414,5 kHz | 8291 kHz | 8376,5 kHz |
| 12 MHz | 12577 kHz | 12290 kHz | 12520 kHz |
| 16 MHz | 16804,5 kHz | 16420 kHz | 16695 kHz |

Die drei Frequenzen eines Bandes gehören zusammen: DSC-Alarm auf der DSC-Frequenz, anschließend Notverkehr per Sprechfunk oder Fernschreiben auf den zugehörigen Frequenzen. Der Controller nimmt dir den Wechsel meist ab, aber du musst die Zuordnung kennen.

Für Routineverkehr per DSC gibt es eigene Frequenzen: Auf Grenzwelle ruft ein Schiff ein anderes Schiff auf 2177 kHz und eine Küstenfunkstelle auf 2189,5 kHz. Auf Kurzwelle haben Küstenfunkstellen nationale DSC-Anruffrequenzen in jedem Band (ITU-Liste der Küstenfunkstellen). Auf den Notfrequenzen sind Routineanrufe verboten.

:::merke
2187,5 kHz ist die DSC-Notfrequenz auf Grenzwelle, 2182 kHz die Sprechfunk-Notfrequenz. Auf Kurzwelle gilt in jedem Band das gleiche Paar: 8414,5 kHz DSC → 8291 kHz Sprechfunk, und so weiter für 4, 6, 12 und 16 MHz.
:::

## Wache auf DSC

Der Wachempfänger scannt mehrere Frequenzen nacheinander: ständig 2187,5 kHz und 8414,5 kHz plus mindestens eine weitere HF-DSC-Notfrequenz passend zur Tageszeit — tagsüber eher 12577 oder 16804,5 kHz, nachts 4207,5 oder 6312 kHz.

## Der Notalarm

Der Notalarm (Distress Alert) auf MF/HF enthält dieselben Angaben wie auf UKW: deine MMSI, die Art der Not, die Position mit Uhrzeit (UTC) und die gewünschte Betriebsart für den Folgeverkehr — im Normalfall Sprechfunk (J3E). Position und Zeit kommen vom angeschlossenen GNSS-Empfänger; fällt der aus, gibst du sie von Hand ein.

Auf Kurzwelle kommt eine Entscheidung dazu, die es auf UKW nicht gibt: **Auf welcher Frequenz senden?**

- **Einzelfrequenz-Alarm**: Du wählst ein Band, etwa 8 MHz, und sendest nur dort. Sinnvoll, wenn du weißt, welche Küstenfunkstelle in Reichweite ist und welches Band gerade trägt.
- **Mehrfrequenz-Alarm**: Der Controller sendet den Alarm nacheinander auf bis zu sechs DSC-Notfrequenzen (MF und HF). Das dauert länger, erhöht aber die Chance, dass irgendeine Station dich hört — die richtige Wahl, wenn du dir über die Ausbreitung nicht sicher bist.

Der Alarm wird ausgelöst, indem du die abgedeckte DISTRESS-Taste mindestens drei Sekunden gedrückt hältst. Danach wiederholt der Controller den Alarm automatisch in Abständen von wenigen Minuten (zwischen dreieinhalb und viereinhalb Minuten), bis eine Quittung eintrifft oder du den Alarm abbrichst. Zwischen den Wiederholungen schaltet die Anlage auf die zugehörige Sprechfunkfrequenz, damit du die Quittung hörst.

:::beispiel
Nachts im Atlantik, 600 sm vom nächsten Land, Wassereinbruch. Du wählst DISTRESS, Art der Not „Flooding", prüfst Position und Zeit, wählst Mehrfrequenz-Alarm und drückst die Taste drei Sekunden. Nach zwei Minuten kommt die DSC-Quittung einer Küstenfunkstelle im 8-MHz-Band; die Anlage steht bereits auf 8291 kHz, und du setzt dort deine Notmeldung ab.
:::

## Die Quittung

Die **Quittung** (Distress Acknowledgement) ist per DSC allein Sache der Küstenfunkstelle. Sie sendet sie auf derselben DSC-Frequenz, auf der der Alarm ankam; damit enden die automatischen Wiederholungen beim Schiff in Not. Die Küstenfunkstelle alarmiert das zuständige RCC und übernimmt oder vermittelt die Leitung des Notverkehrs auf der Sprechfunkfrequenz.

Was tust du, wenn du einen Notalarm empfängst?

- **Auf Grenzwelle**: Wechsel auf 2182 kHz, mithören. Quittiert innerhalb weniger Minuten keine Küstenfunkstelle und ist der Havarist offensichtlich in deiner Nähe, quittierst du per Sprechfunk auf 2182 kHz und informierst die Küstenfunkstelle oder das RCC. Eine DSC-Quittung durch ein Schiff ist auf MF nur zulässig, wenn keine Küstenfunkstelle erreichbar ist und du selbst Hilfe leisten kannst — und auch dann erst nach einer Wartezeit.
- **Auf Kurzwelle**: **Niemals per DSC quittieren.** Ein HF-Alarm kann von einem Schiff am anderen Ende der Welt stammen; deine Quittung würde die Wiederholungen stoppen, ohne dass ein RCC informiert wäre. Du hörst auf der zugehörigen Sprechfunkfrequenz mit, wartest kurz auf die Quittung einer Küstenfunkstelle und meldest andernfalls den Alarm per Sprechfunk oder über jeden anderen Weg an eine Küstenfunkstelle oder ein RCC.

:::achtung
Wer auf Kurzwelle einen fremden Notalarm per DSC quittiert, kann die Rettung verhindern. Merke dir: Quittung per DSC auf HF kommt ausschließlich von der Küstenfunkstelle.
:::

## Distress Relay

Wenn ein Schiff in Not selbst keinen Alarm senden kann — Funkanlage ausgefallen, Boot gekentert, du beobachtest den Notfall — oder wenn du einen Notalarm empfangen hast, auf den niemand reagiert, sendest du einen **Notalarm-Weiterleitung** (Distress Relay). Auf MF/HF richtest du ihn an eine bestimmte Küstenfunkstelle oder an ein geografisches Gebiet, nie pauschal an alle Schiffe auf allen Bändern: Das würde weltweit Alarme auslösen. Der Relay enthält, soweit bekannt, MMSI oder Name des Havaristen, Position und Art der Not; anschließend folgt die Sprechfunkmeldung mit dem Vorsatz MAYDAY RELAY.

## Weitere DSC-Anrufe

**Dringlichkeits- und Sicherheitsanrufe** gehen an alle Schiffe oder ein Gebiet auf der DSC-Notfrequenz des Bandes; der Folgeverkehr läuft auf der Sprechfunk-Notfrequenz. **Routineanrufe** an eine Küstenfunkstelle sendest du auf deren DSC-Anruffrequenz mit Angabe der gewünschten Arbeitsfrequenz; die Küstenfunkstelle bestätigt oder nennt eine andere. Schiff–Schiff-Routineanrufe laufen auf 2177 kHz mit Vorschlag einer Simplex-Arbeitsfrequenz. Alle DSC-Anrufe enthalten deine MMSI — der Controller muss richtig programmiert sein und die Uhr auf UTC laufen.

## Das Wichtigste in Kürze

- DSC-Notfrequenzen: 2187,5 kHz (MF) und 4207,5 / 6312 / 8414,5 / 12577 / 16804,5 kHz (HF). Jede hat eine zugehörige Sprechfunk-Notfrequenz, auf MF 2182 kHz, auf 8 MHz 8291 kHz.
- Wache: ständig auf 2187,5 und 8414,5 kHz plus eine weitere HF-Frequenz nach Tageszeit.
- Notalarm: DISTRESS mindestens drei Sekunden drücken; auf HF Einzel- oder Mehrfrequenz-Alarm; automatische Wiederholung bis zur Quittung.
- DSC-Quittung ist Sache der Küstenfunkstelle. Auf HF quittieren Schiffe nie per DSC; auf MF nur ausnahmsweise nach Wartezeit.
- Distress Relay auf MF/HF gezielt an eine Küstenfunkstelle oder ein Gebiet, danach MAYDAY RELAY per Sprechfunk.
- Routine-DSC auf MF: 2177 kHz Schiff–Schiff, 2189,5 kHz Schiff–Küste; auf HF nationale Anruffrequenzen der Küstenfunkstellen.
