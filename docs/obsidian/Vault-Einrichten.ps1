<#
.SYNOPSIS
    Richtet eine Obsidian-Vault so ein, dass nichts verlorengeht und alles versioniert wird.
.DESCRIPTION
    Das Skript ist wiederholbar: es legt nur an, was fehlt, und ergänzt bestehende
    Einstellungen, statt sie zu ersetzen. Vorhandene Notizen werden nie angefasst,
    vorhandene Vorlagen nie überschrieben. Vor jeder Änderung an '.obsidian'
    wird eine datierte Sicherung neben der Vault abgelegt.

    Im Einzelnen:
      1. Sicherung des bisherigen '.obsidian'-Ordners
      2. Ordnerstruktur (Posteingang, Tagesnotizen, Projekte, ... , Medien, Vorlagen)
      3. Vier Vorlagen, sofern noch nicht vorhanden
      4. Einstellungen in '.obsidian' ergänzen (Anhänge, Papierkorb, Links, Kern-Plugins)
      5. '.gitignore' und '.gitattributes' für die Vault
      6. Git-Repository anlegen, erster Commit, optional Remote und Push
      7. Geplante Aufgabe für den regelmäßigen Abgleich

    Obsidian muss geschlossen sein: es schreibt '.obsidian\*.json' beim Beenden aus
    dem Speicher zurück und würde Änderungen von außen sonst überschreiben.
.PARAMETER VaultPath
    Ordner der Vault. Vorgabe: C:\Obsidian\MartinKandzior
.PARAMETER RemoteUrl
    Optionale URL eines leeren, privaten Git-Repositorys. Ohne diesen Wert bleibt
    die Historie nur auf diesem Rechner.
.PARAMETER IntervalMinutes
    Abstand zwischen zwei Abgleichen. Vorgabe: 15 Minuten.
.PARAMETER SkipTask
    Keine geplante Aufgabe anlegen.
.PARAMETER OhneGit
    Schritte 5 bis 7 auslassen: keine Versionierung, keine .gitignore, keine
    Abgleichsaufgabe. Nur Einstellungen, Ordner und Vorlagen. Für die Sicherung
    ist dann Vault-Sicherung.ps1 zuständig.
