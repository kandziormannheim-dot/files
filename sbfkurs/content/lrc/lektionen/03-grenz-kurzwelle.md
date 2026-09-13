UKW reicht bis zum Horizont. Grenz- und Kurzwelle reichen weiter — hunderte bis tausende Seemeilen —, aber nicht jederzeit und nicht auf jeder Frequenz. Wer eine MF/HF-Anlage sinnvoll bedienen will, muss verstehen, wie sich diese Wellen ausbreiten, und warum Antenne, Antennentuner und Erdung so viel wichtiger sind als beim UKW-Gerät.

## Frequenzbereiche

Der Seefunk nutzt zwei Bereiche unterhalb von UKW:

| Bezeichnung | Bereich | Seefunk-Bänder |
|---|---|---|
| Grenzwelle (MF, Mittelwelle im Sinne der ITU) | 300 kHz bis 3 MHz | Seefunk etwa 1605 bis 3800 kHz, zentral 2182 kHz |
| Kurzwelle (HF) | 3 bis 30 MHz | Bänder bei 4, 6, 8, 12, 16, 18/19, 22 und 25/26 MHz |

Jedes Kurzwellenband enthält festgelegte Frequenzen für DSC, Sprechfunk, Fernschreibfunk (NBDP) und den öffentlichen Nachrichtenverkehr. Dazu kommen Nutzer außerhalb des Seefunks: NAVTEX auf 518 und 490 kHz sitzt unterhalb der Grenzwelle im Langwellen-/Mittelwellenbereich.

Sendeleistung: Auf Sportbooten sind meist Anlagen mit etwa 150 W üblich, Handelsschiffe fahren mit 250 bis 400 W oder mehr. Die Betriebsart ist Einseitenbandmodulation (SSB, J3E) für Sprechfunk, im Seefunk immer das obere Seitenband (USB). DSC und NBDP nutzen Frequenzumtastung (F1B/J2B).

## Bodenwelle und Raumwelle

Eine Sendeantenne strahlt in alle Richtungen. Für die Ausbreitung sind zwei Anteile wichtig:

