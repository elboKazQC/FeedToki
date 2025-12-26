import { computeUserProfile } from '../lib/points-calculator';

console.log('🧪 Test du calculateur de points\n');

const testCases = [
  { goal: 'lose-1lb' as const, weight: 90, activity: 'moderate' as const },
  { goal: 'lose-2lb' as const, weight: 90, activity: 'moderate' as const },
  { goal: 'lose-3lb' as const, weight: 90, activity: 'moderate' as const },
  { goal: 'maintenance' as const, weight: 90, activity: 'moderate' as const },
];

testCases.forEach(({ goal, weight, activity }) => {
  const profile = computeUserProfile(goal, weight, activity);
  console.log(`\n📊 ${goal.toUpperCase()} (${weight}kg, ${activity})`);
  console.log(`  TDEE: ${profile.tdeeEstimate} kcal/day`);
  console.log(`  Weekly target: ${profile.weeklyCalorieTarget} kcal`);
  console.log(`  Daily cal: ${Math.round(profile.weeklyCalorieTarget / 7)} kcal`);
  console.log(`  ✨ POINTS/DAY: ${profile.dailyPointsBudget} pts`);
  console.log(`  Max cap: ${profile.maxPointsCap} pts`);
});

console.log('\n✅ Tests terminés\n');