.PARAMETER Force
    Auch dann weitermachen, wenn Obsidian gerade läuft (nicht empfohlen).
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1 `
        -RemoteUrl 'https://github.com/kandziormannheim-dot/obsidian-vault.git'
#>
[CmdletBinding()]
param(
    [string]$VaultPath       = 'C:\Obsidian\MartinKandzior',
    [string]$RemoteUrl       = '',
    [int]   $IntervalMinutes = 15,
    [switch]$SkipTask,
    [switch]$OhneGit,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Obsidian Vault Sync'

function Write-Schritt { param([string]$T)
    Write-Host ''
    Write-Host "== $T" -ForegroundColor Cyan
}
function Write-Tat     { param([string]$T) Write-Host "   + $T" -ForegroundColor Green }
function Write-Schon   { param([string]$T) Write-Host "   . $T" -ForegroundColor DarkGray }
function Write-Warn    { param([string]$T) Write-Host "   ! $T" -ForegroundColor Yellow }

function Write-JsonDatei {
    param([string]$Pfad, $Daten)
    $json = $Daten | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($Pfad, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Read-JsonDatei {
    param([string]$Pfad)
    if (-not (Test-Path -LiteralPath $Pfad)) { return $null }
    try { return (Get-Content -LiteralPath $Pfad -Raw -Encoding UTF8 | ConvertFrom-Json) }
    catch {
        Write-Warn "'$([System.IO.Path]::GetFileName($Pfad))' war kein gültiges JSON und wird neu geschrieben."
        return $null
    }
}

function ConvertTo-OrderedHashtable {
    param($Objekt)
    $ht = [ordered]@{}
    if ($null -ne $Objekt) {
        foreach ($p in $Objekt.PSObject.Properties) { $ht[$p.Name] = $p.Value }
    }
    return $ht
}

# Ergänzt fehlende Schlüssel, lässt abweichende Werte des Nutzers in Ruhe,
# außer sie stehen in $Erzwingen.
function Merge-JsonDatei {
    param(
        [string]   $Pfad,
        [hashtable]$Sollwerte,
        [string[]] $Erzwingen = @()
    )
    $ist = ConvertTo-OrderedHashtable (Read-JsonDatei $Pfad)
    $geaendert = @()
    foreach ($schluessel in $Sollwerte.Keys) {
        $soll = $Sollwerte[$schluessel]
        if (-not $ist.Contains($schluessel)) {
            $ist[$schluessel] = $soll
            $geaendert += "$schluessel = $soll"
        } elseif ($Erzwingen -contains $schluessel -and "$($ist[$schluessel])" -ne "$soll") {
            $ist[$schluessel] = $soll
            $geaendert += "$schluessel = $soll (ersetzt)"
        }
    }
    if ($geaendert.Count -gt 0) {
        Write-JsonDatei -Pfad $Pfad -Daten $ist
        foreach ($g in $geaendert) { Write-Tat $g }
    } else {
        Write-Schon "$([System.IO.Path]::GetFileName($Pfad)) war bereits vollständig."
    }
}

function New-TextDatei {
    param([string]$Pfad, [string]$Inhalt)
    if (Test-Path -LiteralPath $Pfad) {
        Write-Schon "$([System.IO.Path]::GetFileName($Pfad)) existiert bereits — unverändert."
        return
    }
    $verzeichnis = Split-Path -Parent $Pfad
    if (-not (Test-Path -LiteralPath $verzeichnis)) { New-Item -ItemType Directory -Path $verzeichnis -Force | Out-Null }
    if (-not $Inhalt.EndsWith("`n")) { $Inhalt += "`n" }
    [System.IO.File]::WriteAllText($Pfad, $Inhalt, (New-Object System.Text.UTF8Encoding($false)))
    Write-Tat "$([System.IO.Path]::GetFileName($Pfad)) angelegt."
}

Write-Host ''
Write-Host "Obsidian-Vault einrichten: $VaultPath" -ForegroundColor White

# ============================================================ 0 Voraussetzungen
Write-Schritt 'Voraussetzungen'

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
    throw "Der Vault-Ordner '$VaultPath' existiert nicht. Mit -VaultPath den richtigen Pfad angeben."
}
Write-Schon "Vault-Ordner gefunden."

if (@(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue).Count -gt 0) {
    if (-not $Force) {
        throw ("Obsidian läuft. Bitte vollständig beenden (auch aus dem Infobereich neben der Uhr) " +
               "und das Skript erneut starten — sonst schreibt Obsidian die Einstellungen beim " +
               "Beenden wieder zurück. Ausnahmsweise mit -Force übergehen.")
    }
    Write-Warn 'Obsidian läuft — Einstellungen können beim Beenden überschrieben werden.'
}

$configDir = Join-Path $VaultPath '.obsidian'
if (-not (Test-Path -LiteralPath $configDir)) {
    Write-Warn "'.obsidian' fehlt — die Vault wurde noch nie in Obsidian geöffnet."
    Write-Warn "Die Einstellungen werden trotzdem geschrieben; Obsidian übernimmt sie beim ersten Start."
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$gitVorhanden = (-not $OhneGit) -and ($null -ne (Get-Command git -ErrorAction SilentlyContinue))
if ($OhneGit) {
    Write-Schon 'Ohne Git (-OhneGit): nur Einstellungen, Ordner und Vorlagen.'
} elseif ($gitVorhanden) {
    Write-Schon "Git gefunden: $((& git --version) -join '')"
} else {
    Write-Warn 'Git fehlt — Schritte 5 bis 7 werden übersprungen. https://git-scm.com/download/win'
    Write-Warn 'Für die Sicherung ohne Git: Vault-Sicherung.ps1 (siehe README).'
}

# ================================================================ 1 Sicherung
Write-Schritt 'Sicherung der bisherigen Einstellungen'

$sicherungsWurzel = Join-Path (Split-Path -Parent $VaultPath) '_vault-sicherungen'
$zeitstempel      = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$sicherungsZiel   = Join-Path $sicherungsWurzel "obsidian-config_$zeitstempel"
$vorhandeneJson   = @(Get-ChildItem -LiteralPath $configDir -Filter '*.json' -File -ErrorAction SilentlyContinue)
if ($vorhandeneJson.Count -gt 0) {
    New-Item -ItemType Directory -Path $sicherungsZiel -Force | Out-Null
    Copy-Item -LiteralPath $configDir -Destination $sicherungsZiel -Recurse -Force
    Write-Tat "Kopie unter $sicherungsZiel"
    # Nur die zehn jüngsten Sicherungen behalten.
    Get-ChildItem -LiteralPath $sicherungsWurzel -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -Skip 10 |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
} else {
    Write-Schon 'Nichts zu sichern — noch keine Einstellungen vorhanden.'
}

# ============================================================ 2 Ordnerstruktur
Write-Schritt 'Ordnerstruktur'

$ordner = [ordered]@{
    '00_Posteingang'  = 'Alles Neue landet hier und wird später einsortiert.'
    '10_Tagesnotizen' = 'Eine Notiz je Tag, automatisch benannt nach dem Datum.'
    '20_Projekte'     = 'Vorhaben mit Ende — je Projekt ein Ordner oder eine Notiz.'
    '30_Bereiche'     = 'Laufende Verantwortung ohne Enddatum.'
    '40_Wissen'       = 'Nachschlagbares: Verfahren, Notizen zu Themen, Gelesenes.'
    '90_Archiv'       = 'Abgeschlossenes. Nichts wird gelöscht, nur hierher verschoben.'
    'Medien'          = 'Bilder, PDFs, Anhänge — Obsidian legt sie hier automatisch ab.'
    'Vorlagen'        = 'Textbausteine für neue Notizen.'
}
foreach ($name in $ordner.Keys) {
    $pfad = Join-Path $VaultPath $name
    if (Test-Path -LiteralPath $pfad) { Write-Schon "$name" }
    else { New-Item -ItemType Directory -Path $pfad -Force | Out-Null; Write-Tat "$name — $($ordner[$name])" }
}

# ================================================================ 3 Vorlagen
Write-Schritt 'Vorlagen'

New-TextDatei -Pfad (Join-Path $VaultPath 'Vorlagen\Tagesnotiz.md') -Inhalt @'
---
datum: {{date:YYYY-MM-DD}}
typ: tagesnotiz
tags: [tagesnotiz]
---

# {{date:DD.MM.YYYY}}

## Heute

- [ ] 

## Notizen


## Aufgefallen

'@

New-TextDatei -Pfad (Join-Path $VaultPath 'Vorlagen\Notiz.md') -Inhalt @'
---
erstellt: {{date:YYYY-MM-DD}}
tags: []
---

# {{title}}


## Quellen

'@

New-TextDatei -Pfad (Join-Path $VaultPath 'Vorlagen\Projekt.md') -Inhalt @'
---
erstellt: {{date:YYYY-MM-DD}}
status: aktiv
typ: projekt
tags: [projekt]
---

# {{title}}

**Ziel:** 

**Fertig, wenn:** 

## Nächste Schritte

- [ ] 

## Verlauf

- {{date:DD.MM.YYYY}} — angelegt

## Verwandtes

'@

New-TextDatei -Pfad (Join-Path $VaultPath 'Vorlagen\Besprechung.md') -Inhalt @'
---
datum: {{date:YYYY-MM-DD}}
typ: besprechung
tags: [besprechung]
---

# {{title}} — {{date:DD.MM.YYYY}} {{time}}

**Teilnehmende:** 

## Thema


## Ergebnis


## Aufgaben

- [ ] 

'@

# ============================================================ 4 Einstellungen
Write-Schritt 'Einstellungen (.obsidian)'

# Diese Werte werden auch dann gesetzt, wenn schon etwas anderes drinsteht —
# an ihnen hängt, dass nichts verlorengeht.
$erzwungen = @('alwaysUpdateLinks', 'trashOption', 'promptDelete', 'attachmentFolderPath')

Merge-JsonDatei -Pfad (Join-Path $configDir 'app.json') -Erzwingen $erzwungen -Sollwerte @{
    # Nichts geht verloren
    'alwaysUpdateLinks'    = $true        # Links folgen verschobenen/umbenannten Notizen
    'trashOption'          = 'local'      # Gelöschtes in .trash der Vault statt Windows-Papierkorb
    'promptDelete'         = $true        # Löschen immer bestätigen
    # Ordnung
    'attachmentFolderPath' = 'Medien'     # Anhänge gesammelt statt im Wurzelordner
    'newFileLocation'      = 'folder'
    'newFileFolderPath'    = '00_Posteingang'
    'newLinkFormat'        = 'shortest'
    'useMarkdownLinks'     = $false       # [[Wikilinks]] — überleben Umbenennungen besser
    'showUnsupportedFiles' = $true        # nichts im Ordner bleibt unsichtbar
    # Schreiben
    'livePreview'          = $true
    'defaultViewMode'      = 'source'
    'readableLineLength'   = $true
    'spellcheck'           = $true
    'autoPairBrackets'     = $true
    'autoPairMarkdown'     = $true
    'foldHeading'          = $true
    'foldIndent'           = $true
    'strictLineBreaks'     = $false
}

Merge-JsonDatei -Pfad (Join-Path $configDir 'daily-notes.json') -Erzwingen @('folder','format') -Sollwerte @{
    'folder'   = '10_Tagesnotizen'
    'format'   = 'YYYY-MM-DD'
    'template' = 'Vorlagen/Tagesnotiz'
    'autorun'  = $false
}

Merge-JsonDatei -Pfad (Join-Path $configDir 'templates.json') -Erzwingen @('folder') -Sollwerte @{
    'folder'     = 'Vorlagen'
    'dateFormat' = 'YYYY-MM-DD'
    'timeFormat' = 'HH:mm'
}

# --- Kern-Plugins: nur einschalten, nie ausschalten -------------------------
$cpPfad = Join-Path $configDir 'core-plugins.json'
$gewuenscht = @(
    'file-explorer', 'global-search', 'switcher', 'graph', 'backlink', 'canvas',
    'outgoing-link', 'tag-pane', 'properties', 'page-preview', 'daily-notes',
    'templates', 'note-composer', 'command-palette', 'editor-status', 'bookmarks',
    'outline', 'word-count', 'file-recovery', 'random-note'
)
$bestand = Read-JsonDatei $cpPfad
if ($null -eq $bestand) {
    # Die Listenform versteht jede Obsidian-Fassung, auch ältere.
    Write-JsonDatei -Pfad $cpPfad -Daten $gewuenscht
    Write-Tat "core-plugins.json angelegt ($($gewuenscht.Count) Kern-Plugins aktiv)."
} elseif ($bestand -is [System.Array]) {
    $liste = @($bestand)
    $neu   = @($gewuenscht | Where-Object { $liste -notcontains $_ })
    if ($neu.Count -gt 0) {
        Write-JsonDatei -Pfad $cpPfad -Daten @($liste + $neu)
        Write-Tat "Eingeschaltet: $($neu -join ', ')"
    } else { Write-Schon 'Alle empfohlenen Kern-Plugins waren bereits aktiv.' }
} else {
    $ht  = ConvertTo-OrderedHashtable $bestand
    $neu = @()
    foreach ($id in $gewuenscht) {
        if (-not $ht.Contains($id) -or -not $ht[$id]) { $ht[$id] = $true; $neu += $id }
    }
    if ($neu.Count -gt 0) {
        Write-JsonDatei -Pfad $cpPfad -Daten $ht
        Write-Tat "Eingeschaltet: $($neu -join ', ')"
    } else { Write-Schon 'Alle empfohlenen Kern-Plugins waren bereits aktiv.' }
}
Write-Schon 'Aufbewahrung der Dateiwiederherstellung: Obsidian -> Einstellungen -> Dateiwiederherstellung.'

# ================================================== 5 Git-Begleitdateien
Write-Schritt 'Git-Begleitdateien'

if (-not $gitVorhanden) {
    Write-Schon 'Übersprungen — ohne Git haben diese Dateien keinen Zweck.'
} else {

New-TextDatei -Pfad (Join-Path $VaultPath '.gitignore') -Inhalt @'
# Fensteranordnung und Cache — ändern sich ständig und gehören keinem Rechner.
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
.obsidian/*.bak

# Gelöschte Notizen liegen hier, bis sie endgültig entfernt werden.
.trash/

# Windows-Krimskrams
Thumbs.db
desktop.ini
ehthumbs.db
$RECYCLE.BIN/

# macOS, falls die Vault einmal dort geöffnet wird
.DS_Store

# Halbfertiges
*.tmp
*~
'@

New-TextDatei -Pfad (Join-Path $VaultPath '.gitattributes') -Inhalt @'
# Keine Zeilenende-Umwandlung: Notizen bleiben byteweise so, wie Obsidian sie
# schreibt. Sonst erzeugt Git bei jedem Wechsel des Betriebssystems Scheinänderungen.
* -text
'@

}

# ==================================================== 6 Git-Repository
Write-Schritt 'Versionierung'

if (-not $gitVorhanden) {
    Write-Schon 'Übersprungen — dieser Lauf richtet kein Git ein.'
} else {
    if (Test-Path -LiteralPath (Join-Path $VaultPath '.git')) {
        Write-Schon 'Repository besteht bereits.'
    } else {
        & git -C $VaultPath init -b main 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            # Git älter als 2.28 kennt "init -b" noch nicht.
            & git -C $VaultPath init | Out-Null
            & git -C $VaultPath checkout -b main 2>$null | Out-Null
        }
        Write-Tat 'Repository angelegt (Zweig "main").'
    }

    # Eine vorhandene globale Kennung wird übernommen; nur wenn gar keine da
    # ist, bekommt diese Vault eine eigene.
    if (-not (& git -C $VaultPath config user.email)) {
        & git -C $VaultPath config user.name  'Martin Kandzior'
        & git -C $VaultPath config user.email 'kandziormannheim@gmail.com'
        Write-Tat 'Commit-Kennung für diese Vault gesetzt (keine globale gefunden).'
    }
    # Umlaute in Datei- und Ordnernamen unverändert durchreichen.
    & git -C $VaultPath config core.quotepath false
    & git -C $VaultPath config core.autocrlf  false

    & git -C $VaultPath add -A | Out-Null
    & git -C $VaultPath diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        & git -C $VaultPath commit -m "Vault eingerichtet: Struktur, Vorlagen, Einstellungen" | Out-Null
        Write-Tat 'Erster Commit gesetzt.'
    } else {
        Write-Schon 'Nichts einzuchecken.'
    }

    if ($RemoteUrl) {
        $bestehend = (& git -C $VaultPath remote get-url origin 2>$null)
        if (-not $bestehend) {
            & git -C $VaultPath remote add origin $RemoteUrl
            Write-Tat "Remote 'origin' gesetzt: $RemoteUrl"
        } elseif ($bestehend.Trim() -ne $RemoteUrl) {
            & git -C $VaultPath remote set-url origin $RemoteUrl
            Write-Tat "Remote 'origin' geändert auf: $RemoteUrl"
        } else {
            Write-Schon "Remote 'origin' war bereits richtig gesetzt."
        }

        Write-Host ''
        Write-Host '   Jetzt folgt der erste Push. Fragt Windows nach den GitHub-Zugangsdaten,' -ForegroundColor White
        Write-Host '   bitte anmelden — danach merkt sich der Windows-Anmeldeinformations-' -ForegroundColor White
        Write-Host '   manager die Daten und der automatische Abgleich läuft ohne Rückfrage.' -ForegroundColor White
        Write-Host ''
        $zweig = (& git -C $VaultPath rev-parse --abbrev-ref HEAD).Trim()
        & git -C $VaultPath push -u origin $zweig
        if ($LASTEXITCODE -eq 0) { Write-Tat "Nach 'origin/$zweig' gepusht." }
        else { Write-Warn 'Push fehlgeschlagen. Ist das Remote-Repository angelegt und leer?' }
    } else {
        Write-Warn 'Kein -RemoteUrl angegeben: Historie und Sicherung liegen nur auf diesem Rechner.'
    }
}

# ================================================ 7 Automatischer Abgleich
Write-Schritt 'Automatischer Abgleich'

if ($SkipTask) {
    Write-Schon 'Übersprungen (-SkipTask).'
} elseif (-not $gitVorhanden) {
    Write-Schon 'Übersprungen — ohne Git gibt es nichts abzugleichen.'
} else {
    $quelle = Join-Path $PSScriptRoot 'Vault-Sync.ps1'
    if (-not (Test-Path -LiteralPath $quelle)) {
        Write-Warn "'Vault-Sync.ps1' liegt nicht neben diesem Skript — Aufgabe wird nicht angelegt."
    } else {
        $zielVerzeichnis = Join-Path $env:LOCALAPPDATA 'ObsidianVaultSync'
        if (-not (Test-Path -LiteralPath $zielVerzeichnis)) {
            New-Item -ItemType Directory -Path $zielVerzeichnis -Force | Out-Null
        }
        $ziel = Join-Path $zielVerzeichnis 'Vault-Sync.ps1'
        Copy-Item -LiteralPath $quelle -Destination $ziel -Force
        Write-Tat "Abgleichskript nach $ziel kopiert."

        $argumente = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden ' +
                     "-File `"$ziel`" -VaultPath `"$VaultPath`" -Quiet"
        $aktion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumente

        $ausloeser = @(
            (New-ScheduledTaskTrigger -AtLogOn),
            (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
                -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
                -RepetitionDuration (New-TimeSpan -Days 3650))
        )
        $einstellungen = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
            -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

        $benutzer = "$env:USERDOMAIN\$env:USERNAME"
        $angelegt = $false
        # S4U läuft ohne sichtbares Konsolenfenster; klappt das nicht, fällt es
        # auf den gewöhnlichen interaktiven Lauf zurück.
        foreach ($anmeldeArt in @('S4U', 'Interactive')) {
            try {
                $prinzipal = New-ScheduledTaskPrincipal -UserId $benutzer -LogonType $anmeldeArt -RunLevel Limited
                Register-ScheduledTask -TaskName $TaskName -Action $aktion -Trigger $ausloeser `
                    -Settings $einstellungen -Principal $prinzipal -Force `
                    -Description "Checkt die Obsidian-Vault $VaultPath ein und gleicht sie ab." | Out-Null
                Write-Tat "Aufgabe '$TaskName' angelegt (alle $IntervalMinutes Min. und bei Anmeldung, Modus $anmeldeArt)."
                $angelegt = $true
                break
            } catch {
                if ($anmeldeArt -eq 'Interactive') {
                    Write-Warn "Aufgabe konnte nicht angelegt werden: $($_.Exception.Message)"
                    Write-Warn 'PowerShell als Administrator öffnen und das Skript erneut starten.'
                }
            }
        }

        if ($angelegt) {
            Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Write-Tat 'Erster Abgleich angestoßen.'
        }
    }
}

