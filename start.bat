@echo off
title PSmash - Smash Bros Ultimate
echo.
echo  ====================================
echo   PSmash - Smash Bros Ultimate
echo  ====================================
echo.
where node >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js non installe. Telecharge sur https://nodejs.org
    pause & exit /b 1
)
node --version
if not exist "node_modules\" (
    echo Installation des dependances...
    npm install
)
start "" "http://localhost:3002/control"
:loop
node server.js
rem Code 42 = redemarrage demande par le systeme d'update (S4).
if %errorlevel% == 42 (
    echo.
    echo  [Leitmotiv] Mise a jour appliquee, redemarrage...
    echo.
    goto loop
)
if %errorlevel% == 0 (
    echo.
    echo  [PSO] Redemarrage...
    echo.
    goto loop
)
pause
