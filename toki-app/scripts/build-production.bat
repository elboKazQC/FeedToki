@echo off
REM Script de build et déploiement pour la production
REM Usage: scripts\build-production.bat

echo ========================================
echo Build Production - FeedToki
echo ========================================
echo.

REM Vérifier que nous sommes dans le bon répertoire
if not exist "package.json" (
    echo Erreur: Ce script doit être exécuté depuis le répertoire toki-app
    echo Veuillez exécuter: cd toki-app puis scripts\build-production.bat
    exit /b 1
)

REM Vérifier que .env.production existe
if not exist ".env.production" (
    echo ATTENTION: .env.production non trouvé!
    echo Veuillez copier .env.production.example vers .env.production et remplir les valeurs
    echo.
    pause
    exit /b 1
)

echo [1/5] Vérification des dépendances...
call npm install
if errorlevel 1 (
    echo Erreur lors de l'installation des dépendances
    exit /b 1
)

echo.
echo [2/5] Génération du fichier de version...
for /f "delims=" %%i in ('node -e "console.log(require('./package.json').version)"') do set VERSION=%%i
for /f "delims=" %%i in ('powershell -Command "Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.000Z' -AsUTC"') do set BUILD_DATE=%%i
(
echo // Ce fichier est généré automatiquement par scripts/build-production.bat
echo // NE PAS MODIFIER MANUELLEMENT
echo export const BUILD_VERSION = '%VERSION%';
echo export const BUILD_DATE = '%BUILD_DATE%';
) > lib\build-version.ts
echo Version injectée: %VERSION% (build: %BUILD_DATE%)

echo.
echo [3/5] Nettoyage du répertoire web-build...
if exist "web-build" (
    rmdir /s /q web-build
)

echo.
echo [4/5] Build de l'application pour web...
call npx expo export --platform web --output-dir web-build
if errorlevel 1 (
    echo Erreur lors du build
    exit /b 1
)

echo.
echo [5/5] Déploiement sur Firebase Hosting...
call firebase deploy --only hosting
if errorlevel 1 (
    echo Erreur lors du déploiement
    exit /b 1
)

echo.
echo ========================================
echo Build et déploiement terminés avec succès!
echo ========================================
echo.
echo L'application est maintenant disponible sur:
echo https://feed-toki.web.app
echo.

pause


