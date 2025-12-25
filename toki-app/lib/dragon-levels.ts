// Système de niveaux et progression du dragon
import { DragonStatus } from './stats';

export type DragonLevel = {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  emoji: string; // Placeholder jusqu'à ce que les vraies images soient ajoutées
  description: string;
};

// 12 niveaux d'évolution du dragon
export const DRAGON_LEVELS: DragonLevel[] = [
  {
    level: 1,
    name: "Oeuf Mystérieux",
    minPoints: 0,
    maxPoints: 100,
    emoji: "🥚",
    description: "Un oeuf mystérieux attend d'éclore..."
  },
  {
    level: 2,
    name: "Éclosion",
    minPoints: 101,
    maxPoints: 300,
    emoji: "🐣",
    description: "L'oeuf commence à craquer!"
  },
  {
    level: 3,
    name: "Bébé Dragon",
    minPoints: 301,
    maxPoints: 600,
    emoji: "🐲",
    description: "Un bébé dragon vient de naître!"
  },
  {
    level: 4,
    name: "Dragon Enfant",
    minPoints: 601,
    maxPoints: 1000,
    emoji: "🐉",
    description: "Ton dragon grandit et devient curieux"
  },
  {
    level: 5,
    name: "Dragon Adolescent",
    minPoints: 1001,
    maxPoints: 1500,
    emoji: "🐲",
    description: "Les ailes de ton dragon commencent à pousser"
  },
  {
    level: 6,
    name: "Jeune Dragon",
    minPoints: 1501,
    maxPoints: 2200,
    emoji: "🐉",
    description: "Ton dragon peut maintenant voler!"
  },
  {
    level: 7,
    name: "Dragon Adulte",
    minPoints: 2201,
    maxPoints: 3000,
    emoji: "🐲",
    description: "Un dragon pleinement formé et majestueux"
  },
  {
    level: 8,
    name: "Dragon Sage",
    minPoints: 3001,
    maxPoints: 4000,
    emoji: "🐉",
    description: "Ton dragon possède une grande sagesse"
  },
  {
    level: 9,
    name: "Dragon Ancien",
    minPoints: 4001,
    maxPoints: 5500,
    emoji: "🐲",
    description: "Un dragon ancien et puissant"
  },
  {
    level: 10,
    name: "Dragon Légendaire",
    minPoints: 5501,
    maxPoints: 7500,
    emoji: "⭐",
    description: "Un dragon de légende!"
  },
  {
    level: 11,
    name: "Dragon Mythique",
    minPoints: 7501,
    maxPoints: 10000,
    emoji: "✨",
    description: "Un dragon cosmique ultra-rare"
  },
  {
    level: 12,
    name: "Dragon Divin",
    minPoints: 10001,
    maxPoints: Infinity,
    emoji: "🌟",
    description: "Le summum de la perfection draconique!"
  }
];

/**
 * Calculer le niveau du dragon selon les points totaux accumulés
 */
export function getDragonLevel(totalPoints: number): DragonLevel {
  // Trouver le niveau correspondant
  for (let i = DRAGON_LEVELS.length - 1; i >= 0; i--) {
    if (totalPoints >= DRAGON_LEVELS[i].minPoints) {
      return DRAGON_LEVELS[i];
    }
  }
  return DRAGON_LEVELS[0];
}

/**
 * Calculer la progression vers le prochain niveau (0-1)
 */
export function getDragonProgress(totalPoints: number): number {
  const currentLevel = getDragonLevel(totalPoints);
  
  if (currentLevel.maxPoints === Infinity) {
    return 1; // Max level atteint
  }
  
  const pointsInLevel = totalPoints - currentLevel.minPoints;
  const levelRange = currentLevel.maxPoints - currentLevel.minPoints;
  
  return Math.min(1, pointsInLevel / levelRange);
}

/**
 * Points nécessaires pour le prochain niveau
 */
export function getPointsToNextLevel(totalPoints: number): number {
  const currentLevel = getDragonLevel(totalPoints);
  
  if (currentLevel.maxPoints === Infinity) {
    return 0; // Déjà au max
  }
  
  return currentLevel.maxPoints - totalPoints + 1;
}

/**
 * Obtenir le chemin de l'image du dragon (si elle existe)
 */
export function getDragonImagePath(level: number, mood?: DragonStatus['mood']): string | null {
  // Vérifier si l'image existe (à implémenter avec require.resolve ou Asset)
  // Pour l'instant, retourne null pour utiliser le placeholder emoji
  const basePath = `assets/images/dragon/level-${level}`;
  
  if (mood) {
    // Chercher une variation d'humeur spécifique
    return `${basePath}-${mood}.png`;
  }
  
  return `${basePath}.png`;
}

/**
 * Messages d'encouragement selon le niveau atteint
 */
export function getLevelUpMessage(newLevel: number): string {
  const messages: Record<number, string> = {
    2: "🎉 Ton oeuf éclot! Continue comme ça!",
    3: "🐲 Félicitations! Ton bébé dragon est né!",
    4: "🌟 Ton dragon grandit! Tu es sur la bonne voie!",
    5: "✨ Wow! Les ailes de ton dragon poussent!",
    6: "🚀 Incroyable! Ton dragon peut voler maintenant!",
    7: "💪 Dragon adulte débloqué! Tu es un pro!",
    8: "🧙 Ton dragon est devenu sage! Impressionnant!",
    9: "⚡ Dragon Ancien! Tu maîtrises l'art de la modération!",
    10: "🏆 LÉGENDAIRE! Ton dragon est une légende vivante!",
    11: "🌌 MYTHIQUE! Ton dragon transcende les limites!",
    12: "👑 DIVIN! Tu as atteint la perfection absolue!"
  };
  
  return messages[newLevel] || "🎊 Niveau supérieur atteint!";
}
