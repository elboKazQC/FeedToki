import {
  estimateTDEE,
  calculateWeeklyTarget,
  calculateDailyPoints,
  calculateMaxCap,
  computeUserProfile,
  getGoalDescription,
  getDailyCalorieTarget,
} from '../lib/points-calculator';
import { WeightGoal, ActivityLevel } from '../lib/types';

describe('points-calculator', () => {
  describe('estimateTDEE', () => {
    it('should calculate TDEE for sedentary activity', () => {
      const result = estimateTDEE(75, 'sedentary');
      expect(result).toBe(75 * 30); // 2250
    });

    it('should calculate TDEE for moderate activity', () => {
      const result = estimateTDEE(75, 'moderate');
      expect(result).toBe(75 * 33); // 2475
    });

    it('should calculate TDEE for active activity', () => {
      const result = estimateTDEE(75, 'active');
      expect(result).toBe(75 * 37); // 2775
    });

    it('should round the result', () => {
      const result = estimateTDEE(70.5, 'moderate');
      expect(result).toBe(Math.round(70.5 * 33)); // 2327
    });
  });

  describe('calculateWeeklyTarget', () => {
    const tdee = 2500; // Example TDEE

    it('should calculate maintenance goal', () => {
      const result = calculateWeeklyTarget('maintenance', tdee);
      expect(result).toBe(tdee * 7); // 17500
    });

    it('should calculate lose-1lb goal', () => {
      const result = calculateWeeklyTarget('lose-1lb', tdee);
      expect(result).toBe(tdee * 7 - 3500); // 14000
    });

    it('should calculate lose-2lb goal', () => {
      const result = calculateWeeklyTarget('lose-2lb', tdee);
      expect(result).toBe(tdee * 7 - 7000); // 10500
    });

    it('should calculate lose-3lb goal', () => {
      const result = calculateWeeklyTarget('lose-3lb', tdee);
      expect(result).toBe(tdee * 7 - 10500); // 7000
    });

    it('should round the result', () => {
      const tdeeDecimal = 2500.7;
      const result = calculateWeeklyTarget('maintenance', tdeeDecimal);
      expect(result).toBe(Math.round(tdeeDecimal * 7));
    });
  });

  describe('calculateDailyPoints', () => {
    it('should calculate points for maintenance goal (high calories)', () => {
      const weeklyTarget = 17500; // Maintenance for ~2500 TDEE
      const result = calculateDailyPoints(weeklyTarget);
      // Weekly indulgence: 17500 * 0.30 = 5250
      // Daily indulgence: 5250 / 7 = 750
      // Base points: 750 / 100 = 7.5 -> 8
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThanOrEqual(12);
    });

    it('should calculate points for aggressive deficit (≤12500)', () => {
      const weeklyTarget = 10500; // lose-2lb for ~2500 TDEE
      const result = calculateDailyPoints(weeklyTarget);
      // Weekly indulgence: 10500 * 0.30 = 3150
      // Daily indulgence: 3150 / 7 = 450
      // Base points: 450 / 100 = 4.5 -> 5
      // Bonus +1 for aggressive deficit: 6
      expect(result).toBe(6);
    });

    it('should enforce minimum of 3 points', () => {
      const weeklyTarget = 5000; // Very low target
      const result = calculateDailyPoints(weeklyTarget);
      expect(result).toBeGreaterThanOrEqual(3);
    });

    it('should handle edge case: exactly 12500 calories', () => {
      const result = calculateDailyPoints(12500);
      // Should get bonus +1
      const weeklyIndulgence = 12500 * 0.30;
      const dailyIndulgence = weeklyIndulgence / 7;
      const basePoints = Math.round(dailyIndulgence / 100);
      expect(result).toBe(basePoints + 1);
    });

    it('should handle edge case: 12501 calories (no bonus)', () => {
      const result = calculateDailyPoints(12501);
      // Should NOT get bonus (just above threshold)
      const weeklyIndulgence = 12501 * 0.30;
      const dailyIndulgence = weeklyIndulgence / 7;
      const basePoints = Math.round(dailyIndulgence / 100);
      expect(result).toBe(basePoints);
    });
  });

  describe('calculateMaxCap', () => {
    it('should calculate cap as 4x daily points but cap at 12', () => {
      const dailyPoints = 6;
      const result = calculateMaxCap(dailyPoints);
      // 6 * 4 = 24, but capped at ABSOLUTE_MAX_CAP (12)
      expect(result).toBe(12);
    });

    it('should cap at absolute maximum of 12', () => {
      const dailyPoints = 5;
      const result = calculateMaxCap(dailyPoints);
      expect(result).toBe(12); // 5*4=20, but capped at 12
    });

    it('should cap at 12 even for low daily points', () => {
      const dailyPoints = 3;
      const result = calculateMaxCap(dailyPoints);
      expect(result).toBe(12); // 3*4=12, capped at 12
    });
  });

  describe('computeUserProfile', () => {
    it('should compute profile with weight and goal', () => {
      const profile = computeUserProfile('lose-2lb', 80, 'moderate');
      
      expect(profile.weightGoal).toBe('lose-2lb');
      expect(profile.currentWeight).toBe(80);
      expect(profile.activityLevel).toBe('moderate');
      expect(profile.tdeeEstimate).toBe(80 * 33); // 2640
      expect(profile.weeklyCalorieTarget).toBeLessThan(profile.tdeeEstimate! * 7);
      expect(profile.dailyPointsBudget).toBeGreaterThanOrEqual(3);
      expect(profile.maxPointsCap).toBe(12); // Capped at 12
      expect(profile.onboardingCompleted).toBe(true);
      expect(profile.createdAt).toBeDefined();
    });

    it('should use default weight (75kg) when not provided', () => {
      const profile = computeUserProfile('maintenance', undefined, 'moderate');
      
      expect(profile.currentWeight).toBe(75);
      expect(profile.tdeeEstimate).toBe(75 * 33); // 2475
    });

    it('should use default activity level (moderate) when not provided', () => {
      const profile = computeUserProfile('maintenance', 80);
      
      expect(profile.activityLevel).toBe('moderate');
      expect(profile.tdeeEstimate).toBe(80 * 33);
    });

    it('should calculate all fields correctly for lose-1lb goal', () => {
      const profile = computeUserProfile('lose-1lb', 70, 'active');
      
      expect(profile.tdeeEstimate).toBe(70 * 37); // 2590
      const expectedWeekly = profile.tdeeEstimate! * 7 - 3500;
      expect(profile.weeklyCalorieTarget).toBe(expectedWeekly);
    });
  });

  describe('getGoalDescription', () => {
    it('should return correct description for each goal', () => {
      expect(getGoalDescription('maintenance')).toBe('Maintenir ton poids actuel');
      expect(getGoalDescription('lose-1lb')).toBe('Perdre ~1 lb par semaine');
      expect(getGoalDescription('lose-2lb')).toBe('Perdre ~2 lbs par semaine');
      expect(getGoalDescription('lose-3lb')).toBe('Perdre ~3 lbs par semaine');
    });
  });

  describe('getDailyCalorieTarget', () => {
    it('should calculate daily target from weekly', () => {
      const weeklyTarget = 14000;
      const result = getDailyCalorieTarget(weeklyTarget);
      expect(result).toBe(2000); // 14000 / 7 = 2000
    });

    it('should round the result', () => {
      const weeklyTarget = 14001;
      const result = getDailyCalorieTarget(weeklyTarget);
      expect(result).toBe(2000); // 14001 / 7 = 2000.14... -> 2000
    });
  });
});

