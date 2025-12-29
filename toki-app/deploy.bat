@echo off
REM Script de déploiement pour FeedToki (Windows)

echo 🚀 Déploiement FeedToki...
echo.

cd /d "%~dp0"

echo 📦 Étape 1: Build de l'application web...
call npx expo export --platform web --output-dir web-build > build.log 2>&1
if errorlevel 1 (
    echo ⚠️  Erreur de build, voir build.log
    type build.log
)

echo.
echo 📤 Étape 2: Déploiement sur Firebase Hosting...
call firebase deploy --only hosting

echo.
echo ✅ Déploiement terminé!
echo 🌐 Vérifie sur: https://feed-toki.web.app
echo.
echo 💡 Astuce: Rafraîchis la page (F5) pour voir les changements

pause

