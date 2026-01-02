/**
 * Animation Helpers - Fonctions utilitaires pour animations réutilisables
 */

import { Animated, Platform } from 'react-native';

/**
 * Fade in animation
 */
export function fadeIn(
  animatedValue: Animated.Value,
  duration: number = 200,
  toValue: number = 1
): Animated.CompositeAnimation {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    useNativeDriver: Platform.OS !== 'web',
  });
}

/**
 * Fade out animation
 */
export function fadeOut(
  animatedValue: Animated.Value,
  duration: number = 200,
  toValue: number = 0
): Animated.CompositeAnimation {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    useNativeDriver: Platform.OS !== 'web',
  });
}

/**
 * Slide up animation
 */
export function slideUp(
  animatedValue: Animated.Value,
  distance: number = 20,
  duration: number = 300
): Animated.CompositeAnimation {
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    useNativeDriver: true,
  });
}

/**
 * Slide down animation
 */
export function slideDown(
  animatedValue: Animated.Value,
  distance: number = 20,
  duration: number = 300
): Animated.CompositeAnimation {
  return Animated.timing(animatedValue, {
    toValue: distance,
    duration,
    useNativeDriver: true,
  });
}

/**
 * Scale in animation
 */
export function scaleIn(
  animatedValue: Animated.Value,
  toValue: number = 1,
  duration: number = 200
): Animated.CompositeAnimation {
  return Animated.spring(animatedValue, {
    toValue,
    friction: 8,
    tension: 40,
    useNativeDriver: Platform.OS !== 'web',
  });
}

/**
 * Scale out animation
 */
export function scaleOut(
  animatedValue: Animated.Value,
  toValue: number = 0,
  duration: number = 200
): Animated.CompositeAnimation {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    useNativeDriver: Platform.OS !== 'web',
  });
}

/**
 * Pulse animation
 */
export function pulse(
  animatedValue: Animated.Value,
  minScale: number = 0.95,
  maxScale: number = 1.05,
  duration: number = 1000
): Animated.CompositeAnimation {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: maxScale,
        duration: duration / 2,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(animatedValue, {
        toValue: minScale,
        duration: duration / 2,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ])
  );
}

/**
 * Button press animation (scale down on press)
 */
export function createPressAnimation(animatedValue: Animated.Value) {
  return {
    pressIn: () => {
      Animated.spring(animatedValue, {
        toValue: 0.95,
        friction: 3,
        tension: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    },
    pressOut: () => {
      Animated.spring(animatedValue, {
        toValue: 1,
        friction: 3,
        tension: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    },
  };
}

/**
 * Shake animation (for errors)
 */
export function shake(
  animatedValue: Animated.Value,
  distance: number = 10,
  duration: number = 400
): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(animatedValue, {
      toValue: distance,
      duration: duration / 5,
      useNativeDriver: Platform.OS !== 'web',
    }),
    Animated.timing(animatedValue, {
      toValue: -distance,
      duration: (duration / 5) * 2,
      useNativeDriver: Platform.OS !== 'web',
    }),
    Animated.timing(animatedValue, {
      toValue: distance,
      duration: (duration / 5) * 2,
      useNativeDriver: Platform.OS !== 'web',
    }),
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: duration / 5,
      useNativeDriver: Platform.OS !== 'web',
    }),
  ]);
}


