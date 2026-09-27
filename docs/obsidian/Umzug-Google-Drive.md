# Umzug der Vault nach Google Drive

Stand: 27.09.2026

**Ziel:** Die Vault liegt im gespiegelten Google-Drive-Ordner. Obsidian, Claudian
und der Git-Abgleich laufen dort weiter wie bisher. Die alte Vault unter
`C:\Obsidian\MartinKandzior` wird danach stillgelegt und nach einer Woche gelöscht.

**Drei Entscheidungen, auf denen dieser Ablauf beruht:**

1. **Drive im Modus „Spiegeln“, nicht „Streamen“.** Beim Spiegeln liegt ein
   echter Ordner auf `C:`, und jede Datei ist immer vollständig vorhanden. Obsidians
   Dateiüberwachung, die Volltextsuche und Claude Code sehen damit gewöhnliche
   Dateien und keine Platzhalter auf einem virtuellen Laufwerk `G:`. „Offline
   verfügbar machen“ entfällt. Der Preis: Die **gesamte** „Meine Ablage“ liegt dann
   lokal, nicht nur die Vault.
2. **Git bleibt, aber das Repository wandert aus der Vault heraus.** Drive kann
   keine Unterordner vom Abgleich ausnehmen und würde `.git\` mitsynchronisieren:
   tausende kleine Dateien, Sperrdateien wie `index.lock`, die nur Millisekunden
   leben. So gehen Git-Repositorys kaputt. Das Repository zieht deshalb nach
   `C:\ObsidianGit\vault.git`, außerhalb von Drive. In der Vault bleibt nur eine
   einzeilige Datei `.git` zurück, die dorthin verweist. Für Git, die Skripte und
   Claude Code ist die Vault damit weiterhin ein gewöhnliches Repository.
3. **Kopieren, nicht verschieben.** Die alte Vault bleibt eine Woche lang als
   `MartinKandzior_ALT` liegen. Ohne Verweis auf Git kann sie nichts mehr
   anrichten, und sie ist der schnellste Weg zurück.

Alle Befehle sind für **Windows PowerShell** gedacht. Die Variablen aus Phase 0
werden in den späteren Phasen weiterverwendet. Wer das Fenster zwischendurch
schließt, führt den Block aus Phase 0 einfach noch einmal aus.

---

## Phase 0 — Vorbereitung

- [ ] **Obsidian vollständig beenden**, auch aus dem Infobereich neben der Uhr.
- [ ] **Claudian und Claude Code beenden.** Es darf keine Sitzung mehr in der Vault laufen.
- [ ] PowerShell öffnen und die Pfade setzen. Den Buchstaben der externen Platte anpassen:

```powershell
$alt     = 'C:\Obsidian\MartinKandzior'
$gitNeu  = 'C:\ObsidianGit\vault.git'
$extern  = 'E:\Backups\Obsidian'                 # externe Platte oder USB-Stick, NICHT Drive
$skripte = "$env:USERPROFILE\Downloads\Obsidian-Skripte"
```

- [ ] **Geplante Aufgaben anhalten.** Sie laufen alle 15 Minuten und dürfen weder
      während des Umzugs noch danach auf den alten Pfad zugreifen:

```powershell
Get-ScheduledTask -TaskName 'Obsidian Vault*' | Format-Table TaskName, State
Get-ScheduledTask -TaskName 'Obsidian Vault*' | Disable-ScheduledTask | Out-Null
```

- [ ] Gibt es die Aufgabe **„Obsidian Vault Sicherung“**, das bisherige Sicherungsziel
      notieren. Es steht hinter `-Sicherungsziel`:

```powershell
(Get-ScheduledTask 'Obsidian Vault Sicherung' -ErrorAction SilentlyContinue).Actions.Arguments
```

- [ ] **Letzter Abgleich mit GitHub**, damit der Umzug mit einem sauberen Stand beginnt:

```powershell
& "$env:LOCALAPPDATA\ObsidianVaultSync\Vault-Sync.ps1" -VaultPath $alt
git -C $alt status --short           # keine Ausgabe = alles eingecheckt
git -C $alt log --oneline origin/main..main   # keine Ausgabe = alles gepusht
```

Meldet der Abgleich `FEHLER`, erst den Konflikt auflösen (siehe
[README](README.md#wenn-ein-git-konflikt-entsteht)) und dann weitermachen.

- [ ] **Größe der Vault und der gesamten „Meine Ablage“ prüfen.** Beim Spiegeln
      landet alles aus Drive auf `C:`. Die Belegung steht unter
      drive.google.com/settings/storage. Freier Platz auf `C:`:
      `Get-PSDrive C | Select-Object Free`

---

## Phase 1 — Backup (Pflicht)

Dieses ZIP ist die Rückfallebene. Es kommt **nicht** nach Drive, sondern auf die
externe Platte. Es enthält auch den `.git`-Ordner, also die ganze Historie, und
ist damit für sich allein vollständig.

> **Nicht `Compress-Archive` verwenden.** Windows PowerShell 5.1 lässt damit
> versteckte Dateien weg (auch `.git`) und scheitert an Dateien über 2 GB.
> `ZipFile` aus .NET hat keines der beiden Probleme. Dasselbe Verfahren benutzt
> auch `Vault-Sicherung.ps1`.

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
New-Item -ItemType Directory -Force -Path $extern | Out-Null
$zip = Join-Path $extern ("vault-vor-umzug_{0}.zip" -f (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
[IO.Compression.ZipFile]::CreateFromDirectory($alt, $zip, 'Optimal', $true)

# Plausibilität: Die Zahl der Einträge sollte gleich der Zahl der Dateien sein
# oder knapp darüber liegen (leere Ordner zählen als eigener Eintrag).
(Get-ChildItem -LiteralPath $alt -Recurse -File -Force).Count
$z = [IO.Compression.ZipFile]::OpenRead($zip); $z.Entries.Count; $z.Dispose()
```

