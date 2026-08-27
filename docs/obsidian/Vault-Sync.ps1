<#
.SYNOPSIS
    Checkt Änderungen der Obsidian-Vault ein und gleicht sie mit dem Remote ab.
.DESCRIPTION
    Läuft normalerweise unbeaufsichtigt aus der Aufgabenplanung, die
    "Vault-Einrichten.ps1" anlegt. Ablauf je Lauf:

      1. Alle Änderungen einchecken (falls es welche gibt).
      2. Ist ein Remote gesetzt: holen, per Rebase aufsetzen, pushen.
      3. Ergebnis nach %LOCALAPPDATA%\ObsidianVaultSync\sync.log schreiben.

    Bei einem Konflikt wird der Rebase sauber abgebrochen und der Lauf mit
    Fehlercode 3 beendet — die lokalen Notizen bleiben unangetastet. Der
    Konflikt wird dann von Hand aufgelöst; "Vault-Pruefen.ps1" zeigt ihn an.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Vault-Sync.ps1
#>
[CmdletBinding()]
param(
    [string]$VaultPath = 'C:\Obsidian\MartinKandzior',
    [switch]$Quiet
)

$ErrorActionPreference = 'Continue'

$logVerzeichnis = Join-Path $env:LOCALAPPDATA 'ObsidianVaultSync'
$logPfad        = Join-Path $logVerzeichnis 'sync.log'
if (-not (Test-Path -LiteralPath $logVerzeichnis)) {
    New-Item -ItemType Directory -Path $logVerzeichnis -Force | Out-Null
}

# Protokoll bei 1 MB einmal wegrollen, damit es nicht unbegrenzt wächst.
if ((Test-Path -LiteralPath $logPfad) -and ((Get-Item -LiteralPath $logPfad).Length -gt 1MB)) {
    Move-Item -LiteralPath $logPfad -Destination "$logPfad.alt" -Force -ErrorAction SilentlyContinue
}

function Schreibe {
    param([string]$Text, [string]$Stufe = 'INFO')
    $zeile = "{0}  {1,-6} {2}" -f (Get-Date -Format 'dd.MM.yyyy HH:mm:ss'), $Stufe, $Text
    Add-Content -LiteralPath $logPfad -Value $zeile -Encoding UTF8
    if (-not $Quiet) {
        $farbe = switch ($Stufe) { 'FEHLER' { 'Red' } 'WARNUNG' { 'Yellow' } default { 'Gray' } }
        Write-Host $zeile -ForegroundColor $farbe
    }
}

# Die Argumente kommen bewusst als Array herein: als lose Wortliste würde
# PowerShell führende Bindestriche ("-A", "--quiet") als eigene Parameter lesen.
function Git-Auf {
    param([Parameter(Mandatory = $true)][string[]]$Argumente)
    $ausgabe = & git -C $VaultPath @Argumente 2>&1
    return [pscustomobject]@{ Code = $LASTEXITCODE; Ausgabe = ($ausgabe -join [Environment]::NewLine) }
}

# ------------------------------------------------------------ Voraussetzungen
if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
    Schreibe "Vault-Ordner nicht gefunden: $VaultPath" 'FEHLER'; exit 2
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Schreibe 'Git ist nicht im PATH.' 'FEHLER'; exit 2
}
if (-not (Test-Path -LiteralPath (Join-Path $VaultPath '.git'))) {
    Schreibe "Kein Git-Repository unter $VaultPath — erst Vault-Einrichten.ps1 laufen lassen." 'FEHLER'; exit 2
}

# Ein hängengebliebener Rebase oder Merge aus einem früheren Lauf: nicht
# blind daraufsetzen, sondern melden und aussteigen.
foreach ($marker in @('.git\rebase-merge', '.git\rebase-apply', '.git\MERGE_HEAD')) {
    if (Test-Path -LiteralPath (Join-Path $VaultPath $marker)) {
        Schreibe "Unaufgelöster Zustand im Repository ($marker). Bitte von Hand klären." 'FEHLER'
        exit 3
    }
}

$zweig = (Git-Auf @('rev-parse','--abbrev-ref','HEAD')).Ausgabe.Trim()
if (-not $zweig -or $zweig -eq 'HEAD') { Schreibe 'Kein benannter Zweig ausgecheckt.' 'FEHLER'; exit 2 }

# ------------------------------------------------------------------ Einchecken
$null = Git-Auf @('add','-A')
$bereit = Git-Auf @('diff','--cached','--quiet')
if ($bereit.Code -ne 0) {
    $anzahl  = ((Git-Auf @('diff','--cached','--name-only')).Ausgabe -split "`n" | Where-Object { $_ -ne '' }).Count
    $rechner   = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { [System.Net.Dns]::GetHostName() }
    $nachricht = "Obsidian-Abgleich {0} ({1}) — {2} Datei(en)" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $rechner, $anzahl
    $commit = Git-Auf @('commit','-m',$nachricht)
    if ($commit.Code -ne 0) { Schreibe "Commit fehlgeschlagen: $($commit.Ausgabe)" 'FEHLER'; exit 4 }
    Schreibe "Eingecheckt: $anzahl Datei(en)."
} else {
    Schreibe 'Nichts zu tun — keine Änderungen.'
}

# ---------------------------------------------------------------- Abgleich
$remote = (Git-Auf @('remote','get-url','origin')).Ausgabe.Trim()
if (-not $remote) {
    Schreibe 'Kein Remote gesetzt — nur lokale Historie. Fertig.'
    exit 0
}

$fetch = $null
foreach ($wartezeit in @(0, 2, 4, 8, 16)) {
    if ($wartezeit -gt 0) { Start-Sleep -Seconds $wartezeit }
    $fetch = Git-Auf @('fetch','origin',$zweig)
    if ($fetch.Code -eq 0) { break }
    Schreibe "Fetch fehlgeschlagen, neuer Versuch in $wartezeit s." 'WARNUNG'
}
if ($fetch.Code -ne 0) {
    Schreibe "Remote nicht erreichbar: $($fetch.Ausgabe)" 'WARNUNG'
    Schreibe 'Lokal ist alles eingecheckt — der nächste Lauf holt den Push nach.'
    exit 0
}

$rebase = Git-Auf @('pull','--rebase','--autostash','origin',$zweig)
if ($rebase.Code -ne 0) {
    $null = Git-Auf @('rebase','--abort')
    Schreibe "Konflikt beim Zusammenführen — Rebase abgebrochen, lokaler Stand unverändert." 'FEHLER'
    Schreibe $rebase.Ausgabe 'FEHLER'
    Schreibe ("Von Hand auflösen: git -C `"$VaultPath`" pull --rebase origin $zweig") 'FEHLER'
    exit 3
}

$push = $null
foreach ($wartezeit in @(0, 2, 4, 8, 16)) {
    if ($wartezeit -gt 0) { Start-Sleep -Seconds $wartezeit }
    $push = Git-Auf @('push','origin',$zweig)
    if ($push.Code -eq 0) { break }
    Schreibe "Push fehlgeschlagen, neuer Versuch in $wartezeit s." 'WARNUNG'
}
if ($push.Code -ne 0) {
    Schreibe "Push endgültig fehlgeschlagen: $($push.Ausgabe)" 'FEHLER'
    exit 5
}

Schreibe "Abgeglichen mit $remote (Zweig $zweig)."
exit 0
