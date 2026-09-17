Das GMDSS (Global Maritime Distress and Safety System) ist das weltweite Seenot- und Sicherheitsfunksystem der IMO. Mit dem SRC hast du davon nur den UKW-Ausschnitt kennengelernt. Das LRC deckt das ganze System ab: Wer auf Grenz- und Kurzwelle oder über Satellit funkt, bewegt sich in Seegebieten, in denen kein UKW-Ruf mehr eine Küstenfunkstelle erreicht. Dort musst du wissen, welches Gerät welche Aufgabe übernimmt und was in welchem Seegebiet erwartet wird.

## Die Grundidee des GMDSS

Vor dem GMDSS beruhte die Rettung auf Seefunkern, die rund um die Uhr auf 500 kHz und 2182 kHz Hörwache hielten. Das GMDSS löst diese Hörwache durch automatisierte Alarmierung ab: Ein Notalarm geht per DSC oder Satellit an eine Küstenfunkstelle beziehungsweise ein Rettungsleitzentrum (RCC) an Land, und von dort wird die Rettung koordiniert. Der Grundsatz lautet: **Alarmierung Schiff → Land** ist der wichtigste Weg, ergänzt durch Schiff → Schiff und Land → Schiff.

Das GMDSS ist in SOLAS Kapitel IV verankert und weltweit verbindlich für ausrüstungspflichtige Schiffe. Sportboote sind in Deutschland davon ausgenommen, aber wer die Geräte an Bord hat, muss sie nach den GMDSS-Regeln bedienen — und braucht dafür das passende Zeugnis.

## Die neun Funktionen

Die IMO beschreibt, was jedes Schiff auf See leisten können muss. Diese Funktionen tauchen in der Prüfung regelmäßig auf:

1. Aussenden von Notalarmen Schiff → Land über mindestens zwei getrennte, voneinander unabhängige Wege
2. Empfang von Notalarmen Land → Schiff
3. Aussenden und Empfang von Notalarmen Schiff → Schiff
4. Aussenden und Empfang von Meldungen zur Koordinierung von Such- und Rettungsmaßnahmen (SAR)
5. Aussenden und Empfang von Meldungen am Ort des Notfalls (On-scene communication)
6. Aussenden und Empfang von Ortungssignalen (SART, AIS-SART, 121,5-MHz-Peilsignal)
7. Empfang von Maritime Safety Information (MSI): Navigations- und Wetterwarnungen, SAR-Informationen
8. Allgemeiner Funkverkehr mit landseitigen Netzen (öffentlicher Nachrichtenverkehr)
9. Brücke-zu-Brücke-Verkehr für die Navigation

:::merke
Zwei unabhängige Wege für den Notalarm Schiff → Land — das ist der Kern des GMDSS. Ein Sportboot im Seegebiet A3 erfüllt das zum Beispiel mit MF/HF-DSC und einer EPIRB oder mit Satellitenterminal und EPIRB.
:::

## Die vier Seegebiete

Die Seegebiete sind nicht geografisch, sondern nach der Funkversorgung definiert. Entscheidend ist immer, welche Küstenfunkstellen mit welchem System Wache halten. Ein Seegebiet A1 existiert also nur dort, wo eine Küstenverwaltung UKW-DSC-Küstenfunkstellen betreibt und dieses Gebiet erklärt hat.

| Seegebiet | Versorgung | typische Ausdehnung |
|---|---|---|
| A1 | UKW-DSC-Reichweite mindestens einer Küstenfunkstelle (Kanal 70) | etwa 20 bis 30 sm vor der Küste |
| A2 | MF-DSC-Reichweite mindestens einer Küstenfunkstelle (2187,5 kHz), ohne A1 | etwa 100 bis 150 sm |
| A3 | Versorgung durch einen anerkannten mobilen Satellitenfunkdienst, ohne A1 und A2 | bei Inmarsat ungefähr zwischen 70° Nord und 70° Süd |
| A4 | alles außerhalb von A1, A2 und A3 | im Wesentlichen die Polargebiete |

Für A3 wurde lange nur Inmarsat genannt. Seit Iridium als GMDSS-Anbieter anerkannt ist, spricht SOLAS neutral von einem „anerkannten mobilen Satellitenfunkdienst". Weil Iridium auch die Pole abdeckt, hängt der praktische Umfang von A4 davon ab, mit welchem System ein Schiff ausgerüstet ist. Klassisch gilt: In A4 bleibt für die Alarmierung nur die Kurzwelle.

