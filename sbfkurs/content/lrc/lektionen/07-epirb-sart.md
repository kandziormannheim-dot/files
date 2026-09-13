Wenn alles andere versagt — Strom weg, Funkanlage unter Wasser, Besatzung in der Rettungsinsel — bleiben drei Geräte, die auch ohne das Schiff arbeiten: die Satelliten-Notfunkbake EPIRB, der Radartransponder SART und sein Verwandter, der AIS-SART. Die EPIRB alarmiert, SART und AIS-SART führen die Retter die letzten Seemeilen. Diese Lektion zeigt, wie sie funktionieren, wie du sie bedienst und warum die Registrierung so entscheidend ist.

## EPIRB: die 406-MHz-Notbake

Die **EPIRB** (Emergency Position Indicating Radio Beacon) sendet nach der Aktivierung alle 50 Sekunden einen kurzen digitalen Notalarm auf **406 MHz** an die Cospas-Sarsat-Satelliten. Der Alarm enthält die eindeutige Kennung der Bake (eine 15-stellige Hexadezimal-ID), bei modernen Geräten die GNSS-Position und Statusangaben. Die Satelliten leiten das Signal an die Bodenstationen und Leitstellen weiter; von dort geht es zum zuständigen RCC.

Parallel sendet die EPIRB ein schwaches Peilsignal auf **121,5 MHz**. Dieses Signal wird nicht von Satelliten ausgewertet — die Satellitenüberwachung auf 121,5 MHz endete 2009 —, sondern dient den Rettungskräften zur Nahbereichspeilung: SAR-Hubschrauber und Rettungskreuzer peilen es an, sobald sie in der Nähe sind. Neuere EPIRBs senden zusätzlich AIS-Meldungen, damit umliegende Schiffe die Bake auf dem Plotter sehen.

Die Batterie hält mindestens 48 Stunden Sendebetrieb durch. Das Gerät ist wasserdicht, schwimmfähig und sendet nur aufrecht mit freier Antenne gut — im Wasser oder aufrecht an der Rettungsinsel befestigt, nicht liegend in der Insel.

Aktiviert wird die EPIRB:

- **von Hand**: Schalter oder Abdeckung öffnen und einschalten — der Regelfall, wenn du die Bake mit in die Rettungsinsel nimmst.
- **automatisch**: EPIRBs der Kategorie I sitzen in einer Halterung mit **hydrostatischer Auslösung** (HRU). Sinkt das Schiff, gibt die HRU die Bake in wenigen Metern Wassertiefe frei; sie schwimmt auf und aktiviert sich beim Kontakt mit Wasser. Kategorie II wird nur von Hand ausgelöst.

:::merke
EPIRB: Notalarm auf 406 MHz über Cospas-Sarsat, Peilsignal auf 121,5 MHz für die Nahbereichssuche, mindestens 48 Stunden Sendebetrieb, schwimmfähig, aufrecht mit freier Antenne betreiben.
:::

## Registrierung: warum sie Leben rettet

Ein EPIRB-Alarm ohne Registrierung ist für ein RCC nur eine Kennung und eine Position. Mit Registrierung sieht es Schiffsname, Typ, Farbe, Rufzeichen, MMSI, Personenzahl und Notfallkontakte an Land — und erfährt über die Kontakte, ob das Boot unterwegs ist und wohin.

Deshalb gilt: Die EPIRB wird mit der Kennung deines Schiffes programmiert (in Deutschland mit der MMSI, im Ausland auch mit Rufzeichen oder Seriennummer) und in der nationalen Registrierungsdatenbank eingetragen. In Deutschland ist die Bundesnetzagentur zuständig; die EPIRB wird in die Frequenzzuteilung aufgenommen. Bei Verkauf des Bootes oder der Bake muss die Registrierung geändert werden — eine EPIRB mit fremder Kennung schickt die Retter zum falschen Schiff.

:::achtung
Eine EPIRB, die du gebraucht kaufst, trägt die Kennung des Vorbesitzers. Bevor du sie an Bord nimmst, muss sie umprogrammiert und neu registriert werden. Gleiches gilt für eine neue MMSI: Ändert sich die Kennung des Schiffes, ändert sich die Programmierung der Bake.
:::

## Prüfen, warten, Fehlalarm

Die Testfunktion der EPIRB prüft Batterie, Sender und GNSS-Empfänger ohne echte Aussendung — monatlich, nach Herstellervorgabe. Batterie und HRU haben Ablaufdaten auf dem Gehäuse. Hast du die EPIRB versehentlich ausgelöst, schalte sie aus und melde den Fehlalarm sofort dem MRCC oder der Küstenfunkstelle mit Kennung, Schiffsname, Position und Uhrzeit. Ein gemeldeter Fehlalarm ist kein Problem; ein unerklärter bindet Rettungskräfte, die anderswo fehlen.

