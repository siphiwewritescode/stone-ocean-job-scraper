@echo off
REM Rapido - Stone Ocean v2

cd /d "%~dp0"

if not exist "node_modules" goto :install
goto :checkicon

:install
echo Setting up Stone Ocean...
npm install --silent
if errorlevel 1 goto :installfail
goto :checkicon

:installfail
echo ERROR: Setup failed.
pause
exit /b 1

:checkicon
if not exist "rapido.ico" powershell.exe -ExecutionPolicy Bypass -File "%~dp0create_icon.ps1"

:: Start Stone Ocean tray
wscript.exe "%~dp0run_hidden.vbs"

:: Start Foo Fighters tray if it is not already running
set FF_VBS=C:\Users\pc\Documents\01 Linda\Admin\Projects\Foo Fighters\run_hidden.vbs
if exist "%FF_VBS%" (
    powershell -NoProfile -Command "$ps = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*tray_applier.ps1*' }; if (-not $ps) { Start-Process wscript.exe -ArgumentList '\"%FF_VBS%\"' -WindowStyle Hidden }"
)

exit /b 0
