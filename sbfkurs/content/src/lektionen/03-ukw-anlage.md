Die UKW-Seefunkanlage ist das Herzstück des GMDSS im Seegebiet A1. Sie ist robust, einfach zu bedienen und — richtig eingesetzt — im Umkreis von einigen Dutzend Seemeilen das zuverlässigste Kommunikationsmittel an Bord. Damit du sie richtig einsetzt, musst du verstehen, wie Kanäle, Sendeleistung, Antenne und Ausbreitung zusammenhängen.

## Frequenzen und Kanäle

Der UKW-Seefunk arbeitet im Bereich um 156 bis 162 MHz. Damit niemand Frequenzen auswendig lernen muss, sind die Frequenzen zu **Kanälen** mit festen Nummern zusammengefasst; international gilt dieselbe Kanaltabelle. Einige Kanäle haben eine feste Aufgabe:

| Kanal | Zweck |
|---|---|
| 16 | Not-, Dringlichkeits-, Sicherheits- und Anrufkanal (Sprechfunk) |
| 70 | ausschließlich DSC — nie Sprechfunk |
| 13 | Brücke-zu-Brücke-Verkehr zur Navigationssicherheit |
| 6 | Schiff-Schiff-Verkehr, insbesondere bei SAR-Einsätzen |
| 72, 77 | Schiff-Schiff-Verkehr, in der Sportschifffahrt üblich |

Daneben gibt es Arbeitskanäle für Küstenfunkstellen, Häfen, Marinas, Schleusen und Verkehrszentralen. Welche das vor Ort sind, steht im Handbuch Nautischer Funkdienst und in den Kanaltabellen der Reviere.

Kanal 16 ist der wichtigste Kanal: Hier werden Notrufe abgesetzt, hier hören Küstenfunkstellen, Rettungsleitstellen und die meisten Schiffe. Weil er so wichtig ist, gilt: **Kanal 16 nur für Anruf und Notverkehr.** Sobald der Kontakt hergestellt ist, wechselst du für das eigentliche Gespräch auf einen Arbeitskanal.

:::merke
Kanal 16 ist der Not- und Anrufkanal für Sprechfunk. Kanal 70 ist dem digitalen Selektivruf (DSC) vorbehalten — darauf wird niemals gesprochen.
:::

## Simplex und Duplex

Ein Kanal kann auf zwei Arten organisiert sein:

- **Simplex**: Sender und Empfänger nutzen **eine** Frequenz. Es kann immer nur einer sprechen; wer die Sprechtaste drückt, hört nichts. Deshalb enden Sprüche mit „OVER" — die Übergabe an die Gegenstation. Alle Schiff-Schiff-Kanäle sind Simplexkanäle, auch Kanal 16.
- **Duplex**: Der Kanal besteht aus **zwei** Frequenzen. Das Schiff sendet auf der Schiffsfrequenz und hört auf der Küstenfrequenz; die Küstenfunkstelle macht es umgekehrt. So können beide gleichzeitig sprechen — wie am Telefon. Duplexkanäle sind für den Verkehr zwischen Schiff und Küstenfunkstelle vorgesehen.

Daraus folgt eine wichtige Einschränkung: Zwei Schiffe können auf einem Duplexkanal **nicht** miteinander sprechen. Beide würden auf derselben Schiffsfrequenz senden und auf derselben Küstenfrequenz hören — sie hören einander nie. Manche Geräte bieten deshalb für einzelne Duplexkanäle einen Simplexbetrieb an, was nur dort zulässig ist, wo die Kanaltabelle es vorsieht.

:::beispiel
Die Yacht ALBATROS ruft die Yacht MÖWE auf Kanal 16 und schlägt als Arbeitskanal Kanal 72 vor — einen Simplexkanal. Hätte sie Kanal 26 vorgeschlagen, einen Duplexkanal für Küstenfunkstellen, wäre kein Gespräch zustande gekommen.
:::

## Sendeleistung

Fest eingebaute UKW-Anlagen senden mit maximal **25 Watt**. Die Leistung lässt sich auf **1 Watt** reduzieren, und in vielen Situationen ist das die richtige Wahl:

- im Hafen oder in der Marina, wo die Gegenstation ganz nah ist,
- auf Revieren mit dichtem Funkverkehr, um andere nicht zu stören,
- auf bestimmten Kanälen, für die die Kanaltabelle ausdrücklich geringe Leistung vorschreibt.

