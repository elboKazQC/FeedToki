/**
 * Script de vérification de la version dans le bundle généré
 * Vérifie que BUILD_VERSION dans le bundle correspond à la version dans package.json
 * 
 * Usage: ts-node scripts/verify-build-version.ts [bundle-path]
 */

import * as fs from 'fs';
import * as path from 'path';

const BUNDLE_GLOB = '_expo/static/js/web/entry-*.js';

function findBundleFile(buildDir: string): string | null {
  const bundleDir = path.join(buildDir, '_expo', 'static', 'js', 'web');
  
  if (!fs.existsSync(bundleDir)) {
    console.error(`❌ Répertoire bundle non trouvé: ${bundleDir}`);
    return null;
  }

  const files = fs.readdirSync(bundleDir);
  const entryFile = files.find(f => f.startsWith('entry-') && f.endsWith('.js'));
  
  if (!entryFile) {
    console.error(`❌ Fichier bundle entry non trouvé dans ${bundleDir}`);
    return null;
  }

  return path.join(bundleDir, entryFile);
}

function extractBuildVersion(bundlePath: string): string | null {
  try {
    const content = fs.readFileSync(bundlePath, 'utf-8');
    
    // Le bundle est minifié, donc chercher de manière flexible
    // Format possible: BUILD_VERSION:"1.0.21" ou BUILD_VERSION='1.0.21' ou BUILD_VERSION="1.0.21"
    
    // Essayer plusieurs patterns pour trouver BUILD_VERSION
    const patterns = [
      // Pattern 1: BUILD_VERSION:"1.0.21" (minifié avec guillemets doubles)
      /BUILD_VERSION["']?\s*[:=]\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']/,
      // Pattern 2: BUILD_VERSION='1.0.21' (avec guillemets simples)
      /BUILD_VERSION\s*=\s*['"]([0-9]+\.[0-9]+\.[0-9]+)['"]/,
      // Pattern 3: BUILD_VERSION: "1.0.21" (avec espace)
      /BUILD_VERSION\s*:\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']/,
      // Pattern 4: BUILD_VERSION="1.0.21" (format standard)
      /BUILD_VERSION\s*=\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']/,
      // Pattern 5: Chercher près de "build-version" (nom du module)
      /build-version[^"']*BUILD_VERSION[^"']*["']([0-9]+\.[0-9]+\.[0-9]+)["']/i,
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Si aucun pattern ne fonctionne, chercher toutes les versions 1.0.XX dans le bundle
    // et prendre la plus récente (la plus grande)
    const allVersions = content.match(/([0-9]+\.[0-9]+\.[0-9]+)/g);
    if (allVersions) {
      // Filtrer pour ne garder que les versions qui ressemblent à notre format (1.0.XX)
      const validVersions = allVersions.filter(v => /^1\.0\.\d+$/.test(v));
      if (validVersions.length > 0) {
        // Trier et prendre la plus récente
        const sortedVersions = validVersions.sort((a, b) => {
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);
          if (aParts[2] !== bParts[2]) return bParts[2] - aParts[2];
          return 0;
        });
        const foundVersion = sortedVersions[0];
        console.warn(`⚠️  Version trouvée par recherche large: ${foundVersion}`);
        console.warn(`   (Cette détection est moins fiable - BUILD_VERSION peut ne pas être correctement inclus)`);
        return foundVersion;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture du bundle: ${error}`);
    return null;
  }
}

function getPackageVersion(): string {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  return packageJson.version;
}

function main() {
  const buildDir = process.argv[2] || path.join(__dirname, '..', 'web-build');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification de la version dans le bundle');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📁 Répertoire de build: ${buildDir}`);
  console.log('');
  
  // Trouver le fichier bundle
  const bundlePath = findBundleFile(buildDir);
  if (!bundlePath) {
    console.error('❌ Impossible de trouver le fichier bundle');
    process.exit(1);
  }
  
  console.log(`📦 Fichier bundle: ${path.basename(bundlePath)}`);
  console.log(`   Chemin complet: ${bundlePath}`);
  console.log('');
  
  // Extraire la version du bundle
  const bundleVersion = extractBuildVersion(bundlePath);
  if (!bundleVersion) {
    console.error('❌ Impossible d\'extraire BUILD_VERSION du bundle');
    console.error('   Le bundle peut ne pas contenir la version ou le format a changé');
    process.exit(1);
  }
  
  console.log(`📋 Version dans le bundle: ${bundleVersion}`);
  
  // Lire la version de package.json
  const packageVersion = getPackageVersion();
  console.log(`📋 Version dans package.json: ${packageVersion}`);
  console.log('');
  
  // Comparer
  if (bundleVersion === packageVersion) {
    console.log('✅ SUCCÈS: Les versions correspondent!');
    console.log(`   Bundle: ${bundleVersion} === package.json: ${packageVersion}`);
    console.log('');
    console.log('✅ Le bundle est prêt pour le déploiement');
    process.exit(0);
  } else {
    console.error('❌ ERREUR: Les versions ne correspondent pas!');
    console.error(`   Bundle: ${bundleVersion} !== package.json: ${packageVersion}`);
    console.error('');
    console.error('⚠️  Le bundle contient une version incorrecte.');
    console.error('   Causes possibles:');
    console.error('   1. Le cache Metro n\'a pas été vidé (utiliser --clear)');
    console.error('   2. build-version.ts n\'a pas été régénéré avant le build');
    console.error('   3. Le build a utilisé un ancien fichier build-version.ts');
    console.error('');
    console.error('🔧 Solutions:');
    console.error('   1. Vérifier que build-version.ts contient la bonne version');
    console.error('   2. Rebuild avec: npx expo export --platform web --clear --output-dir web-build');
    console.error('   3. Utiliser le script build-production.bat qui régénère build-version.ts automatiquement');
    process.exit(1);
  }
}

main();