- [ ] ZIP erstellt, beide Zahlen passen zusammen
- [ ] **ZIP im Explorer geöffnet**, zwei, drei Notizen aus tiefen Unterordnern stichprobenartig angesehen

### Aufräumen (optional)

- `.trash\` ist Obsidians interner Papierkorb. Wer ihn leeren will, tut das
  jetzt: Der Inhalt steckt im ZIP. Obsidian legt beim nächsten Löschen einen
  neuen, leeren Ordner an. Der alte Inhalt kommt aber nicht von selbst zurück.
- `node_modules\` unter `.obsidian\plugins\` kommt bei normal installierten
  Plugins nicht vor. Falls doch einer da ist: erst prüfen, ob das Plugin ihn
  braucht.

---

## Phase 2 — Git aus der Vault herauslegen

```powershell
New-Item -ItemType Directory -Force -Path (Split-Path $gitNeu) | Out-Null
git -C $alt init --separate-git-dir $gitNeu
```

Git meldet `Reinitialized existing Git repository in C:/ObsidianGit/vault.git/`.
Dabei wird nichts neu angelegt: Das bestehende Repository mit Historie, Remote und
Einstellungen wird an den neuen Ort verschoben.

```powershell
Get-Content -LiteralPath "$alt\.git" -Force   # → gitdir: C:/ObsidianGit/vault.git
git -C $alt status --short                    # weiterhin keine Ausgabe
git -C $alt remote -v                         # origin wie bisher
```

- [ ] `.git` in der Vault ist jetzt eine **Datei**, kein Ordner
- [ ] `git status` zeigt keine Änderungen, `git remote -v` den bisherigen Remote

> **`C:\ObsidianGit` ist ab jetzt die Historie der Vault.** Diesen Ordner nie
> löschen, auch nicht beim Aufräumen in Phase 7.

---

## Phase 3 — Google Drive auf „Spiegeln“ umstellen

- [ ] **Google Drive for Desktop** ist installiert und mit dem richtigen Konto angemeldet
- [ ] Drive-Symbol im Infobereich → Zahnrad → **Einstellungen** → **Google Drive** →
      **Dateien spiegeln** → Speicherort bestätigen
- [ ] Warten, bis Drive die gesamte „Meine Ablage“ heruntergeladen hat
      („Alle Dateien synchronisiert“)
- [ ] Den gespiegelten Ordner im Explorer suchen (Drive zeigt ihn bei der
      Umstellung an) und den Pfad setzen:

```powershell
$drive = "$env:USERPROFILE\My Drive"      # anpassen, falls Drive einen anderen Ordner nennt
Test-Path -LiteralPath $drive            # muss True liefern
$neu   = Join-Path $drive 'Obsidian\MartinKandzior'
```

---

## Phase 4 — Vault kopieren und alte stilllegen

```powershell
robocopy $alt $neu /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /NP
$LASTEXITCODE          # 0 bis 7 = in Ordnung, ab 8 = Fehler, Ausgabe lesen
(Get-ChildItem -LiteralPath $alt -Recurse -File -Force).Count
(Get-ChildItem -LiteralPath $neu -Recurse -File -Force).Count   # muss gleich sein
git -C $neu status --short                                      # keine Ausgabe
```

`robocopy` kopiert auch versteckte Dateien, also auch die `.git`-Verweisdatei.
Git findet das Repository vom neuen Ort aus sofort wieder, denn die Arbeitskopie
ist nicht an einen festen Pfad gebunden.

Jetzt die alte Vault stilllegen. Wichtig ist das Entfernen ihrer `.git`-Datei:
Sonst zeigen **zwei** Ordner auf dasselbe Repository, und ein versehentliches
`git` im alten Ordner würde den Index durcheinanderbringen.

```powershell
Remove-Item -LiteralPath "$alt\.git" -Force
Rename-Item -LiteralPath $alt -NewName 'MartinKandzior_ALT'
```

- [ ] Dateizahlen gleich, `git status` im neuen Ordner sauber
- [ ] Alte Vault heißt jetzt `C:\Obsidian\MartinKandzior_ALT` und hat keine `.git`-Datei mehr
- [ ] Drive meldet wieder „Alle Dateien synchronisiert“. Auf drive.google.com ist
      `Obsidian\MartinKandzior` zu sehen, und die Dateizahl ist plausibel.

---

## Phase 5 — Aufgaben und Obsidian auf den neuen Pfad umstellen

Obsidian bleibt **noch geschlossen**. `Vault-Einrichten.ps1` bricht sonst ab.

```powershell
cd $skripte
powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1 -VaultPath $neu
```

Das Skript lässt sich beliebig oft ausführen. Hier erkennt es das bestehende
Repository, überschreibt nichts und ersetzt die angehaltene Aufgabe **„Obsidian
Vault Sync“** durch eine neue, aktive Aufgabe mit dem neuen Pfad. Die Sicherung
der Einstellungen landet künftig in `…\Obsidian\_vault-sicherungen` neben der
Vault, also ebenfalls in Drive. Das ist unbedenklich.

Gab es in Phase 0 die Aufgabe „Obsidian Vault Sicherung“, diese mit dem **notierten
Ziel** neu anlegen. Das Ziel muss außerhalb von Drive liegen:

```powershell
powershell -ExecutionPolicy Bypass -File .\Vault-Sicherung.ps1 `
    -VaultPath $neu -Sicherungsziel '<notiertes Ziel>' -AufgabeEinrichten
```

