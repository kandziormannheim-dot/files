Maritime Safety Information (MSI) sind die Informationen, die du unterwegs bekommen musst, ohne danach zu fragen: Navigationswarnungen, Wetterwarnungen und Wetterberichte, Meldungen über Such- und Rettungseinsätze, Eiswarnungen, Piraterie-Warnungen. Der Empfang von MSI ist eine der neun GMDSS-Funktionen. Drei Wege bringen sie an Bord: NAVTEX auf Grenz-/Mittelwelle, SafetyNET über Inmarsat-EGC (beziehungsweise SafetyCast über Iridium) und Fernschreibfunk auf Kurzwelle.

## Wer sendet was: NAVAREAs und METAREAs

Die IMO hat die Weltmeere in 21 **NAVAREAs** eingeteilt. In jedem ist ein Land als Koordinator für Navigationswarnungen zuständig; Nord- und Ostsee gehören zu NAVAREA I (Koordinator Großbritannien). Deckungsgleich sind die **METAREAs** für Wetterinformationen. Innerhalb einer NAVAREA gibt es Küstenwarngebiete, die über NAVTEX bedient werden. Warnungen werden abgestuft:

- **NAVAREA-Warnungen** für die Hochsee, verbreitet über SafetyNET und HF-NBDP
- **Küstenwarnungen** (Coastal Warnings) über NAVTEX
- **örtliche Warnungen** über UKW-Küstenfunkstellen oder Hafenfunk

## NAVTEX

NAVTEX ist ein Fernschreibdienst, der Sicherheitsinformationen automatisch empfängt und ausdruckt oder anzeigt. Die Sender stehen an den Küsten und decken jeweils etwa 250 bis 400 sm ab. Es gibt drei Frequenzen:

| Frequenz | Dienst |
|---|---|
| 518 kHz | internationaler NAVTEX-Dienst, immer in **englischer Sprache** |
| 490 kHz | nationaler Dienst in der **Landessprache** |
| 4209,5 kHz | NAVTEX auf Kurzwelle für tropische Gebiete mit hohem Störpegel, wenig verbreitet |

Ein Empfänger für 518 kHz gehört zur GMDSS-Grundausstattung in allen NAVTEX-Gebieten. Der Deutsche Wetterdienst sendet für die deutsche Küste über den Sender Pinneberg auf beiden Frequenzen.

Jede Nachricht ist gleich aufgebaut: Sie beginnt mit `ZCZC`, dann folgt eine vierstellige Kennung `B1B2B3B4`, der Text, und `NNNN` als Ende.

- **B1** ist die Senderkennung: ein Buchstabe je Sender. Die Sender einer NAVAREA teilen sich den Buchstabenkreis und senden zeitversetzt, damit sie sich auf derselben Frequenz nicht stören. Jeder Sender hat feste Sendezeiten, alle vier Stunden.
- **B2** ist die Nachrichtenart: `A` Navigationswarnungen, `B` Wetterwarnungen, `D` Informationen zu Suche und Rettung, `E` Wettervorhersagen, `L` weitere Navigationswarnungen. Die Arten **A, B, D und L können am Empfänger nicht abgeschaltet werden**; alle anderen darfst du abwählen.
- **B3B4** ist die laufende Nummer; `00` kennzeichnet eine Nachricht von besonderer Bedeutung, die immer gedruckt wird, auch wenn sie schon empfangen wurde.

Der Empfänger merkt sich empfangene Kennungen und druckt Wiederholungen nicht erneut. Du stellst ein, welche Sender (B1) und welche Nachrichtenarten (B2) du empfangen willst. Für eine Reise wählst du die Sender entlang der Route; ein Blick in die Nautischen Funkdienste oder die ALRS zeigt, welcher Buchstabe wo sendet.

:::merke
NAVTEX 518 kHz international auf Englisch, 490 kHz national in Landessprache. Die Nachrichtenarten A (Navigationswarnungen), B (Wetterwarnungen), D (SAR-Informationen) und L lassen sich nicht abwählen.
:::

:::beispiel
Du empfängst auf 518 kHz: `ZCZC SA47` — Sender S, Navigationswarnung Nummer 47 — mit dem Text, dass eine Tonne in der Elbmündung verdriftet ist. Kurz darauf `ZCZC SB12`: eine Wetterwarnung desselben Senders, Starkwind Nordwest 7 in der Deutschen Bucht. Beide Nachrichten hättest du am Gerät nicht unterdrücken können. Die Nummer 47 wird bei der nächsten Aussendung nicht noch einmal gedruckt.
:::

## SafetyNET über Inmarsat-EGC

Außerhalb der NAVTEX-Reichweite übernimmt der Satellit. **EGC** (Enhanced Group Call) ist die Rundsendefunktion von Inmarsat-C: Nachrichten gehen nicht an ein einzelnes Terminal, sondern an alle Terminals in einem definierten Gebiet. Über EGC laufen zwei Dienste:

