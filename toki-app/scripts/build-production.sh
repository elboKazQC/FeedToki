#!/bin/bash
# Script de build et déploiement pour la production
# Usage: ./scripts/build-production.sh

set -e  # Arrêter en cas d'erreur

echo "========================================"
echo "Build Production - FeedToki"
echo "========================================"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "Erreur: Ce script doit être exécuté depuis le répertoire toki-app"
    echo "Veuillez exécuter: cd toki-app puis ./scripts/build-production.sh"
    exit 1
fi

# Vérifier que .env.production existe
if [ ! -f ".env.production" ]; then
    echo "ATTENTION: .env.production non trouvé!"
    echo "Veuillez copier .env.production.example vers .env.production et remplir les valeurs"
    echo ""
    read -p "Appuyez sur Entrée pour continuer quand même, ou Ctrl+C pour annuler..."
fi

echo "[1/4] Vérification des dépendances..."
npm install

echo ""
echo "[2/4] Nettoyage du répertoire web-build..."
rm -rf web-build

echo ""
echo "[3/4] Build de l'application pour web..."
npx expo export --platform web --output-dir web-build

echo ""
echo "[4/4] Déploiement sur Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "========================================"
echo "Build et déploiement terminés avec succès!"
echo "========================================"
echo ""
echo "L'application est maintenant disponible sur:"
echo "https://feed-toki.web.app"
echo ""