Die Faustregel lautet: **So wenig Leistung wie möglich, so viel wie nötig.** Für einen Notruf schaltest du natürlich auf volle Leistung. Handfunkgeräte haben deutlich weniger Leistung — in der Größenordnung von wenigen Watt — und eine kleine Antenne dicht über dem Wasser; ihre Reichweite ist daher begrenzt.

## Ausbreitung und Reichweite

UKW-Wellen breiten sich **quasi-optisch** aus: Sie folgen näherungsweise der Sichtlinie und werden vom Erdboden kaum gebeugt. Die Reichweite hängt darum vor allem von der **Höhe der Antennen** ab — deiner eigenen und der der Gegenstation — und nur wenig von der Sendeleistung. Mehr Watt bringen ein etwas kräftigeres Signal am Horizont, aber keine Verbindung hinter den Horizont.

Als Näherung gilt: Die Funkreichweite in Seemeilen entspricht etwa dem 2,2-Fachen der Summe aus den Quadratwurzeln der beiden Antennenhöhen in Metern. Ein paar Beispiele aus der Praxis:

- Zwei Yachten mit Antennen in etwa zehn Metern Höhe erreichen einander über rund 14 Seemeilen.
- Eine Yacht erreicht eine Küstenfunkstelle, deren Antenne hoch auf einem Mast oder Hügel steht, oft über 30 Seemeilen und mehr.
- Ein Handfunkgerät im Cockpit und ein zweites in einer Rettungsinsel reichen nur wenige Seemeilen.

Hindernisse wie Steilküsten oder große Schiffe können die Verbindung abschatten. Unter bestimmten Wetterlagen entstehen Überreichweiten, auf die man sich aber nie verlassen darf.

## Die Antenne

Da die Höhe zählt, gehört die Antenne auf einer Segelyacht an den Masttopp, auf Motorbooten so hoch wie möglich. UKW-Seefunkantennen sind **vertikal polarisiert** und strahlen rundum gleichmäßig ab. Damit die Leistung tatsächlich abgestrahlt wird, müssen Antenne, Kabel und Stecker zueinander passen und in gutem Zustand sein:

- Korrodierte Stecker und beschädigte Kabel verschlucken einen großen Teil der Leistung.
- Lange, dünne Kabel dämpfen das Signal; hochwertiges Koaxialkabel lohnt sich.
- Das Stehwellenverhältnis (SWR) zeigt, ob Antenne und Anlage angepasst sind — ein hoher Wert deutet auf einen Fehler und kann die Endstufe beschädigen.
- Eine **Notantenne** an Bord ersetzt die Hauptantenne, wenn der Mast bricht.

:::achtung
Nie ohne angeschlossene Antenne senden. Die Leistung, die nicht abgestrahlt wird, läuft in die Endstufe zurück und kann sie zerstören.
:::

## Bedienelemente

Neben Kanalwahl und Sprechtaste findest du auf jeder Anlage einige Funktionen, die du kennen solltest: die **Rauschsperre** (Squelch) unterdrückt das Grundrauschen, sollte aber nicht so hoch stehen, dass schwache Stationen verschwinden. **Dual Watch** überwacht Kanal 16 parallel zu einem Arbeitskanal; **Scan** durchläuft mehrere Kanäle. Die Taste **16** springt sofort zum Notkanal. Und die rote **DISTRESS**-Taste unter der Klappe löst den DSC-Notalarm aus — dazu mehr in den Lektionen zum DSC.

## Das Wichtigste in Kürze

- Kanal 16 ist Not- und Anrufkanal, Kanal 70 ausschließlich DSC; für Gespräche wechselst du auf Arbeitskanäle.
- Simplex: eine Frequenz, abwechselnd sprechen. Duplex: zwei Frequenzen, nur für Schiff–Küstenfunkstelle; Schiff-Schiff auf Duplexkanälen ist nicht möglich.
- Sendeleistung maximal 25 W, reduzierbar auf 1 W — so wenig wie möglich, im Notfall volle Leistung.
- UKW breitet sich quasi-optisch aus; die Reichweite bestimmt die Antennenhöhe, nicht die Sendeleistung.
- Antenne hoch anbringen, Kabel und Stecker pflegen, Notantenne mitführen, nie ohne Antenne senden.
