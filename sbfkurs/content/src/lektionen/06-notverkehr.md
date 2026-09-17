Die Verfahren des Not-, Dringlichkeits- und Sicherheitsverkehrs sind das Herzstück des SRC — der Teil, den du im Schlaf können musst, denn wenn Wasser ins Boot läuft, bleibt keine Zeit zum Nachschlagen. Diese Lektion erklärt die drei Stufen, den Aufbau von Notruf und Notmeldung, die Bestätigung, die Funkstille und ihre Aufhebung.

## Die drei Stufen

Drei Signalwörter mit fester Bedeutung und Rangfolge:

| Signal | Stufe | Bedeutung |
|---|---|---|
| MAYDAY | Not | Ein Schiff oder ein Mensch befindet sich in **schwerer und unmittelbarer Gefahr** und braucht **sofortige Hilfe**. |
| PAN PAN | Dringlichkeit | Eine **dringende Meldung** betrifft die Sicherheit eines Schiffes oder einer Person — aber es besteht keine unmittelbare Lebensgefahr. |
| SÉCURITÉ | Sicherheit | Es folgt eine **Warnung** für die Schifffahrt oder eine Wetterwarnung. |

Notverkehr geht vor Dringlichkeitsverkehr, dieser vor Sicherheitsverkehr, und alle drei vor Routineverkehr. Eingeleitet werden sie auf **Kanal 16** mit voller Leistung.

:::merke
MAYDAY nur, wenn Schiff oder Menschenleben in schwerer, unmittelbarer Gefahr sind und sofort Hilfe nötig ist. Bei Maschinenausfall in ruhiger See oder einem Verletzten ohne Lebensgefahr ist PAN PAN das richtige Signal.
:::

## Notruf und Notmeldung

Der Notverkehr im Sprechfunk besteht aus zwei Teilen, die unmittelbar aufeinander folgen. Zuerst der **Notruf** — er macht alle auf Kanal 16 aufmerksam:

1. MAYDAY MAYDAY MAYDAY
2. THIS IS + Schiffsname (dreimal)
3. Rufzeichen und MMSI

Dann die **Notmeldung** mit dem Inhalt:

1. MAYDAY + Schiffsname, Rufzeichen, MMSI
2. **Position** — Breite und Länge oder Peilung und Abstand von einem markanten Punkt
3. **Art der Not** — was ist passiert
4. **Art der erbetenen Hilfe**
5. weitere nützliche Angaben — Anzahl der Personen, Zustand des Schiffes, Beschreibung des Bootes
6. OVER

:::funk
SEEADLER: MAYDAY MAYDAY MAYDAY
SEEADLER: THIS IS SEEADLER SEEADLER SEEADLER, CALL SIGN DELTA KILO FOUR SEVEN ONE ONE, MMSI TWO ONE ONE ONE TWO THREE FOUR FIVE ZERO
SEEADLER: MAYDAY SEEADLER, CALL SIGN DELTA KILO FOUR SEVEN ONE ONE, MMSI TWO ONE ONE ONE TWO THREE FOUR FIVE ZERO
SEEADLER: POSITION TWO MILES SOUTH OF KIEL LIGHTHOUSE
SEEADLER: WE ARE TAKING WATER, I REQUIRE IMMEDIATE ASSISTANCE
SEEADLER: FOUR PERSONS ON BOARD, WHITE SAILING YACHT TWELVE METRES
SEEADLER: OVER
:::

Den Notruf setzt der Schiffsführer ab oder die von ihm beauftragte Person — im Ernstfall aber lieber irgendjemand als niemand. Die feste Reihenfolge stellt sicher, dass das Wichtigste zuerst gesagt ist, falls die Verbindung abbricht. Bei einer Anlage mit DSC löst du **vor** dem Sprechfunk den DSC-Notalarm aus (siehe Lektion zum DSC-Controller).

## Die Bestätigung

Wer eine Notmeldung hört, muss den Notverkehr weiter mitverfolgen. Bestätigt wird sie durch die **Küstenfunkstelle** beziehungsweise Rettungsleitstelle. Schiffe im Seegebiet A1 warten kurz, damit die Landstelle den Vorrang hat; bleibt die Bestätigung aus, bestätigt das Schiff, das helfen kann:

:::funk
BREMEN RESCUE: MAYDAY
BREMEN RESCUE: SEEADLER SEEADLER SEEADLER
BREMEN RESCUE: THIS IS BREMEN RESCUE BREMEN RESCUE BREMEN RESCUE
BREMEN RESCUE: RECEIVED MAYDAY
BREMEN RESCUE: OVER
:::