Gab es sie nicht, ist jetzt der richtige Moment dafür. Das ist das „zweite Backup
außerhalb von Drive“: ein Spiegel und tägliche ZIP-Dateien, 30 Tage lang:

```powershell
powershell -ExecutionPolicy Bypass -File .\Vault-Sicherung.ps1 `
    -VaultPath $neu -Sicherungsziel $extern -AufgabeEinrichten
```

Danach:

```powershell
Get-ScheduledTask -TaskName 'Obsidian Vault*' | Format-Table TaskName, State   # beide Ready
powershell -ExecutionPolicy Bypass -File .\Vault-Pruefen.ps1 -VaultPath $neu
```

- [ ] Beide Aufgaben stehen auf `Ready`
- [ ] `Vault-Pruefen.ps1` meldet kein `[PROBLEM]`

Jetzt Obsidian umstellen:

- [ ] Obsidian starten → Vault-Wechsler (unten links) → **„Ordner als Vault öffnen“** → `$neu` wählen
- [ ] Im Vault-Wechsler den alten Eintrag `MartinKandzior` (der Pfad unter `C:\Obsidian`) **entfernen**
- [ ] Einstellungen → Community-Plugins: Alle Plugins sind geladen
- [ ] **Claudian** im neuen Pfad starten und eine Datei lesen und schreiben lassen

> `Obsidian-Einrichten.cmd` hat den alten Pfad fest eingetragen
> (`set "VAULT=C:\Obsidian\MartinKandzior"`). Vor dem nächsten Doppelklick diese
> Zeile auf den neuen Pfad ändern.

---

## Phase 6 — Testprotokoll

Jeder Punkt muss erfüllt sein, bevor die alte Vault gelöscht wird:

- [ ] Volltextsuche findet eine Notiz aus einem tiefen Unterordner
- [ ] Rückverweise und Graph-Ansicht zeigen die Verknüpfungen korrekt
- [ ] Neue Notiz anlegen → nach etwa einer Minute auf drive.google.com sichtbar
- [ ] Notiz umbenennen → Links in anderen Notizen werden mitgezogen
- [ ] Anhänge (Bilder, PDFs) öffnen sich
- [ ] Claudian kann eine Datei anlegen und wieder lesen
- [ ] **Git läuft mit:** Spätestens 15 Minuten nach einer Änderung steht in
      `%LOCALAPPDATA%\ObsidianVaultSync\sync.log` ein Lauf ohne `FEHLER`, und
      `git -C $neu log -1` zeigt den neuen Commit
- [ ] Keine Dateien mit „(1)“ oder „Konflikt“ im Namen:
      `Get-ChildItem -LiteralPath $neu -Recurse -File -Force | Where-Object Name -match '\(\d\)|Konflikt|conflict'`

---

## Phase 7 — Stabilisierung und Abschalten der alten Vault

- [ ] Eine Woche lang täglich kurz den Konfliktdatei-Befehl aus Phase 6 ausführen
      und `Vault-Pruefen.ps1 -VaultPath $neu` laufen lassen
- [ ] **Ab 04.10.2026**, wenn alles stabil läuft: alte Vault löschen

```powershell
Remove-Item -LiteralPath 'C:\Obsidian\MartinKandzior_ALT' -Recurse -Force
```

- [ ] `C:\Obsidian\_vault-sicherungen` enthält nur ältere Stände der Einstellungen
      und kann bleiben oder weg. Liegt danach nichts mehr in `C:\Obsidian`, kann auch
      dieser Ordner weg.
- [ ] **Stehen lassen:** `C:\ObsidianGit` (Historie) und das ZIP aus Phase 1 (dauerhaft)

---

## Rollback

**Solange die alte Vault noch existiert (bis 04.10.):** Der neueste Stand liegt
im Drive-Ordner, denn beim Spiegeln ist er lokal vorhanden. Er wird zurückkopiert.

```powershell
Get-ScheduledTask -TaskName 'Obsidian Vault*' | Disable-ScheduledTask | Out-Null
# Obsidian und Claudian beenden, dann:
robocopy $neu $alt /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /NP     # holt auch die .git-Datei zurück
Remove-Item -LiteralPath "$neu\.git" -Force                  # nur noch EIN Ordner zeigt auf das Repository
cd $skripte
powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1 -VaultPath $alt
# und ggf. Vault-Sicherung.ps1 -VaultPath $alt ... -AufgabeEinrichten
```

Danach in Obsidian `$alt` als Vault öffnen und den Drive-Eintrag entfernen. Den
Drive-Ordner und `MartinKandzior_ALT` nicht anfassen, bis geklärt ist, was
schiefging.

**Wenn alles andere verloren ist:** Das ZIP aus Phase 1 nach `C:\Obsidian\`
entpacken, **nicht** nach `C:\Obsidian\MartinKandzior`, denn der Ordner steckt
schon im ZIP. Diese Kopie hat ihren eigenen `.git`-Ordner und braucht
`C:\ObsidianGit` nicht. Ihr Stand ist der vom Tag des Umzugs. Neuere Commits
lassen sich von GitHub holen: `git -C $alt pull --rebase origin main`.

---

## Dauerhafte Betriebsregeln

**Git gibt es nur auf diesem Rechner.** `C:\ObsidianGit` existiert nur hier.
Auf einem zweiten Rechner mit Drive kommt zwar die `.git`-Datei an, aber sie
verweist ins Leere. Obsidian stört das nicht, `git` dort aber schon. Auf einem
zweiten Rechner deshalb **keine** Abgleichsaufgabe einrichten.

**Nie parallel auf zwei Geräten arbeiten.** Drive führt nichts zusammen, sondern
legt Konfliktkopien an. Vor dem Gerätewechsel warten, bis Drive „synchronisiert“
meldet. `.obsidian\workspace.json` ändert sich bei jedem Klick und ist der
häufigste Auslöser solcher Konflikte.

**Drive ist Abgleich, keine Sicherung.** Eine Löschung wird mitsynchronisiert.
Die Sicherungen sind: die Git-Historie auf GitHub, die Aufgabe „Obsidian Vault
Sicherung“ auf der externen Platte und das ZIP aus Phase 1. Für einzelne Dateien
gibt es außerdem den Versionsverlauf von Drive (Rechtsklick auf die Datei auf
drive.google.com → Versionen verwalten).

**Nicht zurück auf „Streamen“ schalten.** Dann lägen die Notizen wieder nur als
Platzhalter auf einem virtuellen Laufwerk, mit den Problemen, die dieser Umzug
vermeiden soll.

**Obsidian auf dem Handy kann nicht auf Drive zugreifen.** Wird die Vault mobil
gebraucht, ist Obsidian Sync (kostenpflichtig) der passende Weg, mit echter
Versionierung und Konfliktauflösung.
