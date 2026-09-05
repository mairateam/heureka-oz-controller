@echo off
rem Denni scrape spousteny Planovacem uloh. Vysledek jde do logs\scrape.log.
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist "logs" mkdir "logs"

echo.>> "logs\scrape.log"
echo =================================================>> "logs\scrape.log"
echo Spusteno %date% %time%>> "logs\scrape.log"

call npm run scrape >> "logs\scrape.log" 2>&1
set RC=!errorlevel!

echo Navratovy kod: !RC!>> "logs\scrape.log"
exit /b !RC!
