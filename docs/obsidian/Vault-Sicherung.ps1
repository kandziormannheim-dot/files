<#
.SYNOPSIS
    Sichert die Obsidian-Vault ohne Git: aktueller Spiegel plus datierte Schnappschüsse.
.DESCRIPTION
    Die Git-freie Alternative zu Vault-Sync.ps1. Ziel kann alles sein, was
    Windows als Pfad kennt — eine externe Platte, ein Netzlaufwerk, ein NAS
    oder ein OneDrive-Ordner.

    Je Lauf:
      1. "aktuell\" wird per robocopy auf den Stand der Vault gebracht.
         Das ist eine gewöhnliche Ordnerkopie: mit jedem Dateimanager les-
         und wiederherstellbar, ohne Werkzeug, ohne Kenntnisse.
      2. Hat sich etwas geändert und liegt der letzte Schnappschuss länger
         zurück als -SnapshotStunden, entsteht in "schnappschuesse\" eine
         datierte ZIP-Datei. Die ältesten werden über -Behalten hinaus entfernt.

    Warum beides: der Spiegel ist immer aktuell, kennt aber nur den jetzigen
    Stand — was in der Vault gelöscht wird, verschwindet beim nächsten Lauf
    auch dort. Die Schnappschüsse sind der Weg zurück.

    Gezippt wird der Spiegel, nicht die Vault selbst: so stört es nicht, wenn
    Obsidian gerade eine Datei geöffnet hat.
.PARAMETER Sicherungsziel
    Zielordner. Wird angelegt, wenn er fehlt — der übergeordnete Pfad muss
    aber erreichbar sein.
.PARAMETER SnapshotStunden
    Mindestabstand zwischen zwei Schnappschüssen. Vorgabe: 24 Stunden.
.PARAMETER Behalten
    Anzahl der aufbewahrten Schnappschüsse. Vorgabe: 30.
.PARAMETER AufgabeEinrichten
    Legt die geplante Aufgabe an, die dieses Skript regelmäßig aufruft, und
    beendet sich dann. Ohne diesen Schalter läuft eine einzelne Sicherung.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Sicherung.ps1 `
        -Sicherungsziel 'D:\Sicherung\Obsidian' -AufgabeEinrichten
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Sicherung.ps1 `
        -Sicherungsziel 'D:\Sicherung\Obsidian'
#>
[CmdletBinding()]
param(
    [string]$VaultPath = 'C:\Obsidian\MartinKandzior',
    [Parameter(Mandatory = $true)][string]$Sicherungsziel,
    [int]   $SnapshotStunden  = 24,
    [int]   $Behalten         = 30,
    [switch]$AufgabeEinrichten,
    [int]   $IntervalMinutes  = 15,
    [switch]$Quiet
)

$ErrorActionPreference = 'Continue'
$TaskName = 'Obsidian Vault Sicherung'

$logVerzeichnis = Join-Path $env:LOCALAPPDATA 'ObsidianVaultSync'
$logPfad        = Join-Path $logVerzeichnis 'sicherung.log'
if (-not (Test-Path -LiteralPath $logVerzeichnis)) {
    New-Item -ItemType Directory -Path $logVerzeichnis -Force | Out-Null
}
if ((Test-Path -LiteralPath $logPfad) -and ((Get-Item -LiteralPath $logPfad).Length -gt 1MB)) {
    Move-Item -LiteralPath $logPfad -Destination "$logPfad.alt" -Force -ErrorAction SilentlyContinue
}

function Schreibe {
    param([string]$Text, [string]$Stufe = 'INFO')
    $zeile = "{0}  {1,-7} {2}" -f (Get-Date -Format 'dd.MM.yyyy HH:mm:ss'), $Stufe, $Text
    Add-Content -LiteralPath $logPfad -Value $zeile -Encoding UTF8
    if (-not $Quiet) {
        $farbe = switch ($Stufe) { 'FEHLER' { 'Red' } 'WARNUNG' { 'Yellow' } default { 'Gray' } }
        Write-Host $zeile -ForegroundColor $farbe
    }
}

