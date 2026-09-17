Navigation heißt: wissen, wo du bist, und einen Kurs finden, der dich sicher ans Ziel bringt. Für den SBF See brauchst du die terrestrische Navigation mit Seekarte, Kompass und Peilung — und ein Verständnis dafür, was GPS, Plotter und AIS leisten und was nicht. Die Navigationsaufgabe der Prüfung fußt genau auf dieser Lektion.

## Die Seekarte

Seekarten sind in **Mercatorprojektion** gezeichnet: Meridiane und Breitenparallelen stehen rechtwinklig aufeinander, Kurse sind gerade Linien. Der Preis: Der Maßstab wächst mit der Breite — deshalb misst du Entfernungen immer an der **seitlichen Breitenskala**, und zwar auf der Höhe der Strecke. Eine Bogenminute Breite = eine Seemeile. Die Längenskala oben und unten ist nur zum Ablesen der Länge da.

Positionen gibst du als **Breite** (N/S, 0–90°) und **Länge** (E/W, 0–180°) an: 54° 10,5' N, 010° 08,2' E. Grad, Minuten, Zehntelminuten.

In der Karte findest du: Tiefen in Metern bezogen auf das **Seekartennull** (SKN, in Tidengewässern das Niedrigste Gezeitenniveau LAT), Tiefenlinien, Trockenfallen, Seezeichen mit Kennung, Sperrgebiete, Kabel, Wracks, die **Kompassrose** mit Missweisung und Jahresänderung. Karten müssen **berichtigt** sein — Änderungen kommen über die Nachrichten für Seefahrer (NfS).

## Kurse und Beschickung

Der Kompass zeigt nicht rechtweisend Nord. Zwei Fehler kommen dazwischen:

- **Missweisung (Mw)**: Abweichung des magnetischen Nordpols vom geografischen. Steht in der Kompassrose der Karte, mit Jahresänderung. Ost positiv, West negativ.
- **Deviation (Abl)**: Ablenkung durch das Eisen und die Elektrik des eigenen Bootes. Steht in der **Deviationstabelle** des Bootes, abhängig vom Magnetkompasskurs.

Die drei Kurse hängen so zusammen:

| Kurs | Bezug | Rechnung |
|---|---|---|
| **MgK** Magnetkompasskurs | Kompass an Bord | — |
| **mwK** missweisender Kurs | magnetisch Nord | mwK = MgK + Abl |
| **rwK** rechtweisender Kurs | geografisch Nord | rwK = mwK + Mw |

Die Summe aus Ablenkung und Missweisung heißt **Fehlweisung (Fw)**: rwK = MgK + Fw. Zum Absetzen in der Karte brauchst du den rwK; zum Steuern rechnest du zurück zum MgK: **MgK = rwK − Mw − Abl**. Vorzeichen beachten: West-Werte sind negativ.

:::beispiel
Kartenkurs rwK 090°, Missweisung 3° E, Deviation für diesen Kurs 2° W. mwK = 090° − 3° = 087°. MgK = 087° − (−2°) = 089°. Du steuerst 089° am Kompass, um rechtweisend genau Ost zu laufen.
:::

Weht der Wind quer, treibt das Boot ab: Der **Kurs durchs Wasser (KdW)** ist der rwK plus **Abdrift** (Windversetzung, nach Lee). Setzt Strom, kommt die **Stromversetzung** dazu und ergibt den **Kurs über Grund (KüG)**. In der Prüfung werden diese Beschickungen als Zahlenwerte gegeben.

## Peilung und Standort

Eine **Peilung** ist die Richtung zu einem Objekt. Mit dem Handpeilkompass nimmst du die **Magnetkompasspeilung** und beschickst sie wie einen Kurs (Deviation des Handpeilkompasses meist null) zur **rechtweisenden Peilung (rwP)**. Die Standlinie trägst du von dem Objekt aus in die Karte.

- **Kreuzpeilung**: zwei (besser drei) Standlinien zu bekannten Objekten schneiden sich im Standort. Objekte möglichst im Winkel von 60–120° wählen.
- **Deckpeilung**: zwei Objekte stehen in einer Linie — die genaueste Standlinie, ganz ohne Kompass.
- **Peilung und Abstand**: eine Peilung plus Abstand (Radar, Entfernungsschätzung) ergibt den Standort.
- **Tiefenlinie** als Standlinie mit dem Echolot.
- **Seitenpeilung**: relativ zum Bug, umrechnen: rwP = rwK + Seitenpeilung.

## Koppeln

Ohne Landsicht rechnest du den Standort aus **Kurs, Fahrt und Zeit** vom letzten sicheren Ort (dem Besteck) weiter: Bei 6 kn und 30 Minuten auf rwK 045° liegt der **Koppelort** 3 sm nordöstlich. Abdrift und Strom werden eingerechnet. Jede neue Peilung korrigiert den Koppelort; der Unterschied heißt **Besteckversetzung**.

## Fahrt und Tiefe messen

Das **Log** misst die Fahrt durchs Wasser (Paddelrad, Staudruck), das GPS die Fahrt **über Grund** — der Unterschied ist der Strom. Das **Echolot** misst die Wassertiefe unter dem Geber; du musst wissen, ob der Geber ab Wasserlinie oder ab Kiel eingestellt ist.

## GPS, Plotter, AIS

**GPS** liefert Position (Bezugssystem **WGS 84**, in der Karte prüfen!), Kurs und Fahrt über Grund. Ein **Kartenplotter** zeigt das Boot auf der elektronischen Karte. **AIS** sendet und empfängt Name, Position, Kurs und Fahrt von Schiffen — der Klasse-B-Transponder macht dich für die Großschifffahrt sichtbar.

:::achtung
Elektronik fällt aus — Stromversorgung, Antenne, Software. Deshalb Positionen regelmäßig in die Papierkarte übertragen, und die Karte auch bei GPS mitführen. In der Prüfung wird terrestrisch navigiert.
:::

## Die Navigationsaufgabe der Prüfung

Auf der Übungsseekarte (Ausschnitt Deutsche Bucht) löst du eine Folge von Aufgaben: Position nach Breite und Länge eintragen, Kurs und Distanz zwischen zwei Punkten absetzen, Kompasskurs berechnen, Kreuzpeilung zeichnen, Koppelort bestimmen, Ankunftszeit rechnen. Werkzeug: Kursdreieck, Anlegedreieck oder Kursdreieck mit Rolllineal, Zirkel, Bleistift, Radiergummi. Zeit ist genug — Sorgfalt zählt.
