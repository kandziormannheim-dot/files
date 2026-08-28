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
    [string]$TaskName           = 'Obsidian Vault Sync',
    [string]$SicherungTaskName  = 'Obsidian Vault Sicherung'
)

$ErrorActionPreference = 'Stop'
$script:Probleme = 0
$script:Hinweise = 0

# Windows PowerShell 5.1 verwandelt jede Zeile, die ein natives Programm nach
# stderr schreibt, in ein Fehlerobjekt, sobald die Ausgabe umgeleitet wird. Bei
# $ErrorActionPreference = 'Stop' bricht das Skript daran ab — auch wenn git nur
# "kein Remote gesetzt" gemeldet hat, was hier ein erwarteter Fall ist.
# PowerShell 7 macht das nicht mehr, deshalb faellt es beim Testen dort nicht auf.
# Alle git-Aufrufe, deren Ausgabe eingelesen wird, laufen daher hier durch.
function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Argumente)
    $alt = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $roh  = & git @Argumente 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $alt
    }
    $zeilen = @($roh |
        Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } |
        ForEach-Object { "$_" })
    return [pscustomobject]@{
        Code = $code
        Text = ($zeilen -join [Environment]::NewLine).Trim()
    }
}

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
Write-Titel 'Versionierung (Git)'

# Git ist einer von zwei Wegen; der andere ist die Sicherung weiter unten.
# Das Urteil, ob überhaupt eine Sicherung besteht, fällt erst im Fazit.
$script:GitAktiv    = $false
$script:GitAuswaerts = $false

$gitVorhanden = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
if (-not $gitVorhanden) {
    Write-Info "Git ist nicht installiert — dieser Weg wird nicht genutzt."
} elseif (-not (Test-Path -LiteralPath (Join-Path $VaultPath '.git'))) {
    Write-Info "Die Vault ist kein Git-Repository — dieser Weg wird nicht genutzt."
} else {
    $script:GitAktiv = $true
    Write-Ok "Git-Repository vorhanden."

    $status = (Invoke-Git @('-C', $VaultPath, 'status', '--porcelain')).Text
    $offen  = @($status -split "`n" | Where-Object { $_.Trim() -ne '' })
    if ($offen.Count -eq 0) { Write-Ok "Keine unversionierten Änderungen — alles eingecheckt." }
    else { Write-Hinweis "$($offen.Count) Änderung(en) noch nicht eingecheckt." }

    $letzter = (Invoke-Git @('-C', $VaultPath, 'log', '-1', '--format=%cd (%s)', '--date=format:%d.%m.%Y %H:%M')).Text
    if ($letzter) { Write-Info "Letzter Commit: $letzter" } else { Write-Hinweis "Noch kein einziger Commit." }

    $remote = (Invoke-Git @('-C', $VaultPath, 'remote', 'get-url', 'origin')).Text
    if ($remote) {
        $script:GitAuswaerts = $true
        Write-Ok "Remote 'origin': $remote"
        $zweig     = (Invoke-Git @('-C', $VaultPath, 'rev-parse', '--abbrev-ref', 'HEAD')).Text
        $standLauf = Invoke-Git @('-C', $VaultPath, 'rev-list', '--left-right', '--count', "origin/$zweig...$zweig")
        if ($standLauf.Code -eq 0 -and $standLauf.Text -match '^(\d+)\s+(\d+)$') {
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
Write-Titel 'Automatischer Git-Abgleich (Aufgabenplanung)'

if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
    Write-Hinweis 'Die Aufgabenplanung ist auf diesem System nicht abfragbar.'
    $aufgabe = $null
} else {
    $aufgabe = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}
if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
    # nichts weiter zu melden
} elseif (-not $aufgabe) {
    if ($script:GitAktiv) { Write-Hinweis "Aufgabe '$TaskName' existiert nicht — nichts gleicht automatisch ab." }
    else                  { Write-Info    "Keine Aufgabe '$TaskName' — passend, weil Git hier nicht genutzt wird." }
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

# ------------------------------------------------------- Sicherung ohne Git
Write-Titel 'Sicherung ohne Git (Spiegel und Schnappschüsse)'

$script:SicherungAktiv = $false
$sicherungAufgabe = $null
if (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue) {
    $sicherungAufgabe = Get-ScheduledTask -TaskName $SicherungTaskName -ErrorAction SilentlyContinue
}

if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
    Write-Info 'Die Aufgabenplanung ist auf diesem System nicht abfragbar.'
} elseif (-not $sicherungAufgabe) {
    Write-Info "Keine Aufgabe '$SicherungTaskName' — dieser Weg wird nicht genutzt."
} else {
    $script:SicherungAktiv = $true
    if ($sicherungAufgabe.State -eq 'Disabled') { Write-Problem "Aufgabe '$SicherungTaskName' ist deaktiviert." }
    else { Write-Ok "Aufgabe '$SicherungTaskName' ist aktiv (Status: $($sicherungAufgabe.State))." }

    $sInfo = Get-ScheduledTaskInfo -TaskName $SicherungTaskName -ErrorAction SilentlyContinue
    if ($sInfo) {
        if ($sInfo.LastRunTime -and $sInfo.LastRunTime.Year -gt 1999) {
            $her = [int]((Get-Date) - $sInfo.LastRunTime).TotalMinutes
            Write-Info "Letzter Lauf: $($sInfo.LastRunTime.ToString('dd.MM.yyyy HH:mm')) (vor $her Min.), Ergebnis $($sInfo.LastTaskResult)"
            if ($sInfo.LastTaskResult -eq 6) {
                Write-Problem 'Das Sicherungsziel war beim letzten Lauf nicht erreichbar.'
                Write-Info    'Externe Platte angeschlossen? Netzlaufwerk verbunden?'
            } elseif ($sInfo.LastTaskResult -ne 0) {
                Write-Problem "Der letzte Lauf endete mit Fehlercode $($sInfo.LastTaskResult)."
            }
        } else {
            Write-Hinweis 'Die Aufgabe ist noch nie gelaufen.'
        }
    }

    # Das Ziel steht in den Argumenten der Aufgabe — kein zweiter Parameter nötig.
    $argumente = ($sicherungAufgabe.Actions | Select-Object -First 1).Arguments
    if ($argumente -match '-Sicherungsziel\s+"([^"]+)"') {
        $ziel = $Matches[1]
        Write-Info "Sicherungsziel: $ziel"

        if (-not (Test-Path -LiteralPath $ziel -PathType Container)) {
            Write-Problem 'Das Sicherungsziel ist gerade nicht erreichbar.'
        } else {
            $spiegel = Join-Path $ziel 'aktuell'
            if (Test-Path -LiteralPath $spiegel -PathType Container) {
                $spiegelStand = (Get-ChildItem -LiteralPath $spiegel -Recurse -File -Force -ErrorAction SilentlyContinue |
                                 Sort-Object LastWriteTime -Descending | Select-Object -First 1)
                if ($spiegelStand) { Write-Ok "Spiegel vorhanden, jüngste Datei vom $($spiegelStand.LastWriteTime.ToString('dd.MM.yyyy HH:mm'))." }
                else { Write-Hinweis 'Der Spiegel ist leer.' }
            } else {
                Write-Hinweis "Kein Ordner 'aktuell' im Sicherungsziel."
            }

            $schnapp = Join-Path $ziel 'schnappschuesse'
            $zips = @(Get-ChildItem -LiteralPath $schnapp -Filter 'vault_*.zip' -File -ErrorAction SilentlyContinue |
                      Sort-Object Name -Descending)
            if ($zips.Count -eq 0) {
                Write-Hinweis 'Noch kein Schnappschuss vorhanden.'
            } else {
                $tage = [Math]::Round(((Get-Date) - $zips[0].LastWriteTime).TotalDays, 1)
                Write-Ok "$($zips.Count) Schnappschuss/Schnappschüsse, jüngster vom $($zips[0].LastWriteTime.ToString('dd.MM.yyyy HH:mm')) (vor $tage Tag(en))."
                if ($tage -gt 7) { Write-Hinweis 'Der jüngste Schnappschuss ist über eine Woche alt.' }
            }

            if (Test-Path -LiteralPath (Join-Path $ziel '.offene-aenderung')) {
                Write-Info 'Es liegt eine Änderung vor, die noch in keinem Schnappschuss steht.'
            }
        }
    } else {
        Write-Hinweis 'Aus den Argumenten der Aufgabe ließ sich kein Sicherungsziel lesen.'
    }
}

$sLogPfad = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'ObsidianVaultSync\sicherung.log' } else { $null }
if ($sLogPfad -and (Test-Path -LiteralPath $sLogPfad)) {
    Write-Info "Protokoll: $sLogPfad"
    $letzteZeilen = Get-Content -LiteralPath $sLogPfad -Tail 3 -ErrorAction SilentlyContinue
    foreach ($z in $letzteZeilen) { Write-Info "  $z" }
    if ($letzteZeilen -match 'FEHLER') { Write-Problem 'Im Sicherungsprotokoll stehen Fehler — siehe oben.' }
}

