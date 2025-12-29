// Script pour générer les sprites dragon avec IA
// Utilise Hugging Face Inference API (gratuit) ou DALL-E

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Polyfill fetch pour Node.js < 18
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  console.error('❌ fetch non disponible. Installe node-fetch: npm install node-fetch');
  process.exit(1);
}

// Prompts pour chaque niveau
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

// Option 1: Utiliser Hugging Face Inference API (gratuit)
async function generateWithHuggingFace(level, prompt) {
  const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
  const HF_API_KEY = process.env.HF_API_KEY || ""; // Optionnel pour certains modèles
  
  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": HF_API_KEY ? `Bearer ${HF_API_KEY}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: 512,
          height: 512,
          num_inference_steps: 30,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    return Buffer.from(imageBuffer);
  } catch (error) {
    console.error(`Erreur génération niveau ${level}:`, error);
    throw error;
  }
}

// Option 2: Utiliser OpenAI DALL-E (payant mais meilleure qualité)
async function generateWithDALLE(level, prompt) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non définie. Crée un compte sur https://platform.openai.com");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024", // DALL-E 3 génère en 1024x1024
        quality: "standard",
        response_format: "url", // ou "b64_json" pour base64
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0].url;
    
    // Télécharger l'image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(imageBuffer);
  } catch (error) {
    console.error(`Erreur génération niveau ${level}:`, error);
    throw error;
  }
}

// Fonction principale
async function generateAllSprites() {
  const outputDir = path.join(__dirname, '../assets/images/dragon');
  
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🐉 Génération des sprites dragon...\n');
  console.log('Options disponibles:');
  console.log('1. Hugging Face (gratuit, nécessite HF_API_KEY optionnel)');
  console.log('2. OpenAI DALL-E 3 (payant ~$0.04/image, meilleure qualité)\n');
  
  const useDALLE = process.env.USE_DALLE === 'true' || process.argv.includes('--dalle');
  
  if (useDALLE && !process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY non définie pour DALL-E');
    console.log('Pour utiliser DALL-E:');
    console.log('1. Crée un compte sur https://platform.openai.com');
    console.log('2. Génère une clé API');
    console.log('3. Exécute: export OPENAI_API_KEY="ta-clé" && node scripts/generate-dragon-sprites.js --dalle');
    process.exit(1);
  }

  const generator = useDALLE ? generateWithDALLE : generateWithHuggingFace;
  const method = useDALLE ? 'DALL-E 3' : 'Hugging Face';

  for (let level = 1; level <= 12; level++) {
    const prompt = DRAGON_PROMPTS[level];
    const outputPath = path.join(outputDir, `level-${level}.png`);
    
    // Skip si l'image existe déjà
    if (fs.existsSync(outputPath)) {
      console.log(`⏭️  Niveau ${level}: Image existe déjà, skip`);
      continue;
    }

    console.log(`🎨 Génération niveau ${level}/12 avec ${method}...`);
    console.log(`   Prompt: ${prompt.substring(0, 80)}...`);

    try {
      const imageBuffer = await generator(level, prompt);
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`✅ Niveau ${level} généré: ${outputPath}\n`);
      
      // Attendre un peu entre les requêtes pour éviter rate limiting
      if (level < 12) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Erreur niveau ${level}:`, error.message);
      console.log(`   Continuer avec le niveau suivant...\n`);
    }
  }

  console.log('✨ Génération terminée!');
  console.log(`📁 Images sauvegardées dans: ${outputDir}`);
  console.log('\n📝 Prochaines étapes:');
  console.log('1. Vérifier les images générées');
  console.log('2. Décommenter DRAGON_IMAGES dans components/dragon-display.tsx');
  console.log('3. Redémarrer l\'app pour voir les sprites!');
}

// Exécuter
if (require.main === module) {
  generateAllSprites().catch(console.error);
}

module.exports = { generateAllSprites, DRAGON_PROMPTS };

