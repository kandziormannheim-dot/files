<#
.SYNOPSIS
    Zieht die Obsidian-Vault in den gespiegelten Google-Drive-Ordner um — in einem Rutsch.
.DESCRIPTION
    Setzt "Umzug-Google-Drive.md", Phase 0 bis 5, als ein Skript um:

      0. Alles prüfen, bevor irgendetwas verändert wird
      1. Geplante Aufgaben anhalten, letzter Abgleich mit GitHub
      2. ZIP-Backup auf die externe Platte (mit .git, also mit ganzer Historie)
      3. Git-Repository aus der Vault herauslegen (git init --separate-git-dir)
      4. Vault in den Drive-Ordner kopieren und Datei für Datei vergleichen
      5. Alte Vault stilllegen: umbenennen in "<Name>_ALT", .git-Verweis entfernen
      6. Aufgaben mit dem neuen Pfad neu anlegen, Prüflauf

    Jeder Schritt wird geprüft, bevor der nächste beginnt. Schlägt einer fehl,
    bricht das Skript ab, sagt, in welchem Zustand die Vault ist, und lässt die
    alte Vault arbeitsfähig zurück. Gelöscht wird nichts außer der
    .git-Verweisdatei — erst in der alten Kopie, bei einem Abbruch in der neuen.

    Von Hand bleibt: vorher Google Drive auf "Dateien spiegeln" stellen,
    hinterher in Obsidian den neuen Ordner als Vault öffnen.

    Vorher gefahrlos ausprobieren: -NurPruefen prüft alles und ändert nichts.
.PARAMETER Backupziel
    Ordner auf einer externen Platte oder einem USB-Stick für das ZIP-Backup.
    Nicht in Google Drive.
.PARAMETER DriveOrdner
    Der gespiegelte Google-Drive-Ordner ("Meine Ablage"). Ohne Angabe wird
    "%USERPROFILE%\My Drive" bzw. "%USERPROFILE%\Meine Ablage" gesucht.
.PARAMETER VaultPath
    Die bisherige Vault. Vorgabe: C:\Obsidian\MartinKandzior
.PARAMETER GitZiel
    Neuer Ort des Git-Repositorys, außerhalb von Drive. Vorgabe: C:\ObsidianGit\vault.git
.PARAMETER Sicherungsziel
    Ziel der Aufgabe "Obsidian Vault Sicherung". Vorgabe: das bisherige Ziel
    dieser Aufgabe, falls es sie gibt, sonst das Backupziel.
.PARAMETER OhneSicherungsaufgabe
    Die Aufgabe "Obsidian Vault Sicherung" nicht anlegen.
.PARAMETER NurPruefen
    Nur Schritt 0: prüfen und anzeigen, nichts verändern.
.PARAMETER Ja
    Ohne Rückfrage starten.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Umzug.ps1 -Backupziel 'E:\Backups\Obsidian' -NurPruefen
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Umzug.ps1 -Backupziel 'E:\Backups\Obsidian'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Backupziel,
    [string]$DriveOrdner    = '',
    [string]$VaultPath      = 'C:\Obsidian\MartinKandzior',
    [string]$GitZiel        = 'C:\ObsidianGit\vault.git',
    [string]$Sicherungsziel = '',
    [switch]$OhneSicherungsaufgabe,
    [switch]$NurPruefen,
    [switch]$Ja
)

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------ Helfer
# Wie in Vault-Einrichten.ps1: Windows PowerShell 5.1 macht aus jeder
# stderr-Zeile eines nativen Programms ein Fehlerobjekt, das bei 'Stop' das
# Skript abbricht. Alle git-Aufrufe laufen deshalb hier durch.
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
    $text   = @($roh | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { "$_" })
    $fehler = @($roh | Where-Object { $_ -is    [System.Management.Automation.ErrorRecord] } | ForEach-Object { "$_" })
    return [pscustomobject]@{
        Code   = $code
        Text   = ($text   -join [Environment]::NewLine).Trim()
        Fehler = ($fehler -join [Environment]::NewLine).Trim()
    }
}