# ==================================================================== Fazit
Write-Schritt 'Fertig'
Write-Host ''
Write-Host '   So geht es weiter:' -ForegroundColor White
Write-Host '     1. Obsidian öffnen. Die neuen Ordner und Vorlagen sind da.' -ForegroundColor Gray
Write-Host '     2. Einstellungen -> Dateiwiederherstellung: Intervall und Aufbewahrung' -ForegroundColor Gray
Write-Host '        nach Geschmack hochsetzen (z. B. alle 5 Min., 30 Tage).' -ForegroundColor Gray
Write-Host '     3. Zustand jederzeit nachsehen:' -ForegroundColor Gray
Write-Host '        powershell -ExecutionPolicy Bypass -File .\Vault-Pruefen.ps1' -ForegroundColor White
if (-not $gitVorhanden) {
    Write-Host ''
    Write-Host '     Noch offen: eine Sicherung. Ohne Git geht das so —' -ForegroundColor Gray
    Write-Host '        powershell -ExecutionPolicy Bypass -File .\Vault-Sicherung.ps1 `' -ForegroundColor White
    Write-Host "            -Sicherungsziel 'D:\Sicherung\Obsidian' -AufgabeEinrichten" -ForegroundColor White
}
Write-Host ''
if ($gitVorhanden -and $env:LOCALAPPDATA) {
    Write-Host "   Protokoll des Abgleichs: $(Join-Path $env:LOCALAPPDATA 'ObsidianVaultSync\sync.log')" -ForegroundColor DarkGray
}
Write-Host "   Sicherungen der Einstellungen: $sicherungsWurzel" -ForegroundColor DarkGray
Write-Host ''
