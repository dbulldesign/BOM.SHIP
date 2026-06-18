@echo off
REM ============================================================================
REM  Lighting BOM Estimator - standalone app launcher (Windows)
REM
REM  Opens the offline HTML in its OWN app window (no tabs, no address bar) using
REM  Microsoft Edge or Google Chrome "app mode", so it feels like an installed
REM  program. Nothing extra to install. Keep this file in the SAME folder as
REM  lighting-bom-estimator.html.
REM
REM  Tip: right-click this file -> "Pin to taskbar" (or send a shortcut to the
REM  Desktop / Start menu) for one-click launching.
REM ============================================================================
setlocal enabledelayedexpansion
set "HTML=%~dp0lighting-bom-estimator.html"
if not exist "%HTML%" (
  echo Could not find lighting-bom-estimator.html next to this launcher.
  echo Keep both files together in the same folder.
  pause
  exit /b 1
)
set "URL=file:///%HTML:\=/%"

set "EDGE="
for %%P in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do if exist "%%~P" set "EDGE=%%~P"

set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if exist "%%~P" set "CHROME=%%~P"

if defined EDGE   ( start "" "!EDGE!"   --app="%URL%" & exit /b 0 )
if defined CHROME ( start "" "!CHROME!" --app="%URL%" & exit /b 0 )

REM No Edge/Chrome found - fall back to whatever opens .html by default.
start "" "%HTML%"
exit /b 0
