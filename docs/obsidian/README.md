# Obsidian-Vault — prüfen und einrichten

Für die Vault unter `C:\Obsidian\MartinKandzior`. Drei PowerShell-Skripte, die
lokal auf dem Windows-Rechner laufen:

| Skript | Zweck |
| --- | --- |
| [`Vault-Pruefen.ps1`](Vault-Pruefen.ps1) | Zeigt den Zustand an. Ändert nichts. |
| [`Vault-Einrichten.ps1`](Vault-Einrichten.ps1) | Bringt Einstellungen, Struktur und Versionierung in Ordnung. |
| [`Vault-Sync.ps1`](Vault-Sync.ps1) | Der regelmäßige Abgleich. Läuft aus der Aufgabenplanung, nicht von Hand. |

## Zuerst: wie Obsidian speichert

Das ist die Grundlage für alles Weitere, und es beruhigt.

Obsidian hat **keinen Speichern-Knopf** und braucht keinen. Jede Notiz ist eine
gewöhnliche `.md`-Datei im Vault-Ordner; Obsidian schreibt sie kurz nach dem
Tippen auf die Platte — bei Tippstopp, beim Fensterwechsel, beim Schließen.
Es gibt keine Datenbank, kein proprietäres Format, keinen Zwischenspeicher, der
verlorengehen könnte. Selbst wenn Obsidian nie wieder startete: die Notizen
lägen unverändert im Ordner und ließen sich mit jedem Texteditor öffnen.

Drei Dinge können trotzdem schiefgehen — und genau die stellt die Einrichtung ab:

1. **Die letzten Sekunden vor einem Absturz.** Dagegen hilft das Kern-Plugin
   *Dateiwiederherstellung*: es legt in kurzen Abständen Schnappschüsse an, aus
   denen sich eine ältere Fassung zurückholen lässt.
2. **Versehentliches Löschen oder Überschreiben.** Dagegen hilft der Papierkorb
   *innerhalb* der Vault (`.trash`) statt des Windows-Papierkorbs — und die
   Git-Historie, in der jeder Stand der letzten Wochen abrufbar bleibt.
3. **Ein Plattenschaden.** Dagegen hilft nur eine Kopie außerhalb des Rechners:
   der automatische Push in ein privates Git-Repository.

## Loslegen

**1. Obsidian vollständig beenden.** Auch aus dem Infobereich neben der Uhr —
Obsidian hält die Einstellungen im Speicher und schreibt sie beim Beenden zurück.
Änderungen von außen wären sonst wieder weg. Das Einrichtungsskript prüft das
und bricht ab, wenn Obsidian noch läuft.

**2. Zustand ansehen** (ändert nichts, gefahrlos):

```powershell
cd <Ordner mit diesen Skripten>
powershell -ExecutionPolicy Bypass -File .\Vault-Pruefen.ps1
```

**3. Einrichten.** Ohne Remote — Versionierung nur auf diesem Rechner:

```powershell
powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1
```

Mit Sicherung außerhalb des Rechners (empfohlen, siehe unten):

```powershell
powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1 `
    -RemoteUrl 'https://github.com/kandziormannheim-dot/obsidian-vault.git'
