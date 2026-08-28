@echo off
rem  Richtet die Obsidian-Vault ein: laedt die Skripte und startet die Einrichtung.
rem  Doppelklicken genuegt. Der Text dieser Datei ist bewusst ohne Umlaute --
rem  die deutsche Ausgabe kommt aus den PowerShell-Skripten, die sie aufruft.
chcp 65001 >nul
title Obsidian-Vault einrichten
setlocal

set "ZIEL=%USERPROFILE%\Downloads\Obsidian-Skripte"
set "BASIS=https://raw.githubusercontent.com/kandziormannheim-dot/files/main/docs/obsidian"
set "REPO=https://github.com/kandziormannheim-dot/obsidian-vault.git"
set "VAULT=C:\Obsidian\MartinKandzior"

echo.
echo   Obsidian-Vault einrichten
echo   =========================
echo.
echo   Vault:  %VAULT%
echo   Remote: %REPO%
echo.

rem ---------------------------------------------------------- Obsidian offen?
tasklist /FI "IMAGENAME eq Obsidian.exe" 2>nul | find /I "Obsidian.exe" >nul
if not errorlevel 1 (
  echo   [ABBRUCH] Obsidian laeuft noch.
  echo.
  echo   Bitte vollstaendig beenden -- auch das Symbol im Infobereich neben
  echo   der Uhr, dort Rechtsklick und Beenden. Danach diese Datei erneut
  echo   doppelklicken.
  echo.
  echo   Grund: Obsidian haelt seine Einstellungen im Speicher und schreibt
  echo   sie beim Beenden zurueck. Aenderungen von aussen waeren sonst weg.
  goto ende
)

rem ------------------------------------------------------------------- Git da?
where git >nul 2>&1
if errorlevel 1 (
  echo   [ABBRUCH] Git ist nicht installiert.
  echo.
  echo   Installieren von https://git-scm.com/download/win , danach dieses
  echo   Fenster schliessen und die Datei erneut doppelklicken.
  echo.
  echo   Alternative ganz ohne Git: Vault-Sicherung.ps1 -- siehe README.md
  echo   im Ordner %ZIEL%.
  goto ende
)

rem --------------------------------------------------------- Skripte besorgen
echo   [1/3] Skripte laden nach %ZIEL%
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $z=$env:ZIEL; $null = New-Item -ItemType Directory -Path $z -Force; [Net.ServicePointManager]::SecurityProtocol='Tls12'; foreach ($d in 'README.md','Vault-Pruefen.ps1','Vault-Einrichten.ps1','Vault-Sync.ps1','Vault-Sicherung.ps1') { Invoke-WebRequest ($env:BASIS + '/' + $d) -OutFile (Join-Path $z $d) -UseBasicParsing; Write-Host ('         ' + $d) }; Unblock-File -Path (Join-Path $z '*')"
if errorlevel 1 (
  echo.
  echo   [ABBRUCH] Die Skripte konnten nicht geladen werden.
  echo.
  echo   Wahrscheinlich ist das Repository kandziormannheim-dot/files
  echo   inzwischen privat, dann brauchen die Links eine Anmeldung.
  echo   In dem Fall die fuenf Dateien aus dem Chat speichern nach:
  echo     %ZIEL%
  echo   und danach diese Datei erneut doppelklicken.
  goto ende
)

rem ------------------------------------------------------------- Einrichtung
echo.
echo   [2/3] Einrichtung laeuft
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ZIEL%\Vault-Einrichten.ps1" -VaultPath "%VAULT%" -RemoteUrl "%REPO%"
if errorlevel 1 (
  echo.
  echo   [ABBRUCH] Die Einrichtung ist fehlgeschlagen. Meldung siehe oben.
  goto ende
)

rem ------------------------------------------------------------------ Prueflauf
echo.
echo   [3/3] Kontrolle
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ZIEL%\Vault-Pruefen.ps1" -VaultPath "%VAULT%"

echo.
echo   Noch von Hand in Obsidian: Einstellungen - Dateiwiederherstellung,
echo   Intervall und Aufbewahrung hochsetzen (z. B. 5 Minuten, 30 Tage).

:ende
echo.
echo   ---------------------------------------------------------------
echo   Fenster bleibt offen. Zum Schliessen eine Taste druecken.
pause >nul
endlocal
