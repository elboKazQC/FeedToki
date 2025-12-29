// Script simplifié pour générer les sprites - Version manuelle avec instructions
// Ce script génère les URLs et instructions pour générer les images

const fs = require('fs');
const path = require('path');

const DRAGON_PROMPTS = {
  1: "Cute kawaii dragon egg, simple design, subtle patterns, golden accents, white and cream colors, front view, transparent background, game asset, PNG, 512x512",
  2: "Cute kawaii dragon hatching from egg, cracked shell, baby dragon head visible, happy expression, pastel colors, front view, transparent background, game asset, PNG, 512x512",
  3: "Cute kawaii baby dragon, small size, big eyes, happy expression, tiny wings, pastel colors (pink, blue, green), front view, transparent background, game asset, PNG, 512x512",
  4: "Cute kawaii young dragon, growing up, curious eyes, playful expression, small wings developing, vibrant pastel colors, front view, transparent background, game asset, PNG, 512x512",
  5: "Cute kawaii teenage dragon, wings growing, confident expression, medium size, vibrant colors, front view, transparent background, game asset, PNG, 512x512",
  6: "Cute kawaii young adult dragon, fully developed wings, majestic pose, confident expression, rich colors, front view, transparent background, game asset, PNG, 512x512",
  7: "Cute kawaii adult dragon, fully grown, majestic and balanced, wise expression, deep rich colors, front view, transparent background, game asset, PNG, 512x512",
  8: "Cute kawaii wise dragon, sage expression, subtle glow or halo, noble colors (gold, purple, deep blue), front view, transparent background, game asset, PNG, 512x512",
  9: "Cute kawaii ancient dragon, majestic and impressive, elaborate details, royal colors, front view, transparent background, game asset, PNG, 512x512",
  10: "Cute kawaii legendary dragon, imposing presence, subtle light effects, glowing details, bright colors, front view, transparent background, game asset, PNG, 512x512",
  11: "Cute kawaii mythical dragon, cosmic theme, stars and galaxy patterns, ultra-rare appearance, cosmic colors (purple, deep blue, stars), front view, transparent background, game asset, PNG, 512x512",
  12: "Cute kawaii divine dragon, transcendent appearance, ultra majestic, perfect form, divine colors (gold, white, light), glowing aura, front view, transparent background, game asset, PNG, 512x512"
};

function generateInstructions() {
  const outputDir = path.join(__dirname, '../assets/images/dragon');
  const instructionsPath = path.join(outputDir, 'GENERATION_INSTRUCTIONS.txt');
  
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let instructions = `🐉 INSTRUCTIONS POUR GÉNÉRER LES SPRITES DRAGON\n`;
  instructions += `================================================\n\n`;
  instructions += `MÉTHODE RAPIDE: Utilise ChatGPT (DALL-E 3) ou Bing Image Creator\n\n`;
  instructions += `ÉTAPE 1: Ouvre https://chat.openai.com (ChatGPT Plus) ou https://www.bing.com/images/create\n\n`;
  instructions += `ÉTAPE 2: Pour chaque niveau, copie-colle le prompt ci-dessous:\n\n`;

  for (let level = 1; level <= 12; level++) {
    const levelNames = {
      1: "Oeuf Mystérieux",
      2: "Éclosion",
      3: "Bébé Dragon",
      4: "Dragon Enfant",
      5: "Dragon Adolescent",
      6: "Jeune Dragon",
      7: "Dragon Adulte",
      8: "Dragon Sage",
      9: "Dragon Ancien",
      10: "Dragon Légendaire",
      11: "Dragon Mythique",
      12: "Dragon Divin"
    };

    instructions += `--- NIVEAU ${level}: ${levelNames[level]} ---\n`;
    instructions += `Prompt: ${DRAGON_PROMPTS[level]}\n\n`;
  }

  instructions += `ÉTAPE 3: Télécharge chaque image et renomme-la:\n`;
  instructions += `  - level-1.png\n`;
  instructions += `  - level-2.png\n`;
  instructions += `  - ... (jusqu'à level-12.png)\n\n`;

  instructions += `ÉTAPE 4: Place toutes les images dans:\n`;
  instructions += `  ${outputDir}\n\n`;

  instructions += `ÉTAPE 5: Décommente DRAGON_IMAGES dans components/dragon-display.tsx\n\n`;

  instructions += `ALTERNATIVE GRATUITE:\n`;
  instructions += `- Bing Image Creator: https://www.bing.com/images/create (gratuit)\n`;
  instructions += `- Leonardo.ai: https://leonardo.ai (150 crédits gratuits/jour)\n`;
  instructions += `- Hugging Face: https://huggingface.co/spaces/stabilityai/stable-diffusion\n\n`;

  fs.writeFileSync(instructionsPath, instructions);
  console.log('✅ Instructions générées!');
  console.log(`📄 Fichier: ${instructionsPath}\n`);
  console.log('📋 Instructions:\n');
  console.log(instructions);
}

if (require.main === module) {
  generateInstructions();
}

module.exports = { generateInstructions, DRAGON_PROMPTS };

