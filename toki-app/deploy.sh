#!/bin/bash
# Script de déploiement pour FeedToki

echo "🚀 Déploiement FeedToki..."
echo ""

# Aller dans le dossier de l'app
cd "$(dirname "$0")"

echo "📦 Étape 1: Build de l'application web..."
npx expo export --platform web --output-dir web-build 2>&1 | grep -v "EPERM" || echo "⚠️  Build en cours (certains fichiers peuvent être verrouillés)"

echo ""
echo "📤 Étape 2: Déploiement sur Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Déploiement terminé!"
echo "🌐 Vérifie sur: https://feed-toki.web.app"
echo ""
echo "💡 Astuce: Rafraîchis la page (F5) pour voir les changements"

