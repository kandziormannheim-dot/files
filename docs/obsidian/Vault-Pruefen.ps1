<#
.SYNOPSIS
    Prüft eine Obsidian-Vault: Konfiguration, Speicherverhalten, Versionierung, Sync-Aufgabe.
.DESCRIPTION
    Reines Lesen — dieses Skript ändert nichts. Es meldet je Punkt OK, HINWEIS oder PROBLEM
    und nennt am Ende, was "Vault-Einrichten.ps1" davon in Ordnung bringen würde.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Pruefen.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Pruefen.ps1 -VaultPath 'D:\Notizen\Zweitvault'
#>
[CmdletBinding()]
param(
    [string]$VaultPath = 'C:\Obsidian\MartinKandzior',
    [string]$TaskName  = 'Obsidian Vault Sync'
)

$ErrorActionPreference = 'Stop'
$script:Probleme = 0
$script:Hinweise = 0

function Write-Titel { param([string]$Text)
    Write-Host ''
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ('-' * $Text.Length) -ForegroundColor DarkGray
}
function Write-Ok      { param([string]$T) Write-Host "  [OK]      $T" -ForegroundColor Green }
function Write-Hinweis { param([string]$T) $script:Hinweise++; Write-Host "  [HINWEIS] $T" -ForegroundColor Yellow }
function Write-Problem { param([string]$T) $script:Probleme++; Write-Host "  [PROBLEM] $T" -ForegroundColor Red }
function Write-Info    { param([string]$T) Write-Host "            $T" -ForegroundColor DarkGray }

function Read-JsonDatei {
    param([string]$Pfad)
    if (-not (Test-Path -LiteralPath $Pfad)) { return $null }
    try { return (Get-Content -LiteralPath $Pfad -Raw -Encoding UTF8 | ConvertFrom-Json) }
    catch { return 'FEHLERHAFT' }
}

Write-Host ''
Write-Host "Obsidian-Vault prüfen: $VaultPath" -ForegroundColor White

# ---------------------------------------------------------------- Vault selbst
Write-Titel 'Vault'

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
    Write-Problem "Der Ordner existiert nicht."
    Write-Info    "Pfad prüfen oder mit -VaultPath den richtigen angeben."
    Write-Host ''
    exit 2
}
Write-Ok "Ordner existiert."

$configDir = Join-Path $VaultPath '.obsidian'
if (Test-Path -LiteralPath $configDir -PathType Container) {
    Write-Ok "'.obsidian' vorhanden — Obsidian kennt die Vault."
} else {
    Write-Problem "'.obsidian' fehlt — die Vault wurde noch nie in Obsidian geöffnet."
    Write-Info    "Erst in Obsidian öffnen (Vault öffnen -> Ordner als Vault öffnen), dann erneut prüfen."
}

