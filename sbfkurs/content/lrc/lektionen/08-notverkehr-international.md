Die Verfahren für Not-, Dringlichkeits- und Sicherheitsverkehr kennst du aus dem SRC. Auf Grenz- und Kurzwelle bleiben Wortlaut und Aufbau gleich — MAYDAY, PAN PAN, SÉCURITÉ, dreimal genannt, dann Name, Kennung, Position, Anliegen. Neu ist der Rahmen: andere Frequenzen, Gegenstellen, die tausend Seemeilen entfernt sitzen, Rettungsleitzentren als Verkehrsleitung und der funkärztliche Beratungsdienst, den du über MF/HF oder Satellit erreichst.

## Frequenzen für den Notverkehr

Nach dem DSC-Alarm wechselt die Anlage auf die Sprechfunk-Notfrequenz des Bandes:

- Grenzwelle: **2182 kHz**, die internationale Not- und Anruffrequenz für Sprechfunk
- Kurzwelle: 4125 / 6215 / 8291 / 12290 / 16420 kHz

Auf diesen Frequenzen wird der Notverkehr geführt, solange die Verkehrsleitung nichts anderes anordnet. Sie werden auch für Dringlichkeits- und Sicherheitsanrufe genutzt; der eigentliche Sicherheitsverkehr wird dann auf eine Arbeitsfrequenz verlegt. Mit einem Satellitenterminal führst du den Notverkehr direkt mit dem RCC, das über den Notalarm angesteuert wurde.

:::merke
Sprechfunk-Notfrequenzen: 2182 kHz auf Grenzwelle; 4125, 6215, 8291, 12290, 16420 kHz auf Kurzwelle. Sie gehören zu den DSC-Notfrequenzen 2187,5 / 4207,5 / 6312 / 8414,5 / 12577 / 16804,5 kHz.
:::

## Die Rolle des MRCC

Ein **RCC** (Rescue Coordination Centre, für den Seebereich MRCC) koordiniert Such- und Rettungsmaßnahmen in seinem Zuständigkeitsgebiet (SAR-Region). In Deutschland ist das MRCC Bremen der DGzRS zuständig, im Funk als „Bremen Rescue" zu hören. Es empfängt DSC-Alarme auf UKW und Grenzwelle, Cospas-Sarsat-Alarme und Satellitenalarme. Auf Kurzwelle betreiben nur einige Länder Küstenfunkstellen mit DSC-Wache; sie leiten Alarme an das für die Position zuständige RCC weiter.

Das RCC oder die Küstenfunkstelle, die den Alarm quittiert, übernimmt die **Leitung des Notverkehrs**: welche Schiffe helfen, auf welcher Frequenz gesprochen wird, wann der Notverkehr endet. Als Schiff in der Nähe meldest du dich mit Position, Geschwindigkeit und voraussichtlicher Ankunftszeit und wartest auf Anweisungen. Ein Schiff, das die Leitung am Ort des Notfalls übernimmt, heißt On-Scene Coordinator (OSC).

## Ablauf des Notverkehrs auf MF/HF

Nach dem DSC-Alarm und der DSC-Quittung der Küstenfunkstelle setzt du auf der Sprechfunk-Notfrequenz die Notmeldung ab. Die Küstenfunkstelle bestätigt per Sprechfunk mit RECEIVED MAYDAY und übernimmt.

:::funk
ALBATROS: MAYDAY MAYDAY MAYDAY
ALBATROS: THIS IS ALBATROS ALBATROS ALBATROS
ALBATROS: MMSI 211234560
ALBATROS: MAYDAY ALBATROS MMSI 211234560
ALBATROS: POSITION FOUR ZERO NAUTICAL MILES WEST OF HELGOLAND
ALBATROS: FIRE IN ENGINE ROOM, I REQUIRE IMMEDIATE ASSISTANCE
ALBATROS: FOUR PERSONS ON BOARD
ALBATROS: OVER
BREMEN RESCUE: MAYDAY ALBATROS ALBATROS ALBATROS
BREMEN RESCUE: THIS IS BREMEN RESCUE BREMEN RESCUE BREMEN RESCUE
BREMEN RESCUE: RECEIVED MAYDAY
BREMEN RESCUE: RESCUE CRUISER IS PROCEEDING TO YOUR POSITION, ETA ONE HOUR
BREMEN RESCUE: KEEP WATCH ON 2182 KILOHERTZ, OVER
:::

Wer den Notverkehr stört, wird mit SEELONCE MAYDAY (durch die Leitung) oder SEELONCE DISTRESS (durch andere Stationen) zur Funkstille aufgefordert. Eingeschränkten Verkehr gibt die Leitung mit PRUDONCE frei, das Ende des Notverkehrs kündigt sie mit SEELONCE FEENEE an.

Auf Kurzwelle erreicht der Notverkehr auch Stationen, die tausende Seemeilen entfernt sind. Bist du weit weg, greifst du nicht ein — du hörst mit und sorgst nur für die Weiterleitung, wenn erkennbar keine Küstenfunkstelle reagiert.

## Empfang eines Notalarms ohne Quittung