- Die **Bodenwelle** folgt der Erdoberfläche. Über Salzwasser wird sie wenig gedämpft, über Land stark. Je niedriger die Frequenz, desto weiter reicht die Bodenwelle. Auf Grenzwelle sind über See tagsüber je nach Leistung und Antenne etwa 100 bis 150 sm erreichbar; auf Kurzwelle ist die Bodenwelle nach wenigen Dutzend Seemeilen verschwunden.
- Die **Raumwelle** strahlt schräg nach oben, wird an der Ionosphäre reflektiert und kommt weit entfernt wieder zur Erde. Ein Sprung („Hop") kann mehrere tausend Kilometer überbrücken; mehrere Sprünge führen um den halben Erdball.

Zwischen dem Ende der Bodenwelle und dem Auftreffpunkt der ersten Raumwelle liegt die **tote Zone** (Skip Zone): Dort ist die Station nicht zu hören, obwohl sie näher und weiter entfernt gut ankommt.

:::merke
Grenzwelle arbeitet vor allem mit der Bodenwelle und deckt das Seegebiet A2 ab. Kurzwelle arbeitet mit der Raumwelle und reicht weltweit — aber nur auf der Frequenz, die zur Tageszeit passt.
:::

## Die Ionosphäre: Tag und Nacht

Die Ionosphäre besteht aus mehreren Schichten, die durch die Sonnenstrahlung ionisiert werden. Vereinfacht:

- Die **D-Schicht** (unterste Schicht) entsteht nur bei Tageslicht. Sie reflektiert nicht, sondern **dämpft** niedrige Frequenzen stark. Tagsüber „verschluckt" sie Grenzwelle und die unteren Kurzwellenbänder.
- Die **E-Schicht** und vor allem die **F-Schicht** reflektieren die Kurzwelle. Die F-Schicht ist nachts schwächer, aber vorhanden; die D-Schicht verschwindet nachts.

Daraus folgt die Faustregel für die Frequenzwahl auf Kurzwelle:

- **Tagsüber hohe Frequenzen** (12, 16, 22 MHz): Die D-Schicht lässt sie durch, die F-Schicht reflektiert sie.
- **Nachts niedrige Frequenzen** (4, 6, 8 MHz): Keine Dämpfung durch die D-Schicht, gute Reflexion.
- Dämmerung ist Übergangszeit; das 8-MHz-Band ist oft rund um die Uhr brauchbar, weshalb dort auch die ständige DSC-Wache auf 8414,5 kHz liegt.

Auf Grenzwelle bedeutet dieselbe Physik: Tagsüber zählt nur die Bodenwelle. Nachts kommt die Raumwelle hinzu, die Reichweite steigt deutlich — und ebenso die Störungen durch weit entfernte Stationen, die plötzlich auf 2182 kHz hörbar werden.

Weitere Einflüsse sind der elfjährige Sonnenfleckenzyklus, die Jahreszeit und Sonnenstürme, die den Kurzwellenverkehr stundenweise lahmlegen können.

:::beispiel
Du liegst mittags 800 sm westlich der Kanaren und willst eine Küstenfunkstelle in Europa erreichen. 4 MHz ist tagsüber durch die D-Schicht gedämpft und die tote Zone ist groß; 12 oder 16 MHz sind die richtige Wahl. Nach Sonnenuntergang wird 16 MHz still, dann wechselst du auf 8 oder 6 MHz.
:::

## Antennen an Bord

Eine Antenne arbeitet dann gut, wenn ihre Länge zur Wellenlänge passt. Bei 2182 kHz beträgt die Wellenlänge rund 137 m; ein Viertelwellenstrahler wäre über 30 m lang. Auf einem Boot ist das nicht unterzubringen. Üblich sind:

- ein **isoliertes Achterstag** (mit Isolatoren oben und unten) auf Segelyachten, meist 10 bis 15 m lang
- eine **Peitschenantenne** von etwa 7 bis 9 m Länge auf Motorbooten
- auf Handelsschiffen Drahtantennen zwischen Masten oder mehrere Stabantennen

Alle diese Antennen sind für den größten Teil der Frequenzen elektrisch zu kurz oder zu lang. Deshalb steht zwischen Sender und Antenne der **Antennentuner** (Antennenanpassgerät, ATU). Er passt die Antenne bei jedem Frequenzwechsel elektrisch an, sodass der Sender seine Leistung abgeben kann und möglichst wenig zurückreflektiert wird (niedriges Stehwellenverhältnis, SWR). Moderne Tuner stimmen automatisch ab, sobald du die PTT-Taste drückst; das dauert wenige Sekunden. Der Tuner gehört möglichst direkt an den Antennenfußpunkt, weil die Leitung zwischen Tuner und Antenne selbst abstrahlt.

## Erdung — die halbe Antenne

Eine Peitsche oder ein Achterstag ist nur die eine Hälfte des Systems. Die andere Hälfte ist das **Gegengewicht**, die HF-Erde. Ohne gute Erde bleibt ein Großteil der Leistung im Tuner und in der Schiffsverkabelung stecken, und die Reichweite bricht ein. Bewährte Lösungen:

- eine großflächige Erdungsplatte aus Bronze oder Sinterkupfer unter der Wasserlinie
- bei Stahl- und Aluminiumrümpfen der Rumpf selbst
- der Kiel oder ein Ballastbolzen bei GFK-Yachten, mit breitem Kupferband angeschlossen
- bei fehlender Möglichkeit: ausgedehnte Kupferfolie im Rumpf als Gegengewicht

Das Kupferband zwischen Tuner und Erde soll kurz und breit sein — Hochfrequenz fließt an der Oberfläche, ein dünner Draht hat zu viel Impedanz.

:::achtung
Bei Sendebetrieb auf Grenz- und Kurzwelle liegen an Antenne und Isolatoren hohe Spannungen an. Niemand darf während des Sendens das Achterstag oder die Antenne berühren. Achte auf Verbrennungsgefahr und darauf, dass die Antenne nicht auf Höhe des Cockpits vorbeiläuft.
:::

Bordeigene Störquellen — Ladegeräte, Wechselrichter, LED-Beleuchtung, Autopilot — erzeugen Breitbandrauschen. Bevor du einen schwachen Ruf abschreibst, schalte sie probeweise ab.

## Das Wichtigste in Kürze

- Grenzwelle: 1605 bis 3800 kHz, Bodenwelle, Seegebiet A2, Notfrequenz 2182 kHz. Kurzwelle: 3 bis 30 MHz in Bändern bei 4, 6, 8, 12, 16, 22 MHz, Raumwelle, weltweite Reichweite.
- Bodenwelle reicht über Salzwasser weit, je niedriger die Frequenz desto weiter; Raumwelle wird an der Ionosphäre reflektiert, dazwischen liegt die tote Zone.
- Tagsüber hohe Frequenzen, nachts niedrige — weil die D-Schicht nur bei Tageslicht dämpft. Grenzwelle reicht nachts durch die Raumwelle weiter, aber mit mehr Störungen.
- Bordantennen sind elektrisch zu kurz; der Antennentuner passt sie bei jedem Frequenzwechsel an.
- Ohne gute HF-Erde (Erdungsplatte, Rumpf, Kiel, breites Kupferband) keine Reichweite.
- Betriebsart SSB im oberen Seitenband (J3E).