$notizen = @(Get-ChildItem -LiteralPath $VaultPath -Filter '*.md' -Recurse -File -Force -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -notlike "*\.obsidian\*" -and $_.FullName -notlike "*\.trash\*" })
Write-Ok "$($notizen.Count) Markdown-Notiz(en) im Bestand."
if ($notizen.Count -gt 0) {
    $juengste = ($notizen | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
    Write-Info "Zuletzt geändert: $($juengste.Name) am $($juengste.LastWriteTime.ToString('dd.MM.yyyy HH:mm'))"
}

$obsidianLaeuft = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
if ($obsidianLaeuft.Count -gt 0) {
    Write-Hinweis "Obsidian läuft gerade. Zum Aendern der Einstellungen muss es geschlossen sein."
    Write-Info    "Obsidian schreibt '.obsidian\*.json' beim Beenden aus dem Speicher zurück und"
    Write-Info    "überschreibt dabei Änderungen, die währenddessen von außen gemacht wurden."
}

# ---------------------------------------------------------- Speicherverhalten
Write-Titel 'Speicherverhalten (app.json)'

$appPfad = Join-Path $configDir 'app.json'
$app = Read-JsonDatei $appPfad

if ($app -eq 'FEHLERHAFT') {
    Write-Problem "'app.json' ist kein gültiges JSON — Obsidian ignoriert die Datei komplett."
} elseif ($null -eq $app) {
    Write-Hinweis "'app.json' fehlt — überall gelten die Werkseinstellungen."
} else {
    $erwartet = [ordered]@{
        'alwaysUpdateLinks'   = @{ Wert = $true;           Text = 'Links werden beim Verschieben/Umbenennen mitgezogen' }
        'attachmentFolderPath'= @{ Wert = 'Medien';        Text = 'Anhänge landen gesammelt in "Medien"' }
        'trashOption'         = @{ Wert = 'local';         Text = 'Gelöschtes wandert in ".trash" der Vault (wiederherstellbar)' }
        'promptDelete'        = @{ Wert = $true;           Text = 'Löschen wird bestätigt' }
        'newLinkFormat'       = @{ Wert = 'shortest';      Text = 'Kurze, lesbare Wikilinks' }
        'newFileLocation'     = @{ Wert = 'folder';        Text = 'Neue Notizen landen im Posteingang' }
        'newFileFolderPath'   = @{ Wert = '00_Posteingang';Text = 'Zielordner für neue Notizen' }
    }
    foreach ($schluessel in $erwartet.Keys) {
        $soll = $erwartet[$schluessel].Wert
        $ist  = $app.PSObject.Properties[$schluessel]
        if ($null -eq $ist) {
            Write-Hinweis "$schluessel ist nicht gesetzt (Standard) — empfohlen: $soll ($($erwartet[$schluessel].Text))"
        } elseif ("$($ist.Value)" -ne "$soll") {
            Write-Hinweis "$schluessel = '$($ist.Value)' — empfohlen: '$soll' ($($erwartet[$schluessel].Text))"
        } else {
            Write-Ok "$schluessel = $soll"
        }
    }
}

# ------------------------------------------------------------- Kern-Plugins
Write-Titel 'Kern-Plugins'

$cpPfad = Join-Path $configDir 'core-plugins.json'
$cp = Read-JsonDatei $cpPfad
$wichtig = @{
    'file-recovery' = 'Dateiwiederherstellung — hält Schnappschüsse älterer Fassungen vor'
    'daily-notes'   = 'Tagesnotizen'
    'templates'     = 'Vorlagen'
    'backlink'      = 'Rückverweise'
    'global-search' = 'Volltextsuche'
    'outline'       = 'Gliederung'
    'bookmarks'     = 'Lesezeichen'
}

if ($cp -eq 'FEHLERHAFT') {
    Write-Problem "'core-plugins.json' ist kein gültiges JSON."
} elseif ($null -eq $cp) {
    Write-Hinweis "'core-plugins.json' fehlt — Vault vermutlich noch nie geöffnet."
} else {
    $aktiv = @()
    if ($cp -is [System.Array]) {
        $aktiv = @($cp)
    } else {
        foreach ($p in $cp.PSObject.Properties) { if ($p.Value) { $aktiv += $p.Name } }
    }
    foreach ($id in $wichtig.Keys) {
        if ($aktiv -contains $id) { Write-Ok "$id aktiv — $($wichtig[$id])" }
        else                      { Write-Hinweis "$id ist AUS — $($wichtig[$id])" }
    }
    if ($aktiv -notcontains 'file-recovery') {
        Write-Info "Ohne Dateiwiederherstellung gibt es keinen Schutz gegen versehentliches Ueberschreiben."
    }
}

# --------------------------------------------------------------- Ordnerbau
Write-Titel 'Ordnerstruktur'

foreach ($ordner in @('00_Posteingang','10_Tagesnotizen','20_Projekte','30_Bereiche','40_Wissen','90_Archiv','Medien','Vorlagen')) {
    if (Test-Path -LiteralPath (Join-Path $VaultPath $ordner) -PathType Container) { Write-Ok "$ordner" }
    else { Write-Hinweis "$ordner fehlt" }
}

$streuner = @(Get-ChildItem -LiteralPath $VaultPath -File -Force -ErrorAction SilentlyContinue |
              Where-Object { $_.Extension -in '.png','.jpg','.jpeg','.gif','.pdf','.webp','.mp4','.mp3','.webm' })
if ($streuner.Count -gt 0) {
    Write-Hinweis "$($streuner.Count) Anhang/Anhänge liegen direkt im Vault-Wurzelordner statt in 'Medien'."
    Write-Info    "Die Einrichtung verschiebt nichts — das machst du in Obsidian per Drag & Drop,"
    Write-Info    "dann werden die Links automatisch mitgezogen (alwaysUpdateLinks)."
}

# ------------------------------------------------------------- Versionierung
Write-Titel 'Versionierung und Sicherung (Git)'

$gitVorhanden = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
if (-not $gitVorhanden) {
    Write-Problem "Git ist nicht installiert oder nicht im PATH."
    Write-Info    "Ohne Git gibt es keine Historie und keine Sicherung außerhalb dieses Rechners."
    Write-Info    "Installation: https://git-scm.com/download/win"
} elseif (-not (Test-Path -LiteralPath (Join-Path $VaultPath '.git'))) {
    Write-Problem "Die Vault ist kein Git-Repository — es gibt keine Historie."
} else {
    Write-Ok "Git-Repository vorhanden."

    $status = & git -C $VaultPath status --porcelain 2>$null
    $offen  = @($status | Where-Object { $_ -ne '' })
    if ($offen.Count -eq 0) { Write-Ok "Keine unversionierten Änderungen — alles eingecheckt." }
    else { Write-Hinweis "$($offen.Count) Änderung(en) noch nicht eingecheckt." }

    $letzter = & git -C $VaultPath log -1 --format='%cd (%s)' --date=format:'%d.%m.%Y %H:%M' 2>$null
    if ($letzter) { Write-Info "Letzter Commit: $letzter" } else { Write-Hinweis "Noch kein einziger Commit." }

    $remote = & git -C $VaultPath remote get-url origin 2>$null
    if ($remote) {
        Write-Ok "Remote 'origin': $remote"
        $zweig  = (& git -C $VaultPath rev-parse --abbrev-ref HEAD 2>$null)
        $stand  = (& git -C $VaultPath rev-list --left-right --count "origin/$zweig...$zweig" 2>$null)
        if ($LASTEXITCODE -eq 0 -and $stand -match '^(\d+)\s+(\d+)$') {
            $hinterher = [int]$Matches[1]   # Commits, die nur auf origin liegen
            $voraus    = [int]$Matches[2]   # Commits, die nur lokal liegen
            if ($hinterher -gt 0 -and $voraus -gt 0) {
                Write-Problem "Lokal und Remote sind auseinandergelaufen ($voraus lokal, $hinterher entfernt)."
                Write-Info    "Der automatische Abgleich bricht in dieser Lage ab, statt etwas zu überschreiben."
                Write-Info    "Von Hand: git -C `"$VaultPath`" pull --rebase origin $zweig"
            } elseif ($voraus -gt 0) {
                Write-Hinweis "$voraus Commit(s) noch nicht gepusht."
            } elseif ($hinterher -gt 0) {
                Write-Hinweis "$hinterher Commit(s) vom Remote noch nicht geholt."
            } else {
                Write-Ok "Gleichstand mit origin/$zweig (Stand des letzten 'fetch')."
            }
        } else {
            Write-Hinweis "Zweig '$zweig' hat keinen bekannten Gegenpart auf 'origin' — noch nie gepusht?"
        }
    } else {
        Write-Hinweis "Kein Remote gesetzt — die Sicherung liegt nur auf diesem Rechner."
        Write-Info    "Fällt die Platte aus, ist auch die Historie weg."
    }

    foreach ($datei in @('.gitignore','.gitattributes')) {
        if (Test-Path -LiteralPath (Join-Path $VaultPath $datei)) { Write-Ok "$datei vorhanden." }
        else { Write-Hinweis "$datei fehlt." }
    }
}

# ----------------------------------------------------------- Geplante Aufgabe
Write-Titel 'Automatischer Abgleich (Aufgabenplanung)'

if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
    Write-Hinweis 'Die Aufgabenplanung ist auf diesem System nicht abfragbar.'
    $aufgabe = $null
} else {
    $aufgabe = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}
if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
    # nichts weiter zu melden
} elseif (-not $aufgabe) {
    Write-Hinweis "Aufgabe '$TaskName' existiert nicht — nichts läuft automatisch."
} else {
    if ($aufgabe.State -eq 'Disabled') { Write-Problem "Aufgabe '$TaskName' ist deaktiviert." }
    else { Write-Ok "Aufgabe '$TaskName' ist aktiv (Status: $($aufgabe.State))." }

    $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($info) {
        if ($info.LastRunTime -and $info.LastRunTime.Year -gt 1999) {
            $herKurz = [int]((Get-Date) - $info.LastRunTime).TotalMinutes
            Write-Info "Letzter Lauf: $($info.LastRunTime.ToString('dd.MM.yyyy HH:mm')) (vor $herKurz Min.), Ergebnis $($info.LastTaskResult)"
            if ($info.LastTaskResult -ne 0) { Write-Problem "Der letzte Lauf endete mit Fehlercode $($info.LastTaskResult)." }
        } else {
            Write-Hinweis "Die Aufgabe ist noch nie gelaufen."
        }
        if ($info.NextRunTime) { Write-Info "Nächster Lauf: $($info.NextRunTime.ToString('dd.MM.yyyy HH:mm'))" }
    }
}

$logPfad = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'ObsidianVaultSync\sync.log' } else { $null }
if ($logPfad -and (Test-Path -LiteralPath $logPfad)) {
    Write-Info "Protokoll: $logPfad"
    $letzteZeilen = Get-Content -LiteralPath $logPfad -Tail 3 -ErrorAction SilentlyContinue
    foreach ($z in $letzteZeilen) { Write-Info "  $z" }
    if ($letzteZeilen -match 'FEHLER') { Write-Problem "Im Protokoll stehen Fehler — siehe oben." }
} elseif ($logPfad) {
    Write-Info "Noch kein Protokoll unter $logPfad"
}

# -------------------------------------------------------------------- Fazit
Write-Titel 'Fazit'
if ($script:Probleme -eq 0 -and $script:Hinweise -eq 0) {
    Write-Host '  Alles in Ordnung. Die Vault speichert und sichert wie vorgesehen.' -ForegroundColor Green
} else {
    Write-Host "  $($script:Probleme) Problem(e), $($script:Hinweise) Hinweis(e)." -ForegroundColor Yellow
    Write-Host '  Das meiste davon räumt "Vault-Einrichten.ps1" in einem Lauf auf:' -ForegroundColor Yellow
    Write-Host '    powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1' -ForegroundColor White
}
Write-Host ''
exit ([Math]::Min($script:Probleme, 1))