# Startet ein Geschwisterskript in eigenem Prozess: dessen "exit" und
# $ErrorActionPreference sollen dieses Skript nicht mitreißen.
function Invoke-Skript {
    param([string]$Name, [string[]]$Argumente)
    $pfad = Join-Path $PSScriptRoot $Name
    $alt = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pfad @Argumente
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $alt
    }
}

function Write-Schritt { param([string]$T) Write-Host ''; Write-Host "== $T" -ForegroundColor Cyan }
function Write-Tat     { param([string]$T) Write-Host "   + $T" -ForegroundColor Green }
function Write-Info    { param([string]$T) Write-Host "     $T" -ForegroundColor Gray }
function Write-Warn    { param([string]$T) Write-Host "   ! $T" -ForegroundColor Yellow }

# Pfade vergleichbar machen: Schrägstriche, Groß-/Kleinschreibung, Endstrich.
function Get-Normalpfad {
    param([string]$Pfad)
    return [System.IO.Path]::GetFullPath($Pfad.Replace('/', '\')).TrimEnd('\')
}
function Test-Unterhalb {
    param([string]$Pfad, [string]$Basis)
    $p = (Get-Normalpfad $Pfad) + '\'
    $b = (Get-Normalpfad $Basis) + '\'
    return $p.StartsWith($b, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-Bestand {
    param([string]$Pfad)
    $dateien = @(Get-ChildItem -LiteralPath $Pfad -Recurse -File -Force -ErrorAction SilentlyContinue)
    $summe = ($dateien | Measure-Object -Property Length -Sum).Sum
    return [pscustomobject]@{ Anzahl = $dateien.Count; Bytes = [long]$(if ($summe) { $summe } else { 0 }) }
}

function Get-FreierPlatz {
    param([string]$Pfad)
    $wurzel = [System.IO.Path]::GetPathRoot((Get-Normalpfad $Pfad))
    try { return (New-Object System.IO.DriveInfo($wurzel)).AvailableFreeSpace } catch { return $null }
}

function Format-MB { param([double]$Bytes) return ('{0:N0} MB' -f ($Bytes / 1MB)) }

# ------------------------------------------------------------ Abbruch
$script:AngehalteneAufgaben = @()
$script:KopieAngelegt       = $false
$script:AltStillgelegt      = $false
$script:Protokoll           = $null
$neu = $null

function Stopp {
    param([string]$Grund, [string[]]$Hinweise = @())
    Write-Host ''
    Write-Host "   ABBRUCH: $Grund" -ForegroundColor Red
    foreach ($h in $Hinweise) { Write-Host "   $h" -ForegroundColor Yellow }

    if (-not $script:AltStillgelegt) {
        # Die alte Vault ist noch die gültige. Damit nur EIN Ordner auf das
        # Repository zeigt, verliert eine schon angelegte Kopie ihren Verweis.
        if ($script:KopieAngelegt -and $neu -and (Test-Path -LiteralPath (Join-Path $neu '.git'))) {
            Remove-Item -LiteralPath (Join-Path $neu '.git') -Force -ErrorAction SilentlyContinue
            Write-Host "   Die unvollständige Kopie $neu zeigt nicht mehr auf das Repository." -ForegroundColor Yellow
            Write-Host '   Vor einem neuen Versuch diesen Ordner löschen.' -ForegroundColor Yellow
        }
        foreach ($t in $script:AngehalteneAufgaben) {
            Enable-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue | Out-Null
        }
        if ($script:AngehalteneAufgaben.Count -gt 0) {
            Write-Host '   Die angehaltenen Aufgaben laufen wieder, mit der alten Vault.' -ForegroundColor Yellow
        }
        Write-Host "   Die alte Vault $VaultPath ist unverändert nutzbar." -ForegroundColor Yellow
    }
    if ($script:Protokoll) {
        Write-Host "   Protokoll: $($script:Protokoll)" -ForegroundColor DarkGray
        try { Stop-Transcript | Out-Null } catch { }
    }
    Write-Host ''
    exit 1
}

# ======================================================================
Write-Host ''
Write-Host 'Obsidian-Vault nach Google Drive umziehen' -ForegroundColor White
if ($NurPruefen) { Write-Host '(nur prüfen — es wird nichts verändert)' -ForegroundColor DarkGray }

# ============================================================ 0 Prüfen
Write-Schritt '0  Voraussetzungen'

$probleme = New-Object System.Collections.Generic.List[string]
function Problem { param([string]$T) $probleme.Add($T); Write-Host "   [PROBLEM] $T" -ForegroundColor Red }
function Ok      { param([string]$T) Write-Host "   [OK]      $T" -ForegroundColor Green }
function Hinweis { param([string]$T) Write-Host "   [HINWEIS] $T" -ForegroundColor Yellow }

if ($env:OS -ne 'Windows_NT') { Write-Host '   Dieses Skript läuft nur unter Windows.' -ForegroundColor Red; exit 1 }

# --- Programme
if (Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue) {
    Problem 'Obsidian läuft noch. Vollständig beenden, auch aus dem Infobereich neben der Uhr.'
} else { Ok 'Obsidian ist beendet.' }
if (Get-Process -Name 'claude' -ErrorAction SilentlyContinue) {
    Hinweis 'Claude Code läuft. Falls eine Sitzung in der Vault arbeitet: beenden.'
}
$gitDa = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
if ($gitDa) { Ok 'Git ist installiert.' } else { Problem 'Git ist nicht installiert oder nicht im PATH.' }

# --- Vault und Repository
$vaultDa     = Test-Path -LiteralPath $VaultPath -PathType Container
$gitSchonRaus = $false
$zweig        = $null
$headVorher   = $null
$hatRemote    = $false
if (-not $vaultDa) {
    Problem "Die Vault $VaultPath existiert nicht."
} else {
    $VaultPath = Get-Normalpfad $VaultPath
    $bestandAlt = Get-Bestand $VaultPath
    Ok "Vault gefunden: $VaultPath ($($bestandAlt.Anzahl) Dateien, $(Format-MB $bestandAlt.Bytes))"

    $gitEintrag = Get-Item -LiteralPath (Join-Path $VaultPath '.git') -Force -ErrorAction SilentlyContinue
    if (-not $gitEintrag) {
        Problem 'Die Vault ist kein Git-Repository. Dieses Skript ist für den Weg mit Git gebaut.'
    } elseif ($gitEintrag.PSIsContainer) {
        if ((Test-Path -LiteralPath $GitZiel) -and @(Get-ChildItem -LiteralPath $GitZiel -Force).Count -gt 0) {
            Problem "$GitZiel existiert schon und ist nicht leer."
        } else {
            Ok "Git-Repository liegt noch in der Vault und zieht nach $GitZiel."
        }
    } else {
        # Ein früherer Lauf hat das Repository schon herausgelegt.
        $verweis = (Get-Content -LiteralPath $gitEintrag.FullName -Raw -Force).Trim() -replace '^gitdir:\s*', ''
        if ((Get-Normalpfad $verweis) -ieq (Get-Normalpfad $GitZiel) -and (Test-Path -LiteralPath $GitZiel)) {
            $gitSchonRaus = $true
            Ok "Git-Repository liegt bereits in $GitZiel (früherer Lauf) — Schritt 3 entfällt."
        } else {
            Problem ".git ist eine Verweisdatei auf '$verweis', erwartet war '$GitZiel'."
        }
    }

    if ($gitDa -and $gitEintrag) {
        $headVorher = (Invoke-Git @('-C', $VaultPath, 'rev-parse', 'HEAD')).Text
        $zweig      = (Invoke-Git @('-C', $VaultPath, 'rev-parse', '--abbrev-ref', 'HEAD')).Text
        $gitDir     = (Invoke-Git @('-C', $VaultPath, 'rev-parse', '--absolute-git-dir')).Text
        if (-not $headVorher -or -not $zweig -or $zweig -eq 'HEAD') {
            Problem 'Im Repository ist kein Zweig mit Commit ausgecheckt.'
        } else {
            Ok "Zweig '$zweig', letzter Commit $($headVorher.Substring(0, 7))."
        }
        foreach ($marker in @('rebase-merge', 'rebase-apply', 'MERGE_HEAD')) {
            if ($gitDir -and (Test-Path -LiteralPath (Join-Path $gitDir $marker))) {
                Problem "Im Repository hängt ein unaufgelöster Rebase/Merge ($marker). Erst von Hand klären."
            }
        }
        $remote = (Invoke-Git @('-C', $VaultPath, 'remote', 'get-url', 'origin')).Text
        if ($remote) { $hatRemote = $true; Ok "Remote 'origin': $remote" }
        else { Hinweis "Kein Remote — die Historie liegt dann nur in $GitZiel und im ZIP." }
    }
}

# --- Google Drive
if (-not (Get-Process -Name 'GoogleDriveFS' -ErrorAction SilentlyContinue)) {
    Problem 'Google Drive for Desktop läuft nicht.'
} else { Ok 'Google Drive for Desktop läuft.' }

if (-not $DriveOrdner) {
    foreach ($kandidat in @("$env:USERPROFILE\My Drive", "$env:USERPROFILE\Meine Ablage")) {
        if (Test-Path -LiteralPath $kandidat -PathType Container) { $DriveOrdner = $kandidat; break }
    }
}
if (-not $DriveOrdner -or -not (Test-Path -LiteralPath $DriveOrdner -PathType Container)) {
    Problem 'Kein gespiegelter Drive-Ordner gefunden. Ist Drive auf "Dateien spiegeln" gestellt?'
    Write-Info 'Den Ordner, den Drive nennt, mit -DriveOrdner angeben.'
} else {
    $DriveOrdner = Get-Normalpfad $DriveOrdner
    # Im Streaming-Modus ist "Meine Ablage" ein virtuelles Laufwerk mit dem
    # Namen "Google Drive". Genau das soll der Umzug vermeiden.
    $buchstabe = $DriveOrdner.Substring(0, 1)
    $volume = Get-Volume -DriveLetter $buchstabe -ErrorAction SilentlyContinue
    if ($volume -and $volume.FileSystemLabel -match 'Google Drive') {
        Problem "$DriveOrdner liegt auf dem virtuellen Drive-Laufwerk (Modus 'Streamen'). Erst auf 'Dateien spiegeln' umstellen."
    } else {
        Ok "Gespiegelter Drive-Ordner: $DriveOrdner"
    }
    $neu = Join-Path (Join-Path $DriveOrdner 'Obsidian') (Split-Path -Leaf $VaultPath)
    if ((Test-Path -LiteralPath $neu) -and @(Get-ChildItem -LiteralPath $neu -Force).Count -gt 0) {
        Problem "Ziel $neu existiert schon und ist nicht leer (Rest eines früheren Versuchs? Dann löschen)."
    } else {
        Ok "Neue Vault wird: $neu"
    }
    if ($vaultDa -and (Test-Unterhalb $VaultPath $DriveOrdner)) { Problem 'Die Vault liegt bereits im Drive-Ordner.' }
}

# --- Backup und Sicherung
$backupWurzel = [System.IO.Path]::GetPathRoot($Backupziel)
if (-not $backupWurzel -or -not (Test-Path -LiteralPath $backupWurzel)) {
    Problem "Laufwerk für das Backup nicht erreichbar: $Backupziel. Platte angesteckt?"
} else {
    if ($DriveOrdner -and (Test-Unterhalb $Backupziel $DriveOrdner)) { Problem 'Das Backupziel liegt in Google Drive. Es muss außerhalb liegen.' }
    elseif ($vaultDa -and (Test-Unterhalb $Backupziel $VaultPath))   { Problem 'Das Backupziel liegt in der Vault.' }
    else { Ok "Backupziel: $Backupziel" }
}

$sicherungsAufgabe = Get-ScheduledTask -TaskName 'Obsidian Vault Sicherung' -ErrorAction SilentlyContinue
$syncAufgabe       = Get-ScheduledTask -TaskName 'Obsidian Vault Sync'      -ErrorAction SilentlyContinue
if ($syncAufgabe) { Ok "Aufgabe 'Obsidian Vault Sync' vorhanden ($($syncAufgabe.State)) — wird umgestellt." }
else { Hinweis "Keine Aufgabe 'Obsidian Vault Sync' — der Git-Abgleich läuft bisher nicht automatisch und wird auch nicht angelegt." }

if (-not $OhneSicherungsaufgabe) {
    if (-not $Sicherungsziel -and $sicherungsAufgabe) {
        $argumente = ($sicherungsAufgabe.Actions | Select-Object -First 1).Arguments
        if ($argumente -match '-Sicherungsziel\s+"([^"]+)"') { $Sicherungsziel = $Matches[1] }
    }
    if (-not $Sicherungsziel) { $Sicherungsziel = $Backupziel }
    if ($DriveOrdner -and (Test-Unterhalb $Sicherungsziel $DriveOrdner)) {
        Problem "Das Sicherungsziel $Sicherungsziel liegt in Google Drive. Mit -Sicherungsziel ein Ziel außerhalb angeben."
    } else {
        Ok "Aufgabe 'Obsidian Vault Sicherung' wird angelegt, Ziel: $Sicherungsziel"
    }
}

# --- Platz
if ($vaultDa -and $neu) {
    $bedarf = [long]($bestandAlt.Bytes * 1.1) + 200MB
    $frei = Get-FreierPlatz $neu
    if ($null -ne $frei -and $frei -lt $bedarf) { Problem "Zu wenig Platz für die Kopie: frei $(Format-MB $frei), nötig etwa $(Format-MB $bedarf)." }
    $frei = Get-FreierPlatz $Backupziel
    if ($null -ne $frei -and $frei -lt $bestandAlt.Bytes) { Problem "Zu wenig Platz für das ZIP auf $backupWurzel (frei $(Format-MB $frei))." }
}
$altNeuerName = (Split-Path -Leaf $VaultPath) + '_ALT'
if ($vaultDa -and (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $VaultPath) $altNeuerName))) {
    Problem "$altNeuerName existiert schon neben der Vault. Umbenennen oder löschen."
}

# --- Geschwisterskripte
foreach ($name in @('Vault-Sync.ps1', 'Vault-Einrichten.ps1', 'Vault-Sicherung.ps1', 'Vault-Pruefen.ps1')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $name))) {
        Problem "$name fehlt neben diesem Skript ($PSScriptRoot)."
    }
}

