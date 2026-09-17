Nach Prinzip und Anrufarten geht es jetzt an das Gerät: Was drückst du in welcher Reihenfolge, und was tust du, wenn bei dir ein Alarm eintrifft? Die Bedienoberflächen unterscheiden sich je nach Hersteller, die Abläufe sind überall gleich — und genau sie werden im praktischen Teil der Prüfung abgefragt.

## Vor dem Auslaufen

Ein DSC-Controller hilft nur, wenn er richtig eingerichtet ist. Prüfe beim Einschalten:

- Zeigt das Gerät eine **aktuelle Position** und die Uhrzeit? Wenn nicht: GPS-Verbindung prüfen oder Position von Hand eingeben.
- Ist die **MMSI** programmiert? Sie lässt sich nach der ersten Eingabe meist nur noch durch den Fachhändler ändern.
- Steht die Anlage auf **Kanal 16** mit passender Rauschsperre?
- Sind die MMSIs von Bremen Rescue und der Begleitboote im Adressbuch? Das spart im Ernstfall Zeit.

## Den Notalarm auslösen

Die rote DISTRESS-Taste sitzt unter einer Schutzklappe gegen versehentliches Auslösen. Der Ablauf:

1. **Klappe öffnen.**
2. Wenn die Zeit es zulässt: die **Art der Not** wählen — meist über ein Menü, das sich mit kurzem Druck auf die DISTRESS-Taste öffnet: _Flooding_, _Fire_, _Collision_, _Grounding_, _Sinking_, _Man overboard_ und andere. Ohne Auswahl geht der Alarm als _Undesignated_ hinaus; das ist zulässig, wenn es schnell gehen muss.
3. Die DISTRESS-Taste **gedrückt halten**, bis das Gerät den Alarm bestätigt — mindestens drei bis fünf Sekunden. Ein Countdown auf dem Display zeigt den Fortschritt. Ein kurzer Druck löst absichtlich nichts aus.
4. Das Gerät sendet den Alarm auf Kanal 70 und **schaltet automatisch auf Kanal 16**.
5. Nun folgt der Sprechfunk: **Notruf und Notmeldung** auf Kanal 16, wie in der Lektion zum Notverkehr beschrieben. Trifft die DSC-Quittung der Küstenfunkstelle ein, bestätigt das Gerät sie mit einem Ton und zeigt sie an; wartest du kurz und es kommt keine, sprichst du trotzdem.

Bis eine Quittung eintrifft, wiederholt das Gerät den Alarm selbsttätig alle paar Minuten.

:::merke
DISTRESS-Taste mindestens drei bis fünf Sekunden halten, bis das Gerät den Alarm bestätigt. Danach wechselt die Anlage auf Kanal 16 — dort folgen Notruf und Notmeldung im Sprechfunk.
:::

:::funk
(Der Controller sendet: DISTRESS ALERT — MMSI 211123450 — FLOODING — 54°22'N 010°10'E — 1425 UTC)
(Das Gerät schaltet auf Kanal 16)
SEEADLER: MAYDAY MAYDAY MAYDAY, THIS IS SEEADLER SEEADLER SEEADLER, MMSI TWO ONE ONE ONE TWO THREE FOUR FIVE ZERO
SEEADLER: MAYDAY SEEADLER, MMSI TWO ONE ONE ONE TWO THREE FOUR FIVE ZERO, POSITION FIVE FOUR DEGREES TWO TWO MINUTES NORTH, ZERO ONE ZERO DEGREES ONE ZERO MINUTES EAST, WE ARE TAKING WATER, I REQUIRE IMMEDIATE ASSISTANCE, FOUR PERSONS ON BOARD, OVER
BREMEN RESCUE: MAYDAY, SEEADLER SEEADLER SEEADLER, THIS IS BREMEN RESCUE BREMEN RESCUE BREMEN RESCUE, RECEIVED MAYDAY, OVER
:::

## Die Quittung

Die **Notalarmquittung** (_Distress Acknowledgement_) per DSC ist Sache der Küstenfunkstelle beziehungsweise Rettungsleitstelle. Sie stoppt die Wiederholung beim Havaristen und signalisiert: Die Rettung ist informiert. Als Sportbootfahrer sendest du im Seegebiet A1 **keine DSC-Quittung**. Empfängst du einen Notalarm:

