@echo off
setlocal enableextensions
title Pubquizzz
set "PORT=3001"
set "VERSIE=8 juli 2026"
set "PSEXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

REM ============================================================
REM  Pubquizzz - dubbelklik dit bestand om de quiz te starten.
REM ============================================================

if /I "%~1"=="browser" goto :openbrowser

set "ROOT=%~dp0"
set "DATA_DIR=%ROOT%data"
if exist "%ROOT%voorbeeld-quiz.json" set "STARTER_QUIZ=%ROOT%voorbeeld-quiz.json"

if not exist "%ROOT%node\node.exe" (
  echo [FOUT] node\node.exe ontbreekt. Pak de hele zip opnieuw uit.
  pause
  exit /b 1
)
if not exist "%ROOT%app\server\index.js" (
  echo [FOUT] app\server\index.js ontbreekt. Pak de hele zip opnieuw uit.
  pause
  exit /b 1
)

cd /d "%ROOT%app" || (
  echo.
  echo [FOUT] Kan de map niet openen. Staat de map op een netwerklocatie
  echo of in de cloud? Kopieer de HELE map eerst naar je eigen computer,
  echo bijvoorbeeld naar Documenten, en start daarna opnieuw.
  pause
  exit /b 1
)

cls
echo ============================================================
echo         P U B Q U I Z Z Z    -    versie %VERSIE%
echo ============================================================
echo.
echo  De quiz start nu... je browser opent zo vanzelf.
echo  Duurt het te lang? Open dan zelf deze adressen:
echo.
echo     Beamer (QR-codes):     http://localhost:%PORT%/screen
echo     Host (jij bestuurt):   http://localhost:%PORT%/host
echo     Vragen maken:          http://localhost:%PORT%/host/editor
echo     Zelf meespelen/testen: http://localhost:%PORT%
echo.
echo  LAAT DIT VENSTER OPEN STAAN tijdens het spelen.
echo  Sluit dit venster als je klaar bent om te stoppen.
echo.
echo  Vrienden doen mee via de QR-code op het beamer-scherm
echo  (telefoon en laptop op hetzelfde wifi-netwerk of hotspot).
echo ============================================================
echo.

call :firewall

start "Pubquizzz browser" /min "%~f0" browser

"%ROOT%node\node.exe" "%ROOT%app\server\index.js"

echo.
echo Server is gestopt. Je mag dit venster nu sluiten.
pause
exit /b 0

REM ------------------------------------------------------------
REM  Windows Firewall controleren en zo nodig goedzetten.
REM  Zonder dit kunnen telefoons de laptop vaak niet bereiken.
REM ------------------------------------------------------------
:firewall
"%PSEXE%" -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -Raw -LiteralPath '%ROOT%app\fix-firewall.ps1'))) -CheckOnly -AppDir '%ROOT%app'" >nul 2>&1
if not errorlevel 1 goto :eof
echo  De Windows Firewall staat nog niet goed voor de quiz.
echo  Windows vraagt zo om toestemming: kies JA.
echo.
"%PSEXE%" -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -Raw -LiteralPath '%ROOT%app\fix-firewall.ps1'))) -AppDir '%ROOT%app'"
set "FIXCODE=%ERRORLEVEL%"
echo.
if "%FIXCODE%"=="0" goto :fw_ok
if "%FIXCODE%"=="2" goto :fw_managed
if "%FIXCODE%"=="3" goto :fw_thirdparty
goto :fw_fail

:fw_ok
echo  Gelukt! De firewall staat nu goed voor de quiz.
echo.
goto :eof

:fw_managed
echo  [LET OP] Deze laptop lijkt door een werkgever beheerd te worden
echo  en negeert de firewall-reparatie. Telefoons kunnen dan mogelijk
echo  niet verbinden. Zie LEES-MIJ.txt punt 6: probeer een prive-laptop.
echo.
goto :eof

:fw_thirdparty
echo  [LET OP] Er draait een extra firewall of virusscanner op deze
echo  laptop, bijvoorbeeld Norton of McAfee. Die kan telefoons blokkeren.
echo  Sta daar node.exe toe, of zet die firewall tijdens de quiz uit.
echo.
goto :eof

:fw_fail
echo  [LET OP] De firewall kon niet automatisch worden goedgezet.
echo  Telefoons kunnen dan mogelijk niet verbinden. Vraagt Windows
echo  straks iets over node.exe of netwerken: kies dan TOESTAAN.
echo  Meer hulp: zie LEES-MIJ.txt onder PROBLEMEN.
echo.
goto :eof

:openbrowser
"%PSEXE%" -NoProfile -Command "for($i=0;$i -lt 40;$i++){try{$null=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:%PORT%/api/health';break}catch{Start-Sleep -Seconds 1}}; Start-Process 'http://localhost:%PORT%/screen'; Start-Sleep -Milliseconds 500; Start-Process 'http://localhost:%PORT%/host'"
if errorlevel 1 start "" "http://localhost:%PORT%/screen"
exit /b 0
