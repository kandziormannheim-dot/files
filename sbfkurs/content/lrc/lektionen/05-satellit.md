Der Satellitenfunk hat im GMDSS zwei sehr unterschiedliche Aufgaben. Kommunikationssatelliten wie Inmarsat und Iridium verbinden dein Schiff mit Land: Notalarm, Sprechverbindung, Daten, Empfang von Sicherheitsinformationen. Das Cospas-Sarsat-System dagegen redet nicht mit dir — es hört nur auf Notbaken und ortet sie. Beide Systeme solltest du im Zusammenspiel verstehen, denn im Seegebiet A3 ist ein Satellitendienst oft der einzige zuverlässige Weg zu einem Rettungsleitzentrum.

## Inmarsat: geostationäre Satelliten

Inmarsat betreibt Satelliten in geostationärer Umlaufbahn, rund 36 000 km über dem Äquator. Vier Satelliten decken damit die Ozeanregionen ab; ihre Versorgung reicht ungefähr bis 70 Grad nördlicher und südlicher Breite, in den Polargebieten stehen die Satelliten zu flach über dem Horizont. Genau diese Versorgung definiert klassisch das Seegebiet A3.

Für das GMDSS anerkannt sind bei Inmarsat:

- **Inmarsat-C** (und Mini-C): ein Datendienst ohne Sprache. Das Terminal arbeitet nach dem Prinzip „speichern und weiterleiten" (Store and Forward): Nachrichten werden im Terminal getippt, über den Satelliten an eine Bodenstation übertragen und von dort als E-Mail, Telex oder Fax zugestellt. Inmarsat-C bietet die **Notalarmtaste** (Distress Button), die einen Notalarm mit Kennung, Position und Zeit an das für die Region zuständige RCC sendet, und den **EGC-Empfang** für SafetyNET-Sicherheitsinformationen. Die Antenne ist klein und ungerichtet, das Terminal genügsam im Stromverbrauch — deshalb ist Inmarsat-C auf Berufsschiffen und größeren Yachten das Standard-Satellitengerät im GMDSS.
- **Fleet-Dienste** (Fleet 77, FleetBroadband mit GMDSS-Zusatz): Sprach- und Datenverbindungen mit gerichteter, nachgeführter Antenne. Für das GMDSS wichtig ist die **Vorrangschaltung**: Ein Notruf per Sprechverbindung wird mit Notpriorität durchgestellt und landet direkt beim RCC, notfalls unter Trennung anderer Verbindungen.

Nicht jedes Inmarsat-Terminal ist ein GMDSS-Gerät. Ein Internet-Terminal ohne Notpriorität und ohne EGC ist zwar praktisch, ersetzt aber keine GMDSS-Anlage.

:::merke
Inmarsat-C: Daten, Store and Forward, Notalarmtaste, EGC-Empfang, keine Sprache. Fleet-Dienste: Sprache und Daten mit Notpriorität. Versorgung etwa zwischen 70° Nord und 70° Süd.
:::

## Iridium: Satelliten in niedriger Umlaufbahn

Iridium betreibt eine Konstellation von 66 aktiven Satelliten auf niedrigen polaren Umlaufbahnen (rund 780 km Höhe). Weil die Bahnen über die Pole führen, deckt Iridium die ganze Erde ab, einschließlich der Polargebiete. Seit 2020 ist Iridium als zweiter GMDSS-Satellitenanbieter anerkannt. Ein GMDSS-Iridium-Terminal bietet:

- Notalarm mit Notpriorität an ein RCC
- Sprechverbindung mit Notpriorität und normale Telefonie
- Datenverbindung und Kurznachrichten
- Empfang von Sicherheitsinformationen über den Iridium-SafetyCast-Dienst

Für dich als Sportbootfahrer ist wichtig: Ein gewöhnliches Iridium-Satellitentelefon ist kein GMDSS-Gerät. Es kann im Notfall ein RCC anrufen — und das solltest du auch tun —, aber es hat keine Notalarmtaste mit automatischer Positionsübermittlung und keinen MSI-Empfang. Nur die zugelassenen GMDSS-Terminals erfüllen die Anforderungen für das Seegebiet A3.

## Cospas-Sarsat: das Ortungssystem für Notbaken

Cospas-Sarsat ist ein internationales, kostenfreies Satellitensystem, das ausschließlich Notsignale von Baken auf 406 MHz empfängt. Es gibt keine Kommunikation zurück zum Schiff. Die Seefunkbake heißt EPIRB, das Gegenstück für Flugzeuge ELT, für Personen PLB. Das System besteht aus drei Satellitengruppen:

- **LEOSAR**: Satelliten in niedriger polarer Umlaufbahn. Sie überfliegen jede Bake mehrmals täglich und können ihre Position über den Doppler-Effekt berechnen — auch ohne GNSS in der Bake. Nachteil: Bis ein Satellit vorbeikommt, können je nach Breite bis zu einigen Stunden vergehen; die Genauigkeit liegt bei wenigen Kilometern.
- **GEOSAR**: geostationäre Satelliten, die den Alarm sofort weiterleiten, aber keine Dopplerortung liefern. Die Position kommt nur an, wenn die Bake einen eigenen GNSS-Empfänger hat.
- **MEOSAR**: Empfänger auf den Navigationssatelliten (GPS, Galileo, GLONASS) in mittlerer Umlaufbahn. Sie verbinden beide Vorteile: nahezu sofortige Erfassung, unabhängige Ortung durch mehrere Satelliten und mit Galileo sogar eine Rückmeldung an die Bake, dass der Alarm empfangen wurde (Return Link Service).

Die Satelliten leiten das Signal an Bodenstationen (LUT, Local User Terminal) weiter. Die zuständige Leitstelle (MCC, Mission Control Centre) entschlüsselt die Kennung der Bake, ermittelt Position und Registrierungsdaten und alarmiert das zuständige RCC. In Deutschland läuft der Alarm beim MRCC Bremen auf.

:::beispiel
Eine Yacht sinkt im Südatlantik, die Besatzung aktiviert die EPIRB in der Rettungsinsel. Innerhalb weniger Minuten erfassen die MEOSAR-Nutzlasten das 406-MHz-Signal und bestimmen die Position auf einige hundert Meter genau. Das MCC liest die Kennung, findet die Registrierung mit Schiffsname, Bootstyp und Notfallkontakt und alarmiert das zuständige RCC. Das RCC ruft die Notfallkontakte an, um zu prüfen, ob die Yacht tatsächlich unterwegs ist, und leitet ein Handelsschiff in der Nähe um.
:::

## Welches System wofür?

| Aufgabe | Inmarsat / Iridium | Cospas-Sarsat |
|---|---|---|
| Notalarm Schiff → Land | ja, mit Notalarmtaste des GMDSS-Terminals | ja, über EPIRB |
| Gespräch mit dem RCC | ja (Fleet, Iridium) | nein |
| Empfang von MSI | ja (EGC SafetyNET, SafetyCast) | nein |
| Funktion ohne Bordstrom | nein | ja, EPIRB hat eigene Batterie |
| Ortung ohne eigene Positionsangabe | nein | ja (Doppler, MEOSAR) |

Für die Regel „zwei unabhängige Wege" ist die Kombination Satellitenterminal plus EPIRB ideal: Das Terminal erlaubt das Gespräch mit dem RCC, die EPIRB funktioniert auch dann noch, wenn das Schiff bereits gesunken ist.

:::achtung
Ein Satellitenterminal braucht freie Sicht zum Satelliten. Bei Inmarsat steht der Satellit über dem Äquator — in hohen Breiten also flach im Süden (Nordhalbkugel). Mast, Aufbauten oder eine Bucht mit hohen Bergen können die Verbindung abschatten. Iridium-Satelliten wandern über den Himmel; kurze Abschattungen führen dort zu Unterbrechungen, aber der nächste Satellit kommt nach wenigen Minuten.
:::

## Bedienung in der Praxis

Vor der Reise: Terminal einschalten, Anmeldung („Log-in") an der zuständigen Ozeanregion oder am Netz prüfen, EGC-Empfang aktivieren und das Gebiet einstellen, Notalarm-Taste kennen — aber nicht ausprobieren. Der Notalarm wird nur bei tatsächlicher Not ausgelöst; ein Fehlalarm ist sofort über dasselbe Terminal an das RCC zu widerrufen. Testverbindungen laufen über die vom Anbieter eingerichteten Testadressen, nicht über die Notfunktion.

## Das Wichtigste in Kürze

- Inmarsat: geostationäre Satelliten, Versorgung etwa 70° Nord bis 70° Süd, definiert klassisch A3. Inmarsat-C = Daten, Store and Forward, Notalarmtaste, EGC. Fleet = Sprache und Daten mit Notpriorität.
- Iridium: 66 Satelliten in niedriger polarer Bahn, weltweite Abdeckung inklusive Pole, seit 2020 GMDSS-Anbieter. Nur zugelassene GMDSS-Terminals zählen für A3.
- Cospas-Sarsat empfängt nur Notbaken auf 406 MHz — keine Kommunikation zum Schiff. LEOSAR (Doppler, verzögert), GEOSAR (sofort, ohne Ortung), MEOSAR (sofort, unabhängige Ortung).
- Alarmweg: Bake → Satellit → LUT → MCC → RCC; in Deutschland MRCC Bremen.
- Satellitenterminal plus EPIRB erfüllt die Regel der zwei unabhängigen Alarmierungswege.
- Freie Sicht zum Satelliten beachten; Notalarmtaste nie zum Test benutzen, Fehlalarm sofort widerrufen.