1. Alarmton am Gerät quittieren — das ist nur das Stummschalten, keine Aussendung.
2. Angezeigte Daten notieren: MMSI, Position, Uhrzeit, Art der Not.
3. Auf **Kanal 16** mithören. Meldet sich die Küstenfunkstelle, bleibst du still und hältst dich bereit.
4. Bleibt die Bestätigung der Küstenfunkstelle aus und du könntest helfen, bestätigst du im **Sprechfunk** auf Kanal 16 mit RECEIVED MAYDAY.

Der Grund: Eine DSC-Quittung von einem Schiff stoppt die Wiederholung des Alarms — und womöglich hat die Küstenfunkstelle ihn dann noch gar nicht empfangen.

## Notalarmweiterleitung (Distress Relay)

Wenn der Havarist selbst nicht senden kann oder sein Alarm unbestätigt bleibt, leitest du weiter. Bietet dein Gerät die Funktion, adressierst du das **Distress Relay an die Küstenfunkstelle** — nicht an alle Schiffe; das würde überall Alarm auslösen und ist der Rettungsleitstelle vorbehalten. Viele Klasse-D-Geräte haben die Funktion nicht; dann sendest du **MAYDAY RELAY** im Sprechfunk auf Kanal 16.

## Der Routineanruf am Gerät

Der individuelle Anruf ersetzt den Anruf auf Kanal 16:

1. Menü **Call** oder **DSC** öffnen und **Individual** wählen.
2. Die MMSI der Gegenstation eingeben oder aus dem Adressbuch wählen.
3. Kategorie **Routine** bestätigen.
4. Den gewünschten **Arbeitskanal** wählen, etwa Kanal 72 für ein anderes Sportboot.
5. **Send** — das Gerät sendet den Anruf auf Kanal 70.
6. Nach der Quittung schaltet das Gerät auf den Arbeitskanal; dort rufst du im Sprechfunk an.

:::beispiel
An Bord der MÖWE ertönt ein Hinweiston. Das Display zeigt: „Individual Call — ALBATROS — 211987650 — Routine — Ch 72". Das Gerät quittiert automatisch und wechselt auf Kanal 72. Kurz darauf: „MÖWE, THIS IS ALBATROS, OVER". Kanal 16 wurde nicht ein einziges Mal belegt.
:::

Bei einer Küstenfunkstelle gibst du keinen Arbeitskanal an — sie legt ihn in ihrer Quittung fest.

## Fehlalarm

Hat jemand versehentlich die DISTRESS-Taste zu lange gehalten, handelst du sofort:

1. Am Gerät den Alarm **abbrechen** (_Cancel_) — das beendet die automatische Wiederholung. Ausschalten allein widerruft nichts.
2. Auf Kanal 16 den Fehlalarm im Sprechfunk **widerrufen**: MAYDAY, ALL STATIONS ×3, THIS IS + Name, MMSI, Position, CANCEL MY DISTRESS ALERT OF + Uhrzeit UTC, OUT.
3. Auf Rückfragen der Küstenfunkstelle antworten.

:::achtung
Niemals einen Notalarm „zum Üben" auslösen — auch nicht mit abgeschalteter Antenne. Für Tests gibt es die Testfunktion des Controllers und den Radio Check im Sprechfunk.
:::

## Empfang eines Anrufs an alle Schiffe

Trifft ein _All Ships Call_ der Kategorie Urgency oder Safety ein, schaltet das Gerät auf den angegebenen Sprechfunkkanal, meist Kanal 16. Du hörst die PAN-PAN- oder SÉCURITÉ-Meldung mit und notierst, was für dich relevant ist; eine Antwort ist nur nötig, wenn du angesprochen wirst oder helfen kannst.

## Das Wichtigste in Kürze

- Notalarm: Klappe öffnen, Art der Not wählen, DISTRESS-Taste mindestens drei bis fünf Sekunden halten; das Gerät wechselt auf Kanal 16, dann Notruf und Notmeldung im Sprechfunk.
- Der Alarm wird automatisch wiederholt, bis die Küstenfunkstelle per DSC quittiert.
- Empfangene Notalarme quittierst du nicht per DSC, sondern hörst Kanal 16 mit und bestätigst nur im Sprechfunk, wenn keine Küstenfunkstelle antwortet.
- Distress Relay per DSC nur an die Küstenfunkstelle; sonst MAYDAY RELAY im Sprechfunk.
- Routineanruf: Individual Call, MMSI, Routine, Arbeitskanal, Send — dann Sprechfunk auf dem Arbeitskanal.
- Fehlalarm am Gerät abbrechen und auf Kanal 16 im Sprechfunk widerrufen.
