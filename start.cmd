@echo off
title Heureka OZ Controller
cd /d "%~dp0"

rem Uz nekde bezi? Pak jen otevreme prohlizec a koncime.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5009 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
    echo Aplikace uz bezi, otevriam prohlizec...
    start "" http://localhost:5009
    exit /b 0
)

if not exist node_modules (
    echo Prvni spusteni - instaluji zavislosti, chvili to potrva...
    call npm install
    if errorlevel 1 (
        echo.
        echo Instalace selhala. Zkontroluj, ze mas nainstalovany Node.js.
        pause
        exit /b 1
    )
)

rem Prohlizec otevre pomocne okno, az server nabehne.
start "" /min powershell -NoProfile -Command "for ($i=0; $i -lt 180; $i++) { if (Get-NetTCPConnection -LocalPort 5009 -State Listen -ErrorAction SilentlyContinue) { Start-Process 'http://localhost:5009'; break }; Start-Sleep -Milliseconds 500 }"

echo.
echo  Heureka OZ Controller bezi na http://localhost:5009
echo  Toto okno nechej otevrene. Zavrenim okna aplikaci vypnes.
echo.

call npm run dev