```

Das Skript lässt sich beliebig oft laufen. Es legt nur an, was fehlt,
überschreibt keine Notiz und keine vorhandene Vorlage, und sichert den bisherigen
`.obsidian`-Ordner vorher nach `C:\Obsidian\_vault-sicherungen\`.

Danach Obsidian öffnen. Ein Punkt bleibt Handarbeit, weil Obsidian ihn nur über
die Oberfläche annimmt: **Einstellungen → Dateiwiederherstellung** — Intervall
und Aufbewahrung hochsetzen, etwa alle 5 Minuten und 30 Tage.

## Was eingestellt wird

**Damit nichts verlorengeht** (diese vier setzt das Skript auch dann, wenn schon
etwas anderes eingetragen ist):

| Einstellung | Wert | Warum |
| --- | --- | --- |
| `alwaysUpdateLinks` | an | Verschieben und Umbenennen zieht alle Links mit, statt sie ins Leere zeigen zu lassen |
| `trashOption` | `local` | Gelöschtes landet in `.trash` in der Vault und bleibt greifbar |
| `promptDelete` | an | Löschen wird bestätigt |
| `attachmentFolderPath` | `Medien` | Anhänge gesammelt statt verstreut im Wurzelordner |

**Alles Übrige** — neue Notizen in den Posteingang, kurze `[[Wikilinks]]`,
Rechtschreibprüfung, Live-Vorschau, lesbare Zeilenlänge — wird nur ergänzt, wenn
noch nichts dazu eingetragen ist. Eigene Einstellungen bleiben also stehen.

**Kern-Plugins** werden nur eingeschaltet, nie ausgeschaltet: unter anderem
Dateiwiederherstellung, Tagesnotizen, Vorlagen, Rückverweise, Gliederung,
Lesezeichen, Volltextsuche.

**Ordner** — angelegt wird nur, was fehlt; verschoben wird nichts:

```
00_Posteingang     Alles Neue landet hier und wird später einsortiert
10_Tagesnotizen    Eine Notiz je Tag, benannt nach dem Datum
20_Projekte        Vorhaben mit Ende
30_Bereiche        Laufende Verantwortung ohne Enddatum
40_Wissen          Nachschlagbares
90_Archiv          Abgeschlossenes — nichts wird gelöscht, nur hierher verschoben
Medien             Bilder, PDFs, Anhänge
Vorlagen           Tagesnotiz, Notiz, Projekt, Besprechung
```

Die Aufteilung ist ein Vorschlag, keine Vorgabe. Wer anders sortieren will,
benennt die Ordner in Obsidian um — die Links ziehen mit. Nur zwei Namen stehen
auch in den Einstellungen und müssten dort mitgeändert werden: `Medien` und
`10_Tagesnotizen`.

Anhänge, die schon vorher im Wurzelordner lagen, werden **nicht** verschoben.
Das geht in Obsidian per Drag & Drop, dann bleiben die Links intakt.

## Sicherung außerhalb des Rechners

Ohne Remote liegt die Historie auf derselben Platte wie die Vault — bei einem
Plattenschaden ist beides weg. Deshalb ein privates Repository:

1. Auf GitHub ein **leeres, privates** Repository anlegen, etwa
   `kandziormannheim-dot/obsidian-vault`. Ohne README, ohne `.gitignore` —
   sonst gibt es beim ersten Push einen Konflikt.
2. Das Einrichtungsskript mit `-RemoteUrl` laufen lassen (siehe oben).
3. Beim ersten Push fragt Windows nach den GitHub-Zugangsdaten. Einmal anmelden;
   danach merkt sich der Windows-Anmeldeinformationsmanager die Daten und der
   automatische Abgleich läuft ohne Rückfrage.

**Privat, nicht öffentlich.** In der Vault stehen persönliche Notizen. Ein
öffentliches Repository wäre für jeden lesbar und bliebe es auch nach dem
Löschen noch eine Weile in Caches und Suchmaschinen.

## Der automatische Abgleich

`Vault-Einrichten.ps1` legt die geplante Aufgabe **„Obsidian Vault Sync"** an.
Sie läuft bei der Anmeldung und danach alle 15 Minuten (`-IntervalMinutes`
ändert das) und tut jedes Mal dasselbe:

1. Alle Änderungen einchecken — falls es welche gibt.
2. Vom Remote holen, lokale Commits per Rebase daraufsetzen, pushen.
3. Eine Zeile ins Protokoll schreiben.

Protokoll: `%LOCALAPPDATA%\ObsidianVaultSync\sync.log`

Ist das Netz gerade weg, wird nur lokal eingecheckt und der Push beim nächsten
Lauf nachgeholt. Das ist kein Fehler und wird auch nicht als solcher gemeldet.

Es ist **keine Echtzeit-Synchronisierung**. Wer die Vault auf zwei Rechnern
parallel bearbeitet, sollte auf dem einen den Abgleich abwarten, bevor er am
anderen weiterschreibt — sonst entstehen Konflikte.

### Wenn ein Konflikt entsteht

Haben zwei Rechner dieselbe Notiz geändert, bricht der Abgleich ab, **ohne
etwas zu überschreiben**: der Rebase wird zurückgenommen, der lokale Stand
bleibt unverändert, und im Protokoll steht `FEHLER`. `Vault-Pruefen.ps1` meldet
dann „Lokal und Remote sind auseinandergelaufen".

Auflösen von Hand:

```powershell
git -C C:\Obsidian\MartinKandzior pull --rebase origin main
# Konfliktstellen in den betroffenen Notizen bereinigen, dann:
git -C C:\Obsidian\MartinKandzior add -A
git -C C:\Obsidian\MartinKandzior rebase --continue
git -C C:\Obsidian\MartinKandzior push origin main
```

Danach übernimmt die geplante Aufgabe wieder von allein.

## Was die Skripte nicht tun

- **Keine Notiz wird angefasst.** Kein Verschieben, kein Umbenennen, kein
  Umschreiben von Inhalten.
- **Keine vorhandene Vorlage wird überschrieben.**
- **Keine Einstellung wird gelöscht.** Eigene Werte bleiben stehen, außer bei
  den vier oben genannten.
- **Keine Community-Plugins** werden installiert. Die Einrichtung kommt mit
  Obsidians Bordmitteln aus.

## Andere Wege, die Vault aktuell zu halten

**Obsidian Sync** (kostenpflichtig, vom Hersteller): Abgleich in Sekunden,
Versionshistorie eingebaut, funktioniert auch auf iOS und Android ohne
Bastelei. Der bequemste Weg, wenn Mobilgeräte dazukommen sollen. Ersetzt die
Git-Versionierung nicht zwingend — beides nebeneinander ist möglich.

**OneDrive, Dropbox, Google Drive**: geht, hat aber zwei Fallstricke, die
regelmäßig Vaults beschädigen.

- *Dateien bei Bedarf* muss für den Vault-Ordner **aus** sein (Rechtsklick →
  „Immer auf diesem Gerät behalten"). Sonst sieht Obsidian Platzhalter statt
  Dateien und legt beim Indizieren Dubletten an.
- `.obsidian\workspace.json` ändert sich bei jedem Klick. Synchronisieren zwei
  Rechner diese Datei gleichzeitig, entstehen `…-Konflikt-PC.json`-Dubletten.

Genau deshalb steht die Datei in der `.gitignore`, die das Einrichtungsskript
anlegt — beim Git-Weg tritt das Problem nicht auf.

## Zurückdrehen

Geplante Aufgabe entfernen:

```powershell
Unregister-ScheduledTask -TaskName 'Obsidian Vault Sync' -Confirm:$false
```

Alte Einstellungen zurückholen: den gewünschten Stand aus
`C:\Obsidian\_vault-sicherungen\obsidian-config_<Zeitstempel>\.obsidian\` bei
geschlossenem Obsidian über `C:\Obsidian\MartinKandzior\.obsidian\` kopieren.

Die Versionierung selbst lässt sich durch Löschen von
`C:\Obsidian\MartinKandzior\.git` aufheben — die Notizen bleiben davon
unberührt, die Historie ist dann allerdings weg.
