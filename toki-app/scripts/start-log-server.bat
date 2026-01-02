@echo off
echo ========================================
echo   Demarrage du serveur de logs
echo ========================================
echo.

cd /d %~dp0\..

echo Verification de Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Node.js n'est pas installe ou pas dans le PATH
    echo Veuillez installer Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js detecte
echo.

echo Demarrage du serveur de logs...
echo.
node scripts/log-server.js

pause