- **SafetyNET**: die MSI-Verbreitung im GMDSS — NAVAREA- und METAREA-Warnungen, Wetterberichte für die Hochsee, SAR-Meldungen und Notalarm-Weiterleitungen von RCCs an alle Schiffe in einem Gebiet (Land → Schiff).
- **FleetNET**: kommerzielle Nachrichten an Flotten oder Abonnentengruppen, nicht sicherheitsrelevant.

Der EGC-Empfänger ist meist in das Inmarsat-C-Terminal integriert. Du stellst ein, für welche NAVAREA und welche Küstenwarngebiete du Meldungen bekommen möchtest; die aktuelle Position vom GNSS-Empfänger nutzt das Terminal, um gebietsbezogene Meldungen automatisch zu filtern. Not- und Dringlichkeitsmeldungen mit Gebietsbezug werden immer empfangen und lösen einen Alarm am Terminal aus. SafetyNET-Meldungen werden zu festen Zeiten wiederholt; ein neu eingeschaltetes Terminal fängt die nächste planmäßige Aussendung.

Iridium bietet mit **SafetyCast** den gleichwertigen Dienst: MSI für ein Gebiet an alle zugelassenen Terminals, weltweit einschließlich der Polargebiete.

## MSI über Kurzwelle: HF-NBDP

Wo weder NAVTEX noch Satellit verfügbar ist, etwa in Teilen von A4 oder als Ersatz bei Ausfall, sendet der internationale **NBDP-Dienst** (Narrow-Band Direct Printing, Fernschreibfunk) MSI auf Kurzwelle. Dafür sind Frequenzen in jedem Seefunkband festgelegt, unter anderem 4210, 6314, 8416,5, 12579 und 16806,5 kHz; weitere liegen in den 19-, 22- und 26-MHz-Bändern. Die Aussendungen werden von den NAVAREA-Koordinatoren nach festen Sendeplänen abgestrahlt. Der Empfang läuft über den NBDP-Empfänger oder den Fernschreibteil der MF/HF-Anlage im Modus FEC (Forward Error Correction, Rundsendebetrieb). Zeiten und Frequenzen stehen in der ALRS und im GMDSS Master Plan.

NBDP dient außerdem dem Notverkehr: Auf den NBDP-Notfrequenzen (etwa 2174,5 kHz, 8376,5 kHz) kann Notverkehr als Fernschreiben statt Sprechfunk geführt werden, wenn im DSC-Alarm diese Betriebsart gewählt wurde.

:::achtung
Ein NAVTEX- oder EGC-Empfänger nützt nur, wenn er eingeschaltet ist und die richtigen Sender und Gebiete eingestellt sind. Stelle den Empfänger vor dem Auslaufen ein und prüfe unterwegs, ob Meldungen ankommen — Funkstille am Drucker kann auch heißen, dass du den falschen Sender gewählt hast.
:::

## Wetterberichte auf Sprechfunk und Kurzwelle

Ergänzend zu MSI im engen Sinn geben viele Küstenfunkstellen Wetterberichte per Sprechfunk aus, auf UKW-Arbeitskanälen und auf Grenzwelle. Der Deutsche Wetterdienst strahlt Seewetterberichte und Wetterfax-Karten auf Kurzwelle ab; Sendezeiten und Frequenzen stehen in den Nautischen Funkdiensten. Eine Sturmwarnung im Sprechfunk wird als Sicherheitsmeldung angekündigt: SÉCURITÉ, dreimal, dann Nennung des Arbeitskanals oder der Frequenz, auf der die Warnung folgt.

## Das Wichtigste in Kürze

- MSI = Navigations- und Wetterwarnungen, Wetterberichte, SAR-Informationen. Empfang ist eine der neun GMDSS-Funktionen.
- NAVTEX: 518 kHz international auf Englisch, 490 kHz national, 4209,5 kHz tropisch. Reichweite je Sender etwa 250 bis 400 sm.
- Nachrichtenaufbau ZCZC B1B2B3B4 … NNNN: B1 Sender, B2 Art, B3B4 Nummer. A, B, D, L sind nicht abwählbar.
- SafetyNET über Inmarsat-EGC und SafetyCast über Iridium versorgen die Hochsee; NAVAREA- und Küstenwarngebiete am Terminal einstellen.
- HF-NBDP sendet MSI auf festen Kurzwellenfrequenzen (4210, 6314, 8416,5, 12579, 16806,5 kHz) im FEC-Betrieb, wichtig in A4 und als Rückfallebene.
- Empfänger vor dem Auslaufen einschalten und einstellen; Sturmwarnungen im Sprechfunk werden mit SÉCURITÉ angekündigt.