## SART: der Radartransponder

Der **SART** (Search and Rescue Radar Transponder) arbeitet im **9-GHz-Band** (X-Band, 3-cm-Radar), genauer im Bereich zwischen 9,2 und 9,5 GHz. Er sendet nicht von sich aus, sondern antwortet, sobald ihn ein Radarimpuls trifft: Auf dem Radarschirm des suchenden Schiffes erscheint eine Kette von **zwölf Punkten**, die vom SART aus radial nach außen läuft. Der erste Punkt zeigt die Position des SART. Kommt das Schiff näher, werden aus den Punkten Bögen und schließlich Kreise — dann ist der SART nur noch wenige hundert Meter entfernt.

Reichweite: gegenüber einem Schiffsradar etwa 5 sm, gegenüber einem Flugzeug in großer Höhe bis über 30 sm. Der SART gehört möglichst hoch — in der Rettungsinsel an die vorgesehene Halterung mindestens einen Meter über der Wasseroberfläche. Er hält mindestens 96 Stunden Bereitschaft und 8 Stunden Sendebetrieb durch und piepst oder blinkt, sobald ihn ein Radar erfasst. Er antwortet nur auf 3-cm-Radar (X-Band), nicht auf 10-cm-Radar (S-Band).

:::beispiel
Die Rettungsinsel treibt seit Stunden, die EPIRB sendet. Ein Frachter wird vom RCC umgeleitet und nähert sich der gemeldeten Position. Fünf Seemeilen vor dem Ziel zeigt sein X-Band-Radar eine Kette von zwölf Punkten — der SART. Die Brücke steuert auf den innersten Punkt zu; auf zwei Seemeilen werden die Punkte zu Bögen. In der Insel beginnt der SART zu piepen: Die Besatzung weiß, dass sie gefunden ist, und macht sich mit Handfackeln bemerkbar.
:::

## AIS-SART

Der **AIS-SART** ersetzt als gleichwertige Alternative den Radar-SART. Er sendet nach der Aktivierung auf den beiden AIS-Kanälen (161,975 und 162,025 MHz) im Minutentakt eine Meldung mit seiner Kennung (MMSI-Format, beginnend mit 970) und seiner GNSS-Position. Jedes Schiff mit AIS-Empfänger in UKW-Reichweite — grob 5 bis 10 sm je nach Antennenhöhe — sieht den AIS-SART als besonderes Symbol auf dem Plotter, mit Position, Kurs und Entfernung. Vorteil: exakte Position, auch für Boote ohne Radar sichtbar. Batterie: mindestens 96 Stunden.

## Zusammenspiel bei der Rettung

Die Geräte ergänzen sich in der Rettungskette:

1. Die **EPIRB** alarmiert weltweit über Satellit und liefert die Position.
2. Das RCC leitet Schiffe und Flugzeuge in das Gebiet.
3. **SART** oder **AIS-SART** führen die Retter aus einigen Seemeilen an die Rettungsinsel heran.
4. Das **121,5-MHz-Signal** ermöglicht Hubschraubern die Feinpeilung; Handfackeln und die UKW-Handfunke schließen die letzte Lücke.

Nimm deshalb alle Geräte mit in die Insel.

## Das Wichtigste in Kürze

- EPIRB: Notalarm auf 406 MHz über Cospas-Sarsat, Peilsignal 121,5 MHz, mindestens 48 h Sendebetrieb; Kategorie I löst hydrostatisch aus, Kategorie II von Hand.
- Registrierung mit der Kennung des Schiffes (Bundesnetzagentur) ist Pflicht; bei Eignerwechsel oder neuer MMSI umprogrammieren und neu registrieren.
- Monatlicher Selbsttest, Ablaufdaten von Batterie und HRU beachten; Fehlalarm sofort ausschalten und dem MRCC melden.
- SART: Radartransponder im 9-GHz-Band (X-Band), zwölf Punkte auf dem Radarschirm, Reichweite etwa 5 sm gegenüber Schiffen, 96 h Standby und 8 h Sendebetrieb, hoch anbringen.
- AIS-SART: sendet Kennung (970…) und GNSS-Position auf den AIS-Kanälen, auf jedem AIS-Plotter sichtbar, 96 h Betrieb.
- Alle Geräte gehören in die Rettungsinsel — EPIRB alarmiert, SART/AIS-SART führen heran.