# ------------------------------------------------------------ Sicherungslage
Write-Titel 'Sicherung außerhalb dieses Rechners'

if ($script:GitAuswaerts) {
    Write-Ok 'Git mit Remote — die Notizen liegen auch außerhalb dieses Rechners.'
} elseif ($script:SicherungAktiv) {
    Write-Ok 'Sicherung eingerichtet. Liegt das Ziel auf derselben Platte wie die Vault,'
    Write-Info 'schützt es gegen versehentliches Löschen, aber nicht gegen einen Plattenschaden.'
} elseif ($script:GitAktiv) {
    Write-Problem 'Nur lokale Git-Historie, keine Kopie außerhalb dieses Rechners.'
    Write-Info    'Entweder ein Remote setzen (Vault-Einrichten.ps1 -RemoteUrl ...) oder'
    Write-Info    'Vault-Sicherung.ps1 -Sicherungsziel <Pfad> -AufgabeEinrichten.'
} else {
    Write-Problem 'Es gibt keinerlei Sicherung — geht die Platte kaputt, sind die Notizen weg.'
    Write-Info    'Ohne Git: Vault-Sicherung.ps1 -Sicherungsziel <Pfad> -AufgabeEinrichten'
    Write-Info    'Mit Git:  Vault-Einrichten.ps1 -RemoteUrl <URL eines privaten Repositorys>'
}

# -------------------------------------------------------------------- Fazit
Write-Titel 'Fazit'
if ($script:Probleme -eq 0 -and $script:Hinweise -eq 0) {
    Write-Host '  Alles in Ordnung. Die Vault speichert und sichert wie vorgesehen.' -ForegroundColor Green
} else {
    Write-Host "  $($script:Probleme) Problem(e), $($script:Hinweise) Hinweis(e)." -ForegroundColor Yellow
    Write-Host '  Einstellungen, Ordner und Vorlagen bringt ein Lauf in Ordnung:' -ForegroundColor Yellow
    Write-Host '    powershell -ExecutionPolicy Bypass -File .\Vault-Einrichten.ps1' -ForegroundColor White
    if (-not $script:GitAuswaerts -and -not $script:SicherungAktiv) {
        Write-Host '  Die Sicherung ist davon unabhängig — siehe den Abschnitt darüber.' -ForegroundColor Yellow
    }
}
Write-Host ''
exit ([Math]::Min($script:Probleme, 1))
