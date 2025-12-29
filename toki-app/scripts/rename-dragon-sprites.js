// Script pour renommer et déplacer les sprites dragon
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../assets/images');
const targetDir = path.join(__dirname, '../assets/images/dragon');

// Créer le dossier dragon s'il n'existe pas
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('✅ Dossier dragon créé');
}

console.log('🐉 Renommage des sprites dragon...\n');

let renamed = 0;
let errors = 0;

for (let i = 1; i <= 12; i++) {
  const oldName = `lvl ${i}.png`;
  const newName = `level-${i}.png`;
  
  const oldPath = path.join(sourceDir, oldName);
  const newPath = path.join(targetDir, newName);
  
  // Vérifier si le fichier source existe
  if (!fs.existsSync(oldPath)) {
    console.log(`⚠️  ${oldName} non trouvé, skip`);
    continue;
  }
  
  // Vérifier si le fichier destination existe déjà
  if (fs.existsSync(newPath)) {
    console.log(`⚠️  ${newName} existe déjà, skip`);
    continue;
  }
  
  try {
    // Copier le fichier vers le nouveau nom et emplacement
    fs.copyFileSync(oldPath, newPath);
    console.log(`✅ ${oldName} → ${newName}`);
    renamed++;
  } catch (error) {
    console.error(`❌ Erreur pour ${oldName}:`, error.message);
    errors++;
  }
}

console.log(`\n✨ Terminé! ${renamed} fichiers renommés`);
if (errors > 0) {
  console.log(`⚠️  ${errors} erreurs`);
}

console.log(`\n📁 Fichiers dans: ${targetDir}`);
console.log('\n📝 Prochaine étape: Décommenter DRAGON_IMAGES dans components/dragon-display.tsx');