# ======================================================== Aufgabe einrichten
if ($AufgabeEinrichten) {
    if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
        Write-Host "Der Vault-Ordner '$VaultPath' existiert nicht." -ForegroundColor Red; exit 2
    }

    $ziel = Join-Path $logVerzeichnis 'Vault-Sicherung.ps1'
    Copy-Item -LiteralPath $PSCommandPath -Destination $ziel -Force
    Write-Host "   + Skript nach $ziel kopiert." -ForegroundColor Green

    $argumente = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden ' +
                 "-File `"$ziel`" -VaultPath `"$VaultPath`" " +
                 "-Sicherungsziel `"$Sicherungsziel`" " +
                 "-SnapshotStunden $SnapshotStunden -Behalten $Behalten -Quiet"
    $aktion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumente

    $ausloeser = @(
        (New-ScheduledTaskTrigger -AtLogOn),
        (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
            -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
            -RepetitionDuration (New-TimeSpan -Days 3650))
    )
    $einstellungen = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

    $benutzer = "$env:USERDOMAIN\$env:USERNAME"
    foreach ($anmeldeArt in @('S4U', 'Interactive')) {
        try {
            $prinzipal = New-ScheduledTaskPrincipal -UserId $benutzer -LogonType $anmeldeArt -RunLevel Limited
            Register-ScheduledTask -TaskName $TaskName -Action $aktion -Trigger $ausloeser `
                -Settings $einstellungen -Principal $prinzipal -Force `
                -Description "Sichert die Obsidian-Vault $VaultPath nach $Sicherungsziel." | Out-Null
            Write-Host "   + Aufgabe '$TaskName' angelegt (alle $IntervalMinutes Min., Modus $anmeldeArt)." -ForegroundColor Green
            Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Write-Host "   + Erste Sicherung angestoßen." -ForegroundColor Green
            Write-Host ''
            Write-Host "   Protokoll: $logPfad" -ForegroundColor DarkGray
            exit 0
        } catch {
            if ($anmeldeArt -eq 'Interactive') {
                Write-Host "   ! Aufgabe konnte nicht angelegt werden: $($_.Exception.Message)" -ForegroundColor Yellow
                Write-Host '   ! PowerShell als Administrator öffnen und erneut versuchen.' -ForegroundColor Yellow
                exit 5
            }
        }
    }
}

# ============================================================== Voraussetzungen
if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
    Schreibe "Vault-Ordner nicht gefunden: $VaultPath" 'FEHLER'; exit 2
}

$zielWurzel = Split-Path -Parent $Sicherungsziel
if ($zielWurzel -and -not (Test-Path -LiteralPath $zielWurzel)) {
    # Häufigster Fall: die externe Platte steckt nicht, das Netzlaufwerk ist weg.
    Schreibe "Sicherungsziel nicht erreichbar: $Sicherungsziel" 'WARNUNG'
    Schreibe 'Platte angeschlossen? Netzlaufwerk verbunden?' 'WARNUNG'
    exit 6
}
if (-not (Test-Path -LiteralPath $Sicherungsziel)) {
    New-Item -ItemType Directory -Path $Sicherungsziel -Force | Out-Null
    Schreibe "Zielordner angelegt: $Sicherungsziel"
}

$spiegel      = Join-Path $Sicherungsziel 'aktuell'
$schnappOrdner = Join-Path $Sicherungsziel 'schnappschuesse'
foreach ($p in @($spiegel, $schnappOrdner)) {
    if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

# =================================================================== Spiegel
# /MIR spiegelt einschließlich Löschungen, /R und /W halten den Lauf kurz,
# wenn eine Datei gerade in Benutzung ist.
$roboAusgabe = & robocopy $VaultPath $spiegel /MIR /R:2 /W:2 /NFL /NDL /NP /NJH /NJS 2>&1
$roboCode    = $LASTEXITCODE

if ($roboCode -ge 8) {
    Schreibe "robocopy meldet Fehlercode $roboCode." 'FEHLER'
    Schreibe ($roboAusgabe -join ' ') 'FEHLER'
    exit 4
}

$geaendert = ($roboCode -band 1) -or ($roboCode -band 2)
if ($geaendert) { Schreibe "Spiegel aktualisiert (robocopy-Code $roboCode)." }
else            { Schreibe 'Spiegel war bereits aktuell.' }

# ============================================================ Schnappschuss
# Eine Änderung wird über einen Merker festgehalten, nicht über das Ergebnis
# dieses einen Laufs: sonst fiele eine Änderung durchs Raster, die kam, während
# der letzte Schnappschuss noch nicht fällig war, und bis zum Fälligwerden
# nichts mehr passierte.
$merkerPfad = Join-Path $Sicherungsziel '.offene-aenderung'
if ($geaendert) { New-Item -ItemType File -Path $merkerPfad -Force | Out-Null }
$offen = Test-Path -LiteralPath $merkerPfad

$vorhandene = @(Get-ChildItem -LiteralPath $schnappOrdner -Filter 'vault_*.zip' -File -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending)
$letzter    = $vorhandene | Select-Object -First 1

$faellig = $false
if (-not $offen -and $vorhandene.Count -gt 0) {
    Schreibe 'Kein Schnappschuss nötig — seit dem letzten hat sich nichts geändert.'
} elseif ($letzter -and ((Get-Date) - $letzter.LastWriteTime).TotalHours -lt $SnapshotStunden) {
    $rest = [Math]::Round($SnapshotStunden - ((Get-Date) - $letzter.LastWriteTime).TotalHours, 1)
    Schreibe "Änderung vorgemerkt — nächster Schnappschuss in $rest Stunde(n)."
} else {
    $faellig = $true
}

if ($faellig) {
    $zipPfad = Join-Path $schnappOrdner ('vault_{0}.zip' -f (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'))
    try {
        if (@(Get-ChildItem -LiteralPath $spiegel -Force).Count -eq 0) { throw 'Der Spiegel ist leer.' }
        if (Test-Path -LiteralPath $zipPfad) { Remove-Item -LiteralPath $zipPfad -Force }
        # .NET statt Compress-Archive: nimmt als versteckt markierte Dateien
        # zuverlässig mit und kommt ohne Platzhalter aus.
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory(
            $spiegel, $zipPfad, [System.IO.Compression.CompressionLevel]::Optimal, $false)
        $groesse = [Math]::Round((Get-Item -LiteralPath $zipPfad).Length / 1MB, 2)
        Schreibe "Schnappschuss angelegt: $([System.IO.Path]::GetFileName($zipPfad)) ($groesse MB)"
        Remove-Item -LiteralPath $merkerPfad -Force -ErrorAction SilentlyContinue
    } catch {
        Schreibe "Schnappschuss fehlgeschlagen: $($_.Exception.Message)" 'FEHLER'
        exit 4
    }

    $alle   = @(Get-ChildItem -LiteralPath $schnappOrdner -Filter 'vault_*.zip' -File | Sort-Object Name -Descending)
    $zuViel = @($alle | Select-Object -Skip $Behalten)
    foreach ($alt in $zuViel) {
        Remove-Item -LiteralPath $alt.FullName -Force -ErrorAction SilentlyContinue
        Schreibe "Alter Schnappschuss entfernt: $($alt.Name)"
    }
}

exit 0
