// Tests pour la logique de recalcul des points avec carryover
// Valide que le solde préserve le cumul jour→jour jusqu'au cap

import { computeFoodPoints } from '../lib/points-utils';
import { FOOD_DB } from '../lib/food-db';

describe('Points Recalc Logic (Carryover)', () => {
  // Fonction extraite de la logique de recalcul
  function calculateExpectedBalance(
    startOfDayBalance: number,
    totalSpentToday: number
  ): number {
    return Math.max(0, startOfDayBalance - totalSpentToday);
  }

  // Fonction de crédit quotidien avec cap
  function creditDailyPoints(
    currentBalance: number,
    dailyBudget: number,
    maxCap: number
  ): number {
    return Math.min(maxCap, currentBalance + dailyBudget);
  }

  describe('creditDailyPoints (carryover)', () => {
    it('should add daily budget to current balance', () => {
      const result = creditDailyPoints(5, 3, 12);
      expect(result).toBe(8); // 5 + 3 = 8
    });

    it('should respect the max cap', () => {
      const result = creditDailyPoints(11, 3, 12);
      expect(result).toBe(12); // 11 + 3 = 14, mais cap à 12
    });

    it('should carry over remaining points', () => {
      const day1Balance = creditDailyPoints(0, 3, 12); // Premier jour: 3 pts
      expect(day1Balance).toBe(3);
      
      // Dépense 1 pt, reste 2
      const day1End = 2;
      
      // Jour 2: cumul
      const day2Balance = creditDailyPoints(day1End, 3, 12);
      expect(day2Balance).toBe(5); // 2 + 3 = 5 (carryover préservé)
    });

    it('should not exceed cap even with multiple days of carryover', () => {
      let balance = 0;
      
      // Jour 1: reçoit 3, dépense 0
      balance = creditDailyPoints(balance, 3, 12);
      expect(balance).toBe(3);
      
      // Jour 2: reçoit 3, dépense 0
      balance = creditDailyPoints(balance, 3, 12);
      expect(balance).toBe(6);
      
      // Jour 3: reçoit 3, dépense 0
      balance = creditDailyPoints(balance, 3, 12);
      expect(balance).toBe(9);
      
      // Jour 4: reçoit 3, dépense 0 (devrait cap à 12)
      balance = creditDailyPoints(balance, 3, 12);
      expect(balance).toBe(12);
      
      // Jour 5: toujours cap à 12
      balance = creditDailyPoints(balance, 3, 12);
      expect(balance).toBe(12);
    });
  });

  describe('calculateExpectedBalance', () => {
    it('should subtract spent from start of day balance', () => {
      const result = calculateExpectedBalance(10, 3);
      expect(result).toBe(7); // 10 - 3 = 7
    });

    it('should not go below 0', () => {
      const result = calculateExpectedBalance(3, 10);
      expect(result).toBe(0); // Max(0, 3 - 10)
    });

    it('should handle exact match', () => {
      const result = calculateExpectedBalance(5, 5);
      expect(result).toBe(0);
    });

    it('should preserve carryover from previous days', () => {
      // Scénario: 
      // - Hier soir: 7 pts restants
      // - Minuit: +3 pts (budget) → startOfDayBalance = 10 pts
      // - Aujourd'hui: dépense 2 pts
      const startOfDayBalance = 10; // 7 (hier) + 3 (budget du jour)
      const totalSpentToday = 2;
      
      const result = calculateExpectedBalance(startOfDayBalance, totalSpentToday);
      expect(result).toBe(8); // 10 - 2 = 8 (les 7 d'hier sont préservés)
    });
  });

  describe('Real-world scenario: multi-day carryover', () => {
    const dailyBudget = 3;
    const maxCap = 12;

    it('should accumulate points over multiple days with minimal spending', () => {
      // Jour 1: commence à 0, reçoit 3, dépense 1
      let balance = creditDailyPoints(0, dailyBudget, maxCap);
      expect(balance).toBe(3);
      let startOfDay = balance;
      balance = calculateExpectedBalance(startOfDay, 1);
      expect(balance).toBe(2); // 3 - 1 = 2
      
      // Jour 2: commence à 2, reçoit 3, dépense 0
      balance = creditDailyPoints(balance, dailyBudget, maxCap);
      expect(balance).toBe(5); // 2 + 3 = 5
      startOfDay = balance;
      balance = calculateExpectedBalance(startOfDay, 0);
      expect(balance).toBe(5); // 5 - 0 = 5
      
      // Jour 3: commence à 5, reçoit 3, dépense 2
      balance = creditDailyPoints(balance, dailyBudget, maxCap);
      expect(balance).toBe(8); // 5 + 3 = 8
      startOfDay = balance;
      balance = calculateExpectedBalance(startOfDay, 2);
      expect(balance).toBe(6); // 8 - 2 = 6
    });

    it('should not lose carryover when recalculating', () => {
      // Scénario: utilisateur a 9 pts (3 jours sans dépense)
      // Il log un repas de 2 pts
      // Le recalcul ne doit PAS faire: dailyBudget(3) - spent(2) = 1
      // Le recalcul doit faire: startOfDayBalance(9) - spent(2) = 7
      
      const startOfDayBalance = 9;
      const totalSpentToday = 2;
      
      const correctBalance = calculateExpectedBalance(startOfDayBalance, totalSpentToday);
      expect(correctBalance).toBe(7); // Pas 1 !
    });
  });

  describe('Integration with food costs', () => {
    it('should calculate correct balance after adding meal', () => {
      // Points de départ: 8
      const startOfDayBalance = 8;
      
      // Ajouter un repas: poulet (0 pts) + riz (2 pts)
      const poulet = FOOD_DB.find(f => f.id === 'poulet');
      const riz = FOOD_DB.find(f => f.id === 'riz');
      
      expect(poulet).toBeDefined();
      expect(riz).toBeDefined();
      
      const pouletCost = computeFoodPoints(poulet!) * Math.sqrt(1.0);
      const rizCost = computeFoodPoints(riz!) * Math.sqrt(1.0);
      const totalCost = Math.round(pouletCost + rizCost);
      
      expect(totalCost).toBeGreaterThan(0); // Riz coûte des points
      
      const newBalance = calculateExpectedBalance(startOfDayBalance, totalCost);
      expect(newBalance).toBe(startOfDayBalance - totalCost);
      expect(newBalance).toBeGreaterThanOrEqual(0);
    });
  });
});
