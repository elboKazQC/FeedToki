// Composant amélioré pour afficher le dragon avec support des images PNG
// Fallback vers emoji si les images ne sont pas disponibles

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native';
import { getDragonLevel, getDragonProgress, getPointsToNextLevel, getLevelUpMessage } from '../lib/dragon-levels';
import { DragonStatus } from '../lib/stats';

type DragonDisplayProps = {
  streakDays: number;  // Jours consécutifs de streak
  mood?: DragonStatus['mood'];
  showInfo?: boolean;
  size?: number;
  onLevelUp?: (newLevel: number) => void; // Callback quand le niveau augmente
};

// Mapping des images dragon
const DRAGON_IMAGES: Record<number, any> = {
  1: require('../assets/images/dragon/level-1.png'),
  2: require('../assets/images/dragon/level-2.png'),
  3: require('../assets/images/dragon/level-3.png'),
  4: require('../assets/images/dragon/level-4.png'),
  5: require('../assets/images/dragon/level-5.png'),
  6: require('../assets/images/dragon/level-6.png'),
  7: require('../assets/images/dragon/level-7.png'),
  8: require('../assets/images/dragon/level-8.png'),
  9: require('../assets/images/dragon/level-9.png'),
  10: require('../assets/images/dragon/level-10.png'),
  11: require('../assets/images/dragon/level-11.png'),
  12: require('../assets/images/dragon/level-12.png'),
};

/**
 * Tenter de charger une image dragon, retourne null si non disponible
 */
function tryLoadDragonImage(level: number): any | null {
  // Vérifier si l'image est dans le mapping
  if (DRAGON_IMAGES[level]) {
    return DRAGON_IMAGES[level];
  }
  // Image non disponible, retourner null pour utiliser l'emoji
  return null;
}

export function DragonDisplay({ 
  streakDays, 
  mood = 'normal',
  showInfo = false,
  size = 120,
  onLevelUp
}: DragonDisplayProps) {
  const level = getDragonLevel(streakDays);
  const progress = getDragonProgress(streakDays);
  const daysToNext = getPointsToNextLevel(streakDays);
  
  // Animation pour les transitions de niveau
  const [fadeAnim] = useState(new Animated.Value(1));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [previousLevel, setPreviousLevel] = useState(level.level);
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false);

  // Détecter changement de niveau
  useEffect(() => {
    if (level.level > previousLevel) {
      // Nouveau niveau atteint!
      setShowLevelUpAnimation(true);
      
      // Tracker l'événement analytics
      trackDragonEvolved({
        level: level.level,
        streakDays: streakDays,
      });
      
      if (onLevelUp) {
        onLevelUp(level.level);
      }
      
      // Animation de célébration
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.5,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setShowLevelUpAnimation(false);
      });
      
      setPreviousLevel(level.level);
    }
  }, [level.level, previousLevel, fadeAnim, scaleAnim, onLevelUp]);

  // Animation de "shake" si mood critique
  useEffect(() => {
    if (mood === 'critique') {
      const shake = Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]);
      
      const loop = Animated.loop(shake, { iterations: 3 });
      loop.start();
    }
  }, [mood, scaleAnim]);

  // Tenter de charger l'image PNG
  const dragonImage = tryLoadDragonImage(level.level);
  const hasImage = dragonImage !== null;

  return (
    <View style={styles.container}>
      {/* Sprite du dragon */}
      <Animated.View 
        style={[
          styles.spriteContainer, 
          { 
            width: size, 
            height: size,
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        {hasImage ? (
          <Image
            source={dragonImage}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        ) : (
          // Fallback emoji si image non disponible
          <Text style={[styles.emoji, { fontSize: size * 0.7 }]}>
            {level.emoji}
          </Text>
        )}
        
        {/* Animation de niveau up */}
        {showLevelUpAnimation && (
          <View style={styles.levelUpOverlay}>
            <Text style={styles.levelUpText}>✨</Text>
          </View>
        )}
      </Animated.View>
      
      {/* Badge de niveau (petit) */}
      <View style={styles.levelBadge}>
        <Text style={styles.levelBadgeText}>Lv.{level.level}</Text>
      </View>
      
      {/* Informations détaillées (optionnel) */}
      {showInfo && (
        <View style={styles.info}>
          <Text style={styles.levelName}>{level.name}</Text>
          <Text style={styles.levelNumber}>Niveau {level.level}/12</Text>
          
          {daysToNext > 0 && (
            <>
              {/* Barre de progression */}
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    { width: `${progress * 100}%` }
                  ]} 
                />
              </View>
              
              <Text style={styles.pointsToNext}>
                {daysToNext} jour{daysToNext > 1 ? 's' : ''} pour niveau suivant
              </Text>
            </>
          )}
          
          {level.level === 12 && (
            <Text style={styles.maxLevel}>🌟 NIVEAU MAX 🌟</Text>
          )}
          
          {/* Indicateur d'humeur */}
          {mood !== 'normal' && (
            <Text style={styles.moodIndicator}>
              {mood === 'inquiet' ? '😟' : mood === 'critique' ? '😰' : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'relative',
  },
  spriteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: 10,
    position: 'relative',
  },
  emoji: {
    textAlign: 'center',
  },
  levelBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  levelUpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 20,
  },
  levelUpText: {
    fontSize: 48,
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
  moodIndicator: {
    fontSize: 24,
    marginTop: 8,
  },
});