if ($probleme.Count -gt 0) {
    Write-Host ''
    Write-Host "   $($probleme.Count) Problem(e) — es wurde nichts verändert." -ForegroundColor Red
    Write-Host ''
    exit 1
}
if ($NurPruefen) {
    Write-Host ''
    Write-Host '   Alles bereit. Ohne -NurPruefen startet der Umzug.' -ForegroundColor Green
    Write-Host ''
    exit 0
}

if (-not $Ja) {
    Write-Host ''
    $antwort = Read-Host "   Umzug jetzt starten? Mit 'ja' bestätigen"
    if ($antwort -ne 'ja') { Write-Host '   Nicht gestartet.'; exit 0 }
}

$protokollOrdner = Join-Path $env:LOCALAPPDATA 'ObsidianVaultSync'
New-Item -ItemType Directory -Path $protokollOrdner -Force | Out-Null
$script:Protokoll = Join-Path $protokollOrdner ('umzug_{0}.log' -f (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'))
Start-Transcript -LiteralPath $script:Protokoll | Out-Null

# ============================================ 1 Aufgaben, letzter Abgleich
Write-Schritt '1  Aufgaben anhalten, letzter Abgleich mit GitHub'

foreach ($aufgabe in @(Get-ScheduledTask -TaskName 'Obsidian Vault*' -ErrorAction SilentlyContinue)) {
    if ($aufgabe.State -ne 'Disabled') {
        Disable-ScheduledTask -TaskName $aufgabe.TaskName | Out-Null
        $script:AngehalteneAufgaben += $aufgabe.TaskName
        Write-Tat "'$($aufgabe.TaskName)' angehalten."
    }
    # Ein gerade laufender Durchgang darf noch zu Ende laufen.
    $bis = (Get-Date).AddMinutes(3)
    while ((Get-ScheduledTask -TaskName $aufgabe.TaskName).State -eq 'Running' -and (Get-Date) -lt $bis) {
        Start-Sleep -Seconds 3
    }
    if ((Get-ScheduledTask -TaskName $aufgabe.TaskName).State -eq 'Running') {
        Stopp "'$($aufgabe.TaskName)' läuft seit über 3 Minuten und hört nicht auf."
    }
}

$code = Invoke-Skript 'Vault-Sync.ps1' @('-VaultPath', $VaultPath)
switch ($code) {
    0       { Write-Tat 'Abgleich ohne Fehler.' }
    3       { Stopp 'Konflikt mit dem Stand auf GitHub.' @('Erst auflösen (README: "Wenn ein Git-Konflikt entsteht"), dann erneut starten.') }
    5       { Write-Warn 'Push fehlgeschlagen. Die Commits ziehen mit um und werden später gepusht.' }
    default { Stopp "Der Abgleich endete mit Fehlercode $code." @("Protokoll: $env:LOCALAPPDATA\ObsidianVaultSync\sync.log") }
}
$offen = (Invoke-Git @('-C', $VaultPath, 'status', '--porcelain')).Text
if ($offen) { Stopp 'Nach dem Abgleich sind noch Änderungen offen.' @($offen) }
$headVorher = (Invoke-Git @('-C', $VaultPath, 'rev-parse', 'HEAD')).Text
if ($hatRemote) {
    $voraus = Invoke-Git @('-C', $VaultPath, 'rev-list', '--count', "origin/$zweig..HEAD")
    if ($voraus.Code -ne 0)       { Write-Warn "Stand auf GitHub unbekannt (origin/$zweig fehlt) — die Commits ziehen mit um." }
    elseif ($voraus.Text -ne '0') { Write-Warn "$($voraus.Text) Commit(s) noch nicht auf GitHub — sie ziehen mit um." }
    else                          { Write-Tat 'Alles auf GitHub.' }
}
$bestandAlt = Get-Bestand $VaultPath

# ==================================================================== 2 ZIP
Write-Schritt '2  ZIP-Backup'

# ZipFile statt Compress-Archive: nimmt versteckte Dateien (.git) mit und
# kommt mit Dateien über 2 GB zurecht.
Add-Type -AssemblyName System.IO.Compression.FileSystem
New-Item -ItemType Directory -Path $Backupziel -Force | Out-Null
$zip = Join-Path $Backupziel ('vault-vor-umzug_{0}.zip' -f (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'))
try {
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $VaultPath, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $true)
} catch {
    Stopp "ZIP konnte nicht angelegt werden: $($_.Exception.Message)"
}
# Prüfen: gleiche Zahl Dateien, gleiche Gesamtgröße (unkomprimiert).
# Ordnereinträge haben einen leeren Namen und zählen nicht.
$archiv = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
    $eintraege = @($archiv.Entries | Where-Object { $_.Name -ne '' })
    $zipAnzahl = $eintraege.Count
    $zipBytes  = [long]((($eintraege | Measure-Object -Property Length -Sum).Sum) + 0)
} finally { $archiv.Dispose() }
if ($zipAnzahl -ne $bestandAlt.Anzahl -or $zipBytes -ne $bestandAlt.Bytes) {
    Stopp 'Das ZIP stimmt nicht mit der Vault überein.' @(
        "Vault: $($bestandAlt.Anzahl) Dateien, $($bestandAlt.Bytes) Bytes",
        "ZIP:   $zipAnzahl Dateien, $zipBytes Bytes")
}
Write-Tat "$zip ($zipAnzahl Dateien, $(Format-MB (Get-Item -LiteralPath $zip).Length) gepackt)"

# ================================================== 3 Git herauslegen
Write-Schritt '3  Git-Repository aus der Vault herauslegen'

if ($gitSchonRaus) {
    Write-Info "Bereits erledigt: $GitZiel"
} else {
    New-Item -ItemType Directory -Path (Split-Path -Parent $GitZiel) -Force | Out-Null
    $init = Invoke-Git @('-C', $VaultPath, 'init', '--separate-git-dir', $GitZiel)
    if ($init.Code -ne 0) { Stopp "git init --separate-git-dir schlug fehl: $($init.Fehler)" }
}
$gitEintrag = Get-Item -LiteralPath (Join-Path $VaultPath '.git') -Force
$istDir = (Invoke-Git @('-C', $VaultPath, 'rev-parse', '--absolute-git-dir')).Text
if ($gitEintrag.PSIsContainer -or -not $istDir -or (Get-Normalpfad $istDir) -ine (Get-Normalpfad $GitZiel)) {
    Stopp "Das Repository liegt nicht wie erwartet in $GitZiel (gefunden: '$istDir')."
}
if ((Invoke-Git @('-C', $VaultPath, 'rev-parse', 'HEAD')).Text -ne $headVorher) {
    Stopp 'Nach dem Herauslegen zeigt HEAD auf einen anderen Commit.'
}
Write-Tat "Repository liegt jetzt in $GitZiel; in der Vault steht nur noch der Verweis."

# ================================================================ 4 Kopie
Write-Schritt '4  Vault in den Drive-Ordner kopieren'

# Neu zählen: seit Schritt 3 ist .git kein Ordner mehr, sondern eine Datei.
$bestandAlt = Get-Bestand $VaultPath
New-Item -ItemType Directory -Path $neu -Force | Out-Null
$script:KopieAngelegt = $true
$alt = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    & robocopy $VaultPath $neu /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /NP /NFL /NDL /NJH | Out-Host
    $roboCode = $LASTEXITCODE
} finally { $ErrorActionPreference = $alt }
if ($roboCode -ge 8) { Stopp "robocopy meldet Fehlercode $roboCode (Ausgabe siehe oben)." }

$bestandNeu = Get-Bestand $neu
if ($bestandNeu.Anzahl -ne $bestandAlt.Anzahl -or $bestandNeu.Bytes -ne $bestandAlt.Bytes) {
    Stopp 'Die Kopie stimmt nicht mit dem Original überein.' @(
        "Original: $($bestandAlt.Anzahl) Dateien, $($bestandAlt.Bytes) Bytes",
        "Kopie:    $($bestandNeu.Anzahl) Dateien, $($bestandNeu.Bytes) Bytes")
}
Write-Tat "$($bestandNeu.Anzahl) Dateien, $(Format-MB $bestandNeu.Bytes) — identisch mit dem Original."

if ((Invoke-Git @('-C', $neu, 'rev-parse', 'HEAD')).Text -ne $headVorher) {
    Stopp 'Git erkennt das Repository vom neuen Ort aus nicht.'
}
$offen = (Invoke-Git @('-C', $neu, 'status', '--porcelain')).Text
if ($offen) { Stopp 'Git sieht in der Kopie Abweichungen vom letzten Commit.' @($offen) }
Write-Tat 'Git arbeitet vom neuen Ort aus, keine Abweichungen.'

# ================================================= 5 Alte Vault stilllegen
Write-Schritt '5  Alte Vault stilllegen'

try {
    Rename-Item -LiteralPath $VaultPath -NewName $altNeuerName
} catch {
    Stopp "Die alte Vault ließ sich nicht umbenennen: $($_.Exception.Message)" @(
        'Meist ist der Ordner im Explorer oder in einem Editor geöffnet. Schließen und erneut starten.')
}
$script:AltStillgelegt = $true
$altStillgelegt = Join-Path (Split-Path -Parent $VaultPath) $altNeuerName
Write-Tat "Umbenannt in $altStillgelegt"
try {
    Remove-Item -LiteralPath (Join-Path $altStillgelegt '.git') -Force
    Write-Tat 'Ihr .git-Verweis ist entfernt — sie hängt nicht mehr am Repository.'
} catch {
    Write-Warn "Der .git-Verweis in $altStillgelegt ließ sich nicht löschen. Bitte von Hand entfernen."
}

# ================================================ 6 Aufgaben neu anlegen
Write-Schritt '6  Aufgaben auf den neuen Pfad umstellen'

$einrichten = @('-VaultPath', $neu)
if (-not $syncAufgabe) { $einrichten += '-SkipTask' }
$code = Invoke-Skript 'Vault-Einrichten.ps1' $einrichten
if ($code -ne 0) {
    Write-Warn "Vault-Einrichten.ps1 endete mit Fehlercode $code. Von Hand nachholen:"
    Write-Info "powershell -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'Vault-Einrichten.ps1')`" -VaultPath `"$neu`""
}

if (-not $OhneSicherungsaufgabe) {
    $code = Invoke-Skript 'Vault-Sicherung.ps1' @('-VaultPath', $neu, '-Sicherungsziel', $Sicherungsziel, '-AufgabeEinrichten')
    if ($code -ne 0) {
        Write-Warn "Die Sicherungsaufgabe ließ sich nicht anlegen (Fehlercode $code). Von Hand nachholen:"
        Write-Info "powershell -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'Vault-Sicherung.ps1')`" -VaultPath `"$neu`" -Sicherungsziel `"$Sicherungsziel`" -AufgabeEinrichten"
    }
}

$null = Invoke-Skript 'Vault-Pruefen.ps1' @('-VaultPath', $neu)

# ================================================================= Fazit
$loeschDatum = (Get-Date).AddDays(7).ToString('dd.MM.yyyy')
Write-Schritt 'Umzug abgeschlossen'
Write-Host ''
Write-Host "   Neue Vault:      $neu" -ForegroundColor White
Write-Host "   Git-Repository:  $GitZiel   (nie löschen)" -ForegroundColor White
Write-Host "   Backup:          $zip" -ForegroundColor White
Write-Host "   Alte Vault:      $altStillgelegt   (ab $loeschDatum löschen)" -ForegroundColor White
Write-Host ''
Write-Host '   Jetzt von Hand:' -ForegroundColor White
Write-Host '     1. Warten, bis Drive "Alle Dateien synchronisiert" meldet.' -ForegroundColor Gray
Write-Host '     2. Obsidian starten -> Vault-Wechsler -> "Ordner als Vault öffnen" -> neuen Pfad wählen.' -ForegroundColor Gray
Write-Host '     3. Den alten Eintrag im Vault-Wechsler entfernen.' -ForegroundColor Gray
Write-Host '     4. Testprotokoll abarbeiten: Umzug-Google-Drive.md, Phase 6.' -ForegroundColor Gray
Write-Host '     5. In Obsidian-Einrichten.cmd die Zeile  set "VAULT=..."  auf den neuen Pfad ändern.' -ForegroundColor Gray
Write-Host ''
Write-Host "   Protokoll: $($script:Protokoll)" -ForegroundColor DarkGray
try { Stop-Transcript | Out-Null } catch { }
exit 0
