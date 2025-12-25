// Système de niveaux et progression du dragon basé sur les jours consécutifs
import { DragonStatus } from './stats';

export type DragonLevel = {
  level: number;
  name: string;
  minDays: number;    // Jours consécutifs minimum
  maxDays: number;    // Jours consécutifs maximum
  emoji: string; // Placeholder jusqu'à ce que les vraies images soient ajoutées
  description: string;
};

// 12 niveaux d'évolution du dragon - 1 niveau = 30 jours consécutifs (1 mois)
export const DRAGON_LEVELS: DragonLevel[] = [
  {
    level: 1,
    name: "Oeuf Mystérieux",
    minDays: 0,
    maxDays: 29,
    emoji: "🥚",
    description: "Un oeuf mystérieux attend d'éclore..."
  },
  {
    level: 2,
    name: "Éclosion",
    minDays: 30,
    maxDays: 59,
    emoji: "🐣",
    description: "L'oeuf commence à craquer! (1 mois)"
  },
  {
    level: 3,
    name: "Bébé Dragon",
    minDays: 60,
    maxDays: 89,
    emoji: "🐲",
    description: "Un bébé dragon vient de naître! (2 mois)"
  },
  {
    level: 4,
    name: "Dragon Enfant",
    minDays: 90,
    maxDays: 119,
    emoji: "🐉",
    description: "Ton dragon grandit et devient curieux (3 mois)"
  },
  {
    level: 5,
    name: "Dragon Adolescent",
    minDays: 120,
    maxDays: 149,
    emoji: "🐲",
    description: "Les ailes de ton dragon commencent à pousser (4 mois)"
  },
  {
    level: 6,
    name: "Jeune Dragon",
    minDays: 150,
    maxDays: 179,
    emoji: "🐉",
    description: "Ton dragon peut maintenant voler! (5 mois)"
  },
  {
    level: 7,
    name: "Dragon Adulte",
    minDays: 180,
    maxDays: 209,
    emoji: "🐲",
    description: "Un dragon pleinement formé et majestueux (6 mois)"
  },
  {
    level: 8,
    name: "Dragon Sage",
    minDays: 210,
    maxDays: 239,
    emoji: "🐉",
    description: "Ton dragon possède une grande sagesse (7 mois)"
  },
  {
    level: 9,
    name: "Dragon Ancien",
    minDays: 240,
    maxDays: 269,
    emoji: "🐲",
    description: "Un dragon ancien et puissant (8 mois)"
  },
  {
    level: 10,
    name: "Dragon Légendaire",
    minDays: 270,
    maxDays: 299,
    emoji: "⭐",
    description: "Un dragon de légende! (9 mois)"
  },
  {
    level: 11,
    name: "Dragon Mythique",
    minDays: 300,
    maxDays: 329,
    emoji: "✨",
    description: "Un dragon cosmique ultra-rare (10 mois)"
  },
  {
    level: 12,
    name: "Dragon Divin",
    minDays: 330,
    maxDays: Infinity,
    emoji: "🌟",
    description: "Le summum de la perfection draconique! (11 mois)"
  }
];

/**
 * Calculer le niveau du dragon selon les jours consécutifs de streak
 */
export function getDragonLevel(streakDays: number): DragonLevel {
  // Trouver le niveau correspondant
  for (let i = DRAGON_LEVELS.length - 1; i >= 0; i--) {
    if (streakDays >= DRAGON_LEVELS[i].minDays) {
      return DRAGON_LEVELS[i];
    }
  }
  return DRAGON_LEVELS[0];
}

/**
 * Calculer la progression vers le prochain niveau (0-1)
 */
export function getDragonProgress(streakDays: number): number {
  const currentLevel = getDragonLevel(streakDays);
  
  if (currentLevel.maxDays === Infinity) {
    return 1; // Max level atteint
  }
  
  const daysInLevel = streakDays - currentLevel.minDays;
  const levelRange = currentLevel.maxDays - currentLevel.minDays;
  
  return Math.min(1, daysInLevel / levelRange);
}

/**
 * Jours nécessaires pour le prochain niveau
 */
export function getPointsToNextLevel(streakDays: number): number {
  const currentLevel = getDragonLevel(streakDays);
  
  if (currentLevel.maxDays === Infinity) {
    return 0; // Déjà au max
  }
  
  return currentLevel.maxDays - streakDays + 1;
}

// Alias pour clarté
export const getDaysToNextLevel = getPointsToNextLevel;

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