Mit der Bestätigung übernimmt die Küstenfunkstelle in der Regel die **Leitung des Notverkehrs**: Sie fordert weitere Angaben an, alarmiert Rettungseinheiten und koordiniert Schiffe in der Nähe. Ist keine Landstelle erreichbar, leitet das Schiff in Not oder das bestätigende Schiff.

## Funkstille

Während des Notverkehrs gilt auf Kanal 16 **Funkstille** für alle Unbeteiligten. Sie kann ausdrücklich angeordnet werden:

- **SEELONCE MAYDAY** — angeordnet von der Station in Not oder von der Station, die den Notverkehr leitet.
- **SEELONCE DISTRESS** — angeordnet von jeder anderen Station, die den Notverkehr gestört sieht.

Die Schreibweise geht auf das französische _silence_ zurück. Wer die Funkstille bricht, gefährdet Menschenleben — und macht sich strafbar.

## Weiterleitung: MAYDAY RELAY

In drei Fällen sendest du eine Notmeldung für ein anderes Schiff: Es kann selbst nicht senden, du hörst eine Notmeldung, die niemand bestätigt, oder die Leitstelle bittet um weitere Hilfe. Der Ruf lautet dann **MAYDAY RELAY** (dreimal), THIS IS und dein Name (dreimal), Rufzeichen und MMSI, dann MAYDAY und die Angaben des Schiffes in Not. Du nennst also deinen eigenen Namen, aber die Position und Not des anderen.

## Aufhebung

Ist die Not vorüber, hebt die leitende Station die Funkstille auf: MAYDAY, ALL STATIONS (dreimal), THIS IS + Station, Uhrzeit UTC, Name des Schiffes, das in Not war, **SEELONCE FEENEE**, OUT. Kann der Notverkehr eingeschränkt, aber noch nicht aufgehoben werden, lautet das Signalwort **PRUDONCE**: Routineverkehr ist vorsichtig wieder erlaubt, Vorrang behält der Notverkehr.

:::funk
BREMEN RESCUE: MAYDAY, ALL STATIONS ALL STATIONS ALL STATIONS
BREMEN RESCUE: THIS IS BREMEN RESCUE BREMEN RESCUE BREMEN RESCUE
BREMEN RESCUE: ONE FOUR THREE ZERO UTC, SEEADLER, MMSI TWO ONE ONE ONE TWO THREE FOUR FIVE ZERO
BREMEN RESCUE: SEELONCE FEENEE
BREMEN RESCUE: OUT
:::

## PAN PAN und SÉCURITÉ

Die **Dringlichkeitsmeldung** folgt dem Muster des Notrufs, nur mit PAN PAN (dreimal) statt MAYDAY und mit einem Adressaten: ALL STATIONS (dreimal) oder eine bestimmte Küstenfunkstelle. Danach THIS IS, Schiffsname, Rufzeichen, MMSI, Position, was los ist, welche Hilfe du brauchst, OVER. Typische Anlässe: ein Verletzter, Ruderbruch oder Maschinenausfall ohne unmittelbare Gefahr.

Die **Sicherheitsmeldung** beginnt mit SÉCURITÉ (dreimal), geht an ALL STATIONS oder eine Station und enthält eine Warnung — ein treibender Container, ein erloschenes Feuer, ein Sturmtief. Der Anruf erfolgt auf Kanal 16, eine längere Meldung auf einem Arbeitskanal.

## Falscher Alarm

Einen irrtümlich ausgelösten Notalarm brichst du am Gerät ab und widerrufst ihn sofort im Sprechfunk: MAYDAY, ALL STATIONS (dreimal), THIS IS, Name, MMSI, Position, **CANCEL MY DISTRESS ALERT OF** Uhrzeit UTC, OUT.

:::achtung
Notverkehr immer mit Uhrzeit ins Logbuch eintragen — auch wenn du nur zugehört hast.
:::

## Das Wichtigste in Kürze

- MAYDAY: schwere, unmittelbare Gefahr, sofortige Hilfe. PAN PAN: dringend, aber keine Lebensgefahr. SÉCURITÉ: Warnung.
- Notruf: MAYDAY ×3, THIS IS + Name ×3, Rufzeichen, MMSI. Notmeldung: MAYDAY + Name, Position, Art der Not, erbetene Hilfe, weitere Angaben, OVER.
- Bestätigung durch die Küstenfunkstelle: MAYDAY, Name des Havaristen ×3, THIS IS + eigener Name ×3, RECEIVED MAYDAY, OVER.
- Funkstille: SEELONCE MAYDAY (Havarist oder Leitstelle), SEELONCE DISTRESS (andere). Aufhebung: SEELONCE FEENEE, Einschränkung: PRUDONCE.
- MAYDAY RELAY, wenn du für ein anderes Schiff Not weiterleitest; Fehlalarm sofort widerrufen; alles ins Logbuch.