:::beispiel
Du segelst von Cuxhaven nach Norwegen. In der Deutschen Bucht bist du im Seegebiet A1 (UKW-DSC-Küstenfunkstellen von Bremen Rescue). Weiter draußen in der Nordsee reicht UKW nicht mehr, aber die Grenzwellen-Küstenfunkstellen halten Wache auf 2187,5 kHz — Seegebiet A2. Auf der Atlantiküberquerung nach Westindien liegt zwischen den A2-Gebieten beider Seiten ein weites Stück, in dem dich nur noch Satellit oder Kurzwelle mit Land verbinden: Seegebiet A3.
:::

## Ausrüstung je Seegebiet

Die Ausrüstungspflichten nach SOLAS stapeln sich von A1 bis A4. Jedes Schiff braucht als Grundausstattung:

- eine UKW-Anlage mit DSC (Kanal 70) und Sprechfunk auf Kanal 16, 6 und 13
- ein Radartransponder (SART) oder AIS-SART je nach Schiffsgröße
- einen NAVTEX-Empfänger, in Gebieten ohne NAVTEX einen EGC-Empfänger
- eine EPIRB auf 406 MHz
- tragbare UKW-Handfunkgeräte für die Rettungsmittel

Darauf aufbauend:

- **A2**: zusätzlich eine Grenzwellenanlage mit DSC auf 2187,5 kHz und Sprechfunk auf 2182 kHz, plus DSC-Wachempfänger
- **A3**: zusätzlich entweder ein Satellitenterminal eines anerkannten Dienstes (etwa Inmarsat-C oder Iridium) oder eine MF/HF-Anlage mit DSC und Fernschreibfunk (NBDP)
- **A4**: zusätzlich eine MF/HF-Anlage mit DSC und NBDP — Satellit allein genügt hier nicht, wenn der Dienst die Pole nicht versorgt

Für die Betriebsbereitschaft verlangt SOLAS außerdem eine Reserve-Stromversorgung und je nach Fahrtgebiet doppelte Geräte, Landwartung oder Bordwartung durch eine qualifizierte Person.

## Wachdienst im GMDSS

Ein GMDSS-Schiff hält keine Hörwache mehr, sondern eine automatische DSC-Wache. Vorgeschrieben ist:

- ständige Wache auf UKW-Kanal 70
- in A2 und darüber hinaus: ständige Wache auf 2187,5 kHz
- auf HF: Wache auf 8414,5 kHz und mindestens einer weiteren HF-DSC-Notfrequenz, die nach Tageszeit und Position gewählt wird
- Empfang von MSI über NAVTEX oder EGC
- soweit möglich Hörwache auf Kanal 16

Ein DSC-Wachempfänger scannt die eingestellten Frequenzen und schlägt Alarm, sobald ein Notalarm, ein Dringlichkeits- oder ein an dich adressierter Ruf eintrifft. Nach dem Alarm wechselst du auf die zugehörige Sprechfunkfrequenz — auf MF ist das 2182 kHz.

:::achtung
Ein häufiger Fehler in der Prüfung: Die Seegebiete werden mit Entfernungen gleichgesetzt. Die Meilenangaben sind nur typische Größenordnungen. Maßgeblich ist immer, ob eine Küstenfunkstelle mit dem jeweiligen System Wache hält und das Gebiet von der Verwaltung erklärt wurde.
:::

## Was das LRC dir erlaubt

Mit dem LRC darfst du auf Sportbooten und anderen nicht ausrüstungspflichtigen Fahrzeugen alle GMDSS-Anlagen bedienen: UKW, Grenzwelle, Kurzwelle und Satellitenterminals — in allen Seegebieten. Für Berufsschiffe unter SOLAS gelten weiterhin das GOC (General Operator's Certificate) und das ROC (Restricted Operator's Certificate). Die Betriebsverfahren sind aber dieselben; wer das LRC beherrscht, findet sich auch auf einer Berufsbrücke zurecht.

## Das Wichtigste in Kürze

- GMDSS: automatisierte Alarmierung an Land, zwei unabhängige Wege Schiff → Land, neun Funktionen.
- A1 = UKW-DSC-Reichweite, A2 = MF-DSC-Reichweite (2187,5 kHz), A3 = Satellitenversorgung, A4 = Rest, im Wesentlichen Polargebiete mit Kurzwelle.
- Seegebiete werden durch die Küstenfunkversorgung definiert, nicht durch feste Entfernungen.
- Grundausrüstung überall: UKW-DSC, SART, NAVTEX/EGC, EPIRB; darauf aufbauend MF (A2), Satellit oder MF/HF (A3), MF/HF (A4).
- DSC-Wache statt Hörwache: Kanal 70, 2187,5 kHz, 8414,5 kHz plus eine weitere HF-Frequenz.
- Das LRC berechtigt auf nicht ausrüstungspflichtigen Schiffen zur Bedienung aller GMDSS-Anlagen in allen Seegebieten.
