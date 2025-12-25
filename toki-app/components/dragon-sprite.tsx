// Composant pour afficher le sprite du dragon
import { View, Text, StyleSheet } from 'react-native';
import { getDragonLevel, getDragonProgress, getPointsToNextLevel } from '../lib/dragon-levels';
import { DragonStatus } from '../lib/stats';

type DragonSpriteProps = {
  totalPoints: number;
  mood?: DragonStatus['mood'];
  showInfo?: boolean;
  size?: number;
};

export function DragonSprite({ 
  totalPoints, 
  mood,
  showInfo = false,
  size = 120 
}: DragonSpriteProps) {
  const level = getDragonLevel(totalPoints);
  const progress = getDragonProgress(totalPoints);
  const pointsToNext = getPointsToNextLevel(totalPoints);
  
  return (
    <View style={styles.container}>
      {/* Sprite du dragon */}
      <View style={[styles.spriteContainer, { width: size, height: size }]}>
        {/* Placeholder emoji */}
        <Text style={[styles.emoji, { fontSize: size * 0.7 }]}>
          {level.emoji}
        </Text>
        
        {/* Pour plus tard, quand les images PNG seront ajoutées:
        <Image
          source={{ uri: `../assets/images/dragon/level-${level.level}.png` }}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
        */}
      </View>
      
      {/* Informations (optionnel) */}
      {showInfo && (
        <View style={styles.info}>
          <Text style={styles.levelName}>{level.name}</Text>
          <Text style={styles.levelNumber}>Niveau {level.level}/12</Text>
          
          {pointsToNext > 0 && (
            <>
              {/* Barre de progression */}
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${progress * 100}%` }]} 
                />
              </View>
              
              <Text style={styles.pointsToNext}>
                {pointsToNext} pts pour niveau suivant
              </Text>
            </>
          )}
          
          {level.level === 12 && (
            <Text style={styles.maxLevel}>🌟 NIVEAU MAX 🌟</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  spriteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: 10,
  },
  emoji: {
    textAlign: 'center',
  },
  info: {
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  levelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 4,
  },
  levelNumber: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#1f2937',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 4,
  },
  pointsToNext: {
    fontSize: 12,
    color: '#6b7280',
  },
  maxLevel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginTop: 8,
  },
});
