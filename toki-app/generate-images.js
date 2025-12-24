const fs = require('fs');
const { createCanvas } = require('canvas');

// Créer des images de test simple (260x260)
function createImage(level, filename) {
  const canvas = createCanvas(260, 260);
  const ctx = canvas.getContext('2d');

  // Couleur de fond
  const bgColor = level === 1 ? '#6b7280' : level === 2 ? '#3b82f6' : '#10b981';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 260, 260);

  // Texte
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const label = level === 1 ? 'Niveau 1' : level === 2 ? 'Niveau 2' : 'Niveau 3';
  ctx.fillText(label, 130, 130);

  // Emoji
  ctx.font = '80px Arial';
  const emoji = level === 1 ? '😐' : level === 2 ? '😊' : '👑';
  ctx.fillText(emoji, 130, 190);

  // Sauvegarder
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`✅ ${filename} créé`);
}

createImage(1, './assets/images/feedtoki_lvl1.png');
createImage(2, './assets/images/feedtoki_lvl2.png');
createImage(3, './assets/images/feedtoki_lvl3.png');