Empfängst du auf Grenzwelle einen DSC-Notalarm und hörst innerhalb von etwa drei bis fünf Minuten weder eine DSC-Quittung noch Sprechfunk einer Küstenfunkstelle, quittierst du per Sprechfunk auf 2182 kHz: MAYDAY, Name oder MMSI des Havaristen dreimal, THIS IS + dein Name dreimal, RECEIVED MAYDAY. Anschließend informierst du die Küstenfunkstelle oder das RCC über jeden verfügbaren Weg. Kannst du den Havaristen nicht erreichen, er aber offenbar in Not ist, setzt du ein MAYDAY RELAY ab — auf MF/HF per DSC gezielt an eine Küstenfunkstelle, dann per Sprechfunk:

:::funk
SEEWOLF: MAYDAY RELAY MAYDAY RELAY MAYDAY RELAY
SEEWOLF: BREMEN RESCUE BREMEN RESCUE BREMEN RESCUE
SEEWOLF: THIS IS SEEWOLF SEEWOLF SEEWOLF MMSI 211345670
SEEWOLF: RECEIVED FOLLOWING MAYDAY FROM MOTOR VESSEL NORDLICHT AT 1420 UTC
SEEWOLF: MAYDAY NORDLICHT, POSITION 55 DEGREES 40 MINUTES NORTH 006 DEGREES 20 MINUTES EAST, SINKING, SIX PERSONS ON BOARD
SEEWOLF: NO ACKNOWLEDGEMENT RECEIVED, OVER
:::

## Dringlichkeitsverkehr und Radio Medical

Dringlichkeitsverkehr (PAN PAN) betrifft die Sicherheit von Schiff oder Person ohne unmittelbare Lebensgefahr: Maschinenausfall in ruhiger See, ein Verletzter an Bord. Der wichtigste Anwendungsfall auf großer Fahrt ist die **funkärztliche Beratung** (Radio Medical). Weltweit betreiben Staaten telemedizinische Beratungsdienste (TMAS); in Deutschland ist das der funkärztliche Beratungsdienst in Cuxhaven, erreichbar über das MRCC Bremen. Die Beratung ist gebührenfrei.

Ablauf: PAN-PAN-Anruf an die Küstenfunkstelle oder das MRCC auf 2182 kHz, einer HF-Notfrequenz oder über Satellit; Angabe von Schiff, Position, Anliegen. Das MRCC stellt eine Verbindung zum Arzt her, per Sprechfunk auf einer Arbeitsfrequenz oder per Satellitentelefon. Halte bereit: Alter und Geschlecht des Patienten, Symptome, Vitalwerte (Puls, Atmung, Temperatur, Bewusstsein), Vorerkrankungen, Bordapotheke, Position und Zeit bis zum nächsten Hafen. Der Arzt gibt Behandlungsanweisungen; wenn nötig, veranlasst das MRCC eine Evakuierung (MEDEVAC) per Hubschrauber.

:::beispiel
Auf einer Yacht 120 sm vor Borkum bricht sich ein Segler den Unterarm. Der Skipper ruft Bremen Rescue mit PAN PAN auf 2182 kHz. Bremen Rescue verbindet ihn mit dem Beratungsarzt, der Schienung und Schmerzmittel anweist und Norderney als Ziel empfiehlt; das MRCC bittet um Rückmeldung in vier Stunden.
:::

## Sicherheitsverkehr

SÉCURITÉ-Meldungen kündigen Navigations- oder Wetterwarnungen an: SÉCURITÉ dreimal, ALL SHIPS dreimal, THIS IS + Station, dann die Arbeitsfrequenz, auf der die Meldung folgt. Auch du kannst eine Sicherheitsmeldung absetzen, etwa über einen treibenden Container — auf Grenzwelle als DSC-Sicherheitsanruf an alle Schiffe und dann per Sprechfunk.

:::achtung
Notfrequenzen bleiben für Anruf und Notverkehr frei. Dringlichkeits- und Sicherheitsverkehr wird nach dem Anruf auf 2182 kHz auf eine Arbeitsfrequenz verlegt. Ein Wetterbericht auf 2182 kHz blockiert die Notfrequenz für hunderte Seemeilen im Umkreis.
:::

## Das Wichtigste in Kürze

- Notverkehr per Sprechfunk auf 2182 kHz (MF) und 4125 / 6215 / 8291 / 12290 / 16420 kHz (HF), jeweils passend zur DSC-Notfrequenz des Bandes.
- Das quittierende RCC oder die Küstenfunkstelle leitet den Notverkehr; in Deutschland MRCC Bremen („Bremen Rescue"). Entfernte Stationen hören mit und greifen nicht ein.
- Ohne Quittung innerhalb einiger Minuten: Sprechfunkquittung auf 2182 kHz und RCC informieren; bei Bedarf MAYDAY RELAY gezielt an eine Küstenfunkstelle.
- SEELONCE MAYDAY, PRUDONCE, SEELONCE FEENEE regeln die Funkstille.
- Radio Medical läuft als PAN PAN über das MRCC zum funkärztlichen Beratungsdienst (TMAS), gebührenfrei; Patientendaten und Bordapotheke bereithalten.
- Dringlichkeits- und Sicherheitsverkehr nach dem Anruf auf Arbeitsfrequenzen verlegen; Notfrequenzen freihalten.
